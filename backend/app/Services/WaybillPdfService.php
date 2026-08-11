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
use Illuminate\Support\Facades\DB;
use Picqer\Barcode\BarcodeGeneratorPNG;

/**
 * Renders printable courier waybill/shipping labels for booked orders — one
 * label per order, multiple orders share one PDF with a page per label.
 * Mirrors InvoicePdfService's pattern (shared Blade template, bundled
 * Bengali font for customer names/addresses).
 * Each label carries a Code128 barcode (scanner-friendly tracking ID) and a
 * QR code (phone-camera-friendly order summary) — see feature_roadmap_context.md #5.
 *
 * Pathao orders get a dedicated layout that mirrors Pathao's own dashboard
 * sticker (fixed size, ignores the 58mm/80mm selector — real Pathao labels
 * aren't sized by that choice). Every other courier (or manual/no courier)
 * falls back to the original generic thermal design. A bulk print can mix
 * both in one PDF via dompdf's named-page CSS (`page: pathao;` on the
 * Pathao label wrapper) — see courier_waybill_context.md §5.2.
 */
class WaybillPdfService
{
    // Fixed physical size for the Pathao-style label — not tied to the
    // generic 58/80mm thermal selector. Chosen to match the aspect ratio of
    // Pathao's own dashboard-downloaded sticker (~1.55:1 landscape).
    private const PATHAO_WIDTH_MM  = 100;
    private const PATHAO_HEIGHT_MM = 78;

