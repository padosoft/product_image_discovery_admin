<?php

declare(strict_types=1);

namespace App\Http\Controllers\ProductImageDiscovery;

use App\Support\ProductImageDiscovery\AdminRequestFilters;
use BackedEnum;
use DateTimeInterface;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryRequest;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class AdminRequestCsvExportController extends Controller
{
    private const EXPORT_LIMIT = 1000;

    public function __invoke(Request $request, AdminRequestFilters $requestFilters): StreamedResponse
    {
        $filters = $requestFilters->validated($request);
        $query = $requestFilters->query($filters)
            ->limit(self::EXPORT_LIMIT);
        $filename = 'product-image-discovery-requests-'.now('UTC')->format('Ymd-His').'.csv';

        return response()->streamDownload(function () use ($query): void {
            $output = fopen('php://output', 'w');

            if ($output === false) {
                return;
            }

            fputcsv($output, [
                'id',
                'client_id',
                'status',
                'brand',
                'supplier',
                'erp_model_id',
                'erp_model_color_id',
                'final_score',
                'rejection_reason',
                'selected_candidate_id',
                'best_candidate_id',
                'created_at',
                'updated_at',
            ]);

            foreach ($query->cursor() as $row) {
                fputcsv($output, $this->csvRow($row));
            }

            fclose($output);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    /**
     * @return array<int, scalar|null>
     */
    private function csvRow(ProductImageDiscoveryRequest $request): array
    {
        return [
            $request->getKey(),
            $request->getAttribute('client_id'),
            $this->csvValue($request->getAttribute('status')),
            $request->getAttribute('brand'),
            $request->getAttribute('supplier'),
            $request->getAttribute('erp_model_id'),
            $request->getAttribute('erp_model_color_id'),
            $request->getAttribute('final_score'),
            $this->csvValue($request->getAttribute('rejection_reason')),
            $request->getAttribute('selected_candidate_id'),
            $request->getAttribute('best_candidate_id'),
            $this->csvValue($request->getAttribute('created_at')),
            $this->csvValue($request->getAttribute('updated_at')),
        ];
    }

    private function csvValue(mixed $value): string|int|float|bool|null
    {
        if ($value instanceof BackedEnum) {
            return $value->value;
        }

        if ($value instanceof DateTimeInterface) {
            return $value->format(DateTimeInterface::ATOM);
        }

        if (is_scalar($value) || $value === null) {
            return $value;
        }

        return (string) json_encode($value, JSON_UNESCAPED_SLASHES);
    }
}
