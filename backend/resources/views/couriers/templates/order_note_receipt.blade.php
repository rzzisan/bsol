{{-- Receipt with a black Parcel ID box + Order Note — reference "Sticker 4" (3x4in). --}}
@php($order = $label['order'])
<div class="onr-label {{ $loop->last ? '' : 'label-break' }}">
  <table class="onr-table">
    <tr>
      <td style="width: {{ $g['headerLeftColMm'] }}mm;">Hotline: {{ $label['shopPhone'] ?? '—' }}<br>Date: {{ $label['dateShort'] }}</td>
      <td style="width: {{ $g['parcelBoxColMm'] }}mm;">
        <div class="onr-parcel-box">
          <div class="onr-parcel-label">PARCEL ID</div>
          <div class="onr-parcel-value">{{ $order->courier_tracking_id ?? '—' }}</div>
        </div>
      </td>
    </tr>
  </table>

  <div class="onr-rule"></div>

  <div>Courier: {{ $order->courier_name ?? 'MANUAL' }}</div>
  <div class="onr-section">Invoice To:</div>
  <div class="onr-bold i18n">{{ $label['customerName'] }}</div>
  <div>{{ $order->customer_phone }}</div>
  <div class="onr-muted i18n">{{ $label['address'] }}</div>

  @if($label['barcode'])
    <img class="onr-barcode" src="{{ $label['barcode'] }}">
  @endif

  <div class="onr-rule"></div>

  <table class="onr-table onr-items">
    <tr class="onr-items-head">
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

  <div class="onr-rule"></div>

  <div class="onr-totals">Sub Total: {{ number_format($label['subtotal'], 0) }} &nbsp;&nbsp; Delivery: {{ number_format($label['shippingCharge'], 0) }}</div>
  <div class="onr-due">Due Amount: {{ number_format($label['codAmount'], 0) }}</div>

  @if($label['notes'])
    <div class="onr-note-box">
      <div class="onr-note-label">ORDER NOTE</div>
      <div class="i18n">{{ $label['notes'] }}</div>
    </div>
  @endif
</div>
