{{-- Tightly-truncated SKU names + highlighted shipping note — reference "Sticker 9" (75x50mm). --}}
@php($order = $label['order'])
<div class="stn-label {{ $loop->last ? '' : 'label-break' }}">
  <table class="stn-table">
    <tr>
      <td style="width: {{ $g['infoColMm'] }}mm;">
        @if($label['shopNameImg'])
          <img src="{{ $label['shopNameImg'] }}" style="display:block; width:{{ $label['shopNameImgW'] }}mm; height:{{ $label['shopNameImgH'] }}mm;">
        @else
          <div class="stn-shop i18n">{{ $label['shopName'] }}</div>
        @endif
        Courier: {{ $order->courier_name ?? 'MANUAL' }}<br>
        @if($label['customerNameImg'])
          <img src="{{ $label['customerNameImg'] }}" style="vertical-align:text-bottom; width:{{ $label['customerNameImgW'] }}mm; height:{{ $label['customerNameImgH'] }}mm;">
        @else
          <span class="stn-bold i18n">{{ $label['customerName'] }}</span>
        @endif
        &middot; {{ $order->customer_phone }}
      </td>
      <td style="width: {{ $g['barcodeColMm'] }}mm;">
        @if($label['barcode'])<img class="stn-barcode" src="{{ $label['barcode'] }}">@endif
      </td>
    </tr>
  </table>

  <div class="stn-parcel">Parcel ID: {{ $order->courier_tracking_id ?? '—' }}</div>

  <div class="stn-rule"></div>

  <table class="stn-table stn-items">
    <tr class="stn-items-head">
      <td style="width: {{ $g['ptNameColMm'] }}mm;">Product</td>
      <td style="width: {{ $g['ptQtyColMm'] }}mm;">Qty</td>
      <td style="width: {{ $g['ptPriceColMm'] }}mm;">Price</td>
      <td style="width: {{ $g['ptTotalColMm'] }}mm;">Total</td>
    </tr>
    @foreach($label['itemRows'] as $row)
      <tr>
        <td style="width: {{ $g['ptNameColMm'] }}mm;">
          @if($row['nameImg'])
            <img src="{{ $row['nameImg'] }}" style="display:block; width:{{ $row['nameImgW'] }}mm; height:{{ $row['nameImgH'] }}mm;">
          @else
            <span class="i18n">{{ \Illuminate\Support\Str::limit($row['name'], 12) }}</span>
          @endif
        </td>
        <td style="width: {{ $g['ptQtyColMm'] }}mm;">{{ $row['qty'] }}</td>
        <td style="width: {{ $g['ptPriceColMm'] }}mm;">{{ number_format($row['price'], 0) }}</td>
        <td style="width: {{ $g['ptTotalColMm'] }}mm;">{{ number_format($row['total'], 0) }}</td>
      </tr>
    @endforeach
  </table>

  <div class="stn-due">Due Amount: {{ number_format($label['codAmount'], 0) }}</div>

  @if($label['notes'])
    <div class="stn-note-box i18n">
      Shipping Note:
      @if($label['notesImg'])
        <img src="{{ $label['notesImg'] }}" style="vertical-align:text-bottom; width:{{ $label['notesImgW'] }}mm; height:{{ $label['notesImgH'] }}mm;">
      @else
        {{ $label['notes'] }}
      @endif
    </div>
  @endif
</div>
