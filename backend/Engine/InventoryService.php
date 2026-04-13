<?php

declare(strict_types=1);

class InventoryService
{
    private \PDO $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /** @param array<string, mixed> $filters
     *  @return array<int, array<string, mixed>>
     */
    public function listItems(array $filters = []): array
    {
        $search = trim((string) ($filters['search'] ?? ''));
        $lowStockOnly = (bool) ($filters['lowStockOnly'] ?? false);

        $sql = 'SELECT i.*, s.name AS supplier_name
                FROM inventory_items i
                LEFT JOIN suppliers s ON s.id = i.supplier_id
                WHERE i.is_active = 1';
        $params = [];

        if ($search !== '') {
            $sql .= ' AND (i.sku LIKE :search OR i.name LIKE :search OR i.category LIKE :search)';
            $params[':search'] = '%' . $search . '%';
        }
        if ($lowStockOnly) {
            $sql .= ' AND i.qty_on_hand <= i.reorder_point';
        }

        $sql .= ' ORDER BY i.updated_at DESC, i.id DESC';

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return array_map([$this, 'formatItem'], $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: []);
    }

    /** @param array<string, mixed> $data
     *  @return array<string, mixed>
     */
    public function createItem(array $data, ?int $actorUserId = null): array
    {
        $payload = $this->normalizeItemPayload($data);

        $stmt = $this->db->prepare(
            'INSERT INTO inventory_items
             (sku, name, category, unit, qty_on_hand, reorder_point, unit_cost, supplier_id, is_active)
             VALUES
             (:sku, :name, :category, :unit, :qty_on_hand, :reorder_point, :unit_cost, :supplier_id, 1)'
        );
        $stmt->execute([
            ':sku' => $payload['sku'],
            ':name' => $payload['name'],
            ':category' => $payload['category'],
            ':unit' => $payload['unit'],
            ':qty_on_hand' => $payload['qtyOnHand'],
            ':reorder_point' => $payload['reorderPoint'],
            ':unit_cost' => $payload['unitCost'],
            ':supplier_id' => $payload['supplierId'],
        ]);

        $id = (int) $this->db->lastInsertId();
        if ((float) $payload['qtyOnHand'] !== 0.0) {
            $this->recordMovement($id, 'adjustment', (float) $payload['qtyOnHand'], 'Initial stock', 'inventory_item', (string) $id, $actorUserId);
        }

        $item = $this->getItemById($id);
        $this->checkLowStockAlert($item);

        return $item;
    }

    /** @param array<string, mixed> $data
     *  @return array<string, mixed>
     */
    public function updateItem(int $id, array $data): array
    {
        $current = $this->getItemById($id);
        $payload = $this->normalizeItemPayload(array_merge($current, $data), true);

        $stmt = $this->db->prepare(
            'UPDATE inventory_items
                SET sku = :sku,
                    name = :name,
                    category = :category,
                    unit = :unit,
                    reorder_point = :reorder_point,
                    unit_cost = :unit_cost,
                    supplier_id = :supplier_id,
                    is_active = :is_active
              WHERE id = :id'
        );
        $stmt->execute([
            ':id' => $id,
            ':sku' => $payload['sku'],
            ':name' => $payload['name'],
            ':category' => $payload['category'],
            ':unit' => $payload['unit'],
            ':reorder_point' => $payload['reorderPoint'],
            ':unit_cost' => $payload['unitCost'],
            ':supplier_id' => $payload['supplierId'],
            ':is_active' => $payload['isActive'] ? 1 : 0,
        ]);

        $item = $this->getItemById($id);
        $this->checkLowStockAlert($item);

        return $item;
    }

