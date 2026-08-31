<?php

namespace App\Services\Payment;

use App\Models\AddonPackage;
use App\Models\AddonPurchase;
use App\Models\PlatformGatewayPayment;
use App\Models\PlatformPaymentGatewayCredential;
use App\Models\SmsCreditPurchase;
use App\Models\SmsCreditSetting;
use App\Models\SubscriptionPackage;
use App\Models\SubscriptionPayment;
use App\Models\User;
use App\Services\AddonApplyService;
use App\Services\SmsCreditService;
use App\Services\SubscriptionActivationService;
use App\Services\SubscriptionInvoiceService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * Seller→platform counterpart to OnlinePaymentService's gateway_auto half
 * (customer→seller) — same "always verify with our own stored
 * provider_payment_id, never trust callback data" + lockForUpdate()/
 * isTerminal() idempotency discipline, reused across all 4 payment
 * surfaces that used to be bKash-manual-only (subscription, SMS credit,
 * order-credit add-on, storefront add-on). See online_payment_context.md §12.
 *
 * Each surface's actual "what happens on success" cascade is untouched —
 * this only creates the same pending SubscriptionPayment/SmsCreditPurchase/
 * AddonPurchase row the manual flow already creates (payment_method =
 * "gateway:{provider}" instead of "*_manual"/"bkash_gateway"), then on a
 * verified callback flips it to approved and hands it to the exact same
 * activation service the manual admin-approve flow already uses.
 */
class PlatformGatewayPaymentService
{
    public function __construct(
        private readonly SubscriptionInvoiceService $invoiceService,
        private readonly SubscriptionActivationService $activationService,
        private readonly SmsCreditService $smsCreditService,
        private readonly AddonApplyService $addonApplyService,
    ) {}

    /** @return array<int, array{provider: string}> */
    public function enabledChannels(): array
    {
        return PlatformPaymentGatewayCredential::where('enabled', true)
            ->get()
            ->filter(fn (PlatformPaymentGatewayCredential $cred) => PaymentGatewayFactory::supports($cred->provider)
                && PaymentGatewayFactory::make($cred->provider, $cred)->isConfigured())
            ->map(fn (PlatformPaymentGatewayCredential $cred) => ['provider' => $cred->provider])
            ->values()
            ->all();
    }

    public function frontendReturnPath(string $purpose): string
    {
        return match ($purpose) {
            PlatformGatewayPayment::PURPOSE_SUBSCRIPTION => 'dashboard/settings/subscription',
            PlatformGatewayPayment::PURPOSE_SMS_CREDIT => 'dashboard/sms/credit',
            PlatformGatewayPayment::PURPOSE_ORDER_CREDIT => 'dashboard/order-credits',
            PlatformGatewayPayment::PURPOSE_STOREFRONT_ADDON => 'dashboard/storefront-addon',
            default => 'dashboard',
        };
    }

    /**
     * Opens a hosted checkout session. $callbackBaseUrl is the platform's
     * own API base (never the seller's subdomain), same as
     * OnlinePaymentService::initiateGateway()'s param of the same name.
     *
     * @param array<string, mixed> $input
     * @return array{redirect_url: string, claim_id: int}
     */
    public function initiate(string $purpose, User $user, string $provider, array $input, string $callbackBaseUrl): array
    {
        if (! in_array($purpose, PlatformGatewayPayment::PURPOSES, true)) {
            throw ValidationException::withMessages(['purpose' => ['Unknown payment purpose.']]);
        }

        $credential = PlatformPaymentGatewayCredential::where('provider', $provider)->where('enabled', true)->first();
        if (! $credential || ! PaymentGatewayFactory::supports($provider)) {
            throw ValidationException::withMessages([
                'provider' => ['এই পেমেন্ট গেটওয়েটি এখন চালু নেই।'],
            ]);
        }

        $client = PaymentGatewayFactory::make($provider, $credential);
        if (! $client->isConfigured()) {
            throw ValidationException::withMessages([
                'provider' => ['এই পেমেন্ট গেটওয়ের সেটিং সম্পূর্ণ নয়।'],
            ]);
        }

        [$payable, $amount] = match ($purpose) {
            PlatformGatewayPayment::PURPOSE_SUBSCRIPTION => $this->prepareSubscription($user, $input, $provider),
            PlatformGatewayPayment::PURPOSE_SMS_CREDIT => $this->prepareSmsCredit($user, $input, $provider),
            PlatformGatewayPayment::PURPOSE_ORDER_CREDIT => $this->prepareAddon($user, $input, 'order_credit', $provider),
            PlatformGatewayPayment::PURPOSE_STOREFRONT_ADDON => $this->prepareAddon($user, $input, 'storefront', $provider),
        };

        $claim = PlatformGatewayPayment::create([
            'purpose' => $purpose,
            'payable_id' => $payable->id,
            'user_id' => $user->id,
            'provider' => $provider,
            'amount' => $amount,
            'status' => PlatformGatewayPayment::STATUS_INITIATED,
            // Same ~30 min window as the customer-facing gateway_auto claims
            // (OrderOnlinePayment) — provider-side checkout sessions expire
            // this fast regardless of what we set here.
            'expires_at' => now()->addMinutes(30),
        ]);

        $merchantTranId = 'PGW' . $claim->id . strtoupper(substr($purpose, 0, 2));
        $returnUrl = rtrim($callbackBaseUrl, '/') . "/platform-gateway-payments/{$purpose}/{$provider}/callback/{$claim->id}";

        $result = $client->createPayment($merchantTranId, $amount, $returnUrl, [
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->mobile,
        ]);

        $claim->update([
            'provider_payment_id' => $result['provider_payment_id'],
            'gateway_response' => ['merchant_tran_id' => $merchantTranId],
        ]);

        return ['redirect_url' => $result['redirect_url'], 'claim_id' => $claim->id];
    }

