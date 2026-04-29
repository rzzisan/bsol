<?php

namespace App\Services;

use App\Models\EmailConfiguration;
use App\Models\NotificationDispatchLog;
use App\Models\NotificationTemplate;
use App\Models\NotificationUseCaseBinding;
use App\Models\SmsGateway;
use App\Models\SmsHistory;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use PHPMailer\PHPMailer\Exception;
use PHPMailer\PHPMailer\PHPMailer;

class NotificationDispatchService
{
    public function __construct(private readonly NotificationTemplateRenderer $renderer) {}

    /**
     * @param  array<string, mixed>  $variables
     */
    public function dispatch(User $user, string $useCaseKey, ?string $recipientPhone, ?string $recipientEmail, array $variables = []): array
    {
        $binding = NotificationUseCaseBinding::query()
            ->where('user_id', $user->id)
            ->where('use_case_key', $useCaseKey)
            ->where('is_active', true)
            ->first();

        if (! $binding) {
            return [
                'status' => 'error',
                'message' => 'No active use-case binding found.',
                'results' => [],
            ];
        }

        $results = [];

        $channels = match ($binding->priority_channel) {
            'sms' => ['sms', 'email'],
            'email' => ['email', 'sms'],
            default => ['sms', 'email'],
        };

        foreach ($channels as $channel) {
            if ($channel === 'sms' && $binding->sms_template_id && filled($recipientPhone)) {
                $results[] = $this->sendSms($user, $binding, $binding->smsTemplate, (string) $recipientPhone, $useCaseKey, $variables);
            }

            if ($channel === 'email' && $binding->email_template_id && filled($recipientEmail)) {
                $results[] = $this->sendEmail($user, $binding, $binding->emailTemplate, (string) $recipientEmail, $useCaseKey, $variables);
            }
        }

        $allFailed = count($results) > 0 && collect($results)->every(fn (array $row) => ($row['status'] ?? null) === 'failed');

        return [
            'status' => $allFailed ? 'error' : 'success',
            'message' => $allFailed ? 'All notification channels failed.' : 'Notification dispatch completed.',
            'results' => $results,
        ];
    }

