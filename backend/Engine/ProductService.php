<?php

declare(strict_types=1);

/**
 * ProductService
 *
 * Full CRUD for the products table.
 * When DB_NAME is empty it falls back to backend/storage/products.json.
 *
 * Public-facing endpoints return only active products (is_active = 1).
 * Admin endpoints return all products.
 *
 * Requires migration 007_create_products.sql to have been run.
 */
class ProductService
{
    private bool   $useDb;
    /** @var array<string, bool>|null */
    private ?array $productColumns = null;
    /** @var array<string, bool>|null */
    private ?array $variationColumns = null;
    private static string $storageFile = __DIR__ . '/../storage/products.json';

    public function __construct()
    {
        $this->useDb = DB_NAME !== '';
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * All products ordered by sort_order, id.
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
     * Single product by ID.
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
     * Single product by identifier (UUID preferred, numeric ID fallback).
     *
     * @return array<string, mixed>
     */
    public function getByIdentifier(string $identifier, bool $requireActive = true): array
    {
        $trimmed = trim($identifier);
        if ($trimmed === '') {
            throw new RuntimeException('Product not found.', 404);
        }

        if ($this->isUuid($trimmed)) {
            return $this->useDb
                ? $this->dbGetByUuid($trimmed, $requireActive)
                : $this->fileGetByUuid($trimmed, $requireActive);
        }

        if (ctype_digit($trimmed)) {
            return $this->getById((int) $trimmed, $requireActive);
        }

        throw new RuntimeException('Product not found.', 404);
    }

    /** Resolve product numeric ID from UUID or numeric identifier. */
    public function resolveId(string $identifier): int
    {
        $trimmed = trim($identifier);
        if ($trimmed === '') {
            throw new RuntimeException('Product not found.', 404);
        }

        if (ctype_digit($trimmed)) {
            return (int) $trimmed;
        }

        if ($this->isUuid($trimmed)) {
            return $this->useDb
                ? $this->dbResolveIdByUuid($trimmed)
                : $this->fileResolveIdByUuid($trimmed);
        }

        throw new RuntimeException('Product not found.', 404);
    }

    /**
     * Create a new product. Returns the created record.
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
     * Update an existing product. Returns the updated record.
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
     * Hard-delete a product.
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
            "SELECT * FROM products {$where}ORDER BY sort_order ASC, id ASC"
        );
        $rows       = $stmt->fetchAll();
        $variations = $this->dbFetchAllVariations();
        return array_map(
            fn ($row) => $this->mapRow($row, $variations[(int) $row['id']] ?? []),
            $rows
        );
    }

    /** @return array<string, mixed> */
    private function dbGetById(int $id, bool $requireActive): array
    {
        $cond = $requireActive ? 'AND is_active = 1' : '';
        $stmt = Database::getInstance()->prepare(
            "SELECT * FROM products WHERE id = :id $cond LIMIT 1"
        );
        $stmt->execute([':id' => $id]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new RuntimeException('Product not found.', 404);
        }
        return $this->mapRow($row, $this->dbFetchVariations($id));
    }

    /** @return array<string, mixed> */
    private function dbGetByUuid(string $uuid, bool $requireActive): array
    {
        if (!$this->hasProductColumn('uuid')) {
            throw new RuntimeException('Product not found.', 404);
        }

        $cond = $requireActive ? 'AND is_active = 1' : '';
        $stmt = Database::getInstance()->prepare(
            "SELECT * FROM products WHERE uuid = :uuid $cond LIMIT 1"
        );
        $stmt->execute([':uuid' => $uuid]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new RuntimeException('Product not found.', 404);
        }
        return $this->mapRow($row, $this->dbFetchVariations((int) $row['id']));
    }

    private function dbResolveIdByUuid(string $uuid): int
    {
        if (!$this->hasProductColumn('uuid')) {
            throw new RuntimeException('Product not found.', 404);
        }

        $stmt = Database::getInstance()->prepare(
            'SELECT id FROM products WHERE uuid = :uuid LIMIT 1'
        );
        $stmt->execute([':uuid' => $uuid]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new RuntimeException('Product not found.', 404);
        }
        return (int) $row['id'];
    }

    // -------------------------------------------------------------------------
    // DB – write
    // -------------------------------------------------------------------------

    /** @param array<string, mixed> $data @return array<string, mixed> */
    private function dbCreate(array $data): array
    {
        $db   = Database::getInstance();
        $params = $this->bindParams($data);
        if ($this->hasProductColumn('uuid')) {
            $stmt = $db->prepare(
                'INSERT INTO products
                 (uuid, name, description, price, category, image_url, features, sort_order, is_active)
                 VALUES
                 (:uuid, :name, :description, :price, :category, :image_url, :features, :sort_order, :is_active)'
            );
            $stmt->execute($params);
        } else {
            $stmt = $db->prepare(
                'INSERT INTO products
                 (name, description, price, category, image_url, features, sort_order, is_active)
                 VALUES
                 (:name, :description, :price, :category, :image_url, :features, :sort_order, :is_active)'
            );
            $stmt->execute([
                ':name'        => $params[':name'],
                ':description' => $params[':description'],
                ':price'       => $params[':price'],
                ':category'    => $params[':category'],
                ':image_url'   => $params[':image_url'],
                ':features'    => $params[':features'],
                ':sort_order'  => $params[':sort_order'],
                ':is_active'   => $params[':is_active'],
            ]);
        }
        return $this->dbGetById((int) $db->lastInsertId(), false);
    }

    /** @param array<string, mixed> $data @return array<string, mixed> */
    private function dbUpdate(int $id, array $data): array
    {
        $current = $this->dbGetById($id, false);

        $merged = array_merge([
            'name'        => $current['name'],
            'description' => $current['description'],
            'price'       => $current['price'],
            'category'    => $current['category'],
            'imageUrl'    => $current['imageUrl'],
            'features'    => $current['features'],
            'sortOrder'   => $current['sortOrder'],
            'isActive'    => $current['isActive'],
        ], $data);

        $stmt = Database::getInstance()->prepare(
            'UPDATE products SET
               name        = :name,
               description = :description,
               price       = :price,
               category    = :category,
               image_url   = :image_url,
               features    = :features,
               sort_order  = :sort_order,
               is_active   = :is_active
             WHERE id = :id'
        );
        $params        = $this->bindParams($merged);
        $params[':id'] = $id;
        $stmt->execute($params);

        $oldImage = trim((string) ($current['imageUrl'] ?? ''));
        $newImage = trim((string) ($merged['imageUrl'] ?? ($merged['image_url'] ?? '')));
        if ($oldImage !== '' && $oldImage !== $newImage) {
            $this->deleteManagedImageUrl($oldImage);
        }

        return $this->dbGetById($id, false);
    }

    private function dbDelete(int $id): void
    {
        $current = $this->dbGetById($id, false);
        $variations = $this->dbFetchVariations($id);

        $stmt = Database::getInstance()->prepare(
            'DELETE FROM products WHERE id = :id'
        );
        $stmt->execute([':id' => $id]);
        if ($stmt->rowCount() === 0) {
            throw new RuntimeException('Product not found.', 404);
        }

        $urls = $this->collectProductImageUrls($current);
        foreach ($variations as $variation) {
            $urls = array_merge($urls, $this->collectVariationImageUrls($variation));
        }
        $this->deleteManagedImageUrls($urls);
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
                    throw new RuntimeException('Product not found.', 404);
                }
                return $p;
            }
        }
        throw new RuntimeException('Product not found.', 404);
    }

    /** @return array<string, mixed> */
    private function fileGetByUuid(string $uuid, bool $requireActive): array
    {
        foreach ($this->fileRead() as $p) {
            if ((string) ($p['uuid'] ?? '') === $uuid) {
                if ($requireActive && !($p['isActive'] ?? true)) {
                    throw new RuntimeException('Product not found.', 404);
                }
                return $p;
            }
        }
        throw new RuntimeException('Product not found.', 404);
    }

    private function fileResolveIdByUuid(string $uuid): int
    {
        foreach ($this->fileRead() as $p) {
            if ((string) ($p['uuid'] ?? '') === $uuid) {
                return (int) ($p['id'] ?? 0);
            }
        }
        throw new RuntimeException('Product not found.', 404);
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
        $oldImage = '';

        foreach ($all as &$p) {
            if ((int) ($p['id'] ?? 0) === $id) {
                $oldImage = trim((string) ($p['imageUrl'] ?? ''));
                $p      = $this->buildRecord($id, array_merge($p, $data));
                $result = $p;
                $found  = true;
                break;
            }
        }
        unset($p);

        if (!$found) throw new RuntimeException('Product not found.', 404);
        $this->fileWrite($all);

        $newImage = trim((string) ($result['imageUrl'] ?? ''));
        if ($oldImage !== '' && $oldImage !== $newImage) {
            $this->deleteManagedImageUrl($oldImage);
        }

        return $result;
    }

    private function fileDelete(int $id): void
    {
        $all      = $this->fileRead();
        $oldImage = '';
        foreach ($all as $p) {
            if ((int) ($p['id'] ?? 0) === $id) {
                $oldImage = trim((string) ($p['imageUrl'] ?? ''));
                break;
            }
        }
        $filtered = array_values(array_filter($all, fn ($p) => (int) ($p['id'] ?? 0) !== $id));
        if (count($filtered) === count($all)) {
            throw new RuntimeException('Product not found.', 404);
        }
        $this->fileWrite($filtered);

        if ($oldImage !== '') {
            $this->deleteManagedImageUrl($oldImage);
        }
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
     * @param  array<string, mixed>            $row
     * @param  array<int, array<string, mixed>> $variations Variations array for the product.
     * @return array<string, mixed>
     */
    private function mapRow(array $row, array $variations = []): array
    {
        $features = $row['features'] ?? '[]';
        if (is_string($features)) {
            $features = json_decode($features, true) ?? [];
        }

        return [
            'id'          => (int)  $row['id'],
            'uuid'        => trim((string) ($row['uuid'] ?? '')) !== ''
                ? (string) $row['uuid']
                : (string) $row['id'],
            'name'        =>        $row['name'],
            'description' =>        $row['description'],
            'price'       => (float) $row['price'],
            'category'    =>        $row['category'],
            'imageUrl'    =>        $row['image_url'],
            'features'    =>        $features,
            'variations'  =>        $variations,
            'sortOrder'   => (int)  $row['sort_order'],
            'isActive'    => (bool) $row['is_active'],
            'createdAt'   =>        $row['created_at'],
            'updatedAt'   =>        $row['updated_at'],
        ];
    }

    /** @return array<string, mixed> */
    private function bindParams(array $data): array
    {
        $features = $data['features'] ?? [];
        if (is_string($features)) {
            $features = json_decode($features, true) ?? [];
        }

        return [
            ':uuid'        => $data['uuid']        ?? $this->uuid(),
            ':name'        => $data['name']        ?? '',
            ':description' => $data['description'] ?? '',
            ':price'       => (float) ($data['price'] ?? 0),
            ':category'    => $data['category']    ?? '',
            ':image_url'   => $data['imageUrl']    ?? ($data['image_url'] ?? ''),
            ':features'    => json_encode(array_values($features)),
            ':sort_order'  => (int) ($data['sortOrder'] ?? ($data['sort_order'] ?? 0)),
            ':is_active'   => (int) ($data['isActive']  ?? ($data['is_active']  ?? 1)),
        ];
    }

    /** Build a camelCase record for file storage. @return array<string, mixed> */
    private function buildRecord(int $id, array $data): array
    {
        $features = $data['features'] ?? [];
        if (is_string($features)) {
            $features = json_decode($features, true) ?? [];
        }

        return [
            'id'          => $id,
            'uuid'        => $data['uuid'] ?? $this->uuid(),
            'name'        => $data['name']        ?? '',
            'description' => $data['description'] ?? '',
            'price'       => (float) ($data['price'] ?? 0),
            'category'    => $data['category']    ?? '',
            'imageUrl'    => $data['imageUrl']    ?? ($data['image_url'] ?? ''),
            'features'    => array_values((array) $features),
            'variations'  => [],
            'sortOrder'   => (int) ($data['sortOrder'] ?? ($data['sort_order'] ?? 0)),
            'isActive'    => (bool) ($data['isActive'] ?? ($data['is_active'] ?? true)),
            'createdAt'   => $data['createdAt'] ?? date('c'),
            'updatedAt'   => date('c'),
        ];
    }

    private function hasProductColumn(string $column): bool
    {
        $map = $this->getProductColumnMap();
        return !empty($map[$column]);
    }

    /** @return array<string, bool> */
    private function getProductColumnMap(): array
    {
        if ($this->productColumns !== null) {
            return $this->productColumns;
        }

        $this->productColumns = [];
        $stmt = Database::getInstance()->query('SHOW COLUMNS FROM products');
        foreach ($stmt->fetchAll() as $row) {
            $field = (string) ($row['Field'] ?? '');
            if ($field !== '') {
                $this->productColumns[$field] = true;
            }
        }
        return $this->productColumns;
    }

    private function isUuid(string $value): bool
    {
        return (bool) preg_match(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i',
            $value
        );
    }

    private function uuid(): string
    {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }

    // -------------------------------------------------------------------------
    // DB – product_variations helpers
    // -------------------------------------------------------------------------

    /**
     * Fetch all variations for a single product.
     *
     * @return array<int, array<string, mixed>>
     */
    private function dbFetchVariations(int $productId): array
    {
        $stmt = Database::getInstance()->prepare(
            'SELECT * FROM product_variations WHERE product_id = :id ORDER BY sort_order ASC, id ASC'
        );
        $stmt->execute([':id' => $productId]);
        return array_map([$this, 'mapVariationRow'], $stmt->fetchAll());
    }

    /**
     * Fetch all variations for all products in one query.
     *
     * @return array<int, array<int, array<string, mixed>>>  product_id => variation[]
     */
    private function dbFetchAllVariations(): array
    {
        $stmt = Database::getInstance()->query(
            'SELECT * FROM product_variations ORDER BY product_id ASC, sort_order ASC, id ASC'
        );
        $map = [];
        foreach ($stmt->fetchAll() as $row) {
            $map[(int) $row['product_id']][] = $this->mapVariationRow($row);
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
        $colors = json_decode($row['colors'] ?? '[]', true);
        if (!is_array($colors)) {
            $colors = [];
        }
        $colorImages = json_decode($row['color_images'] ?? '{}', true);
        if (!is_array($colorImages)) {
            $colorImages = [];
        }
        return [
            'id'          => (int) $row['id'],
            'productId'   => (int) $row['product_id'],
            'name'        => $row['name'],
            'description' => $row['description'],
            'price'       => $row['price'],
            'images'      => $images,
            'specs'       => $specs,
            'colors'      => $colors,
            'colorImages' => $colorImages,
            'sortOrder'   => (int) $row['sort_order'],
        ];
    }

    /**
     * Public: create a variation for a product.
     *
     * @param  array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function createVariation(int $productId, array $data): array
    {
        $this->dbGetById($productId, false); // throws 404 if product missing
        $db   = Database::getInstance();
        $params = $this->bindVariationParams($productId, $data);

        if ($this->hasVariationColumns(['colors', 'color_images'])) {
            $stmt = $db->prepare(
                  'INSERT INTO product_variations (product_id, name, description, price, images, specs, colors, color_images, sort_order)
                   VALUES (:product_id, :name, :description, :price, :images, :specs, :colors, :color_images, :sort_order)'
            );
            $stmt->execute($params);
        } else {
            $stmt = $db->prepare(
                  'INSERT INTO product_variations (product_id, name, description, price, images, specs, sort_order)
                   VALUES (:product_id, :name, :description, :price, :images, :specs, :sort_order)'
            );
            $stmt->execute([
                ':product_id'  => $params[':product_id'],
                ':name'        => $params[':name'],
                ':description' => $params[':description'],
                ':price'       => $params[':price'],
                ':images'      => $params[':images'],
                ':specs'       => $params[':specs'],
                ':sort_order'  => $params[':sort_order'],
            ]);
        }

        $varId = (int) $db->lastInsertId();
        return $this->dbFetchVariationById($varId);
    }

    /**
     * Public: update a variation.
     *
     * @param  array<string, mixed> $data
     * @return array<string, mixed>
     */
    public function updateVariation(int $productId, int $varId, array $data): array
    {
        $this->dbGetById($productId, false); // throws 404 if product missing
        $current = $this->dbFetchVariationById($varId);
        $merged  = array_merge([
            'name'        => $current['name'],
            'description' => $current['description'],
            'price'       => $current['price'],
            'images'      => $current['images'],
            'specs'       => $current['specs'],
            'colors'      => $current['colors'] ?? [],
            'colorImages' => $current['colorImages'] ?? [],
            'sortOrder'   => $current['sortOrder'],
        ], $data);

        $withColorColumns = $this->hasVariationColumns(['colors', 'color_images']);
        $sql = $withColorColumns
            ? 'UPDATE product_variations SET
               name        = :name,
               description = :description,
               price       = :price,
               images      = :images,
               specs       = :specs,
               colors      = :colors,
               color_images = :color_images,
               sort_order  = :sort_order
             WHERE id = :id AND product_id = :product_id'
            : 'UPDATE product_variations SET
               name        = :name,
               description = :description,
               price       = :price,
               images      = :images,
               specs       = :specs,
               sort_order  = :sort_order
             WHERE id = :id AND product_id = :product_id';

        $stmt = Database::getInstance()->prepare($sql);
        $params                = $this->bindVariationParams($productId, $merged);
        $params[':id']         = $varId;
        if ($withColorColumns) {
            $stmt->execute($params);
        } else {
            $stmt->execute([
                ':id'          => $params[':id'],
                ':product_id'  => $params[':product_id'],
                ':name'        => $params[':name'],
                ':description' => $params[':description'],
                ':price'       => $params[':price'],
                ':images'      => $params[':images'],
                ':specs'       => $params[':specs'],
                ':sort_order'  => $params[':sort_order'],
            ]);
        }

        $newVariation = [
            'images'      => json_decode((string) ($params[':images'] ?? '[]'), true) ?: [],
            'colorImages' => json_decode((string) ($params[':color_images'] ?? '{}'), true) ?: [],
        ];
        $this->deleteRemovedManagedUrls(
            $this->collectVariationImageUrls($current),
            $this->collectVariationImageUrls($newVariation)
        );

        return $this->dbFetchVariationById($varId);
    }

    /** @param string[] $columns */
    private function hasVariationColumns(array $columns): bool
    {
        $map = $this->getVariationColumnMap();
        foreach ($columns as $column) {
            if (empty($map[$column])) {
                return false;
            }
        }
        return true;
    }

    /** @return array<string, bool> */
    private function getVariationColumnMap(): array
    {
        if ($this->variationColumns !== null) {
            return $this->variationColumns;
        }

        $this->variationColumns = [];
        $stmt = Database::getInstance()->query('SHOW COLUMNS FROM product_variations');
        foreach ($stmt->fetchAll() as $row) {
            $field = (string) ($row['Field'] ?? '');
            if ($field !== '') {
                $this->variationColumns[$field] = true;
            }
        }
        return $this->variationColumns;
    }

    /**
     * Public: delete a variation.
     */
    public function deleteVariation(int $productId, int $varId): void
    {
        $current = $this->dbFetchVariationById($varId);

        $stmt = Database::getInstance()->prepare(
            'DELETE FROM product_variations WHERE id = :id AND product_id = :product_id'
        );
        $stmt->execute([':id' => $varId, ':product_id' => $productId]);
        if ($stmt->rowCount() === 0) {
            throw new RuntimeException('Variation not found.', 404);
        }

        $this->deleteManagedImageUrls($this->collectVariationImageUrls($current));
    }

    /** @return array<string, mixed> */
    private function dbFetchVariationById(int $varId): array
    {
        $stmt = Database::getInstance()->prepare(
            'SELECT * FROM product_variations WHERE id = :id LIMIT 1'
        );
        $stmt->execute([':id' => $varId]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new RuntimeException('Variation not found.', 404);
        }
        return $this->mapVariationRow($row);
    }

    /** @param array<string, mixed> $data @return array<string, mixed> */
    private function bindVariationParams(int $productId, array $data): array
    {
        $images = $data['images'] ?? [];
        if (!is_array($images)) {
            $images = [];
        }
        $specs = $data['specs'] ?? [];
        if (!is_array($specs)) {
            $specs = [];
        }
        $colors = $data['colors'] ?? [];
        if (!is_array($colors)) {
            $colors = [];
        }
        $colors = array_values(array_filter(array_map(
            fn ($color) => is_string($color) ? trim($color) : '',
            $colors
        ), fn ($color) => $color !== ''));
        $colorImages = $data['colorImages'] ?? ($data['color_images'] ?? []);
        if (!is_array($colorImages)) {
            $colorImages = [];
        }

        $normalizedColorImages = [];
        foreach ($colorImages as $color => $urls) {
            if (!is_string($color)) {
                continue;
            }
            $normalizedColor = trim($color);
            if ($normalizedColor === '') {
                continue;
            }
            if (!is_array($urls)) {
                continue;
            }
            $normalizedUrls = array_values(array_filter(array_map(
                fn ($url) => is_string($url) ? trim($url) : '',
                $urls
            ), fn ($url) => $url !== ''));
            if (!empty($normalizedUrls)) {
                $normalizedColorImages[$normalizedColor] = $normalizedUrls;
            }
        }

        if (!empty($colors)) {
            $normalizedColorImages = array_intersect_key(
                $normalizedColorImages,
                array_flip($colors)
            );
        } else {
            $normalizedColorImages = [];
        }
        return [
            ':product_id'  => $productId,
            ':name'        => $data['name']        ?? '',
            ':description' => $data['description'] ?? '',
            ':price'       => $data['price']       ?? '',
            ':images'      => json_encode($images),
            ':specs'       => json_encode($specs),
            ':colors'      => json_encode($colors),
            ':color_images' => json_encode($normalizedColorImages),
            ':sort_order'  => (int) ($data['sortOrder'] ?? ($data['sort_order'] ?? 0)),
        ];
    }

    /** @param array<string, mixed> $data */
    private function validatePayload(array $data): void
    {
        if (empty(trim($data['name'] ?? ''))) {
            throw new RuntimeException('Product name is required.', 422);
        }
        if (!isset($data['price']) || !is_numeric($data['price']) || (float) $data['price'] < 0) {
            throw new RuntimeException('A valid product price is required.', 422);
        }
    }

    /** @param array<string, mixed> $product @return string[] */
    private function collectProductImageUrls(array $product): array
    {
        $url = trim((string) ($product['imageUrl'] ?? ($product['image_url'] ?? '')));
        return $url !== '' ? [$url] : [];
    }

    /** @param array<string, mixed> $variation @return string[] */
    private function collectVariationImageUrls(array $variation): array
    {
        $urls = [];

        $images = $variation['images'] ?? [];
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

        $colorImages = $variation['colorImages'] ?? ($variation['color_images'] ?? []);
        if (is_array($colorImages)) {
            foreach ($colorImages as $group) {
                if (!is_array($group)) {
                    continue;
                }
                foreach ($group as $url) {
                    if (!is_string($url)) {
                        continue;
                    }
                    $trimmed = trim($url);
                    if ($trimmed !== '') {
                        $urls[] = $trimmed;
                    }
                }
            }
        }

        return array_values(array_unique($urls));
    }

    /** @param string[] $oldUrls @param string[] $newUrls */
    private function deleteRemovedManagedUrls(array $oldUrls, array $newUrls): void
    {
        $this->deleteManagedImageUrls(array_values(array_diff($oldUrls, $newUrls)));
    }

    /** @param string[] $urls */
    private function deleteManagedImageUrls(array $urls): void
    {
        if (empty($urls)) {
            return;
        }

        $storage = new UploadStorage();
        foreach (array_values(array_unique($urls)) as $url) {
            $this->deleteManagedImageUrl((string) $url, $storage);
        }
    }

    private function deleteManagedImageUrl(string $url, ?UploadStorage $storage = null): void
    {
        $trimmed = trim($url);
        if ($trimmed === '') {
            return;
        }

        try {
            ($storage ?? new UploadStorage())->deleteByUrl($trimmed);
        } catch (\Throwable) {
            // Keep CRUD successful even if storage cleanup fails.
        }
    }
}
