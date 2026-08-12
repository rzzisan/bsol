{{-- Simple name+qty item list, Bengali shipping-note emphasis — reference "Sticker 8" (75x50mm). --}}
@php($order = $label['order'])
<div class="bsn-label {{ $loop->last ? '' : 'label-break' }}">
  <table class="bsn-table">
    <tr>
      <td style="width: {{ $g['infoColMm'] }}mm;">
        @if($label['shopNameImg'])
          <img src="{{ $label['shopNameImg'] }}" style="display:block; width:{{ $label['shopNameImgW'] }}mm; height:{{ $label['shopNameImgH'] }}mm;">
        @else
          <div class="bsn-shop i18n">{{ $label['shopName'] }}</div>
        @endif
        <div>Courier: {{ $order->courier_name ?? 'MANUAL' }}</div>
        @if($label['customerNameImg'])
          <img src="{{ $label['customerNameImg'] }}" style="vertical-align:text-bottom; width:{{ $label['customerNameImgW'] }}mm; height:{{ $label['customerNameImgH'] }}mm;">
        @else
          <span class="bsn-bold i18n">{{ $label['customerName'] }}</span>
        @endif
        &middot; {{ $order->customer_phone }}
      </td>
      <td style="width: {{ $g['barcodeColMm'] }}mm;">
        @if($label['barcode'])<img class="bsn-barcode" src="{{ $label['barcode'] }}">@endif
      </td>
    </tr>
  </table>

  @if($label['addressImg'])
    <img src="{{ $label['addressImg'] }}" style="display:block; width:{{ $label['addressImgW'] }}mm; height:{{ $label['addressImgH'] }}mm;">
  @else
    <div class="bsn-muted i18n">{{ $label['address'] }}</div>
  @endif
  <div class="bsn-parcel">Parcel ID: {{ $order->courier_tracking_id ?? '—' }}</div>

  <div class="bsn-rule"></div>

  <table class="bsn-table bsn-items">
    <tr class="bsn-items-head">
      <td style="width: {{ $g['bsnNameColMm'] }}mm;">Product</td>
      <td style="width: {{ $g['bsnQtyColMm'] }}mm;">Qty</td>
    </tr>
    @foreach($label['itemRows'] as $row)
      <tr>
        <td style="width: {{ $g['bsnNameColMm'] }}mm;">
          @if($row['nameImg'])
            <img src="{{ $row['nameImg'] }}" style="display:block; width:{{ $row['nameImgW'] }}mm; height:{{ $row['nameImgH'] }}mm;">
          @else
            <span class="i18n">{{ $row['name'] }}</span>
          @endif
        </td>
        <td style="width: {{ $g['bsnQtyColMm'] }}mm;">{{ $row['qty'] }}</td>
      </tr>
    @endforeach
  </table>

  <div class="bsn-due">Due Amount: {{ number_format($label['codAmount'], 0) }}</div>

  @if($label['notes'])
    @if($label['notesImg'])
      <div class="bsn-note-box"><img src="{{ $label['notesImg'] }}" style="display:block; width:{{ $label['notesImgW'] }}mm; height:{{ $label['notesImgH'] }}mm;"></div>
    @else
      <div class="bsn-note-box i18n">{{ $label['notes'] }}</div>
    @endif
  @endif
</div>
