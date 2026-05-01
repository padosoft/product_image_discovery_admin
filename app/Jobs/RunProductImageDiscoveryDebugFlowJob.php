<?php

declare(strict_types=1);

namespace App\Jobs;

use App\Models\ProductImageDiscoveryDebugRun;
use App\Support\ProductImageDiscovery\DebugPayloadRedactor;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Padosoft\ProductImageDiscovery\Console\Commands\ProductImageDiscoveryDebugFlowCommand;
use Throwable;

final class RunProductImageDiscoveryDebugFlowJob implements ShouldQueue
{
    use Dispatchable;
    use InteractsWithQueue;
    use Queueable;
    use SerializesModels;

    public function __construct(private readonly int $debugRunId)
    {
    }

    public function handle(): void
    {
        $run = ProductImageDiscoveryDebugRun::query()->findOrFail($this->debugRunId);
        $startedAt = Carbon::now();

        $run->forceFill([
            'status' => 'running',
            'started_at' => $startedAt,
            'error_message' => null,
            'exit_code' => null,
            'report_payload' => null,
            'output' => null,
            'request_path' => null,
            'report_path' => null,
            'finished_at' => null,
        ])->save();

        $paths = $this->paths($run);

        try {
            File::ensureDirectoryExists(dirname($paths['request']));
            File::ensureDirectoryExists(dirname($paths['report']));
            File::put($paths['request'], json_encode($run->request_payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR).PHP_EOL);

            if (! array_key_exists('product-image-discovery:debug-flow', Artisan::all())) {
                Artisan::registerCommand(app(ProductImageDiscoveryDebugFlowCommand::class));
            }

            $exitCode = Artisan::call('product-image-discovery:debug-flow', $this->commandArguments($run, $paths));
            $consoleOutput = $this->sanitizeOutput(Artisan::output());
            $report = $this->readReport($paths['report']);
            $redactedReport = DebugPayloadRedactor::redact($report);
            $redactedJson = json_encode($redactedReport, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);

            File::put($paths['report'], $redactedJson.PHP_EOL);

            $run->forceFill([
                'status' => $exitCode === 0 ? 'succeeded' : 'failed',
                'report_payload' => $redactedReport,
                'output' => $consoleOutput,
                'error_message' => $exitCode === 0 ? null : ($consoleOutput ?: 'Debug flow failed.'),
                'request_path' => $this->relativeStoragePath($paths['request']),
                'report_path' => $this->relativeStoragePath($paths['report']),
                'exit_code' => $exitCode,
                'finished_at' => Carbon::now(),
            ])->save();
        } catch (Throwable $exception) {
            if (is_file($paths['report'])) {
                File::delete($paths['report']);
            }

            $run->forceFill([
                'status' => 'failed',
                'output' => null,
                'error_message' => $this->sanitizeMessage($exception->getMessage()),
                'request_path' => $this->relativeStoragePath($paths['request']),
                'report_path' => $this->relativeStoragePath($paths['report']),
                'exit_code' => 1,
                'finished_at' => Carbon::now(),
            ])->save();
        }
    }

    /**
     * @return array{request: string, report: string}
     */
    private function paths(ProductImageDiscoveryDebugRun $run): array
    {
        $directory = storage_path('app/product-image-discovery/debug-runs/'.$run->getKey());

        return [
            'request' => $directory.DIRECTORY_SEPARATOR.'request.json',
            'report' => $directory.DIRECTORY_SEPARATOR.'report.json',
        ];
    }

    /**
     * @param array{request: string, report: string} $paths
     * @return array<string, mixed>
     */
    private function commandArguments(ProductImageDiscoveryDebugRun $run, array $paths): array
    {
        $options = $run->options ?? [];
        $arguments = [
            'request' => $paths['request'],
            '--report' => $paths['report'],
            '--json' => true,
            '--max-candidates' => max(1, min(50, (int) ($options['max_candidates'] ?? 10))),
            '--fresh' => (bool) ($options['fresh'] ?? false),
            '--clean-storage' => (bool) ($options['clean_storage'] ?? false),
            '--no-download' => (bool) ($options['no_download'] ?? true),
            '--download-all' => (bool) ($options['download_all'] ?? false),
            '--stop-on-first-good' => (bool) ($options['stop_on_first_good'] ?? false),
            '--exhaustive' => (bool) ($options['exhaustive'] ?? false),
            '--no-env-brave' => (bool) ($options['no_env_brave'] ?? true),
            '--fail-on-no-match' => (bool) ($options['fail_on_no_match'] ?? false),
        ];

        if (isset($options['good_score']) && $options['good_score'] !== '') {
            $arguments['--good-score'] = max(0, min(100, (int) $options['good_score']));
        }

        return $arguments;
    }

    /**
     * @return array<string, mixed>
     */
    private function readReport(string $path): array
    {
        if (! is_file($path)) {
            return [];
        }

        $report = json_decode((string) File::get($path), true, flags: JSON_THROW_ON_ERROR);

        return is_array($report) ? $report : [];
    }

    private function relativeStoragePath(string $path): string
    {
        $normalizedPath = str_replace('\\', '/', $path);
        $storageRoot = rtrim(str_replace('\\', '/', storage_path('app')), '/').'/';

        return str_starts_with($normalizedPath, $storageRoot)
            ? substr($normalizedPath, strlen($storageRoot))
            : $normalizedPath;
    }

    private function sanitizeMessage(string $message): string
    {
        $message = $this->sanitizeOutput($message);

        return $message ?: 'Debug flow failed.';
    }

    private function sanitizeOutput(?string $message): ?string
    {
        $message = DebugPayloadRedactor::redactText(trim(preg_replace('/\s+/', ' ', (string) $message) ?? ''));

        return $message === '' ? null : mb_substr($message, 0, 10000);
    }
}
