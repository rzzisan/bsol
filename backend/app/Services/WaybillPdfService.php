<?php

namespace App\Services;

use App\Models\Order;
use App\Models\ShopProfile;
use App\Models\StickerCourierTemplate;
use App\Models\StickerSetting;
use Barryvdh\DomPDF\Facade\Pdf;
use Barryvdh\DomPDF\PDF as PdfDocument;
use chillerlan\QRCode\Output\QROutputInterface;
use chillerlan\QRCode\QRCode;
use chillerlan\QRCode\QROptions;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Picqer\Barcode\BarcodeGeneratorPNG;

/**
 * Renders printable courier waybill/shipping labels for booked orders — one
 * label per order, multiple orders share one PDF with a page per label.
 * Mirrors InvoicePdfService's pattern (shared Blade template, bundled
 * Bengali font for customer names/addresses).
 * Each label carries a Code128 barcode (scanner-friendly tracking ID) and a
 * QR code (phone-camera-friendly order summary) — see feature_roadmap_context.md #5.
 *
 * ── Sticker Template feature (courier_waybill_context.md §6) ──────────────
 * A seller picks a default label design (Settings → Sticker Templates) and
 * optionally a different one per courier (StickerCourierTemplate). The
 * available designs are the catalog in config/sticker_templates.php, each
 * backed by a Blade partial under resources/views/couriers/templates/.
 *
 * dompdf has no support for CSS named @page selectors (only :first/:left/
 * :right/:odd/:even — see Stylesheet::_parse_css's "page" case, which
 * silently drops anything else), so ONE PDF document can only have ONE
 * physical page size. This means a single render() call can only use ONE
 * template for the whole document: if every order in the batch resolves to
 * the same template, that template's native size is used; if the batch is
 * mixed (different couriers with different overrides), the whole document
 * falls back to 'classic' (the only template built to fit any content
 * without a fixed native size) rather than trying to honor each order's
 * individual choice. Print-one-order-at-a-time and same-courier bulk prints
 * (the common cases) are unaffected by this. See §6.3 for the rationale and
 * why merging separately-rendered per-template PDFs (e.g. via FPDI) was
 * deliberately scoped out for now.
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

    /** "(SKU-QTY)+(SKU-QTY)" style product summary — cod_band_compact's reference design. */
    private function skuSummary(Order $order): string
    {
        return $order->items->map(function ($item) {
            $code = $item->sku ?: Str::upper(Str::substr(preg_replace('/[^A-Za-z0-9]/', '', $item->product_name ?? ''), 0, 4)) ?: '-';
            return "({$code}-{$item->quantity})";
        })->implode('+');
    }

    /** Compact item rows shared by invoice_table/pos_bill: name (truncated), qty, unit price, line total. */
    private function itemRows(Order $order, int $nameLimit = 22): array
    {
        return $order->items->map(fn ($item) => [
            'name'  => Str::limit($item->product_name ?? '-', $nameLimit),
            'qty'   => $item->quantity,
            'price' => (float) $item->unit_price,
            'total' => (float) $item->total,
        ])->all();
    }

    /**
     * Resolves which template key applies to a single order: per-courier
     * override first, then the shop's default, then 'classic'.
     */
    private function resolveTemplateKey(Order $order, ?string $defaultKey, array $courierOverrides): string
    {
        $courier = strtolower((string) $order->courier_name);
        return $courierOverrides[$courier] ?? $defaultKey ?? 'classic';
    }

    /**
     * @param  Collection<int, Order>|Order[]  $orders
     * @param  int  $widthMm  58 or 80 — thermal label width, used only by
     *                        the 'classic' template (every other template
     *                        has its own fixed native size).
     */
    public function render(Collection|array $orders, int $widthMm = 80): PdfDocument
    {
        $orders = collect($orders)->values();
        $orders->each(fn (Order $order) => $order->loadMissing(['user', 'items']));

        $widthMm  = in_array($widthMm, [58, 80], true) ? $widthMm : 80;

        $ownerId = $orders->first()?->user?->shopOwner()?->id;
        $stickerSetting = $ownerId !== null ? StickerSetting::where('user_id', $ownerId)->first() : null;
        $courierOverrides = $ownerId !== null
            ? StickerCourierTemplate::where('user_id', $ownerId)->pluck('template_key', 'courier_name')
                ->mapWithKeys(fn ($key, $courier) => [strtolower($courier) => $key])->all()
            : [];
        $defaultTemplateKey = $stickerSetting?->default_template_key ?? 'classic';
        $catalog = config('sticker_templates', []);

        $resolvedKeys = $orders->map(fn (Order $o) => $this->resolveTemplateKey($o, $defaultTemplateKey, $courierOverrides))->unique();
        // See the class doc comment: one document = one page size, so a
        // mixed batch falls back to 'classic' rather than honoring each
        // order's individual template.
        $effectiveKey = ($resolvedKeys->count() === 1 && array_key_exists($resolvedKeys->first(), $catalog))
            ? $resolvedKeys->first()
            : 'classic';

        $template = $catalog[$effectiveKey] ?? $catalog['classic'];
        $pageWidthMm  = $template['widthMm']  ?? $widthMm;
        $pageHeightMm = $template['heightMm'] ?? ($widthMm === 58 ? 145 : 150);

        $geometry = match ($effectiveKey) {
            'pathao'            => $this->pathaoGeometry($pageWidthMm, $pageHeightMm),
            'cod_band_compact'  => $this->codBandCompactGeometry($pageWidthMm, $pageHeightMm),
            'invoice_table'     => $this->invoiceTableGeometry($pageWidthMm, $pageHeightMm),
            'pos_bill'          => $this->posBillGeometry($pageWidthMm, $pageHeightMm),
            'mini_cod'          => $this->miniCodGeometry($pageWidthMm, $pageHeightMm),
            default             => $this->classicGeometry($pageWidthMm, $pageHeightMm),
        };

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

            // Seller-controlled (Settings → Shop Profile): whether their own
            // phone/address print on the sender block. Default true so a
            // shop that never touches the setting keeps today's behavior.
            $showPhone   = $profile?->show_phone_on_sticker   ?? true;
            $showAddress = $profile?->show_address_on_sticker ?? true;

            return [
                'order'        => $order,
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
                'skuSummary'   => $this->skuSummary($order),
                'itemRows'     => $this->itemRows($order),
                'subtotal'     => (float) $order->subtotal,
                'shippingCharge' => (float) $order->shipping_charge,
                'discount'     => (float) $order->discount,
                'address'      => $this->reorderBengaliMatras($address) ?: '—',
                'notes'        => $this->reorderBengaliMatras($order->notes),
                'barcode'      => $this->barcodeDataUri($order->courier_tracking_id),
                'qr'           => $this->qrDataUri($order, $codAmount),
                // Pathao-layout-only fields — cheap to compute even when
                // the active template isn't 'pathao', so no branching needed here.
                'weightKg'     => $order->courier_weight_kg !== null ? (float) $order->courier_weight_kg : 0.5,
                'bookedAt'     => ($order->courier_booked_at ?? $order->updated_at)?->format('Y-m-d h:i:s A'),
                'dateShort'    => ($order->courier_booked_at ?? $order->created_at)?->format('n/j/Y'),
                'cityName'     => $this->pathaoLocationName($order->pathao_city_id),
                'zoneName'     => $this->pathaoLocationName($order->pathao_zone_id),
                'areaName'     => $this->pathaoLocationName($order->pathao_area_id),
            ];
        });

        return Pdf::loadView('couriers.waybill', [
            'labels'       => $labels,
            'templateKey'  => $effectiveKey,
            'templateView' => $template['view'] ?? 'couriers.templates.classic',
            'pageWidthMm'  => $pageWidthMm,
            'pageHeightMm' => $pageHeightMm,
            'g'            => $geometry,
            'fontRegular'  => $this->fontRegular(),
            'fontBold'     => $this->fontBold(),
        ])->setPaper([0, 0, $pageWidthMm * 2.8346, $pageHeightMm * 2.8346]);
    }

    /** Geometry for the 'classic' generic thermal template — unchanged from before the Sticker Template feature. */
    private function classicGeometry(float $widthMm, float $heightMm): array
    {
        $paddingMm = $widthMm == 58 ? 2.5 : 3.5;
        $barcodeWidthMm = $widthMm - (2 * $paddingMm) - 2;
        $qrSizeMm = $widthMm == 58 ? 16 : 20;
        $qrTextWidthMm = $widthMm - (2 * $paddingMm) - $qrSizeMm - 2;

        return compact('paddingMm', 'barcodeWidthMm', 'qrSizeMm', 'qrTextWidthMm') + ['widthMm' => $widthMm];
    }

    /** Geometry for the 'pathao' template — see courier_waybill_context.md §5 for the derivation of these fractions. */
    private function pathaoGeometry(float $pageWidthMm, float $pageHeightMm): array
    {
        $paddingMm = round($pageWidthMm * 0.03, 2);
        $logoColMm = round($pageWidthMm * 0.20, 2);
        $typeColMm = round($pageWidthMm * 0.14, 2);
        $qrMm      = round($pageWidthMm * 0.18, 2);
        $qrImgMm   = $qrMm - 1;
        $barcodeWidthMm  = round($pageWidthMm * 0.42, 2) - 1;
        $barcodeHeightMm = round($pageHeightMm * 0.16, 2);
        $bottomLeftColMm = round($pageWidthMm * 0.52, 2);
        $contentWidthMm    = round($pageWidthMm - (2 * $paddingMm), 2);
        $headerTextColMm   = round($contentWidthMm - $logoColMm, 2);
        $midTextColMm      = round($contentWidthMm - $typeColMm - $qrMm, 2);
        $bottomRightColMm  = round($contentWidthMm - $bottomLeftColMm, 2);

        return compact(
            'paddingMm', 'logoColMm', 'typeColMm', 'qrMm', 'qrImgMm', 'barcodeWidthMm', 'barcodeHeightMm',
            'bottomLeftColMm', 'contentWidthMm', 'headerTextColMm', 'midTextColMm', 'bottomRightColMm'
        );
    }

    /** Geometry for 'cod_band_compact' (2x3in, reference "Sticker 1"). */
    private function codBandCompactGeometry(float $pageWidthMm, float $pageHeightMm): array
    {
        $paddingMm = round($pageWidthMm * 0.04, 2);
        $contentWidthMm = round($pageWidthMm - (2 * $paddingMm), 2);
        $barcodeWidthMm = round($contentWidthMm - 2, 2);

        return compact('paddingMm', 'contentWidthMm', 'barcodeWidthMm');
    }

    /** Geometry for 'invoice_table' (75x50mm landscape, reference "RetailBD"/"EcomDrive" family). */
    private function invoiceTableGeometry(float $pageWidthMm, float $pageHeightMm): array
    {
        $paddingMm = round($pageWidthMm * 0.035, 2);
        $contentWidthMm = round($pageWidthMm - (2 * $paddingMm), 2);
        $barcodeColMm = round($contentWidthMm * 0.30, 2) - 1;
        $barcodeHeightMm = 8;
        $qtyColMm = round($contentWidthMm * 0.12, 2);
        $priceColMm = round($contentWidthMm * 0.20, 2);
        $totalColMm = round($contentWidthMm * 0.20, 2);
        $nameColMm = round($contentWidthMm - $qtyColMm - $priceColMm - $totalColMm, 2);

        return compact(
            'paddingMm', 'contentWidthMm', 'barcodeColMm', 'barcodeHeightMm',
            'nameColMm', 'qtyColMm', 'priceColMm', 'totalColMm'
        );
    }

    /** Geometry for 'pos_bill' (80mm POS-style, reference "Pos Sticker"). */
    private function posBillGeometry(float $pageWidthMm, float $pageHeightMm): array
    {
        $paddingMm = 3.5;
        $contentWidthMm = round($pageWidthMm - (2 * $paddingMm), 2);
        $barcodeWidthMm = round($contentWidthMm - 2, 2);
        // Table columns stay left-aligned (never text-align:right — see the
        // class doc comment on the classic template's known dompdf bug),
        // so this is just a visual split, not alignment-critical.
        $nameColMm  = round($contentWidthMm * 0.40, 2);
        $priceColMm = round($contentWidthMm * 0.20, 2);
        $qtyColMm   = round($contentWidthMm * 0.15, 2);
        $totalColMm = round($contentWidthMm - $nameColMm - $priceColMm - $qtyColMm, 2);

        return compact('paddingMm', 'contentWidthMm', 'barcodeWidthMm', 'nameColMm', 'priceColMm', 'qtyColMm', 'totalColMm');
    }

    /** Geometry for 'mini_cod' (38x25mm, reference "Shokher Gadget"). */
    private function miniCodGeometry(float $pageWidthMm, float $pageHeightMm): array
    {
        $paddingMm = 1.5;
        $contentWidthMm = round($pageWidthMm - (2 * $paddingMm), 2);
        $barcodeWidthMm = round($contentWidthMm - 1, 2);

        return compact('paddingMm', 'contentWidthMm', 'barcodeWidthMm');
    }
}
