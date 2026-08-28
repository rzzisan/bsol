<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Platform how-to content the AI support agent can search on demand via the
 * search_platform_help tool — support_ticketing_ai_context.md. Admin-editable
 * at /admin/settings/ai-knowledge-base so wording can be fixed without a
 * deploy.
 */
class AiKnowledgeBaseArticle extends Model
{
    protected $fillable = ['slug', 'title', 'content', 'is_active', 'sort_order', 'updated_by'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
