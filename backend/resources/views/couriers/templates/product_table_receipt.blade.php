{{-- Product-table receipt — reference "Sticker 2" (3x4in). --}}
@php($order = $label['order'])
<div class="ptr-label {{ $loop->last ? '' : 'label-break' }}">
  <table class="ptr-table">
    <tr>
      <td style="width: {{ $g['courierColMm'] }}mm;" class="ptr-bold">{{ $order->courier_name ?? 'MANUAL' }}</td>
      <td style="width: {{ $g['dateColMm'] }}mm;" class="ptr-meta">Invoice No: {{ $order->order_number }}<br>Date: {{ $label['dateShort'] }}</td>
    </tr>
  </table>
  <div class="ptr-help">Help Line: {{ $label['shopPhone'] ?? '—' }}</div>

  <div class="ptr-rule"></div>

  <table class="ptr-table">
    <tr>
      <td style="width: {{ $g['infoColMm'] }}mm;">
        <div class="ptr-section">Invoice To:</div>
        <div class="ptr-bold i18n">{{ $label['customerName'] }}</div>
        <div>{{ $order->customer_phone }}</div>
        <div class="ptr-muted i18n">{{ $label['address'] }}</div>
      </td>
      <td style="width: {{ $g['barcodeColMm'] }}mm;">
        @if($label['barcode'])<img class="ptr-barcode" src="{{ $label['barcode'] }}">@endif
        <div class="ptr-tracking">{{ $order->courier_tracking_id ?? '—' }}</div>
      </td>
    </tr>
  </table>

  <div class="ptr-rule"></div>

  <table class="ptr-table ptr-items">
    <tr class="ptr-items-head">
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

  <div class="ptr-rule"></div>

  <div class="ptr-totals">Sub Total: {{ number_format($label['subtotal'], 0) }}</div>
  <div class="ptr-totals">Delivery Fee: {{ number_format($label['shippingCharge'], 0) }}</div>
  <div class="ptr-due">Due Amount: {{ number_format($label['codAmount'], 0) }}</div>
</div>
