<?php

declare(strict_types=1);

/**
 * PortfolioService
 *
 * Full CRUD for the portfolio table.
 * When DB_NAME is empty it falls back to backend/storage/portfolio.json.
 *
 * Public-facing endpoints return only active items (is_active = 1).
 * Admin endpoints return all items.
 *
 * Requires migration 017_create_portfolio.sql to have been run.
 */
class PortfolioService
{
    private bool   $useDb;
    private static string $storageFile = __DIR__ . '/../storage/portfolio.json';

    public function __construct()
    {
        $this->useDb = DB_NAME !== '';
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * All portfolio items ordered by sort_order, id.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getAll(bool $includeInactive = false): array
    {
        return $this->useDb
            ? $this->dbGetAll($includeInactive)
            : $this->fileGetAll($includeInactive);
    }

    /**
     * Single portfolio item by ID.
     *
     * @return array<string, mixed>
     */
    public function getById(int $id, bool $requireActive = true): array
    {
        return $this->useDb
            ? $this->dbGetById($id, $requireActive)
            : $this->fileGetById($id, $requireActive);
    }

    /**
     * Create a new portfolio item. Returns the created record.
     *
     * @param  array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function create(array $data): array
    {
        $this->validatePayload($data);
        return $this->useDb
            ? $this->dbCreate($data)
            : $this->fileCreate($data);
    }

    /**
     * Update an existing portfolio item. Returns the updated record.
     *
     * @param  array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function update(int $id, array $data): array
    {
        return $this->useDb
            ? $this->dbUpdate($id, $data)
            : $this->fileUpdate($id, $data);
    }

    /**
     * Hard-delete a portfolio item.
     */
    public function delete(int $id): void
    {
        $this->useDb ? $this->dbDelete($id) : $this->fileDelete($id);
    }

    // -------------------------------------------------------------------------
    // DB – read
    // -------------------------------------------------------------------------

    /** @return array<int, array<string, mixed>> */
    private function dbGetAll(bool $includeInactive): array
    {
        $where = $includeInactive ? '' : 'WHERE is_active = 1 ';
        $stmt  = Database::getInstance()->query(
            "SELECT * FROM portfolio {$where}ORDER BY sort_order ASC, id ASC"
        );
        return array_map([$this, 'mapRow'], $stmt->fetchAll());
    }

    /** @return array<string, mixed> */
    private function dbGetById(int $id, bool $requireActive): array
    {
        $cond = $requireActive ? 'AND is_active = 1' : '';
        $stmt = Database::getInstance()->prepare(
            "SELECT * FROM portfolio WHERE id = :id $cond LIMIT 1"
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new RuntimeException('Portfolio item not found.', 404);
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
            'INSERT INTO portfolio
             (title, category, description, image_url, sort_order, is_active)
             VALUES
             (:title, :category, :description, :image_url, :sort_order, :is_active)'
        );
        $stmt->execute($this->bindParams($data));
        return $this->dbGetById((int) $db->lastInsertId(), false);
    }

    /** @param array<string, mixed> $data @return array<string, mixed> */
    private function dbUpdate(int $id, array $data): array
    {
        $current = $this->dbGetById($id, false);

        $merged = array_merge([
            'title'       => $current['title'],
            'category'    => $current['category'],
            'description' => $current['description'],
            'imageUrl'    => $current['imageUrl'],
            'sortOrder'   => $current['sortOrder'],
            'isActive'    => $current['isActive'],
        ], $data);

        $stmt = Database::getInstance()->prepare(
            'UPDATE portfolio SET
               title       = :title,
               category    = :category,
               description = :description,
               image_url   = :image_url,
               sort_order  = :sort_order,
               is_active   = :is_active
             WHERE id = :id'
        );
        $params        = $this->bindParams($merged);
        $params[':id'] = $id;
        $stmt->execute($params);

        return $this->dbGetById($id, false);
    }

    private function dbDelete(int $id): void
    {
        $stmt = Database::getInstance()->prepare(
            'DELETE FROM portfolio WHERE id = :id'
        );
        $stmt->execute([':id' => $id]);
        if ($stmt->rowCount() === 0) {
            throw new RuntimeException('Portfolio item not found.', 404);
        }
    }

    // -------------------------------------------------------------------------
    // File storage – fallback
    // -------------------------------------------------------------------------

    /** @return array<int, array<string, mixed>> */
    private function fileGetAll(bool $includeInactive): array
    {
        $all = $this->fileRead();
        if (!$includeInactive) {
            $all = array_values(array_filter($all, fn ($p) => (bool) ($p['isActive'] ?? true)));
        }
        usort($all, fn ($a, $b) => ($a['sortOrder'] ?? 0) <=> ($b['sortOrder'] ?? 0));
        return $all;
    }

    /** @return array<string, mixed> */
    private function fileGetById(int $id, bool $requireActive): array
    {
        foreach ($this->fileRead() as $p) {
            if ((int) ($p['id'] ?? 0) === $id) {
                if ($requireActive && !($p['isActive'] ?? true)) {
                    throw new RuntimeException('Portfolio item not found.', 404);
                }
                return $p;
            }
        }
        throw new RuntimeException('Portfolio item not found.', 404);
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

        foreach ($all as &$p) {
            if ((int) ($p['id'] ?? 0) === $id) {
                $p      = $this->buildRecord($id, array_merge($p, $data));
                $result = $p;
                $found  = true;
                break;
            }
        }
        unset($p);

        if (!$found) throw new RuntimeException('Portfolio item not found.', 404);
        $this->fileWrite($all);
        return $result;
    }

    private function fileDelete(int $id): void
    {
        $all      = $this->fileRead();
        $filtered = array_values(array_filter($all, fn ($p) => (int) ($p['id'] ?? 0) !== $id));
        if (count($filtered) === count($all)) {
            throw new RuntimeException('Portfolio item not found.', 404);
        }
        $this->fileWrite($filtered);
    }

    /** @return array<int, array<string, mixed>> */
    private function fileRead(): array
    {
        if (!file_exists(self::$storageFile)) {
            return [];
        }
        $data = json_decode((string) file_get_contents(self::$storageFile), true);
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
            'id'          => (int)  $row['id'],
            'title'       =>        $row['title'],
            'category'    =>        $row['category'],
            'description' =>        $row['description'],
            'imageUrl'    =>        $row['image_url'],
            'sortOrder'   => (int)  $row['sort_order'],
            'isActive'    => (bool) $row['is_active'],
            'createdAt'   =>        $row['created_at'],
            'updatedAt'   =>        $row['updated_at'],
        ];
    }