    /**
     * Confirms (or fails) a claim after a browser-redirect callback or a
     * server-to-server IPN. Idempotent — a second call on an already-
     * terminal claim is a no-op, guarding the redirect and IPN legs racing.
     *
     * @param array<string, mixed> $callbackData
     */
    public function completeCallback(PlatformGatewayPayment $claim, array $callbackData): PlatformGatewayPayment
    {
        if ($claim->isTerminal()) {
            return $claim;
        }

        return DB::transaction(function () use ($claim, $callbackData) {
            $claim = PlatformGatewayPayment::whereKey($claim->id)->lockForUpdate()->firstOrFail();
            if ($claim->isTerminal()) {
                return $claim;
            }

            $credential = PlatformPaymentGatewayCredential::where('provider', $claim->provider)->firstOrFail();
            $client = PaymentGatewayFactory::make($claim->provider, $credential);

            $merchantTranId = $claim->gateway_response['merchant_tran_id'] ?? (string) $claim->provider_payment_id;
            $result = $client->verifyPayment($merchantTranId, (string) $claim->provider_payment_id, $callbackData);

            $claim->update([
                'gateway_response' => array_merge($claim->gateway_response ?? [], [
                    'last_callback' => $callbackData,
                    'verify_result' => $result['raw'] ?? [],
                ]),
                'provider_trx_id' => $result['trx_id'] ?? $claim->provider_trx_id,
            ]);

            if (! ($result['success'] ?? false)) {
                $claim->update(['status' => PlatformGatewayPayment::STATUS_FAILED]);
                $this->markPayableRejected($claim, "Gateway payment did not complete via {$claim->provider}.");

                return $claim;
            }

            $this->applySuccess($claim, $result['trx_id'] ?? null);
            $claim->update(['status' => PlatformGatewayPayment::STATUS_COMPLETED]);

            return $claim;
        });
    }

    public function findClaimForIpn(string $provider, array $payload): ?PlatformGatewayPayment
    {
        $candidateIds = array_filter([
            $payload['tran_id'] ?? null,
            $payload['val_id'] ?? null,
            $payload['invoice_id'] ?? null,
            $payload['mer_txnid'] ?? null,
            $payload['order_id'] ?? null,
            $payload['sp_order_id'] ?? null,
            $payload['paymentID'] ?? null,
            $payload['payment_ref_id'] ?? null,
        ]);

        return PlatformGatewayPayment::where('provider', $provider)
            ->where(function ($q) use ($candidateIds) {
                foreach ($candidateIds as $value) {
                    $q->orWhere('provider_payment_id', $value);
                }
            })
            ->first();
    }

    /** @return array{0: SubscriptionPayment, 1: float} */
    private function prepareSubscription(User $user, array $input, string $provider): array
    {
        $data = Validator::make($input, [
            'package_id' => ['required', 'integer', 'exists:subscription_packages,id'],
        ])->validate();

        $package = SubscriptionPackage::findOrFail($data['package_id']);
        $invoice = $this->invoiceService->compute($user, $package);

        if ($invoice['is_downgrade_blocked']) {
            throw ValidationException::withMessages([
                'package_id' => ['বর্তমান প্যাকেজের মেয়াদ শেষ না হওয়া পর্যন্ত এর চেয়ে ছোট প্যাকেজে যাওয়া যাবে না।'],
            ]);
        }

        $payment = SubscriptionPayment::create([
            'user_id' => $user->id,
            'package_id' => $package->id,
            'previous_package_id' => $invoice['is_upgrade'] ? $invoice['previous_package']['id'] : null,
            'amount' => $invoice['payable_amount'],
            'base_amount' => $invoice['base_amount'],
            'proration_credit' => $invoice['proration_credit'],
            'invoice_breakdown' => $invoice,
            'payment_method' => "gateway:{$provider}",
            'status' => 'pending',
        ]);

        return [$payment, (float) $invoice['payable_amount']];
    }

