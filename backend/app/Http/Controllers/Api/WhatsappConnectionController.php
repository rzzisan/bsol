<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WhatsappBusinessConnection;
use App\Services\Whatsapp\WhatsappCloudApiClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Seller-pasted WhatsApp Cloud API credentials — owner-only, same
 * credential-paste pattern as FacebookPixelSettingController (no Meta
 * OAuth/App Review needed on our side). See whatsapp_context.md.
 */
class WhatsappConnectionController extends Controller
{
    public function show(): JsonResponse
    {
        $connection = $this->connection();

        return response()->json([
            'success' => true,
            'data' => $connection?->masked() ?? [
                'phone_number_id' => null,
                'waba_id' => null,
                'display_phone_number' => null,
                'access_token_set' => false,
                'status' => 'disconnected',
                'last_error' => null,
                'verified_at' => null,
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'phone_number_id' => ['required', 'string', 'max:50'],
            'waba_id' => ['nullable', 'string', 'max:50'],
            'display_phone_number' => ['nullable', 'string', 'max:30'],
            'access_token' => ['nullable', 'string'],
        ]);

        $connection = $this->connection() ?? new WhatsappBusinessConnection(['user_id' => auth()->id()]);

        $connection->phone_number_id = $data['phone_number_id'];
        $connection->waba_id = $data['waba_id'] ?? null;
        $connection->display_phone_number = $data['display_phone_number'] ?? null;
        // Blank access_token = "leave unchanged" — same masking convention
        // as FacebookPixelSettingController::update().
        if (! empty($data['access_token'])) {
            $connection->access_token = $data['access_token'];
        }
        $connection->status = 'connected';
        $connection->last_error = null;
        $connection->save();

        return response()->json(['success' => true, 'data' => $connection->masked()]);
    }

    /**
     * Self-serve verification, no App Review gate — sends Meta's own
     * default 'hello_world' template (present on every WABA, including the
     * free test number, with zero approval needed) to a caller-supplied
     * number. That number must already be added as a verified tester in
     * the Meta App dashboard while whatsapp_business_messaging is still in
     * Standard Access (see whatsapp_context.md) — a real customer number
     * will be rejected until App Review passes, which this surfaces as a
     * normal failure, not a crash.
     */
    public function testSend(Request $request, WhatsappCloudApiClient $client): JsonResponse
    {
        $connection = $this->connection();
        if (! $connection?->isConnected()) {
            return response()->json(['success' => false, 'message' => 'Connect WhatsApp first.'], 422);
        }

        $data = $request->validate([
            'to' => ['required', 'string', 'max:20'],
        ]);

        $result = $client->sendTemplateMessage(
            $connection->phone_number_id,
            $connection->access_token,
            $data['to'],
            'hello_world',
            'en_US',
            [],
        );

        $connection->update([
            'verified_at' => $result ? now() : $connection->verified_at,
            'last_error' => $result ? null : 'Test send failed — check the phone_number_id/access token, and that the recipient number is added as a verified tester on the Meta App.',
        ]);

        return response()->json([
            'success' => (bool) $result,
            'message' => $result
                ? 'Test message sent.'
                : 'WhatsApp rejected the test send — check credentials and that the recipient is a verified tester number.',
        ]);
    }

    public function destroy(): JsonResponse
    {
        $connection = $this->connection();
        if (! $connection) {
            return response()->json(['success' => true, 'message' => 'Nothing to disconnect.']);
        }

        $connection->update(['status' => 'disconnected', 'access_token' => null]);

        return response()->json(['success' => true]);
    }

    private function connection(): ?WhatsappBusinessConnection
    {
        return WhatsappBusinessConnection::where('user_id', auth()->id())->first();
    }
}
