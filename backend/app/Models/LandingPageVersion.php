<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LandingPageVersion extends Model
{
    protected $fillable = [
        'landing_page_id',
        'created_by',
        'version_number',
        'components_json',
        'styles_json',
        'version_name',
        'change_notes',
    ];

    public function landingPage(): BelongsTo {
        return $this->belongsTo(LandingPage::class);
    }

    public function createdBy(): BelongsTo {
        return $this->belongsTo(User::class, 'created_by');
    }
}
