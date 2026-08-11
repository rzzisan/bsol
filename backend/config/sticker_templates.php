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
];
