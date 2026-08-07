<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\SupportConversation;
use App\Models\SupportMessage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Admin-side "SaaS Support" inbox — shared across the whole admin team
 * (CONTEXT.md §25: admin-shared resource, not per-admin scoped). Any admin
 * can see and reply to any seller's conversation, matching the flat
 * user/admin role model (no separate super-admin tier — see
 * SAAS_MODULE_CONTEXT.md §17.6).
 */
class AdminSupportController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = SupportConversation::with('user:id,name,email,mobile');

        if ($request->filled('status') && $request->string('status') !== 'all') {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('q')) {
            $search = trim((string) $request->string('q'));
            $query->whereHas('user', function ($sub) use ($search) {
                $sub->where('name', 'ilike', "%{$search}%")
                    ->orWhere('email', 'ilike', "%{$search}%")
                    ->orWhere('mobile', 'ilike', "%{$search}%");
            });
        }

        $query->orderByRaw('last_message_at IS NULL, last_message_at DESC');

        $perPage = min((int) ($request->per_page ?? 30), 100);
        $conversations = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $conversations->items(),
            'meta' => ['total' => $conversations->total(), 'current_page' => $conversations->currentPage(), 'last_page' => $conversations->lastPage()],
        ]);
    }

    public function messages(Request $request, SupportConversation $conversation): JsonResponse
    {
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

    public function send(Request $request, SupportConversation $conversation): JsonResponse
    {
        $data = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
        ]);

        $message = SupportMessage::create([
            'conversation_id' => $conversation->id,
            'sender_type' => 'admin',
            'sender_id' => auth()->id(),
            'message' => trim($data['message']),
        ]);

        $conversation->update([
            'status' => 'open',
            'last_message_at' => $message->created_at,
            'last_message_preview' => Str::limit(trim($data['message']), 120),
            'last_message_sender_type' => 'admin',
            'user_unread_count' => $conversation->user_unread_count + 1,
            'admin_unread_count' => 0,
        ]);

        return response()->json(['success' => true, 'data' => $message]);
    }

    public function markRead(SupportConversation $conversation): JsonResponse
    {
        SupportMessage::where('conversation_id', $conversation->id)
            ->where('sender_type', 'user')
            ->where('is_read', false)
            ->update(['is_read' => true]);

        $conversation->update(['admin_unread_count' => 0]);

        return response()->json(['success' => true]);
    }

    public function updateStatus(Request $request, SupportConversation $conversation): JsonResponse
    {
        $data = $request->validate([
            'status' => ['required', 'in:open,closed'],
        ]);

        $conversation->update([
            'status' => $data['status'],
            'closed_by' => $data['status'] === 'closed' ? auth()->id() : null,
            'closed_at' => $data['status'] === 'closed' ? now() : null,
        ]);

        return response()->json(['success' => true, 'data' => $conversation]);
    }

    public function unreadCount(): JsonResponse
    {
        $count = (int) SupportConversation::sum('admin_unread_count');

        return response()->json(['success' => true, 'count' => $count]);
    }
}
