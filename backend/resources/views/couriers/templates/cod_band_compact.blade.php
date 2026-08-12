{{-- Compact COD-band label — reference "Sticker 1" (2x3in). --}}
@php($order = $label['order'])
<div class="cbc-label {{ $loop->last ? '' : 'label-break' }}">
  <div class="cbc-banner i18n">{{ $order->courier_name ?? 'MANUAL' }}</div>
  <div class="cbc-id">ID - {{ $order->courier_tracking_id ?? '—' }}</div>
  @if($label['customerNameImg'])
    <img src="{{ $label['customerNameImg'] }}" style="display:block; margin:0 auto; width:{{ $label['customerNameImgW'] }}mm; height:{{ $label['customerNameImgH'] }}mm;"><br>
  @else
    <div class="cbc-name i18n">{{ $label['customerName'] }}</div>
  @endif
  <div class="cbc-phone">{{ $order->customer_phone }}</div>
  <div class="cbc-cod">COD - {{ number_format($label['codAmount'], 2) }}</div>
  @if($label['skuSummary'])
    <div class="cbc-products i18n">Products: {{ $label['skuSummary'] }}</div>
  @endif
  @if($label['notes'])
    @if($label['notesImg'])
      <div class="cbc-note">Note -</div>
      <img src="{{ $label['notesImg'] }}" style="display:block; margin:1mm auto 0; width:{{ $label['notesImgW'] }}mm; height:{{ $label['notesImgH'] }}mm;">
    @else
      <div class="cbc-note i18n">Note - {{ $label['notes'] }}</div>
    @endif
  @endif
  @if($label['barcode'])
    <img class="cbc-barcode" src="{{ $label['barcode'] }}">
  @endif
  <div class="cbc-tracking">{{ $order->courier_tracking_id ?? '—' }}</div>
</div>
