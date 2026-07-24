<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;

class CartFlowsImportService
{
    private const CHECKOUT_MARKER = '<!-- CHECKOUT SHORTCODE -->';

    /**
     * Parse a CartFlows/Elementor export (as exported by WordPress) and
     * return normalized content ready to seed a LandingTemplate.
     *
     * @return array{title: string, hero: array, html: string, warnings: array<int, string>}
     */
    public function parse(string $rawJsonContents, string $templateCode): array
    {
        $warnings = [];

        $decoded = json_decode($rawJsonContents, true);
        if (is_string($decoded)) {
            // These exports are commonly double-JSON-encoded (a JSON string
            // literal containing another JSON document).
            $decoded = json_decode($decoded, true);
            $warnings[] = 'ফাইলটি ডাবল-এনকোডেড JSON ছিল, স্বয়ংক্রিয়ভাবে ঠিক করা হয়েছে।';
        }

        if (!is_array($decoded) || empty($decoded)) {
            throw new RuntimeException('অবৈধ JSON ফরম্যাট — CartFlows export বলে মনে হচ্ছে না।');
        }

        $flow = $decoded[0] ?? [];
        $title = $flow['title'] ?? 'Imported Landing Page';

        $steps = collect($flow['steps'] ?? []);
        if ($steps->isEmpty()) {
            throw new RuntimeException('এই JSON-এ কোনো funnel step পাওয়া যায়নি।');
        }

        $checkoutStep = $steps->firstWhere('type', 'checkout') ?? $steps->first();
        $postContent = (string) ($checkoutStep['post_content'] ?? '');

        if ($postContent === '') {
            $warnings[] = 'নির্বাচিত step-এ কোনো post_content পাওয়া যায়নি — টেমপ্লেট খালি হতে পারে।';
        }

        if (str_contains($postContent, self::CHECKOUT_MARKER)) {
            $html = Str::before($postContent, self::CHECKOUT_MARKER);
        } else {
            $html = $postContent;
            if ($postContent !== '') {
                $warnings[] = 'Checkout শর্টকোড মার্কার পাওয়া যায়নি — পুরনো সাইটের চেকআউট ফর্মের অংশ HTML-এ থেকে যেতে পারে, প্রিভিউ ভালোভাবে যাচাই করুন।';
            }
        }

        $heroHeadline = $this->extractHeroHeadline($html) ?? $title;

        [$html, $imageWarnings] = $this->rehostImages($html, $templateCode);
        $warnings = array_merge($warnings, $imageWarnings);

        $html = $this->prependElementorBaseCss($html);

        return [
            'title' => $title,
            'hero' => [
                'headline' => $heroHeadline,
                'subheadline' => '',
                'cta_text' => 'অর্ডার করতে চাই',
            ],
            'html' => $html,
            'warnings' => $warnings,
        ];
    }

    public function parseFile(string $absolutePath, string $templateCode): array
    {
        return $this->parse((string) file_get_contents($absolutePath), $templateCode);
    }

    /**
     * The exported post_content only ever carries a handful of per-widget
     * inline <style> blocks (if any at all — many sites have none). All of
     * Elementor's actual layout/spacing/typography rules (.elementor-column,
     * .elementor-button, .elementor-heading-title, flex/grid layout,
     * responsive breakpoints, etc.) live in a compiled CSS file cached on
     * the original WordPress server, which isn't part of this export format
     * at all — so without this, imported content is readable text with
     * (since the earlier fixes) correctly-sized images/icons, but no real
     * layout. This bundles Elementor's actual open-source base stylesheet
     * (resources/elementor/frontend-base.min.css, pulled from the official
     * WordPress.org plugin release — not site-specific, so safe to reuse
     * for any Elementor export) to restore that structure. Site-specific
     * colors/fonts from the original site's "Site Settings" are still not
     * recoverable, since those are compiled into that same missing
     * server-side CSS file.
     */
    private function prependElementorBaseCss(string $html): string
    {
        static $css = null;
        if ($css === null) {
            $path = resource_path('elementor/frontend-base.min.css');
            $css = is_file($path) ? (string) file_get_contents($path) : '';
        }

        if ($css === '') {
            return $html;
        }

        return '<style>' . $css . '</style>' . "\n" . $html;
    }

    private function extractHeroHeadline(string $html): ?string
    {
        if (preg_match('/<h[12][^>]*>(.*?)<\/h[12]>/is', $html, $matches)) {
            $text = trim(strip_tags($matches[1]));

            return $text !== '' ? $text : null;
        }

        return null;
    }

