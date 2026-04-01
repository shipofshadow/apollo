<?php

declare(strict_types=1);

/**
 * PortfolioService
 *
 * Full CRUD for the portfolio table.
 * When DB_NAME is empty it falls back to backend/storage/portfolio.json.
 *
 * Public-facing endpoints return only active items (is_active = 1).
 * Admin endpoints return all items.
 *
 * Requires migration 017_create_portfolio.sql to have been run.
 */
class PortfolioService
{
    private bool   $useDb;
    private static string $storageFile = __DIR__ . '/../storage/portfolio.json';
    private ?bool $hasBookingBuildSlugColumnCache = null;

    public function __construct()
    {
        $this->useDb = DB_NAME !== '';
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * All portfolio items ordered by sort_order, id.
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
     * Single portfolio item by ID.
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
     * Get a portfolio/build item by slug (public, active only)
     *
     * @param string $slug
     * @return array<string, mixed>
     */
    public function getBySlug(string $slug): array
    {
        $needle = $this->normalizeSlug($slug);
        if ($needle === '') {
            throw new RuntimeException('Portfolio item not found.', 404);
        }

        if ($this->useDb && $this->hasSlugColumn()) {
            $stmt = Database::getInstance()->prepare(
                'SELECT * FROM portfolio WHERE slug = :slug AND is_active = 1 LIMIT 1'
            );
            $stmt->execute([':slug' => $needle]);
            $row = $stmt->fetch();
            if ($row) {
                return $this->mapRow($row);
            }
        }

        $items = $this->useDb ? $this->dbGetAll(false) : $this->fileGetAll(false);
        foreach ($items as $item) {
            if ($this->itemSlug($item) === $needle) {
                return $item;
            }
        }

        $bookingFallback = $this->findCompletedBookingBuildBySlug($needle);
        if ($bookingFallback !== null) {
            return $bookingFallback;
        }

        throw new RuntimeException('Portfolio item not found.', 404);
    }

    /**
     * Create a new portfolio item. Returns the created record.
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
     * Update an existing portfolio item. Returns the updated record.
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
     * Hard-delete a portfolio item.
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
            "SELECT * FROM portfolio {$where}ORDER BY sort_order ASC, id ASC"
        );
        return array_map([$this, 'mapRow'], $stmt->fetchAll());
    }

    /** Check whether the images column exists (added in migration 021). */
    private function hasImagesColumn(): bool
    {
        static $checked = null;
        if ($checked === null) {
            try {
                $stmt    = Database::getInstance()->query('SELECT images FROM portfolio LIMIT 0');
                $checked = $stmt !== false;
            } catch (\Throwable $e) {
                $checked = false;
            }
        }
        return $checked;
    }

    /** Check whether the slug column exists in portfolio table. */
    private function hasSlugColumn(): bool
    {
        static $checked = null;
        if ($checked === null) {
            try {
                $stmt    = Database::getInstance()->query('SELECT slug FROM portfolio LIMIT 0');
                $checked = $stmt !== false;
            } catch (\Throwable) {
                $checked = false;
            }
        }
        return $checked;
    }

    private function hasBookingBuildSlugColumn(): bool
    {
        if ($this->hasBookingBuildSlugColumnCache !== null) {
            return $this->hasBookingBuildSlugColumnCache;
        }

        try {
            $stmt = Database::getInstance()->query('SELECT build_slug FROM bookings LIMIT 0');
            $this->hasBookingBuildSlugColumnCache = $stmt !== false;
        } catch (\Throwable) {
            $this->hasBookingBuildSlugColumnCache = false;
        }

        return $this->hasBookingBuildSlugColumnCache;
    }

    /** @return array<string, mixed> */
    private function dbGetById(int $id, bool $requireActive): array
    {
        $cond = $requireActive ? 'AND is_active = 1' : '';
        $stmt = Database::getInstance()->prepare(
            "SELECT * FROM portfolio WHERE id = :id $cond LIMIT 1"
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new RuntimeException('Portfolio item not found.', 404);
        }
        return $this->mapRow($row);
    }

    // -------------------------------------------------------------------------
    // DB – write
    // -------------------------------------------------------------------------

    /** @param array<string, mixed> $data @return array<string, mixed> */
    private function dbCreate(array $data): array
    {
        $db = Database::getInstance();
        if ($this->hasImagesColumn() && $this->hasSlugColumn()) {
            $stmt = $db->prepare(
                'INSERT INTO portfolio
                 (title, slug, category, description, image_url, images, sort_order, is_active)
                 VALUES
                 (:title, :slug, :category, :description, :image_url, :images, :sort_order, :is_active)'
            );
        } elseif ($this->hasImagesColumn()) {
            $stmt = $db->prepare(
                'INSERT INTO portfolio
                 (title, category, description, image_url, images, sort_order, is_active)
                 VALUES
                 (:title, :category, :description, :image_url, :images, :sort_order, :is_active)'
            );
        } elseif ($this->hasSlugColumn()) {
            $stmt = $db->prepare(
                'INSERT INTO portfolio
                 (title, slug, category, description, image_url, sort_order, is_active)
                 VALUES
                 (:title, :slug, :category, :description, :image_url, :sort_order, :is_active)'
            );
        } else {
            $stmt = $db->prepare(
                'INSERT INTO portfolio
                 (title, category, description, image_url, sort_order, is_active)
                 VALUES
                 (:title, :category, :description, :image_url, :sort_order, :is_active)'
            );
        }
        $stmt->execute($this->bindParams($data));
        return $this->dbGetById((int) $db->lastInsertId(), false);
    }

    /** @param array<string, mixed> $data @return array<string, mixed> */
    private function dbUpdate(int $id, array $data): array
    {
        $current = $this->dbGetById($id, false);

        $merged = array_merge([
            'title'       => $current['title'],
            'slug'        => $current['slug'] ?? '',
            'category'    => $current['category'],
            'description' => $current['description'],
            'imageUrl'    => $current['imageUrl'],
            'images'      => $current['images'],
            'sortOrder'   => $current['sortOrder'],
            'isActive'    => $current['isActive'],
        ], $data);

        if ($this->hasImagesColumn() && $this->hasSlugColumn()) {
            $stmt = Database::getInstance()->prepare(
                'UPDATE portfolio SET
                   title       = :title,
                   slug        = :slug,
                   category    = :category,
                   description = :description,
                   image_url   = :image_url,
                   images      = :images,
                   sort_order  = :sort_order,
                   is_active   = :is_active
                 WHERE id = :id'
            );
        } elseif ($this->hasImagesColumn()) {
            $stmt = Database::getInstance()->prepare(
                'UPDATE portfolio SET
                   title       = :title,
                   category    = :category,
                   description = :description,
                   image_url   = :image_url,
                   images      = :images,
                   sort_order  = :sort_order,
                   is_active   = :is_active
                 WHERE id = :id'
            );
        } elseif ($this->hasSlugColumn()) {
            $stmt = Database::getInstance()->prepare(
                'UPDATE portfolio SET
                   title       = :title,
                   slug        = :slug,
                   category    = :category,
                   description = :description,
                   image_url   = :image_url,
                   sort_order  = :sort_order,
                   is_active   = :is_active
                 WHERE id = :id'
            );
        } else {
            $stmt = Database::getInstance()->prepare(
                'UPDATE portfolio SET
                   title       = :title,
                   category    = :category,
                   description = :description,
                   image_url   = :image_url,
                   sort_order  = :sort_order,
                   is_active   = :is_active
                 WHERE id = :id'
            );
        }
        $params        = $this->bindParams($merged);
        $params[':id'] = $id;
        $stmt->execute($params);

        $oldUrls = $this->collectPortfolioImageUrls($current);
        $newUrls = $this->collectPortfolioImageUrls($this->dbGetById($id, false));
        $this->deleteRemovedImageUrls($oldUrls, $newUrls);

        return $this->dbGetById($id, false);
    }

    private function dbDelete(int $id): void
    {
        $current = $this->dbGetById($id, false);

        $stmt = Database::getInstance()->prepare(
            'DELETE FROM portfolio WHERE id = :id'
        );
        $stmt->execute([':id' => $id]);
        if ($stmt->rowCount() === 0) {
            throw new RuntimeException('Portfolio item not found.', 404);
        }

        $this->deleteRemovedImageUrls($this->collectPortfolioImageUrls($current), []);
    }

    // -------------------------------------------------------------------------
    // File storage – fallback
    // -------------------------------------------------------------------------

    /** @return array<int, array<string, mixed>> */
    private function fileGetAll(bool $includeInactive): array
    {
        $all = $this->fileRead();
        if (!$includeInactive) {
            $all = array_values(array_filter($all, fn ($p) => (bool) ($p['isActive'] ?? true)));
        }
        usort($all, fn ($a, $b) => ($a['sortOrder'] ?? 0) <=> ($b['sortOrder'] ?? 0));
        return $all;
    }

    /** @return array<string, mixed> */
    private function fileGetById(int $id, bool $requireActive): array
    {
        foreach ($this->fileRead() as $p) {
            if ((int) ($p['id'] ?? 0) === $id) {
                if ($requireActive && !($p['isActive'] ?? true)) {
                    throw new RuntimeException('Portfolio item not found.', 404);
                }
                return $p;
            }
        }
        throw new RuntimeException('Portfolio item not found.', 404);
    }

    /** @param array<string, mixed> $data @return array<string, mixed> */
    private function fileCreate(array $data): array
    {
        $all = $this->fileRead();
        $id  = empty($all) ? 1 : (int) max(array_column($all, 'id')) + 1;

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
        $oldUrls = [];

        foreach ($all as &$p) {
            if ((int) ($p['id'] ?? 0) === $id) {
                $oldUrls = $this->collectPortfolioImageUrls($p);
                $p      = $this->buildRecord($id, array_merge($p, $data));
                $result = $p;
                $found  = true;
                break;
            }
        }
        unset($p);

        if (!$found) throw new RuntimeException('Portfolio item not found.', 404);
        $this->fileWrite($all);

        $newUrls = $result !== null ? $this->collectPortfolioImageUrls($result) : [];
        $this->deleteRemovedImageUrls($oldUrls, $newUrls);

        return $result;
    }

    private function fileDelete(int $id): void
    {
        $all      = $this->fileRead();
        $oldUrls  = [];
        foreach ($all as $p) {
            if ((int) ($p['id'] ?? 0) === $id) {
                $oldUrls = $this->collectPortfolioImageUrls($p);
                break;
            }
        }
        $filtered = array_values(array_filter($all, fn ($p) => (int) ($p['id'] ?? 0) !== $id));
        if (count($filtered) === count($all)) {
            throw new RuntimeException('Portfolio item not found.', 404);
        }
        $this->fileWrite($filtered);

        $this->deleteRemovedImageUrls($oldUrls, []);
    }

    /** @return array<int, array<string, mixed>> */
    private function fileRead(): array
    {
        if (!file_exists(self::$storageFile)) {
            return [];
        }
        $raw = file_get_contents(self::$storageFile);
        if ($raw === false) {
            return [];
        }
        $data = json_decode($raw, true);
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
        $rawImages = $row['images'] ?? '[]';
        $images    = json_decode((string) $rawImages, true);
        if (!is_array($images)) {
            $images = [];
        }

        return [
            'id'          => (int)  $row['id'],
            'title'       =>        $row['title'],
            'slug'        =>        trim((string) ($row['slug'] ?? '')) !== ''
                ? (string) $row['slug']
                : $this->makeSlug((string) ($row['title'] ?? '')),
            'category'    =>        $row['category'],
            'description' =>        $row['description'],
            'imageUrl'    =>        $row['image_url'],
            'images'      =>        $images,
            'sortOrder'   => (int)  $row['sort_order'],
            'isActive'    => (bool) $row['is_active'],
            'createdAt'   =>        $row['created_at'],
            'updatedAt'   =>        $row['updated_at'],
        ];
    }

    /** @return array<string, mixed> */
    private function bindParams(array $data): array
    {
        $images = $data['images'] ?? [];
        if (is_string($images)) {
            $decoded = json_decode($images, true);
            $images  = is_array($decoded) ? $decoded : [];
        }

        $title = trim((string) ($data['title'] ?? ''));
        $slug  = trim((string) ($data['slug'] ?? ''));
        if ($slug === '') {
            $slug = $this->makeSlug($title);
        }

        // Derive image_url from first image in the array when available.
        $imageUrl = $data['imageUrl'] ?? ($data['image_url'] ?? '');
        if (empty($imageUrl) && !empty($images)) {
            $imageUrl = $images[0];
        }

        $params = [
            ':title'       => $title,
            ':category'    => $data['category']    ?? '',
            ':description' => $data['description'] ?? '',
            ':image_url'   => $imageUrl,
            ':sort_order'  => (int) ($data['sortOrder'] ?? ($data['sort_order'] ?? 0)),
            ':is_active'   => (int) ($data['isActive']  ?? ($data['is_active']  ?? 1)),
        ];

        if ($this->hasSlugColumn()) {
            $params[':slug'] = $slug;
        }

        if ($this->hasImagesColumn()) {
            $params[':images'] = json_encode(array_values($images), JSON_UNESCAPED_UNICODE);
        }

        return $params;
    }

    /**
     * Build a camelCase record for file storage.
     *
     * @param  int                  $id
     * @param  array<string, mixed> $data
     * @return array<string, mixed>
     */
    private function buildRecord(int $id, array $data): array
    {
        $images = $data['images'] ?? [];
        if (is_string($images)) {
            $decoded = json_decode($images, true);
            $images  = is_array($decoded) ? $decoded : [];
        }

        $title = trim((string) ($data['title'] ?? ''));
        $slug  = trim((string) ($data['slug'] ?? ''));
        if ($slug === '') {
            $slug = $this->makeSlug($title);
        }

        $imageUrl = $data['imageUrl'] ?? ($data['image_url'] ?? '');
        if (empty($imageUrl) && !empty($images)) {
            $imageUrl = $images[0];
        }

        return [
            'id'          => $id,
            'title'       => $title,
            'slug'        => $slug,
            'category'    => $data['category']    ?? '',
            'description' => $data['description'] ?? '',
            'imageUrl'    => $imageUrl,
            'images'      => array_values($images),
            'sortOrder'   => (int) ($data['sortOrder'] ?? ($data['sort_order'] ?? 0)),
            'isActive'    => (bool) ($data['isActive'] ?? ($data['is_active'] ?? true)),
            'createdAt'   => $data['createdAt'] ?? date('c'),
            'updatedAt'   => date('c'),
        ];
    }

    /** @param array<string, mixed> $data */
    private function validatePayload(array $data): void
    {
        if (empty(trim($data['title'] ?? ''))) {
            throw new RuntimeException('Portfolio item title is required.', 422);
        }
    }

    /** Convert a title to a URL-safe slug. */
    private function makeSlug(string $title): string
    {
        $slug = strtolower($title);
        $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? $slug;
        return trim($slug, '-');
    }

    private function normalizeSlug(string $slug): string
    {
        return $this->makeSlug(trim($slug));
    }

    /** @param array<string, mixed> $item */
    private function itemSlug(array $item): string
    {
        $raw = trim((string) ($item['slug'] ?? ''));
        if ($raw !== '') {
            return $this->normalizeSlug($raw);
        }

        return $this->makeSlug((string) ($item['title'] ?? ''));
    }

    /** @param array<string, mixed> $item @return string[] */
    private function collectPortfolioImageUrls(array $item): array
    {
        $urls = [];

        $imageUrl = trim((string) ($item['imageUrl'] ?? ($item['image_url'] ?? '')));
        if ($imageUrl !== '') {
            $urls[] = $imageUrl;
        }

        $images = $item['images'] ?? [];
        if (!is_array($images)) {
            $images = [];
        }
        foreach ($images as $url) {
            if (!is_string($url)) {
                continue;
            }
            $trimmed = trim($url);
            if ($trimmed !== '') {
                $urls[] = $trimmed;
            }
        }

        return array_values(array_unique($urls));
    }

    /** @param string[] $oldUrls @param string[] $newUrls */
    private function deleteRemovedImageUrls(array $oldUrls, array $newUrls): void
    {
        $toDelete = array_diff($oldUrls, $newUrls);
        if (empty($toDelete)) {
            return;
        }

        $storage = new UploadStorage();
        foreach ($toDelete as $url) {
            try {
                $storage->deleteByUrl($url);
            } catch (\Throwable) {
                // Keep CRUD successful even if storage cleanup fails.
            }
        }
    }

    /** @return array<string, mixed>|null */
    private function findCompletedBookingBuildBySlug(string $slug): ?array
    {
        if (!$this->useDb) {
            return null;
        }

        $db = Database::getInstance();
        $row = null;

        $baseSelect = 'SELECT b.*,
                 s.title AS service_name,
                 tm.name AS tech_name,
                 tm.role AS tech_role,
                 tm.image_url AS tech_image_url
                 FROM bookings b
                 LEFT JOIN services s ON s.id = b.service_id
                 LEFT JOIN team_members tm ON tm.id = b.assigned_tech_id';

        if ($this->hasBookingBuildSlugColumn()) {
            $stmt = $db->prepare(
                $baseSelect . '
                 WHERE b.status = :status AND b.build_slug = :slug
                 ORDER BY b.created_at DESC
                 LIMIT 1'
            );
            $stmt->execute([':status' => 'completed', ':slug' => $slug]);
            $row = $stmt->fetch();
        }

        if (!$row) {
            $stmt = $db->prepare(
                $baseSelect . '
                 WHERE b.status = :status
                 ORDER BY b.created_at DESC'
            );
            $stmt->execute([':status' => 'completed']);
            $rows = $stmt->fetchAll();

            foreach ($rows as $candidate) {
                $ref = $this->makeSlug((string) ($candidate['reference_number'] ?? ''));
                if ($ref !== '' && $ref === $slug) {
                    $row = $candidate;
                    break;
                }

                $idSlug = $this->makeSlug((string) ($candidate['id'] ?? ''));
                if ($idSlug !== '' && ('booking-' . $idSlug) === $slug) {
                    $row = $candidate;
                    break;
                }
            }
        }

        if (!$row) {
            return null;
        }

        // Fetch build-progress updates for this booking
        $buildUpdates = [];
        try {
            $bookingId = (string) ($row['id'] ?? '');
            if ($bookingId !== '') {
                $stmt = $db->prepare(
                    'SELECT note, photo_urls, created_at
                     FROM build_updates
                     WHERE booking_id = :id
                     ORDER BY created_at ASC'
                );
                $stmt->execute([':id' => $bookingId]);
                $buildUpdates = $stmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];
            }
        } catch (\Throwable) {
            // build_updates table may not exist yet
        }

        return $this->mapBookingBuildRow($row, $slug, $buildUpdates);
    }

