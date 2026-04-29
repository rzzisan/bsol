<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmailConfiguration;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

class EmailConfigurationController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index()
    {
        $configurations = EmailConfiguration::whereIn('user_id', $this->adminScopeUserIds())
            ->select(['id', 'name', 'host', 'port', 'username', 'encryption', 'from_email', 'from_name', 'is_active', 'created_at'])
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $configurations,
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'host' => 'required|string|max:255',
            'port' => 'required|integer|min:1|max:65535',
            'username' => 'required|string|max:255',
            'password' => 'required|string|min:1',
            'encryption' => 'required|string|in:tls,ssl',
            'from_email' => 'required|email',
            'from_name' => 'nullable|string|max:255',
        ]);

        // Check if name already exists across all admin configs
        $exists = EmailConfiguration::whereIn('user_id', $this->adminScopeUserIds())
            ->where('name', $validated['name'])
            ->exists();

        if ($exists) {
            return response()->json([
                'status' => 'error',
                'message' => 'Email configuration name already exists for your account.',
            ], 422);
        }

        $configuration = EmailConfiguration::create([
            'user_id' => auth()->id(),
            ...$validated,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Email configuration created successfully.',
            'data' => $configuration->makeHidden('password'),
        ], 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        $configuration = EmailConfiguration::where('id', $id)
            ->whereIn('user_id', $this->adminScopeUserIds())
            ->first();

        if (!$configuration) {
            return response()->json([
                'status' => 'error',
                'message' => 'Email configuration not found.',
            ], 404);
        }

        return response()->json([
            'status' => 'success',
            'data' => $configuration->makeHidden('password'),
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        $configuration = EmailConfiguration::where('id', $id)
            ->whereIn('user_id', $this->adminScopeUserIds())
            ->first();

        if (!$configuration) {
            return response()->json([
                'status' => 'error',
                'message' => 'Email configuration not found.',
            ], 404);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'host' => 'sometimes|string|max:255',
            'port' => 'sometimes|integer|min:1|max:65535',
            'username' => 'sometimes|string|max:255',
            'password' => 'sometimes|string|min:1',
            'encryption' => 'sometimes|string|in:tls,ssl',
            'from_email' => 'sometimes|email',
            'from_name' => 'nullable|string|max:255',
            'is_active' => 'sometimes|boolean',
        ]);

        // Check if name already exists across all admin configs (excluding current record)
        if (isset($validated['name']) && $validated['name'] !== $configuration->name) {
            $exists = EmailConfiguration::whereIn('user_id', $this->adminScopeUserIds())
                ->where('name', $validated['name'])
                ->where('id', '!=', $id)
                ->exists();

            if ($exists) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Email configuration name already exists for your account.',
                ], 422);
            }
        }

        $configuration->update($validated);

        return response()->json([
            'status' => 'success',
            'message' => 'Email configuration updated successfully.',
            'data' => $configuration->makeHidden('password'),
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        $configuration = EmailConfiguration::where('id', $id)
            ->whereIn('user_id', $this->adminScopeUserIds())
            ->first();

        if (!$configuration) {
            return response()->json([
                'status' => 'error',
                'message' => 'Email configuration not found.',
            ], 404);
        }

        $configuration->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Email configuration deleted successfully.',
        ]);
    }

    /**
     * @return array<int>
     */
    private function adminScopeUserIds(): array
    {
        if (auth()->user()->isAdmin()) {
            return User::where('role', 'admin')->pluck('id')->toArray();
        }

        return [auth()->id()];
    }

    /**
     * Test email configuration connection
     */
    public function testConnection(Request $request)
    {
        $validated = $request->validate([
            'host' => 'required|string',
            'port' => 'required|integer|min:1|max:65535',
            'username' => 'required|string',
            'password' => 'required|string',
            'encryption' => 'required|string|in:tls,ssl',
        ]);

        try {
            $mail = new PHPMailer(true);
            $mail->isSMTP();
            $mail->Host = $validated['host'];
            $mail->SMTPAuth = true;
            $mail->Username = $validated['username'];
            $mail->Password = $validated['password'];
            $mail->SMTPSecure = $validated['encryption'];
            $mail->Port = $validated['port'];
            $mail->Timeout = 10;
            $mail->SMTPDebug = 0;

            // Try to connect
            if (@$mail->smtpConnect()) {
                $mail->smtpClose();
                return response()->json([
                    'status' => 'success',
                    'message' => 'Connection successful! Email configuration is valid.',
                ]);
            } else {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Failed to connect to SMTP server. Please check your credentials and host.',
                ], 400);
            }
        } catch (Exception $e) {
            // Extract meaningful error message
            $errorMsg = $e->getMessage();
            
            // Try to provide more specific guidance
            if (strpos($errorMsg, 'tls') !== false || strpos($errorMsg, 'ssl') !== false) {
                $errorMsg = 'Encryption setting mismatch. Try changing TLS/SSL setting.';
            } elseif (strpos($errorMsg, 'Failed to authenticate') !== false) {
                $errorMsg = 'Authentication failed. Check username/password.';
            } elseif (strpos($errorMsg, 'Connection refused') !== false || strpos($errorMsg, 'Network') !== false) {
                $errorMsg = 'Cannot reach SMTP server. Check host and port.';
            }
            
            return response()->json([
                'status' => 'error',
                'message' => 'Connection test failed: ' . $errorMsg,
            ], 400);
        }
    }
}

