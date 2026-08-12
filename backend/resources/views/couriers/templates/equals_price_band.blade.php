{{-- Black shop-name banner, "qty x price/=" line format, black COD band + Order Note — reference "Sticker 20" (3x4in). --}}
@php($order = $label['order'])
<div class="epb-label {{ $loop->last ? '' : 'label-break' }}">
  <div class="epb-banner i18n">{{ $label['shopName'] }}</div>

  <table class="epb-table">
    <tr>
      <td style="width: {{ $g['infoColMm'] }}mm;">
        <span class="epb-bold i18n">{{ $label['customerName'] }}</span><br>
        {{ $order->customer_phone }}<br>
        Parcel ID: {{ $order->courier_tracking_id ?? '—' }}
      </td>
      <td style="width: {{ $g['barcodeColMm'] }}mm;">
        @if($label['barcode'])<img class="epb-barcode" src="{{ $label['barcode'] }}">@endif
      </td>
    </tr>
  </table>

  <div class="epb-rule"></div>

  <table class="epb-table epb-items">
    <tr class="epb-items-head">
      <td style="width: {{ $g['epbNameColMm'] }}mm;">Product</td>
      <td style="width: {{ $g['epbQtyColMm'] }}mm;">Qty</td>
      <td style="width: {{ $g['epbTotalColMm'] }}mm;">Total</td>
    </tr>
    @foreach($label['itemRows'] as $row)
      <tr>
        <td style="width: {{ $g['epbNameColMm'] }}mm;" class="i18n">{{ $row['name'] }}</td>
        <td style="width: {{ $g['epbQtyColMm'] }}mm;">{{ $row['qty'] }}</td>
        <td style="width: {{ $g['epbTotalColMm'] }}mm;">{{ number_format($row['total'], 0) }}/=</td>
      </tr>
    @endforeach
  </table>

  <div class="epb-cod-band">COD - {{ number_format($label['codAmount'], 0) }}</div>

  @if($label['notes'])
    <div class="epb-note-box">
      <div class="epb-note-label">ORDER NOTE</div>
      <div class="i18n">{{ $label['notes'] }}</div>
    </div>
  @endif
</div>
