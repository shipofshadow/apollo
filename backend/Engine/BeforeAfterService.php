<?php

declare(strict_types=1);

/**
 * BeforeAfterService
 *
 * CRUD for homepage before/after comparison entries.
 * Falls back to backend/storage/before_after_items.json when DB is disabled.
 */
class BeforeAfterService
{
    private bool $useDb;
    private static string $storageFile = __DIR__ . '/../storage/before_after_items.json';

    public function __construct()
    {
        $this->useDb = DB_NAME !== '';
    }

    /** @return array<int, array<string, mixed>> */
    public function getAll(bool $includeInactive = false): array
    {
        return $this->useDb
            ? $this->dbGetAll($includeInactive)
            : $this->fileGetAll($includeInactive);
    }

    /** @return array<string, mixed> */
    public function getById(int $id, bool $requireActive = true): array
    {
        return $this->useDb
            ? $this->dbGetById($id, $requireActive)
            : $this->fileGetById($id, $requireActive);
    }

    /** @param array<string, mixed> $data @return array<string, mixed> */
    public function create(array $data): array
    {
        $this->validatePayload($data, true);
        return $this->useDb
            ? $this->dbCreate($data)
            : $this->fileCreate($data);
    }

    /** @param array<string, mixed> $data @return array<string, mixed> */
    public function update(int $id, array $data): array
    {
        $this->validatePayload($data, false);
        return $this->useDb
            ? $this->dbUpdate($id, $data)
            : $this->fileUpdate($id, $data);
    }

    public function delete(int $id): void
    {
        $this->useDb ? $this->dbDelete($id) : $this->fileDelete($id);
    }

    /** @return array<int, array<string, mixed>> */
    private function dbGetAll(bool $includeInactive): array
    {
        $where = $includeInactive ? '' : 'WHERE is_active = 1 ';
        $stmt = Database::getInstance()->query(
            "SELECT * FROM before_after_items {$where}ORDER BY sort_order ASC, id ASC"
        );
        return array_map([$this, 'mapRow'], $stmt->fetchAll());
    }

    /** @return array<string, mixed> */
    private function dbGetById(int $id, bool $requireActive): array
    {
        $cond = $requireActive ? 'AND is_active = 1' : '';
        $stmt = Database::getInstance()->prepare(
            "SELECT * FROM before_after_items WHERE id = :id $cond LIMIT 1"
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new RuntimeException('Before/After item not found.', 404);
        }
        return $this->mapRow($row);
    }

    /** @param array<string, mixed> $data @return array<string, mixed> */
    private function dbCreate(array $data): array
    {
        $db = Database::getInstance();
        $stmt = $db->prepare(
            'INSERT INTO before_after_items
            (title, description, before_image_url, after_image_url, is_active, sort_order)
            VALUES
            (:title, :description, :before_image_url, :after_image_url, :is_active, :sort_order)'
        );
        $stmt->execute($this->bindParams($data));
        return $this->dbGetById((int) $db->lastInsertId(), false);
    }

    /** @param array<string, mixed> $data @return array<string, mixed> */
    private function dbUpdate(int $id, array $data): array
    {
        $current = $this->dbGetById($id, false);

        $merged = array_merge([
            'title' => $current['title'],
            'description' => $current['description'],
            'beforeImageUrl' => $current['beforeImageUrl'],
            'afterImageUrl' => $current['afterImageUrl'],
            'isActive' => $current['isActive'],
            'sortOrder' => $current['sortOrder'],
        ], $data);

        $stmt = Database::getInstance()->prepare(
            'UPDATE before_after_items SET
                title = :title,
                description = :description,
                before_image_url = :before_image_url,
                after_image_url = :after_image_url,
                is_active = :is_active,
                sort_order = :sort_order
             WHERE id = :id'
        );

        $params = $this->bindParams($merged);
        $params[':id'] = $id;
        $stmt->execute($params);

        return $this->dbGetById($id, false);
    }

    private function dbDelete(int $id): void
    {
        $stmt = Database::getInstance()->prepare('DELETE FROM before_after_items WHERE id = :id');
        $stmt->execute([':id' => $id]);
        if ($stmt->rowCount() === 0) {
            throw new RuntimeException('Before/After item not found.', 404);
        }
    }

    /** @return array<int, array<string, mixed>> */
    private function fileGetAll(bool $includeInactive): array
    {
        $all = $this->fileRead();
        if (!$includeInactive) {
            $all = array_values(array_filter($all, fn ($item) => (bool) ($item['isActive'] ?? true)));
        }
        usort($all, fn ($a, $b) => ($a['sortOrder'] ?? 0) <=> ($b['sortOrder'] ?? 0));
        return $all;
    }

