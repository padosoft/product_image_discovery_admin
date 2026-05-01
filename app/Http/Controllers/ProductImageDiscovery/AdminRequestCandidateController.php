<?php

declare(strict_types=1);

namespace App\Http\Controllers\ProductImageDiscovery;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Padosoft\ProductImageDiscovery\Enums\ProductImageDiscoveryRejectionReason;
use Padosoft\ProductImageDiscovery\Http\Resources\ProductImageDiscoveryCandidateResource;
use Padosoft\ProductImageDiscovery\Http\Resources\ProductImageDiscoveryRequestResource;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryCandidate;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryEvent;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryRequest;

final class AdminRequestCandidateController extends Controller
{
    public function index(int|string $request): AnonymousResourceCollection
    {
        if (is_string($request) && ! ctype_digit($request)) {
            abort(404, 'Not Found');
        }

        $record = ProductImageDiscoveryRequest::query()->findOrFail($request);
        $candidates = $record->candidates()->orderByDesc('final_score')->paginate(max(1, min((int) request('per_page', 25), 100)));

        return ProductImageDiscoveryCandidateResource::collection($candidates);
    }

    public function approve(Request $httpRequest, int|string $request, int|string $candidate): JsonResponse
    {
        [$record, $candidateRecord] = $this->resolveRequestAndCandidate($request, $candidate);

        ProductImageDiscoveryCandidate::query()
            ->where('request_id', $record->getKey())
            ->whereKeyNot($candidateRecord->getKey())
            ->where('status', 'selected')
            ->update([
                'status' => 'candidate',
                'rejection_reason' => null,
            ]);

        $candidateRecord->fill([
            'status' => 'selected',
            'rejection_reason' => null,
        ]);
        $candidateRecord->save();

        $record->fill([
            'selected_candidate_id' => $candidateRecord->getKey(),
            'best_candidate_id' => $record->getAttribute('best_candidate_id') ?? $candidateRecord->getKey(),
            'final_score' => $candidateRecord->getAttribute('final_score'),
            'rejection_reason' => null,
            'status' => 'ready_to_publish',
            'verified_at' => now(),
        ]);
        $record->save();

        $this->recordAuditEvent($record, 'candidate_approved', [
            'approved_by' => $httpRequest->user()?->getAuthIdentifier(),
        ], $candidateRecord);

        $this->loadAvailableRelations($record, ['bestCandidate', 'selectedCandidate']);

        return response()->json([
            'ok' => true,
            'request' => (new ProductImageDiscoveryRequestResource($record))->resolve(),
            'candidate' => (new ProductImageDiscoveryCandidateResource($candidateRecord))->resolve(),
        ]);
    }

    public function reject(Request $httpRequest, int|string $request, int|string $candidate): JsonResponse
    {
        [$record, $candidateRecord] = $this->resolveRequestAndCandidate($request, $candidate);

        $payload = $httpRequest->validate([
            'reason' => ['required', 'string', 'max:100', Rule::in(array_map(static fn (ProductImageDiscoveryRejectionReason $reason): string => $reason->value, ProductImageDiscoveryRejectionReason::cases()))],
            'notes' => [
                'nullable',
                'string',
                'max:1000',
                Rule::requiredIf(static fn (): bool => in_array($httpRequest->input('reason'), [
                    ProductImageDiscoveryRejectionReason::WrongProduct->value,
                    ProductImageDiscoveryRejectionReason::WrongColor->value,
                    ProductImageDiscoveryRejectionReason::WrongBrand->value,
                    ProductImageDiscoveryRejectionReason::LowConfidence->value,
                ], true)),
            ],
        ]);

        $candidateRecord->fill([
            'status' => 'rejected',
            'rejection_reason' => $payload['reason'],
        ]);
        $candidateRecord->save();

        $otherCandidatesQuery = ProductImageDiscoveryCandidate::query()
            ->where('request_id', $record->getKey())
            ->whereKeyNot($candidateRecord->getKey())
            ->where('status', '!=', 'rejected');

        $hasRemainingCandidates = $otherCandidatesQuery->exists();
        $remainingBestCandidate = (clone $otherCandidatesQuery)
            ->orderByDesc('final_score')
            ->orderBy('id')
            ->first();
        $selectedCandidateId = $record->getAttribute('selected_candidate_id');
        $bestCandidateId = $record->getAttribute('best_candidate_id');
        $rejectedCandidateId = $candidateRecord->getKey();
        $candidateWasBest = $bestCandidateId !== null && (string) $bestCandidateId === (string) $rejectedCandidateId;

        $record->fill([
            'status' => $hasRemainingCandidates ? 'manual_review' : 'rejected',
            'rejection_reason' => $hasRemainingCandidates ? null : $payload['reason'],
            'selected_candidate_id' => $selectedCandidateId !== null && (string) $selectedCandidateId === (string) $rejectedCandidateId
                ? null
                : $selectedCandidateId,
            'best_candidate_id' => $candidateWasBest ? $remainingBestCandidate?->getKey() : $bestCandidateId,
            'final_score' => $candidateWasBest ? $remainingBestCandidate?->getAttribute('final_score') : $record->getAttribute('final_score'),
        ]);
        $record->save();

        $this->recordAuditEvent($record, 'candidate_rejected', [
            'rejected_by' => $httpRequest->user()?->getAuthIdentifier(),
            'reason' => $payload['reason'],
            'notes' => $payload['notes'] ?? null,
        ], $candidateRecord);

        $this->loadAvailableRelations($record, ['bestCandidate', 'selectedCandidate']);

        return response()->json([
            'ok' => true,
            'request' => (new ProductImageDiscoveryRequestResource($record))->resolve(),
            'candidate' => (new ProductImageDiscoveryCandidateResource($candidateRecord))->resolve(),
        ]);
    }

    /**
     * @return array{0: Model, 1: Model}
     */
    private function resolveRequestAndCandidate(int|string $requestId, int|string $candidateId): array
    {
        if (is_string($requestId) && ! ctype_digit($requestId)) {
            abort(404, 'Not Found');
        }

        if (is_string($candidateId) && ! ctype_digit($candidateId)) {
            abort(404, 'Not Found');
        }

        /** @var Model $record */
        $record = ProductImageDiscoveryRequest::query()->findOrFail($requestId);
        /** @var Model $candidate */
        $candidate = ProductImageDiscoveryCandidate::query()
            ->where('request_id', $record->getKey())
            ->findOrFail($candidateId);

        return [$record, $candidate];
    }

    private function recordAuditEvent(ProductImageDiscoveryRequest $record, string $eventType, array $context = [], ?ProductImageDiscoveryCandidate $candidate = null): void
    {
        ProductImageDiscoveryEvent::query()->create([
            'request_id' => $record->getKey(),
            'candidate_id' => $candidate?->getKey(),
            'event_type' => $eventType,
            'level' => 'info',
            'message' => $eventType,
            'context' => $context,
            'created_at' => now(),
        ]);
    }

    private function loadAvailableRelations(ProductImageDiscoveryRequest $record, array $relations): void
    {
        $record->loadMissing($relations);
    }
}
