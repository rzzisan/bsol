{{-- Default generic thermal label — used whenever no other template applies. --}}
@php($order = $label['order'])
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
    <div class="muted i18n">{{ \Illuminate\Support\Str::limit($label['shopAddress'], $pageWidthMm == 58 ? 60 : 90) }}</div>
  @endif

  <div class="rule"></div>

  <div class="section-label">ORDER</div>
  <div class="order-line">{{ $order->order_number }} &middot; {{ $label['itemCount'] }} item(s)</div>
  @if($label['itemsSummary'])
    <div class="muted i18n footer-note">{{ \Illuminate\Support\Str::limit($label['itemsSummary'], $pageWidthMm == 58 ? 60 : 90) }}</div>
  @endif

  @if($label['notes'])
    <div class="rule"></div>
    <div class="section-label">NOTE</div>
    <div class="muted i18n">{{ \Illuminate\Support\Str::limit($label['notes'], $pageWidthMm == 58 ? 60 : 90) }}</div>
  @endif

  <div class="rule"></div>

  {{-- inline-block pair, not a right-aligned table cell — see the
       .qr-text/.qr comment in the master stylesheet. --}}
  <div class="qr-text">
    <div class="section-label">SCAN FOR DETAILS</div>
    <div class="muted">Order · Tracking · COD · Phone</div>
  </div>
  <img class="qr" src="{{ $label['qr'] }}">
</div>
