{{-- Pathao dashboard-style label — see courier_waybill_context.md §5. --}}
@php($order = $label['order'])
<div class="label-pathao {{ $loop->last ? '' : 'label-break' }}">
  <table class="p-table">
    <tr>
      <td style="width: {{ $g['logoColMm'] }}mm;"><div class="p-logo">PATHAO</div></td>
      <td style="width: {{ $g['headerTextColMm'] }}mm;">
        {{-- Real-shaped image when available (proper conjunct ligatures —
             courier_waybill_context.md §4.7), plain reordered text
             otherwise. The muted "shop - city" line below always stays
             plain text (shaping the same field twice at two sizes isn't
             supported by this scheme — see resolveShapingSpec() doc). --}}
        Shipped From:
        @if($label['shopLineImg'])
          <img src="{{ $label['shopLineImg'] }}" style="vertical-align:text-bottom; width:{{ $label['shopLineImgW'] }}mm; height:{{ $label['shopLineImgH'] }}mm;">
        @else
          <span class="p-bold i18n">{{ $label['shopName'] }}</span>
        @endif
        <br>
        <span class="p-muted i18n">{{ $label['shopName'] }}@if($label['cityName']) - {{ $label['cityName'] }}@endif</span><br>
        @if($label['shopPhone'])<span class="p-muted">Contact: {{ $label['shopPhone'] }}</span>@endif
      </td>
    </tr>
  </table>

  <div class="p-rule"></div>

  <table class="p-table">
    <tr>
      <td style="width: {{ $g['typeColMm'] }}mm;"><div class="p-type">Regular</div></td>
      <td style="width: {{ $g['midTextColMm'] }}mm;">
        Shipped To:
        @if($label['customerNameImg'])
          <img src="{{ $label['customerNameImg'] }}" style="vertical-align:text-bottom; width:{{ $label['customerNameImgW'] }}mm; height:{{ $label['customerNameImgH'] }}mm;">
        @else
          <span class="p-to-name i18n">{{ $label['customerName'] }}</span>
        @endif
        <br>
        Phone: {{ $order->customer_phone }}<br>
        Secondary Phone: N/A<br>
        @if($label['address'] !== '—')
          Address:
          @if($label['addressImg'])
            <img src="{{ $label['addressImg'] }}" style="vertical-align:text-bottom; width:{{ $label['addressImgW'] }}mm; height:{{ $label['addressImgH'] }}mm;">
          @else
            <span class="i18n">{{ $label['address'] }}</span>
          @endif
        @endif
      </td>
      <td style="width: {{ $g['qrMm'] }}mm;"><img class="p-qr" src="{{ $label['qr'] }}"></td>
    </tr>
  </table>

  <div class="p-rule"></div>

  <table class="p-table">
    <tr>
      <td style="width: {{ $g['bottomLeftColMm'] }}mm;">
        Weight: {{ number_format($label['weightKg'], 2) }} Kg<br>
        Merchant Order Id: {{ $order->order_number }}<br>
        <span class="p-collect">Collectable Amount: BDT {{ number_format($label['codAmount'], 2) }}</span>
      </td>
      <td style="width: {{ $g['bottomRightColMm'] }}mm;">
        @if($label['barcode'])<img class="p-barcode" src="{{ $label['barcode'] }}">@endif
        <div class="p-tracking">{{ $order->courier_tracking_id ?? '—' }}</div>
        @if($label['bookedAt'])Order Date: {{ $label['bookedAt'] }}<br>@endif
        @if($label['cityName'])Target Hub: {{ $label['cityName'] }}<br>@endif
        @if($label['zoneName'])Zone: {{ $label['zoneName'] }}<br>@endif
        @if($label['areaName'])Area: {{ $label['areaName'] }}@endif
      </td>
    </tr>
  </table>
</div>