    /**
     * @param array<string, mixed>               $row
     * @param array<int, array<string, mixed>>   $buildUpdates
     * @return array<string, mixed>
     */
    private function mapBookingBuildRow(array $row, string $slug, array $buildUpdates = []): array
    {
        $after  = $this->decodeJsonUrls($row['after_media_urls'] ?? null);
        $before = $this->decodeJsonUrls($row['before_media_urls'] ?? null);
        $media  = $this->decodeJsonUrls($row['media_urls'] ?? null);

        // Lead images: prefer after first, then before, then general media
        $images = array_values(array_unique(array_merge($after, $before, $media)));

        $serviceName = trim((string) ($row['service_name'] ?? ''));
        $title = $serviceName !== '' ? $serviceName : 'Completed Build';

        $reference = trim((string) ($row['reference_number'] ?? ''));

        // Build a rich description using vehicle + service info
        $vehicleMake  = trim((string) ($row['vehicle_make']  ?? ''));
        $vehicleModel = trim((string) ($row['vehicle_model'] ?? ''));
        $vehicleYear  = trim((string) ($row['vehicle_year']  ?? ''));
        $vehicleInfo  = trim((string) ($row['vehicle_info']  ?? ''));

        $vehicleLine = implode(' ', array_filter([$vehicleYear, $vehicleMake, $vehicleModel]));
        if ($vehicleLine === '') {
            $vehicleLine = $vehicleInfo;
        }

        $description = $serviceName !== '' && $vehicleLine !== ''
            ? "{$serviceName} build on a {$vehicleLine}."
            : ($reference !== '' ? "Build showcase for booking {$reference}." : 'Build showcase from a completed booking.');

        // Parse parts notes into an array of items
        $partsNotes = trim((string) ($row['parts_notes'] ?? ''));
        $partsArray = [];
        if ($partsNotes !== '') {
            $lines = preg_split('/\r?\n|,/', $partsNotes) ?: [];
            foreach ($lines as $line) {
                $line = trim($line);
                if ($line !== '') {
                    $partsArray[] = $line;
                }
            }
        }

        // Map build-progress updates
        $updates = [];
        foreach ($buildUpdates as $u) {
            $note      = trim((string) ($u['note'] ?? ''));
            $photoUrls = $this->decodeJsonUrls($u['photo_urls'] ?? null);
            if ($note !== '' || count($photoUrls) > 0) {
                $updates[] = [
                    'note'      => $note,
                    'photoUrls' => $photoUrls,
                    'createdAt' => (string) ($u['created_at'] ?? ''),
                ];
            }
        }

        // Technician info
        $techName      = trim((string) ($row['tech_name']       ?? ''));
        $techRole      = trim((string) ($row['tech_role']       ?? ''));
        $techImageUrl  = trim((string) ($row['tech_image_url']  ?? ''));

        $appointmentDate = trim((string) ($row['appointment_date'] ?? ''));
        $customerNotes   = trim((string) ($row['notes'] ?? ''));

        return [
            'id'              => 0,
            'title'           => $title,
            'slug'            => $slug,
            'category'        => 'Booking',
            'description'     => $description,
            'imageUrl'        => $images[0] ?? '',
            'images'          => $images,
            'sortOrder'       => 0,
            'isActive'        => true,
            'createdAt'       => (string) ($row['created_at'] ?? date('c')),
            'updatedAt'       => (string) ($row['updated_at'] ?? ($row['created_at'] ?? date('c'))),
            // Enriched build data
            'serviceName'     => $serviceName,
            'referenceNumber' => $reference,
            'vehicle'         => [
                'make'  => $vehicleMake,
                'model' => $vehicleModel,
                'year'  => $vehicleYear,
                'info'  => $vehicleInfo,
                'label' => $vehicleLine,
            ],
            'technician'      => $techName,
            'technicianRole'  => $techRole,
            'technicianImage' => $techImageUrl,
            'appointmentDate' => $appointmentDate,
            'notes'           => $customerNotes,
            'parts'           => $partsArray,
            'buildUpdates'    => $updates,
            'beforeImages'    => $before,
            'afterImages'     => $after,
        ];
    }

    /** @return string[] */
    private function decodeJsonUrls(mixed $raw): array
    {
        if (!is_string($raw) || trim($raw) === '') {
            return [];
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            return [];
        }

        $urls = [];
        foreach ($decoded as $value) {
            if (!is_string($value)) {
                continue;
            }
            $trimmed = trim($value);
            if ($trimmed !== '') {
                $urls[] = $trimmed;
            }
        }

        return array_values(array_unique($urls));
    }
}