    /** @return array<int, array<string, mixed>> */
    public function listMovements(int $limit = 100): array
    {
        $lim = max(1, min(500, $limit));
        $stmt = $this->db->prepare(
            'SELECT m.*, i.sku, i.name AS item_name, u.name AS actor_name
             FROM inventory_movements m
             JOIN inventory_items i ON i.id = m.item_id
             LEFT JOIN users u ON u.id = m.actor_user_id
             ORDER BY m.created_at DESC, m.id DESC
             LIMIT :lim'
        );
        $stmt->bindValue(':lim', $lim, \PDO::PARAM_INT);
        $stmt->execute();

        return array_map(static function (array $row): array {
            return [
                'id' => (int) ($row['id'] ?? 0),
                'itemId' => (int) ($row['item_id'] ?? 0),
                'itemSku' => (string) ($row['sku'] ?? ''),
                'itemName' => (string) ($row['item_name'] ?? ''),
                'movementType' => (string) ($row['movement_type'] ?? ''),
                'quantityDelta' => (float) ($row['quantity_delta'] ?? 0),
                'note' => (string) ($row['note'] ?? ''),
                'referenceType' => isset($row['reference_type']) ? (string) $row['reference_type'] : null,
                'referenceId' => isset($row['reference_id']) ? (string) $row['reference_id'] : null,
                'actorUserId' => isset($row['actor_user_id']) ? (int) $row['actor_user_id'] : null,
                'actorName' => isset($row['actor_name']) ? (string) $row['actor_name'] : null,
                'createdAt' => (string) ($row['created_at'] ?? ''),
            ];
        }, $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: []);
    }

    /** @param array<string, mixed> $data
     *  @return array<string, mixed>
     */
    public function adjustStock(array $data, ?int $actorUserId = null): array
    {
        $itemId = (int) ($data['itemId'] ?? 0);
        $delta = (float) ($data['quantityDelta'] ?? 0);
        $note = trim((string) ($data['note'] ?? 'Stock adjustment'));

        if ($itemId <= 0) {
            throw new RuntimeException('itemId is required.', 422);
        }
        if ($delta == 0.0) {
            throw new RuntimeException('quantityDelta cannot be zero.', 422);
        }

        $this->db->beginTransaction();
        try {
            $item = $this->getItemById($itemId, true);
            $nextQty = (float) ($item['qtyOnHand'] ?? 0) + $delta;
            if ($nextQty < 0) {
                throw new RuntimeException('Stock cannot go below zero.', 422);
            }

            $stmt = $this->db->prepare('UPDATE inventory_items SET qty_on_hand = :qty WHERE id = :id');
            $stmt->execute([':qty' => $nextQty, ':id' => $itemId]);

            $this->recordMovement($itemId, 'adjustment', $delta, $note, 'inventory_item', (string) $itemId, $actorUserId);

            $this->db->commit();
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            if ($e instanceof RuntimeException) {
                throw $e;
            }
            throw new RuntimeException('Failed to adjust stock.', 500, $e);
        }

        $updated = $this->getItemById($itemId);
        $this->checkLowStockAlert($updated);

        return $updated;
    }

    /** @return array<int, array<string, mixed>> */
    public function listSuppliers(): array
    {
        $stmt = $this->db->query('SELECT * FROM suppliers ORDER BY is_active DESC, name ASC');
        return array_map(static function (array $row): array {
            return [
                'id' => (int) ($row['id'] ?? 0),
                'name' => (string) ($row['name'] ?? ''),
                'contactPerson' => (string) ($row['contact_person'] ?? ''),
                'phone' => (string) ($row['phone'] ?? ''),
                'email' => (string) ($row['email'] ?? ''),
                'notes' => isset($row['notes']) ? (string) $row['notes'] : null,
                'isActive' => ((int) ($row['is_active'] ?? 1)) === 1,
                'createdAt' => (string) ($row['created_at'] ?? ''),
                'updatedAt' => (string) ($row['updated_at'] ?? ''),
            ];
        }, $stmt ? ($stmt->fetchAll(\PDO::FETCH_ASSOC) ?: []) : []);
    }

