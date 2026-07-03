<?php

declare(strict_types=1);

/**
 * Simple DB-backed vehicle catalog service using local tables:
 *  - vehicle_makes(id, name, created_at, updated_at)
 *  - vehicle_models(id, make_id, name, created_at, updated_at)
 */
class VehicleCatalogService
{
    private ?\PDO $db;

    public function __construct()
    {
        $this->db = DB_NAME !== '' ? Database::getInstance() : null;
    }

    /** @return string[] */
    public function listMakes(): array
    {
        if ($this->db === null) {
            return [];
        }
        $stmt = $this->db->query('SELECT name FROM vehicle_makes ORDER BY name ASC');
        $rows = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
        $names = [];
        foreach ($rows as $r) {
            $n = trim((string) ($r['name'] ?? ''));
            if ($n !== '') $names[] = $n;
        }
        return array_values(array_unique($names));
    }

    /** @return string[] */
    public function listModelsByMakeName(string $makeName): array
    {
        if ($this->db === null || $makeName === '') {
            return [];
        }
        $stmt = $this->db->prepare(
            'SELECT m.name FROM vehicle_models m
               JOIN vehicle_makes mk ON mk.id = m.make_id
              WHERE mk.name = :make
              ORDER BY m.name ASC'
        );
        $stmt->execute([':make' => $makeName]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $names = [];
        foreach ($rows as $r) {
            $n = trim((string) ($r['name'] ?? ''));
            if ($n !== '') $names[] = $n;
        }
        return array_values(array_unique($names));
    }

    public function createMake(string $name): int
    {
        if ($this->db === null || trim($name) === '') {
            throw new RuntimeException('DB unavailable or invalid name', 500);
        }
        $stmt = $this->db->prepare('INSERT INTO vehicle_makes (name) VALUES (:name)');
        $stmt->execute([':name' => trim($name)]);
        return (int) $this->db->lastInsertId();
    }

    public function updateMake(int $id, string $name): void
    {
        if ($this->db === null) return;
        $stmt = $this->db->prepare('UPDATE vehicle_makes SET name = :name, updated_at = CURRENT_TIMESTAMP WHERE id = :id');
        $stmt->execute([':name' => trim($name), ':id' => $id]);
    }

    public function deleteMake(int $id): void
    {
        if ($this->db === null) return;
        // Delete models first
        $stmt = $this->db->prepare('DELETE FROM vehicle_models WHERE make_id = :id');
        $stmt->execute([':id' => $id]);
        $stmt = $this->db->prepare('DELETE FROM vehicle_makes WHERE id = :id');
        $stmt->execute([':id' => $id]);
    }

    public function createModel(int $makeId, string $name): int
    {
        if ($this->db === null || trim($name) === '' || $makeId <= 0) {
            throw new RuntimeException('DB unavailable or invalid input', 500);
        }
        $stmt = $this->db->prepare('INSERT INTO vehicle_models (make_id, name) VALUES (:make_id, :name)');
        $stmt->execute([':make_id' => $makeId, ':name' => trim($name)]);
        return (int) $this->db->lastInsertId();
    }

    public function updateModel(int $id, int $makeId, string $name): void
    {
        if ($this->db === null) return;
        $stmt = $this->db->prepare('UPDATE vehicle_models SET make_id = :make_id, name = :name, updated_at = CURRENT_TIMESTAMP WHERE id = :id');
        $stmt->execute([':make_id' => $makeId, ':name' => trim($name), ':id' => $id]);
    }

    public function deleteModel(int $id): void
    {
        if ($this->db === null) return;
        $stmt = $this->db->prepare('DELETE FROM vehicle_models WHERE id = :id');
        $stmt->execute([':id' => $id]);
    }
}
