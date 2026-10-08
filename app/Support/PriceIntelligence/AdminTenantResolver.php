<?php

declare(strict_types=1);

namespace App\Support\PriceIntelligence;

use Illuminate\Contracts\Auth\Authenticatable;
use Padosoft\PriceIntelligence\Models\Tenant;

/**
 * Maps a session-authenticated admin user to the Price Intelligence tenant shown in the
 * /admin/price-intelligence panel. This app runs a single tenant, so every admin works on
 * the tenant whose code is PRICE_INTELLIGENCE_ADMIN_TENANT. Machine clients keep using
 * X-Api-Key, which ResolveTenant checks before falling back to this resolver.
 */
final class AdminTenantResolver
{
    public function __invoke(Authenticatable $user): int|string|null
    {
        $code = trim((string) config('price-intelligence-admin.tenant_code', 'gescat'));

        if ($code === '') {
            return null;
        }

        return Tenant::query()->where('code', $code)->value('id');
    }
}
