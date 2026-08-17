<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderPayment;
use App\Models\User;
use App\Services\AccountingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Manual payment collection log — cash/bank/bKash/etc taken directly by the
 * seller against an order, distinct from courier COD remittance. See
 * manual_payment_collection_context.md.
 */
class OrderPaymentController extends Controller
{
    public function __construct(
        private readonly AccountingService $accountingService,
    ) {}

    public function index(int $orderId): JsonResponse
    {
        $order = $this->findOrder($orderId);

        $payments = $order->payments()
            ->with(['collector:id,name', 'creator:id,name'])
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'order' => $this->presentOrder($order),
                'payments' => $payments,
                'collectors' => User::whereIn('id', auth()->user()->shopUserIds())
                    ->orderBy('name')
                    ->get(['id', 'name']),
            ],
        ]);
    }

    public function store(Request $request, int $orderId): JsonResponse
    {
        $order = $this->findOrder($orderId);
        $shopUserIds = auth()->user()->shopUserIds();

        $data = $request->validate([
            'purpose' => ['required', Rule::in(OrderPayment::PURPOSES)],
            'method' => ['required', Rule::in(OrderPayment::METHODS)],
            'amount' => ['nullable', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'collected_by' => ['required', 'integer', Rule::in($shopUserIds)],
            'collected_at' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:500'],
            'screenshot' => [
                Rule::requiredIf(in_array($request->input('method'), OrderPayment::SCREENSHOT_REQUIRED_METHODS, true)),
                'nullable', 'file', 'image', 'max:4096',
            ],
        ], [
            'screenshot.required' => 'বিকাশ/মোবাইল ব্যাংকিং এ টাকা নিলে লেনদেনের স্ক্রিনশট আপলোড করা আবশ্যক।',
            'collected_by.in' => 'নির্বাচিত ব্যক্তি এই শপের সদস্য নন।',
        ]);

        $amount = (float) ($data['amount'] ?? 0);
        $discount = (float) ($data['discount'] ?? 0);

        if ($amount <= 0 && $discount <= 0) {
            throw ValidationException::withMessages([
                'amount' => ['টাকার পরিমাণ অথবা ডিসকাউন্ট — অন্তত একটি অবশ্যই দিতে হবে।'],
            ]);
        }

        $screenshotPath = null;
        if ($request->hasFile('screenshot')) {
            $screenshotPath = $request->file('screenshot')->store('order-payments/' . $order->user_id, 'public');
        }

        $payment = DB::transaction(function () use ($order, $data, $amount, $discount, $screenshotPath) {
            $payment = OrderPayment::create([
                'order_id' => $order->id,
                'user_id' => $order->user_id,
                'collected_by' => $data['collected_by'],
                'created_by' => auth()->id(),
                'purpose' => $data['purpose'],
                'method' => $data['method'],
                'amount' => $amount,
                'discount' => $discount,
                'screenshot_path' => $screenshotPath,
                'note' => $data['note'] ?? null,
                'collected_at' => $data['collected_at'] ?? now(),
            ]);

            $this->accountingService->recordManualPayment($payment);

            return $payment;
        });

        return response()->json([
            'success' => true,
            'message' => 'পেমেন্ট সংরক্ষণ করা হয়েছে।',
            'data' => [
                'payment' => $payment->fresh(['collector:id,name', 'creator:id,name']),
                'order' => $this->presentOrder($order->fresh()),
            ],
        ], 201);
    }

    public function destroy(int $orderId, int $paymentId): JsonResponse
    {
        $order = $this->findOrder($orderId);
        $payment = $order->payments()->findOrFail($paymentId);

        DB::transaction(function () use ($payment, $order) {
            $this->accountingService->reverseManualPayment($payment);
            $payment->delete();
            // Recomputed after the row is gone — dueAmount() sums live from
            // order_payments, so this must run after delete(), not before.
            $this->accountingService->syncPaymentStatus($order);
        });

        if ($payment->screenshot_path) {
            Storage::disk('public')->delete($payment->screenshot_path);
        }

        return response()->json([
            'success' => true,
            'message' => 'পেমেন্ট এন্ট্রি মুছে ফেলা হয়েছে।',
            'data' => ['order' => $this->presentOrder($order->fresh())],
        ]);
    }

    private function findOrder(int $orderId): Order
    {
        return Order::whereIn('user_id', auth()->user()->shopUserIds())->findOrFail($orderId);
    }

    private function presentOrder(Order $order): array
    {
        return [
            'id' => $order->id,
            'order_number' => $order->order_number,
            'customer_name' => $order->customer_name,
            'customer_phone' => $order->customer_phone,
            'status' => $order->status,
            'payment_method' => $order->payment_method,
            'payment_status' => $order->payment_status,
            'subtotal' => $order->subtotal,
            'shipping_charge' => $order->shipping_charge,
            'discount' => $order->discount,
            'total' => $order->total,
            'paid_amount' => $order->paidAmount(),
            'collection_discount' => $order->collectionDiscountAmount(),
            'due_amount' => $order->dueAmount(),
        ];
    }
}
