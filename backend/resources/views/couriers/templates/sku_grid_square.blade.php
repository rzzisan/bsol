{{-- Square SKU grid + single note box — reference "Sticker 16" (3x3in). --}}
@php($order = $label['order'])
<div class="sgs-label {{ $loop->last ? '' : 'label-break' }}">
  <table class="sgs-table">
    <tr>
      <td style="width: {{ $g['infoColMm'] }}mm;">
        <div class="sgs-shop i18n">{{ $label['shopName'] }}</div>
        <span class="sgs-bold i18n">{{ $label['customerName'] }}</span><br>
        {{ $order->customer_phone }}
      </td>
      <td style="width: {{ $g['barcodeColMm'] }}mm;">
        @if($label['barcode'])<img class="sgs-barcode" src="{{ $label['barcode'] }}">@endif
      </td>
    </tr>
  </table>

  <div class="sgs-parcel">Parcel ID: {{ $order->courier_tracking_id ?? '—' }}</div>

  <div class="sgs-rule"></div>

  <table class="sgs-table sgs-items">
    <tr class="sgs-items-head">
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

  <div class="sgs-due">Due Amount: {{ number_format($label['codAmount'], 0) }}</div>

  @if($label['notes'])
    <div class="sgs-note-box i18n">{{ $label['notes'] }}</div>
  @endif
</div>
