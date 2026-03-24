<?php

declare(strict_types=1);

use Aws\S3\S3Client;
use Aws\Exception\AwsException;

/**
 * Thin wrapper around the AWS SDK S3Client pointed at a Cloudflare R2 bucket.
 *
 * R2 is S3-compatible; the endpoint is:
 *   https://<account-id>.r2.cloudflarestorage.com
 *
 * Files are stored under the R2_KEY_PREFIX (default: chopaeng/1625autolab/).
 * The public URL is built from R2_PUBLIC_URL + '/' + key.
 */
class R2Uploader
{
    private S3Client $client;

    public function __construct()
    {
        $this->client = new S3Client([
            'version'                 => 'latest',
            'region'                  => 'auto',
            'endpoint'                => 'https://' . R2_ACCOUNT_ID . '.r2.cloudflarestorage.com',
            'credentials'             => [
                'key'    => R2_ACCESS_KEY_ID,
                'secret' => R2_SECRET_ACCESS_KEY,
            ],
            'use_path_style_endpoint' => true,
        ]);
    }

    /**
     * Upload a local file to R2 and return its public URL.
     *
     * @param  string $tmpPath  Absolute path to the temporary file.
     * @param  string $filename Desired filename (basename only, no path).
     * @param  string $mime     MIME type of the file.
     * @param  string $subdir   Optional sub-directory appended after R2_KEY_PREFIX,
     *                          e.g. "bookings/", "services/", "products/".
     *                          Must end with "/" if non-empty.
     * @return string           Public URL of the uploaded object.
     * @throws RuntimeException on upload failure.
     */
    public function upload(string $tmpPath, string $filename, string $mime, string $subdir = ''): string
    {
        $key = R2_KEY_PREFIX . $subdir . $filename;

        try {
            $this->client->putObject([
                'Bucket'      => R2_BUCKET_NAME,
                'Key'         => $key,
                'SourceFile'  => $tmpPath,
                'ContentType' => $mime,
            ]);
        } catch (AwsException $e) {
            $msg = $e->getAwsErrorMessage() ?: $e->getMessage();
            throw new RuntimeException('R2 upload failed: ' . $msg, 500);
        }

        return R2_PUBLIC_URL . '/' . $key;
    }

    /**
     * Returns true when all required R2 constants have been set.
     */
    public static function isConfigured(): bool
    {
        return R2_ACCOUNT_ID !== ''
            && R2_ACCESS_KEY_ID !== ''
            && R2_SECRET_ACCESS_KEY !== ''
            && R2_BUCKET_NAME !== ''
            && R2_PUBLIC_URL !== '';
    }
}
