{{-- No barcode at all, standard payment-check disclaimer — reference "Sticker 5" (3x4in). --}}
@php($order = $label['order'])
<div class="snb-label {{ $loop->last ? '' : 'label-break' }}">
  <div class="snb-shop i18n">{{ $label['shopName'] }}</div>
  <div>Courier: {{ $order->courier_name ?? 'MANUAL' }} &nbsp; Invoice No: {{ $order->order_number }}</div>

  <div class="snb-rule"></div>

  <div class="snb-section">Invoice To:</div>
  <div class="snb-bold i18n">{{ $label['customerName'] }}</div>
  <div>{{ $order->customer_phone }}</div>
  <div class="snb-muted i18n">{{ $label['address'] }}</div>
  <div class="snb-parcel">Parcel ID: {{ $order->courier_tracking_id ?? '—' }}</div>

  <div class="snb-rule"></div>

  <table class="snb-table snb-items">
    <tr class="snb-items-head">
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

  <div class="snb-rule"></div>

  <div class="snb-totals">Sub Total: {{ number_format($label['subtotal'], 0) }} &nbsp;&nbsp; Delivery: {{ number_format($label['shippingCharge'], 0) }}</div>
  <div class="snb-due">Due Amount: {{ number_format($label['codAmount'], 0) }}</div>

  <div class="snb-note-box">Please check the parcel before payment</div>
  @if($label['notes'])
    <div class="snb-note-box i18n">{{ $label['notes'] }}</div>
  @endif
</div>
