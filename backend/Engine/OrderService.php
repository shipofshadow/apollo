<?php

declare(strict_types=1);

/**
 * OrderService
 *
 * Handles checkout, stock deduction, and order tracking for products.
 */
class OrderService
{
    /** @var string[] */
    private const STATUSES = [
        'pending',
        'confirmed',
        'preparing',
        'ready_for_pickup',
        'out_for_delivery',
        'completed',
        'cancelled',
    ];

    /** @var array<string, string[]> */
    private const STATUS_TRANSITIONS = [
        'pending' => ['confirmed', 'cancelled'],
        'confirmed' => ['preparing', 'cancelled'],
        'preparing' => ['ready_for_pickup', 'out_for_delivery', 'cancelled'],
        'ready_for_pickup' => ['completed', 'cancelled'],
        'out_for_delivery' => ['completed', 'cancelled'],
        'completed' => [],
        'cancelled' => [],
    ];

    /** @var array<string, string[]> */
    private const FULFILLMENT_ALLOWED_STATUSES = [
        'courier' => ['pending', 'confirmed', 'preparing', 'out_for_delivery', 'completed', 'cancelled'],
        'walk_in' => ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'completed', 'cancelled'],
    ];

    /** @var string[] */
    private const PAYMENT_STATUSES = ['unpaid', 'paid', 'cod'];

    /**
     * Create an order and atomically deduct stock.
     *
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function create(array $data, ?int $userId = null): array
    {
        if (DB_NAME === '') {
            throw new RuntimeException('Orders require a database connection.', 503);
        }

        $items = $data['items'] ?? [];
        if (!is_array($items) || count($items) === 0) {
            throw new RuntimeException('At least one cart item is required.', 422);
        }

        $customerName  = trim((string) ($data['customerName'] ?? ''));
        $customerEmail = strtolower(trim((string) ($data['customerEmail'] ?? '')));
        $customerPhone = trim((string) ($data['customerPhone'] ?? ''));
        $fulfillment   = strtolower(trim((string) ($data['fulfillmentType'] ?? 'courier')));

        if ($customerName === '' || $customerEmail === '' || $customerPhone === '') {
            throw new RuntimeException('Customer name, email, and phone are required.', 422);
        }
        if (!filter_var($customerEmail, FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('Customer email is invalid.', 422);
        }
        if (!in_array($fulfillment, ['courier', 'walk_in'], true)) {
            throw new RuntimeException('Invalid fulfillment type.', 422);
        }

        $address = trim((string) ($data['deliveryAddress'] ?? ''));
        $city = trim((string) ($data['deliveryCity'] ?? ''));
        $province = trim((string) ($data['deliveryProvince'] ?? ''));
        $postalCode = trim((string) ($data['deliveryPostalCode'] ?? ''));
        if ($fulfillment === 'courier' && $address === '') {
            throw new RuntimeException('Delivery address is required for courier orders.', 422);
        }

        $shippingFee = max(0.0, (float) ($data['shippingFee'] ?? ($fulfillment === 'courier' ? 150 : 0)));
        $notes = trim((string) ($data['notes'] ?? ''));

        $db = Database::getInstance();
        $db->beginTransaction();

        try {
            $lineItems = [];
            $subtotal = 0.0;

            foreach ($items as $rawItem) {
                if (!is_array($rawItem)) {
                    throw new RuntimeException('Invalid cart item payload.', 422);
                }

                $productIdRaw = (string) ($rawItem['productId'] ?? '');
                if ($productIdRaw === '') {
                    throw new RuntimeException('Each item must include a productId.', 422);
                }
                $productId = (new ProductService())->resolveId($productIdRaw);

                $quantity = (int) ($rawItem['quantity'] ?? 1);
                if ($quantity < 1) {
                    throw new RuntimeException('Quantity must be at least 1.', 422);
                }

                $productRow = $this->dbLockProduct($productId);
                if ((int) ($productRow['is_active'] ?? 0) !== 1) {
                    throw new RuntimeException('One of the selected products is no longer available.', 409);
                }

                $variationId = isset($rawItem['variationId']) && $rawItem['variationId'] !== null
                    ? (int) $rawItem['variationId']
                    : null;

                $unitPrice = (float) ($productRow['price'] ?? 0);
                $variationName = '';
                $trackStock = (int) ($productRow['track_stock'] ?? 1) === 1;
                $stockQty = (int) ($productRow['stock_qty'] ?? 0);

                if ($variationId !== null) {
                    $variation = $this->dbLockVariation($productId, $variationId);
                    $variationName = (string) ($variation['name'] ?? '');
                    $variationPrice = trim((string) ($variation['price'] ?? ''));
                    if ($variationPrice !== '' && is_numeric($variationPrice)) {
                        $unitPrice = (float) $variationPrice;
                    }
                    $trackStock = (int) ($variation['track_stock'] ?? 1) === 1;
                    $stockQty = (int) ($variation['stock_qty'] ?? 0);
                }

                if ($trackStock && $stockQty < $quantity) {
                    throw new RuntimeException('Insufficient stock for one or more items.', 409);
                }

                if ($trackStock) {
                    if ($variationId !== null) {
                        $this->dbDeductVariationStock($variationId, $quantity);
                    } else {
                        $this->dbDeductProductStock($productId, $quantity);
                    }
                }

                $lineSubtotal = round($unitPrice * $quantity, 2);
                $subtotal += $lineSubtotal;

                $lineItems[] = [
                    'productId' => $productId,
                    'variationId' => $variationId,
                    'productName' => (string) ($productRow['name'] ?? ''),
                    'variationName' => $variationName,
                    'unitPrice' => $unitPrice,
                    'quantity' => $quantity,
                    'subtotal' => $lineSubtotal,
                ];
            }

            $orderNumber = $this->generateOrderNumber();
            $total = round($subtotal + $shippingFee, 2);

            $stmt = $db->prepare(
                'INSERT INTO product_orders
                 (order_number, user_id, customer_name, customer_email, customer_phone,
                  fulfillment_type, delivery_address, delivery_city, delivery_province, delivery_postal_code,
                  status, payment_status, courier_name, tracking_number, notes,
                  subtotal, shipping_fee, total_amount)
                 VALUES
                 (:order_number, :user_id, :customer_name, :customer_email, :customer_phone,
                  :fulfillment_type, :delivery_address, :delivery_city, :delivery_province, :delivery_postal_code,
                  "pending", :payment_status, "", "", :notes,
                  :subtotal, :shipping_fee, :total_amount)'
            );
            $stmt->execute([
                ':order_number' => $orderNumber,
                ':user_id' => $userId,
                ':customer_name' => $customerName,
                ':customer_email' => $customerEmail,
                ':customer_phone' => $customerPhone,
                ':fulfillment_type' => $fulfillment,
                ':delivery_address' => $address !== '' ? $address : null,
                ':delivery_city' => $city,
                ':delivery_province' => $province,
                ':delivery_postal_code' => $postalCode,
                ':payment_status' => $fulfillment === 'courier' ? 'unpaid' : 'cod',
                ':notes' => $notes !== '' ? $notes : null,
                ':subtotal' => number_format($subtotal, 2, '.', ''),
                ':shipping_fee' => number_format($shippingFee, 2, '.', ''),
                ':total_amount' => number_format($total, 2, '.', ''),
            ]);

            $orderId = (int) $db->lastInsertId();
            $itemStmt = $db->prepare(
                'INSERT INTO product_order_items
                 (order_id, product_id, variation_id, product_name, variation_name, unit_price, quantity, subtotal)
                 VALUES
                 (:order_id, :product_id, :variation_id, :product_name, :variation_name, :unit_price, :quantity, :subtotal)'
            );

            foreach ($lineItems as $line) {
                $itemStmt->execute([
                    ':order_id' => $orderId,
                    ':product_id' => $line['productId'],
                    ':variation_id' => $line['variationId'],
                    ':product_name' => $line['productName'],
                    ':variation_name' => $line['variationName'],
                    ':unit_price' => number_format((float) $line['unitPrice'], 2, '.', ''),
                    ':quantity' => $line['quantity'],
                    ':subtotal' => number_format((float) $line['subtotal'], 2, '.', ''),
                ]);
            }

            $db->commit();
            $order = $this->getById($orderId, $userId, $userId === null ? null : true);

            (new NotificationJobQueueService())->dispatch('order_created', [
                'order' => $order,
            ]);

            return $order;
        } catch (\Throwable $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            if ($e instanceof RuntimeException) {
                throw $e;
            }
            throw new RuntimeException('Failed to place order: ' . $e->getMessage(), 500, $e);
        }
    }

    /** @return array<int, array<string, mixed>> */
    public function listMine(int $userId): array
    {
        if (DB_NAME === '') {
            return [];
        }

        $stmt = Database::getInstance()->prepare(
            'SELECT * FROM product_orders WHERE user_id = :uid ORDER BY created_at DESC'
        );
        $stmt->execute([':uid' => $userId]);

        return array_map(fn ($row) => $this->mapOrderRow($row, $this->fetchItems((int) $row['id'])), $stmt->fetchAll());
    }

    /**
     * @param array<string, mixed> $filters
     * @return array{orders: array<int, array<string, mixed>>, total: int, page: int, pageSize: int}
     */
    public function listAll(array $filters = [], int $pageSize = 25, int $page = 1): array
    {
        if (DB_NAME === '') {
            return ['orders' => [], 'total' => 0, 'page' => 1, 'pageSize' => $pageSize];
        }

        $pageSize = max(1, min(100, $pageSize));
        $page     = max(1, $page);
        $offset   = ($page - 1) * $pageSize;

        $where = [];
        $params = [];

        $status = trim((string) ($filters['status'] ?? ''));
        if ($status !== '' && in_array($status, self::STATUSES, true)) {
            $where[] = 'status = :status';
            $params[':status'] = $status;
        }

        $paymentStatus = trim((string) ($filters['paymentStatus'] ?? ''));
        if ($paymentStatus !== '' && in_array($paymentStatus, self::PAYMENT_STATUSES, true)) {
            $where[] = 'payment_status = :payment_status';
            $params[':payment_status'] = $paymentStatus;
        }

        $fulfillmentType = trim((string) ($filters['fulfillmentType'] ?? ''));
        if ($fulfillmentType !== '' && in_array($fulfillmentType, ['courier', 'walk_in'], true)) {
            $where[] = 'fulfillment_type = :fulfillment_type';
            $params[':fulfillment_type'] = $fulfillmentType;
        }

        $query = trim((string) ($filters['query'] ?? ''));
        if ($query !== '') {
            $where[] = '(order_number LIKE :query OR customer_name LIKE :query OR customer_email LIKE :query OR customer_phone LIKE :query)';
            $params[':query'] = '%' . $query . '%';
        }

        $createdFrom = trim((string) ($filters['createdFrom'] ?? ''));
        if ($createdFrom !== '') {
            $where[] = 'DATE(created_at) >= :created_from';
            $params[':created_from'] = $createdFrom;
        }

        $createdTo = trim((string) ($filters['createdTo'] ?? ''));
        if ($createdTo !== '') {
            $where[] = 'DATE(created_at) <= :created_to';
            $params[':created_to'] = $createdTo;
        }

        $whereSql = empty($where) ? '' : ('WHERE ' . implode(' AND ', $where));
        $db = Database::getInstance();

        $countStmt = $db->prepare("SELECT COUNT(*) FROM product_orders {$whereSql}");
        $countStmt->execute($params);
        $total = (int) $countStmt->fetchColumn();

        $sql = "SELECT * FROM product_orders {$whereSql} ORDER BY created_at DESC LIMIT {$pageSize} OFFSET {$offset}";
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $orders = array_map(fn ($row) => $this->mapOrderRow($row, $this->fetchItems((int) $row['id'])), $stmt->fetchAll());

        return ['orders' => $orders, 'total' => $total, 'page' => $page, 'pageSize' => $pageSize];
    }

    /**
     * @return array<string, mixed>
     */
    public function getById(int $id, ?int $requestingUserId = null, ?bool $mustOwn = null): array
    {
        if (DB_NAME === '') {
            throw new RuntimeException('Orders require a database connection.', 503);
        }

        $stmt = Database::getInstance()->prepare('SELECT * FROM product_orders WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new RuntimeException('Order not found.', 404);
        }

        if ($mustOwn === true) {
            $ownerId = (int) ($row['user_id'] ?? 0);
            if ($requestingUserId === null || $ownerId !== $requestingUserId) {
                throw new RuntimeException('You are not authorized to view this order.', 403);
            }
        }

        return $this->mapOrderRow($row, $this->fetchItems((int) $row['id']));
    }

    /** @return array<string, mixed> */
    public function updateStatus(int $id, string $status): array
    {
        if (!in_array($status, self::STATUSES, true)) {
            throw new RuntimeException('Invalid order status.', 422);
        }

        $order = $this->getById($id);
        $currentStatus = (string) ($order['status'] ?? 'pending');
        $fulfillmentType = (string) ($order['fulfillmentType'] ?? 'courier');

        $allowedForFulfillment = self::FULFILLMENT_ALLOWED_STATUSES[$fulfillmentType] ?? self::FULFILLMENT_ALLOWED_STATUSES['courier'];
        if (!in_array($status, $allowedForFulfillment, true)) {
            throw new RuntimeException('This status is not valid for the selected fulfillment type.', 422);
        }

        if ($status === $currentStatus) {
            return $order;
        }

        $allowedNext = self::STATUS_TRANSITIONS[$currentStatus] ?? [];
        if (!in_array($status, $allowedNext, true)) {
            throw new RuntimeException('Invalid order status transition.', 422);
        }

        $stmt = Database::getInstance()->prepare(
            'UPDATE product_orders SET status = :status WHERE id = :id'
        );
        $stmt->execute([':status' => $status, ':id' => $id]);
        if ($stmt->rowCount() === 0) {
            throw new RuntimeException('Order not found.', 404);
        }

        $updated = $this->getById($id);

        (new NotificationJobQueueService())->dispatch('order_status_changed', [
            'order' => $updated,
            'previousStatus' => $currentStatus,
        ]);

        return $updated;
    }

    /** @return array<string, mixed> */
    public function updateTracking(int $id, string $courierName, string $trackingNumber): array
    {
        $stmt = Database::getInstance()->prepare(
            'UPDATE product_orders
             SET courier_name = :courier_name, tracking_number = :tracking_number
             WHERE id = :id'
        );
        $stmt->execute([
            ':courier_name' => trim($courierName),
            ':tracking_number' => trim($trackingNumber),
            ':id' => $id,
        ]);
        if ($stmt->rowCount() === 0) {
            throw new RuntimeException('Order not found.', 404);
        }

        $updated = $this->getById($id);

        (new NotificationJobQueueService())->dispatch('order_tracking_updated', [
            'order' => $updated,
        ]);

        return $updated;
    }

    /** @return array<string, mixed> */
    public function updatePaymentStatus(int $id, string $paymentStatus): array
    {
        $normalized = trim(strtolower($paymentStatus));
        if (!in_array($normalized, self::PAYMENT_STATUSES, true)) {
            throw new RuntimeException('Invalid payment status.', 422);
        }

        $stmt = Database::getInstance()->prepare(
            'UPDATE product_orders SET payment_status = :payment_status WHERE id = :id'
        );
        $stmt->execute([
            ':payment_status' => $normalized,
            ':id' => $id,
        ]);
        if ($stmt->rowCount() === 0) {
            throw new RuntimeException('Order not found.', 404);
        }

        return $this->getById($id);
    }

    /** @return array<string, mixed> */
    private function dbLockProduct(int $productId): array
    {
        $stmt = Database::getInstance()->prepare('SELECT * FROM products WHERE id = :id LIMIT 1 FOR UPDATE');
        $stmt->execute([':id' => $productId]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new RuntimeException('Product not found.', 404);
        }
        return $row;
    }

    /** @return array<string, mixed> */
    private function dbLockVariation(int $productId, int $variationId): array
    {
        $stmt = Database::getInstance()->prepare(
            'SELECT * FROM product_variations WHERE id = :id AND product_id = :product_id LIMIT 1 FOR UPDATE'
        );
        $stmt->execute([':id' => $variationId, ':product_id' => $productId]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new RuntimeException('Selected variation was not found.', 404);
        }
        return $row;
    }

    private function dbDeductProductStock(int $productId, int $qty): void
    {
        $stmt = Database::getInstance()->prepare(
            'UPDATE products SET stock_qty = stock_qty - :qty WHERE id = :id'
        );
        $stmt->execute([':qty' => $qty, ':id' => $productId]);
    }

    private function dbDeductVariationStock(int $variationId, int $qty): void
    {
        $stmt = Database::getInstance()->prepare(
            'UPDATE product_variations SET stock_qty = stock_qty - :qty WHERE id = :id'
        );
        $stmt->execute([':qty' => $qty, ':id' => $variationId]);
    }

    /** @return array<int, array<string, mixed>> */
    private function fetchItems(int $orderId): array
    {
        $stmt = Database::getInstance()->prepare(
            'SELECT * FROM product_order_items WHERE order_id = :order_id ORDER BY id ASC'
        );
        $stmt->execute([':order_id' => $orderId]);
        $rows = $stmt->fetchAll();

        return array_map(static function (array $row): array {
            return [
                'id' => (int) $row['id'],
                'productId' => (int) $row['product_id'],
                'variationId' => isset($row['variation_id']) && $row['variation_id'] !== null ? (int) $row['variation_id'] : null,
                'productName' => (string) ($row['product_name'] ?? ''),
                'variationName' => (string) ($row['variation_name'] ?? ''),
                'unitPrice' => (float) ($row['unit_price'] ?? 0),
                'quantity' => (int) ($row['quantity'] ?? 1),
                'subtotal' => (float) ($row['subtotal'] ?? 0),
            ];
        }, $rows);
    }

    /**
     * @param array<string, mixed> $row
     * @param array<int, array<string, mixed>> $items
     * @return array<string, mixed>
     */
    private function mapOrderRow(array $row, array $items): array
    {
        return [
            'id' => (int) $row['id'],
            'orderNumber' => (string) ($row['order_number'] ?? ''),
            'userId' => isset($row['user_id']) && $row['user_id'] !== null ? (int) $row['user_id'] : null,
            'customerName' => (string) ($row['customer_name'] ?? ''),
            'customerEmail' => (string) ($row['customer_email'] ?? ''),
            'customerPhone' => (string) ($row['customer_phone'] ?? ''),
            'fulfillmentType' => (string) ($row['fulfillment_type'] ?? 'courier'),
            'deliveryAddress' => isset($row['delivery_address']) ? (string) $row['delivery_address'] : null,
            'deliveryCity' => (string) ($row['delivery_city'] ?? ''),
            'deliveryProvince' => (string) ($row['delivery_province'] ?? ''),
            'deliveryPostalCode' => (string) ($row['delivery_postal_code'] ?? ''),
            'status' => (string) ($row['status'] ?? 'pending'),
            'paymentStatus' => (string) ($row['payment_status'] ?? 'unpaid'),
            'courierName' => (string) ($row['courier_name'] ?? ''),
            'trackingNumber' => (string) ($row['tracking_number'] ?? ''),
            'notes' => isset($row['notes']) ? (string) $row['notes'] : null,
            'subtotal' => (float) ($row['subtotal'] ?? 0),
            'shippingFee' => (float) ($row['shipping_fee'] ?? 0),
            'totalAmount' => (float) ($row['total_amount'] ?? 0),
            'createdAt' => (string) ($row['created_at'] ?? ''),
            'updatedAt' => (string) ($row['updated_at'] ?? ''),
            'items' => $items,
        ];
    }

    private function generateOrderNumber(): string
    {
        return 'ORD-' . date('Ymd') . '-' . strtoupper(bin2hex(random_bytes(3)));
    }
}