    /** @param array<string, mixed> $data
     *  @return array<string, mixed>
     */
    public function createSupplier(array $data): array
    {
        $name = trim((string) ($data['name'] ?? ''));
        if ($name === '') {
            throw new RuntimeException('Supplier name is required.', 422);
        }

        $stmt = $this->db->prepare(
            'INSERT INTO suppliers (name, contact_person, phone, email, notes, is_active)
             VALUES (:name, :contact_person, :phone, :email, :notes, 1)'
        );
        $stmt->execute([
            ':name' => mb_substr($name, 0, 180),
            ':contact_person' => mb_substr(trim((string) ($data['contactPerson'] ?? '')), 0, 180),
            ':phone' => mb_substr(trim((string) ($data['phone'] ?? '')), 0, 40),
            ':email' => mb_substr(strtolower(trim((string) ($data['email'] ?? ''))), 0, 180),
            ':notes' => trim((string) ($data['notes'] ?? '')),
        ]);

        $id = (int) $this->db->lastInsertId();
        $rows = $this->listSuppliers();
        foreach ($rows as $row) {
            if ((int) ($row['id'] ?? 0) === $id) {
                return $row;
            }
        }

        throw new RuntimeException('Failed to create supplier.', 500);
    }

    /** @return array<int, array<string, mixed>> */
    public function listPurchaseOrders(int $limit = 100): array
    {
        $lim = max(1, min(300, $limit));
        $stmt = $this->db->prepare(
            'SELECT po.*, s.name AS supplier_name, u.name AS created_by_name
             FROM purchase_orders po
             LEFT JOIN suppliers s ON s.id = po.supplier_id
             LEFT JOIN users u ON u.id = po.created_by
             ORDER BY po.created_at DESC, po.id DESC
             LIMIT :lim'
        );
        $stmt->bindValue(':lim', $lim, \PDO::PARAM_INT);
        $stmt->execute();

        $orders = [];
        foreach (($stmt->fetchAll(\PDO::FETCH_ASSOC) ?: []) as $row) {
            $orderId = (int) ($row['id'] ?? 0);
            $orders[] = [
                'id' => $orderId,
                'poNumber' => (string) ($row['po_number'] ?? ''),
                'supplierId' => isset($row['supplier_id']) ? (int) $row['supplier_id'] : null,
                'supplierName' => isset($row['supplier_name']) ? (string) $row['supplier_name'] : null,
                'status' => (string) ($row['status'] ?? 'draft'),
                'notes' => isset($row['notes']) ? (string) $row['notes'] : null,
                'orderedAt' => isset($row['ordered_at']) ? (string) $row['ordered_at'] : null,
                'expectedAt' => isset($row['expected_at']) ? (string) $row['expected_at'] : null,
                'receivedAt' => isset($row['received_at']) ? (string) $row['received_at'] : null,
                'createdBy' => isset($row['created_by']) ? (int) $row['created_by'] : null,
                'createdByName' => isset($row['created_by_name']) ? (string) $row['created_by_name'] : null,
                'createdAt' => (string) ($row['created_at'] ?? ''),
                'updatedAt' => (string) ($row['updated_at'] ?? ''),
                'items' => $this->fetchPurchaseOrderItems($orderId),
            ];
        }

        return $orders;
    }

