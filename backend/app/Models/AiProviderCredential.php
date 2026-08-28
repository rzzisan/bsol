<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One row per LLM provider (anthropic/gemini/groq/openai/openrouter) —
 * support_ticketing_ai_context.md. api_key is encrypted at rest.
 */
class AiProviderCredential extends Model
{
    public const PROVIDERS = ['anthropic', 'gemini', 'groq', 'openai', 'openrouter'];

    protected $fillable = ['provider', 'api_key', 'default_model', 'updated_by'];

    protected function casts(): array
    {
        return ['api_key' => 'encrypted'];
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function maskedKey(): ?string
    {
        if (! $this->api_key) {
            return null;
        }

        return strlen($this->api_key) <= 4 ? '****' : '••••'.substr($this->api_key, -4);
    }
}
