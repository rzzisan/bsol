{{-- Compact COD-band label — reference "Sticker 1" (2x3in). --}}
@php($order = $label['order'])
<div class="cbc-label {{ $loop->last ? '' : 'label-break' }}">
  <div class="cbc-banner i18n">{{ $order->courier_name ?? 'MANUAL' }}</div>
  <div class="cbc-id">ID - {{ $order->courier_tracking_id ?? '—' }}</div>
  <div class="cbc-name i18n">{{ $label['customerName'] }}</div>
  <div class="cbc-phone">{{ $order->customer_phone }}</div>
  <div class="cbc-cod">COD - {{ number_format($label['codAmount'], 2) }}</div>
  @if($label['skuSummary'])
    <div class="cbc-products i18n">Products: {{ $label['skuSummary'] }}</div>
  @endif
  @if($label['notes'])
    <div class="cbc-note i18n">Note - {{ $label['notes'] }}</div>
  @endif
  @if($label['barcode'])
    <img class="cbc-barcode" src="{{ $label['barcode'] }}">
  @endif
  <div class="cbc-tracking">{{ $order->courier_tracking_id ?? '—' }}</div>
</div>