    /** @param array<string, mixed> $data
     *  @return array<string, mixed>
     */
    public function createPurchaseOrder(array $data, ?int $actorUserId = null): array
    {
        $supplierId = isset($data['supplierId']) ? (int) $data['supplierId'] : null;
        $notes = trim((string) ($data['notes'] ?? ''));
        $expectedAt = trim((string) ($data['expectedAt'] ?? ''));

        $itemsRaw = $data['items'] ?? [];
        if (!is_array($itemsRaw) || count($itemsRaw) === 0) {
            throw new RuntimeException('Purchase order must include at least one item.', 422);
        }

        $poNumber = $this->generatePoNumber();

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare(
                'INSERT INTO purchase_orders (po_number, supplier_id, status, notes, ordered_at, expected_at, created_by)
                 VALUES (:po_number, :supplier_id, "ordered", :notes, NOW(), :expected_at, :created_by)'
            );
            $stmt->execute([
                ':po_number' => $poNumber,
                ':supplier_id' => $supplierId,
                ':notes' => $notes !== '' ? $notes : null,
                ':expected_at' => $expectedAt !== '' ? $expectedAt : null,
                ':created_by' => $actorUserId,
            ]);

            $poId = (int) $this->db->lastInsertId();
            $itemStmt = $this->db->prepare(
                'INSERT INTO purchase_order_items
                 (purchase_order_id, item_id, quantity, unit_cost, line_total, received_qty)
                 VALUES (:po_id, :item_id, :quantity, :unit_cost, :line_total, 0)'
            );

            foreach ($itemsRaw as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $itemId = (int) ($item['itemId'] ?? 0);
                $qty = (float) ($item['quantity'] ?? 0);
                $unitCost = (float) ($item['unitCost'] ?? 0);
                if ($itemId <= 0 || $qty <= 0) {
                    continue;
                }

                $lineTotal = $qty * $unitCost;
                $itemStmt->execute([
                    ':po_id' => $poId,
                    ':item_id' => $itemId,
                    ':quantity' => $qty,
                    ':unit_cost' => $unitCost,
                    ':line_total' => $lineTotal,
                ]);
            }

            $this->db->commit();
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            if ($e instanceof RuntimeException) {
                throw $e;
            }
            throw new RuntimeException('Failed to create purchase order.', 500, $e);
        }

        $all = $this->listPurchaseOrders(100);
        foreach ($all as $row) {
            if ((string) ($row['poNumber'] ?? '') === $poNumber) {
                return $row;
            }
        }

