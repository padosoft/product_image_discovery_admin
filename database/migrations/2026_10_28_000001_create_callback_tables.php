<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // One row per start call that asked for a callback; the latest pending one of a resource
        // is the one that fires.
        Schema::create('callback_launches', function (Blueprint $table): void {
            $table->id();
            $table->string('event', 64);
            $table->string('resource_type', 64);
            $table->string('resource_id', 64);
            $table->uuid('token')->unique();
            $table->string('correlation_id', 191);
            $table->text('callback_url');
            $table->string('state', 20)->default('pending');
            $table->json('progress')->nullable();
            $table->unsignedBigInteger('callback_event_id')->nullable();
            $table->timestamps();

            $table->index(['event', 'resource_id', 'state']);
        });

        // Outbox: the exact signed body and its delivery state.
        Schema::create('callback_events', function (Blueprint $table): void {
            $table->id();
            $table->uuid('event_id')->unique();
            $table->string('event', 64);
            $table->string('resource_type', 64);
            $table->string('resource_id', 64);
            $table->string('correlation_id', 191);
            $table->string('status', 32);
            $table->text('callback_url');
            $table->text('body');
            $table->string('delivery_status', 20)->default('pending')->index();
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->timestamp('next_attempt_at')->nullable()->index();
            $table->timestamp('last_attempt_at')->nullable();
            $table->unsignedSmallInteger('last_response_status')->nullable();
            $table->string('last_error')->nullable();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('callback_events');
        Schema::dropIfExists('callback_launches');
    }
};
