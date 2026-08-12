{{-- Black ৳ COD band + bold RECIPIENT block + PRODUCT/barcode — reference "Sticker 21" (50x75mm). --}}
@php($order = $label['order'])
<div class="qrf-label {{ $loop->last ? '' : 'label-break' }}">
  @if($label['shopNameImg'])
    <img src="{{ $label['shopNameImg'] }}" style="display:block; width:{{ $label['shopNameImgW'] }}mm; height:{{ $label['shopNameImgH'] }}mm;">
  @else
    <div class="qrf-shop i18n">{{ $label['shopName'] }}</div>
  @endif

  {{-- Plain "Tk" not ৳ — DejaVu Sans has no ৳ glyph and mixing in the
       Bengali webfont for just this symbol caused an unresolved
       character-drop bug elsewhere (courier_waybill_context.md §4.6). --}}
  <div class="qrf-cod-band">Tk {{ number_format($label['codAmount'], 0) }}</div>

  <div class="qrf-section">RECIPIENT</div>
  @if($label['customerNameImg'])
    <img src="{{ $label['customerNameImg'] }}" style="display:block; width:{{ $label['customerNameImgW'] }}mm; height:{{ $label['customerNameImgH'] }}mm;">
  @else
    <div class="qrf-name i18n">{{ $label['customerName'] }}</div>
  @endif
  <div>{{ $order->customer_phone }}</div>
  @if($label['addressImg'])
    <img src="{{ $label['addressImg'] }}" style="display:block; width:{{ $label['addressImgW'] }}mm; height:{{ $label['addressImgH'] }}mm;">
  @else
    <div class="qrf-muted i18n">{{ $label['address'] }}</div>
  @endif

  <div class="qrf-section">PRODUCT</div>
  @if($label['itemsSummaryImg'])
    <img src="{{ $label['itemsSummaryImg'] }}" style="display:block; width:{{ $label['itemsSummaryImgW'] }}mm; height:{{ $label['itemsSummaryImgH'] }}mm;">
  @else
    <div class="qrf-muted i18n">{{ $label['itemsSummary'] }}</div>
  @endif

  @if($label['barcode'])
    <img class="qrf-barcode" src="{{ $label['barcode'] }}">
  @endif
  <div class="qrf-tracking">{{ $order->courier_tracking_id ?? '—' }}</div>
</div>
