{{-- Huge merchant/phone, plain product list, no barcode — reference "Sticker 19" (45x35mm). --}}
@php($order = $label['order'])
<div class="ml-label {{ $loop->last ? '' : 'label-break' }}">
  <div class="ml-shop i18n">{{ $label['shopName'] }}</div>
  <div class="ml-phone">{{ $order->customer_phone }}</div>

  @foreach($label['itemRows'] as $row)
    <div class="ml-item i18n">{{ $row['name'] }} x{{ $row['qty'] }}</div>
  @endforeach

  <div class="ml-parcel">Parcel ID: {{ $order->courier_tracking_id ?? '—' }}</div>
</div>
