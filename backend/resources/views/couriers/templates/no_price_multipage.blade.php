{{-- No prices anywhere (courier rider shouldn't see them) + larger shipping note — reference "Sticker 22" (75x50mm). --}}
@php($order = $label['order'])
<div class="npm-label {{ $loop->last ? '' : 'label-break' }}">
  <table class="npm-table">
    <tr>
      <td style="width: {{ $g['infoColMm'] }}mm;">
        @if($label['shopNameImg'])
          <img src="{{ $label['shopNameImg'] }}" style="display:block; width:{{ $label['shopNameImgW'] }}mm; height:{{ $label['shopNameImgH'] }}mm;">
        @else
          <div class="npm-shop i18n">{{ $label['shopName'] }}</div>
        @endif
        Courier: {{ $order->courier_name ?? 'MANUAL' }}<br>
        @if($label['customerNameImg'])
          <img src="{{ $label['customerNameImg'] }}" style="vertical-align:text-bottom; width:{{ $label['customerNameImgW'] }}mm; height:{{ $label['customerNameImgH'] }}mm;">
        @else
          <span class="npm-bold i18n">{{ $label['customerName'] }}</span>
        @endif
        &middot; {{ $order->customer_phone }}
      </td>
      <td style="width: {{ $g['barcodeColMm'] }}mm;">
        @if($label['barcode'])<img class="npm-barcode" src="{{ $label['barcode'] }}">@endif
      </td>
    </tr>
  </table>

  @if($label['addressImg'])
    <img src="{{ $label['addressImg'] }}" style="display:block; width:{{ $label['addressImgW'] }}mm; height:{{ $label['addressImgH'] }}mm;">
  @else
    <div class="npm-muted i18n">{{ $label['address'] }}</div>
  @endif
  <div class="npm-parcel">Parcel ID: {{ $order->courier_tracking_id ?? '—' }}</div>

  <div class="npm-rule"></div>

  <table class="npm-table npm-items">
    <tr class="npm-items-head">
      <td style="width: {{ $g['npmNameColMm'] }}mm;">Product</td>
      <td style="width: {{ $g['npmQtyColMm'] }}mm;">Qty</td>
    </tr>
    @foreach($label['itemRows'] as $row)
      <tr>
        <td style="width: {{ $g['npmNameColMm'] }}mm;">
          @if($row['nameImg'])
            <img src="{{ $row['nameImg'] }}" style="display:block; width:{{ $row['nameImgW'] }}mm; height:{{ $row['nameImgH'] }}mm;">
          @else
            <span class="i18n">{{ $row['name'] }}</span>
          @endif
        </td>
        <td style="width: {{ $g['npmQtyColMm'] }}mm;">{{ $row['qty'] }}</td>
      </tr>
    @endforeach
  </table>

  @if($label['notes'])
    <div class="npm-note-box i18n">
      <div class="npm-note-label">Shipping Note</div>
      @if($label['notesImg'])
        <img src="{{ $label['notesImg'] }}" style="display:block; width:{{ $label['notesImgW'] }}mm; height:{{ $label['notesImgH'] }}mm;">
      @else
        <div>{{ $label['notes'] }}</div>
      @endif
    </div>
  @endif
</div>