    /** @return array{0: SmsCreditPurchase, 1: float} */
    private function prepareSmsCredit(User $user, array $input, string $provider): array
    {
        $data = Validator::make($input, [
            'credits' => ['required', 'integer', 'min:100', 'max:1000000'],
        ])->validate();

        $rate = (float) SmsCreditSetting::getSetting()->rate_per_credit;
        $amount = round($data['credits'] * $rate, 2);

        $purchase = SmsCreditPurchase::create([
            'user_id' => $user->id,
            'credits' => $data['credits'],
            'rate_used' => $rate,
            'amount' => $amount,
            'payment_method' => "gateway:{$provider}",
            'status' => 'pending',
        ]);

        return [$purchase, $amount];
    }

    /** @return array{0: AddonPurchase, 1: float} */
    private function prepareAddon(User $user, array $input, string $type, string $provider): array
    {
        $data = Validator::make($input, [
            'addon_package_id' => ['required', 'integer', 'exists:addon_packages,id'],
        ])->validate();

        $package = AddonPackage::where('type', $type)->where('is_active', true)->findOrFail($data['addon_package_id']);

        $purchase = AddonPurchase::create([
            'user_id' => $user->id,
            'addon_package_id' => $package->id,
            'amount' => $package->price,
            'payment_method' => "gateway:{$provider}",
            'status' => 'pending',
        ]);

        return [$purchase, (float) $package->price];
    }

    private function applySuccess(PlatformGatewayPayment $claim, ?string $trxId): void
    {
        match ($claim->purpose) {
            PlatformGatewayPayment::PURPOSE_SUBSCRIPTION => $this->applySubscription($claim, $trxId),
            PlatformGatewayPayment::PURPOSE_SMS_CREDIT => $this->applySmsCredit($claim, $trxId),
            PlatformGatewayPayment::PURPOSE_ORDER_CREDIT, PlatformGatewayPayment::PURPOSE_STOREFRONT_ADDON => $this->applyAddon($claim, $trxId),
            default => null,
        };
    }

    private function applySubscription(PlatformGatewayPayment $claim, ?string $trxId): void
    {
        $payment = SubscriptionPayment::whereKey($claim->payable_id)->lockForUpdate()->first();
        if (! $payment || $payment->status !== 'pending') {
            return;
        }

        $payment->update(['status' => 'approved', 'trx_id' => $trxId, 'reviewed_at' => now()]);
        $this->activationService->activate($payment);
    }

    private function applySmsCredit(PlatformGatewayPayment $claim, ?string $trxId): void
    {
        $purchase = SmsCreditPurchase::whereKey($claim->payable_id)->lockForUpdate()->first();
        if (! $purchase || $purchase->status !== 'pending') {
            return;
        }

        $purchase->update(['status' => 'approved', 'trx_id' => $trxId, 'reviewed_at' => now()]);
        $this->smsCreditService->recharge(
            userId: $purchase->user_id,
            credits: $purchase->credits,
            rechargedBy: null,
            note: "Self-purchase via {$claim->provider} (purchase #{$purchase->id})",
        );
    }

    private function applyAddon(PlatformGatewayPayment $claim, ?string $trxId): void
    {
        $purchase = AddonPurchase::whereKey($claim->payable_id)->lockForUpdate()->first();
        if (! $purchase || $purchase->status !== 'pending') {
            return;
        }

        $purchase->update(['status' => 'approved', 'trx_id' => $trxId, 'reviewed_at' => now()]);
        $this->addonApplyService->apply($purchase->fresh());
    }

    private function markPayableRejected(PlatformGatewayPayment $claim, string $reason): void
    {
        match ($claim->purpose) {
            PlatformGatewayPayment::PURPOSE_SUBSCRIPTION => SubscriptionPayment::whereKey($claim->payable_id)
                ->where('status', 'pending')->update(['status' => 'rejected', 'admin_note' => $reason]),
            PlatformGatewayPayment::PURPOSE_SMS_CREDIT => SmsCreditPurchase::whereKey($claim->payable_id)
                ->where('status', 'pending')->update(['status' => 'rejected', 'admin_note' => $reason]),
            PlatformGatewayPayment::PURPOSE_ORDER_CREDIT, PlatformGatewayPayment::PURPOSE_STOREFRONT_ADDON => AddonPurchase::whereKey($claim->payable_id)
                ->where('status', 'pending')->update(['status' => 'rejected', 'admin_note' => $reason]),
            default => null,
        };
    }
}
