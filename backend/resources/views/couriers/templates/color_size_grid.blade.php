{{-- Big Parcel ID box + barcode + color/size variant rows — reference "Sticker 18" (3x4in). --}}
@php($order = $label['order'])
<div class="csg-label {{ $loop->last ? '' : 'label-break' }}">
  <table class="csg-table">
    <tr>
      <td style="width: {{ $g['headerLeftColMm'] }}mm;">
        @if($label['shopNameImg'])
          <img src="{{ $label['shopNameImg'] }}" style="display:block; width:{{ $label['shopNameImgW'] }}mm; height:{{ $label['shopNameImgH'] }}mm;">
        @else
          <div class="csg-shop i18n">{{ $label['shopName'] }}</div>
        @endif
        @if($label['customerNameImg'])
          <img src="{{ $label['customerNameImg'] }}" style="display:block; width:{{ $label['customerNameImgW'] }}mm; height:{{ $label['customerNameImgH'] }}mm;"><br>
        @else
          <span class="csg-bold i18n">{{ $label['customerName'] }}</span><br>
        @endif
        {{ $order->customer_phone }}
      </td>
      <td style="width: {{ $g['parcelBoxColMm'] }}mm;">
        <div class="csg-parcel-box">
          <div class="csg-parcel-label">PARCEL ID</div>
          <div class="csg-parcel-value">{{ $order->courier_tracking_id ?? '—' }}</div>
        </div>
      </td>
    </tr>
  </table>

  @if($label['barcode'])
    <img class="csg-barcode" src="{{ $label['barcode'] }}">
  @endif

  <div class="csg-rule"></div>

  <table class="csg-table csg-items">
    <tr class="csg-items-head">
      <td style="width: {{ $g['csgNameColMm'] }}mm;">Product</td>
      <td style="width: {{ $g['csgQtyColMm'] }}mm;">Qty</td>
    </tr>
    @foreach($label['itemRows'] as $row)
      <tr>
        <td style="width: {{ $g['csgNameColMm'] }}mm;" class="i18n">
          @if($row['nameImg'])
            <img src="{{ $row['nameImg'] }}" style="vertical-align:text-bottom; width:{{ $row['nameImgW'] }}mm; height:{{ $row['nameImgH'] }}mm;">
          @else
            {{ $row['name'] }}
          @endif
          @if($row['variant']) <span class="csg-variant">({{ $row['variant'] }})</span>@endif
        </td>
        <td style="width: {{ $g['csgQtyColMm'] }}mm;">{{ $row['qty'] }}</td>
      </tr>
    @endforeach
  </table>

  <div class="csg-rule"></div>

  <div class="csg-summary">Total Product: {{ collect($label['itemRows'])->sum('qty') }}</div>
  <div class="csg-summary-bold">Total Bill: {{ number_format($label['codAmount'], 0) }}</div>
</div>
