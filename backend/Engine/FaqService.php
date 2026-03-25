<?php

declare(strict_types=1);

/**
 * FaqService
 *
 * Full CRUD for the faqs table.
 * Falls back to backend/storage/faqs.json when DB is not configured.
 *
 * Requires migration 015_create_faqs.sql to have been run.
 */
class FaqService
{
    private bool $useDb;
    private static string $storageFile = __DIR__ . '/../storage/faqs.json';

    public function __construct()
    {
        $this->useDb = DB_NAME !== '';
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /** @return array<int, array<string, mixed>> */
    public function getAll(bool $activeOnly = false): array
    {
        return $this->useDb
            ? $this->dbGetAll($activeOnly)
            : $this->fileGetAll($activeOnly);
    }

    /** @return array<string, mixed> */
    public function getById(int $id): array
    {
        return $this->useDb ? $this->dbGetById($id) : $this->fileGetById($id);
    }

    /** @return array<string, mixed> */
    public function create(array $data): array
    {
        $this->validatePayload($data);
        return $this->useDb ? $this->dbCreate($data) : $this->fileCreate($data);
    }

    /** @return array<string, mixed> */
    public function update(int $id, array $data): array
    {
        return $this->useDb ? $this->dbUpdate($id, $data) : $this->fileUpdate($id, $data);
    }

    public function delete(int $id): void
    {
        $this->useDb ? $this->dbDelete($id) : $this->fileDelete($id);
    }

    // -------------------------------------------------------------------------
    // DB
    // -------------------------------------------------------------------------

    /** @return array<int, array<string, mixed>> */
    private function dbGetAll(bool $activeOnly): array
    {
        $where = $activeOnly ? 'WHERE is_active = 1 ' : '';
        $stmt  = Database::getInstance()->query(
            "SELECT * FROM faqs {$where}ORDER BY sort_order ASC, id ASC"
        );
        return array_map([$this, 'mapRow'], $stmt->fetchAll());
    }

    /** @return array<string, mixed> */
    private function dbGetById(int $id): array
    {
        $stmt = Database::getInstance()->prepare(
            'SELECT * FROM faqs WHERE id = :id LIMIT 1'
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new RuntimeException('FAQ not found.', 404);
        }
        return $this->mapRow($row);
    }

    /** @return array<string, mixed> */
    private function dbCreate(array $data): array
    {
        $db   = Database::getInstance();
        $stmt = $db->prepare(
            'INSERT INTO faqs (question, answer, category, sort_order, is_active)
             VALUES (:question, :answer, :category, :sort_order, :is_active)'
        );
        $stmt->execute($this->bindParams($data));
        return $this->dbGetById((int) $db->lastInsertId());
    }

    /** @return array<string, mixed> */
    private function dbUpdate(int $id, array $data): array
    {
        $current = $this->dbGetById($id);
        $merged  = array_merge($current, $data);

        $stmt = Database::getInstance()->prepare(
            'UPDATE faqs SET question = :question, answer = :answer,
             category = :category, sort_order = :sort_order, is_active = :is_active
             WHERE id = :id'
        );
        $params        = $this->bindParams($merged);
        $params[':id'] = $id;
        $stmt->execute($params);
        return $this->dbGetById($id);
    }

    private function dbDelete(int $id): void
    {
        $stmt = Database::getInstance()->prepare(
            'DELETE FROM faqs WHERE id = :id'
        );
        $stmt->execute([':id' => $id]);
        if ($stmt->rowCount() === 0) {
            throw new RuntimeException('FAQ not found.', 404);
        }
    }

    // -------------------------------------------------------------------------
    // File storage – fallback
    // -------------------------------------------------------------------------

    /** @return array<int, array<string, mixed>> */
    private function fileGetAll(bool $activeOnly): array
    {
        $all = $this->fileRead();
        if ($activeOnly) {
            $all = array_values(array_filter($all, fn ($f) => (bool) ($f['isActive'] ?? true)));
        }
        usort($all, fn ($a, $b) => (int) ($a['sortOrder'] ?? 0) <=> (int) ($b['sortOrder'] ?? 0));
        return $all;
    }

    /** @return array<string, mixed> */
    private function fileGetById(int $id): array
    {
        foreach ($this->fileRead() as $f) {
            if ((int) ($f['id'] ?? 0) === $id) {
                return $f;
            }
        }
        throw new RuntimeException('FAQ not found.', 404);
    }

    /** @return array<string, mixed> */
    private function fileCreate(array $data): array
    {
        $all    = $this->fileRead();
        $id     = empty($all) ? 1 : (int) max(array_column($all, 'id')) + 1;
        $record = $this->buildRecord($id, $data);
        $all[]  = $record;
        $this->fileWrite($all);
        return $record;
    }

    /** @return array<string, mixed> */
    private function fileUpdate(int $id, array $data): array
    {
        $all    = $this->fileRead();
        $found  = false;
        $result = null;

        foreach ($all as &$f) {
            if ((int) ($f['id'] ?? 0) === $id) {
                $f      = $this->buildRecord($id, array_merge($f, $data));
                $result = $f;
                $found  = true;
                break;
            }
        }
        unset($f);

        if (!$found) {
            throw new RuntimeException('FAQ not found.', 404);
        }
        $this->fileWrite($all);
        return $result;
    }

    private function fileDelete(int $id): void
    {
        $all      = $this->fileRead();
        $filtered = array_values(array_filter($all, fn ($f) => (int) ($f['id'] ?? 0) !== $id));
        if (count($filtered) === count($all)) {
            throw new RuntimeException('FAQ not found.', 404);
        }
        $this->fileWrite($filtered);
    }

    /** @return array<int, array<string, mixed>> */
    private function fileRead(): array
    {
        if (!file_exists(self::$storageFile)) {
            return $this->defaultFaqs();
        }
        $raw = file_get_contents(self::$storageFile);
        if ($raw === false) {
            return $this->defaultFaqs();
        }
        $data = json_decode($raw, true);
        return is_array($data) ? $data : $this->defaultFaqs();
    }

    /** @param array<int, array<string, mixed>> $data */
    private function fileWrite(array $data): void
    {
        $dir = dirname(self::$storageFile);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        file_put_contents(
            self::$storageFile,
            json_encode(array_values($data), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /** @param array<string, mixed> $row @return array<string, mixed> */
    private function mapRow(array $row): array
    {
        return [
            'id'        => (int) $row['id'],
            'question'  => $row['question'],
            'answer'    => $row['answer'],
            'category'  => $row['category'] ?? 'General',
            'sortOrder' => (int) ($row['sort_order'] ?? 0),
            'isActive'  => (bool) ($row['is_active'] ?? true),
            'createdAt' => $row['created_at'],
            'updatedAt' => $row['updated_at'],
        ];
    }

    /** @return array<string, mixed> */
    private function bindParams(array $data): array
    {
        return [
            ':question'   => $data['question']  ?? '',
            ':answer'     => $data['answer']     ?? '',
            ':category'   => $data['category']   ?? 'General',
            ':sort_order' => (int) ($data['sortOrder'] ?? $data['sort_order'] ?? 0),
            ':is_active'  => (int) (isset($data['isActive']) ? (bool) $data['isActive'] : true),
        ];
    }

    /** @return array<string, mixed> */
    private function buildRecord(int $id, array $data): array
    {
        return [
            'id'        => $id,
            'question'  => $data['question']  ?? '',
            'answer'    => $data['answer']     ?? '',
            'category'  => $data['category']  ?? 'General',
            'sortOrder' => (int) ($data['sortOrder'] ?? 0),
            'isActive'  => isset($data['isActive']) ? (bool) $data['isActive'] : true,
            'createdAt' => $data['createdAt'] ?? date('c'),
            'updatedAt' => date('c'),
        ];
    }

    private function validatePayload(array $data): void
    {
        if (empty(trim($data['question'] ?? ''))) {
            throw new RuntimeException('FAQ question is required.', 422);
        }
        if (empty(trim($data['answer'] ?? ''))) {
            throw new RuntimeException('FAQ answer is required.', 422);
        }
    }

    /** @return array<int, array<string, mixed>> */
    private function defaultFaqs(): array
    {
        $now = date('c');
        return [
            ['id' => 1, 'question' => 'What services does 1625 Autolab offer?',
             'answer' => 'We specialize in headlight retrofits, Android headunits, advanced security systems, and aesthetic upgrades including custom grilles, ambient lighting, and vinyl wraps.',
             'category' => 'General', 'sortOrder' => 0, 'isActive' => true, 'createdAt' => $now, 'updatedAt' => $now],
            ['id' => 2, 'question' => 'How long does a headlight retrofit take?',
             'answer' => 'A standard headlight retrofit typically takes 4–6 hours depending on the vehicle and complexity of the build.',
             'category' => 'Services', 'sortOrder' => 1, 'isActive' => true, 'createdAt' => $now, 'updatedAt' => $now],
            ['id' => 3, 'question' => 'Do you offer a warranty on your work?',
             'answer' => 'Yes, all our installations come with a workmanship warranty. Parts warranties vary by manufacturer. Contact us for specific warranty details.',
             'category' => 'General', 'sortOrder' => 2, 'isActive' => true, 'createdAt' => $now, 'updatedAt' => $now],
            ['id' => 4, 'question' => 'How do I book an appointment?',
             'answer' => 'You can book an appointment directly through our website using the Book Appointment button, or call us at 0939 330 8263.',
             'category' => 'Booking', 'sortOrder' => 3, 'isActive' => true, 'createdAt' => $now, 'updatedAt' => $now],
            ['id' => 5, 'question' => 'What payment methods do you accept?',
             'answer' => 'We accept cash, bank transfer, and major e-wallets (GCash, Maya). Payment details will be confirmed upon booking.',
             'category' => 'Billing', 'sortOrder' => 4, 'isActive' => true, 'createdAt' => $now, 'updatedAt' => $now],
        ];
    }
}
