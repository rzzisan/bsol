<?php

namespace Database\Seeders;

use App\Models\Funnel;
use App\Models\FunnelFlow;
use App\Models\FunnelFlowStep;
use App\Models\LandingPage;
use App\Models\User;
use Illuminate\Database\Seeder;

class FunnelSeeder extends Seeder
{
    public function run(): void
    {
        $adminId = User::query()->where('role', 'admin')->value('id') ?? 1;
        $sellerId = User::query()->where('role', 'seller')->first()?->id ?? 1;

        // Create example funnel for education/offer
        $educationFunnel = Funnel::create([
            'user_id' => $sellerId,
            'name' => 'Education Product Funnel',
            'slug' => 'education-product-funnel-' . time(),
            'status' => 'draft',
            'theme_tokens_json' => [
                'primary_color' => '#007bff',
                'secondary_color' => '#6c757d',
                'accent_color' => '#28a745',
                'font_family' => 'Inter, sans-serif',
            ],
            'settings_json' => [
                'enable_analytics' => true,
                'enable_conversion_tracking' => true,
            ],
        ]);

        // Create funnel flow
        $flow = FunnelFlow::create([
            'funnel_id' => $educationFunnel->id,
            'name' => 'Default Flow v1',
            'version' => 1,
            'is_active' => true,
        ]);

        // Create landing page for step 1
        $landingPage1 = LandingPage::create([
            'user_id' => $sellerId,
            'template_id' => 1, // Assuming goofi_flashcard_offer template exists
            'title' => 'Education Funnel - Landing Page',
            'slug' => 'education-funnel-landing-' . time(),
            'status' => 'draft',
            'meta_title' => 'Learn with Flashcards',
            'meta_description' => 'Interactive flashcard learning for kids',
            'theme_tokens_json' => $educationFunnel->theme_tokens_json,
            'content_json' => [
                'sections' => [
                    [
                        'type' => 'hero',
                        'title' => 'সন্তানের শেখা আরও মজার করুন',
                        'subtitle' => 'Interactive flashcards for better learning',
                    ],
                ],
            ],
        ]);

        // Create landing page for step 2 (checkout)
        $landingPage2 = LandingPage::create([
            'user_id' => $sellerId,
            'template_id' => 1,
            'title' => 'Education Funnel - Checkout Page',
            'slug' => 'education-funnel-checkout-' . time(),
            'status' => 'draft',
            'meta_title' => 'Complete Your Order',
            'meta_description' => 'Fast and secure checkout',
            'theme_tokens_json' => $educationFunnel->theme_tokens_json,
            'content_json' => [
                'sections' => [
                    [
                        'type' => 'checkout_form',
                        'title' => 'Checkout',
                    ],
                ],
            ],
        ]);

        // Create landing page for step 3 (thank you)
        $landingPage3 = LandingPage::create([
            'user_id' => $sellerId,
            'template_id' => 1,
            'title' => 'Education Funnel - Thank You Page',
            'slug' => 'education-funnel-thankyou-' . time(),
            'status' => 'draft',
            'meta_title' => 'Order Confirmed!',
            'meta_description' => 'Thank you for your purchase',
            'theme_tokens_json' => $educationFunnel->theme_tokens_json,
            'content_json' => [
                'sections' => [
                    [
                        'type' => 'thank_you',
                        'title' => 'Thank You for Your Order!',
                    ],
                ],
            ],
        ]);

        // Create funnel steps
        FunnelFlowStep::create([
            'funnel_flow_id' => $flow->id,
            'step_type' => 'landing',
            'step_order' => 1,
            'landing_page_id' => $landingPage1->id,
            'slug' => 'landing',
            'is_enabled' => true,
            'settings_json' => [
                'auto_forward_on_cta' => true,
            ],
        ]);

        FunnelFlowStep::create([
            'funnel_flow_id' => $flow->id,
            'step_type' => 'checkout',
            'step_order' => 2,
            'landing_page_id' => $landingPage2->id,
            'slug' => 'checkout',
            'is_enabled' => true,
            'settings_json' => [
                'show_order_bump' => true,
            ],
        ]);

        FunnelFlowStep::create([
            'funnel_flow_id' => $flow->id,
            'step_type' => 'thank_you',
            'step_order' => 3,
            'landing_page_id' => $landingPage3->id,
            'slug' => 'thank-you',
            'is_enabled' => true,
            'settings_json' => [
                'show_upsell_offer' => false,
            ],
        ]);

        // Create another example: E-commerce upsell funnel
        $ecommerceFunnel = Funnel::create([
            'user_id' => $sellerId,
            'name' => 'E-commerce Upsell Funnel',
            'slug' => 'ecommerce-upsell-funnel-' . time(),
            'status' => 'draft',
            'theme_tokens_json' => [
                'primary_color' => '#e74c3c',
                'secondary_color' => '#34495e',
                'accent_color' => '#f39c12',
                'font_family' => 'Poppins, sans-serif',
            ],
            'settings_json' => [
                'enable_analytics' => true,
            ],
        ]);

        $ecommerceFlow = FunnelFlow::create([
            'funnel_id' => $ecommerceFunnel->id,
            'name' => 'Default Flow v1',
            'version' => 1,
            'is_active' => true,
        ]);

        $ecommercePage = LandingPage::create([
            'user_id' => $sellerId,
            'template_id' => 1,
            'title' => 'E-commerce Product Launch',
            'slug' => 'ecommerce-product-' . time(),
            'status' => 'draft',
            'content_json' => [
                'sections' => [
                    [
                        'type' => 'product_showcase',
                        'title' => 'Limited Time Offer',
                    ],
                ],
            ],
        ]);

        FunnelFlowStep::create([
            'funnel_flow_id' => $ecommerceFlow->id,
            'step_type' => 'landing',
            'step_order' => 1,
            'landing_page_id' => $ecommercePage->id,
            'slug' => 'product',
            'is_enabled' => true,
        ]);
    }
}
