<?php

declare(strict_types=1);

class ActivityLog 
{

    private Database $db;
    private ?string $subjectType = null;
    private ?string $subjectId = null;
    private ?string $causerType = null;
    private ?string $causerId = null;

    /** @var array<string, mixed> */
    private array $properties = [];

    /** @var array<string, mixed>|null */
    private ?array $attributeChanges = null;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /**
     * @param mixed $subject
     */
    public function performedOn(mixed $subject, ?string $type = null, mixed $id = null): self
    {
        [$resolvedType, $resolvedId] = $this->normalizeEntity($subject, $type, $id);
        $this->subjectType = $resolvedType;
        $this->subjectId = $resolvedId;
        return $this;
    }

    /**
     * @param mixed $causer
     */
    public function causedBy(mixed $causer, ?string $type = null, mixed $id = null): self
    {
        [$resolvedType, $resolvedId] = $this->normalizeEntity($causer, $type, $id);
        $this->causerType = $resolvedType;
        $this->causerId = $resolvedId;
        return $this;
    }

    /**
     * @param array<string, mixed> $properties
     */
    public function withProperties(array $properties): self
    {
        $this->properties = array_replace($this->properties, $properties);
        return $this;
    }

    /**
     * @param array<string, mixed> $attributeChanges
     */
    public function withAttributeChanges(array $attributeChanges): self
    {
        $this->attributeChanges = $attributeChanges;
        return $this;
    }

    /**
     * @param array<string, mixed> $attributes
     * @param array<string, mixed> $old
     */
    public function withUpdatedAttributes(array $attributes, array $old = []): self
    {
        $this->attributeChanges = [
            'attributes' => $attributes,
            'old' => $old,
        ];

        return $this;
    }

    /**
     * Convenience alias for setting subject by table + id.
     */
    public function forSubject(string $type, mixed $id): self
    {
        return $this->performedOn(['type' => $type, 'id' => $id]);
    }

    /**
     * Convenience alias for setting user causer (uses "users" type).
     */
    public function byUser(mixed $userId): self
    {
        return $this->causedBy(['type' => 'users', 'id' => $userId]);
    }

    public function withProperty(string $key, mixed $value): self
    {
        $this->properties[$key] = $value;
        return $this;
    }

    /**
     * Log a create action with optional custom properties.
     *
     * @param array<string, mixed> $properties
     */
    public function logCreated(array $properties = [], string $logName = 'default'): ActivityRecord
    {
        if ($properties !== []) {
            $this->withProperties($properties);
        }

        return $this->log('created', $logName);
    }

    /**
     * Log an update action with standard attribute change payload.
     *
     * @param array<string, mixed> $attributes
     * @param array<string, mixed> $old
     * @param array<string, mixed> $properties
     */
    public function logUpdated(
        array $attributes,
        array $old = [],
        array $properties = [],
        string $logName = 'default'
    ): ActivityRecord {
        $this->withUpdatedAttributes($attributes, $old);
        if ($properties !== []) {
            $this->withProperties($properties);
        }

        return $this->log('updated', $logName);
    }

    /**
     * Log a delete action with optional custom properties.
     *
     * @param array<string, mixed> $properties
     */
    public function logDeleted(array $properties = [], string $logName = 'default'): ActivityRecord
    {
        if ($properties !== []) {
            $this->withProperties($properties);
        }

        return $this->log('deleted', $logName);
    }

    public function log(string $description, string $logName = 'default'): ActivityRecord
    {
        $stmt = $this->db->prepare(
            'INSERT INTO activity_logs
                (log_name, description, subject_type, subject_id, causer_type, causer_id, properties_json, attribute_changes_json, created_at)
             VALUES
                (:log_name, :description, :subject_type, :subject_id, :causer_type, :causer_id, :properties_json, :attribute_changes_json, NOW())'
        );

        $stmt->execute([
            ':log_name' => $logName,
            ':description' => $description,
            ':subject_type' => $this->subjectType,
            ':subject_id' => $this->subjectId,
            ':causer_type' => $this->causerType,
            ':causer_id' => $this->causerId,
            ':properties_json' => $this->encodeJson($this->properties),
            ':attribute_changes_json' => $this->attributeChanges === null ? null : $this->encodeJson($this->attributeChanges),
        ]);

        $id = (int) $this->db->lastInsertId();
        $created = Activity::find($id);
        if ($created === null) {
            throw new RuntimeException('Failed to fetch created activity log.', 500);
        }

        $this->resetState();

        return $created;
    }

    private function resetState(): void
    {
        $this->subjectType = null;
        $this->subjectId = null;
        $this->causerType = null;
        $this->causerId = null;
        $this->properties = [];
        $this->attributeChanges = null;
    }

    /**
     * @param mixed $entity
     * @return array{0: ?string, 1: ?string}
     */
    private function normalizeEntity(mixed $entity, ?string $explicitType = null, mixed $explicitId = null): array
    {
        $type = $explicitType;
        $id = $explicitId;

        if ($type === null && is_array($entity)) {
            $candidate = $entity['type'] ?? $entity['table'] ?? null;
            $type = is_string($candidate) ? $candidate : null;
        }
        if ($id === null && is_array($entity)) {
            $candidate = $entity['id'] ?? $entity['uuid'] ?? null;
            if (is_scalar($candidate)) {
                $id = $candidate;
            }
        }

        if ($type === null && is_object($entity)) {
            if (property_exists($entity, 'table') && is_string($entity->table)) {
                $type = $entity->table;
            } elseif (method_exists($entity, 'getTable')) {
                $candidate = $entity->getTable();
                if (is_string($candidate)) {
                    $type = $candidate;
                }
            } else {
                $type = get_class($entity);
            }
        }
        if ($id === null && is_object($entity)) {
            if (property_exists($entity, 'id') && is_scalar($entity->id)) {
                $id = $entity->id;
            } elseif (method_exists($entity, 'getKey')) {
                $candidate = $entity->getKey();
                if (is_scalar($candidate)) {
                    $id = $candidate;
                }
            }
        }

        if ($type === null && $explicitType !== null) {
            $type = $explicitType;
        }
        if ($id === null && is_scalar($entity) && $explicitType !== null) {
            $id = $entity;
        }

        return [
            $type !== null && trim($type) !== '' ? trim($type) : null,
            $id !== null && (is_int($id) || is_float($id) || (is_string($id) && trim($id) !== ''))
                ? (string) $id
                : null,
        ];
    }

    /**
     * @param array<string, mixed> $data
     */
    private function encodeJson(array $data): string
    {
        $encoded = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($encoded === false) {
            throw new RuntimeException('Failed to encode activity metadata.', 500);
        }

        return $encoded;
    }
}