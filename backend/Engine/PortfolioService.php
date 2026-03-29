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

    /** Check whether the images column exists (added in migration 021). */
    private function hasImagesColumn(): bool
    {
        static $checked = null;
        if ($checked === null) {
            try {
                $stmt    = Database::getInstance()->query('SELECT images FROM portfolio LIMIT 0');
                $checked = $stmt !== false;
            } catch (\Throwable $e) {
                $checked = false;
            }
        }
        return $checked;
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
        $db = Database::getInstance();
        if ($this->hasImagesColumn()) {
            $stmt = $db->prepare(
                'INSERT INTO portfolio
                 (title, category, description, image_url, images, sort_order, is_active)
                 VALUES
                 (:title, :category, :description, :image_url, :images, :sort_order, :is_active)'
            );
        } else {
            $stmt = $db->prepare(
                'INSERT INTO portfolio
                 (title, category, description, image_url, sort_order, is_active)
                 VALUES
                 (:title, :category, :description, :image_url, :sort_order, :is_active)'
            );
        }
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
            'images'      => $current['images'],
            'sortOrder'   => $current['sortOrder'],
            'isActive'    => $current['isActive'],
        ], $data);

        if ($this->hasImagesColumn()) {
            $stmt = Database::getInstance()->prepare(
                'UPDATE portfolio SET
                   title       = :title,
                   category    = :category,
                   description = :description,
                   image_url   = :image_url,
                   images      = :images,
                   sort_order  = :sort_order,
                   is_active   = :is_active
                 WHERE id = :id'
            );
        } else {
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
        }
        $params        = $this->bindParams($merged);
        $params[':id'] = $id;
        $stmt->execute($params);

        $oldUrls = $this->collectPortfolioImageUrls($current);
        $newUrls = $this->collectPortfolioImageUrls($this->dbGetById($id, false));
        $this->deleteRemovedImageUrls($oldUrls, $newUrls);

        return $this->dbGetById($id, false);
    }

    private function dbDelete(int $id): void
    {
        $current = $this->dbGetById($id, false);

        $stmt = Database::getInstance()->prepare(
            'DELETE FROM portfolio WHERE id = :id'
        );
        $stmt->execute([':id' => $id]);
        if ($stmt->rowCount() === 0) {
            throw new RuntimeException('Portfolio item not found.', 404);
        }

        $this->deleteRemovedImageUrls($this->collectPortfolioImageUrls($current), []);
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
        $oldUrls = [];

        foreach ($all as &$p) {
            if ((int) ($p['id'] ?? 0) === $id) {
                $oldUrls = $this->collectPortfolioImageUrls($p);
                $p      = $this->buildRecord($id, array_merge($p, $data));
                $result = $p;
                $found  = true;
                break;
            }
        }
        unset($p);

        if (!$found) throw new RuntimeException('Portfolio item not found.', 404);
        $this->fileWrite($all);

        $newUrls = $result !== null ? $this->collectPortfolioImageUrls($result) : [];
        $this->deleteRemovedImageUrls($oldUrls, $newUrls);

        return $result;
    }

    private function fileDelete(int $id): void
    {
        $all      = $this->fileRead();
        $oldUrls  = [];
        foreach ($all as $p) {
            if ((int) ($p['id'] ?? 0) === $id) {
                $oldUrls = $this->collectPortfolioImageUrls($p);
                break;
            }
        }
        $filtered = array_values(array_filter($all, fn ($p) => (int) ($p['id'] ?? 0) !== $id));
        if (count($filtered) === count($all)) {
            throw new RuntimeException('Portfolio item not found.', 404);
        }
        $this->fileWrite($filtered);

        $this->deleteRemovedImageUrls($oldUrls, []);
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
        $rawImages = $row['images'] ?? '[]';
        $images    = json_decode((string) $rawImages, true);
        if (!is_array($images)) {
            $images = [];
        }

        return [
            'id'          => (int)  $row['id'],
            'title'       =>        $row['title'],
            'category'    =>        $row['category'],
            'description' =>        $row['description'],
            'imageUrl'    =>        $row['image_url'],
            'images'      =>        $images,
            'sortOrder'   => (int)  $row['sort_order'],
            'isActive'    => (bool) $row['is_active'],
            'createdAt'   =>        $row['created_at'],
            'updatedAt'   =>        $row['updated_at'],
        ];
    }

    /** @return array<string, mixed> */
    private function bindParams(array $data): array
    {
        $images = $data['images'] ?? [];
        if (is_string($images)) {
            $decoded = json_decode($images, true);
            $images  = is_array($decoded) ? $decoded : [];
        }

        // Derive image_url from first image in the array when available.
        $imageUrl = $data['imageUrl'] ?? ($data['image_url'] ?? '');
        if (empty($imageUrl) && !empty($images)) {
            $imageUrl = $images[0];
        }

        $params = [
            ':title'       => $data['title']       ?? '',
            ':category'    => $data['category']    ?? '',
            ':description' => $data['description'] ?? '',
            ':image_url'   => $imageUrl,
            ':sort_order'  => (int) ($data['sortOrder'] ?? ($data['sort_order'] ?? 0)),
            ':is_active'   => (int) ($data['isActive']  ?? ($data['is_active']  ?? 1)),
        ];

        if ($this->hasImagesColumn()) {
            $params[':images'] = json_encode(array_values($images), JSON_UNESCAPED_UNICODE);
        }

        return $params;
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
        $images = $data['images'] ?? [];
        if (is_string($images)) {
            $decoded = json_decode($images, true);
            $images  = is_array($decoded) ? $decoded : [];
        }

        $imageUrl = $data['imageUrl'] ?? ($data['image_url'] ?? '');
        if (empty($imageUrl) && !empty($images)) {
            $imageUrl = $images[0];
        }

        return [
            'id'          => $id,
            'title'       => $data['title']       ?? '',
            'category'    => $data['category']    ?? '',
            'description' => $data['description'] ?? '',
            'imageUrl'    => $imageUrl,
            'images'      => array_values($images),
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

    /** @param array<string, mixed> $item @return string[] */
    private function collectPortfolioImageUrls(array $item): array
    {
        $urls = [];

        $imageUrl = trim((string) ($item['imageUrl'] ?? ($item['image_url'] ?? '')));
        if ($imageUrl !== '') {
            $urls[] = $imageUrl;
        }

        $images = $item['images'] ?? [];
        if (!is_array($images)) {
            $images = [];
        }
        foreach ($images as $url) {
            if (!is_string($url)) {
                continue;
            }
            $trimmed = trim($url);
            if ($trimmed !== '') {
                $urls[] = $trimmed;
            }
        }

        return array_values(array_unique($urls));
    }

    /** @param string[] $oldUrls @param string[] $newUrls */
    private function deleteRemovedImageUrls(array $oldUrls, array $newUrls): void
    {
        $toDelete = array_diff($oldUrls, $newUrls);
        if (empty($toDelete)) {
            return;
        }

        $storage = new UploadStorage();
        foreach ($toDelete as $url) {
            try {
                $storage->deleteByUrl($url);
            } catch (\Throwable) {
                // Keep CRUD successful even if storage cleanup fails.
            }
        }
    }
}
