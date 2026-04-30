<?php

declare(strict_types=1);

namespace Database\Seeders;

use Padosoft\ProductImageDiscovery\Enums\ProductImageDiscoveryCandidateStatus;
use Padosoft\ProductImageDiscovery\Enums\ProductImageDiscoveryRejectionReason;
use Padosoft\ProductImageDiscovery\Enums\ProductImageDiscoveryRequestStatus;

final class ProductImageDiscoveryDemoScenarioFactory
{
    public const DEMO_CLIENT_ID = 9001;

    /**
     * @return array<int, array{
     *     slug: string,
     *     request: array<string, mixed>,
     *     candidates: array<int, array<string, mixed>>,
     *     best_candidate_key?: string,
     *     selected_candidate_key?: string|null,
     *     events: array<int, array<string, mixed>>
     * }>
     */
    public function scenarios(): array
    {
        return [
            $this->hernoManualReview(),
            $this->nikeReadyToPublish(),
            $this->newBalanceFailedRetry(),
        ];
    }

    /**
     * @return array<int, string>
     */
    public function demoErpModelColorIds(): array
    {
        return array_map(
            static fn (array $scenario): string => (string) $scenario['request']['erp_model_color_id'],
            $this->scenarios(),
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function hernoManualReview(): array
    {
        return [
            'slug' => 'herno-cammello-manual-review',
            'request' => [
                'client_id' => self::DEMO_CLIENT_ID,
                'erp_model_id' => 'HERNO-PI002223D',
                'erp_model_color_id' => 'HERNO-PI002223D-CAMMELLO',
                'erp_model_color_size_id' => null,
                'brand' => 'Herno',
                'supplier' => 'Herno',
                'sku' => 'PID-DEMO-HERNO-CAMMELLO',
                'supplier_sku' => 'PI002223D-12017Z-2157',
                'model_code' => 'PI002223D',
                'color_code' => '2157',
                'color_name' => 'Cammello',
                'ean' => '805-demo-0001',
                'season' => 'FW26',
                'category' => 'Outerwear',
                'material' => '100% Nylon',
                'price' => 665.00,
                'currency' => 'EUR',
                'raw_payload' => [
                    'pid_admin_demo' => true,
                    'scenario' => 'herno-cammello-manual-review',
                    'title' => 'Herno cappa in nylon ultralight cammello',
                    'notes' => 'Manual review scenario with one correct camel candidate and one wrong-color candidate.',
                ],
                'status' => ProductImageDiscoveryRequestStatus::ManualReview->value,
                'final_score' => 84,
                'rejection_reason' => null,
                'last_error' => null,
                'attempts' => 1,
            ],
            'best_candidate_key' => 'herno-official-camel',
            'selected_candidate_key' => null,
            'candidates' => [
                [
                    'key' => 'herno-official-camel',
                    'source_domain' => 'herno.example.test',
                    'source_page_url' => 'https://herno.example.test/pi002223d-cammello',
                    'image_url' => $this->pngDataUri(190, 147, 94),
                    'source_resolver' => 'demo_static',
                    'search_provider' => 'fake-demo',
                    'source_trust_score' => 95,
                    'textual_match_score' => 91,
                    'structured_match_score' => 89,
                    'visual_match_score' => 82,
                    'quality_score' => 88,
                    'risk_penalty' => -2,
                    'final_score' => 84,
                    'width' => 1200,
                    'height' => 1500,
                    'mime_type' => 'image/png',
                    'file_size' => 184,
                    'status' => ProductImageDiscoveryCandidateStatus::VerifiedMatch->value,
                    'evidence' => [
                        'title' => 'Herno PI002223D Cappa In Nylon Ultralight Cammello',
                        'matched_terms' => ['Herno', 'PI002223D', 'Cammello'],
                        'source_policy' => 'trusted_brand_site',
                    ],
                    'structured_data' => [
                        'brand' => 'Herno',
                        'mpn' => 'PI002223D',
                        'color' => 'Cammello',
                    ],
                    'ai_analysis' => [
                        'match' => true,
                        'variant_safe' => true,
                        'color_match' => true,
                        'confidence' => 0.86,
                    ],
                    'quality_analysis' => [
                        'min_size_passed' => true,
                        'watermark_detected' => false,
                        'background' => 'studio',
                    ],
                ],
                [
                    'key' => 'herno-wrong-black',
                    'source_domain' => 'fashion-market.example.test',
                    'source_page_url' => 'https://fashion-market.example.test/herno-pi002223d-nero',
                    'image_url' => $this->pngDataUri(28, 31, 36),
                    'source_resolver' => 'demo_static',
                    'search_provider' => 'fake-demo',
                    'source_trust_score' => 62,
                    'textual_match_score' => 77,
                    'structured_match_score' => 66,
                    'visual_match_score' => 34,
                    'quality_score' => 79,
                    'risk_penalty' => -18,
                    'final_score' => 55,
                    'width' => 1000,
                    'height' => 1300,
                    'mime_type' => 'image/png',
                    'file_size' => 184,
                    'status' => ProductImageDiscoveryCandidateStatus::Rejected->value,
                    'rejection_reason' => ProductImageDiscoveryRejectionReason::WrongColor->value,
                    'evidence' => [
                        'title' => 'Herno PI002223D cappa nero',
                        'matched_terms' => ['Herno', 'PI002223D'],
                        'missing_terms' => ['Cammello'],
                    ],
                    'structured_data' => [
                        'brand' => 'Herno',
                        'mpn' => 'PI002223D',
                        'color' => 'Nero',
                    ],
                    'ai_analysis' => [
                        'match' => false,
                        'variant_safe' => false,
                        'color_match' => false,
                        'confidence' => 0.92,
                    ],
                    'quality_analysis' => [
                        'min_size_passed' => true,
                        'watermark_detected' => false,
                    ],
                ],
                [
                    'key' => 'herno-retailer-camel',
                    'source_domain' => 'retailer.example.test',
                    'source_page_url' => 'https://retailer.example.test/herno-cappa-cammello',
                    'image_url' => $this->pngDataUri(203, 162, 111),
                    'source_resolver' => 'demo_static',
                    'search_provider' => 'fake-demo',
                    'source_trust_score' => 74,
                    'textual_match_score' => 82,
                    'structured_match_score' => 70,
                    'visual_match_score' => 76,
                    'quality_score' => 80,
                    'risk_penalty' => -5,
                    'final_score' => 77,
                    'width' => 900,
                    'height' => 1200,
                    'mime_type' => 'image/png',
                    'file_size' => 184,
                    'status' => ProductImageDiscoveryCandidateStatus::Candidate->value,
                    'evidence' => [
                        'title' => 'Cappa Herno cammello nylon ultralight',
                        'matched_terms' => ['Herno', 'Cammello'],
                    ],
                    'structured_data' => [
                        'brand' => 'Herno',
                        'color' => 'Cammello',
                    ],
                    'ai_analysis' => [
                        'match' => true,
                        'variant_safe' => true,
                        'color_match' => true,
                        'confidence' => 0.78,
                    ],
                    'quality_analysis' => [
                        'min_size_passed' => true,
                        'watermark_detected' => false,
                    ],
                ],
            ],
            'events' => [
                [
                    'event_type' => 'demo.request_created',
                    'level' => 'info',
                    'message' => 'Demo Herno request created for manual review.',
                    'context' => ['stage' => 'ingest'],
                ],
                [
                    'event_type' => 'demo.search_completed',
                    'level' => 'info',
                    'message' => 'Fake provider returned three deterministic candidates.',
                    'context' => ['provider' => 'fake-demo', 'candidate_count' => 3],
                ],
                [
                    'candidate_key' => 'herno-wrong-black',
                    'event_type' => 'demo.ai_rejected_wrong_color',
                    'level' => 'warning',
                    'message' => 'AI verification rejected the black variant for the camel request.',
                    'context' => ['reason' => ProductImageDiscoveryRejectionReason::WrongColor->value],
                ],
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function nikeReadyToPublish(): array
    {
        return [
            'slug' => 'nike-air-force-ready',
            'request' => [
                'client_id' => self::DEMO_CLIENT_ID,
                'erp_model_id' => 'NIKE-AF1-07',
                'erp_model_color_id' => 'NIKE-AF1-07-CW2288-111',
                'erp_model_color_size_id' => null,
                'brand' => 'Nike',
                'supplier' => 'Nike',
                'sku' => 'PID-DEMO-NIKE-AF1-WHITE',
                'supplier_sku' => 'CW2288-111',
                'model_code' => 'Air Force 1 07',
                'color_code' => 'CW2288-111',
                'color_name' => 'White',
                'ean' => '195-demo-0002',
                'season' => 'CORE',
                'category' => 'Sneakers',
                'material' => 'Leather',
                'price' => 119.99,
                'currency' => 'EUR',
                'raw_payload' => [
                    'pid_admin_demo' => true,
                    'scenario' => 'nike-air-force-ready',
                    'title' => "Nike Air Force 1 '07 white",
                    'notes' => 'Ready-to-publish scenario with a selected candidate and rejected wrong product.',
                ],
                'status' => ProductImageDiscoveryRequestStatus::ReadyToPublish->value,
                'final_score' => 92,
                'rejection_reason' => null,
                'last_error' => null,
                'attempts' => 1,
            ],
            'best_candidate_key' => 'nike-official-white',
            'selected_candidate_key' => 'nike-official-white',
            'candidates' => [
                [
                    'key' => 'nike-official-white',
                    'source_domain' => 'nike.example.test',
                    'source_page_url' => 'https://nike.example.test/air-force-1-07-cw2288-111',
                    'image_url' => $this->pngDataUri(245, 245, 239),
                    'source_resolver' => 'demo_static',
                    'search_provider' => 'fake-demo',
                    'source_trust_score' => 96,
                    'textual_match_score' => 94,
                    'structured_match_score' => 92,
                    'visual_match_score' => 90,
                    'quality_score' => 91,
                    'risk_penalty' => 0,
                    'final_score' => 92,
                    'width' => 1600,
                    'height' => 1600,
                    'mime_type' => 'image/png',
                    'file_size' => 184,
                    'status' => ProductImageDiscoveryCandidateStatus::Selected->value,
                    'evidence' => [
                        'title' => "Nike Air Force 1 '07 Men's Shoes White",
                        'matched_terms' => ['Nike', 'Air Force 1', 'CW2288-111'],
                        'source_policy' => 'trusted_brand_site',
                    ],
                    'structured_data' => [
                        'brand' => 'Nike',
                        'mpn' => 'CW2288-111',
                        'color' => 'White',
                    ],
                    'ai_analysis' => [
                        'match' => true,
                        'variant_safe' => true,
                        'color_match' => true,
                        'confidence' => 0.94,
                    ],
                    'quality_analysis' => [
                        'min_size_passed' => true,
                        'watermark_detected' => false,
                    ],
                ],
                [
                    'key' => 'nike-court-vision',
                    'source_domain' => 'sneaker-market.example.test',
                    'source_page_url' => 'https://sneaker-market.example.test/nike-court-vision-white',
                    'image_url' => $this->pngDataUri(224, 228, 218),
                    'source_resolver' => 'demo_static',
                    'search_provider' => 'fake-demo',
                    'source_trust_score' => 58,
                    'textual_match_score' => 61,
                    'structured_match_score' => 52,
                    'visual_match_score' => 46,
                    'quality_score' => 81,
                    'risk_penalty' => -24,
                    'final_score' => 47,
                    'width' => 1000,
                    'height' => 1000,
                    'mime_type' => 'image/png',
                    'file_size' => 184,
                    'status' => ProductImageDiscoveryCandidateStatus::Rejected->value,
                    'rejection_reason' => ProductImageDiscoveryRejectionReason::WrongProduct->value,
                    'evidence' => [
                        'title' => 'Nike Court Vision Low white sneaker',
                        'matched_terms' => ['Nike', 'White'],
                        'missing_terms' => ['Air Force 1', 'CW2288-111'],
                    ],
                    'structured_data' => [
                        'brand' => 'Nike',
                        'model' => 'Court Vision',
                        'color' => 'White',
                    ],
                    'ai_analysis' => [
                        'match' => false,
                        'variant_safe' => false,
                        'product_type_match' => false,
                        'confidence' => 0.9,
                    ],
                    'quality_analysis' => [
                        'min_size_passed' => true,
                        'watermark_detected' => false,
                    ],
                ],
            ],
            'events' => [
                [
                    'event_type' => 'demo.request_created',
                    'level' => 'info',
                    'message' => 'Demo Nike request created.',
                    'context' => ['stage' => 'ingest'],
                ],
                [
                    'candidate_key' => 'nike-official-white',
                    'event_type' => 'demo.candidate_selected',
                    'level' => 'info',
                    'message' => 'Official Nike candidate selected by the demo seed.',
                    'context' => ['score' => 92],
                ],
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function newBalanceFailedRetry(): array
    {
        return [
            'slug' => 'new-balance-550-retry',
            'request' => [
                'client_id' => self::DEMO_CLIENT_ID,
                'erp_model_id' => 'NEW-BALANCE-550',
                'erp_model_color_id' => 'LVR-78I-AM9016',
                'erp_model_color_size_id' => null,
                'brand' => 'New Balance',
                'supplier' => 'LuisaViaRoma',
                'sku' => 'PID-DEMO-NB-550-WHITE-GREY',
                'supplier_sku' => '78I-AM9016',
                'model_code' => '550',
                'color_code' => '78I-AM9016',
                'color_name' => 'White/Grey',
                'ean' => '197-demo-0003',
                'season' => 'SS26',
                'category' => 'Sneakers',
                'material' => 'Leather and synthetic',
                'price' => 139.00,
                'currency' => 'EUR',
                'raw_payload' => [
                    'pid_admin_demo' => true,
                    'scenario' => 'new-balance-550-retry',
                    'title' => 'New Balance 550 white grey',
                    'notes' => 'Retry scenario with no retained candidates after a fake provider timeout.',
                ],
                'status' => ProductImageDiscoveryRequestStatus::Failed->value,
                'final_score' => null,
                'rejection_reason' => null,
                'last_error' => 'Fake demo provider timed out before candidates were retained.',
                'attempts' => 2,
            ],
            'best_candidate_key' => null,
            'selected_candidate_key' => null,
            'candidates' => [],
            'events' => [
                [
                    'event_type' => 'demo.request_created',
                    'level' => 'info',
                    'message' => 'Demo New Balance request created.',
                    'context' => ['stage' => 'ingest'],
                ],
                [
                    'event_type' => 'demo.provider_timeout',
                    'level' => 'error',
                    'message' => 'Fake demo provider timed out before returning usable candidates.',
                    'context' => ['provider' => 'fake-demo', 'retryable' => true],
                ],
            ],
        ];
    }

    private function pngDataUri(int $red, int $green, int $blue): string
    {
        return 'data:image/png;base64,'.base64_encode($this->solidPng($red, $green, $blue));
    }

    private function solidPng(int $red, int $green, int $blue): string
    {
        $width = 32;
        $height = 32;
        $pixel = chr($red).chr($green).chr($blue).chr(255);
        $row = chr(0).str_repeat($pixel, $width);
        $raw = str_repeat($row, $height);

        return "\x89PNG\r\n\x1a\n"
            .$this->pngChunk('IHDR', pack('NNCCCCC', $width, $height, 8, 6, 0, 0, 0))
            .$this->pngChunk('IDAT', gzcompress($raw))
            .$this->pngChunk('IEND', '');
    }

    private function pngChunk(string $type, string $data): string
    {
        return pack('N', strlen($data)).$type.$data.pack('N', crc32($type.$data));
    }
}
