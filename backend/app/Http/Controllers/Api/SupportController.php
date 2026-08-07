<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SupportConversation;
use App\Models\SupportMessage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Seller-facing "SaaS Support" chat — one persistent thread per seller,
 * shared inbox on the admin side (see Api\Admin\AdminSupportController).
 * No queue worker in this deployment (SAAS_MODULE_CONTEXT.md §17.0 #12),
 * so delivery is plain sync writes + frontend polling — no jobs/broadcast.
 */
class SupportController extends Controller
{
    private function conversationFor(int $userId): SupportConversation
    {
        return SupportConversation::firstOrCreate(['user_id' => $userId]);
    }

    public function conversation(): JsonResponse
    {
        $conversation = $this->conversationFor(auth()->id());

        return response()->json(['success' => true, 'data' => $conversation]);
    }

    public function messages(Request $request): JsonResponse
    {
        $conversation = $this->conversationFor(auth()->id());

        $query = SupportMessage::where('conversation_id', $conversation->id);

        if ($request->filled('after_id')) {
            $messages = $query->where('id', '>', (int) $request->after_id)
                ->orderBy('id', 'asc')->limit(200)->get();

            return response()->json(['success' => true, 'data' => $messages, 'has_more' => false]);
        }

        if ($request->filled('before_id')) {
            $messages = $query->where('id', '<', (int) $request->before_id)
                ->orderBy('id', 'desc')->limit(50)->get()->reverse()->values();

            return response()->json(['success' => true, 'data' => $messages, 'has_more' => $messages->count() === 50]);
        }

        $messages = $query->orderBy('id', 'desc')->limit(50)->get()->reverse()->values();

        return response()->json(['success' => true, 'data' => $messages, 'has_more' => $messages->count() === 50]);
    }

    public function send(Request $request): JsonResponse
    {
        $data = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
        ]);

        $conversation = $this->conversationFor(auth()->id());

        $message = SupportMessage::create([
            'conversation_id' => $conversation->id,
            'sender_type' => 'user',
            'sender_id' => auth()->id(),
            'message' => trim($data['message']),
        ]);

        $conversation->update([
            'status' => 'open',
            'last_message_at' => $message->created_at,
            'last_message_preview' => Str::limit(trim($data['message']), 120),
            'last_message_sender_type' => 'user',
            'admin_unread_count' => $conversation->admin_unread_count + 1,
        ]);

        return response()->json(['success' => true, 'data' => $message]);
    }

    public function markRead(): JsonResponse
    {
        $conversation = $this->conversationFor(auth()->id());

        SupportMessage::where('conversation_id', $conversation->id)
            ->where('sender_type', 'admin')
            ->where('is_read', false)
            ->update(['is_read' => true]);

        $conversation->update(['user_unread_count' => 0]);

        return response()->json(['success' => true]);
    }

    public function unreadCount(): JsonResponse
    {
        $conversation = SupportConversation::where('user_id', auth()->id())->first();

        return response()->json([
            'success' => true,
            'count' => $conversation?->user_unread_count ?? 0,
            // Only meaningful when the last message was from admin — lets the
            // minimized widget pop a "new message" toast with a preview.
            'preview' => $conversation?->last_message_sender_type === 'admin'
                ? $conversation->last_message_preview
                : null,
        ]);
    }
}
