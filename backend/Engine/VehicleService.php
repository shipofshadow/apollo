<?php

declare(strict_types=1);

use GuzzleHttp\Client;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Exception\RequestException;

/**
 * Proxies vehicle data from the API Ninjas car API.
 *
 * Endpoints used:
 *   GET /v1/carmakes          → list of all makes
 *   GET /v1/carmodels?make=X  → list of models for a given make
 *   GET /v1/cartrims?make=X&model=Y → list of trims
 *
 * Results are cached (APCu when available, file-system otherwise) to avoid
 * hammering the upstream API on every page load.
 *
 * Requires CARNINJA_API_KEY to be set in .env.
 */
class VehicleService
{
    private Client $http;

    public function __construct()
    {
        $this->http = new Client([
            'base_uri' => CARNINJA_BASE_URL . '/',
            'timeout'  => 10,
            'headers'  => [
                'X-Api-Key' => CARNINJA_API_KEY,
                'Accept'    => 'application/json',
            ],
        ]);
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
        $cacheKey = 'carninja_makes_' . ($year ?? 'all');

        $cached = Cache::get($cacheKey);
        if ($cached !== null) {
            return $cached['items'] ?? [];
        }

        $params = [];
        if ($year !== null) {
            $params['year'] = $year;
        }

        $items = $this->request('carmakes', $params);
        $makes = array_values(array_filter(
            is_array($items) ? $items : [],
            fn ($v) => is_string($v) && $v !== ''
        ));

        Cache::set($cacheKey, ['items' => $makes], CARNINJA_MAKES_TTL);
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

        $cacheKey = 'carninja_models_' . md5(strtolower($make) . '_' . ($year ?? 'all'));

        $cached = Cache::get($cacheKey);
        if ($cached !== null) {
            return $cached['items'] ?? [];
        }

        $params = ['make' => $make];
        if ($year !== null) {
            $params['year'] = $year;
        }

        $items  = $this->request('carmodels', $params);
        $models = array_values(array_filter(
            is_array($items) ? $items : [],
            fn ($v) => is_string($v) && $v !== ''
        ));

        Cache::set($cacheKey, ['items' => $models], CARNINJA_MODELS_TTL);
        return $models;
    }

    /**
     * Return trims for a given make and model.
     *
     * @param  int $limit  Max results (1–100).
     * @param  int $offset Pagination offset.
     * @return array<int, array<string, mixed>>
     */
    public function getTrims(string $make, string $model, int $limit = 50, int $offset = 0): array
    {
        if ($make === '' || $model === '') {
            throw new RuntimeException("Parameters 'make' and 'model' are required.", 422);
        }

        $limit  = max(1, min(100, $limit));
        $offset = max(0, $offset);

        $cacheKey = 'carninja_trims_' . md5(strtolower("$make|$model|$limit|$offset"));

        $cached = Cache::get($cacheKey);
        if ($cached !== null) {
            return $cached['items'] ?? [];
        }

        $items = $this->request('cartrims', [
            'make'   => $make,
            'model'  => $model,
            'limit'  => $limit,
            'offset' => $offset,
        ]);

        $trims = is_array($items) ? $items : [];
        Cache::set($cacheKey, ['items' => $trims], CARNINJA_MODELS_TTL);
        return $trims;
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /**
     * Make a GET request to the API Ninjas endpoint.
     *
     * @param  array<string, mixed> $params
     * @return mixed  Decoded JSON response body
     */
    private function request(string $endpoint, array $params = []): mixed
    {
        if (CARNINJA_API_KEY === '') {
            throw new RuntimeException(
                'CARNINJA_API_KEY is not configured on this server.', 503
            );
        }

        try {
            $response = $this->http->get($endpoint, [
                'query'       => $params,
                'http_errors' => false,
            ]);
        } catch (ConnectException $e) {
            throw new RuntimeException(
                'Unable to reach the API Ninjas vehicle service. Please try again.', 503
            );
        } catch (RequestException $e) {
            throw new RuntimeException('Vehicle API request failed: ' . $e->getMessage(), 502);
        }

        $status = $response->getStatusCode();
        $body   = (string) $response->getBody();

        if ($status === 401 || $status === 403) {
            throw new RuntimeException(
                'Invalid or missing CARNINJA_API_KEY. Check your server configuration.', 502
            );
        }

        if ($status !== 200) {
            throw new RuntimeException(
                "Vehicle API returned HTTP $status: $body", 502
            );
        }

        $decoded = json_decode($body, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new RuntimeException('Vehicle API returned invalid JSON.', 502);
        }

        return $decoded;
    }
}
