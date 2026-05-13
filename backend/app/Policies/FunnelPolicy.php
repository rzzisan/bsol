<?php

namespace App\Policies;

use App\Models\Funnel;
use App\Models\User;

class FunnelPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->role === 'seller' || $user->role === 'admin';
    }

    public function view(User $user, Funnel $funnel): bool
    {
        return $user->id === $funnel->user_id || $user->role === 'admin';
    }

    public function create(User $user): bool
    {
        return $user->role === 'seller' || $user->role === 'admin';
    }

    public function update(User $user, Funnel $funnel): bool
    {
        return $user->id === $funnel->user_id || $user->role === 'admin';
    }

    public function delete(User $user, Funnel $funnel): bool
    {
        return $user->id === $funnel->user_id || $user->role === 'admin';
    }
}
