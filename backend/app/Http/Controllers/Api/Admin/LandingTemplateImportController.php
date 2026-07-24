<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\LandingTemplate;
use App\Services\CartFlowsImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class LandingTemplateImportController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => LandingTemplate::query()
                ->orderBy('sort_order')
                ->orderByDesc('id')
                ->get(['id', 'code', 'name_bn', 'name_en', 'is_active', 'sort_order', 'created_at']),
        ]);
    }

    public function preview(Request $request, CartFlowsImportService $importService): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'max:5120'],
        ]);

        $file = $request->file('file');
        if (!in_array(strtolower($file->getClientOriginalExtension()), ['json', 'txt'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'শুধুমাত্র .json ফাইল আপলোড করা যাবে।',
            ], 422);
        }

        $tempCode = 'preview-' . Str::random(8);

        try {
            $parsed = $importService->parse((string) file_get_contents($file->getRealPath()), $tempCode);
        } catch (\RuntimeException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        return response()->json([
            'success' => true,
            'data' => $parsed,
        ]);
    }

    public function store(Request $request, CartFlowsImportService $importService): JsonResponse
    {
        $validated = $request->validate([
            'file' => ['required', 'file', 'max:5120'],
            'title' => ['nullable', 'string', 'max:180'],
            'code' => ['nullable', 'string', 'max:80'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $file = $request->file('file');
        $code = Str::slug($validated['code'] ?? Str::of($file->getClientOriginalName())->beforeLast('.')->toString());
        if ($code === '') {
            $code = 'imported-' . Str::random(6);
        }

        try {
            $parsed = $importService->parse((string) file_get_contents($file->getRealPath()), $code);
        } catch (\RuntimeException $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }

        $title = $validated['title'] ?? $parsed['title'];

        $template = LandingTemplate::updateOrCreate(
            ['code' => $code],
            [
                'created_by' => auth()->id(),
                'name_bn' => $title,
                'name_en' => $title,
                'default_content' => [
                    'hero' => $parsed['hero'],
                    'html_sections' => $parsed['html'] ? [['title' => 'Imported Content', 'html' => $parsed['html']]] : [],
                    'features' => [],
                    'reviews' => [],
                    'faq' => [],
                    'contact' => ['phone' => null],
                    'shipping' => ['inside_dhaka' => 80, 'outside_dhaka' => 120],
                    'layout_order' => ['html_sections', 'carousel_images', 'features', 'faq', 'reviews', 'products'],
                ],
                'schema' => [
                    'imported_from' => 'cartflows',
                    'original_filename' => $file->getClientOriginalName(),
                ],
                'is_active' => $validated['is_active'] ?? true,
            ]
        );

        return response()->json([
            'success' => true,
            'message' => 'টেমপ্লেট তৈরি হয়েছে।',
            'data' => $template,
            'warnings' => $parsed['warnings'],
        ], 201);
    }

    public function toggleActive(int $id): JsonResponse
    {
        $template = LandingTemplate::findOrFail($id);
        $template->update(['is_active' => !$template->is_active]);

        return response()->json([
            'success' => true,
            'data' => $template,
        ]);
    }
}