    /** @return array<string, mixed> */
    private function bindParams(array $data): array
    {
        return [
            ':title'       => $data['title']       ?? '',
            ':category'    => $data['category']    ?? '',
            ':description' => $data['description'] ?? '',
            ':image_url'   => $data['imageUrl']    ?? ($data['image_url'] ?? ''),
            ':sort_order'  => (int) ($data['sortOrder'] ?? ($data['sort_order'] ?? 0)),
            ':is_active'   => (int) ($data['isActive']  ?? ($data['is_active']  ?? 1)),
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
            'id'          => $id,
            'title'       => $data['title']       ?? '',
            'category'    => $data['category']    ?? '',
            'description' => $data['description'] ?? '',
            'imageUrl'    => $data['imageUrl']    ?? ($data['image_url'] ?? ''),
            'sortOrder'   => (int) ($data['sortOrder'] ?? ($data['sort_order'] ?? 0)),
            'isActive'    => (bool) ($data['isActive'] ?? ($data['is_active'] ?? true)),
            'createdAt'   => $data['createdAt'] ?? date('c'),
            'updatedAt'   => date('c'),
        ];
    }

    /** @param array<string, mixed> $data */
    private function validatePayload(array $data): void
    {
        if (empty(trim($data['title'] ?? ''))) {
            throw new RuntimeException('Portfolio item title is required.', 422);
        }
    }
}
