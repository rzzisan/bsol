<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Transaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TransactionController extends Controller
{
    public function summary(Request $request): JsonResponse
    {
        $range = $request->string('range')->toString();

        [$from, $to] = match ($range) {
            'week' => [now()->startOfWeek()->toDateString(), now()->toDateString()],
            'month' => [now()->startOfMonth()->toDateString(), now()->toDateString()],
            default => [now()->toDateString(), now()->toDateString()],
        };

        if ($request->filled('from')) {
            $from = $request->string('from')->toString();
        }
        if ($request->filled('to')) {
            $to = $request->string('to')->toString();
        }

        $base = Transaction::query()
            ->where('user_id', auth()->id())
            ->whereDate('transaction_date', '>=', $from)
            ->whereDate('transaction_date', '<=', $to)
            ->where('status', Transaction::STATUS_CONFIRMED);

        $income = (float) (clone $base)->where('type', Transaction::TYPE_INCOME)->sum('amount');
        $expense = (float) (clone $base)->where('type', Transaction::TYPE_EXPENSE)->sum('amount');

        $topExpenseCategories = Transaction::query()
            ->where('user_id', auth()->id())
            ->whereDate('transaction_date', '>=', $from)
            ->whereDate('transaction_date', '<=', $to)
            ->where('status', Transaction::STATUS_CONFIRMED)
            ->where('type', Transaction::TYPE_EXPENSE)
            ->selectRaw('category, COALESCE(SUM(amount), 0) as total')
            ->groupBy('category')
            ->orderByDesc('total')
            ->limit(5)
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'range' => compact('from', 'to'),
                'income' => $income,
                'expense' => $expense,
                'profit' => $income - $expense,
                'top_expense_categories' => $topExpenseCategories,
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $query = Transaction::query()->where('user_id', auth()->id());

        if ($request->filled('type')) {
            $query->where('type', $request->string('type'));
        }
        if ($request->filled('category')) {
            $query->where('category', $request->string('category'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }
        if ($request->filled('from')) {
            $query->whereDate('transaction_date', '>=', $request->string('from'));
        }
        if ($request->filled('to')) {
            $query->whereDate('transaction_date', '<=', $request->string('to'));
        }
        if ($request->filled('search')) {
            $s = '%' . $request->string('search') . '%';
            $query->where(fn ($q) => $q
                ->where('note', 'ilike', $s)
                ->orWhere('category', 'ilike', $s));
        }

        $perPage = min((int) ($request->integer('per_page') ?: 20), 100);
        $rows = $query->latest('transaction_date')->latest('id')->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $rows->items(),
            'meta' => [
                'total' => $rows->total(),
                'current_page' => $rows->currentPage(),
                'last_page' => $rows->lastPage(),
                'per_page' => $rows->perPage(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => 'required|in:income,expense',
            'category' => 'required|string|max:60',
            'amount' => 'required|numeric|min:0.01',
            'note' => 'nullable|string|max:1000',
            'transaction_date' => 'nullable|date',
            'status' => 'nullable|in:pending,confirmed',
        ]);

        $txn = Transaction::create([
            'user_id' => auth()->id(),
            'type' => $data['type'],
            'status' => $data['status'] ?? Transaction::STATUS_CONFIRMED,
            'category' => $data['category'],
            'reference_type' => 'manual',
            'reference_id' => null,
            'amount' => (float) $data['amount'],
            'note' => $data['note'] ?? null,
            'transaction_date' => $data['transaction_date'] ?? now()->toDateString(),
            'is_auto' => false,
            'meta' => null,
        ]);

        return response()->json(['success' => true, 'data' => $txn], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $txn = Transaction::query()->where('user_id', auth()->id())->findOrFail($id);

        if ($txn->is_auto) {
            return response()->json([
                'success' => false,
                'message' => 'Auto-generated transactions cannot be edited manually.',
            ], 422);
        }

        $data = $request->validate([
            'type' => 'sometimes|required|in:income,expense',
            'category' => 'sometimes|required|string|max:60',
            'amount' => 'sometimes|required|numeric|min:0.01',
            'note' => 'nullable|string|max:1000',
            'transaction_date' => 'sometimes|required|date',
            'status' => 'sometimes|required|in:pending,confirmed',
        ]);

        $txn->update($data);

        return response()->json(['success' => true, 'data' => $txn->fresh()]);
    }

    public function destroy(int $id): JsonResponse
    {
        $txn = Transaction::query()->where('user_id', auth()->id())->findOrFail($id);

        if ($txn->is_auto) {
            return response()->json([
                'success' => false,
                'message' => 'Auto-generated transactions cannot be deleted manually.',
            ], 422);
        }

        $txn->delete();

        return response()->json(['success' => true, 'message' => 'Transaction deleted.']);
    }
}
