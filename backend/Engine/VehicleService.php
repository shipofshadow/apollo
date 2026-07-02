<?php

declare(strict_types=1);

/**
 * Proxies vehicle data from the NHTSA vPIC API.
 *
 * Public methods intentionally keep the old output shape:
 *   getMakes()  -> string[]
 *   getModels() -> string[]
 *   getTrims()  -> array<int, array<string, mixed>>
 *
 * vPIC endpoints used:
 *   GET /api/vehicles/getallmakes?format=json
 *   GET /api/vehicles/GetModelsForMakeIdYear/makeId/{id}/modelyear/{year}?format=json
 */
class VehicleService
{
    private const BASE_URL = 'https://vpic.nhtsa.dot.gov/api/vehicles';

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Return all vehicle makes.
     *
     * @param  int|null $year  Kept for backward compatibility; vPIC all-makes is not year-filtered.
     * @return string[]
     */
    public function getMakes(?int $year = null): array
    {
        $cacheKey = 'vpic_makes_all';

        $cached = Cache::get($cacheKey);
        if ($cached !== null) {
            return $cached['items'] ?? [];
        }

        $makes = [];
        foreach ($this->getMakeRows() as $row) {
            $name = trim((string) ($row['Make_Name'] ?? ''));
            if ($name !== '') {
                $makes[] = $this->formatName($name);
            }
        }

        $makes = $this->uniqueSorted($makes);
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
        $make = trim($make);
        if ($make === '') {
            throw new RuntimeException("Parameter 'make' is required.", 422);
        }

        $makeId = $this->resolveMakeId($make);
        if ($makeId === null) {
            return [];
        }

        $cacheKey = 'vpic_models_' . md5(strtolower($make) . '|' . $makeId . '|' . ($year ?? 'all'));

        $cached = Cache::get($cacheKey);
        if ($cached !== null) {
            return $cached['items'] ?? [];
        }

        $path = $year !== null
            ? '/GetModelsForMakeIdYear/makeId/' . rawurlencode((string) $makeId) . '/modelyear/' . rawurlencode((string) $year)
            : '/GetModelsForMakeId/' . rawurlencode((string) $makeId);

        $payload = $this->request($path, ['format' => 'json']);
        $models = [];
        foreach (($payload['Results'] ?? []) as $row) {
            if (!is_array($row)) {
                continue;
            }

            $name = trim((string) ($row['Model_Name'] ?? ''));
            if ($name !== '') {
                $models[] = $this->formatName($name);
            }
        }

        $models = $this->uniqueSorted($models);
        Cache::set($cacheKey, ['items' => $models], CARAPI_MODELS_TTL);

        return $models;
    }

    /**
     * vPIC does not expose trim data in the old trim shape used here.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getTrims(string $make, string $model, int $limit = 50, int $page = 1): array
    {
        if ($make === '' || $model === '') {
            throw new RuntimeException("Parameters 'make' and 'model' are required.", 422);
        }

        return [];
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /** @return array<int, array<string, mixed>> */
    private function getMakeRows(): array
    {
        $cached = Cache::get('vpic_make_rows_all');
        if ($cached !== null) {
            return $cached['items'] ?? [];
        }

        $payload = $this->request('/getallmakes', ['format' => 'json']);
        $rows = [];
        foreach (($payload['Results'] ?? []) as $row) {
            if (is_array($row)) {
                $rows[] = $row;
            }
        }

        Cache::set('vpic_make_rows_all', ['items' => $rows], CARAPI_MAKES_TTL);
        return $rows;
    }

    private function resolveMakeId(string $make): ?int
    {
        $needle = $this->normalizeName($make);

        foreach ($this->getMakeRows() as $row) {
            $name = $this->normalizeName((string) ($row['Make_Name'] ?? ''));
            if ($name === $needle) {
                $id = (int) ($row['Make_ID'] ?? 0);
                return $id > 0 ? $id : null;
            }
        }

        return null;
    }

    /**
     * @param array<string, string> $query
     * @return array<string, mixed>
     */
    private function request(string $path, array $query): array
    {
        $url = self::BASE_URL . $path . '?' . http_build_query($query);
        $context = stream_context_create([
            'http' => [
                'method' => 'GET',
                'timeout' => 15,
                'header' => "Accept: application/json\r\nUser-Agent: 1625-AutoLab/1.0\r\n",
            ],
        ]);

        $raw = @file_get_contents($url, false, $context);
        if ($raw === false) {
            throw new RuntimeException('Vehicle API request failed.', 502);
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            throw new RuntimeException('Vehicle API returned an invalid response.', 502);
        }

        return $decoded;
    }

    private function normalizeName(string $name): string
    {
        return preg_replace('/\s+/', ' ', strtoupper(trim($name))) ?? '';
    }

    private function formatName(string $name): string
    {
        return preg_replace('/\s+/', ' ', trim($name)) ?? trim($name);
    }

    /**
     * @param string[] $items
     * @return string[]
     */
    private function uniqueSorted(array $items): array
    {
        $unique = [];
        foreach ($items as $item) {
            $key = $this->normalizeName($item);
            if ($key !== '') {
                $unique[$key] = $item;
            }
        }

        $values = array_values($unique);
        natcasesort($values);

        return array_values($values);
    }
}
