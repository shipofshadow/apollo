<?php

declare(strict_types=1);

use Aws\S3\S3Client;
use League\Flysystem\Filesystem;
use League\Flysystem\FilesystemOperator;
use League\Flysystem\AwsS3V3\AwsS3V3Adapter;
use League\Flysystem\Local\LocalFilesystemAdapter;

/**
 * Flysystem-powered upload storage.
 *
 * Storage backend is controlled by FILESYSTEM_DISK:
 *   - local (default): writes under UPLOAD_DIR
 *   - s3: uses Cloudflare R2 via S3-compatible adapter
 */
class UploadStorage
{
    private FilesystemOperator $filesystem;
    private string $publicBaseUrl;

    public function __construct()
    {
        $disk = strtolower(trim((string) FILESYSTEM_DISK));
        if ($disk === 's3') {
            $this->bootS3();
            return;
        }

        $this->bootLocal();
    }

    /**
     * Upload a temporary file and return a public URL.
     */
    public function upload(string $tmpPath, string $filename, string $mime, string $subdir = ''): string
    {
        if (!is_file($tmpPath)) {
            throw new RuntimeException('Upload failed: temporary file is missing.', 422);
        }

        $path = $this->buildPath($subdir, $filename);
        $stream = fopen($tmpPath, 'rb');
        if ($stream === false) {
            throw new RuntimeException('Upload failed: could not read temporary file.', 422);
        }

        try {
            $this->filesystem->writeStream($path, $stream, ['mimetype' => $mime]);
        } catch (Throwable $e) {
            throw new RuntimeException('Upload failed: ' . $e->getMessage(), 500);
        } finally {
            fclose($stream);
        }

        return rtrim($this->publicBaseUrl, '/') . '/' . ltrim($path, '/');
    }

    /**
     * Delete an uploaded object by its public URL.
     * Returns true when a managed object was found and deletion was attempted.
     */
    public function deleteByUrl(?string $publicUrl): bool
    {
        $url = trim((string) $publicUrl);
        if ($url === '') {
            return false;
        }

        $path = $this->extractStoragePathFromPublicUrl($url);
        if ($path === null) {
            return false;
        }

        if (!$this->filesystem->fileExists($path)) {
            return true;
        }

        $this->filesystem->delete($path);
        return true;
    }

    private function bootLocal(): void
    {
        if (!is_dir(UPLOAD_DIR)) {
            mkdir(UPLOAD_DIR, 0755, true);
        }

        $this->filesystem = new Filesystem(new LocalFilesystemAdapter(UPLOAD_DIR));
        $base = UPLOAD_BASE_URL !== '' ? UPLOAD_BASE_URL : '';
        $this->publicBaseUrl = $base . '/storage/uploads';
    }

    private function bootS3(): void
    {
        $this->assertS3Config();

        $client = new S3Client([
            'version'                 => 'latest',
            'region'                  => 'auto',
            'endpoint'                => 'https://' . R2_ACCOUNT_ID . '.r2.cloudflarestorage.com',
            'credentials'             => [
                'key'    => R2_ACCESS_KEY_ID,
                'secret' => R2_SECRET_ACCESS_KEY,
            ],
            'use_path_style_endpoint' => true,
        ]);

        $prefix = trim((string) R2_KEY_PREFIX, '/');
        $adapter = new AwsS3V3Adapter($client, R2_BUCKET_NAME, $prefix);
        $this->filesystem = new Filesystem($adapter);
        $this->publicBaseUrl = $this->buildS3PublicBaseUrl((string) R2_PUBLIC_URL, $prefix);
    }

    private function buildS3PublicBaseUrl(string $baseUrl, string $prefix): string
    {
        $baseUrl = rtrim($baseUrl, '/');
        if ($prefix === '') {
            return $baseUrl;
        }

        $path = (string) (parse_url($baseUrl, PHP_URL_PATH) ?? '');
        $path = rtrim($path, '/');
        if ($path === '') {
            return $baseUrl . '/' . $prefix;
        }

        if ($path === $prefix || str_ends_with($path, '/' . $prefix)) {
            return $baseUrl;
        }

        return $baseUrl . '/' . $prefix;
    }

    private function assertS3Config(): void
    {
        if (
            R2_ACCOUNT_ID === ''
            || R2_ACCESS_KEY_ID === ''
            || R2_SECRET_ACCESS_KEY === ''
            || R2_BUCKET_NAME === ''
            || R2_PUBLIC_URL === ''
        ) {
            throw new RuntimeException(
                'FILESYSTEM_DISK is set to s3 but R2 configuration is incomplete.',
                500
            );
        }
    }

    private function buildPath(string $subdir, string $filename): string
    {
        $safeName = basename($filename);
        $dir = trim($subdir, "/\\ \t\n\r\0\x0B");
        return $dir !== '' ? ($dir . '/' . $safeName) : $safeName;
    }

    private function extractStoragePathFromPublicUrl(string $publicUrl): ?string
    {
        $base = rtrim($this->publicBaseUrl, '/');
        if ($base === '') {
            return null;
        }

        // Exact base URL cannot represent a file.
        if ($publicUrl === $base) {
            return null;
        }

        if (str_starts_with($publicUrl, $base . '/')) {
            return ltrim(substr($publicUrl, strlen($base) + 1), '/');
        }

        $basePath = trim((string) (parse_url($base, PHP_URL_PATH) ?? ''), '/');
        $urlPath  = trim((string) (parse_url($publicUrl, PHP_URL_PATH) ?? ''), '/');

        if ($basePath === '' || $urlPath === '') {
            return null;
        }

        if ($urlPath === $basePath || !str_starts_with($urlPath, $basePath . '/')) {
            return null;
        }

        return ltrim(substr($urlPath, strlen($basePath) + 1), '/');
    }
}
