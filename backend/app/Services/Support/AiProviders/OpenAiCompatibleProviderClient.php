<?php

namespace App\Services\Support\AiProviders;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Covers OpenAI, Groq, and OpenRouter — all three speak the same
 * chat-completions + tool-calling wire format, only the base URL/key/model
 * differ. support_ticketing_ai_context.md.
 */
class OpenAiCompatibleProviderClient implements AiProviderClient
{
    private const MAX_TOOL_ITERATIONS = 6;

    public function __construct(
        private readonly string $providerLabel, // for log lines only
        private readonly string $baseUrl,
        private readonly string $apiKey,
        private readonly string $model,
    ) {}

    public function respond(string $systemPrompt, array $history, array $tools, \Closure $executeTool): ?string
    {
        $messages = array_merge(
            [['role' => 'system', 'content' => $systemPrompt]],
            array_map(fn (array $m) => ['role' => $m['role'], 'content' => $m['content']], $history),
        );

        $wireTools = array_map(fn (array $tool) => [
            'type' => 'function',
            'function' => [
                'name' => $tool['name'],
                'description' => $tool['description'],
                'parameters' => $tool['inputSchema'] ?: ['type' => 'object', 'properties' => new \stdClass, 'required' => []],
            ],
        ], $tools);

        try {
            for ($i = 0; $i < self::MAX_TOOL_ITERATIONS; $i++) {
                $response = Http::withToken($this->apiKey)
                    ->timeout(30)
                    ->post(rtrim($this->baseUrl, '/').'/chat/completions', [
                        'model' => $this->model,
                        'messages' => $messages,
                        'tools' => $wireTools,
                        'tool_choice' => 'auto',
                    ]);

                if (! $response->successful()) {
                    Log::error('ai_support.provider_failed', [
                        'provider' => $this->providerLabel, 'status' => $response->status(), 'body' => $response->json(),
                    ]);

                    return null;
                }

                $message = $response->json('choices.0.message');
                if ($message === null) {
                    return null;
                }

                $toolCalls = $message['tool_calls'] ?? [];
                if (empty($toolCalls)) {
                    $text = $message['content'] ?? null;

                    return $text !== null && trim($text) !== '' ? trim($text) : null;
                }

                $messages[] = $message;
                foreach ($toolCalls as $call) {
                    $name = $call['function']['name'] ?? '';
                    $input = json_decode($call['function']['arguments'] ?? '{}', true) ?: [];
                    $result = $executeTool($name, $input);

                    $messages[] = [
                        'role' => 'tool',
                        'tool_call_id' => $call['id'] ?? '',
                        'content' => $result,
                    ];
                }
            }

            return null; // exhausted iterations without a final text reply
        } catch (\Throwable $e) {
            Log::error('ai_support.provider_failed', ['provider' => $this->providerLabel, 'error' => $e->getMessage()]);
            throw $e;
        }
    }
}
