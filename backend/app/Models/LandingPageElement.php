<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LandingPageElement extends Model
{
    protected $fillable = [
        'element_key',
        'name_en',
        'name_bn',
        'description',
        'component_definition',
        'traits_definition',
        'category',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'traits_definition' => 'array',
        'is_active' => 'boolean',
    ];

    public static function getActive($category = null) {
        $query = self::where('is_active', true)->orderBy('sort_order');
        
        if ($category) {
            $query->where('category', $category);
        }
        
        return $query->get();
    }
}
