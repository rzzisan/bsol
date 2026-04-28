<?php

namespace App\Services;

class NotificationTemplateRenderer
{
    /**
     * @param  array<string, mixed>  $variables
     * @return array{rendered: string, placeholders: array<int, string>, missing: array<int, string>}
     */
    public function render(string $content, array $variables): array
    {
        $placeholders = $this->extractPlaceholders($content);
        $missing = [];

        $rendered = preg_replace_callback('/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/', function (array $matches) use ($variables, &$missing) {
            $key = $matches[1];

            if (! array_key_exists($key, $variables) || $variables[$key] === null) {
                $missing[] = $key;

                return $matches[0];
            }

            return (string) $variables[$key];
        }, $content) ?? $content;

        return [
            'rendered' => $rendered,
            'placeholders' => $placeholders,
            'missing' => array_values(array_unique($missing)),
        ];
    }

    /**
     * @return array<int, string>
     */
    public function extractPlaceholders(string $content): array
    {
        preg_match_all('/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/', $content, $matches);

        return array_values(array_unique($matches[1] ?? []));
    }
}
