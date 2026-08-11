{{-- Compact invoice-style label — reference "RetailBD"/"EcomDrive" family (75x50mm). --}}
@php($order = $label['order'])
<div class="it-label {{ $loop->last ? '' : 'label-break' }}">
  <table class="it-table">
    <tr>
      <td class="it-shop i18n">{{ $label['shopName'] }}</td>
      <td class="it-meta">Date: {{ $label['dateShort'] }}<br>IV No: {{ $order->order_number }}</td>
    </tr>
  </table>

  <div class="it-rule"></div>

  <table class="it-table">
    <tr>
      <td>
        Courier: {{ $order->courier_name ?? 'MANUAL' }}<br>
        <span class="it-bold i18n">{{ $label['customerName'] }}</span><br>
        {{ $order->customer_phone }}<br>
        <span class="it-muted i18n">{{ $label['address'] }}</span>
      </td>
      <td class="it-barcode-cell">
        @if($label['barcode'])<img class="it-barcode" src="{{ $label['barcode'] }}">@endif
      </td>
    </tr>
  </table>

  <div class="it-parcel">Parcel ID: {{ $order->courier_tracking_id ?? '—' }}</div>

  <div class="it-rule"></div>

  <table class="it-table it-items">
    <tr class="it-items-head">
      <td style="width: {{ $g['nameColMm'] }}mm;">Product</td>
      <td style="width: {{ $g['qtyColMm'] }}mm;">Qty</td>
      <td style="width: {{ $g['priceColMm'] }}mm;">Price</td>
      <td style="width: {{ $g['totalColMm'] }}mm;">Total</td>
    </tr>
    @foreach($label['itemRows'] as $row)
      <tr>
        <td style="width: {{ $g['nameColMm'] }}mm;" class="i18n">{{ $row['name'] }}</td>
        <td style="width: {{ $g['qtyColMm'] }}mm;">{{ $row['qty'] }}</td>
        <td style="width: {{ $g['priceColMm'] }}mm;">{{ number_format($row['price'], 0) }}</td>
        <td style="width: {{ $g['totalColMm'] }}mm;">{{ number_format($row['total'], 0) }}</td>
      </tr>
    @endforeach
  </table>

  <div class="it-rule"></div>

  <div class="it-totals">
    Sub Total: {{ number_format($label['subtotal'], 0) }}
    &nbsp;&nbsp; Delivery: {{ number_format($label['shippingCharge'], 0) }}
  </div>
  <div class="it-due">Due Amount: {{ number_format($label['codAmount'], 0) }}</div>

  @if($label['notes'])
    <div class="it-note i18n">Note: {{ $label['notes'] }}</div>
  @endif
</div>
