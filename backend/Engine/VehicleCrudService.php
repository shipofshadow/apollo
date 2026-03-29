<?php

declare(strict_types=1);

/**
 * CRUD operations for vehicles saved by a client.
 */
class VehicleCrudService
{
    private \PDO $db;

    public function __construct()
    {
        if (DB_NAME === '') {
            throw new RuntimeException('Database is not configured. Please set DB_NAME in .env.', 503);
        }
        $this->db = Database::getInstance();
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function getByUserId(int $userId): array
    {
        $stmt = $this->db->prepare(
            'SELECT * FROM client_vehicles WHERE user_id = :user_id ORDER BY created_at DESC, id DESC'
        );
        $stmt->execute([':user_id' => $userId]);

        return array_map([$this, 'mapRow'], $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: []);
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function create(int $userId, array $data): array
    {
        $payload = $this->normalizePayload($data);

        $stmt = $this->db->prepare(
            'INSERT INTO client_vehicles (user_id, make, model, year, image_url, vin, license_plate)
             VALUES (:user_id, :make, :model, :year, :image_url, :vin, :license_plate)'
        );
        $stmt->execute([
            ':user_id'       => $userId,
            ':make'          => $payload['make'],
            ':model'         => $payload['model'],
            ':year'          => $payload['year'],
            ':image_url'     => $payload['imageUrl'],
            ':vin'           => $payload['vin'],
            ':license_plate' => $payload['licensePlate'],
        ]);

        return $this->getById((int) $this->db->lastInsertId(), $userId);
    }

    /**
     * @param array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function update(int $id, int $userId, array $data): array
    {
        $current = $this->getById($id, $userId);
        $payload = $this->normalizePayload($data);

        $stmt = $this->db->prepare(
            'UPDATE client_vehicles
             SET make = :make, model = :model, year = :year, image_url = :image_url, vin = :vin, license_plate = :license_plate
             WHERE id = :id AND user_id = :user_id'
        );
        $stmt->execute([
            ':id'            => $id,
            ':user_id'       => $userId,
            ':make'          => $payload['make'],
            ':model'         => $payload['model'],
            ':year'          => $payload['year'],
            ':image_url'     => $payload['imageUrl'],
            ':vin'           => $payload['vin'],
            ':license_plate' => $payload['licensePlate'],
        ]);

        $oldImage = (string) ($current['imageUrl'] ?? '');
        $newImage = (string) ($payload['imageUrl'] ?? '');
        if ($oldImage !== '' && $oldImage !== $newImage) {
            $this->deleteManagedImageUrl($oldImage);
        }

        return $this->getById($id, $userId);
    }

    public function delete(int $id, int $userId): void
    {
        $current = $this->getById($id, $userId);

        $stmt = $this->db->prepare('DELETE FROM client_vehicles WHERE id = :id AND user_id = :user_id');
        $stmt->execute([':id' => $id, ':user_id' => $userId]);

        if ($stmt->rowCount() === 0) {
            throw new RuntimeException('Vehicle not found.', 404);
        }

        $oldImage = (string) ($current['imageUrl'] ?? '');
        if ($oldImage !== '') {
            $this->deleteManagedImageUrl($oldImage);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function getById(int $id, int $userId): array
    {
        $stmt = $this->db->prepare('SELECT * FROM client_vehicles WHERE id = :id AND user_id = :user_id LIMIT 1');
        $stmt->execute([':id' => $id, ':user_id' => $userId]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);

        if (!$row) {
            throw new RuntimeException('Vehicle not found.', 404);
        }

        return $this->mapRow($row);
    }

    /**
     * @param array<string, mixed> $data
      * @return array{make: string, model: string, year: string, imageUrl: ?string, vin: ?string, licensePlate: ?string}
     */
    private function normalizePayload(array $data): array
    {
        $make  = trim((string) ($data['make'] ?? ''));
        $model = trim((string) ($data['model'] ?? ''));
        $year  = trim((string) ($data['year'] ?? ''));
          $image = trim((string) ($data['imageUrl'] ?? ($data['image_url'] ?? '')));
        $vin   = trim((string) ($data['vin'] ?? ''));
        $plate = trim((string) ($data['licensePlate'] ?? ($data['license_plate'] ?? '')));

        if ($make === '' || $model === '' || $year === '') {
            throw new RuntimeException('make, model, and year are required.', 422);
        }

        if (mb_strlen($year) > 10 || !preg_match('/^\d{4}$/', $year)) {
            throw new RuntimeException('year must be a 4-digit value.', 422);
        }

        return [
            'make'         => mb_substr($make, 0, 120),
            'model'        => mb_substr($model, 0, 120),
            'year'         => $year,
            'imageUrl'     => $image !== '' ? mb_substr($image, 0, 255) : null,
            'vin'          => $vin !== '' ? mb_substr($vin, 0, 64) : null,
            'licensePlate' => $plate !== '' ? mb_substr($plate, 0, 32) : null,
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapRow(array $row): array
    {
        return [
            'id'           => (int) $row['id'],
            'userId'       => (int) $row['user_id'],
            'make'         => (string) $row['make'],
            'model'        => (string) $row['model'],
            'year'         => (string) $row['year'],
            'imageUrl'     => $row['image_url'] !== null ? (string) $row['image_url'] : null,
            'vin'          => $row['vin'] !== null ? (string) $row['vin'] : null,
            'licensePlate' => $row['license_plate'] !== null ? (string) $row['license_plate'] : null,
            'createdAt'    => (string) $row['created_at'],
            'updatedAt'    => (string) $row['updated_at'],
        ];
    }

    private function deleteManagedImageUrl(string $url): void
    {
        try {
            (new UploadStorage())->deleteByUrl($url);
        } catch (\Throwable) {
            // Ignore cleanup failures; main CRUD operation already succeeded.
        }
    }
}
