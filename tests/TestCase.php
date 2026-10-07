<?php

declare(strict_types=1);

namespace Tests;

use App\Models\User;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Admin routes sit behind `auth`; tests act as a signed-in operator unless they opt out.
     */
    protected bool $authenticateByDefault = true;

    protected function setUp(): void
    {
        parent::setUp();

        if ($this->authenticateByDefault) {
            $this->actingAs(new User(['name' => 'Test Operator', 'email' => 'operator@example.test']));
        }
    }

    public function createApplication()
    {
        $app = require __DIR__.'/../bootstrap/app.php';
        $app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

        return $app;
    }
}
