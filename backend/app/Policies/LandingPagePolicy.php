<?php

namespace App\Policies;

use App\Models\LandingPage;
use App\Models\User;

class LandingPagePolicy
{
    public function viewAny(User $user): bool
    {
        return $user->role === 'seller' || $user->role === 'admin';
    }

    public function view(User $user, LandingPage $page): bool
    {
        return $user->id === $page->user_id || $user->role === 'admin';
    }

    public function create(User $user): bool
    {
        return $user->role === 'seller' || $user->role === 'admin';
    }

    public function update(User $user, LandingPage $page): bool
    {
        return $user->id === $page->user_id || $user->role === 'admin';
    }

    public function delete(User $user, LandingPage $page): bool
    {
        return $user->id === $page->user_id || $user->role === 'admin';
    }
}
