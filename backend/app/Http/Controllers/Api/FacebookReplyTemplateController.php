<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FacebookReplyTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Per-seller quick-reply templates for the Leads inbox — §6 item 11 in
 * facebook_integration_context.md.
 */
class FacebookReplyTemplateController extends Controller
{
    public function index(): JsonResponse
    {
        $templates = FacebookReplyTemplate::where('user_id', auth()->id())
            ->orderBy('created_at')
            ->get(['id', 'title', 'message']);

        return response()->json(['success' => true, 'data' => $templates]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:100'],
            'message' => ['required', 'string', 'max:2000'],
        ]);

        $template = FacebookReplyTemplate::create([
            'user_id' => auth()->id(),
            'title' => $data['title'],
            'message' => $data['message'],
        ]);

        return response()->json(['success' => true, 'data' => $template], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $template = FacebookReplyTemplate::where('user_id', auth()->id())->findOrFail($id);

        $data = $request->validate([
            'title' => ['required', 'string', 'max:100'],
            'message' => ['required', 'string', 'max:2000'],
        ]);

        $template->update($data);

        return response()->json(['success' => true, 'data' => $template]);
    }

    public function destroy(int $id): JsonResponse
    {
        FacebookReplyTemplate::where('user_id', auth()->id())->where('id', $id)->delete();

        return response()->json(['success' => true]);
    }
}
