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
    private const DEJAVU_REGULAR = 'vendor/dompdf/dompdf/lib/fonts/DejaVuSans.ttf';
    private const DEJAVU_BOLD    = 'vendor/dompdf/dompdf/lib/fonts/DejaVuSans-Bold.ttf';

    public function __construct(private readonly BengaliShapingService $bengaliShaper) {}

    private function fontRegular(): string
    {
        return 'file://' . storage_path('fonts/NotoSansBengali-Regular.ttf');
    }

    private function fontBold(): string
    {
        return 'file://' . storage_path('fonts/NotoSansBengali-Bold.ttf');
    }

    private function fontRegularPath(): string
    {
        return storage_path('fonts/NotoSansBengali-Regular.ttf');
    }

    private function fontBoldPath(): string
    {
        return storage_path('fonts/NotoSansBengali-Bold.ttf');
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
     * shop names and addresses. Kept ONLY as the plain-text fallback now
     * (see queueShapingJob() below) — never fed to the real shaper, which
     * needs the original un-reordered text (courier_waybill_context.md §4.7).
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

    private function containsBengali(?string $text): bool
    {
        return $text !== null && $text !== '' && preg_match('/\p{Bengali}/u', $text) === 1;
    }

    /**
     * Queues a real HarfBuzz-shaping job for $text (courier_waybill_context.md
     * §4.7) if it contains Bengali, returning the job id — or null if
     * there's nothing to shape (caller falls back to the plain
     * reorderBengaliMatras() text, unchanged behavior). $maxWidthMm null
     * means single-line/no-wrap.
     */
    private function queueShapingJob(
        array &$jobs,
        string $id,
        ?string $text,
        float $fontSizePx,
        bool $bold,
        ?float $maxWidthMm = null,
        string $color = '#1a2233'
    ): ?string {
        if (! $this->containsBengali($text)) {
            return null;
        }

        $jobs[$id] = [
            'text' => $text,
            'fontPath' => $bold ? $this->fontBoldPath() : $this->fontRegularPath(),
            // NotoSansBengali has no Latin glyphs at all — mixed Bengali+
            // English fields (thana/district names are stored in English)
            // need a second font for the non-Bengali runs.
            'latinFontPath' => base_path($bold ? self::DEJAVU_BOLD : self::DEJAVU_REGULAR),
            'fontSizePx' => $fontSizePx,
            'maxWidthPx' => $maxWidthMm !== null ? BengaliShapingService::mmToPx($maxWidthMm) : 0,
            'color' => $color,
        ];

        return $id;
    }

    public function render(Order $order): PdfDocument
    {
        $order->loadMissing(['user', 'items']);
        $shop = $order->user?->shopOwner();
        $profile = $shop ? ShopProfile::where('user_id', $shop->id)->first() : null;

        // A4 body: 210mm - 2*(42px padding ≈ 14.82mm) ≈ 180mm content width.
        // See the header table's 55%/45% column split in the Blade for
        // where headerColMm comes from.
        $contentWidthMm = 180.0;
        $headerColMm = $contentWidthMm * 0.55;
        $descColMm = $contentWidthMm * 0.46;

        $jobs = [];

        $rawShopName  = $profile?->shop_name ?? $shop?->name ?? '—';
        $rawShopAddress = $profile?->address;
        $rawCustomerName = $order->customer_name ?: '—';
        $address = collect([$order->customer_address, $order->customer_area, $order->customer_thana, $order->customer_district])
            ->filter()->implode(', ');
        $rawAddress = $address !== '' ? $address : '—';
        $rawNotes = $order->notes;

        $shopNameJob     = $this->queueShapingJob($jobs, 'shopName', $rawShopName, 19, true, $headerColMm);
        $shopAddressJob  = $this->queueShapingJob($jobs, 'shopAddress', $rawShopAddress, 10, false, $headerColMm, '#657089');
        $customerNameJob = $this->queueShapingJob($jobs, 'customerName', $rawCustomerName, 14, true, $contentWidthMm);
        $addressJob      = $this->queueShapingJob($jobs, 'address', $rawAddress, 10.5, false, $contentWidthMm, '#657089');
        $notesJob        = $this->queueShapingJob($jobs, 'notes', $rawNotes, 10.5, false, $contentWidthMm - 10, '#1a2233');

        $items = $order->items->values()->map(function ($item, int $i) use (&$jobs, $descColMm) {
            $rawName = $item->product_name;
            $variant = $this->formatVariantRaw($item->variant_info);
            $sub = collect([$item->sku, $variant])->filter()->implode(' · ');

            $nameJob = $this->queueShapingJob($jobs, "item{$i}_name", $rawName, 11.5, false, $descColMm);
            $subJob  = $this->queueShapingJob($jobs, "item{$i}_sub", $sub !== '' ? $sub : null, 9.5, false, $descColMm, '#657089');

            return [
                'name'      => $this->reorderBengaliMatras($rawName),
                'nameJob'   => $nameJob,
                'sku'       => $item->sku,
                'variant'   => $variant !== null ? $this->reorderBengaliMatras($variant) : null,
                'sub'       => $sub !== '' ? $this->reorderBengaliMatras($sub) : null,
                'subJob'    => $subJob,
                'quantity'  => $item->quantity,
                'unitPrice' => (float) $item->unit_price,
                'total'     => (float) $item->total,
            ];
        });

        // One batched Node/HarfBuzz call for the whole invoice — see
        // BengaliShapingService's doc comment for why per-field spawning
        // would be too slow. Any job it couldn't handle just has no entry
        // here, and the *Img keys below stay null (Blade's plain-text
        // fallback, unchanged from before this feature existed).
        $shaped = $this->bengaliShaper->shapeBatch($jobs);
        $img = fn (?string $jobId) => $jobId !== null ? ($shaped[$jobId] ?? null) : null;

        $shopNameImg = $img($shopNameJob);
        $shopAddressImg = $img($shopAddressJob);
        $customerNameImg = $img($customerNameJob);
        $addressImg = $img($addressJob);
        $notesImg = $img($notesJob);

        $items = $items->map(function (array $item) use ($img) {
            $nameImg = $img($item['nameJob']);
            $subImg = $img($item['subJob']);
            unset($item['nameJob'], $item['subJob']);
            $item['nameImg'] = $nameImg;
            $item['subImg'] = $subImg;
            return $item;
        });

        return Pdf::loadView('invoices.order-invoice', [
            'order'        => $order,
            'items'        => $items,
            'shopName'     => $this->reorderBengaliMatras($rawShopName),
            'shopNameImg'  => $shopNameImg,
            'shopPhone'    => $profile?->phone ?? $shop?->mobile,
            'shopEmail'    => $profile?->email,
            'shopAddress'  => $rawShopAddress ? $this->reorderBengaliMatras($rawShopAddress) : null,
            'shopAddressImg' => $shopAddressImg,
            'logoUrl'      => $this->logoDataUri($profile?->logo_path),
            'customerName' => $this->reorderBengaliMatras($rawCustomerName),
            'customerNameImg' => $customerNameImg,
            'address'      => $this->reorderBengaliMatras($rawAddress),
            'addressImg'   => $addressImg,
            'notesImg'     => $notesImg,
            'notesText'    => $rawNotes ? $this->reorderBengaliMatras($rawNotes) : null,
            'fontRegular'  => $this->fontRegular(),
            'fontBold'     => $this->fontBold(),
        ])->setPaper('a4');
    }

    /**
     * variant_info is a flat {optionName: value} map (see order-item-grid.tsx),
     * e.g. {"Color": "Red", "Size": "XL"} -> "Color: Red · Size: XL".
     * Raw (un-reordered) — reordering happens only for the plain-text
     * fallback display, never before shaping (see queueShapingJob() doc).
     */
    private function formatVariantRaw(?array $variantInfo): ?string
    {
        if (empty($variantInfo)) {
            return null;
        }

        $pairs = collect($variantInfo)
            ->filter(fn ($v) => $v !== null && $v !== '')
            ->map(fn ($v, $k) => "{$k}: {$v}");

        return $pairs->isEmpty() ? null : $pairs->implode(' · ');
    }
}
