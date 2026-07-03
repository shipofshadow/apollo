#!/usr/bin/env php
<?php

declare(strict_types=1);

/**
 * Pulls every make, model, and trim from CarAPI (via VehicleService) and
 * upserts it into the local MySQL database.
 *
 * Usage:
 *   php scripts/sync_vehicles.php
 *   php scripts/sync_vehicles.php --make="Toyota"       # sync a single make
 *   php scripts/sync_vehicles.php --sleep-ms=200         # throttle between models
 *
 * Run sql/vehicle_schema.sql once beforehand to create the tables.
 */
// -----------------------------------------------------------------------
// Bootstrap — adjust these requires to match how your project autoloads.
// -----------------------------------------------------------------------
require_once __DIR__ . '/vendor/autoload.php';   // CarApiSdk, Cache, etc.
require_once __DIR__ . '/config/init.php';             // defines CARAPI_TOKEN, CARAPI_SECRET, ...
require_once __DIR__ . '/Engine/VehicleService.php'; // adjust path if different

ini_set('memory_limit', '512M');
set_time_limit(0); // this can take a while — hundreds of makes x models x trim pages

// -----------------------------------------------------------------------
// CLI args
// -----------------------------------------------------------------------
$options   = getopt('', ['make::', 'sleep-ms::']);
$onlyMake  = $options['make'] ?? null;
$sleepUs   = (int) ($options['sleep-ms'] ?? 150) * 1000; // be polite to the upstream API

// -----------------------------------------------------------------------
// Setup
// -----------------------------------------------------------------------
/** @var PDO $pdo */
$pdo = Database::getInstance();
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$vehicleService = new VehicleService();

$stats = ['makes' => 0, 'models' => 0, 'trims' => 0, 'errors' => 0];

// -----------------------------------------------------------------------
// Prepared statements
// -----------------------------------------------------------------------
$upsertMake = $pdo->prepare(
    'INSERT INTO vehicle_makes (name) VALUES (:name)
     ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP, id = LAST_INSERT_ID(id)'
);

$upsertModel = $pdo->prepare(
    'INSERT INTO vehicle_models (make_id, name) VALUES (:make_id, :name)
     ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP, id = LAST_INSERT_ID(id)'
);

$upsertTrim = $pdo->prepare(
    'INSERT INTO vehicle_trims (model_id, external_id, name, year, raw_data)
     VALUES (:model_id, :external_id, :name, :year, :raw_data)
     ON DUPLICATE KEY UPDATE
        name       = VALUES(name),
        year       = VALUES(year),
        raw_data   = VALUES(raw_data),
        updated_at = CURRENT_TIMESTAMP'
);

// -----------------------------------------------------------------------
// Main sync
// -----------------------------------------------------------------------
$makes = $onlyMake !== null ? [$onlyMake] : $vehicleService->getMakes();
echo sprintf("Found %d make(s) to sync.\n", count($makes));

foreach ($makes as $makeName) {
    try {
        $makeId = upsertAndGetId($upsertMake, $pdo, ['name' => $makeName]);
        $stats['makes']++;
    } catch (Throwable $e) {
        echo "  [ERROR] make '{$makeName}': {$e->getMessage()}\n";
        $stats['errors']++;
        continue;
    }

    echo "Make: {$makeName}\n";

    try {
        $models = $vehicleService->getModels($makeName);
    } catch (Throwable $e) {
        echo "  [ERROR] fetching models for '{$makeName}': {$e->getMessage()}\n";
        $stats['errors']++;
        continue;
    }

    foreach ($models as $modelName) {
        try {
            $modelId = upsertAndGetId($upsertModel, $pdo, [
                'make_id' => $makeId,
                'name'    => $modelName,
            ]);
            $stats['models']++;
        } catch (Throwable $e) {
            echo "    [ERROR] model '{$modelName}': {$e->getMessage()}\n";
            $stats['errors']++;
            continue;
        }

        $trimCount = syncTrimsForModel($vehicleService, $upsertTrim, $makeName, $modelName, $modelId);
        $stats['trims'] += $trimCount;

        echo "  Model: {$modelName} ({$trimCount} trim(s))\n";

        if ($sleepUs > 0) {
            usleep($sleepUs);
        }
    }
}

echo "\nDone.\n";
echo sprintf(
    "Makes: %d | Models: %d | Trims: %d | Errors: %d\n",
    $stats['makes'],
    $stats['models'],
    $stats['trims'],
    $stats['errors']
);

// -----------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------

/**
 * Run an upsert statement and return the row's id, whether it was inserted
 * or already existed (relies on the `id = LAST_INSERT_ID(id)` trick in the
 * ON DUPLICATE KEY UPDATE clause).
 */
function upsertAndGetId(PDOStatement $stmt, PDO $pdo, array $params): int
{
    $stmt->execute($params);
    return (int) $pdo->lastInsertId();
}

/**
 * Fetch every page of trims for a make/model and upsert each one.
 * VehicleService::getTrims() only returns the items for a single page, so
 * we keep paging until a short page tells us we've reached the end.
 */
function syncTrimsForModel(
    VehicleService $vehicleService,
    PDOStatement $upsertTrim,
    string $makeName,
    string $modelName,
    int $modelId
): int {
    $limit = 100;
    $page  = 1;
    $total = 0;

    do {
        try {
            $trims = $vehicleService->getTrims($makeName, $modelName, $limit, $page);
        } catch (Throwable $e) {
            echo "      [ERROR] trims page {$page} for '{$makeName} {$modelName}': {$e->getMessage()}\n";
            break;
        }

        foreach ($trims as $trim) {
            $externalId = $trim['id'] ?? $trim['trim_id'] ?? null;
            // Fall back to a content hash so rows without a native id don't
            // collide with each other under the (model_id, external_id) unique key.
            if ($externalId === null) {
                $externalId = 'hash_' . md5(json_encode($trim));
            }

            try {
                $upsertTrim->execute([
                    'model_id'    => $modelId,
                    'external_id' => (string) $externalId,
                    'name'        => $trim['name'] ?? $trim['trim'] ?? null,
                    'year'        => isset($trim['year']) ? (int) $trim['year'] : null,
                    'raw_data'    => json_encode($trim, JSON_UNESCAPED_UNICODE),
                ]);
                $total++;
            } catch (Throwable $e) {
                echo "      [ERROR] trim upsert for '{$makeName} {$modelName}': {$e->getMessage()}\n";
            }
        }

        $page++;
    } while (count($trims) === $limit);

    return $total;
}