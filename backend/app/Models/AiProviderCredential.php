<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One row per LLM API key — a provider (anthropic/gemini/groq/openai/
 * openrouter) can hold several, rotated by AiProviderClientFactory when one
 * gets rate-limited. support_ticketing_ai_context.md §"multi-key rotation".
 * api_key is encrypted at rest.
 */
class AiProviderCredential extends Model
{
    public const PROVIDERS = ['anthropic', 'gemini', 'groq', 'openai', 'openrouter'];

    protected $fillable = ['provider', 'label', 'api_key', 'default_model', 'rate_limited_until', 'updated_by'];

    protected function casts(): array
    {
        return [
            'api_key' => 'encrypted',
            'rate_limited_until' => 'datetime',
        ];
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function isRateLimited(): bool
    {
        return $this->rate_limited_until !== null && $this->rate_limited_until->isFuture();
    }

    public function maskedKey(): ?string
    {
        if (! $this->api_key) {
            return null;
        }

        return strlen($this->api_key) <= 4 ? '****' : '••••'.substr($this->api_key, -4);
    }
}
