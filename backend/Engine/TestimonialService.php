<?php

declare(strict_types=1);

/**
 * TestimonialService
 *
 * Full CRUD for the testimonials table.
 * Falls back to backend/storage/testimonials.json when DB is not configured.
 *
 * Requires migration 013_create_testimonials.sql to have been run.
 */
class TestimonialService
{
    private bool $useDb;
    private static string $storageFile = __DIR__ . '/../storage/testimonials.json';

    public function __construct()
    {
        $this->useDb = DB_NAME !== '';
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /** @return array<int, array<string, mixed>> */
    public function getAll(bool $activeOnly = false): array
    {
        return $this->useDb
            ? $this->dbGetAll($activeOnly)
            : $this->fileGetAll($activeOnly);
    }

    /** @return array<string, mixed> */
    public function getById(int $id): array
    {
        return $this->useDb ? $this->dbGetById($id) : $this->fileGetById($id);
    }

    /** @return array<string, mixed> */
    public function create(array $data): array
    {
        $this->validatePayload($data);
        return $this->useDb ? $this->dbCreate($data) : $this->fileCreate($data);
    }

    /** @return array<string, mixed> */
    public function update(int $id, array $data): array
    {
        return $this->useDb ? $this->dbUpdate($id, $data) : $this->fileUpdate($id, $data);
    }

    public function delete(int $id): void
    {
        $this->useDb ? $this->dbDelete($id) : $this->fileDelete($id);
    }

    // -------------------------------------------------------------------------
    // DB
    // -------------------------------------------------------------------------

    /** @return array<int, array<string, mixed>> */
    private function dbGetAll(bool $activeOnly): array
    {
        $where = $activeOnly ? 'WHERE is_active = 1 ' : '';
        $stmt  = Database::getInstance()->query(
            "SELECT * FROM testimonials {$where}ORDER BY sort_order ASC, id ASC"
        );
        return array_map([$this, 'mapRow'], $stmt->fetchAll());
    }

    /** @return array<string, mixed> */
    private function dbGetById(int $id): array
    {
        $stmt = Database::getInstance()->prepare(
            'SELECT * FROM testimonials WHERE id = :id LIMIT 1'
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new RuntimeException('Testimonial not found.', 404);
        }
        return $this->mapRow($row);
    }

    /** @return array<string, mixed> */
    private function dbCreate(array $data): array
    {
        $db   = Database::getInstance();
        $stmt = $db->prepare(
            'INSERT INTO testimonials (name, role, content, rating, image_url, is_active, sort_order)
             VALUES (:name, :role, :content, :rating, :image_url, :is_active, :sort_order)'
        );
        $stmt->execute($this->bindParams($data));
        return $this->dbGetById((int) $db->lastInsertId());
    }

    /** @return array<string, mixed> */
    private function dbUpdate(int $id, array $data): array
    {
        $current = $this->dbGetById($id);
        $merged  = array_merge($current, $data);

        $stmt = Database::getInstance()->prepare(
            'UPDATE testimonials SET name = :name, role = :role, content = :content,
             rating = :rating, image_url = :image_url, is_active = :is_active, sort_order = :sort_order
             WHERE id = :id'
        );
        $params        = $this->bindParams($merged);
        $params[':id'] = $id;
        $stmt->execute($params);

        $oldImage = (string) ($current['imageUrl'] ?? '');
        $newImage = (string) ($merged['imageUrl'] ?? ($merged['image_url'] ?? ''));
        if ($oldImage !== '' && $oldImage !== $newImage) {
            $this->deleteManagedImageUrl($oldImage);
        }

        return $this->dbGetById($id);
    }

    private function dbDelete(int $id): void
    {
        $current = $this->dbGetById($id);

        $stmt = Database::getInstance()->prepare(
            'DELETE FROM testimonials WHERE id = :id'
        );
        $stmt->execute([':id' => $id]);
        if ($stmt->rowCount() === 0) {
            throw new RuntimeException('Testimonial not found.', 404);
        }

        $oldImage = (string) ($current['imageUrl'] ?? '');
        if ($oldImage !== '') {
            $this->deleteManagedImageUrl($oldImage);
        }
    }

    // -------------------------------------------------------------------------
    // File storage – fallback
    // -------------------------------------------------------------------------

    /** @return array<int, array<string, mixed>> */
    private function fileGetAll(bool $activeOnly): array
    {
        $all = $this->fileRead();
        if ($activeOnly) {
            $all = array_values(array_filter($all, fn ($t) => (bool) ($t['isActive'] ?? true)));
        }
        usort($all, fn ($a, $b) => (int) ($a['sortOrder'] ?? 0) <=> (int) ($b['sortOrder'] ?? 0));
        return $all;
    }

    /** @return array<string, mixed> */
    private function fileGetById(int $id): array
    {
        foreach ($this->fileRead() as $t) {
            if ((int) ($t['id'] ?? 0) === $id) {
                return $t;
            }
        }
        throw new RuntimeException('Testimonial not found.', 404);
    }

    /** @return array<string, mixed> */
    private function fileCreate(array $data): array
    {
        $all    = $this->fileRead();
        $id     = empty($all) ? 1 : (int) max(array_column($all, 'id')) + 1;
        $record = $this->buildRecord($id, $data);
        $all[]  = $record;
        $this->fileWrite($all);
        return $record;
    }

    /** @return array<string, mixed> */
    private function fileUpdate(int $id, array $data): array
    {
        $all    = $this->fileRead();
        $found  = false;
        $result = null;
        $oldImage = '';

        foreach ($all as &$t) {
            if ((int) ($t['id'] ?? 0) === $id) {
                $oldImage = (string) ($t['imageUrl'] ?? '');
                $t      = $this->buildRecord($id, array_merge($t, $data));
                $result = $t;
                $found  = true;
                break;
            }
        }
        unset($t);

        if (!$found) {
            throw new RuntimeException('Testimonial not found.', 404);
        }
        $this->fileWrite($all);

        $newImage = (string) ($result['imageUrl'] ?? '');
        if ($oldImage !== '' && $oldImage !== $newImage) {
            $this->deleteManagedImageUrl($oldImage);
        }

        return $result;
    }

    private function fileDelete(int $id): void
    {
        $all      = $this->fileRead();
        $oldImage = '';
        foreach ($all as $t) {
            if ((int) ($t['id'] ?? 0) === $id) {
                $oldImage = (string) ($t['imageUrl'] ?? '');
                break;
            }
        }
        $filtered = array_values(array_filter($all, fn ($t) => (int) ($t['id'] ?? 0) !== $id));
        if (count($filtered) === count($all)) {
            throw new RuntimeException('Testimonial not found.', 404);
        }
        $this->fileWrite($filtered);

        if ($oldImage !== '') {
            $this->deleteManagedImageUrl($oldImage);
        }
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
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        file_put_contents(
            self::$storageFile,
            json_encode(array_values($data), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /** @param array<string, mixed> $row @return array<string, mixed> */
    private function mapRow(array $row): array
    {
        return [
            'id'        => (int) $row['id'],
            'name'      => $row['name'],
            'role'      => $row['role'] ?? '',
            'content'   => $row['content'],
            'rating'    => (int) ($row['rating'] ?? 5),
            'imageUrl'  => $row['image_url'] ?? null,
            'isActive'  => (bool) ($row['is_active'] ?? true),
            'sortOrder' => (int) ($row['sort_order'] ?? 0),
            'createdAt' => $row['created_at'],
            'updatedAt' => $row['updated_at'],
        ];
    }

    /** @return array<string, mixed> */
    private function bindParams(array $data): array
    {
        return [
            ':name'       => $data['name']      ?? '',
            ':role'       => $data['role']       ?? '',
            ':content'    => $data['content']    ?? '',
            ':rating'     => (int) ($data['rating'] ?? 5),
            ':image_url'  => $data['imageUrl']   ?? ($data['image_url'] ?? null),
            ':is_active'  => (int) (isset($data['isActive']) ? (bool) $data['isActive'] : true),
            ':sort_order' => (int) ($data['sortOrder'] ?? $data['sort_order'] ?? 0),
        ];
    }

    /** @return array<string, mixed> */
    private function buildRecord(int $id, array $data): array
    {
        return [
            'id'        => $id,
            'name'      => $data['name']      ?? '',
            'role'      => $data['role']       ?? '',
            'content'   => $data['content']   ?? '',
            'rating'    => (int) ($data['rating'] ?? 5),
            'imageUrl'  => $data['imageUrl']  ?? null,
            'isActive'  => isset($data['isActive']) ? (bool) $data['isActive'] : true,
            'sortOrder' => (int) ($data['sortOrder'] ?? 0),
            'createdAt' => $data['createdAt'] ?? date('c'),
            'updatedAt' => date('c'),
        ];
    }

    private function validatePayload(array $data): void
    {
        if (empty(trim($data['name'] ?? ''))) {
            throw new RuntimeException('Testimonial name is required.', 422);
        }
        if (empty(trim($data['content'] ?? ''))) {
            throw new RuntimeException('Testimonial content is required.', 422);
        }
    }

    private function deleteManagedImageUrl(string $url): void
    {
        try {
            (new UploadStorage())->deleteByUrl($url);
        } catch (\Throwable) {
            // Keep CRUD successful even if storage cleanup fails.
        }
    }
}
