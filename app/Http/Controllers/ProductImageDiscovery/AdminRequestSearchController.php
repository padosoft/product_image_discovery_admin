<?php

declare(strict_types=1);

namespace App\Http\Controllers\ProductImageDiscovery;

use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Illuminate\Validation\ValidationException;
use Padosoft\ProductImageDiscovery\Http\Resources\ProductImageDiscoveryRequestSummaryResource;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryRequest;

final class AdminRequestSearchController extends Controller
{
    public function __invoke(Request $request): AnonymousResourceCollection
    {
        $filters = $request->validate([
            'client_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'string', 'max:50'],
            'brand' => ['nullable', 'string', 'max:255'],
            'supplier' => ['nullable', 'string', 'max:255'],
            'erp_model_id' => ['nullable', 'string', 'max:128'],
            'erp_model_color_id' => ['nullable', 'string', 'max:128'],
            'ean' => ['nullable', 'string', 'max:64'],
            'source_domain' => ['nullable', 'string', 'max:255'],
            'rejection_reason' => ['nullable', 'string', 'max:100'],
            'min_score' => ['nullable', 'integer', 'between:0,100'],
            'max_score' => ['nullable', 'integer', 'between:0,100'],
            'manual_review_required' => ['nullable', 'boolean'],
            'has_candidates' => ['nullable', 'boolean'],
            'has_selected_image' => ['nullable', 'boolean'],
            'created_from' => ['nullable', 'date'],
            'created_to' => ['nullable', 'date'],
            'updated_from' => ['nullable', 'date'],
            'updated_to' => ['nullable', 'date'],
            'sort_by' => ['nullable', 'in:created_at,updated_at,final_score,status,brand,supplier,client_id'],
            'sort_direction' => ['nullable', 'in:asc,desc'],
            'per_page' => ['nullable', 'integer', 'between:1,100'],
        ]);

        if (($filters['min_score'] ?? null) !== null
            && ($filters['max_score'] ?? null) !== null
            && $filters['min_score'] > $filters['max_score']) {
            throw ValidationException::withMessages([
                'max_score' => 'The max score field must be greater than or equal to min score.',
            ]);
        }

        $query = ProductImageDiscoveryRequest::query();

        foreach (['client_id', 'status', 'brand', 'supplier', 'erp_model_id', 'erp_model_color_id', 'ean', 'rejection_reason'] as $field) {
            if (($filters[$field] ?? null) !== null) {
                $query->where($field, $filters[$field]);
            }
        }

        if (($filters['min_score'] ?? null) !== null) {
            $query->where('final_score', '>=', $filters['min_score']);
        }

        if (($filters['max_score'] ?? null) !== null) {
            $query->where('final_score', '<=', $filters['max_score']);
        }

        $query
            ->when($filters['created_from'] ?? null, fn (Builder $builder, string $date): Builder => $builder->where('created_at', '>=', $this->dateBoundary($date, endOfDay: false)))
            ->when($filters['created_to'] ?? null, fn (Builder $builder, string $date): Builder => $builder->where('created_at', '<=', $this->dateBoundary($date, endOfDay: true)))
            ->when($filters['updated_from'] ?? null, fn (Builder $builder, string $date): Builder => $builder->where('updated_at', '>=', $this->dateBoundary($date, endOfDay: false)))
            ->when($filters['updated_to'] ?? null, fn (Builder $builder, string $date): Builder => $builder->where('updated_at', '<=', $this->dateBoundary($date, endOfDay: true)));

        if (($filters['manual_review_required'] ?? null) !== null) {
            (bool) $filters['manual_review_required']
                ? $query->where('status', 'manual_review')
                : $query->where('status', '!=', 'manual_review');
        }

        if (($filters['has_selected_image'] ?? null) !== null) {
            (bool) $filters['has_selected_image']
                ? $query->whereNotNull('selected_candidate_id')
                : $query->whereNull('selected_candidate_id');
        }

        if (($filters['has_candidates'] ?? null) !== null) {
            (bool) $filters['has_candidates']
                ? $query->has('candidates')
                : $query->doesntHave('candidates');
        }

        if (($filters['source_domain'] ?? null) !== null) {
            $query->whereHas('candidates', static function (Builder $candidateQuery) use ($filters): void {
                $candidateQuery->where('source_domain', $filters['source_domain']);
            });
        }

        $sortBy = $filters['sort_by'] ?? 'created_at';
        $sortDirection = $filters['sort_direction'] ?? 'desc';

        return ProductImageDiscoveryRequestSummaryResource::collection(
            $query->orderBy($sortBy, $sortDirection)->paginate($filters['per_page'] ?? 15)
        );
    }

    private function dateBoundary(string $value, bool $endOfDay): string
    {
        $date = CarbonImmutable::parse($value);

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) === 1) {
            $date = $endOfDay ? $date->endOfDay() : $date->startOfDay();
        }

        return $date->toDateTimeString();
    }
}
