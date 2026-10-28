<?php

declare(strict_types=1);

namespace App\Callbacks;

use Illuminate\Contracts\Queue\Job;
use Throwable;

/**
 * Reads the job class and its constructor arguments from a queue payload, for the listeners that
 * follow the pipeline jobs of the two packages from the outside (JobProcessed / JobFailed).
 */
final class QueuedCommand
{
    public static function name(Job $job): ?string
    {
        $name = $job->payload()['data']['commandName'] ?? null;

        return is_string($name) ? $name : null;
    }

    /**
     * The unserialized job, or null when the payload cannot be read (encrypted, class removed).
     */
    public static function instance(Job $job): ?object
    {
        $command = $job->payload()['data']['command'] ?? null;

        if (! is_string($command)) {
            return null;
        }

        try {
            $instance = unserialize($command, ['allowed_classes' => true]);
        } catch (Throwable) {
            return null;
        }

        return is_object($instance) && ! $instance instanceof \__PHP_Incomplete_Class ? $instance : null;
    }

    /**
     * A property of the job, private ones included (the package jobs keep their ids private).
     */
    public static function property(object $command, string $property): mixed
    {
        if (! property_exists($command, $property)) {
            return null;
        }

        return (fn () => $this->{$property} ?? null)->call($command);
    }
}
