<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\LandingTemplate;
use App\Models\LandingTemplateAccessRule;
use App\Models\SubscriptionPackage;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class LandingTemplateController extends Controller
{
    public function index(): JsonResponse
    {
        $templates = LandingTemplate::query()
            ->with('accessRules:id,template_id,package_id,is_enabled')
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $templates,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:120', 'alpha_dash', 'unique:landing_templates,code'],
            'name_bn' => ['required', 'string', 'max:180'],
            'name_en' => ['required', 'string', 'max:180'],
            'description_bn' => ['nullable', 'string'],
            'description_en' => ['nullable', 'string'],
            'thumbnail_url' => ['nullable', 'string', 'max:2048'],
            'category' => ['nullable', 'string', 'max:60'],
            'layout_profile' => ['nullable', 'string', 'max:120'],
            'editor_mode' => ['sometimes', Rule::in(['flex', 'locked'])],
            'default_schema_json' => ['required', 'array'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        $template = LandingTemplate::create([
            ...$validated,
            'category' => $validated['category'] ?? 'general',
            'editor_mode' => $validated['editor_mode'] ?? 'flex',
            'is_active' => $validated['is_active'] ?? true,
            'sort_order' => $validated['sort_order'] ?? 0,
            'created_by' => auth()->id(),
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Landing template created successfully.',
            'data' => $template,
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $template = LandingTemplate::findOrFail($id);

        $validated = $request->validate([
            'name_bn' => ['sometimes', 'string', 'max:180'],
            'name_en' => ['sometimes', 'string', 'max:180'],
            'description_bn' => ['nullable', 'string'],
            'description_en' => ['nullable', 'string'],
            'thumbnail_url' => ['nullable', 'string', 'max:2048'],
            'category' => ['sometimes', 'string', 'max:60'],
            'layout_profile' => ['nullable', 'string', 'max:120'],
            'editor_mode' => ['sometimes', Rule::in(['flex', 'locked'])],
            'default_schema_json' => ['sometimes', 'array'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0'],
        ]);

        $template->update($validated);

        return response()->json([
            'status' => 'success',
            'message' => 'Landing template updated successfully.',
            'data' => $template->fresh(),
        ]);
    }

    public function toggle(Request $request, int $id): JsonResponse
    {
        $validated = $request->validate([
            'is_active' => ['required', 'boolean'],
        ]);

        $template = LandingTemplate::findOrFail($id);
        $template->update(['is_active' => $validated['is_active']]);

        return response()->json([
            'status' => 'success',
            'message' => 'Template status updated.',
            'data' => $template->fresh(),
        ]);
    }

    public function reorder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['required', 'integer', 'exists:landing_templates,id'],
            'items.*.sort_order' => ['required', 'integer', 'min:0'],
        ]);

        DB::transaction(function () use ($validated) {
            foreach ($validated['items'] as $item) {
                LandingTemplate::where('id', $item['id'])->update(['sort_order' => $item['sort_order']]);
            }
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Template order updated.',
        ]);
    }

    public function accessRules(): JsonResponse
    {
        $templates = LandingTemplate::query()
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get(['id', 'code', 'name_bn', 'name_en', 'is_active', 'sort_order']);

        $rules = LandingTemplateAccessRule::query()
            ->with([
                'template:id,code,name_bn,name_en,is_active',
                'package:id,name,slug,is_active',
            ])
            ->orderBy('template_id')
            ->orderBy('package_id')
            ->get();

        $packages = SubscriptionPackage::query()
            ->orderBy('id')
            ->get(['id', 'name', 'slug', 'is_active']);

        return response()->json([
            'status' => 'success',
            'data' => [
                'templates' => $templates,
                'rules' => $rules,
                'packages' => $packages,
            ],
        ]);
    }

    public function updateAccessRules(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'rules' => ['required', 'array'],
            'rules.*.template_id' => ['required', 'integer', 'exists:landing_templates,id'],
            'rules.*.package_id' => ['nullable', 'integer', 'exists:subscription_packages,id'],
            'rules.*.is_enabled' => ['required', 'boolean'],
        ]);

        DB::transaction(function () use ($validated) {
            foreach ($validated['rules'] as $rule) {
                $record = LandingTemplateAccessRule::query()
                    ->where('template_id', $rule['template_id'])
                    ->where('package_id', $rule['package_id'] ?? null)
                    ->first();

                if ($record) {
                    $record->update(['is_enabled' => $rule['is_enabled']]);
                    continue;
                }

                LandingTemplateAccessRule::create([
                    'template_id' => $rule['template_id'],
                    'package_id' => $rule['package_id'] ?? null,
                    'is_enabled' => $rule['is_enabled'],
                    'created_by' => auth()->id(),
                ]);
            }
        });

        return response()->json([
            'status' => 'success',
            'message' => 'Access rules updated successfully.',
        ]);
    }

    /**
     * @return array<int>
     */
    private function adminScopeUserIds(): array
    {
        if (auth()->user()->isAdmin()) {
            return User::where('role', 'admin')->pluck('id')->toArray();
        }

        return [auth()->id()];
    }
}
