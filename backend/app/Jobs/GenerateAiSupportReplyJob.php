<?php

namespace App\Jobs;

use App\Models\SupportConversation;
use App\Models\SupportTicket;
use App\Services\Support\AiSupportAgentService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Queued so the seller's HTTP request returns immediately — the Claude call
 * can take a few seconds. Confirmed safe: hybrid-queue-worker.service
 * (queue:work redis) is running in production (support_ticketing_ai_context.md).
 */
class GenerateAiSupportReplyJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 2;

    public function __construct(
        public readonly string $threadType, // 'ticket' | 'conversation'
        public readonly int $threadId,
    ) {}

    public function backoff(): array
    {
        return [15, 45];
    }

    public function handle(AiSupportAgentService $service): void
    {
        if ($this->threadType === 'ticket') {
            $ticket = SupportTicket::find($this->threadId);
            $ticket !== null && $service->respondToTicket($ticket);

            return;
        }

        $conversation = SupportConversation::find($this->threadId);
        $conversation !== null && $service->respondToConversation($conversation);
    }

    public function failed(\Throwable $exception): void
    {
        Log::error('ai_support.job_failed', [
            'thread_type' => $this->threadType,
            'thread_id' => $this->threadId,
            'error' => $exception->getMessage(),
        ]);
    }
}
