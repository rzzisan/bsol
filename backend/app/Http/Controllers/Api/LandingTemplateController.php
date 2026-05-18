<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LandingTemplate;
use Illuminate\Http\JsonResponse;

class LandingTemplateController extends Controller
{
    public function index(): JsonResponse
    {
        $templates = LandingTemplate::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get([
                'id', 'code', 'name_bn', 'name_en', 'description',
                'preview_image', 'default_content', 'schema', 'sort_order',
            ]);

        return response()->json([
            'success' => true,
            'data' => $templates,
        ]);
    }

    public function show(int $id): JsonResponse
    {
        $template = LandingTemplate::query()
            ->where('is_active', true)
            ->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $template,
        ]);
    }
}
