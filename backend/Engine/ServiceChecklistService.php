<?php

declare(strict_types=1);

class ServiceChecklistService
{
    private $db;

    public function __construct()
    {
        if (DB_NAME === '') {
            throw new RuntimeException("Database is required for checklist service.");
        }
        $this->db = Database::getInstance();
    }

    /**
     * @return array<string, mixed>
     */
    public function getItemsByService(int $serviceId): array
    {
        $stmt = $this->db->prepare(
            'SELECT id, service_id, phase, section, label, description, has_notes, sort_order, is_active
             FROM service_checklist_items
             WHERE service_id = :service_id
             ORDER BY phase ASC, sort_order ASC, id ASC'
        );
        $stmt->execute([':service_id' => $serviceId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $result = [
            'before' => [],
            'after' => [],
            'acknowledgement' => []
        ];

        foreach ($rows as $row) {
            $item = [
                'id' => (int)$row['id'],
                'serviceId' => (int)$row['service_id'],
                'phase' => $row['phase'],
                'section' => $row['section'],
                'label' => $row['label'],
                'description' => $row['description'],
                'hasNotes' => (bool)$row['has_notes'],
                'sortOrder' => (int)$row['sort_order'],
                'isActive' => (bool)$row['is_active']
            ];
            $result[$row['phase']][] = $item;
        }

        return $result;
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function createItem(int $serviceId, array $data): array
    {
        $stmt = $this->db->prepare(
            'INSERT INTO service_checklist_items 
             (service_id, phase, section, label, description, has_notes, sort_order, is_active)
             VALUES (:service_id, :phase, :section, :label, :description, :has_notes, :sort_order, :is_active)'
        );
        
        $stmt->execute([
            ':service_id' => $serviceId,
            ':phase' => $data['phase'] ?? 'before',
            ':section' => $data['section'] ?? null,
            ':label' => trim($data['label'] ?? ''),
            ':description' => $data['description'] ?? null,
            ':has_notes' => (int)($data['hasNotes'] ?? 1),
            ':sort_order' => (int)($data['sortOrder'] ?? 0),
            ':is_active' => (int)($data['isActive'] ?? 1)
        ]);

        $id = (int)$this->db->lastInsertId();
        return $this->getItemById($id);
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function updateItem(int $id, array $data): array
    {
        $stmt = $this->db->prepare(
            'UPDATE service_checklist_items 
             SET phase = :phase, section = :section, label = :label, description = :description, 
                 has_notes = :has_notes, sort_order = :sort_order, is_active = :is_active
             WHERE id = :id'
        );
        
        $stmt->execute([
            ':id' => $id,
            ':phase' => $data['phase'] ?? 'before',
            ':section' => $data['section'] ?? null,
            ':label' => trim($data['label'] ?? ''),
            ':description' => $data['description'] ?? null,
            ':has_notes' => (int)($data['hasNotes'] ?? 1),
            ':sort_order' => (int)($data['sortOrder'] ?? 0),
            ':is_active' => (int)($data['isActive'] ?? 1)
        ]);

        return $this->getItemById($id);
    }

    public function deleteItem(int $id): void
    {
        $stmt = $this->db->prepare('DELETE FROM service_checklist_items WHERE id = :id');
        $stmt->execute([':id' => $id]);
    }

    /**
     * @param int[] $orderedIds
     */
    public function reorderItems(int $serviceId, array $orderedIds): void
    {
        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare('UPDATE service_checklist_items SET sort_order = :sort_order WHERE id = :id AND service_id = :service_id');
            foreach ($orderedIds as $index => $id) {
                $stmt->execute([
                    ':sort_order' => $index * 10,
                    ':id' => $id,
                    ':service_id' => $serviceId
                ]);
            }
            $this->db->commit();
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }
    }

    private function getItemById(int $id): array
    {
        $stmt = $this->db->prepare(
            'SELECT id, service_id, phase, section, label, description, has_notes, sort_order, is_active
             FROM service_checklist_items
             WHERE id = :id'
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$row) {
            throw new RuntimeException("Checklist item not found");
        }
        
        return [
            'id' => (int)$row['id'],
            'serviceId' => (int)$row['service_id'],
            'phase' => $row['phase'],
            'section' => $row['section'],
            'label' => $row['label'],
            'description' => $row['description'],
            'hasNotes' => (bool)$row['has_notes'],
            'sortOrder' => (int)$row['sort_order'],
            'isActive' => (bool)$row['is_active']
        ];
    }
}
