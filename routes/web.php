<?php

declare(strict_types=1);

use App\Http\Controllers\ProductImageDiscovery\AdminCandidateImageController;
use App\Http\Controllers\ProductImageDiscovery\AdminDashboardSummaryController;
use App\Http\Controllers\ProductImageDiscovery\AdminDebugRunController;
use App\Http\Controllers\ProductImageDiscovery\AdminHealthController;
use App\Http\Controllers\ProductImageDiscovery\AdminRequestCandidateController;
use App\Http\Controllers\ProductImageDiscovery\AdminRequestEventsController;
use App\Http\Controllers\ProductImageDiscovery\AdminRequestRetryController;
use App\Http\Controllers\ProductImageDiscovery\AdminRequestSearchController;
use App\Http\Controllers\ProductImageDiscovery\AdminRequestShowController;
use App\Http\Controllers\ProductImageDiscovery\AdminSearchProviderController;
use App\Http\Controllers\ProductImageDiscovery\AdminSettingIndexController;
use App\Http\Controllers\ProductImageDiscovery\AdminShellController;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Route;
use Padosoft\ProductImageDiscovery\Http\Controllers\Api\ProductImageDiscoverySettingController as PackageSettingController;
use Padosoft\ProductImageDiscovery\Http\Controllers\Api\ProductImageDiscoveryRequestController as PackageRequestController;
use Padosoft\ProductImageDiscovery\Http\Controllers\Api\ProductImageTrustedSourceController as PackageTrustedSourceController;

$adminPrefix = trim((string) config('pid-admin.route_prefix', 'admin/product-image-discovery'), '/');

Route::get('/', static function (): RedirectResponse {
    return redirect('/'.trim((string) config('pid-admin.route_prefix', 'admin/product-image-discovery'), '/'));
});

Route::prefix($adminPrefix)
    ->middleware(config('pid-admin.route_middleware', ['web']))
    ->name('pid-admin.')
    ->group(function (): void {
        Route::get('dashboard-summary', AdminDashboardSummaryController::class)->name('dashboard-summary');
        Route::get('health', AdminHealthController::class)->name('health');
        Route::middleware(config('pid-admin.debug_run_middleware', ['auth']))
            ->group(function (): void {
                Route::get('debug-runs', [AdminDebugRunController::class, 'index'])->name('debug-runs.index');
                Route::post('debug-runs', [AdminDebugRunController::class, 'store'])
                    ->middleware('throttle:6,1')
                    ->name('debug-runs.store');
                Route::get('debug-runs/{debugRun}', [AdminDebugRunController::class, 'show'])->name('debug-runs.show');
                Route::get('debug-runs/{debugRun}/report', [AdminDebugRunController::class, 'report'])->name('debug-runs.report');
            });
        Route::get('requests/search', AdminRequestSearchController::class)->name('requests.search');
        Route::post('requests', [PackageRequestController::class, 'store'])->name('requests.store');
        Route::get('requests/{request}', AdminRequestShowController::class)->name('requests.show');
        Route::get('requests/{request}/events', AdminRequestEventsController::class)->name('requests.events');
        Route::post('requests/{request}/retry', AdminRequestRetryController::class)->name('requests.retry');
        Route::get('requests/{request}/candidates', [AdminRequestCandidateController::class, 'index'])->name('requests.candidates');
        Route::post('requests/{request}/candidates/{candidate}/approve', [AdminRequestCandidateController::class, 'approve'])->name('requests.candidates.approve');
        Route::post('requests/{request}/candidates/{candidate}/reject', [AdminRequestCandidateController::class, 'reject'])->name('requests.candidates.reject');
        Route::get('candidates/{candidate}/image', AdminCandidateImageController::class)->name('candidates.image');
        Route::get('settings', AdminSettingIndexController::class)->name('settings.index');
        Route::post('settings', [PackageSettingController::class, 'store'])->name('settings.store');
        Route::get('settings/{setting}', [PackageSettingController::class, 'show'])->name('settings.show');
        Route::put('settings/{setting}', [PackageSettingController::class, 'update'])->name('settings.update');
        Route::delete('settings/{setting}', [PackageSettingController::class, 'destroy'])->name('settings.destroy');
        Route::get('search-providers', [AdminSearchProviderController::class, 'index'])->name('search-providers.index');
        Route::post('search-providers', [AdminSearchProviderController::class, 'store'])->name('search-providers.store');
        Route::post('search-providers/{searchProvider}/test', [AdminSearchProviderController::class, 'test'])
            ->middleware('throttle:6,1')
            ->name('search-providers.test');
        Route::get('search-providers/{searchProvider}', [AdminSearchProviderController::class, 'show'])->name('search-providers.show');
        Route::put('search-providers/{searchProvider}', [AdminSearchProviderController::class, 'update'])->name('search-providers.update');
        Route::delete('search-providers/{searchProvider}', [AdminSearchProviderController::class, 'destroy'])->name('search-providers.destroy');
        Route::get('trusted-sources', [PackageTrustedSourceController::class, 'index'])->name('trusted-sources.index');
        Route::post('trusted-sources', [PackageTrustedSourceController::class, 'store'])->name('trusted-sources.store');
        Route::get('trusted-sources/{trustedSource}', [PackageTrustedSourceController::class, 'show'])->name('trusted-sources.show');
        Route::put('trusted-sources/{trustedSource}', [PackageTrustedSourceController::class, 'update'])->name('trusted-sources.update');
        Route::delete('trusted-sources/{trustedSource}', [PackageTrustedSourceController::class, 'destroy'])->name('trusted-sources.destroy');

        Route::get('/', AdminShellController::class)->name('shell');
        Route::get('{path}', AdminShellController::class)
            ->where('path', '.*')
            ->name('shell.path');
    });
