<?php

declare(strict_types=1);

/**
 * Simple TTL cache.
 *
 * Uses Redis when enabled and reachable; falls back to APCu, then serialised
 * files in the system temp directory.
 */
class Cache
{
    private static bool $redisBootstrapped = false;
    private static ?\Redis $redisClient = null;

    /**
     * Retrieve a cached value, or null if the key is missing / expired.
     *
     * @return array<string, mixed>|null
     */
    public static function get(string $key): ?array
    {
        $redis = self::redis();
        if ($redis !== null) {
            try {
                $raw = $redis->get(self::redisKey($key));
                if (!is_string($raw)) {
                    return null;
                }
                /** @var array<string, mixed>|false $decoded */
                $decoded = @unserialize($raw);
                return is_array($decoded) ? $decoded : null;
            } catch (\Throwable $e) {
                // Fall through to APCu/file fallback.
            }
        }

        if (function_exists('apcu_fetch')) {
            /** @var array<string, mixed>|false $val */
            $val = apcu_fetch($key, $success);
            return ($success && is_array($val)) ? $val : null;
        }

        $file = self::filePath($key);
        if (!file_exists($file)) {
            return null;
        }

        $raw = file_get_contents($file);
        if ($raw === false) {
            return null;
        }

        /** @var array{expires: int, data: array<string, mixed>}|false $entry */
        $entry = unserialize($raw);
        if (!is_array($entry) || time() > $entry['expires']) {
            @unlink($file);
            return null;
        }

        return $entry['data'];
    }

    /**
     * Store a value in the cache for $ttl seconds.
     *
     * @param array<string, mixed> $data
     */
    public static function set(string $key, array $data, int $ttl): void
    {
        if ($ttl <= 0) {
            return;
        }

        $redis = self::redis();
        if ($redis !== null) {
            try {
                $redis->setex(self::redisKey($key), $ttl, serialize($data));
                return;
            } catch (\Throwable $e) {
                // Fall through to APCu/file fallback.
            }
        }

        if (function_exists('apcu_store')) {
            apcu_store($key, $data, $ttl);
            return;
        }

        file_put_contents(
            self::filePath($key),
            serialize(['expires' => time() + $ttl, 'data' => $data]),
            LOCK_EX
        );
    }

    private static function filePath(string $key): string
    {
        return sys_get_temp_dir() . '/apollo_' . md5($key) . '.cache';
    }

    private static function redisKey(string $key): string
    {
        $prefix = defined('REDIS_CACHE_PREFIX') ? (string) REDIS_CACHE_PREFIX : 'apollo_cache:';
        return $prefix . $key;
    }

    private static function redis(): ?\Redis
    {
        if (self::$redisBootstrapped) {
            return self::$redisClient;
        }

        self::$redisBootstrapped = true;

        $enabled = defined('REDIS_CACHE_ENABLED') ? (bool) REDIS_CACHE_ENABLED : false;
        if (!$enabled || !class_exists(\Redis::class)) {
            return null;
        }

        $host = defined('REDIS_HOST') ? (string) REDIS_HOST : '127.0.0.1';
        $port = defined('REDIS_PORT') ? (int) REDIS_PORT : 6379;
        $timeout = defined('REDIS_TIMEOUT') ? (float) REDIS_TIMEOUT : 1.5;
        $persistent = defined('REDIS_PERSISTENT') ? (bool) REDIS_PERSISTENT : false;
        $username = defined('REDIS_USERNAME') ? trim((string) REDIS_USERNAME) : '';
        $password = defined('REDIS_PASSWORD') ? (string) REDIS_PASSWORD : '';
        $database = defined('REDIS_DATABASE') ? max(0, (int) REDIS_DATABASE) : 0;

        $redis = new \Redis();

        try {
            if ($persistent) {
                $redis->pconnect($host, $port, $timeout);
            } else {
                $redis->connect($host, $port, $timeout);
            }

            if ($password !== '') {
                if ($username !== '') {
                    $redis->auth([$username, $password]);
                } else {
                    $redis->auth($password);
                }
            }

            if ($database > 0) {
                $redis->select($database);
            }

            self::$redisClient = $redis;
        } catch (\Throwable $e) {
            self::$redisClient = null;
        }

        return self::$redisClient;
    }
}
