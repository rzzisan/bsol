{{-- Enlarged name/phone + boxed barcode + black COD band — reference "Sticker 12" (50x75mm). --}}
@php($order = $label['order'])
<div class="qce-label {{ $loop->last ? '' : 'label-break' }}">
  <div class="qce-shop i18n">{{ $label['shopName'] }}</div>

  <div class="qce-field-label">NAME</div>
  <div class="qce-field-value i18n">{{ $label['customerName'] }}</div>

  <div class="qce-field-label">PHONE</div>
  <div class="qce-field-value">{{ $order->customer_phone }}</div>

  <div class="qce-field-label">Courier:</div>
  <div class="qce-field-value-small">{{ $order->courier_name ?? 'MANUAL' }}</div>
  <div class="qce-field-label">Parcel ID:</div>
  <div class="qce-field-value-small">{{ $order->courier_tracking_id ?? '—' }}</div>

  <div class="qce-barcode-box">
    @if($label['barcode'])<img class="qce-barcode" src="{{ $label['barcode'] }}">@endif
    <div class="qce-barcode-caption">COURIER BARCODE</div>
  </div>

  <div class="qce-cod-band">COD - {{ number_format($label['codAmount'], 0) }}</div>
</div>
