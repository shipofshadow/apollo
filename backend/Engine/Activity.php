<?php

declare(strict_types=1);

/**
 * Read API for activity log entries.
 */
class Activity
{
    private Database $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    public static function all(int $limit = 200): ActivityCollection
    {
        return (new self())->list($limit);
    }

    public static function last(): ?ActivityRecord
    {
        $db = Database::getInstance();
        $stmt = $db->query(
            'SELECT id, log_name, description, subject_type, subject_id, causer_type, causer_id, properties_json, attribute_changes_json, created_at
             FROM activity_logs
             ORDER BY id DESC
             LIMIT 1'
        );

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) {
            return null;
        }

        return new ActivityRecord($row);
    }

    public static function find(int $id): ?ActivityRecord
    {
        $stmt = Database::getInstance()->prepare(
            'SELECT id, log_name, description, subject_type, subject_id, causer_type, causer_id, properties_json, attribute_changes_json, created_at
             FROM activity_logs
             WHERE id = :id
             LIMIT 1'
        );
        $stmt->execute([':id' => $id]);

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) {
            return null;
        }

        return new ActivityRecord($row);
    }

    /**
     * @return ActivityRecord[]
     */
    public static function listByCauserUser(?int $userId = null, int $limit = 500): array
    {
        $db = Database::getInstance();
        $limit = max(1, min(2000, $limit));

        if ($userId !== null && $userId > 0) {
            $stmt = $db->prepare(
                'SELECT id, log_name, description, subject_type, subject_id, causer_type, causer_id, properties_json, attribute_changes_json, created_at
                 FROM activity_logs
                 WHERE causer_type IN (\'users\', \'user\') AND causer_id = :causer_id
                 ORDER BY id DESC
                 LIMIT :limit'
            );
            $stmt->bindValue(':causer_id', (string) $userId);
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $stmt->execute();
        } else {
            $stmt = $db->prepare(
                'SELECT id, log_name, description, subject_type, subject_id, causer_type, causer_id, properties_json, attribute_changes_json, created_at
                 FROM activity_logs
                 WHERE causer_type IN (\'users\', \'user\')
                 ORDER BY id DESC
                 LIMIT :limit'
            );
            $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
            $stmt->execute();
        }

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        return array_map(static fn (array $row): ActivityRecord => new ActivityRecord($row), $rows);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public static function summarizeByUsers(?string $sort = 'most_recent'): array
    {
        $db = Database::getInstance();
        $sort = strtolower(trim((string) $sort));

        $orderBy = 'MAX(a.created_at) DESC, totalActivities DESC, u.name ASC';
        if ($sort === 'most_active') {
            $orderBy = 'totalActivities DESC, MAX(a.created_at) DESC, u.name ASC';
        } elseif ($sort === 'name_asc') {
            $orderBy = 'u.name ASC, totalActivities DESC';
        } elseif ($sort === 'name_desc') {
            $orderBy = 'u.name DESC, totalActivities DESC';
        }

        $sql = sprintf(
            'SELECT
                CAST(a.causer_id AS UNSIGNED) AS userId,
                u.name AS userName,
                u.email AS userEmail,
                COUNT(*) AS totalActivities,
                MAX(a.created_at) AS lastActivityAt
             FROM activity_logs a
             INNER JOIN users u ON u.id = CAST(a.causer_id AS UNSIGNED)
             WHERE a.causer_type IN (\'users\', \'user\')
             GROUP BY CAST(a.causer_id AS UNSIGNED), u.name, u.email
             ORDER BY %s',
            $orderBy
        );

        $stmt = $db->prepare($sql);
        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return array_map(static function (array $row): array {
            return [
                'userId' => (int) ($row['userId'] ?? 0),
                'userName' => (string) ($row['userName'] ?? ''),
                'userEmail' => (string) ($row['userEmail'] ?? ''),
                'totalActivities' => (int) ($row['totalActivities'] ?? 0),
                'lastActivityAt' => isset($row['lastActivityAt']) ? (string) $row['lastActivityAt'] : null,
            ];
        }, $rows);
    }

    private function list(int $limit): ActivityCollection
    {
        $limit = max(1, min(1000, $limit));

        $stmt = $this->db->prepare(
            'SELECT id, log_name, description, subject_type, subject_id, causer_type, causer_id, properties_json, attribute_changes_json, created_at
             FROM activity_logs
             ORDER BY id ASC
             LIMIT :limit'
        );
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $items = array_map(static fn (array $row): ActivityRecord => new ActivityRecord($row), $rows);

        return new ActivityCollection($items);
    }
}

/**
 * Collection wrapper that supports all()->last() usage.
 */
class ActivityCollection implements IteratorAggregate, Countable
{
    /** @var ActivityRecord[] */
    private array $items;

    /**
     * @param ActivityRecord[] $items
     */
    public function __construct(array $items)
    {
        $this->items = array_values($items);
    }

    public function getIterator(): Traversable
    {
        return new ArrayIterator($this->items);
    }

    public function count(): int
    {
        return count($this->items);
    }

    /**
     * @return ActivityRecord[]
     */
    public function all(): array
    {
        return $this->items;
    }

    public function last(): ?ActivityRecord
    {
        if ($this->items === []) {
            return null;
        }

        return $this->items[count($this->items) - 1];
    }
}

/**
 * Strongly typed activity record.
 */
class ActivityRecord
{
    public int $id;
    public string $log_name;
    public string $description;
    public ?string $subject_type;
    public ?string $subject_id;
    public ?string $causer_type;
    public ?string $causer_id;

    /** @var array<string, mixed> */
    public array $properties;

    /** @var array<string, mixed>|null */
    public ?array $attribute_changes;

    public string $created_at;

    /** @var array<string, mixed>|null */
    public ?array $subject;

    /** @var array<string, mixed>|null */
    public ?array $causer;

    /**
     * @param array<string, mixed> $row
     */
    public function __construct(array $row)
    {
        $this->id = (int) ($row['id'] ?? 0);
        $this->log_name = (string) ($row['log_name'] ?? 'default');
        $this->description = (string) ($row['description'] ?? '');
        $this->subject_type = isset($row['subject_type']) ? (string) $row['subject_type'] : null;
        $this->subject_id = isset($row['subject_id']) ? (string) $row['subject_id'] : null;
        $this->causer_type = isset($row['causer_type']) ? (string) $row['causer_type'] : null;
        $this->causer_id = isset($row['causer_id']) ? (string) $row['causer_id'] : null;
        $this->properties = self::decodeJsonObject($row['properties_json'] ?? null) ?? [];
        $this->attribute_changes = self::decodeJsonObject($row['attribute_changes_json'] ?? null);
        $this->created_at = (string) ($row['created_at'] ?? '');

        $this->subject = $this->resolveEntity($this->subject_type, $this->subject_id);
        $this->causer = $this->resolveEntity($this->causer_type, $this->causer_id);
    }

    public function getProperty(string $key, mixed $default = null): mixed
    {
        return array_key_exists($key, $this->properties) ? $this->properties[$key] : $default;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'logName' => $this->log_name,
            'description' => $this->description,
            'subjectType' => $this->subject_type,
            'subjectId' => $this->subject_id,
            'causerType' => $this->causer_type,
            'causerId' => $this->causer_id,
            'properties' => $this->properties,
            'attribute_changes' => $this->attribute_changes,
            'createdAt' => $this->created_at,
            'subject' => $this->subject,
            'causer' => $this->causer,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private static function decodeJsonObject(mixed $value): ?array
    {
        if (!is_string($value) || trim($value) === '') {
            return null;
        }

        $decoded = json_decode($value, true);
        return is_array($decoded) ? $decoded : null;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function resolveEntity(?string $type, ?string $id): ?array
    {
        if ($type === null || $id === null || $type === '' || $id === '') {
            return null;
        }

        if (!preg_match('/^[A-Za-z0-9_]+$/', $type)) {
            return [
                'id' => $id,
                'type' => $type,
            ];
        }

        try {
            $db = Database::getInstance();
            $stmt = $db->prepare(sprintf('SELECT * FROM %s WHERE id = :id LIMIT 1', $type));
            $stmt->execute([':id' => $id]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if (is_array($row)) {
                return $row;
            }
        } catch (Throwable $e) {
            // If entity resolution fails, still return reference metadata.
        }

        return [
            'id' => $id,
            'type' => $type,
        ];
    }
}
