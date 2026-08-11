{{-- POS-bill style label — reference "Pos Sticker" (80mm width). --}}
@php($order = $label['order'])
<div class="pb-label {{ $loop->last ? '' : 'label-break' }}">
  <div class="pb-shop i18n">{{ $label['shopName'] }}</div>
  <div class="pb-subtitle">POS Machine Bill</div>

  <div class="pb-rule"></div>

  <table class="pb-table">
    <tr>
      <td class="i18n">ISSUED TO: {{ $label['customerName'] }}</td>
      <td class="pb-right-col">ORDER NO: {{ $order->order_number }}<br>DATE: {{ $label['dateShort'] }}</td>
    </tr>
  </table>

  <div class="pb-rule"></div>

  <table class="pb-table pb-items">
    <tr class="pb-items-head">
      <td style="width: {{ $g['nameColMm'] }}mm;">DESCRIPTION</td>
      <td style="width: {{ $g['priceColMm'] }}mm;">PRICE</td>
      <td style="width: {{ $g['qtyColMm'] }}mm;">QTY</td>
      <td style="width: {{ $g['totalColMm'] }}mm;">TOTAL</td>
    </tr>
    @foreach($label['itemRows'] as $row)
      <tr>
        <td style="width: {{ $g['nameColMm'] }}mm;" class="i18n">{{ $row['name'] }}</td>
        <td style="width: {{ $g['priceColMm'] }}mm;">{{ number_format($row['price'], 0) }}</td>
        <td style="width: {{ $g['qtyColMm'] }}mm;">{{ $row['qty'] }}</td>
        <td style="width: {{ $g['totalColMm'] }}mm;">{{ number_format($row['total'], 0) }}</td>
      </tr>
    @endforeach
  </table>

  <div class="pb-subtotal">SUBTOTAL: {{ number_format($label['subtotal'], 0) }}</div>
  <div class="pb-total-band">TOTAL: {{ number_format($label['codAmount'], 0) }}</div>

  <table class="pb-table">
    <tr>
      <td class="i18n">SELLER: {{ $label['shopName'] }}</td>
      <td class="pb-right-col">THANK YOU</td>
    </tr>
  </table>

  @if($label['barcode'])
    <img class="pb-barcode" src="{{ $label['barcode'] }}">
  @endif
  <div class="pb-tracking">{{ $order->courier_tracking_id ?? '—' }}</div>
</div>
