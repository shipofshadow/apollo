<?php

declare(strict_types=1);

/**
 * SiteSettingsService
 *
 * Key-value store for site-wide settings such as company description,
 * about page content, etc.
 *
 * When DB_NAME is empty it falls back to backend/storage/site_settings.json.
 *
 * Requires migration 011_create_site_settings.sql to have been run.
 */
class SiteSettingsService
{
    private bool $useDb;
    private static string $storageFile = __DIR__ . '/../storage/site_settings.json';

    public function __construct()
    {
        $this->useDb = DB_NAME !== '';
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Return all settings as key => value map.
     *
     * @return array<string, string|null>
     */
    public function getAll(): array
    {
        return $this->useDb ? $this->dbGetAll() : $this->fileGetAll();
    }

    /**
     * Update one or more settings. Keys not in $data are left unchanged.
     *
     * @param  array<string, string|null> $data
     * @return array<string, string|null>
     */
    public function update(array $data): array
    {
        return $this->useDb ? $this->dbUpdate($data) : $this->fileUpdate($data);
    }

    // -------------------------------------------------------------------------
    // DB
    // -------------------------------------------------------------------------

    /** @return array<string, string|null> */
    private function dbGetAll(): array
    {
        $stmt = Database::getInstance()->query('SELECT `key`, `value` FROM site_settings');
        $rows = $stmt->fetchAll();
        $result = [];
        foreach ($rows as $row) {
            $result[(string) $row['key']] = $row['value'];
        }
        return $result;
    }

    /** @param array<string, string|null> $data @return array<string, string|null> */
    private function dbUpdate(array $data): array
    {
        $db   = Database::getInstance();
        $stmt = $db->prepare(
            'INSERT INTO site_settings (`key`, `value`) VALUES (:key, :value)
             ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)'
        );
        foreach ($data as $key => $value) {
            $stmt->execute([':key' => $key, ':value' => $value]);
        }
        return $this->dbGetAll();
    }

    // -------------------------------------------------------------------------
    // File storage – fallback
    // -------------------------------------------------------------------------

    /** @return array<string, string|null> */
    private function fileGetAll(): array
    {
        if (!file_exists(self::$storageFile)) {
            return $this->defaultSettings();
        }
        $data = json_decode((string) file_get_contents(self::$storageFile), true);
        return is_array($data) ? $data : $this->defaultSettings();
    }

    /** @param array<string, string|null> $data @return array<string, string|null> */
    private function fileUpdate(array $data): array
    {
        $current = $this->fileGetAll();
        $merged  = array_merge($current, $data);
        $dir     = dirname(self::$storageFile);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        file_put_contents(
            self::$storageFile,
            json_encode($merged, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );
        return $merged;
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /** @return array<string, string> */
    private function defaultSettings(): array
    {
        return [
            'about_heading'         => 'Built on Precision. Driven by Passion.',
            'company_description_1' => 'Founded in 2018, 1625 Auto Lab started as a small garage operation focused on fixing poorly done headlight retrofits. Today, we are Los Angeles\' premier destination for high-end automotive electronics and premium vehicle upgrades.',
            'company_description_2' => 'We believe that your vehicle is an extension of your personality. Our mission is to provide unparalleled craftsmanship, using only the highest quality components, to turn your automotive vision into reality.',
            'about_image_url'       => 'https://images.unsplash.com/photo-1632823471565-1ec2a74b45b4?q=80&w=2070&auto=format&fit=crop',
            // Footer settings
            'footer_tagline'   => 'The premier automotive retrofitting shop. We turn ordinary vehicles into extraordinary machines.',
            'footer_address'   => "NKKS Arcade, Krystal Homes, Brgy. Alasas\nPampanga, San Fernando, Philippines, 2000",
            'footer_phone'     => '0939 330 8263',
            'footer_email'     => '1625autolab@gmail.com',
            'footer_instagram' => 'https://www.instagram.com/1625autolab',
            'footer_facebook'  => 'https://www.facebook.com/1625autolab/',
            'footer_youtube'   => '',
            // Map / location settings
            'map_embed_url'    => 'https://www.openstreetmap.org/export/embed.html?bbox=120.6699%2C15.0086%2C120.7099%2C15.0486&layer=mapnik&marker=15.0286%2C120.6899',
            'map_link_url'     => 'https://www.openstreetmap.org/?mlat=15.0286&mlon=120.6899#map=15/15.0286/120.6899',
        ];
    }
}
