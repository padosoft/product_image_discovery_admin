<?php

declare(strict_types=1);

namespace App\Http\Controllers\ProductImageDiscovery;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Response;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Storage;
use Padosoft\ProductImageDiscovery\Models\ProductImageDiscoveryCandidate;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

final class AdminCandidateImageController extends Controller
{
    private const SAFE_IMAGE_MIME_TYPES = [
        'image/avif' => true,
        'image/gif' => true,
        'image/jpeg' => true,
        'image/png' => true,
        'image/webp' => true,
    ];

    public function __invoke(int|string $candidate): Response|RedirectResponse|JsonResponse|StreamedResponse
    {
        if (is_string($candidate) && ! ctype_digit($candidate)) {
            abort(404, 'Not Found');
        }

        $record = ProductImageDiscoveryCandidate::query()->findOrFail($candidate);
        $disk = Storage::disk((string) config('product-image-discovery.storage.disk', 'local'));
        $localPath = $record->getAttribute('local_original_path');

        if (is_string($localPath) && $localPath !== '' && $disk->exists($localPath)) {
            $stream = $disk->readStream($localPath);

            if (is_resource($stream)) {
                return response()->stream(static function () use ($stream): void {
                    fpassthru($stream);

                    if (is_resource($stream)) {
                        fclose($stream);
                    }
                }, 200, $this->imageHeaders($this->localMimeType($record, $localPath), 'local'));
            }
        }

        $imageUrl = trim((string) $record->getAttribute('image_url'));

        if (str_starts_with(strtolower($imageUrl), 'data:image/')) {
            [$meta, $payload] = array_pad(explode(',', $imageUrl, 2), 2, '');
            $mime = $this->inlineMimeType($meta);
            $binary = base64_decode($payload, true);

            if ($mime !== null && $binary !== false) {
                return response($binary, 200, [
                    'Content-Type' => $mime,
                    'Cache-Control' => 'private, max-age=300',
                    'X-PID-Image-Source' => 'inline',
                    'X-Content-Type-Options' => 'nosniff',
                ]);
            }
        }

        if ($this->isRedirectableRemoteUrl($imageUrl)) {
            return redirect()->away($imageUrl, 302, [
                'X-PID-Image-Source' => 'remote',
            ]);
        }

        return response()->json([
            'message' => 'Candidate image is not available.',
        ], 404);
    }

    private function localMimeType(ProductImageDiscoveryCandidate $record, string $localPath): string
    {
        $mimeType = $this->safeMimeType($record->getAttribute('mime_type'));

        if ($mimeType !== 'application/octet-stream') {
            return $mimeType;
        }

        try {
            $detectedMimeType = Storage::disk((string) config('product-image-discovery.storage.disk', 'local'))->mimeType($localPath);
        } catch (Throwable) {
            $detectedMimeType = null;
        }

        return $this->safeMimeType($detectedMimeType);
    }

    /**
     * @return array<string, string>
     */
    private function imageHeaders(string $mimeType, string $source): array
    {
        return [
            'Content-Type' => $mimeType,
            'Cache-Control' => 'private, max-age=300',
            'X-PID-Image-Source' => $source,
            'X-Content-Type-Options' => 'nosniff',
        ];
    }

    private function inlineMimeType(string $meta): ?string
    {
        if (preg_match('/^data:(image\/[a-z0-9.+-]+);base64$/i', $meta, $matches) !== 1) {
            return null;
        }

        $mimeType = strtolower($matches[1]);

        return isset(self::SAFE_IMAGE_MIME_TYPES[$mimeType]) ? $mimeType : null;
    }

    private function safeMimeType(mixed $mimeType): string
    {
        if (! is_string($mimeType)) {
            return 'application/octet-stream';
        }

        $mimeType = strtolower(trim($mimeType));

        return isset(self::SAFE_IMAGE_MIME_TYPES[$mimeType]) ? $mimeType : 'application/octet-stream';
    }

    private function isRedirectableRemoteUrl(string $url): bool
    {
        if (filter_var($url, FILTER_VALIDATE_URL) === false) {
            return false;
        }

        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));

        return $scheme === 'http' || $scheme === 'https';
    }
}
