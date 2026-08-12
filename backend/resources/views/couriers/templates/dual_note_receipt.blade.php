{{-- Shop logo + product table + TWO separate note boxes — reference "Sticker 15" (3in width). --}}
@php($order = $label['order'])
<div class="dnr-label {{ $loop->last ? '' : 'label-break' }}">
  <table class="dnr-table">
    <tr>
      <td style="width: {{ $g['logoColMm'] }}mm;">
        @if($label['shopLogo'])
          <img class="dnr-logo" src="{{ $label['shopLogo'] }}">
        @else
          <div class="dnr-logo-placeholder"></div>
        @endif
      </td>
      <td style="width: {{ $g['headerTextColMm'] }}mm;">
        @if($label['shopNameImg'])
          <img src="{{ $label['shopNameImg'] }}" style="display:block; width:{{ $label['shopNameImgW'] }}mm; height:{{ $label['shopNameImgH'] }}mm;">
        @else
          <div class="dnr-shop i18n">{{ $label['shopName'] }}</div>
        @endif
        <div class="dnr-meta">Courier: {{ $order->courier_name ?? 'MANUAL' }} &nbsp; IV No: {{ $order->order_number }}</div>
      </td>
    </tr>
  </table>

  <div class="dnr-rule"></div>

  <table class="dnr-table">
    <tr>
      <td style="width: {{ $g['infoColMm'] }}mm;">
        @if($label['customerNameImg'])
          <img src="{{ $label['customerNameImg'] }}" style="display:block; width:{{ $label['customerNameImgW'] }}mm; height:{{ $label['customerNameImgH'] }}mm;"><br>
        @else
          <span class="dnr-bold i18n">{{ $label['customerName'] }}</span><br>
        @endif
        {{ $order->customer_phone }}<br>
        @if($label['addressImg'])
          <img src="{{ $label['addressImg'] }}" style="display:block; width:{{ $label['addressImgW'] }}mm; height:{{ $label['addressImgH'] }}mm;">
        @else
          <span class="dnr-muted i18n">{{ $label['address'] }}</span>
        @endif
      </td>
      <td style="width: {{ $g['barcodeColMm'] }}mm;">
        @if($label['barcode'])<img class="dnr-barcode" src="{{ $label['barcode'] }}">@endif
      </td>
    </tr>
  </table>

  <div class="dnr-parcel">Parcel ID: {{ $order->courier_tracking_id ?? '—' }}</div>

  <div class="dnr-rule"></div>

  <table class="dnr-table dnr-items">
    <tr class="dnr-items-head">
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
            <span class="i18n">{{ $row['name'] }}</span>
          @endif
        </td>
        <td style="width: {{ $g['ptQtyColMm'] }}mm;">{{ $row['qty'] }}</td>
        <td style="width: {{ $g['ptPriceColMm'] }}mm;">{{ number_format($row['price'], 0) }}</td>
        <td style="width: {{ $g['ptTotalColMm'] }}mm;">{{ number_format($row['total'], 0) }}</td>
      </tr>
    @endforeach
  </table>

  <div class="dnr-due">Due Amount: {{ number_format($label['codAmount'], 0) }}</div>

  <div class="dnr-note-box">
    <div class="dnr-note-label">Shipping Note</div>
    <div>Handle with care</div>
  </div>
  @if($label['notes'])
    <div class="dnr-note-box i18n">
      <div class="dnr-note-label">Order Note</div>
      @if($label['notesImg'])
        <img src="{{ $label['notesImg'] }}" style="display:block; width:{{ $label['notesImgW'] }}mm; height:{{ $label['notesImgH'] }}mm;">
      @else
        <div>{{ $label['notes'] }}</div>
      @endif
    </div>
  @endif
</div>
