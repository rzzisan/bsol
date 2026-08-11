<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { margin: 0; size: {{ $widthMm }}mm {{ $heightMm }}mm; }
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
</style>
</head>
<body>
  @foreach($labels as $label)
    @php($order = $label['order'])
    <div class="label {{ $loop->last ? '' : 'label-break' }}">
      <div class="courier-banner">{{ $order->courier_name ?? 'MANUAL' }}</div>
      <div class="cod-box">
        <div class="cod-label">CASH ON DELIVERY</div>
        {{-- Plain "Tk" (not the AppFont-only ৳ glyph) — mixing the Bengali
             webfont into this line triggered a dompdf glyph-drop bug on some
             amounts (e.g. 1,120 rendered as 1,12). Keeping it in the
             built-in DejaVu Sans font avoids it. --}}
        <div class="cod-amount">Tk {{ number_format((float) $order->total, 0) }}</div>
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
      <div class="from-line i18n">{{ $label['shopName'] }} &middot; {{ $label['shopPhone'] }}</div>
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
  @endforeach
</body>
</html>
