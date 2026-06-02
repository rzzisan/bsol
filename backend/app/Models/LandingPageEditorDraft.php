<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LandingPageEditorDraft extends Model
{
    protected $fillable = [
        'landing_page_id',
        'user_id',
        'components_json',
        'styles_json',
        'html_output',
        'css_output',
        'metadata',
        'last_edited_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'last_edited_at' => 'datetime',
    ];

    public function landingPage(): BelongsTo {
        return $this->belongsTo(LandingPage::class);
    }

    public function user(): BelongsTo {
        return $this->belongsTo(User::class);
    }
}
