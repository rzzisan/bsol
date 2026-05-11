<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LandingTemplateAccessRule extends Model
{
    protected $fillable = [
        'template_id',
        'package_id',
        'is_enabled',
        'created_by',
    ];

    protected $casts = [
        'is_enabled' => 'boolean',
    ];

    public function template(): BelongsTo
    {
        return $this->belongsTo(LandingTemplate::class, 'template_id');
    }

    public function package(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPackage::class, 'package_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
