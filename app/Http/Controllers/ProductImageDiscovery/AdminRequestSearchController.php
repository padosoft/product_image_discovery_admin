<?php

declare(strict_types=1);

namespace App\Http\Controllers\ProductImageDiscovery;

use App\Support\ProductImageDiscovery\AdminRequestFilters;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Padosoft\ProductImageDiscovery\Http\Resources\ProductImageDiscoveryRequestSummaryResource;

final class AdminRequestSearchController extends Controller
{
    public function __invoke(Request $request, AdminRequestFilters $requestFilters): AnonymousResourceCollection
    {
        $filters = $requestFilters->validated($request);

        return ProductImageDiscoveryRequestSummaryResource::collection(
            $requestFilters->query($filters)->paginate($filters['per_page'] ?? 15)
        );
    }
}
