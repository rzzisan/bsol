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
  {{-- Real-shaped image when available (proper conjunct ligatures — see
       courier_waybill_context.md §4.7), plain reordered text otherwise.
       Every *Img field is null on every template except 'classic' today. --}}
  @if($label['customerNameImg'])
    <img class="to-name-img" src="{{ $label['customerNameImg'] }}" style="width:{{ $label['customerNameImgW'] }}mm; height:{{ $label['customerNameImgH'] }}mm;">
  @else
    <div class="to-name i18n">{{ $label['customerName'] }}</div>
  @endif
  <div class="to-phone">{{ $order->customer_phone }}</div>
  @if($label['addressImg'])
    <img class="to-address-img" src="{{ $label['addressImg'] }}" style="width:{{ $label['addressImgW'] }}mm; height:{{ $label['addressImgH'] }}mm;">
  @else
    <div class="to-address muted i18n">{{ $label['address'] }}</div>
  @endif

  <div class="rule"></div>

  <div class="section-label">FROM (SENDER)</div>
  @if($label['fromLineImg'])
    <img class="from-line-img" src="{{ $label['fromLineImg'] }}" style="width:{{ $label['fromLineImgW'] }}mm; height:{{ $label['fromLineImgH'] }}mm;">
  @else
    <div class="from-line i18n">{{ $label['shopName'] }}@if($label['shopPhone']) &middot; {{ $label['shopPhone'] }}@endif</div>
  @endif
  @if($label['shopAddress'])
    @if($label['shopAddressImg'])
      <img class="muted-img" src="{{ $label['shopAddressImg'] }}" style="width:{{ $label['shopAddressImgW'] }}mm; height:{{ $label['shopAddressImgH'] }}mm;">
    @else
      <div class="muted i18n">{{ $label['shopAddress'] }}</div>
    @endif
  @endif

  <div class="rule"></div>

  <div class="section-label">ORDER</div>
  <div class="order-line">{{ $order->order_number }} &middot; {{ $label['itemCount'] }} item(s)</div>
  @if($label['itemsSummary'])
    @if($label['itemsSummaryImg'])
      <img class="muted-img footer-note" src="{{ $label['itemsSummaryImg'] }}" style="width:{{ $label['itemsSummaryImgW'] }}mm; height:{{ $label['itemsSummaryImgH'] }}mm;">
    @else
      <div class="muted i18n footer-note">{{ $label['itemsSummary'] }}</div>
    @endif
  @endif

  @if($label['notes'])
    <div class="rule"></div>
    <div class="section-label">NOTE</div>
    @if($label['notesImg'])
      <img class="muted-img" src="{{ $label['notesImg'] }}" style="width:{{ $label['notesImgW'] }}mm; height:{{ $label['notesImgH'] }}mm;">
    @else
      <div class="muted i18n">{{ $label['notes'] }}</div>
    @endif
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
