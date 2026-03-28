<?php

declare(strict_types=1);

/**
 * OfferService
 *
 * Full CRUD for the offers table.
 * When DB_NAME is empty it falls back to backend/storage/offers.json.
 *
 * Public-facing endpoints return only active offers (is_active = 1).
 * Admin endpoints return all offers.
 *
 * Requires migration 022_create_offers.sql to have been run.
 */
class OfferService
{
    private bool   $useDb;
    private static string $storageFile = __DIR__ . '/../storage/offers.json';

    public function __construct()
    {
        $this->useDb = DB_NAME !== '';
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * All offers ordered by sort_order, id.
     *
     * @return array<int, array<string, mixed>>
     */
    public function getAll(bool $includeInactive = false): array
    {
        return $this->useDb
            ? $this->dbGetAll($includeInactive)
            : $this->fileGetAll($includeInactive);
    }

    /**
     * Single offer by ID.
     *
     * @return array<string, mixed>
     */
    public function getById(int $id, bool $requireActive = true): array
    {
        return $this->useDb
            ? $this->dbGetById($id, $requireActive)
            : $this->fileGetById($id, $requireActive);
    }

    /**
     * Create a new offer. Returns the created record.
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
     * Update an existing offer. Returns the updated record.
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
     * Hard-delete an offer.
     */
    public function delete(int $id): void
    {
        $this->useDb ? $this->dbDelete($id) : $this->fileDelete($id);
    }

    // -------------------------------------------------------------------------
    // DB – read
    // -------------------------------------------------------------------------

    /** @return array<int, array<string, mixed>> */
    private function dbGetAll(bool $includeInactive): array
    {
        $where = $includeInactive ? '' : 'WHERE is_active = 1 ';
        $stmt  = Database::getInstance()->query(
            "SELECT * FROM offers {$where}ORDER BY sort_order ASC, id ASC"
        );
        return array_map([$this, 'mapRow'], $stmt->fetchAll());
    }

    /** @return array<string, mixed> */
    private function dbGetById(int $id, bool $requireActive): array
    {
        $cond = $requireActive ? 'AND is_active = 1' : '';
        $stmt = Database::getInstance()->prepare(
            "SELECT * FROM offers WHERE id = :id $cond LIMIT 1"
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new RuntimeException('Offer not found.', 404);
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
            'INSERT INTO offers
             (title, subtitle, description, badge_text, cta_text, cta_url,
              linked_service_id, linked_product_id, sort_order, is_active)
             VALUES
             (:title, :subtitle, :description, :badge_text, :cta_text, :cta_url,
              :linked_service_id, :linked_product_id, :sort_order, :is_active)'
        );
        $stmt->execute($this->bindParams($data));
        return $this->dbGetById((int) $db->lastInsertId(), false);
    }

    /** @param array<string, mixed> $data @return array<string, mixed> */
    private function dbUpdate(int $id, array $data): array
    {
        $current = $this->dbGetById($id, false);

        $merged = array_merge([
            'title'           => $current['title'],
            'subtitle'        => $current['subtitle'],
            'description'     => $current['description'],
            'badgeText'       => $current['badgeText'],
            'ctaText'         => $current['ctaText'],
            'ctaUrl'          => $current['ctaUrl'],
            'linkedServiceId' => $current['linkedServiceId'],
            'linkedProductId' => $current['linkedProductId'],
            'sortOrder'       => $current['sortOrder'],
            'isActive'        => $current['isActive'],
        ], $data);

        $stmt = Database::getInstance()->prepare(
            'UPDATE offers SET
               title             = :title,
               subtitle          = :subtitle,
               description       = :description,
               badge_text        = :badge_text,
               cta_text          = :cta_text,
               cta_url           = :cta_url,
               linked_service_id = :linked_service_id,
               linked_product_id = :linked_product_id,
               sort_order        = :sort_order,
               is_active         = :is_active
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
            'DELETE FROM offers WHERE id = :id'
        );
        $stmt->execute([':id' => $id]);
        if ($stmt->rowCount() === 0) {
            throw new RuntimeException('Offer not found.', 404);
        }
    }

    // -------------------------------------------------------------------------
    // File storage – fallback
    // -------------------------------------------------------------------------

    /** @return array<int, array<string, mixed>> */
    private function fileGetAll(bool $includeInactive): array
    {
        $all = $this->fileRead();
        if (!$includeInactive) {
            $all = array_values(array_filter($all, fn ($o) => (bool) ($o['isActive'] ?? true)));
        }
        usort($all, fn ($a, $b) => ($a['sortOrder'] ?? 0) <=> ($b['sortOrder'] ?? 0));
        return $all;
    }

    /** @return array<string, mixed> */
    private function fileGetById(int $id, bool $requireActive): array
    {
        foreach ($this->fileRead() as $o) {
            if ((int) ($o['id'] ?? 0) === $id) {
                if ($requireActive && !($o['isActive'] ?? true)) {
                    throw new RuntimeException('Offer not found.', 404);
                }
                return $o;
            }
        }
        throw new RuntimeException('Offer not found.', 404);
    }

    /** @param array<string, mixed> $data @return array<string, mixed> */
    private function fileCreate(array $data): array
    {
        $all = $this->fileRead();
        $ids = array_filter(array_column($all, 'id'), fn ($v) => is_numeric($v));
        $id  = empty($ids) ? 1 : (int) max($ids) + 1;

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

        foreach ($all as &$o) {
            if ((int) ($o['id'] ?? 0) === $id) {
                $o      = $this->buildRecord($id, array_merge($o, $data));
                $result = $o;
                $found  = true;
                break;
            }
        }
        unset($o);

        if (!$found) throw new RuntimeException('Offer not found.', 404);
        $this->fileWrite($all);
        return $result;
    }

    private function fileDelete(int $id): void
    {
        $all      = $this->fileRead();
        $filtered = array_values(array_filter($all, fn ($o) => (int) ($o['id'] ?? 0) !== $id));
        if (count($filtered) === count($all)) {
            throw new RuntimeException('Offer not found.', 404);
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
            'id'              => (int)   $row['id'],
            'title'           =>         $row['title'],
            'subtitle'        =>         $row['subtitle'],
            'description'     =>         $row['description'],
            'badgeText'       =>         $row['badge_text'],
            'ctaText'         =>         $row['cta_text'],
            'ctaUrl'          =>         $row['cta_url'],
            'linkedServiceId' => isset($row['linked_service_id']) && $row['linked_service_id'] !== null
                                    ? (int) $row['linked_service_id'] : null,
            'linkedProductId' => isset($row['linked_product_id']) && $row['linked_product_id'] !== null
                                    ? (int) $row['linked_product_id'] : null,
            'isActive'        => (bool)  $row['is_active'],
            'sortOrder'       => (int)   $row['sort_order'],
            'createdAt'       =>         $row['created_at'],
            'updatedAt'       =>         $row['updated_at'],
        ];
    }

    /** @return array<string, mixed> */
    private function bindParams(array $data): array
    {
        $linkedServiceId = $data['linkedServiceId'] ?? ($data['linked_service_id'] ?? null);
        $linkedProductId = $data['linkedProductId'] ?? ($data['linked_product_id'] ?? null);

        return [
            ':title'             => $data['title']       ?? '',
            ':subtitle'          => $data['subtitle']    ?? '',
            ':description'       => $data['description'] ?? '',
            ':badge_text'        => $data['badgeText']   ?? ($data['badge_text'] ?? 'Limited Time Offer'),
            ':cta_text'          => $data['ctaText']     ?? ($data['cta_text']   ?? 'Claim Your Offer'),
            ':cta_url'           => $data['ctaUrl']      ?? ($data['cta_url']    ?? '#contact'),
            ':linked_service_id' => $linkedServiceId !== null && $linkedServiceId !== '' ? (int) $linkedServiceId : null,
            ':linked_product_id' => $linkedProductId !== null && $linkedProductId !== '' ? (int) $linkedProductId : null,
            ':sort_order'        => (int)  ($data['sortOrder'] ?? ($data['sort_order'] ?? 0)),
            ':is_active'         => (int)  ($data['isActive']  ?? ($data['is_active']  ?? 1)),
        ];
    }

    /** Build a camelCase record for file storage. @return array<string, mixed> */
    private function buildRecord(int $id, array $data): array
    {
        $linkedServiceId = $data['linkedServiceId'] ?? ($data['linked_service_id'] ?? null);
        $linkedProductId = $data['linkedProductId'] ?? ($data['linked_product_id'] ?? null);

        return [
            'id'              => $id,
            'title'           => $data['title']       ?? '',
            'subtitle'        => $data['subtitle']    ?? '',
            'description'     => $data['description'] ?? '',
            'badgeText'       => $data['badgeText']   ?? ($data['badge_text'] ?? 'Limited Time Offer'),
            'ctaText'         => $data['ctaText']     ?? ($data['cta_text']   ?? 'Claim Your Offer'),
            'ctaUrl'          => $data['ctaUrl']      ?? ($data['cta_url']    ?? '#contact'),
            'linkedServiceId' => $linkedServiceId !== null && $linkedServiceId !== '' ? (int) $linkedServiceId : null,
            'linkedProductId' => $linkedProductId !== null && $linkedProductId !== '' ? (int) $linkedProductId : null,
            'isActive'        => (bool) ($data['isActive'] ?? ($data['is_active'] ?? true)),
            'sortOrder'       => (int)  ($data['sortOrder'] ?? ($data['sort_order'] ?? 0)),
            'createdAt'       => $data['createdAt'] ?? date('c'),
            'updatedAt'       => date('c'),
        ];
    }

    /** @param array<string, mixed> $data */
    private function validatePayload(array $data): void
    {
        if (empty(trim($data['title'] ?? ''))) {
            throw new RuntimeException('Offer title is required.', 422);
        }
    }
}
