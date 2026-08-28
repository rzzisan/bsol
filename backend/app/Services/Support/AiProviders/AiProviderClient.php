<?php

namespace App\Services\Support\AiProviders;

/**
 * Provider-agnostic contract AiSupportAgentService talks to —
 * support_ticketing_ai_context.md. Every adapter owns its own wire format
 * and its own tool-call loop; the orchestrator (AiSupportAgentService) never
 * sees provider-specific request/response shapes.
 */
interface AiProviderClient
{
    /**
     * @param  array<int, array{role: string, content: string}>  $history  ['user'|'assistant', text]
     * @param  array<int, array{name: string, description: string, inputSchema: array}>  $tools
     * @param  \Closure(string $toolName, array $input): string  $executeTool
     * @return string|null the model's final text reply, or null if it produced none
     */
    public function respond(string $systemPrompt, array $history, array $tools, \Closure $executeTool): ?string;
}
