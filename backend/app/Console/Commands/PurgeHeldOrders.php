<?php

namespace App\Console\Commands;

use App\Services\HeldOrderService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('app:purge-held-orders')]
#[Description('Delete held orders (placed during an expired subscription) that were not renewed within the retention window.')]
class PurgeHeldOrders extends Command
{
    public function handle(HeldOrderService $held): void
    {
        $this->info("Purged {$held->purgeExpired()} expired held order(s).");
    }
}
