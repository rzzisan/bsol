{{-- No barcode at all, standard payment-check disclaimer — reference "Sticker 5" (3x4in). --}}
@php($order = $label['order'])
<div class="snb-label {{ $loop->last ? '' : 'label-break' }}">
  @if($label['shopNameImg'])
    <img src="{{ $label['shopNameImg'] }}" style="display:block; width:{{ $label['shopNameImgW'] }}mm; height:{{ $label['shopNameImgH'] }}mm;">
  @else
    <div class="snb-shop i18n">{{ $label['shopName'] }}</div>
  @endif
  <div>Courier: {{ $order->courier_name ?? 'MANUAL' }} &nbsp; Invoice No: {{ $order->order_number }}</div>

  <div class="snb-rule"></div>

  <div class="snb-section">Invoice To:</div>
  @if($label['customerNameImg'])
    <img src="{{ $label['customerNameImg'] }}" style="display:block; width:{{ $label['customerNameImgW'] }}mm; height:{{ $label['customerNameImgH'] }}mm;">
  @else
    <div class="snb-bold i18n">{{ $label['customerName'] }}</div>
  @endif
  <div>{{ $order->customer_phone }}</div>
  @if($label['addressImg'])
    <img src="{{ $label['addressImg'] }}" style="display:block; width:{{ $label['addressImgW'] }}mm; height:{{ $label['addressImgH'] }}mm;">
  @else
    <div class="snb-muted i18n">{{ $label['address'] }}</div>
  @endif
  <div class="snb-parcel">Parcel ID: {{ $order->courier_tracking_id ?? '—' }}</div>

  <div class="snb-rule"></div>

  <table class="snb-table snb-items">
    <tr class="snb-items-head">
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

  <div class="snb-rule"></div>

  <div class="snb-totals">Sub Total: {{ number_format($label['subtotal'], 0) }} &nbsp;&nbsp; Delivery: {{ number_format($label['shippingCharge'], 0) }}</div>
  <div class="snb-due">Due Amount: {{ number_format($label['codAmount'], 0) }}</div>

  <div class="snb-note-box">Please check the parcel before payment</div>
  @if($label['notes'])
    @if($label['notesImg'])
      <div class="snb-note-box"><img src="{{ $label['notesImg'] }}" style="display:block; width:{{ $label['notesImgW'] }}mm; height:{{ $label['notesImgH'] }}mm;"></div>
    @else
      <div class="snb-note-box i18n">{{ $label['notes'] }}</div>
    @endif
  @endif
</div>
