<?php

declare(strict_types=1);

use App\Http\Controllers\ProductImageDiscovery\AdminCandidateImageController;
use App\Http\Controllers\ProductImageDiscovery\AdminRequestCandidateController;
use App\Http\Controllers\ProductImageDiscovery\AdminDashboardSummaryController;
use App\Http\Controllers\ProductImageDiscovery\AdminRequestEventsController;
use App\Http\Controllers\ProductImageDiscovery\AdminRequestShowController;
use App\Http\Controllers\ProductImageDiscovery\AdminRequestSearchController;
use App\Http\Controllers\ProductImageDiscovery\AdminRequestRetryController;
use App\Http\Controllers\ProductImageDiscovery\AdminShellController;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Route;

Route::get('/', static function (): RedirectResponse {
    return redirect('/'.trim((string) config('pid-admin.route_prefix', 'admin/product-image-discovery'), '/'));
});

Route::prefix(config('pid-admin.route_prefix', 'admin/product-image-discovery'))
    ->middleware(config('pid-admin.route_middleware', ['web']))
    ->name('pid-admin.')
    ->group(function (): void {
        Route::get('dashboard-summary', AdminDashboardSummaryController::class)->name('dashboard-summary');
        Route::get('requests/search', AdminRequestSearchController::class)->name('requests.search');
        Route::get('requests/{request}', AdminRequestShowController::class)->name('requests.show');
        Route::get('requests/{request}/events', AdminRequestEventsController::class)->name('requests.events');
        Route::post('requests/{request}/retry', AdminRequestRetryController::class)->name('requests.retry');
        Route::get('requests/{request}/candidates', [AdminRequestCandidateController::class, 'index'])->name('requests.candidates');
        Route::post('requests/{request}/candidates/{candidate}/approve', [AdminRequestCandidateController::class, 'approve'])->name('requests.candidates.approve');
        Route::post('requests/{request}/candidates/{candidate}/reject', [AdminRequestCandidateController::class, 'reject'])->name('requests.candidates.reject');
        Route::get('candidates/{candidate}/image', AdminCandidateImageController::class)->name('candidates.image');

        Route::get('/', AdminShellController::class)->name('shell');
        Route::get('{path}', AdminShellController::class)
            ->where('path', '.*')
            ->name('shell.path');
    });
