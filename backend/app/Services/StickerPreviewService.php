<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\Process;

/**
 * Generates and caches a PNG preview thumbnail per sticker template, for
 * the template gallery (Settings → Sticker Templates) — see
 * courier_waybill_context.md §6.6. Renders WaybillPdfService::renderPreview()
 * (fixed demo data, no DB) to PDF, then rasterizes page 1 with `pdftoppm`
 * (poppler-utils — already a hard dependency of this codebase's own PDF
 * debugging workflow, confirmed present on this server).
 *
 * Cached to the public disk, one file per template key, auto-invalidated
 * by comparing the cached file's mtime against the template's own Blade
 * partial mtime — a code change to a template's layout regenerates its
 * preview on the next request without any manual cache-busting step.
 */
class StickerPreviewService
{
    private const DIR = 'sticker-previews';

    public function __construct(private readonly WaybillPdfService $waybill) {}

    /** Public URL of the (possibly freshly generated) preview PNG for $key, or null if $key isn't in the catalog. */
    public function previewUrl(string $key): ?string
    {
        $catalog = config('sticker_templates', []);
        if (! isset($catalog[$key])) {
            return null;
        }

        $disk = Storage::disk('public');
        $relativePath = self::DIR . "/{$key}.png";

        if ($this->needsRegeneration($disk, $relativePath, $catalog[$key]['view'] ?? null)) {
            $this->generate($key, $relativePath);
        }

        return $disk->exists($relativePath) ? $disk->url($relativePath) : null;
    }

    private function needsRegeneration($disk, string $relativePath, ?string $view): bool
    {
        if (! $disk->exists($relativePath)) {
            return true;
        }

        if ($view) {
            $viewPath = resource_path(str_replace('.', '/', $view) . '.blade.php');
            if (is_file($viewPath) && filemtime($viewPath) > $disk->lastModified($relativePath)) {
                return true;
            }
        }

        return false;
    }

    private function generate(string $key, string $relativePath): void
    {
        $tmpPdf = tempnam(sys_get_temp_dir(), 'stpv_') . '.pdf';
        $tmpPngPrefix = tempnam(sys_get_temp_dir(), 'stpv_');
        @unlink($tmpPngPrefix); // pdftoppm -singlefile writes exactly "{prefix}.png", nothing to reuse here

        try {
            $pdf = $this->waybill->renderPreview($key);
            file_put_contents($tmpPdf, $pdf->output());

            // -singlefile: writes "{prefix}.png" directly (no "-1" page
            // suffix) — every preview is exactly one page.
            $process = new Process(['pdftoppm', '-r', '150', '-png', '-singlefile', $tmpPdf, $tmpPngPrefix]);
            $process->setTimeout(20);
            $process->run();

            $pngFile = $tmpPngPrefix . '.png';
            if ($process->isSuccessful() && is_file($pngFile)) {
                Storage::disk('public')->put($relativePath, file_get_contents($pngFile));
            } else {
                Log::warning("StickerPreviewService: failed to generate preview for '{$key}'", [
                    'error' => $process->getErrorOutput(),
                ]);
            }
        } finally {
            @unlink($tmpPdf);
            @unlink($tmpPngPrefix . '.png');
        }
    }
}