    /** @return array<string, mixed> */
    private function fileGetById(int $id, bool $requireActive): array
    {
        foreach ($this->fileRead() as $item) {
            if ((int) ($item['id'] ?? 0) === $id) {
                if ($requireActive && !($item['isActive'] ?? true)) {
                    throw new RuntimeException('Before/After item not found.', 404);
                }
                return $item;
            }
        }
        throw new RuntimeException('Before/After item not found.', 404);
    }

    /** @param array<string, mixed> $data @return array<string, mixed> */
    private function fileCreate(array $data): array
    {
        $all = $this->fileRead();
        $ids = array_filter(array_column($all, 'id'), fn ($v) => is_numeric($v));
        $id = empty($ids) ? 1 : (int) max($ids) + 1;

        $record = $this->buildRecord($id, $data);
        $all[] = $record;
        $this->fileWrite($all);

        return $record;
    }

    /** @param array<string, mixed> $data @return array<string, mixed> */
    private function fileUpdate(int $id, array $data): array
    {
        $all = $this->fileRead();
        $found = false;
        $result = null;

        foreach ($all as &$item) {
            if ((int) ($item['id'] ?? 0) === $id) {
                $item = $this->buildRecord($id, array_merge($item, $data));
                $result = $item;
                $found = true;
                break;
            }
        }
        unset($item);

        if (!$found || $result === null) {
            throw new RuntimeException('Before/After item not found.', 404);
        }

        $this->fileWrite($all);
        return $result;
    }

    private function fileDelete(int $id): void
    {
        $all = $this->fileRead();
        $filtered = array_values(array_filter($all, fn ($item) => (int) ($item['id'] ?? 0) !== $id));

        if (count($filtered) === count($all)) {
            throw new RuntimeException('Before/After item not found.', 404);
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
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        file_put_contents(
            self::$storageFile,
            json_encode(array_values($data), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );
    }

    /** @param array<string, mixed> $row @return array<string, mixed> */
    private function mapRow(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'title' => (string) ($row['title'] ?? ''),
            'description' => (string) ($row['description'] ?? ''),
            'beforeImageUrl' => (string) ($row['before_image_url'] ?? ''),
            'afterImageUrl' => (string) ($row['after_image_url'] ?? ''),
            'isActive' => (bool) ($row['is_active'] ?? 1),
            'sortOrder' => (int) ($row['sort_order'] ?? 0),
            'createdAt' => (string) ($row['created_at'] ?? ''),
            'updatedAt' => (string) ($row['updated_at'] ?? ''),
        ];
    }

    /** @param array<string, mixed> $data @return array<string, mixed> */
    private function bindParams(array $data): array
    {
        return [
            ':title' => trim((string) ($data['title'] ?? '')),
            ':description' => trim((string) ($data['description'] ?? '')),
            ':before_image_url' => trim((string) ($data['beforeImageUrl'] ?? '')),
            ':after_image_url' => trim((string) ($data['afterImageUrl'] ?? '')),
            ':is_active' => !empty($data['isActive']) ? 1 : 0,
            ':sort_order' => (int) ($data['sortOrder'] ?? 0),
        ];
    }

    /** @param array<string, mixed> $data @return array<string, mixed> */
    private function buildRecord(int $id, array $data): array
    {
        $now = date('c');

        return [
            'id' => $id,
            'title' => trim((string) ($data['title'] ?? '')),
            'description' => trim((string) ($data['description'] ?? '')),
            'beforeImageUrl' => trim((string) ($data['beforeImageUrl'] ?? '')),
            'afterImageUrl' => trim((string) ($data['afterImageUrl'] ?? '')),
            'isActive' => !empty($data['isActive']),
            'sortOrder' => (int) ($data['sortOrder'] ?? 0),
            'createdAt' => (string) ($data['createdAt'] ?? $now),
            'updatedAt' => $now,
        ];
    }

    /** @param array<string, mixed> $data */
    private function validatePayload(array $data, bool $isCreate): void
    {
        if ($isCreate || array_key_exists('title', $data)) {
            $title = trim((string) ($data['title'] ?? ''));
            if ($title === '') {
                throw new RuntimeException('Field "title" is required.', 422);
            }
        }

        if ($isCreate || array_key_exists('description', $data)) {
            $description = trim((string) ($data['description'] ?? ''));
            if ($description === '') {
                throw new RuntimeException('Field "description" is required.', 422);
            }
        }

        if ($isCreate || array_key_exists('beforeImageUrl', $data)) {
            $before = trim((string) ($data['beforeImageUrl'] ?? ''));
            if ($before === '') {
                throw new RuntimeException('Field "beforeImageUrl" is required.', 422);
            }
        }

        if ($isCreate || array_key_exists('afterImageUrl', $data)) {
            $after = trim((string) ($data['afterImageUrl'] ?? ''));
            if ($after === '') {
                throw new RuntimeException('Field "afterImageUrl" is required.', 422);
            }
        }
    }
}
