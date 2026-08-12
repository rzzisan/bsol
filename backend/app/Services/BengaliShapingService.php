<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

/**
 * Real OpenType text shaping for Bengali (and any other complex script) PDF
 * content, via HarfBuzz — see courier_waybill_context.md §4.7 for the full
 * investigation. dompdf has no shaping engine at all (confirmed: no GSUB
 * ligature substitution, no GPOS mark positioning — it draws one glyph per
 * Unicode codepoint via a raw cmap lookup). The old `reorderBengaliMatras()`
 * regex hack (still used as a fallback, see below) could only ever fix
 * pre-base vowel sign ordering; it could never form conjunct-consonant
 * ligatures (উদ্দিন, স্বাস্থ্য, মনিরুজ্জামান, ...) — extremely common in
 * Bengali — which is what actually made text look "ভাঙ্গা ভাঙ্গা" (broken/
 * fragmented) even after the matra-order fix shipped.
 *
 * This shells out to `resources/bengali-shaper/shape.mjs` (Node.js +
 * harfbuzzjs, a WASM build of the real HarfBuzz library — the same engine
 * Chrome/Android use) which shapes text into actual glyph outlines and
 * returns an SVG per field. dompdf embeds inline SVG data URIs natively and
 * at full vector quality (confirmed directly) — no rasterization step.
 *
 * All shaping jobs for one PDF render are batched into a SINGLE Node
 * process invocation (~100-400ms total, mostly WASM init) rather than one
 * per field, since spawning Node per-field would be far too slow for a
 * waybill with many orders × many Bengali fields.
 *
 * **Never allowed to break PDF generation**: if Node/the script is
 * unavailable, times out, or a specific job fails, that job is simply
 * absent from the returned array — callers MUST keep the old
 * `reorderBengaliMatras()`-based plain-text rendering as a fallback for any
 * field this returns nothing for.
 */
class BengaliShapingService
{
    private const PX_PER_MM = 1 / 0.2645833; // 96dpi CSS px <-> mm, same constant used elsewhere for image sizing

    public static function mmToPx(float $mm): float
    {
        return $mm * self::PX_PER_MM;
    }

    /**
     * @param  array<string, array{text: string, fontPath: string, latinFontPath?: string, fontSizePx: float, maxWidthPx?: float|null, color?: string}>  $jobs
     *         Keyed by an arbitrary caller-chosen id.
     * @return array<string, array{dataUri: string, widthMm: float, heightMm: float}>
     *         Only successful jobs are present — missing keys mean "fall back to plain text".
     */
    public function shapeBatch(array $jobs): array
    {
        if (empty($jobs)) {
            return [];
        }

        $scriptPath = resource_path('bengali-shaper/shape.mjs');
        if (! is_file($scriptPath)) {
            Log::warning('BengaliShapingService: shape.mjs not found, skipping shaping for this render.');
            return [];
        }

        $payload = [
            'jobs' => collect($jobs)->map(function (array $job, string $id) {
                return [
                    'id' => $id,
                    'text' => $job['text'],
                    'fontPath' => $job['fontPath'],
                    // NotoSansBengali has no Latin glyphs at all (confirmed —
                    // every ASCII letter is .notdef in its cmap), so mixed
                    // Bengali+English fields (very common: thana/district
                    // names are stored in English) need a second font for
                    // the non-Bengali runs. Defaults to dompdf's own bundled
                    // DejaVu Sans if the caller doesn't specify one.
                    'latinFontPath' => $job['latinFontPath'] ?? base_path('vendor/dompdf/dompdf/lib/fonts/DejaVuSans.ttf'),
                    'fontSizePx' => $job['fontSizePx'],
                    'maxWidthPx' => $job['maxWidthPx'] ?? 0,
                    'color' => $job['color'] ?? '#101418',
                ];
            })->values()->all(),
        ];

        try {
            $process = new Process(['node', $scriptPath]);
            $process->setInput(json_encode($payload, JSON_UNESCAPED_UNICODE));
            $process->setTimeout(15);
            $process->run();

            if (! $process->isSuccessful()) {
                Log::warning('BengaliShapingService: shape.mjs exited non-zero.', [
                    'error' => $process->getErrorOutput(),
                ]);
                return [];
            }

            $decoded = json_decode($process->getOutput(), true);
            if (! is_array($decoded) || ! isset($decoded['results'])) {
                Log::warning('BengaliShapingService: unexpected shape.mjs output.', ['output' => $process->getOutput()]);
                return [];
            }
        } catch (\Throwable $e) {
            Log::warning('BengaliShapingService: shaping batch failed, falling back to plain text.', [
                'error' => $e->getMessage(),
            ]);
            return [];
        }

        $out = [];
        foreach ($decoded['results'] as $result) {
            if (empty($result['success']) || empty($result['id']) || empty($result['svg'])) {
                continue;
            }
            $widthPx = (float) ($result['widthPx'] ?? 0);
            $heightPx = (float) ($result['heightPx'] ?? 0);
            if ($widthPx <= 0 || $heightPx <= 0) {
                continue;
            }
            $out[$result['id']] = [
                'dataUri' => 'data:image/svg+xml;base64,' . base64_encode($result['svg']),
                'widthMm' => $widthPx / self::PX_PER_MM,
                'heightMm' => $heightPx / self::PX_PER_MM,
            ];
        }

        return $out;
    }
}
