<?php

namespace App\Support;

use Illuminate\Validation\ValidationException;

/**
 * Checks the free-form `content` and `theme_settings` JSON a seller saves
 * from the landing page builder. The public page also guards these values
 * when rendering; this keeps bad values from being stored at all.
 *
 * Rules: a size cap, block lists that really are lists, links limited to
 * the schemes the page renders (safeLinkUrl in block-views.tsx), image URLs
 * that are plain http(s) or site paths (they end up inside CSS url()), and
 * hex colors (they end up inside <style>).
 */
class LandingContentValidator
{
    public const MAX_CONTENT_BYTES = 512 * 1024;

    public const MAX_ITEMS_PER_BLOCK = 100;

    private const BLOCK_ARRAYS = [
        'html_sections', 'carousel_images', 'features', 'faq', 'reviews',
        'rich_text_blocks', 'image_text_blocks', 'video_embeds', 'trust_badges',
        'countdown_blocks', 'spacers', 'button_blocks', 'price_boxes',
        'checklists', 'guarantees', 'galleries', 'before_after_blocks',
    ];

    // block type => fields holding a link
    private const LINK_FIELDS = [
        'button_blocks' => ['url'],
        'image_text_blocks' => ['cta_url'],
    ];

    // block type => fields holding an image URL
    private const IMAGE_FIELDS = [
        'image_text_blocks' => ['image_url'],
        'reviews' => ['avatar_url'],
        'before_after_blocks' => ['before_url', 'after_url'],
    ];

    // block types whose items carry an `images` list of {url}
    private const IMAGE_LIST_BLOCKS = ['carousel_images', 'galleries'];

    // Shown in front of an error so the seller knows which block to fix.
    private const LABELS = [
        'carousel_images' => 'Image carousel', 'reviews' => 'Review', 'image_text_blocks' => 'Image + text block',
        'button_blocks' => 'Button', 'galleries' => 'Image gallery', 'before_after_blocks' => 'Before / after block',
    ];

    private array $errors = [];

    public static function validate(?array $content, ?array $theme): void
    {
        $validator = new self();
        if ($content !== null) {
            $validator->checkContent($content);
        }
        if ($theme !== null) {
            $validator->checkTheme($theme);
        }

        if ($validator->errors) {
            throw ValidationException::withMessages($validator->errors);
        }
    }

    private function checkContent(array $content): void
    {
        if (strlen((string) json_encode($content)) > self::MAX_CONTENT_BYTES) {
            $this->errors['content'] = 'Page content is too large. Remove some blocks or long text.';

            return;
        }

        foreach (self::BLOCK_ARRAYS as $type) {
            if (! array_key_exists($type, $content) || $content[$type] === null) {
                continue;
            }
            $items = $content[$type];
            if (! is_array($items) || ! array_is_list($items)) {
                $this->errors["content.{$type}"] = 'Must be a list of blocks.';
                continue;
            }
            if (count($items) > self::MAX_ITEMS_PER_BLOCK) {
                $this->errors["content.{$type}"] = 'At most ' . self::MAX_ITEMS_PER_BLOCK . ' blocks of one kind are allowed.';
                continue;
            }

            foreach ($items as $index => $item) {
                $path = "content.{$type}.{$index}";
                $label = (self::LABELS[$type] ?? 'Block') . ' ' . ($index + 1) . ': ';
                if (! is_array($item)) {
                    $this->errors[$path] = 'Each block must be an object.';
                    continue;
                }
                foreach (self::LINK_FIELDS[$type] ?? [] as $field) {
                    $this->checkLink($item[$field] ?? null, "{$path}.{$field}", $label);
                }
                foreach (self::IMAGE_FIELDS[$type] ?? [] as $field) {
                    $this->checkImage($item[$field] ?? null, "{$path}.{$field}", $label);
                }
                if (in_array($type, self::IMAGE_LIST_BLOCKS, true) && is_array($item['images'] ?? null)) {
                    foreach ($item['images'] as $i => $image) {
                        $this->checkImage(is_array($image) ? ($image['url'] ?? null) : $image, "{$path}.images.{$i}.url", $label);
                    }
                }
                if (is_array($item['block_style'] ?? null)) {
                    $this->checkColor($item['block_style']['bg_color'] ?? null, "{$path}.block_style.bg_color", $label);
                    $this->checkColor($item['block_style']['text_color'] ?? null, "{$path}.block_style.text_color", $label);
                }
            }
        }

        $this->checkImage($content['hero']['background_image_url'] ?? null, 'content.hero.background_image_url', 'Hero: ');

        if (is_array($content['notice_bar'] ?? null)) {
            $this->checkLink($content['notice_bar']['url'] ?? null, 'content.notice_bar.url', 'Notice bar: ');
            $this->checkColor($content['notice_bar']['bg_color'] ?? null, 'content.notice_bar.bg_color', 'Notice bar: ');
            $this->checkColor($content['notice_bar']['text_color'] ?? null, 'content.notice_bar.text_color', 'Notice bar: ');
        }

        if (array_key_exists('layout_order', $content) && $content['layout_order'] !== null) {
            $order = $content['layout_order'];
            $valid = is_array($order) && array_is_list($order) && count($order) <= self::MAX_ITEMS_PER_BLOCK * count(self::BLOCK_ARRAYS);
            foreach ($valid ? $order : [] as $entry) {
                $ok = is_string($entry)
                    || (is_array($entry) && is_string($entry['type'] ?? null) && is_string($entry['id'] ?? null));
                if (! $ok) {
                    $valid = false;
                    break;
                }
            }
            if (! $valid) {
                $this->errors['content.layout_order'] = 'Block order is not valid.';
            }
        }
    }

    private function checkTheme(array $theme): void
    {
        foreach ($theme as $key => $value) {
            if (is_string($key) && str_ends_with($key, '_color')) {
                $this->checkColor($value, "theme_settings.{$key}", 'Theme: ');
            }
        }
    }

    private function checkLink(mixed $value, string $path, string $label = ''): void
    {
        if ($value === null || $value === '') {
            return;
        }
        $url = is_string($value) ? trim($value) : '';
        $ok = $url !== ''
            && ! preg_match('/[\s<>"\'\\\\]/', $url)
            && (preg_match('#^https?://[^/]#i', $url)
                || preg_match('#^(tel|mailto):.+#i', $url)
                || str_starts_with($url, '#')
                || (str_starts_with($url, '/') && ! str_starts_with($url, '//')));
        if (! $ok) {
            $this->errors[$path] = $label . 'link must start with http://, https://, tel:, mailto:, # or /.';
        }
    }

    private function checkImage(mixed $value, string $path, string $label = ''): void
    {
        if ($value === null || $value === '') {
            return;
        }
        $url = is_string($value) ? $value : '';
        $ok = $url !== ''
            && ! preg_match('/[\s<>"\'()\\\\]/', $url)
            && (preg_match('#^https?://[^/]#i', $url) || (str_starts_with($url, '/') && ! str_starts_with($url, '//')));
        if (! $ok) {
            $this->errors[$path] = $label . 'image must be an http(s) link or a path on this site.';
        }
    }

    private function checkColor(mixed $value, string $path, string $label = ''): void
    {
        if ($value === null || $value === '') {
            return;
        }
        if (! is_string($value) || ! preg_match('/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i', $value)) {
            $this->errors[$path] = $label . 'color must be a hex value like #1f7a6b.';
        }
    }
}
