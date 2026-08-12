{{-- No prices anywhere (courier rider shouldn't see them) + larger shipping note — reference "Sticker 22" (75x50mm). --}}
@php($order = $label['order'])
<div class="npm-label {{ $loop->last ? '' : 'label-break' }}">
  <table class="npm-table">
    <tr>
      <td style="width: {{ $g['infoColMm'] }}mm;">
        <div class="npm-shop i18n">{{ $label['shopName'] }}</div>
        Courier: {{ $order->courier_name ?? 'MANUAL' }}<br>
        <span class="npm-bold i18n">{{ $label['customerName'] }}</span> &middot; {{ $order->customer_phone }}
      </td>
      <td style="width: {{ $g['barcodeColMm'] }}mm;">
        @if($label['barcode'])<img class="npm-barcode" src="{{ $label['barcode'] }}">@endif
      </td>
    </tr>
  </table>

  <div class="npm-muted i18n">{{ $label['address'] }}</div>
  <div class="npm-parcel">Parcel ID: {{ $order->courier_tracking_id ?? '—' }}</div>

  <div class="npm-rule"></div>

  <table class="npm-table npm-items">
    <tr class="npm-items-head">
      <td style="width: {{ $g['npmNameColMm'] }}mm;">Product</td>
      <td style="width: {{ $g['npmQtyColMm'] }}mm;">Qty</td>
    </tr>
    @foreach($label['itemRows'] as $row)
      <tr>
        <td style="width: {{ $g['npmNameColMm'] }}mm;" class="i18n">{{ $row['name'] }}</td>
        <td style="width: {{ $g['npmQtyColMm'] }}mm;">{{ $row['qty'] }}</td>
      </tr>
    @endforeach
  </table>

  @if($label['notes'])
    <div class="npm-note-box i18n">
      <div class="npm-note-label">Shipping Note</div>
      <div>{{ $label['notes'] }}</div>
    </div>
  @endif
</div>
