<?php

/**
 * Sticker Template catalog — the fixed set of selectable label designs
 * (Settings → Sticker Templates). Each entry's `view` is a Blade partial
 * under resources/views/couriers/templates/, rendered by WaybillPdfService.
 * `widthMm`/`heightMm` are the template's *native* size — null means it
 * follows the caller's 58/80mm thermal selector instead of a fixed size
 * (only 'classic' does this today). See courier_waybill_context.md §6 for
 * the reference screenshots these were modeled on and how to add a new one.
 */
return [
    'classic' => [
        'label_bn' => 'ক্লাসিক থার্মাল',
        'label_en' => 'Classic Thermal',
        'view' => 'couriers.templates.classic',
        'widthMm' => null,
        'heightMm' => null,
        'sizeLabel' => '58mm / 80mm',
    ],
    'pathao' => [
        'label_bn' => 'পাঠাও স্টাইল',
        'label_en' => 'Pathao Style',
        'view' => 'couriers.templates.pathao',
        'widthMm' => 100,
        'heightMm' => 78,
        'sizeLabel' => '100 x 78mm',
    ],
    'cod_band_compact' => [
        'label_bn' => 'কমপ্যাক্ট COD ব্যান্ড',
        'label_en' => 'Compact COD Band',
        'view' => 'couriers.templates.cod_band_compact',
        'widthMm' => 51,
        'heightMm' => 76,
        'sizeLabel' => '2 x 3 inch',
    ],
    'invoice_table' => [
        'label_bn' => 'ইনভয়েস টেবিল',
        'label_en' => 'Invoice Table',
        'view' => 'couriers.templates.invoice_table',
        'widthMm' => 75,
        'heightMm' => 50,
        'sizeLabel' => '75 x 50mm',
    ],
    'pos_bill' => [
        'label_bn' => 'POS বিল',
        'label_en' => 'POS Bill',
        'view' => 'couriers.templates.pos_bill',
        'widthMm' => 80,
        'heightMm' => 100,
        'sizeLabel' => '80mm POS',
    ],
    'mini_cod' => [
        'label_bn' => 'মিনি COD',
        'label_en' => 'Mini COD',
        'view' => 'couriers.templates.mini_cod',
        'widthMm' => 38,
        'heightMm' => 25,
        'sizeLabel' => '38 x 25mm',
    ],

    // ── Batch 2 (2026-08-12) — see courier_waybill_context.md §6.2 ──────────
    'product_table_receipt' => [
        'label_bn' => 'প্রোডাক্ট টেবিল রিসিট',
        'label_en' => 'Product Table Receipt',
        'view' => 'couriers.templates.product_table_receipt',
        'widthMm' => 76,
        'heightMm' => 102,
        'sizeLabel' => '3 x 4 inch',
    ],
    'order_note_receipt' => [
        'label_bn' => 'অর্ডার নোট রিসিট',
        'label_en' => 'Order Note Receipt',
        'view' => 'couriers.templates.order_note_receipt',
        'widthMm' => 76,
        'heightMm' => 102,
        'sizeLabel' => '3 x 4 inch',
    ],
    'retail_compact' => [
        'label_bn' => 'রিটেইল কমপ্যাক্ট',
        'label_en' => 'Retail Compact',
        'view' => 'couriers.templates.retail_compact',
        'widthMm' => 76,
        'heightMm' => 100,
        'sizeLabel' => '3 inch (auto height)',
    ],
    'qr_cod_enlarged' => [
        'label_bn' => 'বড় COD + বারকোড',
        'label_en' => 'Enlarged COD + Barcode',
        'view' => 'couriers.templates.qr_cod_enlarged',
        'widthMm' => 50,
        'heightMm' => 92,
        'sizeLabel' => '50 x 75mm',
    ],

    // ── Batch 3 (2026-08-12) ─────────────────────────────────────────────
    'sku_rows_bold' => [
        'label_bn' => 'SKU রো + বোল্ড ফোন',
        'label_en' => 'SKU Rows (Bold Phone)',
        'view' => 'couriers.templates.sku_rows_bold',
        'widthMm' => 76,
        'heightMm' => 102,
        'sizeLabel' => '3 x 4 inch',
    ],
    'shipping_note_no_barcode' => [
        'label_bn' => 'শিপিং নোট (বারকোড ছাড়া)',
        'label_en' => 'Shipping Note (No Barcode)',
        'view' => 'couriers.templates.shipping_note_no_barcode',
        'widthMm' => 76,
        'heightMm' => 102,
        'sizeLabel' => '3 x 4 inch',
    ],
    'logo_invoice_compact' => [
        'label_bn' => 'লোগো ইনভয়েস কমপ্যাক্ট',
        'label_en' => 'Logo Invoice Compact',
        'view' => 'couriers.templates.logo_invoice_compact',
        'widthMm' => 75,
        'heightMm' => 65,
        'sizeLabel' => '75 x 50mm',
    ],
    'bengali_shipping_note' => [
        'label_bn' => 'বাংলা শিপিং নোট',
        'label_en' => 'Bengali Shipping Note',
        'view' => 'couriers.templates.bengali_shipping_note',
        'widthMm' => 75,
        'heightMm' => 62,
        'sizeLabel' => '75 x 50mm',
    ],

    // ── Batch 4 (2026-08-12) ─────────────────────────────────────────────
    'sku_truncate_note' => [
        'label_bn' => 'SKU + শিপিং নোট',
        'label_en' => 'SKU + Shipping Note',
        'view' => 'couriers.templates.sku_truncate_note',
        'widthMm' => 75,
        'heightMm' => 65,
        'sizeLabel' => '75 x 50mm',
    ],
    'dual_note_receipt' => [
        'label_bn' => 'ডাবল নোট রিসিট',
        'label_en' => 'Dual Note Receipt',
        'view' => 'couriers.templates.dual_note_receipt',
        'widthMm' => 76,
        'heightMm' => 115,
        'sizeLabel' => '3 inch (auto height)',
    ],
    'sku_grid_square' => [
        'label_bn' => 'SKU গ্রিড (স্কয়ার)',
        'label_en' => 'SKU Grid (Square)',
        'view' => 'couriers.templates.sku_grid_square',
        'widthMm' => 76,
        'heightMm' => 76,
        'sizeLabel' => '3 x 3 inch',
    ],
    'color_size_grid' => [
        'label_bn' => 'কালার/সাইজ গ্রিড',
        'label_en' => 'Color/Size Grid',
        'view' => 'couriers.templates.color_size_grid',
        'widthMm' => 76,
        'heightMm' => 102,
        'sizeLabel' => '3 x 4 inch',
    ],

    // ── Batch 5 (2026-08-12) ─────────────────────────────────────────────
    'minimal_list' => [
        'label_bn' => 'মিনিমাল লিস্ট',
        'label_en' => 'Minimal List',
        'view' => 'couriers.templates.minimal_list',
        'widthMm' => 45,
        'heightMm' => 40,
        'sizeLabel' => '45 x 35mm',
    ],
    'equals_price_band' => [
        'label_bn' => 'ব্যান্ড হেডার প্রাইস (=)',
        'label_en' => 'Banner + "=" Price Format',
        'view' => 'couriers.templates.equals_price_band',
        'widthMm' => 76,
        'heightMm' => 102,
        'sizeLabel' => '3 x 4 inch',
    ],
    'qr_recipient_focus' => [
        'label_bn' => 'রিসিপিয়েন্ট-ফোকাসড QR',
        'label_en' => 'Recipient-Focused QR',
        'view' => 'couriers.templates.qr_recipient_focus',
        'widthMm' => 50,
        'heightMm' => 88,
        'sizeLabel' => '50 x 75mm',
    ],
    'no_price_multipage' => [
        'label_bn' => 'প্রাইস ছাড়া (মাল্টি-পেজ)',
        'label_en' => 'No Price (Multi-Page)',
        'view' => 'couriers.templates.no_price_multipage',
        'widthMm' => 75,
        'heightMm' => 60,
        'sizeLabel' => '75 x 50mm',
    ],
];