        throw new RuntimeException('Failed to fetch purchase order.', 500);
    }

    /** @return array<string, mixed> */
    public function updatePurchaseOrderStatus(int $id, string $status, ?int $actorUserId = null): array
    {
        $allowed = ['draft', 'ordered', 'partially_received', 'received', 'cancelled'];
        $normalized = strtolower(trim($status));
        if (!in_array($normalized, $allowed, true)) {
            throw new RuntimeException('Invalid purchase order status.', 422);
        }

        $sql = 'UPDATE purchase_orders
                SET status = :status,
                    received_at = CASE WHEN :status_received = 1 THEN NOW() ELSE received_at END
                WHERE id = :id';
        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':status' => $normalized,
            ':status_received' => $normalized === 'received' ? 1 : 0,
            ':id' => $id,
        ]);

        if ($stmt->rowCount() === 0) {
            throw new RuntimeException('Purchase order not found.', 404);
        }

        if ($normalized === 'received') {
            $items = $this->fetchPurchaseOrderItems($id);
            foreach ($items as $poItem) {
                $itemId = (int) ($poItem['itemId'] ?? 0);
                $qty = (float) ($poItem['quantity'] ?? 0);
                if ($itemId <= 0 || $qty <= 0) {
                    continue;
                }

                $this->db->prepare('UPDATE inventory_items SET qty_on_hand = qty_on_hand + :qty WHERE id = :id')
                    ->execute([':qty' => $qty, ':id' => $itemId]);
                $this->db->prepare('UPDATE purchase_order_items SET received_qty = quantity WHERE id = :id')
                    ->execute([':id' => (int) ($poItem['id'] ?? 0)]);
                $this->recordMovement($itemId, 'purchase', $qty, 'PO received', 'purchase_order', (string) $id, $actorUserId);

                $item = $this->getItemById($itemId);
                $this->checkLowStockAlert($item);
            }
        }

        foreach ($this->listPurchaseOrders(100) as $row) {
            if ((int) ($row['id'] ?? 0) === $id) {
                return $row;
            }
        }

        throw new RuntimeException('Purchase order not found.', 404);
    }

    /** @return array<int, array<string, mixed>> */
    public function listBookingPartRequirements(string $bookingId): array
    {
        $stmt = $this->db->prepare(
            'SELECT bpr.*, i.sku AS inventory_sku, i.name AS inventory_name, s.name AS supplier_name
             FROM booking_part_requirements bpr
             LEFT JOIN inventory_items i ON i.id = bpr.inventory_item_id
             LEFT JOIN suppliers s ON s.id = bpr.supplier_id
             WHERE bpr.booking_id = :bid
             ORDER BY bpr.created_at DESC, bpr.id DESC'
        );
        $stmt->execute([':bid' => $bookingId]);
        return array_map([$this, 'formatPartRequirement'], $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: []);
    }

    /** @param array<string, mixed> $data
     *  @return array<string, mixed>
     */
    public function createBookingPartRequirement(string $bookingId, array $data, ?int $actorUserId = null): array
    {
        $partName = trim((string) ($data['partName'] ?? ''));
        $qty = (float) ($data['quantity'] ?? 1);
        $inventoryItemId = isset($data['inventoryItemId']) ? (int) $data['inventoryItemId'] : null;
        $supplierId = isset($data['supplierId']) ? (int) $data['supplierId'] : null;
        $note = trim((string) ($data['note'] ?? ''));

        if ($partName === '') {
            throw new RuntimeException('partName is required.', 422);
        }
        if ($qty <= 0) {
            throw new RuntimeException('quantity must be greater than zero.', 422);
        }

        $stmt = $this->db->prepare(
            'INSERT INTO booking_part_requirements
             (booking_id, inventory_item_id, part_name, quantity, status, supplier_id, po_item_id, note, created_by)
             VALUES (:booking_id, :inventory_item_id, :part_name, :quantity, "needed", :supplier_id, NULL, :note, :created_by)'
        );
        $stmt->execute([
            ':booking_id' => $bookingId,
            ':inventory_item_id' => $inventoryItemId,
            ':part_name' => mb_substr($partName, 0, 200),
            ':quantity' => $qty,
            ':supplier_id' => $supplierId,
            ':note' => mb_substr($note, 0, 255),
            ':created_by' => $actorUserId,
        ]);

        $id = (int) $this->db->lastInsertId();
        foreach ($this->listBookingPartRequirements($bookingId) as $req) {
            if ((int) ($req['id'] ?? 0) === $id) {
                return $req;
            }
        }

        throw new RuntimeException('Failed to create booking part requirement.', 500);
    }

    /** @param array<string, mixed> $data
     *  @return array<string, mixed>
     */
    public function updateBookingPartRequirement(string $bookingId, int $requirementId, array $data): array
    {
        $status = strtolower(trim((string) ($data['status'] ?? '')));
        $allowed = ['needed', 'ordered', 'arrived', 'installed', 'cancelled'];
        if ($status !== '' && !in_array($status, $allowed, true)) {
            throw new RuntimeException('Invalid requirement status.', 422);
        }

        $updates = [];
        $params = [':id' => $requirementId, ':booking_id' => $bookingId];

        if (array_key_exists('status', $data)) {
            $updates[] = 'status = :status';
            $params[':status'] = $status;
        }
        if (array_key_exists('note', $data)) {
            $updates[] = 'note = :note';
            $params[':note'] = mb_substr(trim((string) $data['note']), 0, 255);
        }
        if (array_key_exists('supplierId', $data)) {
            $updates[] = 'supplier_id = :supplier_id';
            $params[':supplier_id'] = $data['supplierId'] !== null ? (int) $data['supplierId'] : null;
        }
        if (array_key_exists('poItemId', $data)) {
            $updates[] = 'po_item_id = :po_item_id';
            $params[':po_item_id'] = $data['poItemId'] !== null ? (int) $data['poItemId'] : null;
        }

        if (count($updates) === 0) {
            throw new RuntimeException('No changes provided.', 422);
        }

        $sql = 'UPDATE booking_part_requirements SET ' . implode(', ', $updates) . ' WHERE id = :id AND booking_id = :booking_id';
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        if ($stmt->rowCount() === 0) {
            throw new RuntimeException('Part requirement not found.', 404);
        }

        foreach ($this->listBookingPartRequirements($bookingId) as $req) {
            if ((int) ($req['id'] ?? 0) === $requirementId) {
                return $req;
            }
        }

        throw new RuntimeException('Part requirement not found.', 404);
    }

    /** @return array<int, array<string, mixed>> */
    public function listLowStockAlerts(string $status = 'open', int $limit = 100): array
    {
        $normalizedStatus = strtolower(trim($status));
        if (!in_array($normalizedStatus, ['open', 'resolved', 'all'], true)) {
            $normalizedStatus = 'open';
        }

        $sql = 'SELECT a.*, i.sku, i.name AS item_name
                FROM inventory_reorder_alerts a
                JOIN inventory_items i ON i.id = a.item_id';
        $params = [];
        if ($normalizedStatus !== 'all') {
            $sql .= ' WHERE a.status = :status';
            $params[':status'] = $normalizedStatus;
        }
        $sql .= ' ORDER BY a.created_at DESC, a.id DESC LIMIT :lim';

        $stmt = $this->db->prepare($sql);
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value, \PDO::PARAM_STR);
        }
        $stmt->bindValue(':lim', max(1, min(300, $limit)), \PDO::PARAM_INT);
        $stmt->execute();

        return array_map(static function (array $row): array {
            return [
                'id' => (int) ($row['id'] ?? 0),
                'itemId' => (int) ($row['item_id'] ?? 0),
                'itemSku' => (string) ($row['sku'] ?? ''),
                'itemName' => (string) ($row['item_name'] ?? ''),
                'status' => (string) ($row['status'] ?? 'open'),
                'qtySnapshot' => (float) ($row['qty_snapshot'] ?? 0),
                'reorderPointSnapshot' => (float) ($row['reorder_point_snapshot'] ?? 0),
                'message' => (string) ($row['message'] ?? ''),
                'createdAt' => (string) ($row['created_at'] ?? ''),
                'resolvedAt' => isset($row['resolved_at']) ? (string) $row['resolved_at'] : null,
            ];
        }, $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: []);
    }

    /** @return array<string, mixed> */
    private function getItemById(int $id, bool $forUpdate = false): array
    {
        $sql = 'SELECT i.*, s.name AS supplier_name
                FROM inventory_items i
                LEFT JOIN suppliers s ON s.id = i.supplier_id
                WHERE i.id = :id
                LIMIT 1';
        if ($forUpdate) {
            $sql = str_replace('LIMIT 1', 'FOR UPDATE', $sql);
        }

        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);
        if (!$row) {
            throw new RuntimeException('Inventory item not found.', 404);
        }

        return $this->formatItem($row);
    }

    /** @param array<string, mixed> $row
     *  @return array<string, mixed>
     */
    private function formatItem(array $row): array
    {
        return [
            'id' => (int) ($row['id'] ?? 0),
            'sku' => (string) ($row['sku'] ?? ''),
            'name' => (string) ($row['name'] ?? ''),
            'category' => (string) ($row['category'] ?? ''),
            'unit' => (string) ($row['unit'] ?? 'pcs'),
            'qtyOnHand' => (float) ($row['qty_on_hand'] ?? 0),
            'reorderPoint' => (float) ($row['reorder_point'] ?? 0),
            'unitCost' => (float) ($row['unit_cost'] ?? 0),
            'supplierId' => isset($row['supplier_id']) ? (int) $row['supplier_id'] : null,
            'supplierName' => isset($row['supplier_name']) ? (string) $row['supplier_name'] : null,
            'isActive' => ((int) ($row['is_active'] ?? 1)) === 1,
            'createdAt' => (string) ($row['created_at'] ?? ''),
            'updatedAt' => (string) ($row['updated_at'] ?? ''),
        ];
    }

    /** @param array<string, mixed> $data
     *  @return array<string, mixed>
     */
    private function normalizeItemPayload(array $data, bool $isUpdate = false): array
    {
        $sku = strtoupper(trim((string) ($data['sku'] ?? '')));
        $name = trim((string) ($data['name'] ?? ''));
        $category = trim((string) ($data['category'] ?? ''));
        $unit = trim((string) ($data['unit'] ?? 'pcs'));
        $qtyOnHand = (float) ($data['qtyOnHand'] ?? ($data['qty_on_hand'] ?? 0));
        $reorderPoint = (float) ($data['reorderPoint'] ?? ($data['reorder_point'] ?? 0));
        $unitCost = (float) ($data['unitCost'] ?? ($data['unit_cost'] ?? 0));
        $supplierId = isset($data['supplierId']) ? (int) $data['supplierId'] : (isset($data['supplier_id']) ? (int) $data['supplier_id'] : null);
        $isActive = array_key_exists('isActive', $data) ? (bool) $data['isActive'] : true;

        if ($sku === '') {
            throw new RuntimeException('SKU is required.', 422);
        }
        if ($name === '') {
            throw new RuntimeException('Item name is required.', 422);
        }
        if ($qtyOnHand < 0) {
            throw new RuntimeException('qtyOnHand cannot be negative.', 422);
        }
        if ($reorderPoint < 0) {
            throw new RuntimeException('reorderPoint cannot be negative.', 422);
        }
        if ($unitCost < 0) {
            throw new RuntimeException('unitCost cannot be negative.', 422);
        }

        return [
            'sku' => mb_substr($sku, 0, 80),
            'name' => mb_substr($name, 0, 200),
            'category' => mb_substr($category, 0, 120),
            'unit' => mb_substr($unit !== '' ? $unit : 'pcs', 0, 40),
            'qtyOnHand' => $qtyOnHand,
            'reorderPoint' => $reorderPoint,
            'unitCost' => $unitCost,
            'supplierId' => $supplierId,
            'isActive' => $isActive,
            'isUpdate' => $isUpdate,
        ];
    }

    private function recordMovement(
        int $itemId,
        string $movementType,
        float $quantityDelta,
        string $note,
        ?string $referenceType = null,
        ?string $referenceId = null,
        ?int $actorUserId = null
    ): void {
        $stmt = $this->db->prepare(
            'INSERT INTO inventory_movements
             (item_id, movement_type, quantity_delta, note, reference_type, reference_id, actor_user_id)
             VALUES (:item_id, :movement_type, :quantity_delta, :note, :reference_type, :reference_id, :actor_user_id)'
        );
        $stmt->execute([
            ':item_id' => $itemId,
            ':movement_type' => $movementType,
            ':quantity_delta' => $quantityDelta,
            ':note' => mb_substr($note, 0, 255),
            ':reference_type' => $referenceType,
            ':reference_id' => $referenceId,
            ':actor_user_id' => $actorUserId,
        ]);
    }

    /** @return array<int, array<string, mixed>> */
    private function fetchPurchaseOrderItems(int $purchaseOrderId): array
    {
        $stmt = $this->db->prepare(
            'SELECT poi.*, i.sku, i.name AS item_name
             FROM purchase_order_items poi
             JOIN inventory_items i ON i.id = poi.item_id
             WHERE poi.purchase_order_id = :po_id
             ORDER BY poi.id ASC'
        );
        $stmt->execute([':po_id' => $purchaseOrderId]);

        return array_map(static function (array $row): array {
            return [
                'id' => (int) ($row['id'] ?? 0),
                'itemId' => (int) ($row['item_id'] ?? 0),
                'itemSku' => (string) ($row['sku'] ?? ''),
                'itemName' => (string) ($row['item_name'] ?? ''),
                'quantity' => (float) ($row['quantity'] ?? 0),
                'unitCost' => (float) ($row['unit_cost'] ?? 0),
                'lineTotal' => (float) ($row['line_total'] ?? 0),
                'receivedQty' => (float) ($row['received_qty'] ?? 0),
            ];
        }, $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: []);
    }

    /** @param array<string, mixed> $row
     *  @return array<string, mixed>
     */
    private function formatPartRequirement(array $row): array
    {
        return [
            'id' => (int) ($row['id'] ?? 0),
            'bookingId' => (string) ($row['booking_id'] ?? ''),
            'inventoryItemId' => isset($row['inventory_item_id']) ? (int) $row['inventory_item_id'] : null,
            'inventorySku' => isset($row['inventory_sku']) ? (string) $row['inventory_sku'] : null,
            'inventoryName' => isset($row['inventory_name']) ? (string) $row['inventory_name'] : null,
            'partName' => (string) ($row['part_name'] ?? ''),
            'quantity' => (float) ($row['quantity'] ?? 0),
            'status' => (string) ($row['status'] ?? 'needed'),
            'supplierId' => isset($row['supplier_id']) ? (int) $row['supplier_id'] : null,
            'supplierName' => isset($row['supplier_name']) ? (string) $row['supplier_name'] : null,
            'poItemId' => isset($row['po_item_id']) ? (int) $row['po_item_id'] : null,
            'note' => (string) ($row['note'] ?? ''),
            'createdBy' => isset($row['created_by']) ? (int) $row['created_by'] : null,
            'createdAt' => (string) ($row['created_at'] ?? ''),
            'updatedAt' => (string) ($row['updated_at'] ?? ''),
        ];
    }

    /** @param array<string, mixed> $item */
    private function checkLowStockAlert(array $item): void
    {
        $itemId = (int) ($item['id'] ?? 0);
        if ($itemId <= 0) {
            return;
        }

        $qty = (float) ($item['qtyOnHand'] ?? 0);
        $reorderPoint = (float) ($item['reorderPoint'] ?? 0);
        $name = (string) ($item['name'] ?? 'Item');
        $sku = (string) ($item['sku'] ?? '');

        if ($qty > $reorderPoint) {
            $this->db->prepare('UPDATE inventory_reorder_alerts SET status = "resolved", resolved_at = NOW() WHERE item_id = :item_id AND status = "open"')
                ->execute([':item_id' => $itemId]);
            return;
        }

        $existsStmt = $this->db->prepare('SELECT id FROM inventory_reorder_alerts WHERE item_id = :item_id AND status = "open" LIMIT 1');
        $existsStmt->execute([':item_id' => $itemId]);
        if ($existsStmt->fetch()) {
            return;
        }

        $message = $name . ' (' . $sku . ') is low on stock: ' . $qty . ' left, reorder point is ' . $reorderPoint . '.';

        $insert = $this->db->prepare(
            'INSERT INTO inventory_reorder_alerts (item_id, status, qty_snapshot, reorder_point_snapshot, message)
             VALUES (:item_id, "open", :qty_snapshot, :reorder_point_snapshot, :message)'
        );
        $insert->execute([
            ':item_id' => $itemId,
            ':qty_snapshot' => $qty,
            ':reorder_point_snapshot' => $reorderPoint,
            ':message' => mb_substr($message, 0, 255),
        ]);

        (new NotificationJobQueueService())->dispatch('inventory_low_stock', [
            'itemId' => $itemId,
            'itemName' => $name,
            'sku' => $sku,
            'qtyOnHand' => $qty,
            'reorderPoint' => $reorderPoint,
            'message' => $message,
        ]);
    }

    private function generatePoNumber(): string
    {
        $date = date('Ymd');
        $prefix = 'PO-' . $date . '-';

        $stmt = $this->db->prepare(
            'SELECT po_number
             FROM purchase_orders
             WHERE po_number LIKE :prefix
             ORDER BY id DESC
             LIMIT 1'
        );
        $stmt->execute([':prefix' => $prefix . '%']);
        $last = $stmt->fetchColumn();

        $next = 1;
        if (is_string($last) && preg_match('/-(\d{3,})$/', $last, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return $prefix . str_pad((string) $next, 3, '0', STR_PAD_LEFT);
    }
}
