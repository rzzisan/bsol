<?php

namespace App\Console\Commands;

use App\Services\StickerPreviewService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * Pre-generates every sticker template's preview thumbnail so the first
 * seller to open Settings → Sticker Templates after a deploy doesn't pay
 * the render+rasterize cost live. Optional — StickerPreviewService
 * generates on-demand anyway (self-healing, mtime-invalidated), this just
 * moves the cost to deploy time. See courier_waybill_context.md §6.6.
 */
#[Signature('sticker-templates:warm-previews')]
#[Description('Pre-generate every sticker template\'s preview thumbnail.')]
class WarmStickerPreviews extends Command
{
    public function handle(StickerPreviewService $previews): void
    {
        foreach (array_keys(config('sticker_templates', [])) as $key) {
            $url = $previews->previewUrl($key);
            $this->info($url ? "{$key}: {$url}" : "{$key}: FAILED");
        }
    }
}
