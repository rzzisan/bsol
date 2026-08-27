# হোমপেজ SEO — bn/en URL split, structured data, sitemap/robots

মাস্টার প্রসঙ্গ: `SAAS_MODULE_CONTEXT.md`। User-এর প্রশ্নের উত্তরে: *"আমাদের এই সাস এর SEO করতে হবে। যেন সার্চ ইন্জিনে আমাদের সাস প্রডাক্ট এর কাস্টমার পাওয়া যায়।"* — ২০২৬-০৮-২৭।

## ১. অডিটে যা পাওয়া গিয়েছিল

**সবচেয়ে বড় গ্যাপ:** হোমপেজের bn/en টগল সম্পূর্ণ client-side ছিল (`useState<Locale>("en")`, `localStorage`-এর `getStoredLocale()` দিয়ে mount-এর পর override) — আলাদা কোনো URL ছিল না প্রতিটা ভাষার জন্য। `getStoredLocale()`-এর ডিফল্ট ফলব্যাক `"bn"` (আসল target-market ভাষা), কিন্তু React state-এর initial value ছিল `"en"` — মানে crawler-এর প্রথম পাস যে HTML দেখে সেটা English, অথচ প্রকৃত ডিফল্ট অভিজ্ঞতা বাংলা। এর চেয়েও বড় সমস্যা: **Google একটা মাত্র `/` URL-এর সাথে একটাই ভাষার কন্টেন্ট associate করতে পারে** — তাই অন্য ভাষাটা কার্যত সার্চের কাছে অদৃশ্য।

**ছোট গ্যাপ:** `<html lang="en">` হার্ডকোড; `sitemap.ts`-এর প্ল্যাটফর্ম-হোস্ট branch-এ শুধু `/` ছিল; কোনো JSON-LD স্ট্রাকচার্ড ডেটা ছিল না; `/terms`/`/privacy` "use client" পেজ হওয়ায় নিজস্ব `metadata` export করতে পারত না, ফলে হোমপেজের title/description ইনহেরিট করত (duplicate-title); `robots.ts`-এ thin/transactional পেজ (`/verify-phone`, `/verify-email`, `/forgot-password`, `/d/[token]`) disallow করা ছিল না।

## ২. ডিজাইন সিদ্ধান্ত

**Pragmatic dual-URL split, পুরো i18n-framework migration না।** একটা `[locale]` dynamic-segment rewrite (next-intl-স্টাইল) পুরো অ্যাপের প্রতিটা রুট locale-prefix-এর নিচে নিয়ে যেত — এটা দরকারের চেয়ে অনেক বেশি এবং ঝুঁকিপূর্ণ (OTP/auth ফ্লো সহ প্রতিটা লিংক টাচ করত)। শুধু হোমপেজ, যেটা আসলেই সার্চেবল হওয়া দরকার, তার স্কোপ। `/terms`/`/privacy` তাদের বিদ্যমান client-side টগলই রাখে — organic search acquisition-এ এদের ভূমিকা প্রায় শূন্য। Dashboard/admin ইতিমধ্যেই `robots.txt`-disallowed, `getStoredLocale()`/`LOCALE_STORAGE_KEY` mechanism সম্পূর্ণ অপরিবর্তিত।

`frontend/src/proxy.ts` চেক করে নিশ্চিত হওয়া হয়েছে নতুন top-level রুট যোগ করা নিরাপদ: সেলার সাবডোমেইনে proxy Next-এর file router দেখার **আগেই** resolve+rewrite করে ফেলে (`/` → `/store` বা `/lp/{slug}`, বাকি সব `isLandingSlugPath` ধরে ফেলে) — একটা literal `src/app/en/page.tsx` শুধু তখনই hit হয় যখন `label` null, মানে শুধু প্ল্যাটফর্ম হোস্টে। লাইভ ভেরিফাই করা হয়েছে: `zareen.zyrotechbd.com/en` ঠিক অন্য যেকোনো non-existent landing slug-এর মতোই 404 দেয় (আগের আচরণ অপরিবর্তিত)।

## ৩. আর্কিটেকচার

**ফাইল স্প্লিট, কন্টেন্ট স্প্লিট না।** পুরনো ১৪০০+ লাইনের `app/page.tsx` ("use client", helpers + bilingual `content` অবজেক্ট + `Reveal`/`FormInput`/`AuthSection` + `Home()`) হুবহু সরে গেছে নতুন `components/marketing/home-content.tsx`-এ, `initialLocale: Locale` prop নিয়ে:
- `useState<Locale>("en")` → `useState<Locale>(initialLocale)`।
- Mount effect থেকে `setLocale(getStoredLocale())` কল সরানো হয়েছে (URL এখন source of truth) — `setTheme(getStoredTheme())`/`setHeroReady(true)` অপরিবর্তিত (থিমের কোনো SEO প্রভাব নেই)।
- ভাষা-টগল বাটন (`onClick={() => setLocale(...)}`) এখন সত্যিকারের `next/link` `<Link href={locale === "bn" ? "/en" : "/"}>` — সাথে `onClick`-এ এখনো `localStorage.setItem(LOCALE_STORAGE_KEY, ...)` লেখে, যাতে লগইন-পরবর্তী ড্যাশবোর্ডে preference বজায় থাকে (SEO মেকানিজম না, শুধু continuity)।
- `document.documentElement.lang = locale` effect (আগে থেকেই ছিল) অপরিবর্তিত রাখা হয়েছে — `initialLocale` থেকে `locale` state আসায় mount-এর পরই সঠিক `lang` বসে যায়। **সীমাবদ্ধতা:** raw SSR HTML-এ `<html lang>` সবসময় `"bn"` দেখায় (root layout-এর একটাই `<html>` ট্যাগ, per-route override করা যায় না Next App Router-এ) — `/en`-এ crawler-এর প্রথম বাইটে `lang="bn"` দেখা যাবে, JS হাইড্রেশনের পর `"en"`-এ বদলায়। Google মূলত visible content + hreflang দিয়ে ভাষা বোঝে, `lang` অ্যাট্রিবিউট মূলত accessibility/browser-translate-prompt-এর জন্য — তাই এই residual gap ইচ্ছাকৃতভাবে গ্রহণ করা হয়েছে, পুরো i18n framework migration ছাড়া এটার চেয়ে ভালো সমাধান নেই।

