<?php

declare(strict_types=1);

namespace App\Http\Controllers\ProductImageDiscovery;

use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Padosoft\ProductImageDiscovery\Http\Resources\ProductImageDiscoveryCandidateResource;
use Padosoft\ProductImageDiscovery\Http\Resources\ProductImageDiscoveryRequestResource;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryRequest;

final class AdminRequestShowController extends Controller
{
    public function __invoke(int|string $request): JsonResponse
    {
        if (is_string($request) && ! ctype_digit($request)) {
            abort(404, 'Not Found');
        }

        $record = ProductImageDiscoveryRequest::query()
            ->with(['bestCandidate', 'selectedCandidate', 'candidates'])
            ->findOrFail($request);

        return response()->json([
            'data' => (new ProductImageDiscoveryRequestResource($record))->resolve(),
            'candidates' => ProductImageDiscoveryCandidateResource::collection($record->candidates)
                ->resolve(),
        ]);
    }
}
