<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\LandingPage;
use App\Services\LandingPageOrderService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class LandingPageViewController extends Controller
{
    public function show(string $slug)
    {
        $page = LandingPage::query()
            ->where('slug', $slug)
            ->where('status', 'published')
            ->with(['template', 'products.product'])
            ->firstOrFail();

        return view('landing-pages.show', [
            'page' => $page,
        ]);
    }

    public function submitOrder(Request $request, string $slug): RedirectResponse
    {
        $page = LandingPage::query()
            ->where('slug', $slug)
            ->where('status', 'published')
            ->with(['products.product'])
            ->firstOrFail();

        $validated = $request->validate([
            'customer_name' => ['required', 'string', 'max:150'],
            'customer_phone' => ['required', 'string', 'max:20'],
            'customer_address' => ['required', 'string', 'max:500'],
            'customer_district' => ['nullable', 'string', 'max:100'],
            'customer_thana' => ['nullable', 'string', 'max:100'],
            'customer_area' => ['nullable', 'string', 'max:120'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'shipping_charge' => ['nullable', 'numeric', 'min:0'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.enabled' => ['nullable', 'boolean'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:100'],
            'items.*.product_variant_id' => ['nullable', 'integer'],
        ]);

        $landingProducts = $page->products->keyBy('product_id');
        $lineItems = collect($validated['items'])
            ->filter(fn ($item) => !empty($item['enabled']))
            ->filter(fn ($item) => isset($item['product_id']) && $landingProducts->has((int) $item['product_id']))
            ->values();

        if ($lineItems->isEmpty()) {
            return back()
                ->withErrors(['items' => 'Please select at least one valid product from this landing page.'])
                ->withInput();
        }

        app(LandingPageOrderService::class)->create($page, $validated, $lineItems);

        return redirect()
            ->route('landing-pages.show', ['slug' => $slug])
            ->with('order_success', 'অর্ডার সফলভাবে গ্রহণ করা হয়েছে। শিগগিরই আমাদের প্রতিনিধি যোগাযোগ করবে।');
    }
}
