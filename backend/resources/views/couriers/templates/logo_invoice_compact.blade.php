{{-- Shop logo top-left + compact invoice — reference "Sticker 7" (75x50mm). --}}
@php($order = $label['order'])
<div class="lic-label {{ $loop->last ? '' : 'label-break' }}">
  <table class="lic-table">
    <tr>
      <td style="width: {{ $g['logoColMm'] }}mm;">
        @if($label['shopLogo'])
          <img class="lic-logo" src="{{ $label['shopLogo'] }}">
        @else
          <div class="lic-logo-placeholder"></div>
        @endif
      </td>
      <td style="width: {{ $g['headerTextColMm'] }}mm;">
        @if($label['shopNameImg'])
          <img src="{{ $label['shopNameImg'] }}" style="display:block; width:{{ $label['shopNameImgW'] }}mm; height:{{ $label['shopNameImgH'] }}mm;">
        @else
          <div class="lic-shop i18n">{{ $label['shopName'] }}</div>
        @endif
        <div class="lic-meta">Date: {{ $label['dateShort'] }}<br>IV No: {{ $order->order_number }}</div>
      </td>
    </tr>
  </table>

  <div class="lic-rule"></div>

  <table class="lic-table">
    <tr>
      <td style="width: {{ $g['infoColMm'] }}mm;">
        Courier: {{ $order->courier_name ?? 'MANUAL' }}<br>
        @if($label['customerNameImg'])
          <img src="{{ $label['customerNameImg'] }}" style="display:block; width:{{ $label['customerNameImgW'] }}mm; height:{{ $label['customerNameImgH'] }}mm;"><br>
        @else
          <span class="lic-bold i18n">{{ $label['customerName'] }}</span><br>
        @endif
        {{ $order->customer_phone }}<br>
        @if($label['addressImg'])
          <img src="{{ $label['addressImg'] }}" style="display:block; width:{{ $label['addressImgW'] }}mm; height:{{ $label['addressImgH'] }}mm;">
        @else
          <span class="lic-muted i18n">{{ $label['address'] }}</span>
        @endif
      </td>
      <td style="width: {{ $g['barcodeColMm'] }}mm;">
        @if($label['barcode'])<img class="lic-barcode" src="{{ $label['barcode'] }}">@endif
      </td>
    </tr>
  </table>

  <div class="lic-parcel">Parcel ID: {{ $order->courier_tracking_id ?? '—' }}</div>

  <div class="lic-rule"></div>

  <table class="lic-table lic-items">
    <tr class="lic-items-head">
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

  <div class="lic-totals">Sub Total: {{ number_format($label['subtotal'], 0) }} &nbsp;&nbsp; Delivery: {{ number_format($label['shippingCharge'], 0) }}</div>
  <div class="lic-due">Due Amount: {{ number_format($label['codAmount'], 0) }}</div>

  @if($label['notes'])
    <div class="lic-note-label">Note:</div>
    @if($label['notesImg'])
      <img src="{{ $label['notesImg'] }}" style="display:block; width:{{ $label['notesImgW'] }}mm; height:{{ $label['notesImgH'] }}mm;">
    @else
      <div class="lic-note i18n">{{ $label['notes'] }}</div>
    @endif
  @endif
</div>