    /**
     * @param  array<string, mixed>  $variables
     * @return array<string, mixed>
     */
    private function sendSms(User $user, NotificationUseCaseBinding $binding, ?NotificationTemplate $template, string $recipientPhone, string $useCaseKey, array $variables): array
    {
        if (! $template || $template->channel !== 'sms') {
            $this->createSmsHistoryRecord(
                gateway: null,
                userId: $user->id,
                phoneNumber: $recipientPhone,
                message: '',
                status: 'failed',
                httpStatusCode: null,
                responseBody: null,
                errorMessage: 'SMS template not found or invalid.',
                sentAt: null,
            );

            return [
                'channel' => 'sms',
                'status' => 'failed',
                'message' => 'SMS template not found or invalid.',
            ];
        }

        $gateway = $template->smsGateway;
        if (! $gateway || ! $gateway->is_enabled) {
            $this->createSmsHistoryRecord(
                gateway: $gateway,
                userId: $user->id,
                phoneNumber: $recipientPhone,
                message: '',
                status: 'failed',
                httpStatusCode: null,
                responseBody: null,
                errorMessage: 'Gateway missing or disabled.',
                sentAt: null,
            );

            return $this->storeFailedLog($user, $binding, $template, $useCaseKey, 'sms', $recipientPhone, 'Gateway missing or disabled.', 'sms');
        }

        if (blank($gateway->endpoint_url) || blank($gateway->api_key) || blank($gateway->secret_key) || blank($gateway->sender_id)) {
            $this->createSmsHistoryRecord(
                gateway: $gateway,
                userId: $user->id,
                phoneNumber: $recipientPhone,
                message: '',
                status: 'failed',
                httpStatusCode: null,
                responseBody: null,
                errorMessage: 'Gateway credentials are incomplete.',
                sentAt: null,
            );

            return $this->storeFailedLog($user, $binding, $template, $useCaseKey, 'sms', $recipientPhone, 'Gateway credentials are incomplete.', 'sms');
        }

        $normalized = $this->formatBdPhoneNumber($recipientPhone);
        if (! $normalized) {
            $this->createSmsHistoryRecord(
                gateway: $gateway,
                userId: $user->id,
                phoneNumber: $recipientPhone,
                message: '',
                status: 'failed',
                httpStatusCode: null,
                responseBody: null,
                errorMessage: 'Invalid phone number format.',
                sentAt: null,
            );

            return $this->storeFailedLog($user, $binding, $template, $useCaseKey, 'sms', $recipientPhone, 'Invalid phone number format.', 'sms');
        }

        $render = $this->renderer->render($template->body, $variables);

        if (count($render['missing']) > 0) {
            $this->createSmsHistoryRecord(
                gateway: $gateway,
                userId: $user->id,
                phoneNumber: $normalized,
                message: $render['rendered'],
                status: 'failed',
                httpStatusCode: null,
                responseBody: null,
                errorMessage: 'Missing placeholders: '.implode(', ', $render['missing']),
                sentAt: null,
            );

            return $this->storeFailedLog(
                $user,
                $binding,
                $template,
                $useCaseKey,
                'sms',
                $normalized,
                'Missing placeholders: '.implode(', ', $render['missing']),
                'sms',
                [
                    'variables' => $variables,
                    'missing' => $render['missing'],
                ]
            );
        }

        $response = Http::asForm()
            ->timeout(20)
            ->post((string) $gateway->endpoint_url, [
                'apikey' => $gateway->api_key,
                'secretkey' => $gateway->secret_key,
                'callerID' => $gateway->sender_id,
                'toUser' => $normalized,
                'messageContent' => $render['rendered'],
            ]);

        $body = (string) $response->body();
        $looksFailed = preg_match('/(error|failed|invalid|unauthorized)/i', $body) === 1;
        $ok = $response->successful() && ! $looksFailed;

        $this->createSmsHistoryRecord(
            gateway: $gateway,
            userId: $user->id,
            phoneNumber: $normalized,
            message: $render['rendered'],
            status: $ok ? 'sent' : 'failed',
            httpStatusCode: $response->status(),
            responseBody: mb_substr($body, 0, 4000),
            errorMessage: $ok ? null : 'Gateway responded with failure signal.',
            sentAt: $ok ? now() : null,
        );

        $log = NotificationDispatchLog::create([
            'user_id' => $user->id,
            'binding_id' => $binding->id,
            'template_id' => $template->id,
            'use_case_key' => $useCaseKey,
            'channel' => 'sms',
            'status' => $ok ? 'sent' : 'failed',
            'recipient' => $normalized,
            'provider' => $gateway->provider,
            'attempts' => 1,
            'payload' => [
                'gateway_id' => $gateway->id,
                'message' => $render['rendered'],
                'variables' => $variables,
            ],
            'response' => [
                'status_code' => $response->status(),
                'body' => mb_substr($body, 0, 4000),
            ],
            'error_message' => $ok ? null : 'Gateway responded with failure signal.',
            'sent_at' => $ok ? now() : null,
            'failed_at' => $ok ? null : now(),
        ]);

        return [
            'channel' => 'sms',
            'status' => $log->status,
            'recipient' => $normalized,
            'log_id' => $log->id,
        ];
    }

