<?php
namespace Database\Seeders;

use App\Models\LandingPageElement;
use Illuminate\Database\Seeder;

class LandingPageElementSeeder extends Seeder
{
    public function run(): void
    {
        $elements = [
            // Basic Elements
            [
                'element_key' => 'text',
                'name_en' => 'Text / Paragraph',
                'name_bn' => 'টেক্সট / অনুচ্ছেদ',
                'description' => 'Add text content to your page',
                'category' => 'basic',
                'sort_order' => 1,
                'is_active' => true,
                'component_definition' => '<p>Your text here</p>',
                'traits_definition' => json_encode([
                    ['type' => 'text', 'name' => 'content', 'label' => 'Text Content'],
                    ['type' => 'select', 'name' => 'fontSize', 'label' => 'Font Size', 'options' => [
                        ['id' => '12px', 'label' => 'Small'],
                        ['id' => '16px', 'label' => 'Normal'],
                        ['id' => '20px', 'label' => 'Large'],
                        ['id' => '24px', 'label' => 'Extra Large'],
                    ]],
                ]),
            ],
            [
                'element_key' => 'heading',
                'name_en' => 'Heading',
                'name_bn' => 'শিরোনাম',
                'description' => 'Add a heading element',
                'category' => 'basic',
                'sort_order' => 2,
                'is_active' => true,
                'component_definition' => '<h1>Your Heading</h1>',
                'traits_definition' => json_encode([
                    ['type' => 'text', 'name' => 'text', 'label' => 'Heading Text'],
                    ['type' => 'select', 'name' => 'level', 'label' => 'Level', 'options' => [
                        ['id' => 'h1', 'label' => 'H1'],
                        ['id' => 'h2', 'label' => 'H2'],
                        ['id' => 'h3', 'label' => 'H3'],
                    ]],
                ]),
            ],
            [
                'element_key' => 'image',
                'name_en' => 'Image',
                'name_bn' => 'ছবি',
                'description' => 'Add an image to your page',
                'category' => 'basic',
                'sort_order' => 3,
                'is_active' => true,
                'component_definition' => '<img src="https://via.placeholder.com/350x250" alt="image" />',
                'traits_definition' => json_encode([
                    ['type' => 'text', 'name' => 'src', 'label' => 'Image URL'],
                    ['type' => 'text', 'name' => 'alt', 'label' => 'Alt Text'],
                ]),
            ],

            // Advanced Elements
            [
                'element_key' => 'button',
                'name_en' => 'Button',
                'name_bn' => 'বাটন',
                'description' => 'Add a clickable button element',
                'category' => 'advanced',
                'sort_order' => 1,
                'is_active' => true,
                'component_definition' => '<button style="padding: 12px 24px; background-color: #3B82F6; color: white; border: none; border-radius: 6px;">Click Me</button>',
                'traits_definition' => json_encode([
                    ['type' => 'text', 'name' => 'text', 'label' => 'Button Text'],
                    ['type' => 'color', 'name' => 'bgColor', 'label' => 'Background Color'],
                    ['type' => 'text', 'name' => 'url', 'label' => 'Link URL'],
                ]),
            ],
            [
                'element_key' => 'hero',
                'name_en' => 'Hero Section',
                'name_bn' => 'হিরো সেকশন',
                'description' => 'Add a hero section with title and CTA',
                'category' => 'sections',
                'sort_order' => 2,
                'is_active' => true,
                'component_definition' => '<section style="padding: 80px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; min-height: 500px;">
                  <h1 style="font-size: 48px; margin-bottom: 20px;">Welcome</h1>
                  <p style="font-size: 18px; margin-bottom: 30px;">Your subtitle here</p>
                  <button style="padding: 12px 32px; background-color: white; color: #667eea; border: none; border-radius: 6px;">Get Started</button>
                </section>',
                'traits_definition' => json_encode([
                    ['type' => 'text', 'name' => 'title', 'label' => 'Title'],
                    ['type' => 'text', 'name' => 'subtitle', 'label' => 'Subtitle'],
                    ['type' => 'color', 'name' => 'bgColor', 'label' => 'Background Color'],
                ]),
            ],
            [
                'element_key' => 'features',
                'name_en' => 'Features Grid',
                'name_bn' => 'ফিচার গ্রিড',
                'description' => 'Add a 3-column features section',
                'category' => 'sections',
                'sort_order' => 3,
                'is_active' => true,
                'component_definition' => '<section style="padding: 60px 20px; background-color: #f9fafb;">
                  <div style="max-width: 1200px; margin: 0 auto;">
                    <h2 style="font-size: 36px; text-align: center; margin-bottom: 50px;">Our Features</h2>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px;">
                      <div style="padding: 30px; background: white; border-radius: 8px; text-align: center;">
                        <h3 style="font-size: 20px; font-weight: 600; margin-bottom: 10px;">Feature 1</h3>
                        <p>Feature description here</p>
                      </div>
                      <div style="padding: 30px; background: white; border-radius: 8px; text-align: center;">
                        <h3 style="font-size: 20px; font-weight: 600; margin-bottom: 10px;">Feature 2</h3>
                        <p>Feature description here</p>
                      </div>
                      <div style="padding: 30px; background: white; border-radius: 8px; text-align: center;">
                        <h3 style="font-size: 20px; font-weight: 600; margin-bottom: 10px;">Feature 3</h3>
                        <p>Feature description here</p>
                      </div>
                    </div>
                  </div>
                </section>',
                'traits_definition' => json_encode([
                    ['type' => 'text', 'name' => 'title', 'label' => 'Section Title'],
                ]),
            ],
            [
                'element_key' => 'testimonials',
                'name_en' => 'Testimonials',
                'name_bn' => 'প্রশংসাপত্র',
                'description' => 'Add testimonials from your customers',
                'category' => 'sections',
                'sort_order' => 4,
                'is_active' => true,
                'component_definition' => '<section style="padding: 60px 20px; background-color: white;">
                  <div style="max-width: 1200px; margin: 0 auto;">
                    <h2 style="font-size: 36px; text-align: center; margin-bottom: 50px;">What Our Customers Say</h2>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 30px;">
                      <div style="padding: 30px; background: #f9fafb; border-radius: 8px; border-left: 4px solid #3B82F6;">
                        <p style="margin-bottom: 15px;">Testimonial content here</p>
                        <p style="font-weight: 600;">Customer Name</p>
                      </div>
                    </div>
                  </div>
                </section>',
                'traits_definition' => json_encode([
                    ['type' => 'text', 'name' => 'title', 'label' => 'Section Title'],
                ]),
            ],
            [
                'element_key' => 'cta',
                'name_en' => 'Call to Action',
                'name_bn' => 'কল টু এক্শন',
                'description' => 'Add a call-to-action section',
                'category' => 'sections',
                'sort_order' => 5,
                'is_active' => true,
                'component_definition' => '<section style="padding: 60px 20px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; text-align: center;">
                  <div style="max-width: 800px; margin: 0 auto;">
                    <h2 style="font-size: 36px; margin-bottom: 15px;">Ready to Get Started?</h2>
                    <p style="font-size: 18px; margin-bottom: 30px;">Join thousands of satisfied customers</p>
                    <button style="padding: 12px 32px; background-color: white; color: #f5576c; border: none; border-radius: 6px; font-weight: 600; cursor: pointer;">Get Started Free</button>
                  </div>
                </section>',
                'traits_definition' => json_encode([
                    ['type' => 'text', 'name' => 'title', 'label' => 'Title'],
                    ['type' => 'text', 'name' => 'subtitle', 'label' => 'Subtitle'],
                ]),
            ],
        ];

        foreach ($elements as $element) {
            LandingPageElement::updateOrCreate(
                ['element_key' => $element['element_key']],
                $element
            );
        }

        echo "Landing page elements seeded successfully!\n";
    }
}