    /**
     * Download every hotlinked <img src="..."> and rehost it on our own
     * storage, rewriting the HTML to point at the new local URL.
     *
     * @return array{0: string, 1: array<int, string>}
     */
    private function rehostImages(string $html, string $templateCode): array
    {
        $warnings = [];

        if (!preg_match_all('/<img[^>]+src=["\']([^"\']+)["\']/i', $html, $matches)) {
            return [$html, $warnings];
        }

        $urls = array_unique($matches[1]);

        foreach ($urls as $url) {
            if (!str_starts_with($url, 'http://') && !str_starts_with($url, 'https://')) {
                continue;
            }

            try {
                $response = Http::timeout(15)->get($url);
            } catch (\Throwable) {
                $warnings[] = "ছবি ডাউনলোড ব্যর্থ হয়েছে, hotlink রয়ে গেছে: {$url}";
                continue;
            }

            $contentType = (string) $response->header('Content-Type');
            if (!$response->successful() || !str_starts_with($contentType, 'image/')) {
                $warnings[] = "ছবি ডাউনলোড ব্যর্থ হয়েছে, hotlink রয়ে গেছে: {$url}";
                continue;
            }

            $extension = $this->extensionFromContentType($contentType) ?? pathinfo(parse_url($url, PHP_URL_PATH) ?? '', PATHINFO_EXTENSION) ?? 'jpg';
            $fileName = sha1($url) . '.' . ltrim($extension, '.');
            $path = "landing-templates/{$templateCode}/{$fileName}";

            Storage::disk('public')->put($path, $response->body());
            $localUrl = Storage::disk('public')->url($path);

            $html = str_replace($url, $localUrl, $html);
        }

        $html = $this->normalizeImageTags($html);
        $html = $this->normalizeSvgIcons($html);

        return [$html, $warnings];
    }

    /**
     * Elementor/WordPress <img> tags carry native width/height attributes
     * and a srcset sized for the original site's layout. Dropped into our
     * simpler content HTML (no surrounding Elementor container/column CSS),
     * those attributes make images render at their native pixel size
     * instead of scaling to fit the page. Force responsive sizing via an
     * inline style (highest specificity, independent of page CSS) and drop
     * width/height/srcset/sizes so nothing else can override it.
     */
    private function normalizeImageTags(string $html): string
    {
        return (string) preg_replace_callback('/<img\b[^>]*>/i', function (array $match): string {
            $tag = $match[0];
            $tag = preg_replace('/\s(width|height|srcset|sizes)=["\'][^"\']*["\']/i', '', $tag) ?? $tag;

            if (preg_match('/\sstyle=["\']([^"\']*)["\']/i', $tag, $styleMatch)) {
                $newStyle = rtrim($styleMatch[1], '; ') . '; max-width:100%; height:auto;';
                $tag = str_replace($styleMatch[0], ' style="' . $newStyle . '"', $tag);
            } else {
                $tag = preg_replace('/<img\b/i', '<img style="max-width:100%; height:auto;"', $tag, 1) ?? $tag;
            }

            return $tag;
        }, $html);
    }

    /**
     * Elementor/Font Awesome icons are inline <svg> with a viewBox but no
     * width/height and no accompanying stylesheet (Elementor normally sizes
     * these via its own site-wide CSS, which isn't part of post_content) —
     * so they render at an oversized default instead of icon-sized. Force a
     * small fixed size the same way normalizeImageTags forces responsive
     * image sizing.
     */
    private function normalizeSvgIcons(string $html): string
    {
        return (string) preg_replace_callback('/<svg\b[^>]*>.*?<\/svg>/is', function (array $match): string {
            $tag = $match[0];
            $openTag = null;
            if (!preg_match('/<svg\b[^>]*>/i', $tag, $openMatch)) {
                return $tag;
            }
            $openTag = $openMatch[0];
            $newOpenTag = preg_replace('/\s(width|height)=["\'][^"\']*["\']/i', '', $openTag) ?? $openTag;

            if (preg_match('/\sstyle=["\']([^"\']*)["\']/i', $newOpenTag, $styleMatch)) {
                $newStyle = rtrim($styleMatch[1], '; ') . '; width:24px; height:24px; max-width:24px;';
                $newOpenTag = str_replace($styleMatch[0], ' style="' . $newStyle . '"', $newOpenTag);
            } else {
                $newOpenTag = preg_replace('/<svg\b/i', '<svg style="width:24px; height:24px; max-width:24px;"', $newOpenTag, 1) ?? $newOpenTag;
            }

            return str_replace($openTag, $newOpenTag, $tag);
        }, $html);
    }

    private function extensionFromContentType(string $contentType): ?string
    {
        return match (true) {
            str_contains($contentType, 'jpeg') => 'jpg',
            str_contains($contentType, 'png') => 'png',
            str_contains($contentType, 'gif') => 'gif',
            str_contains($contentType, 'webp') => 'webp',
            str_contains($contentType, 'svg') => 'svg',
            default => null,
        };
    }
}
