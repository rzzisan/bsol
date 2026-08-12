{{-- Simple name+qty item list, Bengali shipping-note emphasis — reference "Sticker 8" (75x50mm). --}}
@php($order = $label['order'])
<div class="bsn-label {{ $loop->last ? '' : 'label-break' }}">
  <table class="bsn-table">
    <tr>
      <td style="width: {{ $g['infoColMm'] }}mm;">
        <div class="bsn-shop i18n">{{ $label['shopName'] }}</div>
        <div>Courier: {{ $order->courier_name ?? 'MANUAL' }}</div>
        <span class="bsn-bold i18n">{{ $label['customerName'] }}</span> &middot; {{ $order->customer_phone }}
      </td>
      <td style="width: {{ $g['barcodeColMm'] }}mm;">
        @if($label['barcode'])<img class="bsn-barcode" src="{{ $label['barcode'] }}">@endif
      </td>
    </tr>
  </table>

  <div class="bsn-muted i18n">{{ $label['address'] }}</div>
  <div class="bsn-parcel">Parcel ID: {{ $order->courier_tracking_id ?? '—' }}</div>

  <div class="bsn-rule"></div>

  <table class="bsn-table bsn-items">
    <tr class="bsn-items-head">
      <td style="width: {{ $g['bsnNameColMm'] }}mm;">Product</td>
      <td style="width: {{ $g['bsnQtyColMm'] }}mm;">Qty</td>
    </tr>
    @foreach($label['itemRows'] as $row)
      <tr>
        <td style="width: {{ $g['bsnNameColMm'] }}mm;" class="i18n">{{ $row['name'] }}</td>
        <td style="width: {{ $g['bsnQtyColMm'] }}mm;">{{ $row['qty'] }}</td>
      </tr>
    @endforeach
  </table>

  <div class="bsn-due">Due Amount: {{ number_format($label['codAmount'], 0) }}</div>

  @if($label['notes'])
    <div class="bsn-note-box i18n">{{ $label['notes'] }}</div>
  @endif
</div>
