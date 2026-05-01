<?php

declare(strict_types=1);

namespace App\Http\Controllers\ProductImageDiscovery;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Padosoft\ProductImageDiscovery\Http\Controllers\Api\ProductImageDiscoverySettingController as PackageSettingController;

final class AdminSettingIndexController extends Controller
{
    public function __invoke(Request $request, PackageSettingController $settings, AdminShellController $shell): mixed
    {
        if ($request->expectsJson()) {
            return $settings->index();
        }

        return $shell();
    }
}
