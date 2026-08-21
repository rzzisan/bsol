import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchOrderServer, money } from "@/lib/storefront-client";
import WalletClaimCard from "@/components/storefront/wallet-claim-card";

const WALLET_PROVIDERS = ["bkash", "nagad", "rocket"];
const PAYMENT_LABELS: Record<string, string> = {
  cod: "ক্যাশ অন ডেলিভারি",
  bkash: "bKash",
  nagad: "Nagad",
  rocket: "Rocket",
};

type RouteProps = { params: Promise<{ token: string }> };

function getBaseUrl(headerList: Headers) {
  const forwardedProto = headerList.get("x-forwarded-proto");
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (forwardedProto && host) return `${forwardedProto}://${host}`;
  if (host) return `https://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000";
}

export default async function OrderConfirmationRoute({ params }: RouteProps) {
  const { token } = await params;
  const baseUrl = getBaseUrl(await headers());
  const order = await fetchOrderServer(baseUrl, token);

  if (!order) {
    notFound();
  }

  const showWalletClaim = WALLET_PROVIDERS.includes(order.payment_method) && order.payment_status !== "paid";

  return (
    <div className="mx-auto max-w-lg text-center">
      <div className="mb-4 text-5xl">✅</div>
      <h1 className="text-xl font-bold">অর্ডার সফলভাবে গ্রহণ করা হয়েছে</h1>
      <p className="mt-1 text-sm text-slate-500">শিগগিরই আমাদের প্রতিনিধি যোগাযোগ করবে।</p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-left">
        <p className="text-sm">
          অর্ডার নম্বর: <span className="font-semibold">{order.order_number}</span>
        </p>
        <p className="text-sm text-slate-500">পেমেন্ট: {PAYMENT_LABELS[order.payment_method] ?? order.payment_method}</p>

        <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
          {order.items.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-2 text-sm">
              <span>
                {item.product_name} × {item.quantity}
              </span>
              <span>{money(item.total)}</span>
            </div>
          ))}
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-sm font-semibold">
          <span>মোট</span>
          <span>{money(order.total)}</span>
        </div>
      </div>

      {showWalletClaim ? <WalletClaimCard token={token} provider={order.payment_method} /> : null}

      <Link href="/search" className="mt-6 inline-block rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">
        আরও কেনাকাটা করুন
      </Link>
    </div>
  );
}
