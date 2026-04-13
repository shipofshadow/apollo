<?php

declare(strict_types=1);

class Customer360Service
{
    private \PDO $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /** @return array<string, mixed> */
    public function getByUserId(int $userId, int $limit = 25): array
    {
        if ($userId <= 0) {
            throw new RuntimeException('Invalid customer id.', 422);
        }

        $lim = max(5, min(100, $limit));

        $profile = $this->fetchProfile($userId);
        $vehicles = $this->fetchVehicles($userId, $lim);
        $bookings = $this->fetchBookings($userId, $lim);
        $orders = $this->fetchOrders($userId, $lim);
        $reviews = $this->fetchReviews($userId, $lim);
        $spend = $this->fetchSpend($userId);
        $communications = $this->fetchCommunications($userId, (string) ($profile['email'] ?? ''), $lim);

        return [
            'profile' => $profile,
            'vehicles' => $vehicles,
            'bookings' => $bookings,
            'orders' => $orders,
            'reviews' => $reviews,
            'spend' => $spend,
            'communications' => $communications,
        ];
    }

    /** @return array<string, mixed> */
    private function fetchProfile(int $userId): array
    {
        $stmt = $this->db->prepare(
            'SELECT id, name, email, phone, role, is_active, created_at
             FROM users
             WHERE id = :id AND role = "client"
             LIMIT 1'
        );
        $stmt->execute([':id' => $userId]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);

        if (!$row) {
            throw new RuntimeException('Customer not found.', 404);
        }

        return [
            'id' => (int) ($row['id'] ?? 0),
            'name' => (string) ($row['name'] ?? ''),
            'email' => (string) ($row['email'] ?? ''),
            'phone' => (string) ($row['phone'] ?? ''),
            'role' => (string) ($row['role'] ?? 'client'),
            'isActive' => ((int) ($row['is_active'] ?? 1)) === 1,
            'createdAt' => (string) ($row['created_at'] ?? ''),
        ];
    }

    /** @return array<int, array<string, mixed>> */
    private function fetchVehicles(int $userId, int $limit): array
    {
        $stmt = $this->db->prepare(
            'SELECT id, make, model, year, license_plate, vin, image_url, created_at, updated_at
             FROM client_vehicles
             WHERE user_id = :uid
             ORDER BY created_at DESC, id DESC
             LIMIT :lim'
        );
        $stmt->bindValue(':uid', $userId, \PDO::PARAM_INT);
        $stmt->bindValue(':lim', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];

        return array_map(static function (array $row): array {
            return [
                'id' => (int) ($row['id'] ?? 0),
                'make' => (string) ($row['make'] ?? ''),
                'model' => (string) ($row['model'] ?? ''),
                'year' => (string) ($row['year'] ?? ''),
                'licensePlate' => isset($row['license_plate']) ? (string) $row['license_plate'] : null,
                'vin' => isset($row['vin']) ? (string) $row['vin'] : null,
                'imageUrl' => isset($row['image_url']) ? (string) $row['image_url'] : null,
                'createdAt' => (string) ($row['created_at'] ?? ''),
                'updatedAt' => (string) ($row['updated_at'] ?? ''),
            ];
        }, $rows);
    }

    /** @return array<int, array<string, mixed>> */
    private function fetchBookings(int $userId, int $limit): array
    {
        $stmt = $this->db->prepare(
            'SELECT b.id,
                    b.reference_number,
                    COALESCE(s.title, "Service") AS service_name,
                    b.appointment_date,
                    b.appointment_time,
                    b.status,
                    b.created_at,
                    b.updated_at
             FROM bookings b
             LEFT JOIN services s ON s.id = b.service_id
             WHERE b.user_id = :uid
             ORDER BY b.created_at DESC
             LIMIT :lim'
        );
        $stmt->bindValue(':uid', $userId, \PDO::PARAM_INT);
        $stmt->bindValue(':lim', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];

        return array_map(static function (array $row): array {
            return [
                'id' => (string) ($row['id'] ?? ''),
                'referenceNumber' => isset($row['reference_number']) ? (string) $row['reference_number'] : null,
                'serviceName' => (string) ($row['service_name'] ?? ''),
                'appointmentDate' => (string) ($row['appointment_date'] ?? ''),
                'appointmentTime' => (string) ($row['appointment_time'] ?? ''),
                'status' => (string) ($row['status'] ?? ''),
                'createdAt' => (string) ($row['created_at'] ?? ''),
                'updatedAt' => (string) ($row['updated_at'] ?? ''),
            ];
        }, $rows);
    }

    /** @return array<int, array<string, mixed>> */
    private function fetchOrders(int $userId, int $limit): array
    {
        $stmt = $this->db->prepare(
            'SELECT id, order_number, status, payment_status, total_amount, created_at, updated_at
             FROM product_orders
             WHERE user_id = :uid
             ORDER BY created_at DESC
             LIMIT :lim'
        );
        $stmt->bindValue(':uid', $userId, \PDO::PARAM_INT);
        $stmt->bindValue(':lim', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];

        return array_map(static function (array $row): array {
            return [
                'id' => (int) ($row['id'] ?? 0),
                'orderNumber' => (string) ($row['order_number'] ?? ''),
                'status' => (string) ($row['status'] ?? ''),
                'paymentStatus' => (string) ($row['payment_status'] ?? ''),
                'totalAmount' => (float) ($row['total_amount'] ?? 0),
                'createdAt' => (string) ($row['created_at'] ?? ''),
                'updatedAt' => (string) ($row['updated_at'] ?? ''),
            ];
        }, $rows);
    }

