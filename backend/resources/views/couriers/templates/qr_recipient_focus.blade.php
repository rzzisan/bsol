{{-- Black ৳ COD band + bold RECIPIENT block + PRODUCT/barcode — reference "Sticker 21" (50x75mm). --}}
@php($order = $label['order'])
<div class="qrf-label {{ $loop->last ? '' : 'label-break' }}">
  <div class="qrf-shop i18n">{{ $label['shopName'] }}</div>

  {{-- Plain "Tk" not ৳ — DejaVu Sans has no ৳ glyph and mixing in the
       Bengali webfont for just this symbol caused an unresolved
       character-drop bug elsewhere (courier_waybill_context.md §4.6). --}}
  <div class="qrf-cod-band">Tk {{ number_format($label['codAmount'], 0) }}</div>

  <div class="qrf-section">RECIPIENT</div>
  <div class="qrf-name i18n">{{ $label['customerName'] }}</div>
  <div>{{ $order->customer_phone }}</div>
  <div class="qrf-muted i18n">{{ $label['address'] }}</div>

  <div class="qrf-section">PRODUCT</div>
  <div class="qrf-muted i18n">{{ $label['itemsSummary'] }}</div>

  @if($label['barcode'])
    <img class="qrf-barcode" src="{{ $label['barcode'] }}">
  @endif
  <div class="qrf-tracking">{{ $order->courier_tracking_id ?? '—' }}</div>
</div>
