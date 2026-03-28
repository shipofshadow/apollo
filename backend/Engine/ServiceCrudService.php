<?php

declare(strict_types=1);

/**
 * ServiceCrudService
 *
 * Full CRUD for the services table.
 * When DB_NAME is empty it falls back to backend/storage/services.json
 * (seeded with the four default services on first use).
 *
 * Public-facing endpoints return only active services (is_active = 1).
 * Admin endpoints return all services.
 *
 * Requires migration 002_create_services.sql to have been run.
 */
class ServiceCrudService
{
    private bool   $useDb;
    private static string $storageFile = __DIR__ . '/../storage/services.json';

    public function __construct()
    {
        $this->useDb = DB_NAME !== '';
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * All active services ordered by sort_order, id.
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
     * Single service by ID (any active state for admin, active-only for public).
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
     * Single service by slug (any active state for admin, active-only for public).
     *
     * @return array<string, mixed>
     */
    public function getBySlug(string $slug, bool $requireActive = true): array
    {
        return $this->useDb
            ? $this->dbGetBySlug($slug, $requireActive)
            : $this->fileGetBySlug($slug, $requireActive);
    }

    /**
     * Create a new service. Returns the created record.
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
     * Update an existing service. Returns the updated record.
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
     * Hard-delete a service.
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
            "SELECT * FROM services {$where}ORDER BY sort_order ASC, id ASC"
        );
        $rows       = $stmt->fetchAll();
        $features   = $this->dbFetchAllFeatures();
        $variations = $this->dbFetchAllVariations();
        return array_map(
            fn ($row) => $this->mapRow(
                $row,
                $features[(int) $row['id']] ?? [],
                $variations[(int) $row['id']] ?? []
            ),
            $rows
        );
    }

    /** @return array<string, mixed> */
    private function dbGetById(int $id, bool $requireActive): array
    {
        $cond = $requireActive ? 'AND is_active = 1' : '';
        $stmt = Database::getInstance()->prepare(
            "SELECT * FROM services WHERE id = :id $cond LIMIT 1"
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new RuntimeException('Service not found.', 404);
        }
        return $this->mapRow($row, $this->dbFetchFeatures($id), $this->dbFetchVariations($id));
    }

    /** @return array<string, mixed> */
    private function dbGetBySlug(string $slug, bool $requireActive): array
    {
        $cond = $requireActive ? 'AND is_active = 1' : '';
        $stmt = Database::getInstance()->prepare(
            "SELECT * FROM services WHERE slug = :slug $cond LIMIT 1"
        );
        $stmt->execute([':slug' => $slug]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new RuntimeException('Service not found.', 404);
        }
        $id = (int) $row['id'];
        return $this->mapRow($row, $this->dbFetchFeatures($id), $this->dbFetchVariations($id));
    }

    // -------------------------------------------------------------------------
    // DB – write
    // -------------------------------------------------------------------------

    /** @param array<string, mixed> $data @return array<string, mixed> */
    private function dbCreate(array $data): array
    {
        $db   = Database::getInstance();
        $stmt = $db->prepare(
            'INSERT INTO services
             (title, slug, description, full_description, icon, image_url,
              duration, starting_price, sort_order, is_active)
             VALUES
             (:title, :slug, :description, :full_description, :icon, :image_url,
              :duration, :starting_price, :sort_order, :is_active)'
        );
        $stmt->execute($this->bindParams($data));
        $id = (int) $db->lastInsertId();
        $this->dbReplaceFeatures($id, $data['features'] ?? []);
        return $this->dbGetById($id, false);
    }

    /** @param array<string, mixed> $data @return array<string, mixed> */
    private function dbUpdate(int $id, array $data): array
    {
        // Fetch current so we can merge partial updates
        $current = $this->dbGetById($id, false);

        $merged = array_merge([
            'title'           => $current['title'],
            'slug'            => $current['slug'],
            'description'     => $current['description'],
            'fullDescription' => $current['fullDescription'],
            'icon'            => $current['icon'],
            'imageUrl'        => $current['imageUrl'],
            'duration'        => $current['duration'],
            'startingPrice'   => $current['startingPrice'],
            'features'        => $current['features'],
            'sortOrder'       => $current['sortOrder'],
            'isActive'        => $current['isActive'],
        ], $data);

        $db   = Database::getInstance();
        $stmt = $db->prepare(
            'UPDATE services SET
               title            = :title,
               slug             = :slug,
               description      = :description,
               full_description = :full_description,
               icon             = :icon,
               image_url        = :image_url,
               duration         = :duration,
               starting_price   = :starting_price,
               sort_order       = :sort_order,
               is_active        = :is_active
             WHERE id = :id'
        );
        $params        = $this->bindParams($merged);
        $params[':id'] = $id;
        $stmt->execute($params);

        $this->dbReplaceFeatures($id, $merged['features'] ?? []);

        return $this->dbGetById($id, false);
    }

    private function dbDelete(int $id): void
    {
        $stmt = Database::getInstance()->prepare(
            'DELETE FROM services WHERE id = :id'
        );
        $stmt->execute([':id' => $id]);
        if ($stmt->rowCount() === 0) {
            throw new RuntimeException('Service not found.', 404);
        }
    }

    // -------------------------------------------------------------------------
    // DB – service_features helpers
    // -------------------------------------------------------------------------

    /**
     * Fetch features for a single service.
     *
     * @return string[]
     */
    private function dbFetchFeatures(int $serviceId): array
    {
        $stmt = Database::getInstance()->prepare(
            'SELECT feature FROM service_features WHERE service_id = :id ORDER BY sort_order ASC'
        );
        $stmt->execute([':id' => $serviceId]);
        return $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [];
    }

    /**
     * Fetch features for all services in a single query.
     *
     * @return array<int, string[]>  service_id => feature[]
     */
    private function dbFetchAllFeatures(): array
    {
        $stmt = Database::getInstance()->query(
            'SELECT service_id, feature FROM service_features ORDER BY service_id ASC, sort_order ASC'
        );
        $map = [];
        foreach ($stmt->fetchAll() as $row) {
            $map[(int) $row['service_id']][] = $row['feature'];
        }
        return $map;
    }

    /**
     * Replace all features for a service (delete then re-insert).
     *
     * @param string[] $features
     */
    private function dbReplaceFeatures(int $serviceId, array $features): void
    {
        $db = Database::getInstance();

        $db->prepare('DELETE FROM service_features WHERE service_id = :id')
           ->execute([':id' => $serviceId]);

        if (empty($features)) {
            return;
        }

        $stmt = $db->prepare(
            'INSERT INTO service_features (service_id, feature, sort_order) VALUES (:sid, :feature, :order)'
        );
        foreach (array_values($features) as $i => $feature) {
            $stmt->execute([':sid' => $serviceId, ':feature' => $feature, ':order' => $i + 1]);
        }
    }

    // -------------------------------------------------------------------------
    // DB – service_variations helpers
    // -------------------------------------------------------------------------

    /**
     * Fetch all variations for a single service.
     *
     * @return array<int, array<string, mixed>>
     */
    private function dbFetchVariations(int $serviceId): array
    {
        $stmt = Database::getInstance()->prepare(
            'SELECT * FROM service_variations WHERE service_id = :id ORDER BY sort_order ASC, id ASC'
        );
        $stmt->execute([':id' => $serviceId]);
        return array_map([$this, 'mapVariationRow'], $stmt->fetchAll());
    }

    /**
     * Fetch all variations for all services in one query.
     *
     * @return array<int, array<int, array<string, mixed>>>  service_id => variation[]
     */
    private function dbFetchAllVariations(): array
    {
        $stmt = Database::getInstance()->query(
            'SELECT * FROM service_variations ORDER BY service_id ASC, sort_order ASC, id ASC'
        );
        $map = [];
        foreach ($stmt->fetchAll() as $row) {
            $map[(int) $row['service_id']][] = $this->mapVariationRow($row);
        }
        return $map;
    }

    /** @param array<string, mixed> $row @return array<string, mixed> */
    private function mapVariationRow(array $row): array
    {
        $images = json_decode($row['images'] ?? '[]', true);
        if (!is_array($images)) {
            $images = [];
        }
        $specs = json_decode($row['specs'] ?? '[]', true);
        if (!is_array($specs)) {
            $specs = [];
        }
        return [
            'id'          => (int) $row['id'],
            'serviceId'   => (int) $row['service_id'],
            'name'        => $row['name'],
            'description' => $row['description'],
            'price'       => $row['price'],
            'images'      => $images,
            'specs'       => $specs,
            'sortOrder'   => (int) $row['sort_order'],
        ];
    }

    /**
     * Public: create a variation for a service.
     *
     * @param  array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function createVariation(int $serviceId, array $data): array
    {
        $this->dbGetById($serviceId, false); // throws 404 if service missing
        $db   = Database::getInstance();
        $stmt = $db->prepare(
            'INSERT INTO service_variations (service_id, name, description, price, images, specs, sort_order)
             VALUES (:service_id, :name, :description, :price, :images, :specs, :sort_order)'
        );
        $stmt->execute($this->bindVariationParams($serviceId, $data));
        $varId = (int) $db->lastInsertId();
        return $this->dbFetchVariationById($varId);
    }

    /**
     * Public: update a variation.
     *
     * @param  array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function updateVariation(int $serviceId, int $varId, array $data): array
    {
        $this->dbGetById($serviceId, false); // throws 404 if service missing
        $current = $this->dbFetchVariationById($varId);
        $merged  = array_merge([
            'name'        => $current['name'],
            'description' => $current['description'],
            'price'       => $current['price'],
            'images'      => $current['images'],
            'specs'       => $current['specs'],
            'sortOrder'   => $current['sortOrder'],
        ], $data);

        $stmt = Database::getInstance()->prepare(
            'UPDATE service_variations SET
               name        = :name,
               description = :description,
               price       = :price,
               images      = :images,
               specs       = :specs,
               sort_order  = :sort_order
             WHERE id = :id AND service_id = :service_id'
        );
        $params                = $this->bindVariationParams($serviceId, $merged);
        $params[':id']         = $varId;
        $stmt->execute($params);
        return $this->dbFetchVariationById($varId);
    }

    /**
     * Public: delete a variation.
     */
    public function deleteVariation(int $serviceId, int $varId): void
    {
        $stmt = Database::getInstance()->prepare(
            'DELETE FROM service_variations WHERE id = :id AND service_id = :service_id'
        );
        $stmt->execute([':id' => $varId, ':service_id' => $serviceId]);
        if ($stmt->rowCount() === 0) {
            throw new RuntimeException('Variation not found.', 404);
        }
    }

    /** @return array<string, mixed> */
    private function dbFetchVariationById(int $varId): array
    {
        $stmt = Database::getInstance()->prepare(
            'SELECT * FROM service_variations WHERE id = :id LIMIT 1'
        );
        $stmt->execute([':id' => $varId]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new RuntimeException('Variation not found.', 404);
        }
        return $this->mapVariationRow($row);
    }

    /** @param array<string, mixed> $data @return array<string, mixed> */
    private function bindVariationParams(int $serviceId, array $data): array
    {
        $images = $data['images'] ?? [];
        if (!is_array($images)) {
            $images = [];
        }
        $specs = $data['specs'] ?? [];
        if (!is_array($specs)) {
            $specs = [];
        }
        return [
            ':service_id'  => $serviceId,
            ':name'        => $data['name']        ?? '',
            ':description' => $data['description'] ?? '',
            ':price'       => $data['price']       ?? '',
            ':images'      => json_encode($images),
            ':specs'       => json_encode($specs),
            ':sort_order'  => (int) ($data['sortOrder'] ?? ($data['sort_order'] ?? 0)),
        ];
    }

    // -------------------------------------------------------------------------
    // File storage – fallback
    // -------------------------------------------------------------------------

    /** @return array<int, array<string, mixed>> */
    private function fileGetAll(bool $includeInactive): array
    {
        $all = $this->fileRead();
        if (!$includeInactive) {
            $all = array_values(array_filter($all, fn ($s) => (bool) ($s['isActive'] ?? true)));
        }
        usort($all, fn ($a, $b) => ($a['sortOrder'] ?? 0) <=> ($b['sortOrder'] ?? 0));
        return $all;
    }

    /** @return array<string, mixed> */
    private function fileGetById(int $id, bool $requireActive): array
    {
        foreach ($this->fileRead() as $s) {
            if ((int) ($s['id'] ?? 0) === $id) {
                if ($requireActive && !($s['isActive'] ?? true)) {
                    throw new RuntimeException('Service not found.', 404);
                }
                return $s;
            }
        }
        throw new RuntimeException('Service not found.', 404);
    }

    /** @return array<string, mixed> */
    private function fileGetBySlug(string $slug, bool $requireActive): array
    {
        foreach ($this->fileRead() as $s) {
            if (($s['slug'] ?? '') === $slug) {
                if ($requireActive && !($s['isActive'] ?? true)) {
                    throw new RuntimeException('Service not found.', 404);
                }
                return $s;
            }
        }
        throw new RuntimeException('Service not found.', 404);
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
        $all   = $this->fileRead();
        $found = false;
        $result = null;

        foreach ($all as &$s) {
            if ((int) ($s['id'] ?? 0) === $id) {
                $s      = array_merge($s, $this->buildRecord($id, array_merge($s, $data)));
                $result = $s;
                $found  = true;
                break;
            }
        }
        unset($s);

        if (!$found) throw new RuntimeException('Service not found.', 404);
        $this->fileWrite($all);
        return $result;
    }

    private function fileDelete(int $id): void
    {
        $all      = $this->fileRead();
        $filtered = array_values(array_filter($all, fn ($s) => (int) ($s['id'] ?? 0) !== $id));
        if (count($filtered) === count($all)) {
            throw new RuntimeException('Service not found.', 404);
        }
        $this->fileWrite($filtered);
    }

    /** @return array<int, array<string, mixed>> */
    private function fileRead(): array
    {
        if (!file_exists(self::$storageFile)) {
            $this->fileSeedDefaults();
        }
        $data = json_decode((string) file_get_contents(self::$storageFile), true);
        return is_array($data) ? $data : [];
    }

    /** @param array<int, array<string, mixed>> $data */
    private function fileWrite(array $data): void
    {
        $dir = dirname(self::$storageFile);
        if (!is_dir($dir)) mkdir($dir, 0755, true);
        file_put_contents(self::$storageFile, json_encode(array_values($data), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    private function fileSeedDefaults(): void
    {
        $defaults = [
            [
                'id' => 1, 'slug' => 'headlight-retrofits', 'title' => 'Headlight Retrofits',
                'description'     => 'Custom projector retrofits, demon eyes, halos, and sequential turn signals for maximum visibility and aggressive styling.',
                'fullDescription' => 'Our headlight retrofitting service is where art meets engineering. We don\'t just install bulbs; we completely rebuild your headlight housings with state-of-the-art bi-LED or HID projectors.',
                'icon'            => 'Lightbulb',
                'imageUrl'        => 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?q=80&w=1964&auto=format&fit=crop',
                'duration'        => '4–6 Hours', 'startingPrice' => '₱13,750',
                'features'        => ['Bi-LED & HID Projector Conversions','RGBW Demon Eyes & Halos','Custom Lens Etching','Housing Paint & Blackouts','Sequential Turn Signals','Moisture Sealing & Warranty'],
                'sortOrder' => 1, 'isActive' => true, 'createdAt' => date('c'), 'updatedAt' => date('c'),
            ],
            [
                'id' => 2, 'slug' => 'android-headunits', 'title' => 'Android Headunits',
                'description'     => 'Modernize your dash with high-resolution Android screens featuring Apple CarPlay, Android Auto, and custom bezels.',
                'fullDescription' => 'Upgrade your vehicle\'s infotainment system with our premium Android Headunit installations. We seamlessly integrate modern technology into older vehicles.',
                'icon'            => 'MonitorPlay',
                'imageUrl'        => 'https://images.unsplash.com/photo-1533558701576-23c65e0272fb?q=80&w=1974&auto=format&fit=crop',
                'duration'        => '2–3 Hours', 'startingPrice' => '₱8,250',
                'features'        => ['Wireless Apple CarPlay & Android Auto','High-Resolution IPS/OLED Touchscreens','Factory Steering Wheel Control Retention','Custom 3D Printed Bezels','Backup & 360 Camera Integration','DSP Audio Tuning'],
                'sortOrder' => 2, 'isActive' => true, 'createdAt' => date('c'), 'updatedAt' => date('c'),
            ],
            [
                'id' => 3, 'slug' => 'security-systems', 'title' => 'Security Systems',
                'description'     => 'Advanced alarm systems, GPS tracking, and kill switches to protect your investment.',
                'fullDescription' => 'Protect your investment with our advanced security system installations. We go beyond basic alarms, offering comprehensive security solutions that deter theft and provide peace of mind.',
                'icon'            => 'ShieldAlert',
                'imageUrl'        => 'https://images.unsplash.com/photo-1600705722908-bab1e61c0b4d?q=80&w=2070&auto=format&fit=crop',
                'duration'        => '2–4 Hours', 'startingPrice' => '₱11,000',
                'features'        => ['2-Way Paging Alarm Systems','Hidden Kill Switches','Real-Time GPS Tracking','Remote Engine Start','Tilt & Glass Break Sensors','Smartphone Integration'],
                'sortOrder' => 3, 'isActive' => true, 'createdAt' => date('c'), 'updatedAt' => date('c'),
            ],
            [
                'id' => 4, 'slug' => 'aesthetic-upgrades', 'title' => 'Aesthetic Upgrades',
                'description'     => 'Transform the look of your vehicle inside and out with custom grilles, ambient lighting, vinyl wraps, and more.',
                'fullDescription' => 'Transform the look and feel of your vehicle with our aesthetic upgrades. We offer a wide range of services to personalize your ride, both inside and out.',
                'icon'            => 'CarFront',
                'imageUrl'        => 'https://images.unsplash.com/photo-1603386329225-868f9b1ee6c9?q=80&w=2069&auto=format&fit=crop',
                'duration'        => 'Varies', 'startingPrice' => 'Consultation',
                'features'        => ['Custom Ambient Interior Lighting','Aftermarket Grille Installation','Interior Trim Vinyl Wrapping','Aero Kit & Splitter Installation','Custom Emblems & Badging','Caliper Painting'],
                'sortOrder' => 4, 'isActive' => true, 'createdAt' => date('c'), 'updatedAt' => date('c'),
            ],
        ];
        $this->fileWrite($defaults);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /** Map DB snake_case row to camelCase API shape.
     * @param array<string, mixed>            $row        Raw PDO fetch row from the services table.
     * @param string[]                        $features   Ordered feature strings from service_features.
     * @param array<int, array<string, mixed>> $variations Indexed by service_id.
     * @return array<string, mixed>
     */
    private function mapRow(array $row, array $features = [], array $variations = []): array
    {
        return [
            'id'              => (int) $row['id'],
            'slug'            => $row['slug'],
            'title'           => $row['title'],
            'description'     => $row['description'],
            'fullDescription' => $row['full_description'],
            'icon'            => $row['icon'],
            'imageUrl'        => $row['image_url'],
            'duration'        => $row['duration'],
            'startingPrice'   => $row['starting_price'],
            'features'        => $features,
            'variations'      => $variations,
            'sortOrder'       => (int) $row['sort_order'],
            'isActive'        => (bool) $row['is_active'],
            'createdAt'       => $row['created_at'],
            'updatedAt'       => $row['updated_at'],
        ];
    }

    /** Build PDO bind params from camelCase $data. @return array<string, mixed> */
    private function bindParams(array $data): array
    {
        $title = $data['title'] ?? '';
        $slug  = trim($data['slug'] ?? '');
        if ($slug === '') {
            $slug = $this->makeSlug($title);
        }
        return [
            ':title'            => $title,
            ':slug'             => $slug,
            ':description'      => $data['description']     ?? '',
            ':full_description' => $data['fullDescription'] ?? ($data['full_description'] ?? ''),
            ':icon'             => $data['icon']            ?? 'Wrench',
            ':image_url'        => $data['imageUrl']        ?? ($data['image_url'] ?? ''),
            ':duration'         => $data['duration']        ?? '',
            ':starting_price'   => $data['startingPrice']   ?? ($data['starting_price'] ?? ''),
            ':sort_order'       => (int) ($data['sortOrder'] ?? ($data['sort_order'] ?? 0)),
            ':is_active'        => (int) ($data['isActive']  ?? ($data['is_active']  ?? 1)),
        ];
    }

    /** Convert a title to a URL-safe slug. */
    private function makeSlug(string $title): string
    {
        $slug = strtolower($title);
        $slug = preg_replace('/[^a-z0-9]+/', '-', $slug) ?? $slug;
        return trim($slug, '-');
    }

    /** Build a camelCase record for file storage. @return array<string, mixed> */
    private function buildRecord(int $id, array $data): array
    {
        $features = $data['features'] ?? [];
        if (is_string($features)) {
            $features = json_decode($features, true) ?? [];
        }

        $title = $data['title'] ?? '';
        $slug  = trim($data['slug'] ?? '');
        if ($slug === '') {
            $slug = $this->makeSlug($title);
        }

        return [
            'id'              => $id,
            'slug'            => $slug,
            'title'           => $title,
            'description'     => $data['description']     ?? '',
            'fullDescription' => $data['fullDescription'] ?? ($data['full_description'] ?? ''),
            'icon'            => $data['icon']            ?? 'Wrench',
            'imageUrl'        => $data['imageUrl']        ?? ($data['image_url'] ?? ''),
            'duration'        => $data['duration']        ?? '',
            'startingPrice'   => $data['startingPrice']   ?? ($data['starting_price'] ?? ''),
            'features'        => $features,
            'variations'      => [],
            'sortOrder'       => (int) ($data['sortOrder'] ?? ($data['sort_order'] ?? 0)),
            'isActive'        => (bool) ($data['isActive'] ?? ($data['is_active'] ?? true)),
            'createdAt'       => $data['createdAt'] ?? date('c'),
            'updatedAt'       => date('c'),
        ];
    }

    /** @param array<string, mixed> $data */
    private function validatePayload(array $data): void
    {
        if (empty(trim($data['title'] ?? ''))) {
            throw new RuntimeException('Service title is required.', 422);
        }
        if (empty(trim($data['description'] ?? ''))) {
            throw new RuntimeException('Service description is required.', 422);
        }
    }
}
