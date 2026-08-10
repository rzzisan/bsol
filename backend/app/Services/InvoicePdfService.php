<?php

namespace App\Services;

use App\Models\SmsCreditPurchase;
use App\Models\SubscriptionPayment;
use Barryvdh\DomPDF\Facade\Pdf;
use Barryvdh\DomPDF\PDF as PdfDocument;

/**
 * Renders printable/downloadable PDF invoices for subscription payments and
 * SMS credit purchases — shared Blade template (resources/views/invoices/document.blade.php).
 * Uses a bundled Noto Sans Bengali font (storage/fonts/) so customer names in
 * Bengali script render correctly — dompdf's built-in fonts have no Bengali
 * glyph coverage. See subscription_billing_context.md §7.
 */
class InvoicePdfService
{
    private function fontRegular(): string
    {
        return 'file://' . storage_path('fonts/NotoSansBengali-Regular.ttf');
    }

    private function fontBold(): string
    {
        return 'file://' . storage_path('fonts/NotoSansBengali-Bold.ttf');
    }

    private function statusMeta(string $status): array
    {
        return match ($status) {
            'approved' => ['class' => 'approved', 'label' => 'PAID'],
            'rejected' => ['class' => 'rejected', 'label' => 'REJECTED'],
            default => ['class' => 'pending', 'label' => 'AWAITING PAYMENT'],
        };
    }

    private function paymentMethodLabel(string $method): string
    {
        return match ($method) {
            'bkash_manual' => 'bKash (manual)',
            'bkash_gateway' => 'bKash (instant)',
            'bkash_gateway_pgw' => 'bKash (instant)',
            default => ucfirst(str_replace('_', ' ', $method)),
        };
    }

    public function subscriptionInvoice(SubscriptionPayment $payment): PdfDocument
    {
        $payment->loadMissing(['user', 'package', 'previousPackage']);
        $status = $this->statusMeta($payment->status);

        $lineItems = [[
            'label' => $payment->package->name . ' — ' . $payment->package->duration_days . ' days',
            'amount' => (float) ($payment->base_amount ?? $payment->amount),
        ]];

        if ((float) $payment->proration_credit > 0) {
            $lineItems[] = [
                'label' => 'Remaining-time credit'
                    . ($payment->previousPackage ? " ({$payment->previousPackage->name})" : ''),
                'amount' => -1 * (float) $payment->proration_credit,
            ];
        }

        return Pdf::loadView('invoices.document', [
            'brandName' => 'Hybrid Commerce SaaS',
            'brandTagline' => 'Subscription Invoice',
            'title' => 'INVOICE',
            'invoiceNumber' => 'SUB-' . str_pad((string) $payment->id, 6, '0', STR_PAD_LEFT),
            'issueDate' => $payment->created_at,
            'customer' => $payment->user,
            'lineItems' => $lineItems,
            'total' => (float) $payment->amount,
            'statusClass' => $status['class'],
            'statusLabel' => $status['label'],
            'paymentMethod' => $payment->payment_method,
            'paymentMethodLabel' => $this->paymentMethodLabel($payment->payment_method),
            'trxId' => $payment->trx_id,
            'paidAt' => $payment->status === 'approved' ? $payment->reviewed_at : null,
            'fontRegular' => $this->fontRegular(),
            'fontBold' => $this->fontBold(),
        ])->setPaper('a4');
    }

    public function smsCreditInvoice(SmsCreditPurchase $purchase): PdfDocument
    {
        $purchase->loadMissing('user');
        $status = $this->statusMeta($purchase->status);

        $rate = rtrim(rtrim(number_format((float) $purchase->rate_used, 4), '0'), '.');

        $lineItems = [[
            'label' => number_format($purchase->credits) . ' SMS credits',
            'note' => '× ৳' . $rate . '/credit',
            'amount' => (float) $purchase->amount,
        ]];

        return Pdf::loadView('invoices.document', [
            'brandName' => 'Hybrid Commerce SaaS',
            'brandTagline' => 'SMS Credit Invoice',
            'title' => 'INVOICE',
            'invoiceNumber' => 'SMSC-' . str_pad((string) $purchase->id, 6, '0', STR_PAD_LEFT),
            'issueDate' => $purchase->created_at,
            'customer' => $purchase->user,
            'lineItems' => $lineItems,
            'total' => (float) $purchase->amount,
            'statusClass' => $status['class'],
            'statusLabel' => $status['label'],
            'paymentMethod' => $purchase->payment_method,
            'paymentMethodLabel' => $this->paymentMethodLabel($purchase->payment_method),
            'trxId' => $purchase->trx_id,
            'paidAt' => $purchase->status === 'approved' ? $purchase->reviewed_at : null,
            'fontRegular' => $this->fontRegular(),
            'fontBold' => $this->fontBold(),
        ])->setPaper('a4');
    }
}