`app/page.tsx` (bn, `/`) আর নতুন `app/en/page.tsx` (en) — দুটোই slim Server Component: নিজস্ব `metadata` (title/description/`alternates.canonical`/`alternates.languages` — দুটোই + `x-default`/`openGraph`+`twitter` সহ পূর্ণ OG ইমেজ, কারণ Next.js child metadata নেস্টেড অবজেক্ট যেমন `openGraph` পুরোপুরি **replace** করে parent-এর, merge করে না — image/siteName তাই প্রতিটা পেজে explicitly রিপিট করা হয়েছে), JSON-LD স্ক্রিপ্ট, আর `<HomeContent initialLocale="bn" | "en" />`।

**JSON-LD** — নতুন `lib/seo.ts`: `buildSoftwareApplicationJsonLd(locale)` (SoftwareApplication, applicationCategory/operatingSystem/offers সহ) + `buildOrganizationJsonLd()`।

**Sitemap/robots** — প্ল্যাটফর্ম-হোস্ট branch-এ `/en`, `/terms`, `/privacy` যোগ; robots.ts-এ `/verify-phone`/`/verify-email`/`/forgot-password`/`/d` disallow যোগ।

**Terms/Privacy** — `app/terms/layout.tsx`, `app/privacy/layout.tsx` — ছোট Server Component wrapper, নিজস্ব bilingual-neutral title/description export করে, `page.tsx` (client) অপরিবর্তিত।

## ৪. ফাইল ম্যাপ

- নতুন `frontend/src/components/marketing/home-content.tsx` — পুরনো `page.tsx` থেকে সরানো।
- Rewritten `frontend/src/app/page.tsx` — slim Server Component, bn।
- নতুন `frontend/src/app/en/page.tsx` — en।
- `frontend/src/app/layout.tsx` — `<html lang="bn">`।
- নতুন `frontend/src/lib/seo.ts` — JSON-LD builders।
- `frontend/src/app/sitemap.ts`, `frontend/src/app/robots.ts`।
- নতুন `frontend/src/app/terms/layout.tsx`, `frontend/src/app/privacy/layout.tsx`।

## ৫. ভেরিফাই করা হয়েছে (লাইভ, ২০২৬-০৮-২৭)

- `tsc --noEmit` ক্লিন, `npm run build` ক্লিন (`/en` static prerendered রুট হিসেবে দেখাচ্ছে), `deploy-safe.sh` 8/8।
- `curl /` ও `curl /en` — আলাদা `<title>`/description/hreflang alternate তিনটাই (bn-BD/en/x-default) কনফার্মড।
- JSON-LD দুটো স্ক্রিপ্ট ব্লক (SoftwareApplication + Organization) `/`-এ কনফার্মড।
- `/sitemap.xml` — ৪টা এন্ট্রি (`/`, `/en`, `/terms`, `/privacy`) কনফার্মড। `/robots.txt` — নতুন disallow এন্ট্রিগুলো কনফার্মড।
- `/terms`, `/privacy` — নিজস্ব bilingual title কনফার্মড (আর হোমপেজের title inherit করছে না)।
- `zareen.zyrotechbd.com/en` — অন্য যেকোনো non-existent landing slug-এর মতোই 404 (seller-subdomain রাউটিং অপরিবর্তিত, `/en` route addition-এর কোনো সাইড-ইফেক্ট নেই)।

## ৬. যা এই রাউন্ডে নেই

- Full i18n framework migration (`[locale]` segment) — শুধু হোমপেজ split করা হয়েছে, `/terms`/`/privacy` client-toggle-ই থাকছে।
- `<html lang>` attribute crawler-এর প্রথম পাসেই সঠিক দেখানো (Next.js App Router-এর একটামাত্র root `<html>` ট্যাগের সীমাবদ্ধতা — §৩ দেখুন)।
- কন্টেন্ট স্ট্র্যাটেজি (আলাদা কিওয়ার্ড-টার্গেটেড ফিচার/pricing পেজ, ব্লগ) — এটা কোডের বিষয় না, একটা মাত্র হোমপেজ দিয়ে সব সার্চ ইন্টেন্ট কভার করা কঠিন, ভবিষ্যতে বিবেচনা করা উচিত।
- Google Search Console / Bing Webmaster verification — sitemap.xml রেফারেন্স robots.txt-এ আছে, কিন্তু owner-নিজে verification meta tag/DNS TXT বসিয়ে সাবমিট করতে হবে, এটা কোডের কাজ না।
