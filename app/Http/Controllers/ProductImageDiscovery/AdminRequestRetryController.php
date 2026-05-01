<?php

declare(strict_types=1);

namespace App\Http\Controllers\ProductImageDiscovery;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Padosoft\ProductImageDiscovery\Enums\ProductImageDiscoveryRequestStatus;
use Padosoft\ProductImageDiscovery\Http\Resources\ProductImageDiscoveryRequestResource;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryEvent;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryRequest;

final class AdminRequestRetryController extends Controller
{
    public function __invoke(Request $httpRequest, int|string $request): JsonResponse
    {
        if (is_string($request) && ! ctype_digit($request)) {
            abort(404, 'Not Found');
        }

        $record = ProductImageDiscoveryRequest::query()->findOrFail($request);
        $statusValue = $record->getAttribute('status');
        $statusValue = $statusValue instanceof ProductImageDiscoveryRequestStatus
            ? $statusValue->value
            : (string) $statusValue;
        $status = ProductImageDiscoveryRequestStatus::tryFrom($statusValue);

        if ($status === null || ! $status->isRetryable()) {
            return response()->json([
                'message' => 'This request cannot be retried from its current status.',
                'status' => $statusValue,
            ], 409);
        }

        $record->fill([
            'status' => 'queued',
            'rejection_reason' => null,
            'last_error' => null,
            'attempts' => ((int) $record->getAttribute('attempts')) + 1,
        ]);
        $record->save();

        ProductImageDiscoveryEvent::query()->create([
            'request_id' => $record->getKey(),
            'event_type' => 'request_retry_requested',
            'level' => 'info',
            'message' => 'Request retry requested.',
            'context' => [
                'requested_by' => $httpRequest->user()?->getAuthIdentifier(),
            ],
            'created_at' => now(),
        ]);

        $record->loadMissing(['bestCandidate', 'selectedCandidate']);

        return response()->json([
            'ok' => true,
            'request' => (new ProductImageDiscoveryRequestResource($record))->resolve(),
        ]);
    }
}
