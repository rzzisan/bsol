{{-- Bold phone + SKU-only rows (no product name/price) — reference "Sticker 14" (3x4in). --}}
@php($order = $label['order'])
<div class="srb-label {{ $loop->last ? '' : 'label-break' }}">
  <table class="srb-table">
    <tr>
      <td style="width: {{ $g['infoColMm'] }}mm;">
        Courier: {{ $order->courier_name ?? 'MANUAL' }}<br>
        @if($label['customerNameImg'])
          <img src="{{ $label['customerNameImg'] }}" style="display:block; width:{{ $label['customerNameImgW'] }}mm; height:{{ $label['customerNameImgH'] }}mm;"><br>
        @else
          <span class="srb-name i18n">{{ $label['customerName'] }}</span><br>
        @endif
        <span class="srb-phone">{{ $order->customer_phone }}</span>
      </td>
      <td style="width: {{ $g['barcodeColMm'] }}mm;">
        @if($label['barcode'])<img class="srb-barcode" src="{{ $label['barcode'] }}">@endif
      </td>
    </tr>
  </table>

  @if($label['addressImg'])
    <img src="{{ $label['addressImg'] }}" style="display:block; width:{{ $label['addressImgW'] }}mm; height:{{ $label['addressImgH'] }}mm;">
  @else
    <div class="srb-muted i18n">{{ $label['address'] }}</div>
  @endif
  <div class="srb-parcel">Parcel ID: {{ $order->courier_tracking_id ?? '—' }}</div>

  <div class="srb-rule"></div>

  <table class="srb-table srb-items">
    <tr class="srb-items-head">
      <td style="width: {{ $g['skuColMm'] }}mm;">SKU</td>
      <td style="width: {{ $g['qtyColMm'] }}mm;">Qty</td>
    </tr>
    @foreach($label['itemRows'] as $row)
      <tr>
        <td style="width: {{ $g['skuColMm'] }}mm;">
          @if($row['skuImg'])
            <img src="{{ $row['skuImg'] }}" style="display:block; width:{{ $row['skuImgW'] }}mm; height:{{ $row['skuImgH'] }}mm;">
          @else
            <span class="i18n">{{ $row['sku'] }}</span>
          @endif
        </td>
        <td style="width: {{ $g['qtyColMm'] }}mm;">{{ $row['qty'] }}</td>
      </tr>
    @endforeach
  </table>

  <div class="srb-rule"></div>

  <div class="srb-due">Due Amount: {{ number_format($label['codAmount'], 0) }}</div>
</div>
