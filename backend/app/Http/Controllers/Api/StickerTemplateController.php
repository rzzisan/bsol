<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StickerCourierTemplate;
use App\Models\StickerSetting;
use App\Services\StickerPreviewService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Sticker Template feature (Settings → Sticker Templates) — Pattern B
 * (owner-only, staff_team_role_context.md §3.3): which label design prints
 * by default, and optionally per courier. See config/sticker_templates.php
 * for the catalog and WaybillPdfService for how a template gets resolved
 * and rendered. courier_waybill_context.md §6 has the full writeup.
 */
class StickerTemplateController extends Controller
{
    /** The fixed catalog of selectable designs — static, not seller-editable. */
    public function catalog(StickerPreviewService $previews): JsonResponse
    {
        $catalog = collect(config('sticker_templates', []))->map(function ($tpl, $key) use ($previews) {
            return [
                'key' => $key,
                'label_bn' => $tpl['label_bn'],
                'label_en' => $tpl['label_en'],
                'size_label' => $tpl['sizeLabel'],
                'preview_url' => $previews->previewUrl($key),
            ];
        })->values();

        return response()->json(['success' => true, 'data' => $catalog]);
    }

    public function show(): JsonResponse
    {
        $ownerId = auth()->user()->shopOwnerId();
        $defaultKey = StickerSetting::where('user_id', $ownerId)->value('default_template_key') ?? 'classic';
        $overrides = StickerCourierTemplate::where('user_id', $ownerId)
            ->get(['courier_name', 'template_key'])
            ->map(fn ($row) => ['courier' => $row->courier_name, 'template_key' => $row->template_key])
            ->values();

        return response()->json([
            'success' => true,
            'data' => [
                'default_template_key' => $defaultKey,
                'courier_overrides' => $overrides,
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validKeys = array_keys(config('sticker_templates', []));

        $data = $request->validate([
            'default_template_key' => ['required', 'string', 'in:' . implode(',', $validKeys)],
            'courier_overrides' => ['nullable', 'array'],
            'courier_overrides.*.courier' => ['required', 'string', 'max:50'],
            'courier_overrides.*.template_key' => ['required', 'string', 'in:' . implode(',', $validKeys)],
        ]);

        $ownerId = auth()->user()->shopOwnerId();

        StickerSetting::updateOrCreate(
            ['user_id' => $ownerId],
            ['default_template_key' => $data['default_template_key']]
        );

        // Replace the whole override set — simpler and safer than diffing,
        // and the UI always sends the complete current set.
        StickerCourierTemplate::where('user_id', $ownerId)->delete();
        foreach ($data['courier_overrides'] ?? [] as $override) {
            StickerCourierTemplate::create([
                'user_id' => $ownerId,
                'courier_name' => strtolower($override['courier']),
                'template_key' => $override['template_key'],
            ]);
        }

        return response()->json(['success' => true]);
    }
}
