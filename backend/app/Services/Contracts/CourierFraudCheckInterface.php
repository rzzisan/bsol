<?php

namespace App\Services\Contracts;

use App\Models\CourierSetting;

interface CourierFraudCheckInterface
{
    /**
     * @return array{total:int,delivered:int,cancelled:int,success_rate:float,error:?string,data_type?:string,rating?:?string}
     *
     * data_type is 'delivery' (default, raw counts) unless the courier only exposes a
     * qualitative rating (currently Pathao's merchant dashboard) — then it's 'rating' and
     * `rating` holds the courier's own label (e.g. "excellent_customer"); total/delivered/
     * cancelled/success_rate are not meaningful in that case and should be treated as unknown.
     */
    public function checkPhone(CourierSetting $settings, string $phone): array;
}
