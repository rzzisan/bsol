<!doctype html>
<html lang="bn">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ data_get($page->seo_meta, 'meta_title', $page->title) }}</title>
    @if(data_get($page->seo_meta, 'meta_description'))
        <meta name="description" content="{{ data_get($page->seo_meta, 'meta_description') }}">
    @endif
    <style>
        :root {
            --primary: {{ data_get($page->theme_settings, 'primary_color', '#0f766e') }};
            --accent: {{ data_get($page->theme_settings, 'accent_color', '#f97316') }};
            --bg: {{ data_get($page->theme_settings, 'background_color', '#f8fafc') }};
            --text: {{ data_get($page->theme_settings, 'text_color', '#0f172a') }};
            --btn-text: {{ data_get($page->theme_settings, 'button_text_color', '#ffffff') }};
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            font-family: "Hind Siliguri", system-ui, -apple-system, sans-serif;
            background: var(--bg);
            color: var(--text);
        }
        .container { max-width: 980px; margin: 0 auto; padding: 0 16px; }
        .hero {
            background: linear-gradient(135deg, var(--primary), #0b3b36);
            color: #fff;
            padding: 48px 0;
            text-align: center;
        }
        .hero h1 { font-size: clamp(30px, 5vw, 48px); margin: 0 0 10px; }
        .hero p { margin: 0 0 24px; font-size: clamp(16px, 2.5vw, 22px); }
        .btn {
            display: inline-block;
            padding: 12px 22px;
            border: 0;
            border-radius: 10px;
            background: var(--accent);
            color: var(--btn-text);
            font-size: 18px;
            font-weight: 600;
            text-decoration: none;
            cursor: pointer;
        }
        .card {
            background: #fff;
            border-radius: 14px;
            box-shadow: 0 10px 30px rgba(15, 23, 42, .08);
            padding: 18px;
            margin: 16px 0;
        }
        .section-title {
            font-size: 30px;
            margin: 18px 0;
            color: var(--primary);
            text-align: center;
        }
        .grid { display: grid; gap: 14px; }
        .grid.two { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
        .product-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px; }
        .product-card img { width: 100%; max-height: 180px; object-fit: cover; border-radius: 8px; }
        .price { font-size: 24px; color: var(--primary); font-weight: 700; }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 999px; background: #fff7ed; color: #c2410c; font-size: 13px; }
        .input, textarea {
            width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 10px;
            font-size: 16px; font-family: inherit;
        }
        label { font-weight: 600; margin-bottom: 6px; display: block; }
        .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        @media (max-width: 768px) { .row { grid-template-columns: 1fr; } }
        .notice { padding: 12px; border-radius: 10px; margin: 10px 0; }
        .success { background: #ecfdf5; color: #065f46; }
        .error { background: #fef2f2; color: #991b1b; }
    </style>
    @if($page->custom_css)
        <style>{!! $page->custom_css !!}</style>
    @endif
</head>
<body>
    <header class="hero">
        <div class="container">
            <h1>{{ data_get($page->content, 'hero.headline', $page->title) }}</h1>
            <p>{{ data_get($page->content, 'hero.subheadline', '') }}</p>
            <a href="#checkout" class="btn">{{ data_get($page->content, 'hero.cta_text', 'অর্ডার করতে চাই') }}</a>
        </div>
    </header>

    <main class="container" style="padding:20px 16px 40px;">
        @if(session('order_success'))
            <div class="notice success">{{ session('order_success') }}</div>
        @endif
        @if($errors->any())
            <div class="notice error">
                <ul style="margin:0;padding-left:18px;">
                    @foreach($errors->all() as $error)
                        <li>{{ $error }}</li>
                    @endforeach
                </ul>
            </div>
        @endif

        @foreach((array) data_get($page->content, 'html_sections', []) as $section)
            <section class="card">
                @if(!empty($section['title']))<h2 class="section-title">{{ $section['title'] }}</h2>@endif
                <div>{!! $section['html'] ?? '' !!}</div>
            </section>
        @endforeach

        <section class="card">
            <h2 class="section-title">প্রোডাক্ট সিলেক্ট করুন</h2>
            <form method="POST" action="{{ route('landing-pages.order', ['slug' => $page->slug]) }}" id="checkout">
                @csrf
                <div class="grid two">
                    @foreach($page->products as $index => $lp)
                        @php($product = $lp->product)
                        @continue(!$product)
                        @php($price = $lp->price_override ?? $product->selling_price)
                        <div class="product-card">
                            @if($product->thumbnail)
                                <img src="{{ $product->thumbnail }}" alt="{{ $product->name }}">
                            @endif
                            @if($lp->badge_text)
                                <div class="badge">{{ $lp->badge_text }}</div>
                            @endif
                            <h3 style="margin:10px 0 6px;">{{ $lp->title_override ?: $product->name }}</h3>
                            @if($lp->subtitle)<p style="margin:0 0 8px;">{{ $lp->subtitle }}</p>@endif
                            <div class="price">৳{{ number_format((float) $price, 2) }}</div>

                            <label style="margin-top:8px; display:flex; gap:8px; align-items:center; font-weight:500;">
                                <input type="checkbox" name="items[{{ $index }}][enabled]" value="1" {{ $lp->selected_by_default ? 'checked' : '' }}>
                                এই প্রোডাক্ট নিতে চাই
                            </label>
                            <input type="hidden" name="items[{{ $index }}][product_id]" value="{{ $product->id }}">
                            <label style="margin-top:8px;">পরিমাণ</label>
                            <input class="input" type="number" min="1" max="100" name="items[{{ $index }}][quantity]" value="{{ old('items.'.$index.'.quantity', max(1, (int) $lp->default_qty)) }}">
                        </div>
                    @endforeach
                </div>

                <h2 class="section-title" style="margin-top:24px;">অর্ডার তথ্য</h2>
                <div class="row">
                    <div>
                        <label>আপনার নাম</label>
                        <input class="input" type="text" name="customer_name" value="{{ old('customer_name') }}" required>
                    </div>
                    <div>
                        <label>মোবাইল নাম্বার</label>
                        <input class="input" type="text" name="customer_phone" value="{{ old('customer_phone') }}" required>
                    </div>
                </div>

                <div style="margin-top:10px;">
                    <label>সম্পূর্ণ ঠিকানা</label>
                    <textarea rows="3" name="customer_address" required>{{ old('customer_address') }}</textarea>
                </div>

                <div class="row" style="margin-top:10px;">
                    <div>
                        <label>জেলা</label>
                        <input class="input" type="text" name="customer_district" value="{{ old('customer_district') }}">
                    </div>
                    <div>
                        <label>থানা</label>
                        <input class="input" type="text" name="customer_thana" value="{{ old('customer_thana') }}">
                    </div>
                </div>

                <div style="margin-top:10px;">
                    <label>নোট (ঐচ্ছিক)</label>
                    <textarea rows="2" name="notes">{{ old('notes') }}</textarea>
                </div>

                <input type="hidden" name="shipping_charge" value="{{ data_get($page->content, 'shipping.inside_dhaka', 80) }}">

                <div style="text-align:center; margin-top:18px;">
                    <button class="btn" type="submit">অর্ডার কনফার্ম করুন</button>
                </div>
            </form>
        </section>

        @if(!empty(data_get($page->content, 'faq', [])))
            <section class="card">
                <h2 class="section-title">সাধারণ প্রশ্ন</h2>
                @foreach((array) data_get($page->content, 'faq', []) as $faq)
                    <details style="margin-bottom:8px;">
                        <summary style="font-weight:700;cursor:pointer;">{{ $faq['q'] ?? '' }}</summary>
                        <p>{{ $faq['a'] ?? '' }}</p>
                    </details>
                @endforeach
            </section>
        @endif
    </main>

    <script>
        const form = document.getElementById('checkout');
        if (form) {
            form.addEventListener('submit', function () {
                const rows = form.querySelectorAll('[name$="[enabled]"]');
                rows.forEach((checkbox) => {
                    if (!checkbox.checked) {
                        const wrapper = checkbox.closest('.product-card');
                        if (!wrapper) return;
                        wrapper.querySelectorAll('input,select,textarea').forEach((el) => {
                            if (el !== checkbox && el.name && el.name.includes('[items][')) {
                                el.disabled = true;
                            }
                        });
                    }
                });
            });
        }
    </script>
</body>
</html>
