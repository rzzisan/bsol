<?php

namespace App\Jobs;

use App\Models\NotificationDispatchLog;
use App\Models\User;
use App\Services\NotificationDispatchService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class DispatchNotificationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * Create a new job instance.
     *
     * @param  array<string, mixed>  $variables
     */
    public function __construct(
        public int $userId,
        public string $useCaseKey,
        public ?string $recipientPhone,
        public ?string $recipientEmail,
        public array $variables = [],
    ) {}

    public int $tries = 3;

    /**
     * @return array<int, int>
     */
    public function backoff(): array
    {
        return [10, 30, 60];
    }

    /**
     * Execute the job.
     */
    public function handle(NotificationDispatchService $dispatchService): void
    {
        $user = User::find($this->userId);

        if (! $user) {
            return;
        }

        $dispatchService->dispatch(
            user: $user,
            useCaseKey: $this->useCaseKey,
            recipientPhone: $this->recipientPhone,
            recipientEmail: $this->recipientEmail,
            variables: $this->variables,
        );
    }

    public function failed(\Throwable $exception): void
    {
        NotificationDispatchLog::query()
            ->where('user_id', $this->userId)
            ->where('use_case_key', $this->useCaseKey)
            ->where('status', 'queued')
            ->latest('id')
            ->limit(2)
            ->get()
            ->each(function (NotificationDispatchLog $log) use ($exception): void {
                $log->update([
                    'status' => 'failed',
                    'error_message' => $exception->getMessage(),
                    'failed_at' => now(),
                    'attempts' => $this->attempts(),
                ]);
            });
    }
}
