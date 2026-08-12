{{-- Plain retail-style compact receipt — reference "Sticker 10/11" (3in width). --}}
@php($order = $label['order'])
<div class="rtc-label {{ $loop->last ? '' : 'label-break' }}">
  <table class="rtc-table">
    <tr>
      <td style="width: {{ $g['infoColMm'] }}mm;">
        Courier: {{ $order->courier_name ?? 'MANUAL' }}<br>
        <span class="rtc-bold i18n">{{ $label['customerName'] }}</span><br>
        {{ $order->customer_phone }}
      </td>
      <td style="width: {{ $g['barcodeColMm'] }}mm;">
        @if($label['barcode'])<img class="rtc-barcode" src="{{ $label['barcode'] }}">@endif
      </td>
    </tr>
  </table>

  <div class="rtc-muted i18n">{{ $label['address'] }}</div>
  <div class="rtc-parcel">Parcel ID: {{ $order->courier_tracking_id ?? '—' }}</div>

  <div class="rtc-rule"></div>

  <table class="rtc-table rtc-items">
    <tr class="rtc-items-head">
      <td style="width: {{ $g['ptNameColMm'] }}mm;">Product</td>
      <td style="width: {{ $g['ptQtyColMm'] }}mm;">Qty</td>
      <td style="width: {{ $g['ptPriceColMm'] }}mm;">Price</td>
      <td style="width: {{ $g['ptTotalColMm'] }}mm;">Total</td>
    </tr>
    @foreach($label['itemRows'] as $row)
      <tr>
        <td style="width: {{ $g['ptNameColMm'] }}mm;" class="i18n">{{ $row['name'] }}</td>
        <td style="width: {{ $g['ptQtyColMm'] }}mm;">{{ $row['qty'] }}</td>
        <td style="width: {{ $g['ptPriceColMm'] }}mm;">{{ number_format($row['price'], 0) }}</td>
        <td style="width: {{ $g['ptTotalColMm'] }}mm;">{{ number_format($row['total'], 0) }}</td>
      </tr>
    @endforeach
  </table>

  <div class="rtc-rule"></div>

  <div class="rtc-totals">Sub Total: {{ number_format($label['subtotal'], 0) }}</div>
  <div class="rtc-due">Due Amount: {{ number_format($label['codAmount'], 0) }}</div>

  @if($label['notes'])
    <div class="rtc-rule"></div>
    <div class="rtc-note-label">Shipping Note:</div>
    <div class="i18n">{{ $label['notes'] }}</div>
  @endif
</div>
