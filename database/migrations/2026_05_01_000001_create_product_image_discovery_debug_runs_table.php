<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('product_image_discovery_debug_runs', function (Blueprint $table): void {
            $table->id();
            $table->string('status', 32)->default('queued')->index();
            $table->json('request_payload');
            $table->json('options')->nullable();
            $table->json('report_payload')->nullable();
            $table->longText('output')->nullable();
            $table->text('error_message')->nullable();
            $table->string('request_path')->nullable();
            $table->string('report_path')->nullable();
            $table->integer('exit_code')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('product_image_discovery_debug_runs');
    }
};
