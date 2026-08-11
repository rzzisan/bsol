<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  {{-- One PDF document = one page size (dompdf has no named-@page support —
       see WaybillPdfService's class doc comment), so this is the ONE
       template ($templateKey) active for the whole document. All 6
       templates' CSS lives in this single stylesheet (prefixed per
       template) since only one set of classes is ever used per render. --}}
  @page { margin: 0; size: {{ $pageWidthMm }}mm {{ $pageHeightMm }}mm; }
  @font-face { font-family: 'AppFont'; src: url('{{ $fontRegular }}') format('truetype'); font-weight: normal; font-style: normal; }
  @font-face { font-family: 'AppFont'; src: url('{{ $fontBold }}') format('truetype'); font-weight: bold; font-style: normal; }
  * { font-family: 'DejaVu Sans', sans-serif; }
  .i18n { font-family: 'AppFont', 'DejaVu Sans', sans-serif; }
  .label-break { page-break-after: always; }

  {{-- ══════════════════════════ classic ══════════════════════════
       Layout follows the field hierarchy real BD courier labels use (per
       Steadfast/Pathao API + integration docs): barcode near the top for hub
       scanning, COD boxed and prominent (it's money to collect), recipient
       name/phone as the single largest text (what the delivery rider reads
       first) — sender/order metadata is secondary and compact.
       KNOWN DOMPDF BUG (courier_waybill_context.md §4.2): text-align:right
       or float:right on variable-length text in this width-constrained
       context drops its last character. Every template below avoids both —
       table columns instead of right-aligned cells, left-aligned amounts. --}}
  body { margin: 0; padding: 0; color: #101418; font-size: {{ $pageWidthMm == 58 ? '9px' : '10px' }}; line-height: 1.35; }
  .label {
    /* No explicit height: matching it to the @page height exactly causes
       dompdf to overflow onto a phantom blank page (sub-pixel rounding).
       The @page size already bounds each label to one physical label. */
    width: {{ $pageWidthMm }}mm; box-sizing: border-box;
    padding: {{ $g['paddingMm'] ?? 3 }}mm;
  }
  .courier-banner {
    font-size: {{ $pageWidthMm == 58 ? '13px' : '15px' }}; font-weight: bold; text-transform: uppercase;
    letter-spacing: 0.5px; text-align: center; padding-bottom: 2px;
  }
  .rule { border-top: 1px dashed #101418; margin: 3px 0; }
  .rule-heavy { border-top: 2.5px solid #101418; margin: 3px 0; }
  .cod-box {
    border: 2px solid #101418; padding: {{ $pageWidthMm == 58 ? '2mm 2mm' : '2.5mm 3mm' }}; margin-top: 3px;
    text-align: center;
  }
  .cod-label { font-size: {{ $pageWidthMm == 58 ? '7px' : '8px' }}; letter-spacing: 1px; color: #4a5563; }
  .cod-amount { font-size: {{ $pageWidthMm == 58 ? '20px' : '24px' }}; font-weight: bold; margin-top: 1px; }
  .muted { color: #4a5563; font-size: {{ $pageWidthMm == 58 ? '7.5px' : '8.5px' }}; }
  .section-label { font-size: {{ $pageWidthMm == 58 ? '7px' : '8px' }}; color: #4a5563; text-transform: uppercase; letter-spacing: 0.5px; }
  .to-name { font-size: {{ $pageWidthMm == 58 ? '17px' : '20px' }}; font-weight: bold; margin-top: 1px; }
  .to-phone { font-size: {{ $pageWidthMm == 58 ? '15px' : '17px' }}; font-weight: bold; }
  .to-address { font-size: {{ $pageWidthMm == 58 ? '9px' : '10px' }}; margin-top: 1px; }
  .from-line { font-size: {{ $pageWidthMm == 58 ? '9px' : '10px' }}; }
  .order-line { font-size: {{ $pageWidthMm == 58 ? '9px' : '10px' }}; font-weight: bold; }
  .tracking { font-size: {{ $pageWidthMm == 58 ? '12px' : '14px' }}; font-weight: bold; letter-spacing: 0.5px; word-break: break-all; }
  .footer-note { margin-top: 2px; }
  .barcode { display: block; width: {{ $g['barcodeWidthMm'] ?? 70 }}mm; height: {{ $pageWidthMm == 58 ? '11mm' : '13mm' }}; margin-top: 2px; }
  .qr-text { display: inline-block; width: {{ $g['qrTextWidthMm'] ?? 50 }}mm; vertical-align: top; }
  .qr { display: inline-block; width: {{ $g['qrSizeMm'] ?? 20 }}mm; height: {{ $g['qrSizeMm'] ?? 20 }}mm; vertical-align: top; }

  {{-- ══════════════════════════ pathao ══════════════════════════ --}}
  .label-pathao {
    width: {{ $pageWidthMm }}mm; box-sizing: border-box; padding: {{ $g['paddingMm'] ?? 3 }}mm;
    font-size: 8px; line-height: 1.4;
  }
  .p-rule { border-top: 1px solid #cbd2d9; margin: 2px 0; }
  .p-logo { font-size: 15px; font-weight: bold; color: #d4145a; letter-spacing: 0.5px; }
  .p-muted { color: #4a5563; }
  .p-bold { font-weight: bold; }
  .p-type { font-size: 8px; font-weight: bold; }
  .p-to-name { font-size: 11px; font-weight: bold; }
  .p-collect { font-size: 10px; font-weight: bold; }
  .p-tracking { font-size: 9px; font-weight: bold; letter-spacing: 0.5px; word-break: break-all; margin: 1px 0; }
  .p-barcode { display: block; width: {{ $g['barcodeWidthMm'] ?? 40 }}mm; height: {{ $g['barcodeHeightMm'] ?? 12 }}mm; }
  .p-qr { display: block; width: {{ $g['qrImgMm'] ?? 17 }}mm; height: {{ $g['qrImgMm'] ?? 17 }}mm; }
  .p-table { width: {{ $g['contentWidthMm'] ?? ($pageWidthMm - 6) }}mm; border-collapse: collapse; }
  .p-table td { vertical-align: top; padding: 0; }

  {{-- ══════════════════════════ cod_band_compact ══════════════════════════ --}}
  .cbc-label { width: {{ $pageWidthMm }}mm; box-sizing: border-box; padding: {{ $g['paddingMm'] ?? 2 }}mm; text-align: center; font-size: 8px; line-height: 1.25; }
  {{-- Explicit content-width + box-sizing:border-box on both black bands —
       see the .pb-total-band comment above for why a div's auto width
       can't be trusted to respect the parent's padding here. --}}
  .cbc-banner {
    background: #101418; color: #fff; font-weight: bold; font-style: italic; font-size: 13px; padding: 1.5mm 0;
    width: {{ $g['contentWidthMm'] ?? ($pageWidthMm - 4) }}mm; box-sizing: border-box;
  }
  .cbc-id { font-size: 12px; font-weight: bold; margin-top: 2mm; }
  .cbc-name { font-size: 11px; font-weight: bold; margin-top: 1mm; }
  .cbc-phone { font-size: 11px; font-weight: bold; }
  .cbc-cod {
    background: #101418; color: #fff; font-weight: bold; font-size: 13px; padding: 1.5mm 0; margin: 1.5mm 0;
    width: {{ $g['contentWidthMm'] ?? ($pageWidthMm - 4) }}mm; box-sizing: border-box;
  }
  .cbc-products { font-size: 8px; margin-top: 1mm; }
  .cbc-note { font-size: 8px; margin-top: 1mm; }
  {{-- margin:auto centers a fixed-mm-width block image without relying on
       the img's own percentage width (the established-unsafe pattern). --}}
  .cbc-barcode { display: block; width: {{ $g['barcodeWidthMm'] ?? 40 }}mm; height: 10mm; margin: 1.5mm auto 0; }
  .cbc-tracking { font-size: 7px; margin-top: 1mm; }

  {{-- ══════════════════════════ invoice_table ══════════════════════════ --}}
  .it-label { width: {{ $pageWidthMm }}mm; box-sizing: border-box; padding: {{ $g['paddingMm'] ?? 2.5 }}mm; font-size: 6.5px; line-height: 1.3; }
  .it-table { width: {{ $g['contentWidthMm'] ?? ($pageWidthMm - 5) }}mm; border-collapse: collapse; }
  .it-table td { vertical-align: top; padding: 0; }
  .it-shop { font-size: 10px; font-weight: bold; }
  .it-meta { text-align: left; font-size: 6px; color: #4a5563; }
  .it-bold { font-weight: bold; font-size: 8px; }
  .it-muted { color: #4a5563; }
  .it-rule { border-top: 1px solid #cbd2d9; margin: 1px 0; }
  .it-barcode-cell { text-align: right; width: 22mm; }
  .it-barcode { display: block; width: {{ $g['barcodeColMm'] ?? 20 }}mm; height: {{ $g['barcodeHeightMm'] ?? 8 }}mm; margin-left: auto; }
  .it-parcel { font-size: 6.5px; margin-top: 1px; }
  .it-items-head { font-weight: bold; border-bottom: 1px solid #101418; }
  .it-items td { font-size: 6px; padding: 0.5px 0; }
  .it-totals { font-size: 6.5px; margin-top: 1px; }
  .it-due { font-size: 8px; font-weight: bold; margin-top: 1px; }
  .it-note { font-size: 6px; color: #4a5563; margin-top: 1px; }

  {{-- ══════════════════════════ pos_bill ══════════════════════════ --}}
  .pb-label { width: {{ $pageWidthMm }}mm; box-sizing: border-box; padding: {{ $g['paddingMm'] ?? 3.5 }}mm; font-size: 9px; line-height: 1.35; }
  .pb-shop { text-align: center; font-size: 18px; font-weight: bold; }
  .pb-subtitle { text-align: center; font-size: 8px; color: #4a5563; letter-spacing: 1px; text-transform: uppercase; }
  .pb-rule { border-top: 1px solid #101418; margin: 2px 0; }
  .pb-table { width: {{ $g['contentWidthMm'] ?? ($pageWidthMm - 7) }}mm; border-collapse: collapse; }
  .pb-table td { vertical-align: top; padding: 0; }
  .pb-right-col { width: 40mm; }
  .pb-items-head { background: #101418; color: #fff; font-weight: bold; }
  {{-- dompdf has NO box-sizing support at all (not even the property is
       recognized) — an explicit width is always content-box: padding adds
       on top of it, it never subtracts. A td's horizontal padding here
       was pushing the table ~4mm past the page's right edge (each of 4
       columns' declared mm width + its own padding > the column's actual
       share). Vertical-only padding sidesteps it entirely — matches
       .it-items td / .p-table td elsewhere in this file. --}}
  .pb-items-head td, .pb-items td { font-size: 8px; padding: 1px 0; }
  .pb-subtotal { font-size: 9px; margin-top: 2px; }
  {{-- Confirmed via an isolated dompdf test (courier_waybill_context.md
       §6.4): width:auto on a block child does NOT fill "parent's content
       area minus parent's own padding" the way real CSS would — it fills
       the parent's literal declared `width` value (here $pageWidthMm, the
       FULL page width, not the padded content width), because .pb-label's
       own width:80mm is itself already content-box-oversized (padding
       adds on top of it, same rule as every explicit-width element here).
       So auto-width children bleed straight to the page edge. The only
       reliable fix is what the rest of this file already does: give every
       visible child an EXPLICIT width equal to the intended content width,
       here minus this band's own 2mm+2mm horizontal padding (since that
       padding still adds on top of an explicit width too — dompdf has no
       box-sizing support at all, explicit width is always content-only). --}}
  .pb-total-band {
    background: #101418; color: #fff; font-weight: bold; font-size: 13px;
    padding: 2mm 2mm; margin: 2px 0;
    width: {{ ($g['contentWidthMm'] ?? ($pageWidthMm - 7)) - 4 }}mm;
  }
  .pb-barcode { display: block; width: {{ $g['barcodeWidthMm'] ?? 70 }}mm; height: 13mm; margin-top: 2mm; }
  .pb-tracking { font-size: 8px; text-align: center; }

  {{-- ══════════════════════════ mini_cod ══════════════════════════ --}}
  .mc-label { width: {{ $pageWidthMm }}mm; box-sizing: border-box; padding: {{ $g['paddingMm'] ?? 1.5 }}mm; text-align: center; font-size: 6px; line-height: 1.2; }
  .mc-shop { font-weight: bold; font-size: 9px; }
  .mc-barcode { display: block; width: {{ $g['barcodeWidthMm'] ?? 30 }}mm; height: 7mm; margin: 1mm auto; }
  .mc-parcel { font-size: 6px; }
  .mc-cod { font-weight: bold; font-size: 11px; margin-top: 1mm; }
</style>
</head>
<body>
  @foreach($labels as $label)
    @include($templateView, ['label' => $label, 'g' => $g, 'pageWidthMm' => $pageWidthMm, 'loop' => $loop])
  @endforeach
</body>
</html>
