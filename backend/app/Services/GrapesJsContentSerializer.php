<?php

namespace App\Services;

/**
 * Translates GrapesJS editor output into the same `content` JSON schema
 * `public-landing-page-view.tsx` renders, so publishing from the visual
 * editor actually changes the live page (it previously only wrote to
 * `editor_state`, which the public page never reads).
 *
 * The decorative GrapesJS blocks (button/hero/testimonials/cta in
 * grapesjs-elements/custom-elements.ts) don't carry a stable marker tying a
 * canvas component back to a specific `content` key, so anything left over
 * after extraction below is treated as one freeform `html_sections` entry
 * (GrapesJS's own getHtml()/getCss() output). The content-bound blocks
 * (grapesjs-elements/content-blocks.ts: feature/review/carousel) DO carry a
 * stable `data-content-*` marker, so those are parsed out into the matching
 * structured `content` arrays instead of being left as raw HTML. `faq`,
 * `contact`, and `shipping` have no GrapesJS block yet, so they're preserved
 * untouched from whatever Quick Edit last wrote.
 */
class GrapesJsContentSerializer
{
    private const CHECKOUT_PLACEHOLDER_ATTR = 'data-landing-checkout-placeholder';
    private const FEATURE_ATTR = 'data-content-feature';
    private const REVIEW_ATTR = 'data-content-review';
    private const CAROUSEL_ATTR = 'data-content-carousel';
    private const CAROUSEL_IMAGES_ATTR = 'data-carousel-images';
    private const CAROUSEL_TITLE_ATTR = 'data-carousel-title';

    public function toContent(?string $htmlOutput, ?string $cssOutput, array $existingContent): array
    {
        $content = $existingContent;
        $html = trim($this->stripCheckoutPlaceholder((string) $htmlOutput));

        if ($html === '') {
            return $content;
        }

        $heroHeadline = $this->extractHeroHeadline($html);

        [$html, $features] = $this->extractFeatures($html);
        [$html, $reviews] = $this->extractReviews($html);
        [$html, $carousels] = $this->extractCarousels($html);

        if ($features !== null) {
            $content['features'] = $features;
        }
        if ($reviews !== null) {
            $content['reviews'] = $reviews;
        }
        if ($carousels !== null) {
            $content['carousel_images'] = $carousels;
        }

        $html = trim($html);
        if (!empty($cssOutput)) {
            $html = '<style>' . $cssOutput . '</style>' . "\n" . $html;
        }
        $content['html_sections'] = $html !== '' ? [['title' => '', 'html' => $html]] : [];

        if ($heroHeadline !== null) {
            $content['hero'] = array_merge($content['hero'] ?? [], ['headline' => $heroHeadline]);
        }

        if (empty($content['layout_order'])) {
            $content['layout_order'] = ['html_sections', 'carousel_images', 'features', 'faq', 'reviews', 'products'];
        }

        return $content;
    }

    /**
     * @return array{0: string, 1: ?array<int, array{title: string, description: string}>}
     */
    private function extractFeatures(string $html): array
    {
        $pattern = '/<div(?=[^>]*\b' . preg_quote(self::FEATURE_ATTR, '/') . '\b)[^>]*>(.*?)<\/div>/is';
        if (!preg_match_all($pattern, $html, $matches, PREG_SET_ORDER)) {
            return [$html, null];
        }

        $features = [];
        foreach ($matches as $match) {
            $features[] = [
                'title' => $this->extractField($match[1], 'title'),
                'description' => $this->extractField($match[1], 'description'),
            ];
        }

        return [(string) preg_replace($pattern, '', $html), $features];
    }

    /**
     * @return array{0: string, 1: ?array<int, array{name: string, quote: string}>}
     */
    private function extractReviews(string $html): array
    {
        $pattern = '/<div(?=[^>]*\b' . preg_quote(self::REVIEW_ATTR, '/') . '\b)[^>]*>(.*?)<\/div>/is';
        if (!preg_match_all($pattern, $html, $matches, PREG_SET_ORDER)) {
            return [$html, null];
        }

        $reviews = [];
        foreach ($matches as $match) {
            $reviews[] = [
                'name' => $this->extractField($match[1], 'name'),
                'quote' => $this->extractField($match[1], 'quote'),
            ];
        }

        return [(string) preg_replace($pattern, '', $html), $reviews];
    }

    /**
     * @return array{0: string, 1: ?array<int, array{title: string, template: string, images: array<int, array{url: string, alt: string}>}>}
     */
    private function extractCarousels(string $html): array
    {
        $pattern = '/<div(?=[^>]*\b' . preg_quote(self::CAROUSEL_ATTR, '/') . '\b)([^>]*)>(?:(?!<div\b).)*?<div(?=[^>]*\b'
            . preg_quote(self::CAROUSEL_IMAGES_ATTR, '/') . '\b)[^>]*>(.*?)<\/div>\s*<\/div>/is';

        if (!preg_match_all($pattern, $html, $matches, PREG_SET_ORDER)) {
            return [$html, null];
        }

        $carousels = [];
        foreach ($matches as $match) {
            $title = '';
            if (preg_match('/' . preg_quote(self::CAROUSEL_TITLE_ATTR, '/') . '=["\']([^"\']*)["\']/i', $match[1], $titleMatch)) {
                $title = html_entity_decode($titleMatch[1]);
            }

            preg_match_all('/<img[^>]+src=["\']([^"\']+)["\']/i', $match[2], $imgMatches);
            $images = array_map(fn (string $url) => ['url' => $url, 'alt' => ''], $imgMatches[1]);

            if (!empty($images)) {
                $carousels[] = ['title' => $title, 'template' => 'style-1', 'images' => $images];
            }
        }

        return [(string) preg_replace($pattern, '', $html), $carousels];
    }

    private function extractField(string $blockHtml, string $fieldName): string
    {
        if (preg_match('/data-field=["\']' . preg_quote($fieldName, '/') . '["\'][^>]*>(.*?)<\//is', $blockHtml, $match)) {
            return trim(strip_tags($match[1]));
        }

        return '';
    }

    /**
     * The GrapesJS "Products & Checkout" block is a static visual marker for
     * where the real (React, server-rendered) checkout form appears on the
     * public page — it must never be saved as literal page content, or the
     * placeholder text would show up next to the real checkout form.
     */
    private function stripCheckoutPlaceholder(string $html): string
    {
        return (string) preg_replace(
            '/<div[^>]*' . preg_quote(self::CHECKOUT_PLACEHOLDER_ATTR, '/') . '[^>]*>[\s\S]*?<\/div>/i',
            '',
            $html
        );
    }

    private function extractHeroHeadline(string $html): ?string
    {
        if (preg_match('/<h[12][^>]*>(.*?)<\/h[12]>/is', $html, $matches)) {
            $text = trim(strip_tags($matches[1]));

            return $text !== '' ? $text : null;
        }

        return null;
    }
}
