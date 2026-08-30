<?php

namespace App\Services\Support\AiProviders;

use Anthropic\Client as AnthropicClient;
use Anthropic\Core\Exceptions\AuthenticationException;
use Anthropic\Core\Exceptions\PermissionDeniedException;
use Anthropic\Core\Exceptions\RateLimitException;
use Anthropic\Lib\Tools\BetaRunnableTool;
use Illuminate\Support\Facades\Log;

/**
 * Anthropic adapter — the Tool Runner logic that used to live directly in
 * AiSupportAgentService, now behind the AiProviderClient interface so it's
 * one option among several. support_ticketing_ai_context.md.
 */
class AnthropicProviderClient implements AiProviderClient
{
    private const MAX_TOOL_ITERATIONS = 6;

    private const MAX_REPLY_TOKENS = 2000;

    public function __construct(
        private readonly AnthropicClient $client,
        private readonly string $model,
        private readonly string $effort,
    ) {}

    public function respond(string $systemPrompt, array $history, array $tools, \Closure $executeTool): ?string
    {
        $emptySchema = ['type' => 'object', 'properties' => new \stdClass, 'required' => []];

        $runnableTools = array_map(
            fn (array $tool) => new BetaRunnableTool(
                definition: [
                    'name' => $tool['name'],
                    'description' => $tool['description'],
                    'inputSchema' => $tool['inputSchema'] ?: $emptySchema,
                ],
                run: fn (array $input) => $executeTool($tool['name'], $input),
            ),
            $tools,
        );

        try {
            $runner = $this->client->beta->messages->toolRunner(
                maxTokens: self::MAX_REPLY_TOKENS,
                messages: $history,
                model: $this->model,
                tools: $runnableTools,
                maxIterations: self::MAX_TOOL_ITERATIONS,
                extraParams: [
                    'system' => $systemPrompt,
                    'thinking' => ['type' => 'adaptive'],
                    'outputConfig' => ['effort' => $this->effort],
                ],
            );

            $finalText = null;
            foreach ($runner as $message) {
                foreach ($message->content as $block) {
                    if ($block->type === 'text' && trim($block->text) !== '') {
                        $finalText = $block->text;
                    }
                }
            }

            return $finalText !== null ? trim($finalText) : null;
        } catch (RateLimitException|AuthenticationException|PermissionDeniedException $e) {
            // This key is the reason, not the request — let RotatingProviderClient try the next one.
            $retryAfter = null;
            if (isset($e->response)) {
                $header = $e->response->getHeaderLine('Retry-After');
                $retryAfter = $header !== '' && is_numeric($header) ? (int) $header : null;
            }
            Log::warning('ai_support.provider_key_failed', ['provider' => 'anthropic', 'error' => $e->getMessage()]);
            throw new AiProviderRateLimitedException('anthropic key failed: '.get_class($e), $retryAfter, $e);
        } catch (\Throwable $e) {
            Log::error('ai_support.provider_failed', ['provider' => 'anthropic', 'error' => $e->getMessage()]);
            throw $e;
        }
    }
}
