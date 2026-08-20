<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WhatsappBusinessConnection;
use App\Models\WhatsappMessage;
use App\Services\Whatsapp\WhatsappCloudApiClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Mirrors FacebookLeadController's shape — see that class. */
class WhatsappMessageController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = WhatsappMessage::whereIn('user_id', auth()->user()->shopUserIds());

        if ($request->filled('wa_id')) {
            $query->where('wa_id', $request->string('wa_id'));
        }
        if ($request->boolean('unread_only')) {
            $query->where('is_read', false)->where('direction', 'inbound');
        }
        if ($request->filled('q')) {
            $search = trim((string) $request->string('q'));
            $query->where(function ($sub) use ($search) {
                $sub->where('body', 'ilike', "%{$search}%")
                    ->orWhere('contact_name', 'ilike', "%{$search}%")
                    ->orWhere('wa_id', 'ilike', "%{$search}%");
            });
        }

        $query->orderByDesc('id');

        $perPage = min((int) ($request->per_page ?? 20), 100);
        $messages = $query->with('customer:id,name,phone')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $messages->items(),
            'meta' => ['total' => $messages->total(), 'current_page' => $messages->currentPage(), 'last_page' => $messages->lastPage()],
        ]);
    }

    /**
     * One conversation thread (all messages for a wa_id), newest last —
     * the inbox reply panel's main view. Marks the thread's inbound
     * messages read as a side effect of opening it.
     */
    public function thread(Request $request, string $waId): JsonResponse
    {
        $userIds = auth()->user()->shopUserIds();

        WhatsappMessage::whereIn('user_id', $userIds)
            ->where('wa_id', $waId)
            ->where('direction', 'inbound')
            ->where('is_read', false)
            ->update(['is_read' => true]);

        $messages = WhatsappMessage::whereIn('user_id', $userIds)
            ->where('wa_id', $waId)
            ->orderBy('id')
            ->get();

        return response()->json(['success' => true, 'data' => $messages]);
    }

    public function unreadCount(): JsonResponse
    {
        $count = WhatsappMessage::whereIn('user_id', auth()->user()->shopUserIds())
            ->where('direction', 'inbound')
            ->where('is_read', false)
            ->count();

        return response()->json(['success' => true, 'count' => $count]);
    }

    public function markRead(int $id): JsonResponse
    {
        $message = WhatsappMessage::whereIn('user_id', auth()->user()->shopUserIds())->findOrFail($id);
        $message->update(['is_read' => true]);

        return response()->json(['success' => true, 'data' => $message]);
    }

    /**
     * Free-form text reply to a wa_id — only accepted by Meta within the
     * 24h window since that contact's last inbound message; a window-closed
     * rejection surfaces as a normal 422, same as
     * FacebookLeadController::reply()'s Messenger-window handling.
     */
    public function reply(Request $request, string $waId, WhatsappCloudApiClient $client): JsonResponse
    {
        $data = $request->validate(['message' => ['required', 'string', 'max:4096']]);

        $connection = WhatsappBusinessConnection::where('user_id', auth()->user()->shopOwnerId())->first();
        if (! $connection?->isConnected()) {
            return response()->json(['success' => false, 'message' => 'WhatsApp is not connected.'], 422);
        }

        $result = $client->sendTextMessage($connection->phone_number_id, $connection->access_token, $waId, $data['message']);

        if (! $result) {
            return response()->json([
                'success' => false,
                'message' => 'WhatsApp rejected the reply — the 24-hour messaging window for this contact may have closed.',
            ], 422);
        }

        $message = WhatsappMessage::create([
            'user_id' => $connection->user_id,
            'whatsapp_business_connection_id' => $connection->id,
            'direction' => 'outbound',
            'wa_message_id' => $result['wa_message_id'],
            'wa_id' => $waId,
            'message_type' => 'text',
            'body' => $data['message'],
            'status' => 'sent',
            'sent_at' => now(),
        ]);

        return response()->json(['success' => true, 'data' => $message]);
    }
}