    /**
     * @param  array<string, mixed>  $variables
     * @return array<string, mixed>
     */
    private function sendEmail(User $user, NotificationUseCaseBinding $binding, ?NotificationTemplate $template, string $recipientEmail, string $useCaseKey, array $variables): array
    {
        if (! $template || $template->channel !== 'email') {
            return [
                'channel' => 'email',
                'status' => 'failed',
                'message' => 'Email template not found or invalid.',
            ];
        }

        $config = $template->emailConfiguration;
        if (! $config instanceof EmailConfiguration) {
            return $this->storeFailedLog($user, $binding, $template, $useCaseKey, 'email', $recipientEmail, 'SMTP config not found.', 'smtp');
        }

        $subjectRender = $this->renderer->render((string) ($template->subject ?? ''), $variables);
        $bodyRender = $this->renderer->render($template->body, $variables);

        $missing = array_values(array_unique([...$subjectRender['missing'], ...$bodyRender['missing']]));
        if (count($missing) > 0) {
            return $this->storeFailedLog(
                $user,
                $binding,
                $template,
                $useCaseKey,
                'email',
                $recipientEmail,
                'Missing placeholders: '.implode(', ', $missing),
                'smtp',
                [
                    'variables' => $variables,
                    'missing' => $missing,
                ]
            );
        }

        $mailer = new PHPMailer(true);

        try {
            $mailer->isSMTP();
            $mailer->Host = $config->host;
            $mailer->SMTPAuth = true;
            $mailer->Username = $config->username;
            $mailer->Password = $config->password;
            $mailer->SMTPSecure = $config->encryption;
            $mailer->Port = (int) $config->port;
            $mailer->Timeout = 20;

            $mailer->setFrom($config->from_email, (string) ($config->from_name ?: $config->name));
            $mailer->addAddress($recipientEmail);
            $mailer->isHTML(true);
            $mailer->Subject = $subjectRender['rendered'];
            $mailer->Body = $bodyRender['rendered'];
            $mailer->AltBody = strip_tags($bodyRender['rendered']);
            $mailer->send();

            $log = NotificationDispatchLog::create([
                'user_id' => $user->id,
                'binding_id' => $binding->id,
                'template_id' => $template->id,
                'use_case_key' => $useCaseKey,
                'channel' => 'email',
                'status' => 'sent',
                'recipient' => $recipientEmail,
                'provider' => 'smtp',
                'attempts' => 1,
                'payload' => [
                    'email_configuration_id' => $config->id,
                    'subject' => $subjectRender['rendered'],
                    'body' => $bodyRender['rendered'],
                    'variables' => $variables,
                ],
                'response' => [
                    'message' => 'Accepted by SMTP server.',
                ],
                'sent_at' => now(),
            ]);

            return [
                'channel' => 'email',
                'status' => 'sent',
                'recipient' => $recipientEmail,
                'log_id' => $log->id,
            ];
        } catch (Exception $exception) {
            return $this->storeFailedLog(
                $user,
                $binding,
                $template,
                $useCaseKey,
                'email',
                $recipientEmail,
                $exception->getMessage(),
                'smtp',
                [
                    'variables' => $variables,
                    'subject' => $subjectRender['rendered'],
                    'body' => $bodyRender['rendered'],
                ]
            );
        }
    }

    /**
     * @param  array<string, mixed>|null  $payload
     * @return array<string, mixed>
     */
    private function storeFailedLog(
        User $user,
        NotificationUseCaseBinding $binding,
        NotificationTemplate $template,
        string $useCaseKey,
        string $channel,
        string $recipient,
        string $error,
        string $provider,
        ?array $payload = null,
    ): array {
        $log = NotificationDispatchLog::create([
            'user_id' => $user->id,
            'binding_id' => $binding->id,
            'template_id' => $template->id,
            'use_case_key' => $useCaseKey,
            'channel' => $channel,
            'status' => 'failed',
            'recipient' => $recipient,
            'provider' => $provider,
            'attempts' => 1,
            'payload' => $payload,
            'error_message' => $error,
            'failed_at' => now(),
        ]);

        return [
            'channel' => $channel,
            'status' => 'failed',
            'recipient' => $recipient,
            'message' => $error,
            'log_id' => $log->id,
        ];
    }

    private function createSmsHistoryRecord(
        ?SmsGateway $gateway,
        ?int $userId,
        string $phoneNumber,
        string $message,
        string $status,
        ?int $httpStatusCode,
        ?string $responseBody,
        ?string $errorMessage,
        mixed $sentAt,
    ): void {
        SmsHistory::create([
            'gateway_id' => $gateway?->id,
            'user_id' => $userId,
            'gateway_name' => $gateway?->name,
            'provider' => $gateway?->provider,
            'phone_number' => $phoneNumber,
            'message' => $message,
            'status' => $status,
            'http_status_code' => $httpStatusCode,
            'response_body' => $responseBody,
            'error_message' => $errorMessage,
            'sent_at' => $sentAt,
        ]);
    }

    private function formatBdPhoneNumber(string $phone): ?string
    {
        $number = preg_replace('/[^0-9]/', '', $phone);

        if (str_starts_with((string) $number, '00880')) {
            $number = substr((string) $number, 2);
        }

        if (str_starts_with((string) $number, '880')) {
            // already normalized
        } elseif (str_starts_with((string) $number, '01')) {
            $number = '88'.$number;
        } elseif (strlen((string) $number) === 10 && str_starts_with((string) $number, '1')) {
            $number = '880'.$number;
        } else {
            $number = '88'.$number;
        }

        return preg_match('/^8801[0-9]{9}$/', (string) $number) === 1 ? (string) $number : null;
    }
}
