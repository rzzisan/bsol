<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\GenerateAiSupportReplyJob;
use App\Models\SupportTicket;
use App\Models\SupportTicketMessage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Seller-facing ticketing — distinct from the persistent live-chat thread
 * (Api\SupportController): each ticket is its own subject/category/priority
 * case with a lifecycle (open/pending/resolved/closed), alongside chat, not
 * replacing it. support_ticketing_ai_context.md.
 */
class SupportTicketController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = SupportTicket::where('user_id', auth()->id());

        if ($request->filled('status') && $request->string('status') !== 'all') {
            $query->where('status', $request->string('status'));
        }

        $tickets = (clone $query)->orderByDesc('id')->paginate(min((int) ($request->per_page ?? 20), 100));

        return response()->json([
            'success' => true,
            'data' => $tickets->items(),
            'pagination' => [
                'total' => $tickets->total(),
                'per_page' => $tickets->perPage(),
                'current_page' => $tickets->currentPage(),
                'last_page' => $tickets->lastPage(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'subject' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string', 'in:'.implode(',', SupportTicket::CATEGORIES)],
            'message' => ['required', 'string', 'max:4000'],
        ]);

        $ticket = SupportTicket::create([
            'ticket_number' => 'PENDING', // replaced immediately below now that we have an id
            'user_id' => auth()->id(),
            'subject' => trim($data['subject']),
            'category' => $data['category'],
        ]);
        $ticket->update(['ticket_number' => 'TKT-'.str_pad((string) $ticket->id, 6, '0', STR_PAD_LEFT)]);

        $message = SupportTicketMessage::create([
            'ticket_id' => $ticket->id,
            'sender_type' => 'user',
            'sender_id' => auth()->id(),
            'message' => trim($data['message']),
        ]);

        $ticket->update([
            'last_message_at' => $message->created_at,
            'last_message_preview' => Str::limit(trim($data['message']), 120),
            'last_message_sender_type' => 'user',
            'admin_unread_count' => 1,
        ]);

        GenerateAiSupportReplyJob::dispatch('ticket', $ticket->id);

        return response()->json(['success' => true, 'data' => $ticket->fresh()]);
    }

    public function show(SupportTicket $ticket): JsonResponse
    {
        $this->authorizeOwn($ticket);

        return response()->json(['success' => true, 'data' => $ticket]);
    }

    public function messages(Request $request, SupportTicket $ticket): JsonResponse
    {
        $this->authorizeOwn($ticket);

        $query = SupportTicketMessage::where('ticket_id', $ticket->id)->with('sender:id,name');

        if ($request->filled('after_id')) {
            $messages = $query->where('id', '>', (int) $request->after_id)->orderBy('id', 'asc')->limit(200)->get();

            return response()->json(['success' => true, 'data' => $messages, 'has_more' => false]);
        }

        if ($request->filled('before_id')) {
            $messages = $query->where('id', '<', (int) $request->before_id)->orderBy('id', 'desc')->limit(50)->get()->reverse()->values();

            return response()->json(['success' => true, 'data' => $messages, 'has_more' => $messages->count() === 50]);
        }

        $messages = $query->orderBy('id', 'desc')->limit(50)->get()->reverse()->values();

        return response()->json(['success' => true, 'data' => $messages, 'has_more' => $messages->count() === 50]);
    }

    public function send(Request $request, SupportTicket $ticket): JsonResponse
    {
        $this->authorizeOwn($ticket);

        $data = $request->validate(['message' => ['required', 'string', 'max:4000']]);

        $message = SupportTicketMessage::create([
            'ticket_id' => $ticket->id,
            'sender_type' => 'user',
            'sender_id' => auth()->id(),
            'message' => trim($data['message']),
        ]);

        $ticket->update([
            'status' => $ticket->status === 'closed' ? 'open' : $ticket->status,
            'last_message_at' => $message->created_at,
            'last_message_preview' => Str::limit(trim($data['message']), 120),
            'last_message_sender_type' => 'user',
            'admin_unread_count' => $ticket->admin_unread_count + 1,
        ]);

        if ($ticket->assigned_admin_id === null) {
            GenerateAiSupportReplyJob::dispatch('ticket', $ticket->id);
        }

        return response()->json(['success' => true, 'data' => $message]);
    }

    public function markRead(SupportTicket $ticket): JsonResponse
    {
        $this->authorizeOwn($ticket);

        SupportTicketMessage::where('ticket_id', $ticket->id)
            ->whereIn('sender_type', ['admin', 'ai'])
            ->where('is_read', false)
            ->update(['is_read' => true]);

        $ticket->update(['user_unread_count' => 0]);

        return response()->json(['success' => true]);
    }

    public function unreadCount(): JsonResponse
    {
        $count = (int) SupportTicket::where('user_id', auth()->id())->sum('user_unread_count');

        return response()->json(['success' => true, 'count' => $count]);
    }

    private function authorizeOwn(SupportTicket $ticket): void
    {
        abort_unless($ticket->user_id === auth()->id(), 403);
    }
}
