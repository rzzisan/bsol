<?php

namespace App\Services;

use App\Models\Order;
use App\Models\ShopProfile;
use Barryvdh\DomPDF\Facade\Pdf;
use Barryvdh\DomPDF\PDF as PdfDocument;
use Illuminate\Support\Facades\Storage;

/**
 * Renders a per-order sales invoice PDF (seller → customer) — distinct from
 * InvoicePdfService, which renders platform-billing invoices (SaaS →
 * seller, subscription/SMS credit). "From" here is the seller's own Shop
 * Profile (name/phone/address/logo — see ShopProfile model), falling back
 * to the account's own name/mobile if the seller hasn't filled it in.
 */
class OrderInvoicePdfService
{
    private function fontRegular(): string
    {
        return 'file://' . storage_path('fonts/NotoSansBengali-Regular.ttf');
    }

    private function fontBold(): string
    {
        return 'file://' . storage_path('fonts/NotoSansBengali-Bold.ttf');
    }

    /**
     * dompdf has `enable_remote` off (correctly — no SSRF-by-invoice), so an
     * https:// logo URL just renders as a broken image. Read the file
     * straight off local disk instead and embed it as a base64 data URI —
     * same fix as the waybill's barcode/QR images, no network fetch at all.
     */
    private function logoDataUri(?string $logoPath): ?string
    {
        if (! $logoPath || ! Storage::disk('public')->exists($logoPath)) {
            return null;
        }

        $mime = Storage::disk('public')->mimeType($logoPath) ?: 'image/png';
        $contents = Storage::disk('public')->get($logoPath);

        return "data:{$mime};base64," . base64_encode($contents);
    }

    /**
     * dompdf has no complex-script shaping — see WaybillPdfService's
     * reorderBengaliMatras() doc for the full explanation. Same fix,
     * needed here too since this template also renders Bengali customer/
     * shop names and addresses.
     */
    private function reorderBengaliMatras(?string $text): ?string
    {
        if ($text === null || $text === '') {
            return $text;
        }

        // Decompose precomposed ো/ৌ into ে+া / ে+ৗ first — see WaybillPdfService.
        $text = str_replace(["\u{09CB}", "\u{09CC}"], ["\u{09C7}\u{09BE}", "\u{09C7}\u{09D7}"], $text);

        $consonant = '\x{0995}-\x{09B9}\x{09CE}\x{09DC}-\x{09DF}';
        $pattern = '/((?:[' . $consonant . ']\x{09CD})*[' . $consonant . '])([\x{09BF}\x{09C7}\x{09C8}])/u';

        return preg_replace($pattern, '$2$1', $text) ?? $text;
    }

    public function render(Order $order): PdfDocument
    {
        $order->loadMissing(['user', 'items']);
        $shop = $order->user?->shopOwner();
        $profile = $shop ? ShopProfile::where('user_id', $shop->id)->first() : null;

        $items = $order->items->map(function ($item) {
            return [
                'name'      => $this->reorderBengaliMatras($item->product_name),
                'sku'       => $item->sku,
                'variant'   => $this->formatVariant($item->variant_info),
                'quantity'  => $item->quantity,
                'unitPrice' => (float) $item->unit_price,
                'total'     => (float) $item->total,
            ];
        });

        $address = collect([$order->customer_address, $order->customer_area, $order->customer_thana, $order->customer_district])
            ->filter()->implode(', ');

        return Pdf::loadView('invoices.order-invoice', [
            'order'        => $order,
            'items'        => $items,
            'shopName'     => $this->reorderBengaliMatras($profile?->shop_name ?? $shop?->name) ?? '—',
            'shopPhone'    => $profile?->phone ?? $shop?->mobile,
            'shopEmail'    => $profile?->email,
            'shopAddress'  => $this->reorderBengaliMatras($profile?->address),
            'logoUrl'      => $this->logoDataUri($profile?->logo_path),
            'customerName' => $this->reorderBengaliMatras($order->customer_name) ?? '—',
            'address'      => $this->reorderBengaliMatras($address) ?: '—',
            'fontRegular'  => $this->fontRegular(),
            'fontBold'     => $this->fontBold(),
        ])->setPaper('a4');
    }

    /**
     * variant_info is a flat {optionName: value} map (see order-item-grid.tsx),
     * e.g. {"Color": "Red", "Size": "XL"} -> "Color: Red · Size: XL".
     */
    private function formatVariant(?array $variantInfo): ?string
    {
        if (empty($variantInfo)) {
            return null;
        }

        $pairs = collect($variantInfo)
            ->filter(fn ($v) => $v !== null && $v !== '')
            ->map(fn ($v, $k) => "{$k}: {$v}");

        return $pairs->isEmpty() ? null : $this->reorderBengaliMatras($pairs->implode(' · '));
    }
}
