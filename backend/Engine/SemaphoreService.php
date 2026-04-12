<?php

declare(strict_types=1);

use GuzzleHttp\Client;
use GuzzleHttp\Exception\ConnectException;

/**
 * Read-only Semaphore API client for admin account visibility.
 */
class SemaphoreService
{
    private const BASE_URL = 'https://api.semaphore.co/api/v4';

    private Client $http;
    private string $apiKey;
    private string $senderName;
    private int $accountCacheTtl;
    private int $messagesCacheTtl;

    public function __construct()
    {
        $this->apiKey = defined('SEMAPHORE_API_KEY') ? (string) SEMAPHORE_API_KEY : '';
        $this->senderName = defined('SEMAPHORE_SENDER_NAME') ? (string) SEMAPHORE_SENDER_NAME : '1625AutoLab';
        $this->accountCacheTtl = defined('SEMAPHORE_ACCOUNT_CACHE_TTL') ? max(0, (int) SEMAPHORE_ACCOUNT_CACHE_TTL) : 60;
        $this->messagesCacheTtl = defined('SEMAPHORE_MESSAGES_CACHE_TTL') ? max(0, (int) SEMAPHORE_MESSAGES_CACHE_TTL) : 30;

        $this->http = new Client([
            'timeout' => 15,
            'http_errors' => false,
            'headers' => ['Accept' => 'application/json'],
        ]);
    }

    /** @return array<string, mixed> */
    public function getAccount(bool $refresh = false): array
    {
        if ($this->apiKey === '') {
            return [
                'configured' => false,
                'sender_name' => $this->senderName,
                'account' => null,
            ];
        }

        $cacheKey = 'semaphore_account';
        if (!$refresh && $this->accountCacheTtl > 0) {
            $cached = Cache::get($cacheKey);
            if ($cached !== null) {
                return $cached;
            }
        }

        $payload = $this->request('/account');
        $result = [
            'configured' => true,
            'sender_name' => $this->senderName,
            'account' => [
                'account_id' => (int) ($payload['account_id'] ?? 0),
                'account_name' => (string) ($payload['account_name'] ?? ''),
                'status' => (string) ($payload['status'] ?? ''),
                'credit_balance' => (int) ($payload['credit_balance'] ?? 0),
            ],
        ];

        if ($this->accountCacheTtl > 0) {
            Cache::set($cacheKey, $result, $this->accountCacheTtl);
        }

        return $result;
    }

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function getMessages(array $filters = [], bool $refresh = false): array
    {
        $page = max(1, (int) ($filters['page'] ?? 1));
        $limit = max(1, min(1000, (int) ($filters['limit'] ?? 20)));
        $status = strtolower(trim((string) ($filters['status'] ?? '')));
        $network = strtolower(trim((string) ($filters['network'] ?? '')));
        $startDate = trim((string) ($filters['startDate'] ?? ''));
        $endDate = trim((string) ($filters['endDate'] ?? ''));

        if ($this->apiKey === '') {
            return [
                'configured' => false,
                'messages' => [],
                'page' => $page,
                'limit' => $limit,
            ];
        }

        $query = [
            'page' => $page,
            'limit' => $limit,
        ];
        if ($status !== '') {
            $query['status'] = $status;
        }
        if ($network !== '') {
            $query['network'] = $network;
        }
        if ($this->isValidDate($startDate)) {
            $query['startDate'] = $startDate;
        }
        if ($this->isValidDate($endDate)) {
            $query['endDate'] = $endDate;
        }

        $cacheKey = 'semaphore_messages_' . md5(json_encode($query) ?: '');
        if (!$refresh && $this->messagesCacheTtl > 0) {
            $cached = Cache::get($cacheKey);
            if ($cached !== null) {
                return $cached;
            }
        }

        $payload = $this->request('/messages', $query);
        $messages = [];
        foreach ($payload as $row) {
            if (!is_array($row)) {
                continue;
            }
            $messages[] = [
                'message_id' => (int) ($row['message_id'] ?? 0),
                'recipient' => (string) ($row['recipient'] ?? ''),
                'message' => (string) ($row['message'] ?? ''),
                'sender_name' => (string) ($row['sender_name'] ?? ''),
                'network' => (string) ($row['network'] ?? ''),
                'status' => (string) ($row['status'] ?? ''),
                'type' => (string) ($row['type'] ?? ''),
                'source' => (string) ($row['source'] ?? ''),
                'created_at' => (string) ($row['created_at'] ?? ''),
                'updated_at' => (string) ($row['updated_at'] ?? ''),
            ];
        }

        $result = [
            'configured' => true,
            'messages' => $messages,
            'page' => $page,
            'limit' => $limit,
        ];

        if ($this->messagesCacheTtl > 0) {
            Cache::set($cacheKey, $result, $this->messagesCacheTtl);
        }

        return $result;
    }

    /**
     * @param array<string, mixed> $query
     * @return array<string, mixed>|array<int, array<string, mixed>>
     */
    private function request(string $path, array $query = []): array
    {
        try {
            $response = $this->http->get(self::BASE_URL . $path, [
                'query' => array_merge($query, ['apikey' => $this->apiKey]),
            ]);
        } catch (ConnectException $e) {
            $isTimeout = str_contains(strtolower($e->getMessage()), 'timed out')
                || str_contains(strtolower($e->getMessage()), 'timeout');
            if ($isTimeout) {
                throw new RuntimeException('Request to Semaphore timed out. Please try again.', 504);
            }

            throw new RuntimeException('Could not reach Semaphore. Please try again later.', 503);
        }

        $statusCode = $response->getStatusCode();
        $decoded = json_decode((string) $response->getBody(), true);
        $payload = is_array($decoded) ? $decoded : [];

        if ($statusCode < 200 || $statusCode >= 300) {
            $message = is_array($payload) && isset($payload['message']) && is_string($payload['message'])
                ? trim($payload['message'])
                : '';

            if ($message === '' && $statusCode === 429) {
                $message = 'Semaphore rate limit exceeded. Please wait and try again.';
            }
            if ($message === '') {
                $message = 'Semaphore request failed.';
            }

            throw new RuntimeException($message, $statusCode);
        }

        return $payload;
    }

    private function isValidDate(string $value): bool
    {
        if ($value === '') {
            return false;
        }

        $dt = \DateTimeImmutable::createFromFormat('Y-m-d', $value);
        return $dt !== false && $dt->format('Y-m-d') === $value;
    }
}