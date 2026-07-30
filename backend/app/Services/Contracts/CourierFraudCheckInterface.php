<?php

namespace App\Services\Contracts;

use App\Models\CourierSetting;

interface CourierFraudCheckInterface
{
    /**
     * @return array{total:int,delivered:int,cancelled:int,success_rate:float,error:?string}
     */
    public function checkPhone(CourierSetting $settings, string $phone): array;
}
