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

  {{-- ══════════════════════════ product_table_receipt ══════════════════════════ --}}
  .ptr-label { width: {{ $pageWidthMm }}mm; box-sizing: border-box; padding: {{ $g['paddingMm'] ?? 4 }}mm; font-size: 8px; line-height: 1.3; }
  .ptr-table { width: {{ $g['contentWidthMm'] ?? ($pageWidthMm - 8) }}mm; border-collapse: collapse; }
  .ptr-table td { vertical-align: top; padding: 0; }
  .ptr-bold { font-weight: bold; font-size: 11px; }
  .ptr-meta { font-size: 7px; color: #4a5563; }
  .ptr-help { font-size: 8px; margin-top: 1mm; }
  .ptr-rule { border-top: 1px solid #cbd2d9; margin: 2px 0; }
  .ptr-section { font-size: 7px; color: #4a5563; text-transform: uppercase; letter-spacing: 0.5px; }
  .ptr-muted { color: #4a5563; font-size: 7.5px; }
  .ptr-barcode { display: block; width: {{ $g['barcodeWidthMm'] ?? 20 }}mm; height: {{ $g['barcodeHeightMm'] ?? 12 }}mm; }
  .ptr-tracking { font-size: 6.5px; word-break: break-all; margin-top: 1px; }
  .ptr-items-head { font-weight: bold; border-bottom: 1px solid #101418; }
  {{-- Vertical-only padding on table cells throughout this file — see the
       pb-items-head comment above for why horizontal padding on a cell
       breaks its explicit mm width. --}}
  .ptr-items td { font-size: 7.5px; padding: 1px 0; }
  .ptr-totals { font-size: 8.5px; }
  .ptr-due { font-size: 11px; font-weight: bold; margin-top: 1px; }

  {{-- ══════════════════════════ order_note_receipt ══════════════════════════ --}}
  .onr-label { width: {{ $pageWidthMm }}mm; box-sizing: border-box; padding: {{ $g['paddingMm'] ?? 4 }}mm; font-size: 8px; line-height: 1.3; }
  .onr-table { width: {{ $g['contentWidthMm'] ?? ($pageWidthMm - 8) }}mm; border-collapse: collapse; }
  .onr-table td { vertical-align: top; padding: 0; }
  {{-- Explicit width + vertical-only padding — a colored box needs its own
       visible right edge to land exactly at its column's width. --}}
  .onr-parcel-box {
    background: #101418; color: #fff; text-align: center; padding: 1.5mm 0;
    width: {{ $g['parcelBoxColMm'] ?? 28 }}mm;
  }
  .onr-parcel-label { font-size: 6px; letter-spacing: 1px; }
  .onr-parcel-value { font-size: 9px; font-weight: bold; word-break: break-all; }
  .onr-rule { border-top: 1px solid #cbd2d9; margin: 2px 0; }
  .onr-section { font-size: 7px; color: #4a5563; text-transform: uppercase; margin-top: 1mm; }
  .onr-bold { font-weight: bold; font-size: 11px; }
  .onr-muted { color: #4a5563; font-size: 7.5px; }
  .onr-barcode { display: block; width: {{ $g['barcodeWidthMm'] ?? 60 }}mm; height: {{ $g['barcodeHeightMm'] ?? 12 }}mm; margin-top: 1mm; }
  .onr-items-head { font-weight: bold; border-bottom: 1px solid #101418; }
  .onr-items td { font-size: 7.5px; padding: 1px 0; }
  .onr-totals { font-size: 8px; }
  .onr-due { font-size: 11px; font-weight: bold; }
  .onr-note-box {
    border: 1px solid #cbd2d9; padding: 1.5mm 2mm; margin-top: 2mm;
    width: {{ ($g['contentWidthMm'] ?? ($pageWidthMm - 8)) - 4 }}mm;
  }
  .onr-note-label { font-size: 7px; color: #4a5563; text-transform: uppercase; margin-bottom: 0.5mm; }

  {{-- ══════════════════════════ retail_compact ══════════════════════════ --}}
  .rtc-label { width: {{ $pageWidthMm }}mm; box-sizing: border-box; padding: {{ $g['paddingMm'] ?? 4 }}mm; font-size: 8.5px; line-height: 1.3; }
  .rtc-table { width: {{ $g['contentWidthMm'] ?? ($pageWidthMm - 8) }}mm; border-collapse: collapse; }
  .rtc-table td { vertical-align: top; padding: 0; }
  .rtc-bold { font-weight: bold; font-size: 11px; }
  .rtc-barcode { display: block; width: {{ $g['barcodeWidthMm'] ?? 20 }}mm; height: {{ $g['barcodeHeightMm'] ?? 11 }}mm; }
  .rtc-muted { color: #4a5563; font-size: 7.5px; margin-top: 1mm; }
  .rtc-parcel { font-size: 8px; margin-top: 1mm; }
  .rtc-rule { border-top: 1px solid #cbd2d9; margin: 2px 0; }
  .rtc-items-head { font-weight: bold; border-bottom: 1px solid #101418; }
  .rtc-items td { font-size: 7.5px; padding: 1px 0; }
  .rtc-totals { font-size: 8.5px; }
  .rtc-due { font-size: 11px; font-weight: bold; }
  .rtc-note-label { font-size: 7px; color: #4a5563; text-transform: uppercase; margin-top: 1mm; }

  {{-- ══════════════════════════ qr_cod_enlarged ══════════════════════════ --}}
  .qce-label { width: {{ $pageWidthMm }}mm; box-sizing: border-box; padding: {{ $g['paddingMm'] ?? 2.5 }}mm; text-align: center; font-size: 8px; line-height: 1.3; }
  .qce-shop { font-weight: bold; font-size: 12px; }
  .qce-field-label { font-size: 6px; color: #4a5563; text-transform: uppercase; letter-spacing: 1px; margin-top: 1.2mm; }
  .qce-field-value { font-size: 12px; font-weight: bold; }
  .qce-field-value-small { font-size: 8px; font-weight: bold; }
  .qce-barcode-box {
    border: 1.5px solid #101418; padding: {{ $g['barcodeBoxPaddingMm'] ?? 2 }}mm; margin-top: 1.2mm;
    width: {{ $g['barcodeWidthMm'] ?? 40 }}mm;
  }
  .qce-barcode { display: block; width: {{ ($g['barcodeWidthMm'] ?? 40) - 1 }}mm; height: {{ $g['barcodeHeightMm'] ?? 14 }}mm; margin: 0 auto; }
  .qce-barcode-caption { font-size: 6.5px; color: #4a5563; margin-top: 1mm; letter-spacing: 1px; }
  .qce-cod-band {
    background: #101418; color: #fff; font-weight: bold; font-size: 14px; padding: 1.5mm 0; margin-top: 1.5mm;
    width: {{ $g['contentWidthMm'] ?? ($pageWidthMm - 5) }}mm;
  }

  {{-- ══════════════════════════ sku_rows_bold ══════════════════════════ --}}
  .srb-label { width: {{ $pageWidthMm }}mm; box-sizing: border-box; padding: {{ $g['paddingMm'] ?? 4 }}mm; font-size: 8.5px; line-height: 1.3; }
  .srb-table { width: {{ $g['contentWidthMm'] ?? ($pageWidthMm - 8) }}mm; border-collapse: collapse; }
  .srb-table td { vertical-align: top; padding: 0; }
  .srb-name { font-size: 11px; font-weight: bold; }
  .srb-phone { font-size: 13px; font-weight: bold; }
  .srb-barcode { display: block; width: {{ $g['barcodeWidthMm'] ?? 20 }}mm; height: {{ $g['barcodeHeightMm'] ?? 11 }}mm; }
  .srb-muted { color: #4a5563; font-size: 7.5px; margin-top: 1mm; }
  .srb-parcel { font-size: 8px; margin-top: 1mm; }
  .srb-rule { border-top: 1px solid #cbd2d9; margin: 2px 0; }
  .srb-items-head { font-weight: bold; border-bottom: 1px solid #101418; }
  .srb-items td { font-size: 9px; padding: 2px 0; }
  .srb-due { font-size: 12px; font-weight: bold; }

  {{-- ══════════════════════════ shipping_note_no_barcode ══════════════════════════ --}}
  .snb-label { width: {{ $pageWidthMm }}mm; box-sizing: border-box; padding: {{ $g['paddingMm'] ?? 4 }}mm; font-size: 8px; line-height: 1.3; }
  .snb-shop { font-weight: bold; font-size: 13px; }
  .snb-rule { border-top: 1px solid #cbd2d9; margin: 2px 0; }
  .snb-section { font-size: 7px; color: #4a5563; text-transform: uppercase; }
  .snb-bold { font-weight: bold; font-size: 11px; }
  .snb-muted { color: #4a5563; font-size: 7.5px; }
  .snb-parcel { font-size: 8px; margin-top: 1mm; }
  .snb-table { width: {{ $g['contentWidthMm'] ?? ($pageWidthMm - 8) }}mm; border-collapse: collapse; }
  .snb-items-head { font-weight: bold; border-bottom: 1px solid #101418; }
  .snb-items td { font-size: 7.5px; padding: 1px 0; }
  .snb-totals { font-size: 8px; }
  .snb-due { font-size: 11px; font-weight: bold; }
  .snb-note-box {
    border: 1px solid #cbd2d9; padding: 1.5mm 2mm; margin-top: 1.5mm; font-size: 7.5px; color: #4a5563;
    width: {{ ($g['contentWidthMm'] ?? ($pageWidthMm - 8)) - 4 }}mm;
  }

  {{-- ══════════════════════════ logo_invoice_compact ══════════════════════════ --}}
  .lic-label { width: {{ $pageWidthMm }}mm; box-sizing: border-box; padding: {{ $g['paddingMm'] ?? 2.5 }}mm; font-size: 6.5px; line-height: 1.3; }
  .lic-table { width: {{ $g['contentWidthMm'] ?? ($pageWidthMm - 5) }}mm; border-collapse: collapse; }
  .lic-table td { vertical-align: top; padding: 0; }
  .lic-logo { display: block; width: {{ $g['logoColMm'] ?? 12 }}mm; height: {{ $g['logoColMm'] ?? 12 }}mm; object-fit: contain; }
  .lic-logo-placeholder { width: {{ $g['logoColMm'] ?? 12 }}mm; height: {{ $g['logoColMm'] ?? 12 }}mm; background: #eef0f2; border-radius: 2px; }
  .lic-shop { font-size: 10px; font-weight: bold; }
  .lic-meta { font-size: 6px; color: #4a5563; }
  .lic-rule { border-top: 1px solid #cbd2d9; margin: 1px 0; }
  .lic-bold { font-weight: bold; font-size: 8px; }
  .lic-muted { color: #4a5563; }
  .lic-barcode { display: block; width: {{ $g['barcodeWidthMm'] ?? 18 }}mm; height: {{ $g['barcodeHeightMm'] ?? 8 }}mm; margin-left: auto; }
  .lic-parcel { font-size: 6.5px; margin-top: 1px; }
  .lic-items-head { font-weight: bold; border-bottom: 1px solid #101418; }
  .lic-items td { font-size: 6px; padding: 0.5px 0; }
  .lic-totals { font-size: 6.5px; margin-top: 1px; }
  .lic-due { font-size: 8px; font-weight: bold; margin-top: 1px; }
  .lic-note-label { font-size: 6px; color: #4a5563; text-transform: uppercase; margin-top: 1px; }
  .lic-note { font-size: 6px; }

  {{-- ══════════════════════════ bengali_shipping_note ══════════════════════════ --}}
  .bsn-label { width: {{ $pageWidthMm }}mm; box-sizing: border-box; padding: {{ $g['paddingMm'] ?? 3 }}mm; font-size: 7.5px; line-height: 1.3; }
  .bsn-table { width: {{ $g['contentWidthMm'] ?? ($pageWidthMm - 6) }}mm; border-collapse: collapse; }
  .bsn-table td { vertical-align: top; padding: 0; }
  .bsn-shop { font-weight: bold; font-size: 10px; }
  .bsn-bold { font-weight: bold; font-size: 8.5px; }
  .bsn-barcode { display: block; width: {{ $g['barcodeWidthMm'] ?? 18 }}mm; height: {{ $g['barcodeHeightMm'] ?? 8 }}mm; margin-left: auto; }
  .bsn-muted { color: #4a5563; font-size: 7px; margin-top: 1mm; }
  .bsn-parcel { font-size: 7.5px; margin-top: 1mm; }
  .bsn-rule { border-top: 1px solid #cbd2d9; margin: 1px 0; }
  .bsn-items-head { font-weight: bold; border-bottom: 1px solid #101418; }
  .bsn-items td { font-size: 8px; padding: 1px 0; }
  .bsn-due { font-size: 10px; font-weight: bold; margin-top: 1px; }
  .bsn-note-box {
    background: #eef4ff; border: 1px solid #b6cdfa; padding: 1.5mm 2mm; margin-top: 1.5mm; font-size: 7.5px;
    width: {{ ($g['contentWidthMm'] ?? ($pageWidthMm - 6)) - 4 }}mm;
  }

  {{-- ══════════════════════════ sku_truncate_note ══════════════════════════ --}}
  .stn-label { width: {{ $pageWidthMm }}mm; box-sizing: border-box; padding: {{ $g['paddingMm'] ?? 2.5 }}mm; font-size: 6.5px; line-height: 1.3; }
  .stn-table { width: {{ $g['contentWidthMm'] ?? ($pageWidthMm - 5) }}mm; border-collapse: collapse; }
  .stn-table td { vertical-align: top; padding: 0; }
  .stn-shop { font-weight: bold; font-size: 9px; }
  .stn-bold { font-weight: bold; }
  .stn-barcode { display: block; width: {{ $g['barcodeWidthMm'] ?? 18 }}mm; height: {{ $g['barcodeHeightMm'] ?? 8 }}mm; margin-left: auto; }
  .stn-parcel { font-size: 6.5px; margin-top: 1px; }
  .stn-rule { border-top: 1px solid #cbd2d9; margin: 1px 0; }
  .stn-items-head { font-weight: bold; border-bottom: 1px solid #101418; }
  .stn-items td { font-size: 6px; padding: 0.5px 0; }
  .stn-due { font-size: 8.5px; font-weight: bold; margin-top: 1px; }
  .stn-note-box {
    background: #fff8e6; border: 1px solid #f0d789; padding: 1.5mm 2mm; margin-top: 1.5mm; font-size: 6px;
    width: {{ ($g['contentWidthMm'] ?? ($pageWidthMm - 5)) - 4 }}mm;
  }

  {{-- ══════════════════════════ dual_note_receipt ══════════════════════════ --}}
  .dnr-label { width: {{ $pageWidthMm }}mm; box-sizing: border-box; padding: {{ $g['paddingMm'] ?? 4 }}mm; font-size: 8px; line-height: 1.3; }
  .dnr-table { width: {{ $g['contentWidthMm'] ?? ($pageWidthMm - 8) }}mm; border-collapse: collapse; }
  .dnr-table td { vertical-align: top; padding: 0; }
  .dnr-logo { display: block; width: {{ $g['logoColMm'] ?? 14 }}mm; height: {{ $g['logoColMm'] ?? 14 }}mm; object-fit: contain; }
  .dnr-logo-placeholder { width: {{ $g['logoColMm'] ?? 14 }}mm; height: {{ $g['logoColMm'] ?? 14 }}mm; background: #eef0f2; border-radius: 2px; }
  .dnr-shop { font-size: 11px; font-weight: bold; }
  .dnr-meta { font-size: 7px; color: #4a5563; }
  .dnr-rule { border-top: 1px solid #cbd2d9; margin: 2px 0; }
  .dnr-bold { font-weight: bold; font-size: 11px; }
  .dnr-muted { color: #4a5563; font-size: 7.5px; }
  .dnr-barcode { display: block; width: {{ $g['barcodeWidthMm'] ?? 20 }}mm; height: {{ $g['barcodeHeightMm'] ?? 11 }}mm; }
  .dnr-parcel { font-size: 8px; margin-top: 1mm; }
  .dnr-items-head { font-weight: bold; border-bottom: 1px solid #101418; }
  .dnr-items td { font-size: 7.5px; padding: 1px 0; }
  .dnr-due { font-size: 11px; font-weight: bold; margin-top: 1px; }
  .dnr-note-box {
    border: 1px solid #cbd2d9; padding: 1.5mm 2mm; margin-top: 1.5mm; font-size: 7.5px;
    width: {{ ($g['contentWidthMm'] ?? ($pageWidthMm - 8)) - 4 }}mm;
  }
  .dnr-note-label { font-size: 7px; color: #4a5563; text-transform: uppercase; margin-bottom: 0.5mm; }

  {{-- ══════════════════════════ sku_grid_square ══════════════════════════ --}}
  .sgs-label { width: {{ $pageWidthMm }}mm; box-sizing: border-box; padding: {{ $g['paddingMm'] ?? 4 }}mm; font-size: 8.5px; line-height: 1.3; }
  .sgs-table { width: {{ $g['contentWidthMm'] ?? ($pageWidthMm - 8) }}mm; border-collapse: collapse; }
  .sgs-table td { vertical-align: top; padding: 0; }
  .sgs-shop { font-weight: bold; font-size: 11px; }
  .sgs-bold { font-weight: bold; font-size: 10px; }
  .sgs-barcode { display: block; width: {{ $g['barcodeWidthMm'] ?? 20 }}mm; height: {{ $g['barcodeHeightMm'] ?? 10 }}mm; }
  .sgs-parcel { font-size: 8px; margin-top: 1mm; }
  .sgs-rule { border-top: 1px solid #cbd2d9; margin: 2px 0; }
  .sgs-items-head { font-weight: bold; border-bottom: 1px solid #101418; }
  .sgs-items td { font-size: 9px; padding: 1.5px 0; }
  .sgs-due { font-size: 11px; font-weight: bold; margin-top: 1px; }
  .sgs-note-box {
    border: 1px solid #cbd2d9; padding: 1.5mm 2mm; margin-top: 1.5mm; font-size: 7.5px;
    width: {{ ($g['contentWidthMm'] ?? ($pageWidthMm - 8)) - 4 }}mm;
  }

  {{-- ══════════════════════════ color_size_grid ══════════════════════════ --}}
  .csg-label { width: {{ $pageWidthMm }}mm; box-sizing: border-box; padding: {{ $g['paddingMm'] ?? 4 }}mm; font-size: 8.5px; line-height: 1.3; }
  .csg-table { width: {{ $g['contentWidthMm'] ?? ($pageWidthMm - 8) }}mm; border-collapse: collapse; }
  .csg-table td { vertical-align: top; padding: 0; }
  .csg-shop { font-weight: bold; font-size: 10px; }
  .csg-bold { font-weight: bold; font-size: 10px; }
  .csg-parcel-box {
    border: 1.5px solid #101418; text-align: center; padding: 1.5mm 0;
    width: {{ $g['parcelBoxColMm'] ?? 30 }}mm;
  }
  .csg-parcel-label { font-size: 6px; letter-spacing: 1px; color: #4a5563; }
  .csg-parcel-value { font-size: 8.5px; font-weight: bold; word-break: break-all; }
  .csg-barcode { display: block; width: {{ $g['barcodeWidthMm'] ?? 60 }}mm; height: {{ $g['barcodeHeightMm'] ?? 11 }}mm; margin-top: 2mm; }
  .csg-rule { border-top: 1px solid #cbd2d9; margin: 2px 0; }
  .csg-items-head { font-weight: bold; border-bottom: 1px solid #101418; }
  .csg-items td { font-size: 8.5px; padding: 1.5px 0; }
  .csg-variant { color: #4a5563; font-size: 7.5px; }
  .csg-summary { font-size: 9px; }
  .csg-summary-bold { font-size: 12px; font-weight: bold; }

  {{-- ══════════════════════════ minimal_list ══════════════════════════ --}}
  .ml-label { width: {{ $pageWidthMm }}mm; box-sizing: border-box; padding: {{ $g['paddingMm'] ?? 2 }}mm; text-align: center; font-size: 6.5px; line-height: 1.2; }
  .ml-shop { font-weight: bold; font-size: 11px; }
  .ml-phone { font-weight: bold; font-size: 12px; margin-top: 1mm; }
  .ml-item { margin-top: 1mm; }
  .ml-parcel { font-size: 6px; color: #4a5563; margin-top: 1.5mm; }

  {{-- ══════════════════════════ equals_price_band ══════════════════════════ --}}
  .epb-label { width: {{ $pageWidthMm }}mm; box-sizing: border-box; padding: {{ $g['paddingMm'] ?? 4 }}mm; font-size: 8px; line-height: 1.3; }
  .epb-banner {
    background: #101418; color: #fff; font-weight: bold; text-align: center; font-size: 15px; padding: 2mm 0; margin-bottom: 2mm;
    width: {{ $g['contentWidthMm'] ?? ($pageWidthMm - 8) }}mm;
  }
  .epb-table { width: {{ $g['contentWidthMm'] ?? ($pageWidthMm - 8) }}mm; border-collapse: collapse; }
  .epb-table td { vertical-align: top; padding: 0; }
  .epb-bold { font-weight: bold; font-size: 11px; }
  .epb-barcode { display: block; width: {{ $g['barcodeWidthMm'] ?? 20 }}mm; height: {{ $g['barcodeHeightMm'] ?? 11 }}mm; }
  .epb-rule { border-top: 1px solid #cbd2d9; margin: 2px 0; }
  .epb-items-head { font-weight: bold; border-bottom: 1px solid #101418; }
  .epb-items td { font-size: 8px; padding: 1.5px 0; }
  .epb-cod-band {
    background: #101418; color: #fff; font-weight: bold; font-size: 15px; padding: 2mm 0; margin-top: 2mm; text-align: center;
    width: {{ $g['contentWidthMm'] ?? ($pageWidthMm - 8) }}mm;
  }
  .epb-note-box {
    border: 1px solid #cbd2d9; padding: 1.5mm 2mm; margin-top: 2mm;
    width: {{ ($g['contentWidthMm'] ?? ($pageWidthMm - 8)) - 4 }}mm;
  }
  .epb-note-label { font-size: 7px; color: #4a5563; text-transform: uppercase; margin-bottom: 0.5mm; }

  {{-- ══════════════════════════ qr_recipient_focus ══════════════════════════ --}}
  .qrf-label { width: {{ $pageWidthMm }}mm; box-sizing: border-box; padding: {{ $g['paddingMm'] ?? 2.5 }}mm; font-size: 8px; line-height: 1.35; }
  .qrf-shop { text-align: center; font-weight: bold; font-size: 12px; }
  .qrf-cod-band {
    background: #101418; color: #fff; font-weight: bold; font-size: 18px; text-align: center; padding: 2mm 0; margin-top: 1.5mm;
    width: {{ $g['contentWidthMm'] ?? ($pageWidthMm - 5) }}mm;
  }
  .qrf-section { font-size: 7px; color: #4a5563; text-transform: uppercase; letter-spacing: 1px; margin-top: 2mm; }
  .qrf-name { font-size: 13px; font-weight: bold; }
  .qrf-muted { color: #4a5563; font-size: 8px; }
  .qrf-barcode { display: block; width: {{ $g['barcodeWidthMm'] ?? 40 }}mm; height: {{ $g['barcodeHeightMm'] ?? 11 }}mm; margin-top: 1mm; }
  .qrf-tracking { font-size: 7px; word-break: break-all; }

  {{-- ══════════════════════════ no_price_multipage ══════════════════════════ --}}
  .npm-label { width: {{ $pageWidthMm }}mm; box-sizing: border-box; padding: {{ $g['paddingMm'] ?? 3 }}mm; font-size: 8px; line-height: 1.3; }
  .npm-table { width: {{ $g['contentWidthMm'] ?? ($pageWidthMm - 6) }}mm; border-collapse: collapse; }
  .npm-table td { vertical-align: top; padding: 0; }
  .npm-shop { font-weight: bold; font-size: 10px; }
  .npm-bold { font-weight: bold; font-size: 9px; }
  .npm-barcode { display: block; width: {{ $g['barcodeWidthMm'] ?? 18 }}mm; height: {{ $g['barcodeHeightMm'] ?? 8 }}mm; margin-left: auto; }
  .npm-muted { color: #4a5563; font-size: 7.5px; margin-top: 1mm; }
  .npm-parcel { font-size: 8px; margin-top: 1mm; }
  .npm-rule { border-top: 1px solid #cbd2d9; margin: 2px 0; }
  .npm-items-head { font-weight: bold; border-bottom: 1px solid #101418; }
  .npm-items td { font-size: 8.5px; padding: 1.5px 0; }
  .npm-note-box {
    background: #eef4ff; border: 1px solid #b6cdfa; padding: 2mm; margin-top: 2mm; font-size: 8px;
    width: {{ ($g['contentWidthMm'] ?? ($pageWidthMm - 6)) - 4 }}mm;
  }
  .npm-note-label { font-size: 7px; color: #4a5563; text-transform: uppercase; margin-bottom: 1mm; font-weight: bold; }
</style>
</head>
<body>
  @foreach($labels as $label)
    @include($templateView, ['label' => $label, 'g' => $g, 'pageWidthMm' => $pageWidthMm, 'loop' => $loop])
  @endforeach
</body>
</html>
