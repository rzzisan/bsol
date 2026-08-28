<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AiProviderCredential;
use App\Models\PlatformAiSupportSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The admin-facing kill switch + daily cost cap for AiSupportAgentService.
 * support_ticketing_ai_context.md.
 */
class PlatformAiSupportSettingController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json(['success' => true, 'data' => PlatformAiSupportSetting::current()]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'is_enabled' => ['required', 'boolean'],
            'provider' => ['required', 'in:'.implode(',', AiProviderCredential::PROVIDERS)],
            'model' => ['required', 'string', 'max:100'],
            'effort' => ['required', 'in:low,medium,high,xhigh,max'],
            'max_ai_replies_per_day' => ['nullable', 'integer', 'min:1'],
            'system_prompt_extra' => ['nullable', 'string', 'max:4000'],
        ]);

        $settings = PlatformAiSupportSetting::current();
        $settings->update($data + ['updated_by' => auth()->id()]);

        return response()->json(['success' => true, 'data' => $settings->fresh()]);
    }
}
