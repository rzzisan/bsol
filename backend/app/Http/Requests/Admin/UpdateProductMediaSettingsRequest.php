<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProductMediaSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'max_gallery_images' => ['required', 'integer', 'min:1', 'max:20'],
            'max_file_size_mb' => ['required', 'integer', 'min:1', 'max:20'],
            'allowed_mime_types' => ['required', 'array', 'min:1'],
            'allowed_mime_types.*' => ['string', 'max:120'],
            'min_width' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'min_height' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'max_width' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'max_height' => ['nullable', 'integer', 'min:1', 'max:10000'],
            'thumbnail_required' => ['required', 'boolean'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
