<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\SupportTicket;
use App\Models\SupportTicketMessage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Admin-side ticket inbox — shared across the whole admin team, same
 * flat-role pattern as AdminSupportController. support_ticketing_ai_context.md.
 */
class AdminSupportTicketController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = SupportTicket::with(['user:id,name,email,mobile', 'assignedAdmin:id,name']);

        if ($request->filled('status') && $request->string('status') !== 'all') {
            $query->where('status', $request->string('status'));
        }
        if ($request->filled('category') && $request->string('category') !== 'all') {
            $query->where('category', $request->string('category'));
        }
        if ($request->filled('priority') && $request->string('priority') !== 'all') {
            $query->where('priority', $request->string('priority'));
        }
        if ($request->boolean('escalated_only')) {
            $query->where('escalated', true);
        }
        if ($request->filled('q')) {
            $search = trim((string) $request->string('q'));
            $query->where(function ($sub) use ($search) {
                $sub->where('ticket_number', 'ilike', "%{$search}%")
                    ->orWhere('subject', 'ilike', "%{$search}%")
                    ->orWhereHas('user', function ($u) use ($search) {
                        $u->where('name', 'ilike', "%{$search}%")->orWhere('email', 'ilike', "%{$search}%");
                    });
            });
        }

        $query->orderByRaw('last_message_at IS NULL, last_message_at DESC');

        $tickets = $query->paginate(min((int) ($request->per_page ?? 30), 100));

        return response()->json([
            'success' => true,
            'data' => $tickets->items(),
            'meta' => ['total' => $tickets->total(), 'current_page' => $tickets->currentPage(), 'last_page' => $tickets->lastPage()],
        ]);
    }

    public function messages(Request $request, SupportTicket $ticket): JsonResponse
    {
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
        $data = $request->validate(['message' => ['required', 'string', 'max:4000']]);

        $message = SupportTicketMessage::create([
            'ticket_id' => $ticket->id,
            'sender_type' => 'admin',
            'sender_id' => auth()->id(),
            'message' => trim($data['message']),
        ]);

        $ticket->update([
            'status' => $ticket->status === 'closed' ? 'open' : $ticket->status,
            'last_message_at' => $message->created_at,
            'last_message_preview' => Str::limit(trim($data['message']), 120),
            'last_message_sender_type' => 'admin',
            'user_unread_count' => $ticket->user_unread_count + 1,
            'admin_unread_count' => 0,
            // Replying is an implicit take-over too, mirrors the explicit
            // "Take over" action below — either way the AI stops here.
            'assigned_admin_id' => $ticket->assigned_admin_id ?? auth()->id(),
            'ai_handled' => false,
        ]);

        return response()->json(['success' => true, 'data' => $message->load('sender:id,name')]);
    }

    public function takeOver(SupportTicket $ticket): JsonResponse
    {
        $ticket->update(['assigned_admin_id' => auth()->id(), 'ai_handled' => false]);

        return response()->json(['success' => true, 'data' => $ticket->fresh()]);
    }

    public function markRead(SupportTicket $ticket): JsonResponse
    {
        SupportTicketMessage::where('ticket_id', $ticket->id)
            ->where('sender_type', 'user')
            ->where('is_read', false)
            ->update(['is_read' => true]);

        $ticket->update(['admin_unread_count' => 0]);

        return response()->json(['success' => true]);
    }

    public function updateStatus(Request $request, SupportTicket $ticket): JsonResponse
    {
        $data = $request->validate(['status' => ['required', 'in:'.implode(',', SupportTicket::STATUSES)]]);

        $ticket->update([
            'status' => $data['status'],
            'resolved_by' => $data['status'] === 'resolved' ? auth()->id() : $ticket->resolved_by,
            'resolved_at' => $data['status'] === 'resolved' ? now() : $ticket->resolved_at,
            'closed_by' => $data['status'] === 'closed' ? auth()->id() : null,
            'closed_at' => $data['status'] === 'closed' ? now() : null,
        ]);

        return response()->json(['success' => true, 'data' => $ticket]);
    }

    public function updatePriority(Request $request, SupportTicket $ticket): JsonResponse
    {
        $data = $request->validate(['priority' => ['required', 'in:'.implode(',', SupportTicket::PRIORITIES)]]);

        $ticket->update(['priority' => $data['priority']]);

        return response()->json(['success' => true, 'data' => $ticket]);
    }

    public function unreadCount(): JsonResponse
    {
        return response()->json(['success' => true, 'count' => (int) SupportTicket::sum('admin_unread_count')]);
    }
}
