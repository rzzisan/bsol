{{-- Huge merchant/phone, plain product list, no barcode — reference "Sticker 19" (45x35mm). --}}
@php($order = $label['order'])
<div class="ml-label {{ $loop->last ? '' : 'label-break' }}">
  @if($label['shopNameImg'])
    <img src="{{ $label['shopNameImg'] }}" style="display:block; width:{{ $label['shopNameImgW'] }}mm; height:{{ $label['shopNameImgH'] }}mm;">
  @else
    <div class="ml-shop i18n">{{ $label['shopName'] }}</div>
  @endif
  <div class="ml-phone">{{ $order->customer_phone }}</div>

  @foreach($label['itemRows'] as $row)
    <div class="ml-item i18n">
      @if($row['nameImg'])
        <img src="{{ $row['nameImg'] }}" style="vertical-align:text-bottom; width:{{ $row['nameImgW'] }}mm; height:{{ $row['nameImgH'] }}mm;">
      @else
        {{ $row['name'] }}
      @endif
      x{{ $row['qty'] }}
    </div>
  @endforeach

  <div class="ml-parcel">Parcel ID: {{ $order->courier_tracking_id ?? '—' }}</div>
</div>
