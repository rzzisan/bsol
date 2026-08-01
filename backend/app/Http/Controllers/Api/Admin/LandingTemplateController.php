<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\LandingTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class LandingTemplateController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => LandingTemplate::query()
                ->with(['sourceLandingPage:id,title,slug', 'creator:id,name'])
                ->orderBy('sort_order')
                ->orderByDesc('id')
                ->get(),
        ]);
    }

    public function show(int $id): JsonResponse
    {
        $template = LandingTemplate::query()
            ->with(['sourceLandingPage:id,title,slug'])
            ->findOrFail($id);

        return response()->json(['success' => true, 'data' => $template]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validatePayload($request);

        $code = $this->generateUniqueCode($validated['name_en'] ?? $validated['name_bn']);

        $template = LandingTemplate::create([
            'created_by' => auth()->id(),
            'source_landing_page_id' => $validated['source_landing_page_id'] ?? null,
            'code' => $code,
            'name_bn' => $validated['name_bn'],
            'name_en' => $validated['name_en'] ?? $validated['name_bn'],
            'description' => $validated['description'] ?? null,
            'preview_image' => $validated['preview_image'] ?? null,
            'default_content' => $validated['default_content'],
            'theme_settings' => $validated['theme_settings'] ?? null,
            'is_active' => $validated['is_active'] ?? true,
        ]);

        return response()->json(['success' => true, 'data' => $template], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $template = LandingTemplate::findOrFail($id);
        $validated = $this->validatePayload($request);

        $template->update([
            'name_bn' => $validated['name_bn'],
            'name_en' => $validated['name_en'] ?? $validated['name_bn'],
            'description' => $validated['description'] ?? null,
            'preview_image' => $validated['preview_image'] ?? $template->preview_image,
            'default_content' => $validated['default_content'],
            'theme_settings' => $validated['theme_settings'] ?? null,
            'is_active' => $validated['is_active'] ?? $template->is_active,
        ]);

        return response()->json(['success' => true, 'data' => $template]);
    }

    public function toggleActive(int $id): JsonResponse
    {
        $template = LandingTemplate::findOrFail($id);
        $template->update(['is_active' => !$template->is_active]);

        return response()->json(['success' => true, 'data' => $template]);
    }

    public function destroy(int $id): JsonResponse
    {
        LandingTemplate::findOrFail($id)->delete();

        return response()->json(['success' => true, 'message' => 'Template deleted.']);
    }

    public function uploadPreviewImage(Request $request): JsonResponse
    {
        $request->validate([
            'image' => ['required', 'file', 'image', 'max:4096'],
        ]);

        $path = $request->file('image')->store('landing-templates', 'public');

        return response()->json([
            'success' => true,
            'data' => ['url' => Storage::disk('public')->url($path)],
        ]);
    }

    private function validatePayload(Request $request): array
    {
        return $request->validate([
            'name_bn' => ['required', 'string', 'max:180'],
            'name_en' => ['nullable', 'string', 'max:180'],
            'description' => ['nullable', 'string', 'max:2000'],
            'preview_image' => ['nullable', 'string', 'max:2048'],
            'default_content' => ['required', 'array'],
            'theme_settings' => ['nullable', 'array'],
            'is_active' => ['sometimes', 'boolean'],
            'source_landing_page_id' => ['nullable', 'integer', 'exists:landing_pages,id'],
        ]);
    }

    private function generateUniqueCode(string $name): string
    {
        $base = Str::slug($name) ?: 'template';
        $code = $base;
        $suffix = 1;

        while (LandingTemplate::withTrashed()->where('code', $code)->exists()) {
            $code = $base . '-' . (++$suffix);
        }

        return $code;
    }
}
