<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  {{-- dompdf only supports the CSS3 named-page selectors :first/:left/
       :right/:odd/:even — any other @page name is silently dropped (see
       Stylesheet::_parse_css), so a document can only have ONE physical
       page size. WaybillPdfService picks $pageWidthMm/$pageHeightMm to be
       Pathao's fixed size when every order in the batch is Pathao, or the
       classic thermal $widthMm/$heightMm otherwise — see its render()
       comment for how a Pathao label still fits when mixed into a
       thermal-sized batch. --}}
  @page { margin: 0; size: {{ $pageWidthMm }}mm {{ $pageHeightMm }}mm; }
  @font-face { font-family: 'AppFont'; src: url('{{ $fontRegular }}') format('truetype'); font-weight: normal; font-style: normal; }
  @font-face { font-family: 'AppFont'; src: url('{{ $fontBold }}') format('truetype'); font-weight: bold; font-style: normal; }
  * { font-family: 'DejaVu Sans', sans-serif; }
  .i18n { font-family: 'AppFont', 'DejaVu Sans', sans-serif; }
  body { margin: 0; padding: 0; color: #101418; font-size: {{ $widthMm === 58 ? '9px' : '10px' }}; line-height: 1.35; }
  .label {
    /* No explicit height: matching it to the @page height exactly causes
       dompdf to overflow onto a phantom blank page (sub-pixel rounding).
       The @page size already bounds each label to one physical label. */
    width: {{ $widthMm }}mm; box-sizing: border-box;
    padding: {{ $widthMm === 58 ? '2.5mm' : '3.5mm' }};
  }
  .label-break { page-break-after: always; }
  {{-- Layout follows the field hierarchy real BD courier labels use (per
       Steadfast/Pathao API + integration docs): barcode near the top for hub
       scanning, COD boxed and prominent (it's money to collect), recipient
       name/phone as the single largest text (what the delivery rider reads
       first) — sender/order metadata is secondary and compact. --}}
  .courier-banner {
    font-size: {{ $widthMm === 58 ? '13px' : '15px' }}; font-weight: bold; text-transform: uppercase;
    letter-spacing: 0.5px; text-align: center; padding-bottom: 2px;
  }
  .rule { border-top: 1px dashed #101418; margin: 3px 0; }
  .rule-solid { border-top: 1.5px solid #101418; margin: 3px 0; }
  .rule-heavy { border-top: 2.5px solid #101418; margin: 3px 0; }
  .cod-box {
    /* Plain block (not table/right-align) with a border for emphasis —
       text-align:center is untested against the dompdf right-align glyph-
       drop bug, so nothing here relies on it except this centered box,
       which is short/fixed content (never a variable-length trailing run
       the way the amount text itself is), kept deliberately safe by giving
       the amount line its own left-aligned block below the centered label.
       Border is 2px/solid (not 1.5px) — a thin border on this box printed
       with a broken/discontinuous left edge on a real thermal printer even
       though it rasterizes fully intact in every PDF-viewer/DPI test here;
       a bolder line survives print-head thresholding much more reliably. */
    border: 2px solid #101418; padding: {{ $widthMm === 58 ? '2mm 2mm' : '2.5mm 3mm' }}; margin-top: 3px;
    text-align: center;
  }
  .cod-label { font-size: {{ $widthMm === 58 ? '7px' : '8px' }}; letter-spacing: 1px; color: #4a5563; }
  .cod-amount { font-size: {{ $widthMm === 58 ? '20px' : '24px' }}; font-weight: bold; margin-top: 1px; }
  .muted { color: #4a5563; font-size: {{ $widthMm === 58 ? '7.5px' : '8.5px' }}; }
  .strong { font-weight: bold; }
  .section-label { font-size: {{ $widthMm === 58 ? '7px' : '8px' }}; color: #4a5563; text-transform: uppercase; letter-spacing: 0.5px; }
  .to-name { font-size: {{ $widthMm === 58 ? '17px' : '20px' }}; font-weight: bold; margin-top: 1px; }
  .to-phone { font-size: {{ $widthMm === 58 ? '15px' : '17px' }}; font-weight: bold; }
  .to-address { font-size: {{ $widthMm === 58 ? '9px' : '10px' }}; margin-top: 1px; }
  .from-line { font-size: {{ $widthMm === 58 ? '9px' : '10px' }}; }
  .order-line { font-size: {{ $widthMm === 58 ? '9px' : '10px' }}; font-weight: bold; }
  .tracking { font-size: {{ $widthMm === 58 ? '12px' : '14px' }}; font-weight: bold; letter-spacing: 0.5px; word-break: break-all; }
  .footer-note { margin-top: 2px; }
  {{-- Fixed mm widths, not width:100%/right-aligned — percentage-width
       images weren't reliably contained by dompdf here and bled past the
       printable edge with no right margin on real thermal printers. --}}
  .barcode { display: block; width: {{ $barcodeWidthMm }}mm; height: {{ $widthMm === 58 ? '11mm' : '13mm' }}; margin-top: 2px; }
  {{-- Side-by-side via inline-block's default left-to-right flow — not
       float/text-align:right, which hit the same dompdf bug above.
       Widths are capped (qrTextWidthMm + qrSizeMm + gap <= content width)
       so the pair can never collide or overflow. vertical-align:top (not
       middle) keeps the QR anchored at the same start line as the text
       instead of bleeding upward into whatever sits above it. --}}
  .qr-text { display: inline-block; width: {{ $qrTextWidthMm }}mm; vertical-align: top; }
  .qr { display: inline-block; width: {{ $qrSizeMm }}mm; height: {{ $qrSizeMm }}mm; vertical-align: top; }

  {{-- ── Pathao-specific layout ────────────────────────────────────────────
       Mirrors the sticker Pathao's own dashboard generates (see
       courier_waybill_context.md §5.1 for the reference screenshot and
       which fields were deliberately left off because we have no reliable
       source for them, e.g. Sort/Route, which are only assigned once
       Pathao actually processes the parcel). All cell/image mm sizes are
       precomputed in WaybillPdfService as a fraction of $pageWidthMm /
       $pageHeightMm (not hardcoded) so this still fits without overflowing
       when a Pathao label ends up sharing a thermal-sized document with
       non-Pathao labels — see the @page comment above. --}}
  .label-pathao {
    width: {{ $pageWidthMm }}mm; box-sizing: border-box; padding: {{ $pathaoPaddingMm }}mm;
    font-size: 8px; line-height: 1.4;
  }
  .p-rule { border-top: 1px solid #cbd2d9; margin: 2px 0; }
  .p-logo { font-size: 15px; font-weight: bold; color: #d4145a; letter-spacing: 0.5px; }
  .p-muted { color: #4a5563; }
  .p-bold { font-weight: bold; }
  .p-type { font-size: 8px; font-weight: bold; }
  .p-to-name { font-size: 11px; font-weight: bold; }
  .p-collect { font-size: 10px; font-weight: bold; }
  .p-tracking { font-size: 9px; font-weight: bold; letter-spacing: 0.5px; word-break: break-all; margin: 1px 0; }
  {{-- Explicit mm widths on the images, same reasoning as .barcode/.qr above. --}}
  .p-barcode { display: block; width: {{ $pathaoBarcodeWidthMm }}mm; height: {{ $pathaoBarcodeHeightMm }}mm; }
  .p-qr { display: block; width: {{ $pathaoQrImgMm }}mm; height: {{ $pathaoQrImgMm }}mm; }
  {{-- Explicit mm width, not 100% — a percentage width here resolved
       against the wrong containing block (ignoring .label-pathao's own
       padding) and let the table bleed to the page's right edge with
       ~0 margin, same family of box-model quirk as the barcode/QR <img>
       percentage-width bug noted above. --}}
  .p-table { width: {{ $pathaoContentWidthMm }}mm; border-collapse: collapse; }
  .p-table td { vertical-align: top; padding: 0; }
</style>
</head>
<body>
  @foreach($labels as $label)
    @php($order = $label['order'])
    @if($label['isPathao'])
      {{-- ── Pathao design ── --}}
      <div class="label-pathao {{ $loop->last ? '' : 'label-break' }}">
        <table class="p-table">
          <tr>
            <td style="width: {{ $pathaoLogoColMm }}mm;"><div class="p-logo">PATHAO</div></td>
            <td style="width: {{ $pathaoHeaderTextColMm }}mm;">
              Shipped From: <span class="p-bold i18n">{{ $label['shopName'] }}</span><br>
              <span class="p-muted i18n">{{ $label['shopName'] }}@if($label['cityName']) - {{ $label['cityName'] }}@endif</span><br>
              @if($label['shopPhone'])<span class="p-muted">Contact: {{ $label['shopPhone'] }}</span>@endif
            </td>
          </tr>
        </table>

        <div class="p-rule"></div>

        <table class="p-table">
          <tr>
            <td style="width: {{ $pathaoTypeColMm }}mm;"><div class="p-type">Regular</div></td>
            <td style="width: {{ $pathaoMidTextColMm }}mm;">
              Shipped To: <span class="p-to-name i18n">{{ $label['customerName'] }}</span><br>
              Phone: {{ $order->customer_phone }}<br>
              Secondary Phone: N/A<br>
              @if($label['address'] !== '—')
                Address: <span class="i18n">{{ $label['address'] }}</span>
              @endif
            </td>
            <td style="width: {{ $pathaoQrMm }}mm;"><img class="p-qr" src="{{ $label['qr'] }}"></td>
          </tr>
        </table>

        <div class="p-rule"></div>

        <table class="p-table">
          <tr>
            <td style="width: {{ $pathaoBottomLeftColMm }}mm;">
              Weight: {{ number_format($label['weightKg'], 2) }} Kg<br>
              Merchant Order Id: {{ $order->order_number }}<br>
              <span class="p-collect">Collectable Amount: BDT {{ number_format($label['codAmount'], 2) }}</span>
            </td>
            <td style="width: {{ $pathaoBottomRightColMm }}mm;">
              @if($label['barcode'])<img class="p-barcode" src="{{ $label['barcode'] }}">@endif
              <div class="p-tracking">{{ $order->courier_tracking_id ?? '—' }}</div>
              @if($label['bookedAt'])Order Date: {{ $label['bookedAt'] }}<br>@endif
              @if($label['cityName'])Target Hub: {{ $label['cityName'] }}<br>@endif
              @if($label['zoneName'])Zone: {{ $label['zoneName'] }}<br>@endif
              @if($label['areaName'])Area: {{ $label['areaName'] }}@endif
            </td>
          </tr>
        </table>
      </div>
    @else
      {{-- ── Default design (any courier without its own layout) ── --}}
      <div class="label {{ $loop->last ? '' : 'label-break' }}">
        <div class="courier-banner">{{ $order->courier_name ?? 'MANUAL' }}</div>
        <div class="cod-box">
          <div class="cod-label">CASH ON DELIVERY</div>
          {{-- Plain "Tk" (not the AppFont-only ৳ glyph) — mixing the Bengali
               webfont into this line triggered a dompdf glyph-drop bug on some
               amounts (e.g. 1,120 rendered as 1,12). Keeping it in the
               built-in DejaVu Sans font avoids it. --}}
          <div class="cod-amount">Tk {{ number_format($label['codAmount'], 0) }}</div>
        </div>

        <div class="rule-heavy"></div>

        <div class="section-label">TRACKING ID</div>
        <div class="tracking">{{ $order->courier_tracking_id ?? '—' }}</div>
        @if($label['barcode'])
          <img class="barcode" src="{{ $label['barcode'] }}">
        @endif

        <div class="rule-heavy"></div>

        <div class="section-label">TO (RECEIVER)</div>
        <div class="to-name i18n">{{ $label['customerName'] }}</div>
        <div class="to-phone">{{ $order->customer_phone }}</div>
        <div class="to-address muted i18n">{{ $label['address'] }}</div>

        <div class="rule"></div>

        <div class="section-label">FROM (SENDER)</div>
        <div class="from-line i18n">{{ $label['shopName'] }}@if($label['shopPhone']) &middot; {{ $label['shopPhone'] }}@endif</div>
        @if($label['shopAddress'])
          <div class="muted i18n">{{ \Illuminate\Support\Str::limit($label['shopAddress'], $widthMm === 58 ? 60 : 90) }}</div>
        @endif

        <div class="rule"></div>

        <div class="section-label">ORDER</div>
        <div class="order-line">{{ $order->order_number }} &middot; {{ $label['itemCount'] }} item(s)</div>
        @if($label['itemsSummary'])
          <div class="muted i18n footer-note">{{ \Illuminate\Support\Str::limit($label['itemsSummary'], $widthMm === 58 ? 60 : 90) }}</div>
        @endif

        @if($label['notes'])
          <div class="rule"></div>
          <div class="section-label">NOTE</div>
          <div class="muted i18n">{{ \Illuminate\Support\Str::limit($label['notes'], $widthMm === 58 ? 60 : 90) }}</div>
        @endif

        <div class="rule"></div>

        {{-- inline-block pair, not a right-aligned table cell — see the
             .qr-text/.qr comment above. --}}
        <div class="qr-text">
          <div class="section-label">SCAN FOR DETAILS</div>
          <div class="muted">Order · Tracking · COD · Phone</div>
        </div>
        <img class="qr" src="{{ $label['qr'] }}">
      </div>
    @endif
  @endforeach
</body>
</html>