    /** @return array<int, array<string, mixed>> */
    private function fetchReviews(int $userId, int $limit): array
    {
        $stmt = $this->db->prepare(
            'SELECT r.id, r.booking_id, r.rating, r.review, r.is_approved, r.created_at,
                    COALESCE(s.title, "Service") AS service_name,
                    b.vehicle_info
             FROM booking_reviews r
             JOIN bookings b ON b.id = r.booking_id
             LEFT JOIN services s ON s.id = b.service_id
             WHERE r.user_id = :uid
             ORDER BY r.created_at DESC
             LIMIT :lim'
        );
        $stmt->bindValue(':uid', $userId, \PDO::PARAM_INT);
        $stmt->bindValue(':lim', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];

        return array_map(static function (array $row): array {
            return [
                'id' => (int) ($row['id'] ?? 0),
                'bookingId' => (string) ($row['booking_id'] ?? ''),
                'serviceName' => (string) ($row['service_name'] ?? ''),
                'vehicleInfo' => (string) ($row['vehicle_info'] ?? ''),
                'rating' => (int) ($row['rating'] ?? 0),
                'review' => isset($row['review']) ? (string) $row['review'] : null,
                'isApproved' => ((int) ($row['is_approved'] ?? 0)) === 1,
                'createdAt' => (string) ($row['created_at'] ?? ''),
            ];
        }, $rows);
    }

    /** @return array<string, mixed> */
    private function fetchSpend(int $userId): array
    {
        $bookingsStmt = $this->db->prepare(
            'SELECT
                COUNT(*) AS total_bookings,
                SUM(CASE WHEN status = "completed" THEN 1 ELSE 0 END) AS completed_bookings,
                SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END) AS bookings_30d,
                SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY) THEN 1 ELSE 0 END) AS bookings_90d
             FROM bookings
             WHERE user_id = :uid'
        );
        $bookingsStmt->execute([':uid' => $userId]);
        $bookingRow = $bookingsStmt->fetch(\PDO::FETCH_ASSOC) ?: [];

        $ordersStmt = $this->db->prepare(
            'SELECT
                COUNT(*) AS total_orders,
                COALESCE(SUM(total_amount), 0) AS lifetime_spend,
                COALESCE(SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN total_amount ELSE 0 END), 0) AS spend_30d,
                COALESCE(SUM(CASE WHEN created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY) THEN total_amount ELSE 0 END), 0) AS spend_90d,
                COALESCE(AVG(total_amount), 0) AS avg_order_value
             FROM product_orders
             WHERE user_id = :uid'
        );
        $ordersStmt->execute([':uid' => $userId]);
        $orderRow = $ordersStmt->fetch(\PDO::FETCH_ASSOC) ?: [];

        return [
            'lifetimeSpend' => (float) ($orderRow['lifetime_spend'] ?? 0),
            'spend30d' => (float) ($orderRow['spend_30d'] ?? 0),
            'spend90d' => (float) ($orderRow['spend_90d'] ?? 0),
            'avgOrderValue' => (float) ($orderRow['avg_order_value'] ?? 0),
            'totalOrders' => (int) ($orderRow['total_orders'] ?? 0),
            'totalBookings' => (int) ($bookingRow['total_bookings'] ?? 0),
            'completedBookings' => (int) ($bookingRow['completed_bookings'] ?? 0),
            'bookings30d' => (int) ($bookingRow['bookings_30d'] ?? 0),
            'bookings90d' => (int) ($bookingRow['bookings_90d'] ?? 0),
        ];
    }

    /** @return array<int, array<string, mixed>> */
    private function fetchCommunications(int $userId, string $email, int $limit): array
    {
        $events = [];

        $stmt = $this->db->prepare(
            'SELECT id, type, title, message, is_read, created_at
             FROM notifications
             WHERE user_id = :uid
             ORDER BY created_at DESC
             LIMIT :lim'
        );
        $stmt->bindValue(':uid', $userId, \PDO::PARAM_INT);
        $stmt->bindValue(':lim', $limit, \PDO::PARAM_INT);
        $stmt->execute();
        foreach (($stmt->fetchAll(\PDO::FETCH_ASSOC) ?: []) as $row) {
            $events[] = [
                'source' => 'inapp',
                'event' => (string) ($row['type'] ?? ''),
                'title' => (string) ($row['title'] ?? ''),
                'message' => (string) ($row['message'] ?? ''),
                'status' => ((int) ($row['is_read'] ?? 0)) === 1 ? 'read' : 'unread',
                'createdAt' => (string) ($row['created_at'] ?? ''),
            ];
        }

        if ($email !== '') {
            $jobs = $this->db->prepare(
                'SELECT event, status, created_at, processed_at
                 FROM notification_jobs
                 WHERE payload LIKE :emailLike
                 ORDER BY created_at DESC
                 LIMIT :lim'
            );
            $jobs->bindValue(':emailLike', '%"' . $email . '"%', \PDO::PARAM_STR);
            $jobs->bindValue(':lim', $limit, \PDO::PARAM_INT);
            $jobs->execute();
            foreach (($jobs->fetchAll(\PDO::FETCH_ASSOC) ?: []) as $row) {
                $events[] = [
                    'source' => 'queue',
                    'event' => (string) ($row['event'] ?? ''),
                    'title' => 'Queued notification',
                    'message' => 'Delivery status: ' . (string) ($row['status'] ?? 'queued'),
                    'status' => (string) ($row['status'] ?? 'queued'),
                    'createdAt' => (string) ($row['processed_at'] ?? $row['created_at'] ?? ''),
                ];
            }
        }

        usort($events, static function (array $a, array $b): int {
            return strcmp((string) ($b['createdAt'] ?? ''), (string) ($a['createdAt'] ?? ''));
        });

        return array_slice($events, 0, $limit);
    }
}
