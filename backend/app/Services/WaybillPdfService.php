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
use Illuminate\Support\Facades\Storage;
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

    /**
     * Shop logo as a base64 data URI, same pattern as
     * OrderInvoicePdfService::logoDataUri() — dompdf's enable_remote is
     * false (SSRF prevention), so the https:// logo_url can't be fetched;
     * this reads the file straight off local disk instead. Only used by
     * templates that specifically want a logo (e.g. logo_invoice_compact) —
     * most templates ignore it (see courier_waybill_context.md §7 for why
     * a logo was originally left off every design, still true by default).
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
            'sku'   => $item->sku ?: Str::limit($item->product_name ?? '-', $nameLimit),
            'variant' => $this->formatVariant($item->variant_info),
            'qty'   => $item->quantity,
            'price' => (float) $item->unit_price,
            'total' => (float) $item->total,
        ])->all();
    }

    /**
     * variant_info is a flat {optionName: value} map (see order-item-grid.tsx),
     * e.g. {"Color": "Red", "Size": "XL"} -> "Color: Red · Size: XL" — same
     * shape/logic as OrderInvoicePdfService::formatVariant().
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

        $geometry = $this->geometryFor($effectiveKey, $pageWidthMm, $pageHeightMm);

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
                'shopLogo'     => $this->logoDataUri($profile?->logo_path),
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

    /** Dispatches to the right *Geometry() builder for a template key — shared by render() and renderPreview(). */
    private function geometryFor(string $key, float $pageWidthMm, float $pageHeightMm): array
    {
        return match ($key) {
            'pathao'                 => $this->pathaoGeometry($pageWidthMm, $pageHeightMm),
            'cod_band_compact'       => $this->codBandCompactGeometry($pageWidthMm, $pageHeightMm),
            'invoice_table'          => $this->invoiceTableGeometry($pageWidthMm, $pageHeightMm),
            'pos_bill'               => $this->posBillGeometry($pageWidthMm, $pageHeightMm),
            'mini_cod'               => $this->miniCodGeometry($pageWidthMm, $pageHeightMm),
            'product_table_receipt'  => $this->productTableReceiptGeometry($pageWidthMm, $pageHeightMm),
            'order_note_receipt'     => $this->orderNoteReceiptGeometry($pageWidthMm, $pageHeightMm),
            'retail_compact'         => $this->retailCompactGeometry($pageWidthMm, $pageHeightMm),
            'qr_cod_enlarged'        => $this->qrCodEnlargedGeometry($pageWidthMm, $pageHeightMm),
            'sku_rows_bold'          => $this->skuRowsBoldGeometry($pageWidthMm, $pageHeightMm),
            'shipping_note_no_barcode' => $this->shippingNoteNoBarcodeGeometry($pageWidthMm, $pageHeightMm),
            'logo_invoice_compact'   => $this->logoInvoiceCompactGeometry($pageWidthMm, $pageHeightMm),
            'bengali_shipping_note'  => $this->bengaliShippingNoteGeometry($pageWidthMm, $pageHeightMm),
            'sku_truncate_note'      => $this->skuTruncateNoteGeometry($pageWidthMm, $pageHeightMm),
            'dual_note_receipt'      => $this->dualNoteReceiptGeometry($pageWidthMm, $pageHeightMm),
            'sku_grid_square'        => $this->skuGridSquareGeometry($pageWidthMm, $pageHeightMm),
            'color_size_grid'        => $this->colorSizeGridGeometry($pageWidthMm, $pageHeightMm),
            'minimal_list'           => $this->minimalListGeometry($pageWidthMm, $pageHeightMm),
            'equals_price_band'      => $this->equalsPriceBandGeometry($pageWidthMm, $pageHeightMm),
            'qr_recipient_focus'     => $this->qrRecipientFocusGeometry($pageWidthMm, $pageHeightMm),
            'no_price_multipage'     => $this->noPriceMultipageGeometry($pageWidthMm, $pageHeightMm),
            default                  => $this->classicGeometry($pageWidthMm, $pageHeightMm),
        };
    }

    /**
     * A single-label PDF rendered with fixed sample/demo data, no DB
     * involved at all (not even a persisted Order) — used only to generate
     * the template gallery's preview thumbnails (StickerPreviewService).
     * Never used for a real print.
     */
    public function renderPreview(string $templateKey): PdfDocument
    {
        $catalog = config('sticker_templates', []);
        $template = $catalog[$templateKey] ?? $catalog['classic'];
        $pageWidthMm  = $template['widthMm']  ?? 80;
        $pageHeightMm = $template['heightMm'] ?? 150;
        $geometry = $this->geometryFor($templateKey, $pageWidthMm, $pageHeightMm);

        $order = new Order([
            'courier_name'         => 'Demo Courier',
            'customer_name'        => 'রহিম উদ্দিন',
            'customer_phone'       => '01700-000000',
            'order_number'         => 'DEMO-0001',
            'courier_tracking_id'  => 'DEMO1234567890',
        ]);

        $codAmount = 1250.0;
        $label = [
            'order'          => $order,
            'codAmount'      => $codAmount,
            'shopName'       => 'Demo Shop',
            'shopPhone'      => '01800-000000',
            'shopAddress'    => 'ঢাকা, বাংলাদেশ',
            'shopLogo'       => null,
            'customerName'   => 'রহিম উদ্দিন',
            'itemCount'      => 3,
            'itemsSummary'   => 'Demo Product A, Demo Product B',
            'skuSummary'     => '(DEMO-1)+(SAMP-2)',
            'itemRows'       => [
                ['name' => 'Demo Product A', 'sku' => 'DEMO-A1', 'variant' => 'Color: Black · Size: 56', 'qty' => 1, 'price' => 750.0, 'total' => 750.0],
                ['name' => 'Demo Product B', 'sku' => 'DEMO-B2', 'variant' => 'Color: Red · Size: 52', 'qty' => 2, 'price' => 250.0, 'total' => 500.0],
            ],
            'subtotal'       => 1250.0,
            'shippingCharge' => 100.0,
            'discount'       => 0.0,
            'address'        => 'বাড়ি ১২, রোড ৫, ধানমন্ডি, ঢাকা',
            'notes'          => 'Sample note for preview',
            'barcode'        => $this->barcodeDataUri('DEMO1234567890'),
            'qr'             => $this->qrDataUri($order, $codAmount),
            'weightKg'       => 0.5,
            'bookedAt'       => now()->format('Y-m-d h:i:s A'),
            'dateShort'      => now()->format('n/j/Y'),
            'cityName'       => 'Dhaka',
            'zoneName'       => 'Dhanmondi',
            'areaName'       => 'Road 5',
        ];

        return Pdf::loadView('couriers.waybill', [
            'labels'       => collect([$label]),
            'templateKey'  => $templateKey,
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

    /** Common product-table column split (name/qty/price/total), reused by several bigger templates. */
    private function productTableColumns(float $contentWidthMm): array
    {
        $ptQtyColMm = round($contentWidthMm * 0.12, 2);
        $ptPriceColMm = round($contentWidthMm * 0.22, 2);
        $ptTotalColMm = round($contentWidthMm * 0.22, 2);
        $ptNameColMm = round($contentWidthMm - $ptQtyColMm - $ptPriceColMm - $ptTotalColMm, 2);

        return compact('ptQtyColMm', 'ptPriceColMm', 'ptTotalColMm', 'ptNameColMm');
    }

    /** Geometry for 'product_table_receipt' (3x4in, reference "Sticker 2"). */
    private function productTableReceiptGeometry(float $pageWidthMm, float $pageHeightMm): array
    {
        $paddingMm = 4;
        $contentWidthMm = round($pageWidthMm - (2 * $paddingMm), 2);
        $dateColMm = round($contentWidthMm * 0.42, 2);
        $courierColMm = round($contentWidthMm - $dateColMm, 2);
        $barcodeColMm = round($contentWidthMm * 0.34, 2);
        $infoColMm = round($contentWidthMm - $barcodeColMm, 2);
        $barcodeWidthMm = round($barcodeColMm - 2, 2);
        $barcodeHeightMm = 12;

        return array_merge(compact(
            'paddingMm', 'contentWidthMm', 'dateColMm', 'courierColMm',
            'barcodeColMm', 'infoColMm', 'barcodeWidthMm', 'barcodeHeightMm'
        ), $this->productTableColumns($contentWidthMm));
    }

    /** Geometry for 'order_note_receipt' (3x4in, reference "Sticker 4"). */
    private function orderNoteReceiptGeometry(float $pageWidthMm, float $pageHeightMm): array
    {
        $paddingMm = 4;
        $contentWidthMm = round($pageWidthMm - (2 * $paddingMm), 2);
        $parcelBoxColMm = round($contentWidthMm * 0.38, 2);
        $headerLeftColMm = round($contentWidthMm - $parcelBoxColMm, 2);
        $barcodeWidthMm = round($contentWidthMm - 2, 2);
        $barcodeHeightMm = 12;

        return array_merge(compact(
            'paddingMm', 'contentWidthMm', 'parcelBoxColMm', 'headerLeftColMm', 'barcodeWidthMm', 'barcodeHeightMm'
        ), $this->productTableColumns($contentWidthMm));
    }

    /** Geometry for 'retail_compact' (3in width, reference "Sticker 10/11" family). */
    private function retailCompactGeometry(float $pageWidthMm, float $pageHeightMm): array
    {
        $paddingMm = 4;
        $contentWidthMm = round($pageWidthMm - (2 * $paddingMm), 2);
        $barcodeColMm = round($contentWidthMm * 0.34, 2);
        $infoColMm = round($contentWidthMm - $barcodeColMm, 2);
        $barcodeWidthMm = round($barcodeColMm - 2, 2);
        $barcodeHeightMm = 11;

        return array_merge(compact(
            'paddingMm', 'contentWidthMm', 'barcodeColMm', 'infoColMm', 'barcodeWidthMm', 'barcodeHeightMm'
        ), $this->productTableColumns($contentWidthMm));
    }

    /** Geometry for 'qr_cod_enlarged' (50x75mm portrait, reference "Sticker 12"). */
    private function qrCodEnlargedGeometry(float $pageWidthMm, float $pageHeightMm): array
    {
        $paddingMm = 2.5;
        $contentWidthMm = round($pageWidthMm - (2 * $paddingMm), 2);
        // Barcode sits inside a bordered box with its own small internal
        // padding — image width is the box's content width minus that.
        $barcodeBoxPaddingMm = 2;
        $barcodeWidthMm = round($contentWidthMm - (2 * $barcodeBoxPaddingMm), 2);
        $barcodeHeightMm = 14;

        return compact('paddingMm', 'contentWidthMm', 'barcodeBoxPaddingMm', 'barcodeWidthMm', 'barcodeHeightMm');
    }

    /** Geometry for 'sku_rows_bold' (3x4in, reference "Sticker 14"). */
    private function skuRowsBoldGeometry(float $pageWidthMm, float $pageHeightMm): array
    {
        $paddingMm = 4;
        $contentWidthMm = round($pageWidthMm - (2 * $paddingMm), 2);
        $barcodeColMm = round($contentWidthMm * 0.34, 2);
        $infoColMm = round($contentWidthMm - $barcodeColMm, 2);
        $barcodeWidthMm = round($barcodeColMm - 2, 2);
        $barcodeHeightMm = 11;
        $skuColMm = round($contentWidthMm * 0.70, 2);
        $qtyColMm = round($contentWidthMm - $skuColMm, 2);

        return compact(
            'paddingMm', 'contentWidthMm', 'barcodeColMm', 'infoColMm',
            'barcodeWidthMm', 'barcodeHeightMm', 'skuColMm', 'qtyColMm'
        );
    }

    /** Geometry for 'shipping_note_no_barcode' (3x4in, reference "Sticker 5" — deliberately no barcode). */
    private function shippingNoteNoBarcodeGeometry(float $pageWidthMm, float $pageHeightMm): array
    {
        $paddingMm = 4;
        $contentWidthMm = round($pageWidthMm - (2 * $paddingMm), 2);

        return array_merge(compact('paddingMm', 'contentWidthMm'), $this->productTableColumns($contentWidthMm));
    }

    /** Geometry for 'logo_invoice_compact' (75x50mm with shop logo, reference "Sticker 7"). */
    private function logoInvoiceCompactGeometry(float $pageWidthMm, float $pageHeightMm): array
    {
        $paddingMm = round($pageWidthMm * 0.035, 2);
        $contentWidthMm = round($pageWidthMm - (2 * $paddingMm), 2);
        $logoColMm = 12;
        $headerTextColMm = round($contentWidthMm - $logoColMm, 2);
        $barcodeColMm = round($contentWidthMm * 0.28, 2);
        $infoColMm = round($contentWidthMm - $barcodeColMm, 2);
        $barcodeWidthMm = round($barcodeColMm - 2, 2);
        $barcodeHeightMm = 8;

        return array_merge(compact(
            'paddingMm', 'contentWidthMm', 'logoColMm', 'headerTextColMm',
            'barcodeColMm', 'infoColMm', 'barcodeWidthMm', 'barcodeHeightMm'
        ), $this->productTableColumns($contentWidthMm));
    }

    /** Geometry for 'bengali_shipping_note' (75x50mm, name+qty only table, reference "Sticker 8"). */
    private function bengaliShippingNoteGeometry(float $pageWidthMm, float $pageHeightMm): array
    {
        $paddingMm = round($pageWidthMm * 0.04, 2);
        $contentWidthMm = round($pageWidthMm - (2 * $paddingMm), 2);
        $barcodeColMm = round($contentWidthMm * 0.30, 2);
        $infoColMm = round($contentWidthMm - $barcodeColMm, 2);
        $barcodeWidthMm = round($barcodeColMm - 2, 2);
        $barcodeHeightMm = 8;
        $bsnNameColMm = round($contentWidthMm * 0.75, 2);
        $bsnQtyColMm = round($contentWidthMm - $bsnNameColMm, 2);

        return compact(
            'paddingMm', 'contentWidthMm', 'barcodeColMm', 'infoColMm',
            'barcodeWidthMm', 'barcodeHeightMm', 'bsnNameColMm', 'bsnQtyColMm'
        );
    }

    /** Geometry for 'sku_truncate_note' (75x50mm, reference "Sticker 9"). */
    private function skuTruncateNoteGeometry(float $pageWidthMm, float $pageHeightMm): array
    {
        $paddingMm = round($pageWidthMm * 0.035, 2);
        $contentWidthMm = round($pageWidthMm - (2 * $paddingMm), 2);
        $barcodeColMm = round($contentWidthMm * 0.28, 2);
        $infoColMm = round($contentWidthMm - $barcodeColMm, 2);
        $barcodeWidthMm = round($barcodeColMm - 2, 2);
        $barcodeHeightMm = 8;

        return array_merge(compact(
            'paddingMm', 'contentWidthMm', 'barcodeColMm', 'infoColMm', 'barcodeWidthMm', 'barcodeHeightMm'
        ), $this->productTableColumns($contentWidthMm));
    }

    /** Geometry for 'dual_note_receipt' (3in width, logo + two note boxes, reference "Sticker 15"). */
    private function dualNoteReceiptGeometry(float $pageWidthMm, float $pageHeightMm): array
    {
        $paddingMm = 4;
        $contentWidthMm = round($pageWidthMm - (2 * $paddingMm), 2);
        $logoColMm = 14;
        $headerTextColMm = round($contentWidthMm - $logoColMm, 2);
        $barcodeColMm = round($contentWidthMm * 0.32, 2);
        $infoColMm = round($contentWidthMm - $barcodeColMm, 2);
        $barcodeWidthMm = round($barcodeColMm - 2, 2);
        $barcodeHeightMm = 11;

        return array_merge(compact(
            'paddingMm', 'contentWidthMm', 'logoColMm', 'headerTextColMm',
            'barcodeColMm', 'infoColMm', 'barcodeWidthMm', 'barcodeHeightMm'
        ), $this->productTableColumns($contentWidthMm));
    }

    /** Geometry for 'sku_grid_square' (3x3in, reference "Sticker 16"). */
    private function skuGridSquareGeometry(float $pageWidthMm, float $pageHeightMm): array
    {
        $paddingMm = 4;
        $contentWidthMm = round($pageWidthMm - (2 * $paddingMm), 2);
        $barcodeColMm = round($contentWidthMm * 0.32, 2);
        $infoColMm = round($contentWidthMm - $barcodeColMm, 2);
        $barcodeWidthMm = round($barcodeColMm - 2, 2);
        $barcodeHeightMm = 10;
        $skuColMm = round($contentWidthMm * 0.70, 2);
        $qtyColMm = round($contentWidthMm - $skuColMm, 2);

        return compact(
            'paddingMm', 'contentWidthMm', 'barcodeColMm', 'infoColMm',
            'barcodeWidthMm', 'barcodeHeightMm', 'skuColMm', 'qtyColMm'
        );
    }

    /** Geometry for 'color_size_grid' (3x4in, big Parcel ID box + variant info, reference "Sticker 18"). */
    private function colorSizeGridGeometry(float $pageWidthMm, float $pageHeightMm): array
    {
        $paddingMm = 4;
        $contentWidthMm = round($pageWidthMm - (2 * $paddingMm), 2);
        $parcelBoxColMm = round($contentWidthMm * 0.42, 2);
        $headerLeftColMm = round($contentWidthMm - $parcelBoxColMm, 2);
        $barcodeWidthMm = round($contentWidthMm - 2, 2);
        $barcodeHeightMm = 11;
        $csgNameColMm = round($contentWidthMm * 0.75, 2);
        $csgQtyColMm = round($contentWidthMm - $csgNameColMm, 2);

        return compact(
            'paddingMm', 'contentWidthMm', 'parcelBoxColMm', 'headerLeftColMm',
            'barcodeWidthMm', 'barcodeHeightMm', 'csgNameColMm', 'csgQtyColMm'
        );
    }

    /** Geometry for 'minimal_list' (45x35mm, reference "Sticker 19" — no barcode, huge merchant/phone). */
    private function minimalListGeometry(float $pageWidthMm, float $pageHeightMm): array
    {
        $paddingMm = 2;
        $contentWidthMm = round($pageWidthMm - (2 * $paddingMm), 2);

        return compact('paddingMm', 'contentWidthMm');
    }

    /** Geometry for 'equals_price_band' (3x4in, "790 x 1 = 790" line-total format, reference "Sticker 20"). */
    private function equalsPriceBandGeometry(float $pageWidthMm, float $pageHeightMm): array
    {
        $paddingMm = 4;
        $contentWidthMm = round($pageWidthMm - (2 * $paddingMm), 2);
        $barcodeColMm = round($contentWidthMm * 0.34, 2);
        $infoColMm = round($contentWidthMm - $barcodeColMm, 2);
        $barcodeWidthMm = round($barcodeColMm - 2, 2);
        $barcodeHeightMm = 11;
        $epbNameColMm = round($contentWidthMm * 0.55, 2);
        $epbQtyColMm = round($contentWidthMm * 0.15, 2);
        $epbTotalColMm = round($contentWidthMm - $epbNameColMm - $epbQtyColMm, 2);

        return compact(
            'paddingMm', 'contentWidthMm', 'barcodeColMm', 'infoColMm', 'barcodeWidthMm', 'barcodeHeightMm',
            'epbNameColMm', 'epbQtyColMm', 'epbTotalColMm'
        );
    }

    /** Geometry for 'qr_recipient_focus' (50x75mm, reference "Sticker 21"). */
    private function qrRecipientFocusGeometry(float $pageWidthMm, float $pageHeightMm): array
    {
        $paddingMm = 2.5;
        $contentWidthMm = round($pageWidthMm - (2 * $paddingMm), 2);
        $barcodeWidthMm = round($contentWidthMm - 2, 2);
        $barcodeHeightMm = 11;

        return compact('paddingMm', 'contentWidthMm', 'barcodeWidthMm', 'barcodeHeightMm');
    }

    /** Geometry for 'no_price_multipage' (75x50mm, name+qty only — no prices anywhere, reference "Sticker 22"). */
    private function noPriceMultipageGeometry(float $pageWidthMm, float $pageHeightMm): array
    {
        $paddingMm = round($pageWidthMm * 0.04, 2);
        $contentWidthMm = round($pageWidthMm - (2 * $paddingMm), 2);
        $barcodeColMm = round($contentWidthMm * 0.28, 2);
        $infoColMm = round($contentWidthMm - $barcodeColMm, 2);
        $barcodeWidthMm = round($barcodeColMm - 2, 2);
        $barcodeHeightMm = 8;
        $npmNameColMm = round($contentWidthMm * 0.75, 2);
        $npmQtyColMm = round($contentWidthMm - $npmNameColMm, 2);

        return compact(
            'paddingMm', 'contentWidthMm', 'barcodeColMm', 'infoColMm',
            'barcodeWidthMm', 'barcodeHeightMm', 'npmNameColMm', 'npmQtyColMm'
        );
    }
}
