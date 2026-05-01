<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

final class ProductImageDiscoveryDebugRun extends Model
{
    protected $table = 'product_image_discovery_debug_runs';

    protected $fillable = [
        'status',
        'request_payload',
        'options',
        'report_payload',
        'output',
        'error_message',
        'request_path',
        'report_path',
        'exit_code',
        'started_at',
        'finished_at',
    ];

    protected $casts = [
        'request_payload' => 'array',
        'options' => 'array',
        'report_payload' => 'array',
        'exit_code' => 'integer',
        'started_at' => 'immutable_datetime',
        'finished_at' => 'immutable_datetime',
    ];
}
