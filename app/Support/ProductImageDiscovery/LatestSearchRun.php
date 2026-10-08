<?php

declare(strict_types=1);

namespace App\Support\ProductImageDiscovery;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Padosoft\ProductImageDiscovery\Services\Support\SearchRun;

final class LatestSearchRun
{
    /**
     * Limit a candidate query to the request's latest search run, so candidates left by earlier
     * runs (a retry or a re-POST of the same article) are neither shown nor reused. Requests
     * searched before the package tracked runs have none: the query is left untouched.
     *
     * @template TQuery of Builder|Relation
     *
     * @param  TQuery  $candidates
     * @return TQuery
     */
    public static function scope(Builder|Relation $candidates, Model $request): Builder|Relation
    {
        $searchRun = SearchRun::current($request->getAttribute('raw_payload'));

        if ($searchRun !== null) {
            $candidates->where('search_run', $searchRun);
        }

        return $candidates;
    }
}
