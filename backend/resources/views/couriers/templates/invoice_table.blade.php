{{-- Compact invoice-style label — reference "RetailBD"/"EcomDrive" family (75x50mm). --}}
@php($order = $label['order'])
<div class="it-label {{ $loop->last ? '' : 'label-break' }}">
  <table class="it-table">
    <tr>
      <td>
        @if($label['shopNameImg'])
          <img src="{{ $label['shopNameImg'] }}" style="display:block; width:{{ $label['shopNameImgW'] }}mm; height:{{ $label['shopNameImgH'] }}mm;">
        @else
          <div class="it-shop i18n">{{ $label['shopName'] }}</div>
        @endif
      </td>
      <td class="it-meta">Date: {{ $label['dateShort'] }}<br>IV No: {{ $order->order_number }}</td>
    </tr>
  </table>

  <div class="it-rule"></div>

  <table class="it-table">
    <tr>
      <td>
        Courier: {{ $order->courier_name ?? 'MANUAL' }}<br>
        {{-- Explicit <br> after the img too — display:block alone isn't
             reliably forcing a line break here (dompdf quirk), matches
             every other img/text branch pair in this file. --}}
        @if($label['customerNameImg'])
          <img src="{{ $label['customerNameImg'] }}" style="display:block; width:{{ $label['customerNameImgW'] }}mm; height:{{ $label['customerNameImgH'] }}mm;"><br>
        @else
          <span class="it-bold i18n">{{ $label['customerName'] }}</span><br>
        @endif
        {{ $order->customer_phone }}<br>
        @if($label['addressImg'])
          <img src="{{ $label['addressImg'] }}" style="display:block; width:{{ $label['addressImgW'] }}mm; height:{{ $label['addressImgH'] }}mm;">
        @else
          <span class="it-muted i18n">{{ $label['address'] }}</span>
        @endif
      </td>
      <td class="it-barcode-cell">
        @if($label['barcode'])<img class="it-barcode" src="{{ $label['barcode'] }}">@endif
      </td>
    </tr>
  </table>

  <div class="it-parcel">Parcel ID: {{ $order->courier_tracking_id ?? '—' }}</div>

  <div class="it-rule"></div>

  <table class="it-table it-items">
    <tr class="it-items-head">
      <td style="width: {{ $g['nameColMm'] }}mm;">Product</td>
      <td style="width: {{ $g['qtyColMm'] }}mm;">Qty</td>
      <td style="width: {{ $g['priceColMm'] }}mm;">Price</td>
      <td style="width: {{ $g['totalColMm'] }}mm;">Total</td>
    </tr>
    @foreach($label['itemRows'] as $row)
      <tr>
        <td style="width: {{ $g['nameColMm'] }}mm;">
          @if($row['nameImg'])
            <img src="{{ $row['nameImg'] }}" style="display:block; width:{{ $row['nameImgW'] }}mm; height:{{ $row['nameImgH'] }}mm;">
          @else
            <span class="i18n">{{ $row['name'] }}</span>
          @endif
        </td>
        <td style="width: {{ $g['qtyColMm'] }}mm;">{{ $row['qty'] }}</td>
        <td style="width: {{ $g['priceColMm'] }}mm;">{{ number_format($row['price'], 0) }}</td>
        <td style="width: {{ $g['totalColMm'] }}mm;">{{ number_format($row['total'], 0) }}</td>
      </tr>
    @endforeach
  </table>

  <div class="it-rule"></div>

  <div class="it-totals">
    Sub Total: {{ number_format($label['subtotal'], 0) }}
    &nbsp;&nbsp; Delivery: {{ number_format($label['shippingCharge'], 0) }}
  </div>
  <div class="it-due">Due Amount: {{ number_format($label['codAmount'], 0) }}</div>

  @if($label['notes'])
    <div class="it-note">
      Note:
      @if($label['notesImg'])
        <img src="{{ $label['notesImg'] }}" style="display:block; width:{{ $label['notesImgW'] }}mm; height:{{ $label['notesImgH'] }}mm;">
      @else
        <span class="i18n">{{ $label['notes'] }}</span>
      @endif
    </div>
  @endif
</div>
