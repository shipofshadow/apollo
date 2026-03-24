<?php

declare(strict_types=1);

/**
 * BlogPostService
 *
 * Full CRUD for the blog_posts table.
 * When DB_NAME is empty it falls back to backend/storage/blog_posts.json.
 *
 * Public-facing endpoints return only Published posts.
 * Admin endpoints return all posts.
 *
 * Requires migration 006_create_blog_posts.sql to have been run.
 */
class BlogPostService
{
    private bool   $useDb;
    private static string $storageFile = __DIR__ . '/../storage/blog_posts.json';

    public function __construct()
    {
        $this->useDb = DB_NAME !== '';
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Return all posts ordered by newest first.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getAll(bool $publishedOnly = false): array
    {
        return $this->useDb
            ? $this->dbGetAll($publishedOnly)
            : $this->fileGetAll($publishedOnly);
    }

    /**
     * Single post by ID.
     *
     * @return array<string, mixed>
     */
    public function getById(int $id, bool $publishedOnly = false): array
    {
        return $this->useDb
            ? $this->dbGetById($id, $publishedOnly)
            : $this->fileGetById($id, $publishedOnly);
    }

    /**
     * Create a new blog post. Returns the created record.
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
     * Update an existing blog post. Returns the updated record.
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
     * Hard-delete a blog post.
     */
    public function delete(int $id): void
    {
        $this->useDb ? $this->dbDelete($id) : $this->fileDelete($id);
    }

    // -------------------------------------------------------------------------
    // DB – read
    // -------------------------------------------------------------------------

    /** @return array<int, array<string, mixed>> */
    private function dbGetAll(bool $publishedOnly): array
    {
        $where = $publishedOnly ? "WHERE status = 'Published' " : '';
        $stmt  = Database::getInstance()->query(
            "SELECT * FROM blog_posts {$where}ORDER BY created_at DESC"
        );
        return array_map([$this, 'mapRow'], $stmt->fetchAll());
    }

    /** @return array<string, mixed> */
    private function dbGetById(int $id, bool $publishedOnly): array
    {
        $cond = $publishedOnly ? "AND status = 'Published'" : '';
        $stmt = Database::getInstance()->prepare(
            "SELECT * FROM blog_posts WHERE id = :id $cond LIMIT 1"
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new RuntimeException('Blog post not found.', 404);
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
            "INSERT INTO blog_posts (title, content, status, cover_image)
             VALUES (:title, :content, :status, :cover_image)"
        );
        $stmt->execute($this->bindParams($data));
        return $this->dbGetById((int) $db->lastInsertId(), false);
    }

    /** @param array<string, mixed> $data @return array<string, mixed> */
    private function dbUpdate(int $id, array $data): array
    {
        $current = $this->dbGetById($id, false);

        $merged = array_merge([
            'title'      => $current['title'],
            'content'    => $current['content'],
            'status'     => $current['status'],
            'coverImage' => $current['coverImage'],
        ], $data);

        $stmt = Database::getInstance()->prepare(
            'UPDATE blog_posts SET title = :title, content = :content, status = :status,
             cover_image = :cover_image
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
            'DELETE FROM blog_posts WHERE id = :id'
        );
        $stmt->execute([':id' => $id]);
        if ($stmt->rowCount() === 0) {
            throw new RuntimeException('Blog post not found.', 404);
        }
    }

    // -------------------------------------------------------------------------
    // File storage – fallback
    // -------------------------------------------------------------------------

    /** @return array<int, array<string, mixed>> */
    private function fileGetAll(bool $publishedOnly): array
    {
        $all = $this->fileRead();
        if ($publishedOnly) {
            $all = array_values(array_filter($all, fn ($p) => ($p['status'] ?? '') === 'Published'));
        }
        usort($all, fn ($a, $b) => strcmp((string) ($b['createdAt'] ?? ''), (string) ($a['createdAt'] ?? '')));
        return $all;
    }

    /** @return array<string, mixed> */
    private function fileGetById(int $id, bool $publishedOnly): array
    {
        foreach ($this->fileRead() as $p) {
            if ((int) ($p['id'] ?? 0) === $id) {
                if ($publishedOnly && ($p['status'] ?? '') !== 'Published') {
                    throw new RuntimeException('Blog post not found.', 404);
                }
                return $p;
            }
        }
        throw new RuntimeException('Blog post not found.', 404);
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

        if (!$found) throw new RuntimeException('Blog post not found.', 404);
        $this->fileWrite($all);
        return $result;
    }

    private function fileDelete(int $id): void
    {
        $all      = $this->fileRead();
        $filtered = array_values(array_filter($all, fn ($p) => (int) ($p['id'] ?? 0) !== $id));
        if (count($filtered) === count($all)) {
            throw new RuntimeException('Blog post not found.', 404);
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
            'id'         => (int) $row['id'],
            'title'      => $row['title'],
            'content'    => $row['content'],
            'status'     => $row['status'],
            'coverImage' => $row['cover_image'] ?? null,
            'createdAt'  => $row['created_at'],
            'updatedAt'  => $row['updated_at'],
        ];
    }

    /** @return array<string, mixed> */
    private function bindParams(array $data): array
    {
        return [
            ':title'       => $data['title']      ?? '',
            ':content'     => $data['content']    ?? '',
            ':status'      => $data['status']      ?? 'Draft',
            ':cover_image' => $data['coverImage'] ?? ($data['cover_image'] ?? null),
        ];
    }

    /** Build a camelCase record for file storage. @return array<string, mixed> */
    private function buildRecord(int $id, array $data): array
    {
        return [
            'id'         => $id,
            'title'      => $data['title']      ?? '',
            'content'    => $data['content']    ?? '',
            'status'     => $data['status']     ?? 'Draft',
            'coverImage' => $data['coverImage'] ?? null,
            'createdAt'  => $data['createdAt']  ?? date('c'),
            'updatedAt'  => date('c'),
        ];
    }

    /** @param array<string, mixed> $data */
    private function validatePayload(array $data): void
    {
        if (empty(trim($data['title'] ?? ''))) {
            throw new RuntimeException('Blog post title is required.', 422);
        }
        if (empty(trim($data['content'] ?? ''))) {
            throw new RuntimeException('Blog post content is required.', 422);
        }
    }
}
