<?php

namespace App\Services\Support\AiProviders;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Google Gemini adapter — distinct wire format from the OpenAI-compatible
 * providers: roles are user/model (not user/assistant), function calls
 * arrive as `functionCall` parts and are answered with `functionResponse`
 * parts, not a separate `tool` role. support_ticketing_ai_context.md.
 */
class GeminiProviderClient implements AiProviderClient
{
    private const MAX_TOOL_ITERATIONS = 6;

    private const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

    public function __construct(
        private readonly string $apiKey,
        private readonly string $model,
    ) {}

    public function respond(string $systemPrompt, array $history, array $tools, \Closure $executeTool): ?string
    {
        $contents = array_map(fn (array $m) => [
            'role' => $m['role'] === 'assistant' ? 'model' : 'user',
            'parts' => [['text' => $m['content']]],
        ], $history);

        $wireTools = empty($tools) ? [] : [[
            'functionDeclarations' => array_map(fn (array $tool) => [
                'name' => $tool['name'],
                'description' => $tool['description'],
                'parameters' => $tool['inputSchema'] ?: ['type' => 'object', 'properties' => new \stdClass],
            ], $tools),
        ]];

        $url = self::BASE_URL."/models/{$this->model}:generateContent?key={$this->apiKey}";

        try {
            for ($i = 0; $i < self::MAX_TOOL_ITERATIONS; $i++) {
                $response = Http::timeout(30)->post($url, array_filter([
                    'system_instruction' => ['parts' => [['text' => $systemPrompt]]],
                    'contents' => $contents,
                    'tools' => $wireTools ?: null,
                ]));

                if (! $response->successful()) {
                    Log::error('ai_support.provider_failed', [
                        'provider' => 'gemini', 'status' => $response->status(), 'body' => $response->json(),
                    ]);

                    return null;
                }

                $parts = $response->json('candidates.0.content.parts') ?? [];
                $functionCalls = array_values(array_filter($parts, fn ($p) => isset($p['functionCall'])));

                if (empty($functionCalls)) {
                    $text = collect($parts)->pluck('text')->filter()->implode('');

                    return trim($text) !== '' ? trim($text) : null;
                }

                // Echo the model's turn back verbatim — except a no-arg tool call's
                // `args: {}` decodes via ->json() into a PHP `[]`, and re-encoding
                // that emits a JSON *array* instead of an object; Gemini then
                // rejects the next request with "Proto field is not repeating,
                // cannot start list." Force it back to an object.
                $contents[] = ['role' => 'model', 'parts' => array_map(function ($part) {
                    if (isset($part['functionCall']['args']) && is_array($part['functionCall']['args']) && empty($part['functionCall']['args'])) {
                        $part['functionCall']['args'] = new \stdClass;
                    }

                    return $part;
                }, $parts)];

                $responseParts = [];
                foreach ($functionCalls as $part) {
                    $name = $part['functionCall']['name'] ?? '';
                    $args = $part['functionCall']['args'] ?? [];
                    $result = $executeTool($name, $args);
                    $responseParts[] = ['functionResponse' => ['name' => $name, 'response' => ['result' => $result]]];
                }
                $contents[] = ['role' => 'function', 'parts' => $responseParts];
            }

            return null; // exhausted iterations without a final text reply
        } catch (\Throwable $e) {
            Log::error('ai_support.provider_failed', ['provider' => 'gemini', 'error' => $e->getMessage()]);
            throw $e;
        }
    }
}
