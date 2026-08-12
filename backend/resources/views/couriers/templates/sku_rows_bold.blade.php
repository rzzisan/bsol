{{-- Bold phone + SKU-only rows (no product name/price) — reference "Sticker 14" (3x4in). --}}
@php($order = $label['order'])
<div class="srb-label {{ $loop->last ? '' : 'label-break' }}">
  <table class="srb-table">
    <tr>
      <td style="width: {{ $g['infoColMm'] }}mm;">
        Courier: {{ $order->courier_name ?? 'MANUAL' }}<br>
        <span class="srb-name i18n">{{ $label['customerName'] }}</span><br>
        <span class="srb-phone">{{ $order->customer_phone }}</span>
      </td>
      <td style="width: {{ $g['barcodeColMm'] }}mm;">
        @if($label['barcode'])<img class="srb-barcode" src="{{ $label['barcode'] }}">@endif
      </td>
    </tr>
  </table>

  <div class="srb-muted i18n">{{ $label['address'] }}</div>
  <div class="srb-parcel">Parcel ID: {{ $order->courier_tracking_id ?? '—' }}</div>

  <div class="srb-rule"></div>

  <table class="srb-table srb-items">
    <tr class="srb-items-head">
      <td style="width: {{ $g['skuColMm'] }}mm;">SKU</td>
      <td style="width: {{ $g['qtyColMm'] }}mm;">Qty</td>
    </tr>
    @foreach($label['itemRows'] as $row)
      <tr>
        <td style="width: {{ $g['skuColMm'] }}mm;" class="i18n">{{ $row['sku'] }}</td>
        <td style="width: {{ $g['qtyColMm'] }}mm;">{{ $row['qty'] }}</td>
      </tr>
    @endforeach
  </table>

  <div class="srb-rule"></div>

  <div class="srb-due">Due Amount: {{ number_format($label['codAmount'], 0) }}</div>
</div>
