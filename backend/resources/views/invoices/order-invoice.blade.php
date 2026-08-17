<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  @font-face { font-family: 'AppFont'; src: url('{{ $fontRegular }}') format('truetype'); font-weight: normal; font-style: normal; }
  @font-face { font-family: 'AppFont'; src: url('{{ $fontBold }}') format('truetype'); font-weight: bold; font-style: normal; }
  /* Same DejaVu-base + AppFont-for-Bengali/৳ split as the platform invoice
     template (invoices/document.blade.php) and the courier waybill —
     AppFont's Latin glyph metrics are noticeably wider, so it's scoped to
     where Bengali script or ৳ actually appears. */
  * { font-family: 'DejaVu Sans', sans-serif; }
  .i18n { font-family: 'AppFont', 'DejaVu Sans', sans-serif; }
  body { margin: 0; padding: 40px 42px; color: #1a2233; font-size: 12px; line-height: 1.5; }
  .header-table { width: 100%; margin-bottom: 4px; }
  .header-table td { vertical-align: top; }
  .logo { width: 52px; height: 52px; object-fit: contain; margin-bottom: 6px; }
  .shop-name { font-size: 19px; font-weight: bold; color: #0f7c7b; }
  .shop-meta { font-size: 10px; color: #657089; margin-top: 2px; }
  .invoice-title { font-size: 26px; font-weight: bold; text-align: right; color: #1a2233; }
  .invoice-meta { text-align: right; margin-top: 6px; font-size: 10.5px; color: #657089; }
  .invoice-meta .strong { color: #1a2233; font-weight: bold; }
  .rule { border-top: 2px solid #0f7c7b; margin: 14px 0 22px 0; }
  .muted { color: #657089; font-size: 10.5px; }
  .strong { font-weight: bold; color: #1a2233; }
  .section-label { font-size: 10px; color: #657089; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
  .bill-to { margin-bottom: 24px; }
  .bill-to .name { font-size: 14px; font-weight: bold; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 9px; font-size: 10px; font-weight: bold; }
  .badge-paid { background: #d1fae5; color: #047857; }
  .badge-partial { background: #fef3c7; color: #92400e; }
  .badge-due { background: #fee2e2; color: #b91c1c; }
  .items-table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  .items-table th { text-align: left; background: #f3f6fb; padding: 9px 10px; font-size: 10px; color: #657089; border-bottom: 1px solid #dfe4ee; }
  .items-table th.num, .items-table td.num { text-align: right; }
  .items-table td { padding: 10px; border-bottom: 1px solid #eef1f7; font-size: 11.5px; vertical-align: top; }
  .item-sub { font-size: 9.5px; color: #657089; margin-top: 2px; }
  .amount { font-family: 'AppFont', 'DejaVu Sans', sans-serif; }
  .totals-table { width: 260px; margin-left: auto; margin-top: 4px; }
  .totals-table td { padding: 5px 0; font-size: 11.5px; }
  .totals-table td.label { color: #657089; }
  .totals-table td.value { text-align: right; }
  .totals-table tr.total-row td { font-weight: bold; font-size: 15px; border-top: 2px solid #1a2233; padding-top: 10px; }
  .payment-line { margin-top: 22px; font-size: 10.5px; color: #657089; }
  .payments-table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  .payments-table th { text-align: left; background: #f3f6fb; padding: 7px 10px; font-size: 9.5px; color: #657089; border-bottom: 1px solid #dfe4ee; }
  .payments-table th.num, .payments-table td.num { text-align: right; }
  .payments-table td { padding: 8px 10px; border-bottom: 1px solid #eef1f7; font-size: 10.5px; vertical-align: middle; }
  .notes-box { margin-top: 18px; padding: 12px 14px; background: #f8f9fb; border-radius: 8px; font-size: 10.5px; }
  .footer { margin-top: 40px; padding-top: 14px; border-top: 1px solid #eef1f7; font-size: 10px; color: #9eabc4; text-align: center; }
</style>
</head>
<body>
  <table class="header-table"><tr>
    <td style="width:55%">
      @if($logoUrl)
        <img class="logo" src="{{ $logoUrl }}">
      @endif
      {{-- Real-shaped image when available (proper conjunct ligatures —
           see courier_waybill_context.md §4.7), plain reordered text
           otherwise. --}}
      @if($shopNameImg)
        <img src="{{ $shopNameImg['dataUri'] }}" style="display:block; width:{{ $shopNameImg['widthMm'] }}mm; height:{{ $shopNameImg['heightMm'] }}mm;">
      @else
        <div class="shop-name i18n">{{ $shopName }}</div>
      @endif
      @if($shopAddress)
        @if($shopAddressImg)
          <img src="{{ $shopAddressImg['dataUri'] }}" style="display:block; margin-top:2px; width:{{ $shopAddressImg['widthMm'] }}mm; height:{{ $shopAddressImg['heightMm'] }}mm;">
        @else
          <div class="shop-meta i18n">{{ $shopAddress }}</div>
        @endif
      @endif
      <div class="shop-meta">
        @if($shopPhone){{ $shopPhone }}@endif
        @if($shopPhone && $shopEmail) &middot; @endif
        @if($shopEmail){{ $shopEmail }}@endif
      </div>
    </td>
    <td style="width:45%">
      <div class="invoice-title">INVOICE</div>
      <div class="invoice-meta">
        <div><span class="strong">{{ $order->order_number }}</span></div>
        <div style="margin-top:3px">{{ $order->created_at->format('d M Y, h:i A') }}</div>
        <div style="margin-top:6px">
          <span class="badge badge-{{ $order->payment_status === 'paid' ? 'paid' : ($order->payment_status === 'partial' ? 'partial' : 'due') }}">
            {{ strtoupper($order->payment_status ?? 'due') }}
          </span>
        </div>
      </div>
    </td>
  </tr></table>

  <div class="rule"></div>

  <div class="bill-to">
    <div class="section-label">BILL TO</div>
    @if($customerNameImg)
      <img src="{{ $customerNameImg['dataUri'] }}" style="display:block; width:{{ $customerNameImg['widthMm'] }}mm; height:{{ $customerNameImg['heightMm'] }}mm;">
    @else
      <div class="name i18n">{{ $customerName }}</div>
    @endif
    <div class="muted">{{ $order->customer_phone }}</div>
    @if($addressImg)
      <img src="{{ $addressImg['dataUri'] }}" style="display:block; margin-top:2px; width:{{ $addressImg['widthMm'] }}mm; height:{{ $addressImg['heightMm'] }}mm;">
    @else
      <div class="muted i18n" style="margin-top:2px">{{ $address }}</div>
    @endif
  </div>

  <table class="items-table">
    <thead><tr>
      <th style="width:46%">DESCRIPTION</th>
      <th class="num" style="width:14%">QTY</th>
      <th class="num" style="width:20%">UNIT PRICE</th>
      <th class="num" style="width:20%">AMOUNT</th>
    </tr></thead>
    <tbody>
      @foreach($items as $item)
      <tr>
        <td>
          @if($item['nameImg'])
            <img src="{{ $item['nameImg']['dataUri'] }}" style="display:block; width:{{ $item['nameImg']['widthMm'] }}mm; height:{{ $item['nameImg']['heightMm'] }}mm;">
          @else
            <span class="i18n">{{ $item['name'] }}</span>
          @endif
          @if($item['sub'])
            @if($item['subImg'])
              <img src="{{ $item['subImg']['dataUri'] }}" style="display:block; margin-top:2px; width:{{ $item['subImg']['widthMm'] }}mm; height:{{ $item['subImg']['heightMm'] }}mm;">
            @else
              <div class="item-sub i18n">{{ $item['sub'] }}</div>
            @endif
          @endif
        </td>
        <td class="num">{{ $item['quantity'] }}</td>
        <td class="num amount">৳{{ number_format($item['unitPrice'], 2) }}</td>
        <td class="num amount">৳{{ number_format($item['total'], 2) }}</td>
      </tr>
      @endforeach
    </tbody>
  </table>

  <table class="totals-table">
    <tr>
      <td class="label">Subtotal</td>
      <td class="value amount">৳{{ number_format((float) $order->subtotal, 2) }}</td>
    </tr>
    @if((float) $order->discount > 0)
    <tr>
      <td class="label">Discount</td>
      <td class="value amount">&minus;৳{{ number_format((float) $order->discount, 2) }}</td>
    </tr>
    @endif
    @if((float) $order->shipping_charge > 0)
    <tr>
      <td class="label">Shipping</td>
      <td class="value amount">৳{{ number_format((float) $order->shipping_charge, 2) }}</td>
    </tr>
    @endif
    <tr class="total-row">
      <td class="label">Total</td>
      <td class="value amount">৳{{ number_format((float) $order->total, 2) }}</td>
    </tr>
  </table>

  @if($payments->isNotEmpty())
    <div class="section-label" style="margin-top:22px">PAYMENT HISTORY</div>
    <table class="payments-table">
      <thead><tr>
        <th style="width:16%">DATE</th>
        <th style="width:20%">TYPE</th>
        <th style="width:14%">METHOD</th>
        <th class="num amount" style="width:16%">AMOUNT</th>
        <th class="num amount" style="width:16%">DISCOUNT</th>
        <th style="width:18%">RECEIVED BY</th>
      </tr></thead>
      <tbody>
        @foreach($payments as $p)
        <tr>
          <td>{{ $p['collectedAt']->format('d M Y') }}</td>
          <td>{{ $p['purpose'] }}</td>
          <td>{{ $p['method'] }}</td>
          <td class="num amount">৳{{ number_format($p['amount'], 2) }}</td>
          <td class="num amount">{{ $p['discount'] > 0 ? '−৳' . number_format($p['discount'], 2) : '—' }}</td>
          <td>
            @if($p['collectorImg'])
              <img src="{{ $p['collectorImg']['dataUri'] }}" style="display:block; width:{{ $p['collectorImg']['widthMm'] }}mm; height:{{ $p['collectorImg']['heightMm'] }}mm;">
            @else
              <span class="i18n">{{ $p['collector'] }}</span>
            @endif
          </td>
        </tr>
        @endforeach
      </tbody>
    </table>
    <table class="totals-table" style="margin-top:8px">
      <tr>
        <td class="label">Paid</td>
        <td class="value amount">৳{{ number_format($paidAmount, 2) }}</td>
      </tr>
      @if($collectionDiscount > 0)
      <tr>
        <td class="label">Extra Discount</td>
        <td class="value amount">&minus;৳{{ number_format($collectionDiscount, 2) }}</td>
      </tr>
      @endif
      <tr class="total-row">
        <td class="label">{{ $dueAmount > 0 ? 'Due' : ($dueAmount < 0 ? 'Overpaid' : 'Due') }}</td>
        <td class="value amount">৳{{ number_format(abs($dueAmount), 2) }}</td>
      </tr>
    </table>
  @endif

  @if($order->payment_method)
    <div class="payment-line">Payment method: <span class="strong">{{ ucfirst(str_replace('_', ' ', $order->payment_method)) }}</span></div>
  @endif

  @if($order->notes)
    <div class="notes-box">
      @if($notesImg)
        <img src="{{ $notesImg['dataUri'] }}" style="display:block; width:{{ $notesImg['widthMm'] }}mm; height:{{ $notesImg['heightMm'] }}mm;">
      @else
        {{-- $notesText, not raw $order->notes — this was previously
             rendered un-reordered (a separate latent bug fixed in passing;
             the shaped image path above is unaffected either way). --}}
        <span class="i18n">{{ $notesText }}</span>
      @endif
    </div>
  @endif

  <div class="footer i18n">This is a computer-generated invoice from {{ $shopName }}. No signature required.</div>
</body>
</html>
