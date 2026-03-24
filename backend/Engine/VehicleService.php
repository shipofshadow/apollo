<?php

declare(strict_types=1);

use CarApiSdk\CarApi;
use CarApiSdk\CarApiException;

/**
 * Proxies vehicle data from the CarAPI SDK (https://carapi.app).
 *
 * Endpoints used:
 *   GET /api/makes                        → list of all makes
 *   GET /api/models?make=X                → list of models for a given make
 *   GET /api/trims?make=X&model=Y         → list of trims
 *
 * Results are cached (APCu when available, file-system otherwise) to avoid
 * hammering the upstream API on every page load.
 *
 * Requires CARAPI_TOKEN and CARAPI_SECRET to be set in .env.
 */
class VehicleService
{
    private const JWT_CACHE_KEY = 'carapi_sdk_jwt';
    /** CarAPI JWTs last ~1 hour; cache slightly shorter to refresh before expiry */
    private const JWT_TTL = 3300;

    private CarApi $sdk;

    public function __construct()
    {
        if (CARAPI_TOKEN === '' || CARAPI_SECRET === '') {
            throw new RuntimeException(
                'CARAPI_TOKEN and CARAPI_SECRET are not configured on this server.', 503
            );
        }

        $this->sdk = CarApi::build([
            'token'  => CARAPI_TOKEN,
            'secret' => CARAPI_SECRET,
        ]);

        $this->ensureAuthenticated();
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Return all car makes.
     *
     * @param  int|null $year  Optional year filter.
     * @return string[]
     */
    public function getMakes(?int $year = null): array
    {
        $cacheKey = 'carapi_makes_' . ($year ?? 'all');

        $cached = Cache::get($cacheKey);
        if ($cached !== null) {
            return $cached['items'] ?? [];
        }

        $query = ['limit' => 100];
        if ($year !== null) {
            $query['year'] = $year;
        }

        $makes = $this->fetchAllNames(fn (int $page) => $this->sdk->makes(['query' => array_merge($query, ['page' => $page])]));

        Cache::set($cacheKey, ['items' => $makes], CARAPI_MAKES_TTL);
        return $makes;
    }

    /**
     * Return all models for a given make.
     *
     * @param  int|null $year  Optional year filter.
     * @return string[]
     */
    public function getModels(string $make, ?int $year = null): array
    {
        if ($make === '') {
            throw new RuntimeException("Parameter 'make' is required.", 422);
        }

        $cacheKey = 'carapi_models_' . md5(strtolower($make) . '_' . ($year ?? 'all'));

        $cached = Cache::get($cacheKey);
        if ($cached !== null) {
            return $cached['items'] ?? [];
        }

        $query = ['make' => $make, 'limit' => 100];
        if ($year !== null) {
            $query['year'] = $year;
        }

        $models = $this->fetchAllNames(fn (int $page) => $this->sdk->models(['query' => array_merge($query, ['page' => $page])]));

        Cache::set($cacheKey, ['items' => $models], CARAPI_MODELS_TTL);
        return $models;
    }

    /**
     * Return trims for a given make and model.
     *
     * @param  int $limit  Max results per page (1–100).
     * @param  int $page   1-based page number.
     * @return array<int, array<string, mixed>>
     */
    public function getTrims(string $make, string $model, int $limit = 50, int $page = 1): array
    {
        if ($make === '' || $model === '') {
            throw new RuntimeException("Parameters 'make' and 'model' are required.", 422);
        }

        $limit = max(1, min(100, $limit));
        $page  = max(1, $page);

        $cacheKey = 'carapi_trims_' . md5(strtolower("$make|$model|$limit|$page"));

        $cached = Cache::get($cacheKey);
        if ($cached !== null) {
            return $cached['items'] ?? [];
        }

        try {
            $result = $this->sdk->trims(['query' => [
                'make'  => $make,
                'model' => $model,
                'limit' => $limit,
                'page'  => $page,
            ]]);
        } catch (CarApiException $e) {
            throw new RuntimeException('Vehicle API request failed: ' . $e->getMessage(), 502);
        }

        $trims = array_map(fn ($t) => (array) $t, $result->data ?? []);

        Cache::set($cacheKey, ['items' => $trims], CARAPI_MODELS_TTL);
        return $trims;
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /**
     * Authenticate against CarAPI, using a cached JWT when still valid.
     */
    private function ensureAuthenticated(): void
    {
        $cached = Cache::get(self::JWT_CACHE_KEY);
        $jwt    = $cached['jwt'] ?? null;

        if (!empty($jwt)) {
            $this->sdk->loadJwt($jwt);
            if ($this->sdk->isJwtExpired() === false) {
                return;
            }
        }

        try {
            $jwt = $this->sdk->authenticate();
        } catch (CarApiException $e) {
            throw new RuntimeException(
                'Unable to authenticate with CarAPI. Check CARAPI_TOKEN and CARAPI_SECRET.', 503
            );
        }

        Cache::set(self::JWT_CACHE_KEY, ['jwt' => $jwt], self::JWT_TTL);
    }

    /**
     * Paginate through all pages of a collection endpoint, collecting the
     * `name` property of each item.
     *
     * @param  callable(int): object $fetcher  Accepts 1-based page number, returns SDK result object.
     * @return string[]
     */
    private function fetchAllNames(callable $fetcher): array
    {
        $names = [];
        $page  = 1;

        do {
            try {
                $result = $fetcher($page);
            } catch (CarApiException $e) {
                throw new RuntimeException('Vehicle API request failed: ' . $e->getMessage(), 502);
            }

            foreach ($result->data ?? [] as $item) {
                if (isset($item->name) && $item->name !== '') {
                    $names[] = $item->name;
                }
            }

            $lastPage = $result->collection->pages ?? 1;
            $page++;
        } while ($page <= $lastPage);

        return array_values(array_unique($names));
    }
}

