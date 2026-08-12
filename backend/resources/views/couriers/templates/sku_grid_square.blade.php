{{-- Square SKU grid + single note box — reference "Sticker 16" (3x3in). --}}
@php($order = $label['order'])
<div class="sgs-label {{ $loop->last ? '' : 'label-break' }}">
  <table class="sgs-table">
    <tr>
      <td style="width: {{ $g['infoColMm'] }}mm;">
        @if($label['shopNameImg'])
          <img src="{{ $label['shopNameImg'] }}" style="display:block; width:{{ $label['shopNameImgW'] }}mm; height:{{ $label['shopNameImgH'] }}mm;">
        @else
          <div class="sgs-shop i18n">{{ $label['shopName'] }}</div>
        @endif
        @if($label['customerNameImg'])
          <img src="{{ $label['customerNameImg'] }}" style="display:block; width:{{ $label['customerNameImgW'] }}mm; height:{{ $label['customerNameImgH'] }}mm;"><br>
        @else
          <span class="sgs-bold i18n">{{ $label['customerName'] }}</span><br>
        @endif
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

  <div class="sgs-due">Due Amount: {{ number_format($label['codAmount'], 0) }}</div>

  @if($label['notes'])
    @if($label['notesImg'])
      <div class="sgs-note-box"><img src="{{ $label['notesImg'] }}" style="display:block; width:{{ $label['notesImgW'] }}mm; height:{{ $label['notesImgH'] }}mm;"></div>
    @else
      <div class="sgs-note-box i18n">{{ $label['notes'] }}</div>
    @endif
  @endif
</div>
