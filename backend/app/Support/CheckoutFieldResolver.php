<?php

namespace App\Support;

use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;

/**
 * Single source of truth for the landing-page checkout form's field
 * definitions — shared by the public order-submission validation and the
 * order-creation snapshot. Mirrors DEFAULT_CHECKOUT_FIELDS in
 * frontend/src/lib/landing-pages.ts; keep both in sync.
 */
class CheckoutFieldResolver
{
    private const BUILTIN_RULES = [
        'customer_name' => ['string', 'max:150'],
        'customer_phone' => ['string', 'max:20'],
        'customer_address' => ['string', 'max:500'],
        'customer_district' => ['string', 'max:100'],
        'customer_thana' => ['string', 'max:100'],
        'customer_area' => ['string', 'max:120'],
        'notes' => ['string', 'max:1000'],
    ];

    private const BUILTIN_LABELS = [
        'bn' => [
            'customer_name' => 'নাম',
            'customer_phone' => 'ফোন নম্বর',
            'customer_address' => 'ঠিকানা',
            'customer_district' => 'জেলা',
            'customer_thana' => 'থানা',
            'customer_area' => 'এলাকা',
            'notes' => 'অতিরিক্ত নোট',
        ],
        'en' => [
            'customer_name' => 'Name',
            'customer_phone' => 'Phone number',
            'customer_address' => 'Address',
            'customer_district' => 'District',
            'customer_thana' => 'Thana',
            'customer_area' => 'Area',
            'notes' => 'Additional notes',
        ],
    ];

    private const REQUIRED_BY_DEFAULT = ['customer_name', 'customer_phone', 'customer_address'];

    /** 11-digit BD mobile number: 01 + operator digit 3-9 + 8 digits. */
    public const BD_PHONE_REGEX = '/^01[3-9]\d{8}$/';

    public static function defaultFields(string $language = 'bn'): array
    {
        $labels = self::BUILTIN_LABELS[$language] ?? self::BUILTIN_LABELS['bn'];

        return collect(array_keys(self::BUILTIN_RULES))->map(fn (string $key) => [
            'key' => $key,
            'kind' => 'builtin',
            'label' => $labels[$key],
            'required' => in_array($key, self::REQUIRED_BY_DEFAULT, true),
            'enabled' => true,
        ])->values()->all();
    }

    /**
     * Normalize a page's saved content.checkout_fields, falling back to
     * defaults when absent. customer_phone is always forced
     * enabled+required regardless of what was stored — too much
     * downstream logic (customer sync, fraud scoring, courier contact)
     * depends on it. $language only affects the fallback label used when
     * customer_phone is missing from $rawFields entirely.
     */
    public static function resolve(?array $rawFields, string $language = 'bn'): array
    {
        $fields = empty($rawFields)
            ? collect(self::defaultFields($language))
            : collect($rawFields)
                ->filter(fn ($f) => is_array($f) && !empty($f['key']))
                ->map(function (array $f): array {
                    $kind = ($f['kind'] ?? null) === 'custom' ? 'custom' : 'builtin';
                    $normalized = [
                        'key' => (string) $f['key'],
                        'kind' => $kind,
                        'label' => trim((string) ($f['label'] ?? $f['key'])) ?: (string) $f['key'],
                        'required' => (bool) ($f['required'] ?? false),
                        'enabled' => (bool) ($f['enabled'] ?? true),
                    ];
                    if ($kind === 'custom') {
                        $type = $f['type'] ?? 'text';
                        $normalized['type'] = in_array($type, ['text', 'textarea', 'select'], true) ? $type : 'text';
                        if ($normalized['type'] === 'select') {
                            $normalized['options'] = collect($f['options'] ?? [])
                                ->map(fn ($o) => trim((string) $o))
                                ->filter()
                                ->values()
                                ->all();
                        }
                    }
                    return $normalized;
                })
                ->values();

        $phoneIndex = $fields->search(fn (array $f) => $f['kind'] === 'builtin' && $f['key'] === 'customer_phone');
        if ($phoneIndex === false) {
            $fields->push([
                'key' => 'customer_phone',
                'kind' => 'builtin',
                'label' => (self::BUILTIN_LABELS[$language] ?? self::BUILTIN_LABELS['bn'])['customer_phone'],
                'required' => true,
                'enabled' => true,
            ]);
        } else {
            $phone = $fields[$phoneIndex];
            $phone['required'] = true;
            $phone['enabled'] = true;
            $fields[$phoneIndex] = $phone;
        }

        return $fields->values()->all();
    }

    /** Build Laravel validation rules for the incoming request from resolved fields. */
    public static function buildRules(array $resolvedFields, bool $phoneValidationEnabled = false): array
    {
        $rules = [];

        foreach ($resolvedFields as $field) {
            if (!$field['enabled']) {
                continue;
            }

            if ($field['kind'] === 'builtin') {
                $base = self::BUILTIN_RULES[$field['key']] ?? ['string', 'max:255'];
                if ($field['key'] === 'customer_phone' && $phoneValidationEnabled) {
                    $base = array_merge($base, ['regex:' . self::BD_PHONE_REGEX]);
                }
                $rules[$field['key']] = array_merge([$field['required'] ? 'required' : 'nullable'], $base);
                continue;
            }

            $base = [$field['required'] ? 'required' : 'nullable', 'string', 'max:1000'];
            if (($field['type'] ?? 'text') === 'select' && !empty($field['options'])) {
                $base[] = Rule::in($field['options']);
            }
            $rules["custom_fields.{$field['key']}"] = $base;
        }

        return $rules;
    }

    /** Snapshot {key,label,value} for enabled custom fields present in the validated request, for storage on the order. */
    public static function snapshotCustomFields(array $resolvedFields, array $validated): array
    {
        $submitted = $validated['custom_fields'] ?? [];
        $snapshot = [];

        foreach ($resolvedFields as $field) {
            if ($field['kind'] !== 'custom' || !$field['enabled']) {
                continue;
            }
            $value = $submitted[$field['key']] ?? null;
            if ($value === null || $value === '') {
                continue;
            }
            $snapshot[] = [
                'key' => $field['key'],
                'label' => $field['label'],
                'value' => $value,
            ];
        }

        return $snapshot;
    }
}
