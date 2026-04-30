<?php

declare(strict_types=1);

namespace App\Http\Controllers\ProductImageDiscovery;

use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryEvent;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryRequest;

final class AdminRequestEventsController extends Controller
{
    public function __invoke(int|string $request): JsonResponse
    {
        if (is_string($request) && ! ctype_digit($request)) {
            abort(404, 'Not Found');
        }

        $record = ProductImageDiscoveryRequest::query()->findOrFail($request);

        $events = $record->events()
            ->chronological()
            ->get()
            ->map(static fn (ProductImageDiscoveryEvent $event): array => [
                'id' => $event->getKey(),
                'request_id' => $event->getAttribute('request_id'),
                'candidate_id' => $event->getAttribute('candidate_id'),
                'event_type' => $event->getAttribute('event_type'),
                'level' => $event->getAttribute('level'),
                'message' => $event->getAttribute('message'),
                'context' => $event->getAttribute('context') ?? [],
                'created_at' => $event->getAttribute('created_at'),
            ])
            ->values();

        return response()->json(['data' => $events]);
    }
}
