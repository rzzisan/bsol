<?php

namespace App\Services;

use App\Models\Order;
use App\Models\ShopProfile;
use Barryvdh\DomPDF\Facade\Pdf;
use Barryvdh\DomPDF\PDF as PdfDocument;
use chillerlan\QRCode\Output\QROutputInterface;
use chillerlan\QRCode\QRCode;
use chillerlan\QRCode\QROptions;
use Illuminate\Support\Collection;
use Picqer\Barcode\BarcodeGeneratorPNG;

/**
 * Renders printable courier waybill/shipping labels (58mm/80mm thermal
 * format) for booked orders — one label per order, multiple orders share one
 * PDF with a page per label. Mirrors InvoicePdfService's pattern (shared
 * Blade template, bundled Bengali font for customer names/addresses).
 * Each label carries a Code128 barcode (scanner-friendly tracking ID) and a
 * QR code (phone-camera-friendly order summary) — see feature_roadmap_context.md #5.
 */
class WaybillPdfService
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
     * dompdf has no complex-script (Indic) text shaping engine — it draws
     * glyphs in raw Unicode storage order instead of applying the font's
     * reordering rules. Bengali's pre-base vowel signs (ি ে ৈ, U+09BF/
     * U+09C7/U+09C8) are stored *after* the consonant they modify but must
     * display *before* it; left alone, "জিসান" renders as "জসিান" and
     * "হেডফোন" as "হডেফোন". This moves those three signs ahead of their
     * consonant cluster (including any preceding virama-joined conjuncts)
     * so dompdf's naive left-to-right placement matches reality.
     *
     * The precomposed ো/ৌ (U+09CB/U+09CC) turned out to ALSO need help,
     * despite being single codepoints — the font apparently has no direct
     * glyph for them and expects the OpenType `ccmp` feature to compose one
     * from ে+া / ে+ৗ, which dompdf doesn't apply either, so they render as
     * a missing-glyph mark (e.g. "হেডফোন" → "হেডফো·ন"). Decomposing them
     * into their components *before* the reordering pass fixes both at once
     * (the newly-split ে gets correctly reordered along with everything else).
     */
    private function reorderBengaliMatras(?string $text): ?string
    {
        if ($text === null || $text === '') {
            return $text;
        }

        $text = str_replace(["\u{09CB}", "\u{09CC}"], ["\u{09C7}\u{09BE}", "\u{09C7}\u{09D7}"], $text);

        $consonant = '\x{0995}-\x{09B9}\x{09CE}\x{09DC}-\x{09DF}';
        $pattern = '/((?:[' . $consonant . ']\x{09CD})*[' . $consonant . '])([\x{09BF}\x{09C7}\x{09C8}])/u';

        return preg_replace($pattern, '$2$1', $text) ?? $text;
    }

    /** Code128 barcode of the tracking ID, as a base64 PNG data URI. Null if there's nothing to encode. */
    private function barcodeDataUri(?string $trackingId): ?string
    {
        if (! $trackingId) {
            return null;
        }

        $generator = new BarcodeGeneratorPNG();
        $png = $generator->getBarcode($trackingId, $generator::TYPE_CODE_128, 2, 50);

        return 'data:image/png;base64,' . base64_encode($png);
    }

    /**
     * QR code encoding a compact order summary (order #, tracking ID, COD
     * amount, customer phone) for a quick phone-camera scan — there's no
     * unified public order-tracking URL across couriers/sellers to encode
     * instead, so this carries the label's own data as plain text.
     */
    private function qrDataUri(Order $order): string
    {
        $text = implode("\n", array_filter([
            'Order: ' . $order->order_number,
            'Tracking: ' . ($order->courier_tracking_id ?? '-'),
            'COD: ৳' . number_format((float) $order->total, 0),
            'Phone: ' . $order->customer_phone,
        ]));

        $options = new QROptions([
            'outputType'       => QROutputInterface::GDIMAGE_PNG,
            'scale'            => 4,
            'imageTransparent' => false,
        ]);

        return (new QRCode($options))->render($text);
    }

    /**
     * @param  Collection<int, Order>|Order[]  $orders
     * @param  int  $widthMm  58 or 80 — thermal label width.
     */
    public function render(Collection|array $orders, int $widthMm = 80): PdfDocument
    {
        $orders = collect($orders)->values();
        $orders->each(fn (Order $order) => $order->loadMissing(['user', 'items']));

        $widthMm  = in_array($widthMm, [58, 80], true) ? $widthMm : 80;
        // Generous height so content never overflows to a phantom second
        // page — stacking (not tables) for ORDER/ITEMS and the QR block
        // needs more vertical room than a side-by-side layout would.
        $heightMm = $widthMm === 58 ? 145 : 150;
        $paddingMm = $widthMm === 58 ? 2.5 : 3.5;
        // Explicit mm widths for the barcode/QR images rather than
        // percentage/edge-flush sizing — those overflowed past the printable
        // area with no right margin on real thermal printers (percentage
        // widths on <img> aren't reliably contained by dompdf here, same
        // family of box-model quirks as the text-align:right bug above).
        // A couple mm of slack is kept deliberately, not sized to the exact edge.
        $barcodeWidthMm = $widthMm - (2 * $paddingMm) - 2;
        $qrSizeMm       = $widthMm === 58 ? 16 : 20;
        // Text sits beside the QR via inline-block (default left-to-right
        // flow), not float/text-align:right — see the .qr comment in the
        // template for why those are avoided here. Its width is capped so
        // it can never collide with the QR block.
        $qrTextWidthMm  = $widthMm - (2 * $paddingMm) - $qrSizeMm - 2;

        $shopProfiles = [];

        $labels = $orders->map(function (Order $order) use (&$shopProfiles) {
            $shop = $order->user?->shopOwner();
            $ownerId = $shop?->id;

            // All orders in one request share the same shop (bulk is always
            // scoped to the caller's shopUserIds()), so this is normally a
            // single lookup — memoized per owner just in case.
            if ($ownerId !== null && ! array_key_exists($ownerId, $shopProfiles)) {
                $shopProfiles[$ownerId] = ShopProfile::where('user_id', $ownerId)->first();
            }
            $profile = $ownerId !== null ? $shopProfiles[$ownerId] : null;

            $address = collect([$order->customer_address, $order->customer_area, $order->customer_thana, $order->customer_district])
                ->filter()->implode(', ');
            $itemsSummary = $order->items->pluck('product_name')->filter()->implode(', ');

            return [
                'order'        => $order,
                // Shop Profile (Settings → Shop Profile) is the source of
                // truth once set up; falls back to the account's own
                // name/mobile so labels aren't blank before a seller fills it in.
                'shopName'     => $this->reorderBengaliMatras($profile?->shop_name ?? $shop?->name) ?? '—',
                'shopPhone'    => $profile?->phone ?? $shop?->mobile ?? '—',
                'shopAddress'  => $this->reorderBengaliMatras($profile?->address),
                'customerName' => $this->reorderBengaliMatras($order->customer_name) ?? '—',
                'itemCount'    => $order->items->sum('quantity'),
                'itemsSummary' => $this->reorderBengaliMatras($itemsSummary),
                'address'      => $this->reorderBengaliMatras($address) ?: '—',
                'notes'        => $this->reorderBengaliMatras($order->notes),
                'barcode'      => $this->barcodeDataUri($order->courier_tracking_id),
                'qr'           => $this->qrDataUri($order),
            ];
        });

        return Pdf::loadView('couriers.waybill', [
            'labels'         => $labels,
            'widthMm'        => $widthMm,
            'heightMm'       => $heightMm,
            'barcodeWidthMm' => $barcodeWidthMm,
            'qrSizeMm'       => $qrSizeMm,
            'qrTextWidthMm'  => $qrTextWidthMm,
            'fontRegular'    => $this->fontRegular(),
            'fontBold'       => $this->fontBold(),
        ])->setPaper([0, 0, $widthMm * 2.8346, $heightMm * 2.8346]);
    }
}
