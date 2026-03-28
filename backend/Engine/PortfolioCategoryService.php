<?php

declare(strict_types=1);

/**
 * PortfolioCategoryService
 *
 * Full CRUD for the portfolio_categories table.
 * When DB_NAME is empty it falls back to backend/storage/portfolio_categories.json.
 *
 * Requires migration 020_create_portfolio_categories.sql to have been run.
 */
class PortfolioCategoryService
{
    private bool   $useDb;
    private static string $storageFile = __DIR__ . '/../storage/portfolio_categories.json';

    public function __construct()
    {
        $this->useDb = DB_NAME !== '';
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * All categories ordered by sort_order, id.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getAll(): array
    {
        return $this->useDb ? $this->dbGetAll() : $this->fileGetAll();
    }

    /**
     * Single category by ID.
     *
     * @return array<string, mixed>
     */
    public function getById(int $id): array
    {
        return $this->useDb ? $this->dbGetById($id) : $this->fileGetById($id);
    }

    /**
     * Create a new category. Returns the created record.
     *
     * @param  array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function create(array $data): array
    {
        $this->validatePayload($data);
        return $this->useDb ? $this->dbCreate($data) : $this->fileCreate($data);
    }

    /**
     * Update an existing category. Returns the updated record.
     *
     * @param  array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function update(int $id, array $data): array
    {
        return $this->useDb ? $this->dbUpdate($id, $data) : $this->fileUpdate($id, $data);
    }

    /**
     * Hard-delete a category.
     */
    public function delete(int $id): void
    {
        $this->useDb ? $this->dbDelete($id) : $this->fileDelete($id);
    }

    // -------------------------------------------------------------------------
    // DB – read
    // -------------------------------------------------------------------------

    /** @return array<int, array<string, mixed>> */
    private function dbGetAll(): array
    {
        $stmt = Database::getInstance()->query(
            'SELECT * FROM portfolio_categories ORDER BY sort_order ASC, id ASC'
        );
        return array_map([$this, 'mapRow'], $stmt->fetchAll());
    }

    /** @return array<string, mixed> */
    private function dbGetById(int $id): array
    {
        $stmt = Database::getInstance()->prepare(
            'SELECT * FROM portfolio_categories WHERE id = :id LIMIT 1'
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new RuntimeException('Portfolio category not found.', 404);
        }
        return $this->mapRow($row);
    }

    // -------------------------------------------------------------------------
    // DB – write
    // -------------------------------------------------------------------------

    /** @param array<string, mixed> $data @return array<string, mixed> */
    private function dbCreate(array $data): array
    {
        $db   = Database::getInstance();
        $stmt = $db->prepare(
            'INSERT INTO portfolio_categories (name, sort_order)
             VALUES (:name, :sort_order)'
        );
        $stmt->execute($this->bindParams($data));
        return $this->dbGetById((int) $db->lastInsertId());
    }

    /** @param array<string, mixed> $data @return array<string, mixed> */
    private function dbUpdate(int $id, array $data): array
    {
        $current = $this->dbGetById($id);

        $merged = array_merge([
            'name'      => $current['name'],
            'sortOrder' => $current['sortOrder'],
        ], $data);

        $stmt = Database::getInstance()->prepare(
            'UPDATE portfolio_categories SET
               name       = :name,
               sort_order = :sort_order
             WHERE id = :id'
        );
        $params        = $this->bindParams($merged);
        $params[':id'] = $id;
        $stmt->execute($params);

        return $this->dbGetById($id);
    }

    private function dbDelete(int $id): void
    {
        $stmt = Database::getInstance()->prepare(
            'DELETE FROM portfolio_categories WHERE id = :id'
        );
        $stmt->execute([':id' => $id]);
        if ($stmt->rowCount() === 0) {
            throw new RuntimeException('Portfolio category not found.', 404);
        }
    }

    // -------------------------------------------------------------------------
    // File storage – fallback
    // -------------------------------------------------------------------------

    /** @return array<int, array<string, mixed>> */
    private function fileGetAll(): array
    {
        $all = $this->fileRead();
        usort($all, fn ($a, $b) => ($a['sortOrder'] ?? 0) <=> ($b['sortOrder'] ?? 0));
        return $all;
    }

    /** @return array<string, mixed> */
    private function fileGetById(int $id): array
    {
        foreach ($this->fileRead() as $c) {
            if ((int) ($c['id'] ?? 0) === $id) {
                return $c;
            }
        }
        throw new RuntimeException('Portfolio category not found.', 404);
    }

    /** @param array<string, mixed> $data @return array<string, mixed> */
    private function fileCreate(array $data): array
    {
        $all = $this->fileRead();
        $id  = empty($all) ? 1 : (int) max(array_column($all, 'id')) + 1;

        $record = $this->buildRecord($id, $data);
        $all[]  = $record;
        $this->fileWrite($all);
        return $record;
    }

    /** @param array<string, mixed> $data @return array<string, mixed> */
    private function fileUpdate(int $id, array $data): array
    {
        $all    = $this->fileRead();
        $found  = false;
        $result = null;

        foreach ($all as &$c) {
            if ((int) ($c['id'] ?? 0) === $id) {
                $c      = $this->buildRecord($id, array_merge($c, $data));
                $result = $c;
                $found  = true;
                break;
            }
        }
        unset($c);

        if (!$found) throw new RuntimeException('Portfolio category not found.', 404);
        $this->fileWrite($all);
        return $result;
    }

    private function fileDelete(int $id): void
    {
        $all      = $this->fileRead();
        $filtered = array_values(array_filter($all, fn ($c) => (int) ($c['id'] ?? 0) !== $id));
        if (count($filtered) === count($all)) {
            throw new RuntimeException('Portfolio category not found.', 404);
        }
        $this->fileWrite($filtered);
    }

    /** @return array<int, array<string, mixed>> */
    private function fileRead(): array
    {
        if (!file_exists(self::$storageFile)) {
            return [];
        }
        $raw = file_get_contents(self::$storageFile);
        if ($raw === false) {
            return [];
        }
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }

    /** @param array<int, array<string, mixed>> $data */
    private function fileWrite(array $data): void
    {
        $dir = dirname(self::$storageFile);
        if (!is_dir($dir)) mkdir($dir, 0755, true);
        file_put_contents(
            self::$storageFile,
            json_encode(array_values($data), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Map a DB snake_case row to the camelCase API shape.
     *
     * @param  array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapRow(array $row): array
    {
        return [
            'id'        => (int) $row['id'],
            'name'      =>       $row['name'],
            'sortOrder' => (int) $row['sort_order'],
            'createdAt' =>       $row['created_at'],
            'updatedAt' =>       $row['updated_at'],
        ];
    }

    /** @return array<string, mixed> */
    private function bindParams(array $data): array
    {
        return [
            ':name'       => $data['name']      ?? '',
            ':sort_order' => (int) ($data['sortOrder'] ?? ($data['sort_order'] ?? 0)),
        ];
    }

    /**
     * Build a camelCase record for file storage.
     *
     * @param  int                  $id
     * @param  array<string, mixed> $data
     * @return array<string, mixed>
     */
    private function buildRecord(int $id, array $data): array
    {
        return [
            'id'        => $id,
            'name'      => $data['name']      ?? '',
            'sortOrder' => (int) ($data['sortOrder'] ?? ($data['sort_order'] ?? 0)),
            'createdAt' => $data['createdAt'] ?? date('c'),
            'updatedAt' => date('c'),
        ];
    }

    /** @param array<string, mixed> $data */
    private function validatePayload(array $data): void
    {
        if (empty(trim($data['name'] ?? ''))) {
            throw new RuntimeException('Category name is required.', 422);
        }
    }
}
