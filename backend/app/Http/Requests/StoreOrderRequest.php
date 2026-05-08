<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'customer_name' => ['nullable', 'string', 'max:150'],
            'customer_phone' => ['required', 'string', 'max:20'],
            'customer_address' => ['nullable', 'string'],
            'customer_district' => ['nullable', 'string', 'max:100'],
            'customer_thana' => ['nullable', 'string', 'max:100'],
            'customer_area' => ['nullable', 'string', 'max:120'],
            'pathao_city_id' => ['nullable', 'integer'],
            'pathao_zone_id' => ['nullable', 'integer'],
            'pathao_area_id' => ['nullable', 'integer'],
            'source' => ['nullable', 'in:manual,facebook_inbox,landing_page'],
            'source_ref' => ['nullable', 'string', 'max:255'],
            'payment_method' => ['nullable', 'in:cod,online,bkash'],
            'payment_status' => ['nullable', 'in:due,partial,paid'],
            'shipping_charge' => ['nullable', 'numeric', 'min:0'],
            'discount' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_name' => ['required', 'string', 'max:255'],
            'items.*.product_id' => ['nullable', 'integer', 'exists:products,id'],
            'items.*.sku' => ['nullable', 'string', 'max:100'],
            'items.*.quantity' => ['required', 'integer', 'min:1'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0'],
            'items.*.variant_info' => ['nullable', 'array'],
        ];
    }
}
