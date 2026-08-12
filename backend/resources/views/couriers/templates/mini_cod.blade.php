{{-- Mini COD tag — reference "Shokher Gadget" (38x25mm). Deliberately minimal:
     only what fits on a genuinely tiny label — no customer info at all,
     matching the reference exactly. --}}
@php($order = $label['order'])
<div class="mc-label {{ $loop->last ? '' : 'label-break' }}">
  @if($label['shopNameImg'])
    {{-- Explicit <br> — display:block alone isn't reliably forcing a line
         break between two adjacent <img> tags here (dompdf quirk, seen in
         invoice_table.blade.php too). --}}
    <img src="{{ $label['shopNameImg'] }}" style="display:block; margin:0 auto; width:{{ $label['shopNameImgW'] }}mm; height:{{ $label['shopNameImgH'] }}mm;"><br>
  @else
    <div class="mc-shop i18n">{{ $label['shopName'] }}</div>
  @endif
  @if($label['barcode'])
    <img class="mc-barcode" src="{{ $label['barcode'] }}">
  @endif
  <div class="mc-parcel">Parcel ID: {{ $order->courier_tracking_id ?? '—' }}</div>
  <div class="mc-cod">COD: {{ number_format($label['codAmount'], 0) }} TK</div>
</div>
