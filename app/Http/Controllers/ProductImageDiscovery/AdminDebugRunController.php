<?php

declare(strict_types=1);

namespace App\Http\Controllers\ProductImageDiscovery;

use App\Jobs\RunProductImageDiscoveryDebugFlowJob;
use App\Models\ProductImageDiscoveryDebugRun;
use App\Support\ProductImageDiscovery\DebugPayloadRedactor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\ValidationException;

final class AdminDebugRunController extends Controller
{
    public function index(): JsonResponse
    {
        $runs = ProductImageDiscoveryDebugRun::query()
            ->latest('id')
            ->limit(20)
            ->get()
            ->map(fn (ProductImageDiscoveryDebugRun $run): array => $this->resource($run, includeReport: false))
            ->values();

        return response()->json(['data' => $runs]);
    }

    public function store(Request $request): JsonResponse
    {
        $payload = $request->validate([
            'request_payload' => ['required', 'array'],
            'request_payload.client_id' => ['required', 'integer', 'min:1'],
            'request_payload.erp_model_color_id' => ['required', 'string'],
            'request_payload.brand' => ['required', 'string'],
            'options' => ['sometimes', 'array'],
            'options.max_candidates' => ['sometimes', 'integer', 'min:1', 'max:50'],
            'options.fresh' => ['sometimes', 'boolean'],
            'options.clean_storage' => ['sometimes', 'boolean'],
            'options.no_download' => ['sometimes', 'boolean'],
            'options.download_all' => ['sometimes', 'boolean'],
            'options.stop_on_first_good' => ['sometimes', 'boolean'],
            'options.exhaustive' => ['sometimes', 'boolean'],
            'options.good_score' => ['nullable', 'integer', 'min:0', 'max:100'],
            'options.no_env_brave' => ['sometimes', 'boolean'],
            'options.fail_on_no_match' => ['sometimes', 'boolean'],
        ]);

        $requestPayload = $request->input('request_payload', []);
        $options = $this->normalizedOptions($payload['options'] ?? []);

        if ($options['download_all'] && $options['no_download']) {
            throw ValidationException::withMessages([
                'options.download_all' => 'Cannot download all candidates when downloads are disabled.',
            ]);
        }

        $run = ProductImageDiscoveryDebugRun::query()->create([
            'status' => 'queued',
            'request_payload' => DebugPayloadRedactor::redact(is_array($requestPayload) ? $requestPayload : []),
            'options' => $options,
        ]);

        RunProductImageDiscoveryDebugFlowJob::dispatch($run->getKey());

        return response()->json(['data' => $this->resource($run->fresh())], 201);
    }

    public function show(ProductImageDiscoveryDebugRun $debugRun): JsonResponse
    {
        return response()->json(['data' => $this->resource($debugRun)]);
    }

    public function report(ProductImageDiscoveryDebugRun $debugRun): JsonResponse
    {
        return response()->json([
            'data' => [
                'id' => $debugRun->getKey(),
                'status' => $debugRun->getAttribute('status'),
                'report' => DebugPayloadRedactor::redact($debugRun->getAttribute('report_payload') ?? []),
            ],
        ]);
    }

    /**
     * @param array<string, mixed> $options
     * @return array<string, mixed>
     */
    private function normalizedOptions(array $options): array
    {
        return [
            'max_candidates' => max(1, min(50, (int) ($options['max_candidates'] ?? 10))),
            'fresh' => (bool) ($options['fresh'] ?? true),
            'clean_storage' => (bool) ($options['clean_storage'] ?? false),
            'no_download' => (bool) ($options['no_download'] ?? true),
            'download_all' => (bool) ($options['download_all'] ?? false),
            'stop_on_first_good' => (bool) ($options['stop_on_first_good'] ?? false),
            'exhaustive' => (bool) ($options['exhaustive'] ?? false),
            'good_score' => array_key_exists('good_score', $options) && $options['good_score'] !== null && $options['good_score'] !== ''
                ? max(0, min(100, (int) $options['good_score']))
                : null,
            'no_env_brave' => (bool) ($options['no_env_brave'] ?? true),
            'fail_on_no_match' => (bool) ($options['fail_on_no_match'] ?? false),
        ];
    }

    private function resource(ProductImageDiscoveryDebugRun $run, bool $includeReport = true): array
    {
        $reportPayload = $run->getAttribute('report_payload');
        $reportAvailable = is_array($reportPayload) && $reportPayload !== [];
        $report = $includeReport && is_array($reportPayload)
            ? DebugPayloadRedactor::redact($reportPayload)
            : [];
        $summary = is_array($reportPayload)
            ? DebugPayloadRedactor::redact($reportPayload['summary'] ?? null)
            : null;
        $requestSummary = is_array($reportPayload)
            ? DebugPayloadRedactor::redact($reportPayload['request'] ?? null)
            : null;

        return [
            'id' => $run->getKey(),
            'status' => $run->getAttribute('status'),
            'request_payload' => DebugPayloadRedactor::redact($run->getAttribute('request_payload') ?? []),
            'options' => $run->getAttribute('options') ?? [],
            'summary' => $summary,
            'request_summary' => $requestSummary,
            'report' => $includeReport ? $report : null,
            'report_available' => $reportAvailable,
            'output' => $includeReport ? $run->getAttribute('output') : null,
            'error_message' => $run->getAttribute('error_message'),
            'exit_code' => $run->getAttribute('exit_code'),
            'started_at' => $run->getAttribute('started_at')?->toISOString(),
            'finished_at' => $run->getAttribute('finished_at')?->toISOString(),
            'created_at' => $run->getAttribute('created_at')?->toISOString(),
            'updated_at' => $run->getAttribute('updated_at')?->toISOString(),
        ];
    }
}