    /** @var array<int, ?string> memoized pathao_locations name lookups, keyed by external_id */
    private array $pathaoLocationNames = [];

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
    private function qrDataUri(Order $order, float $codAmount): string
    {
        $text = implode("\n", array_filter([
            'Order: ' . $order->order_number,
            'Tracking: ' . ($order->courier_tracking_id ?? '-'),
            'COD: ৳' . number_format($codAmount, 0),
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
     * Resolves a Pathao city/zone/area name from the local `pathao_locations`
     * cache (populated by PathaoLocationService's dropdown lookups at
     * booking time) — a plain DB read, never a live Pathao API call, so PDF
     * rendering never depends on network/credentials being available.
     * Returns null (never a fabricated placeholder) when not cached, since
     * this can genuinely differ from Pathao's own internal hub/sort/route
     * assignment which we have no way to know before Pathao processes the
     * parcel — see courier_waybill_context.md §5.1 for what's deliberately
     * left off this label because of that.
     */
    private function pathaoLocationName(?int $externalId): ?string
    {
        if ($externalId === null) {
            return null;
        }

        if (! array_key_exists($externalId, $this->pathaoLocationNames)) {
            $this->pathaoLocationNames[$externalId] = DB::table('pathao_locations')
                ->where('external_id', $externalId)
                ->value('name');
        }

        return $this->pathaoLocationNames[$externalId];
    }

    /**
     * @param  Collection<int, Order>|Order[]  $orders
     * @param  int  $widthMm  58 or 80 — thermal label width (ignored for
     *                        Pathao orders, which always use their own fixed size).
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

        // dompdf has no support for CSS named @page selectors (only
        // :first/:left/:right/:odd/:even — see Stylesheet::_parse_css's
        // "page" case, which silently drops anything else), so ONE PDF
        // document can only have ONE physical page size. When every order
        // in the batch is Pathao, the whole document uses Pathao's fixed
        // landscape size; otherwise it uses the classic thermal size
        // (existing behavior). A Pathao order's own cell/image widths are
        // computed as a fraction of whichever page width wins below, so a
        // Pathao label mixed into a thermal-sized batch still fits inside
        // its (narrower, portrait) page instead of bleeding past the edge —
        // it just prints smaller/cramped in that mixed-batch edge case.
        $allPathao = $orders->isNotEmpty()
            && $orders->every(fn (Order $o) => strtolower((string) $o->courier_name) === 'pathao');

        $pageWidthMm  = $allPathao ? self::PATHAO_WIDTH_MM  : $widthMm;
        $pageHeightMm = $allPathao ? self::PATHAO_HEIGHT_MM : $heightMm;

        $pathaoPaddingMm = round($pageWidthMm * 0.03, 2);
        $pathaoLogoColMm = round($pageWidthMm * 0.20, 2);
        $pathaoTypeColMm = round($pageWidthMm * 0.14, 2);
        $pathaoQrMm      = round($pageWidthMm * 0.18, 2);
        // -1mm below: the image is drawn slightly narrower than its table
        // column, same safety-buffer reasoning as $barcodeWidthMm above —
        // guards against any residual sub-mm rounding still bleeding to
        // the page edge even after the table-width fix a few lines down.
        $pathaoQrImgMm         = $pathaoQrMm - 1;
        $pathaoBarcodeWidthMm  = round($pageWidthMm * 0.42, 2) - 1;
        $pathaoBarcodeHeightMm = round($pageHeightMm * 0.16, 2);
        // Wide enough that "Collectable Amount: BDT X,XXX.XX" fits on one
        // line at .p-collect's font-size for realistic order totals.
        $pathaoBottomLeftColMm = round($pageWidthMm * 0.52, 2);
        // Every table column below gets an explicit mm width (none left
        // "auto") — dompdf's table auto-layout doesn't reliably respect a
        // 100%-width table when one column is unconstrained and another
        // has long wrapping text (e.g. the customer address); it let the
        // table grow past its container and pushed the QR column off the
        // right edge of the page in testing. Explicit widths on every
        // column, summing to exactly the content width, is the same fix
        // already applied to the barcode/QR <img> sizing above.
        $pathaoContentWidthMm    = round($pageWidthMm - (2 * $pathaoPaddingMm), 2);
        $pathaoHeaderTextColMm   = round($pathaoContentWidthMm - $pathaoLogoColMm, 2);
        $pathaoMidTextColMm      = round($pathaoContentWidthMm - $pathaoTypeColMm - $pathaoQrMm, 2);
        $pathaoBottomRightColMm  = round($pathaoContentWidthMm - $pathaoBottomLeftColMm, 2);

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

            // The courier only collects what was actually declared to them
            // at booking time (courier_cod_amount) — which can be less than
            // order->total for partial COD/advance-paid orders. Orders
            // booked before this field existed fall back to total.
            $codAmount = (float) ($order->courier_cod_amount ?? $order->total);
            $isPathao = strtolower((string) $order->courier_name) === 'pathao';

            // Seller-controlled (Settings → Shop Profile): whether their own
            // phone/address print on the sender block. Default true so a
            // shop that never touches the setting keeps today's behavior.
            $showPhone   = $profile?->show_phone_on_sticker   ?? true;
            $showAddress = $profile?->show_address_on_sticker ?? true;

            return [
                'order'        => $order,
                'isPathao'     => $isPathao,
                'codAmount'    => $codAmount,
                // Shop Profile (Settings → Shop Profile) is the source of
                // truth once set up; falls back to the account's own
                // name/mobile so labels aren't blank before a seller fills it in.
                'shopName'     => $this->reorderBengaliMatras($profile?->shop_name ?? $shop?->name) ?? '—',
                'shopPhone'    => $showPhone ? ($profile?->phone ?? $shop?->mobile ?? '—') : null,
                'shopAddress'  => $showAddress ? $this->reorderBengaliMatras($profile?->address) : null,
                'customerName' => $this->reorderBengaliMatras($order->customer_name) ?? '—',
                'itemCount'    => $order->items->sum('quantity'),
                'itemsSummary' => $this->reorderBengaliMatras($itemsSummary),
                'address'      => $this->reorderBengaliMatras($address) ?: '—',
                'notes'        => $this->reorderBengaliMatras($order->notes),
                'barcode'      => $this->barcodeDataUri($order->courier_tracking_id),
                'qr'           => $this->qrDataUri($order, $codAmount),
                // Pathao-layout-only fields — cheap to compute even when
                // $isPathao is false, so no branching needed here.
                'weightKg'     => $order->courier_weight_kg !== null ? (float) $order->courier_weight_kg : 0.5,
                'bookedAt'     => ($order->courier_booked_at ?? $order->updated_at)?->format('Y-m-d h:i:s A'),
                'cityName'     => $this->pathaoLocationName($order->pathao_city_id),
                'zoneName'     => $this->pathaoLocationName($order->pathao_zone_id),
                'areaName'     => $this->pathaoLocationName($order->pathao_area_id),
            ];
        });

        return Pdf::loadView('couriers.waybill', [
            'labels'                => $labels,
            'widthMm'               => $widthMm,
            'heightMm'              => $heightMm,
            'barcodeWidthMm'        => $barcodeWidthMm,
            'qrSizeMm'              => $qrSizeMm,
            'qrTextWidthMm'         => $qrTextWidthMm,
            'pageWidthMm'           => $pageWidthMm,
            'pageHeightMm'          => $pageHeightMm,
            'pathaoPaddingMm'       => $pathaoPaddingMm,
            'pathaoLogoColMm'       => $pathaoLogoColMm,
            'pathaoTypeColMm'       => $pathaoTypeColMm,
            'pathaoQrMm'            => $pathaoQrMm,
            'pathaoQrImgMm'         => $pathaoQrImgMm,
            'pathaoBarcodeWidthMm'  => $pathaoBarcodeWidthMm,
            'pathaoBarcodeHeightMm' => $pathaoBarcodeHeightMm,
            'pathaoBottomLeftColMm' => $pathaoBottomLeftColMm,
            'pathaoContentWidthMm'   => $pathaoContentWidthMm,
            'pathaoHeaderTextColMm'  => $pathaoHeaderTextColMm,
            'pathaoMidTextColMm'     => $pathaoMidTextColMm,
            'pathaoBottomRightColMm' => $pathaoBottomRightColMm,
            'fontRegular'           => $this->fontRegular(),
            'fontBold'              => $this->fontBold(),
        ])->setPaper([0, 0, $pageWidthMm * 2.8346, $pageHeightMm * 2.8346]);
    }
}
