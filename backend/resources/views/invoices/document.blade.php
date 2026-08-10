<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  @font-face { font-family: 'AppFont'; src: url('{{ $fontRegular }}') format('truetype'); font-weight: normal; font-style: normal; }
  @font-face { font-family: 'AppFont'; src: url('{{ $fontBold }}') format('truetype'); font-weight: bold; font-style: normal; }
  /* Base text uses dompdf's built-in DejaVu Sans — correct Latin spacing/kerning.
     'AppFont' (Noto Sans Bengali) is applied only where Bengali script or the
     ৳ currency glyph might appear (customer name, amounts) — its Latin glyph
     metrics are noticeably wider and look wrong if used for all body text. */
  * { font-family: 'DejaVu Sans', sans-serif; }
  .i18n { font-family: 'AppFont', 'DejaVu Sans', sans-serif; }
  body { margin: 0; padding: 36px 42px; color: #1a2233; font-size: 12px; line-height: 1.5; }
  .brand-row { width: 100%; margin-bottom: 6px; }
  .brand { font-size: 19px; font-weight: bold; color: #0f7c7b; }
  .brand-sub { font-size: 10px; color: #9eabc4; margin-top: 2px; }
  .invoice-title { font-size: 22px; font-weight: bold; text-align: right; color: #1a2233; }
  .rule { border-top: 2px solid #0f7c7b; margin: 14px 0 22px 0; }
  .muted { color: #657089; font-size: 10.5px; }
  .strong { font-weight: bold; color: #1a2233; }
  .meta-table { width: 100%; margin-bottom: 22px; }
  .meta-table td { vertical-align: top; padding: 0; }
  .align-right { text-align: right; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 10px; font-size: 10.5px; font-weight: bold; margin-top: 4px; }
  .badge-approved { background: #d1fae5; color: #047857; }
  .badge-pending { background: #fef3c7; color: #92400e; }
  .badge-rejected { background: #fee2e2; color: #b91c1c; }
  .items-table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  .items-table th { text-align: left; background: #f3f6fb; padding: 9px 12px; font-size: 10.5px; color: #657089; border-bottom: 1px solid #dfe4ee; }
  .items-table th.amount, .items-table td.amount { text-align: right; }
  .items-table td { padding: 11px 12px; border-bottom: 1px solid #eef1f7; font-size: 12px; }
  .amount { font-family: 'AppFont', 'DejaVu Sans', sans-serif; }
  .credit-amount { color: #047857; }
  .total-row td { font-weight: bold; font-size: 14.5px; border-top: 2px solid #1a2233; border-bottom: none; padding-top: 14px; }
  .total-row .amount { font-family: 'AppFont', 'DejaVu Sans', sans-serif; }
  .pay-notice { margin-top: 26px; padding: 14px 16px; background: #fff8ef; border: 1px solid #f0dfc0; border-radius: 8px; font-size: 11px; color: #7a5b1e; }
  .meta-line { margin-top: 22px; font-size: 10.5px; color: #657089; }
  .footer { margin-top: 46px; padding-top: 14px; border-top: 1px solid #eef1f7; font-size: 9.5px; color: #9eabc4; text-align: center; }
</style>
</head>
<body>
  <table class="brand-row"><tr>
    <td>
      <div class="brand">{{ $brandName }}</div>
      <div class="brand-sub">{{ $brandTagline }}</div>
    </td>
    <td class="invoice-title">{{ $title }}</td>
  </tr></table>
  <div class="rule"></div>

  <table class="meta-table"><tr>
    <td style="width:52%">
      <div class="muted">BILLED TO</div>
      <div class="strong i18n" style="font-size:13px; margin-top:2px">{{ $customer->name }}</div>
      @if($customer->mobile)<div class="muted">{{ $customer->mobile }}</div>@endif
      @if($customer->email)<div class="muted">{{ $customer->email }}</div>@endif
    </td>
    <td class="align-right" style="width:48%">
      <div class="muted">INVOICE NUMBER</div>
      <div class="strong" style="font-size:13px; margin-top:2px">{{ $invoiceNumber }}</div>
      <div class="muted" style="margin-top:6px">{{ $issueDate->format('d M Y, h:i A') }}</div>
      <div><span class="badge badge-{{ $statusClass }}">{{ $statusLabel }}</span></div>
    </td>
  </tr></table>

  <table class="items-table">
    <thead><tr><th>Description</th><th class="amount">Amount</th></tr></thead>
    <tbody>
      @foreach($lineItems as $item)
      <tr>
        <td>
          {{ $item['label'] }}
          @if(!empty($item['note']))<span class="i18n muted"> {{ $item['note'] }}</span>@endif
        </td>
        <td class="amount {{ $item['amount'] < 0 ? 'credit-amount' : '' }}">
          {{ $item['amount'] < 0 ? '−' : '' }}৳{{ number_format(abs($item['amount']), 2) }}
        </td>
      </tr>
      @endforeach
      <tr class="total-row">
        <td>{{ $statusClass === 'pending' ? 'Amount Due' : 'Total Paid' }}</td>
        <td class="amount">৳{{ number_format($total, 2) }}</td>
      </tr>
    </tbody>
  </table>

  @if($statusClass === 'pending')
    <div class="pay-notice">This invoice is awaiting payment. Once paid and verified, it activates automatically.</div>
  @endif

  @if($paymentMethod || $trxId || $paidAt)
    <div class="meta-line">
      @if($paymentMethod)Payment method: <span class="strong">{{ $paymentMethodLabel }}</span>@endif
      @if($trxId) &nbsp;&middot;&nbsp; TrxID: <span class="strong">{{ $trxId }}</span>@endif
      @if($paidAt) &nbsp;&middot;&nbsp; Paid: {{ $paidAt->format('d M Y, h:i A') }}@endif
    </div>
  @endif

  <div class="footer">This is a system-generated invoice from {{ $brandName }}. No signature required.</div>
</body>
</html>
