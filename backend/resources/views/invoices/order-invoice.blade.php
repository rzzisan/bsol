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
      <div class="shop-name i18n">{{ $shopName }}</div>
      @if($shopAddress)<div class="shop-meta i18n">{{ $shopAddress }}</div>@endif
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
    <div class="name i18n">{{ $customerName }}</div>
    <div class="muted">{{ $order->customer_phone }}</div>
    <div class="muted i18n" style="margin-top:2px">{{ $address }}</div>
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
          <span class="i18n">{{ $item['name'] }}</span>
          @if($item['sku'] || $item['variant'])
            <div class="item-sub i18n">
              @if($item['sku']){{ $item['sku'] }}@endif
              @if($item['sku'] && $item['variant']) &middot; @endif
              @if($item['variant']){{ $item['variant'] }}@endif
            </div>
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

  @if($order->payment_method)
    <div class="payment-line">Payment method: <span class="strong">{{ ucfirst(str_replace('_', ' ', $order->payment_method)) }}</span></div>
  @endif

  @if($order->notes)
    <div class="notes-box i18n">{{ $order->notes }}</div>
  @endif

  <div class="footer i18n">This is a computer-generated invoice from {{ $shopName }}. No signature required.</div>
</body>
</html>
