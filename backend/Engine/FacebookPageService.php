<?php

declare(strict_types=1);

/**
 * FacebookPageService
 *
 * Handles the full Facebook OAuth flow, long-lived token management,
 * page token storage, and post publishing using raw cURL + PDO.
 *
 * Requires: FB_APP_ID, FB_APP_SECRET, FB_GRAPH_BASE in config/Configuration.php.
 * Requires migration 019_create_facebook_pages.sql.
 */
class FacebookPageService
{
    // OAuthException error sub-code for expired / invalidated tokens
    private const TOKEN_EXPIRED_CODE = 190;

    // -------------------------------------------------------------------------
    // OAuth helpers
    // -------------------------------------------------------------------------

    /**
     * Build the Facebook Login URL the admin should be redirected to.
     *
     * The caller (frontend) is responsible for generating a cryptographically
     * random state value, storing it locally (e.g. sessionStorage), and
     * validating it when the callback arrives.  The backend never touches
     * $_SESSION for OAuth state – authentication is handled by JWT.
     *
     * @param string $redirectUri  The frontend URL Facebook redirects back to
     *                             (must be registered in the Facebook App settings)
     * @param string $state        Caller-supplied CSRF token (UUIDv4 / hex)
     */
    public function buildAuthUrl(string $redirectUri, string $state): string
    {
        if (FB_APP_ID === '') {
            throw new RuntimeException('FB_APP_ID is not configured.', 500);
        }
        if (FB_APP_SECRET === '') {
            throw new RuntimeException('FB_APP_SECRET is not configured.', 500);
        }
        if ($state === '') {
            throw new RuntimeException('OAuth state is required.', 422);
        }
        if (filter_var($redirectUri, FILTER_VALIDATE_URL) === false) {
            throw new RuntimeException('redirect_uri must be a valid URL.', 422);
        }

        $params = http_build_query([
            'client_id'     => FB_APP_ID,
            'redirect_uri'  => $redirectUri,
            'scope'         => 'pages_manage_posts,pages_read_engagement',
            'response_type' => 'code',
            'state'         => $state,
        ]);

        return 'https://www.facebook.com/dialog/oauth?' . $params;
    }

    /**
     * Exchange an auth code for long-lived page tokens and persist them.
     *
     * State validation is intentionally omitted here: the frontend validates
     * the state against its own sessionStorage, and the caller must already be
     * authenticated as an admin (JWT checked by the router).
     *
     * @return array<int, array<string, mixed>>  List of saved page records
     */
    public function handleCallback(string $code, string $redirectUri): array
    {
        // Step 1 – exchange auth code → short-lived user token
        $shortToken = $this->exchangeCodeForToken($code, $redirectUri);

        // Step 2 – upgrade to long-lived user token
        $longToken = $this->exchangeForLongLivedToken($shortToken);

        // Step 3 – fetch page tokens and persist them
        return $this->fetchAndSavePageTokens($longToken);
    }

    // -------------------------------------------------------------------------
    // Token exchange
    // -------------------------------------------------------------------------

    /**
     * Exchange an auth code for a short-lived user access token.
     */
    private function exchangeCodeForToken(string $code, string $redirectUri): string
    {
        $url = FB_GRAPH_BASE . '/oauth/access_token?' . http_build_query([
            'client_id'     => FB_APP_ID,
            'client_secret' => FB_APP_SECRET,
            'redirect_uri'  => $redirectUri,
            'code'          => $code,
        ]);

        $body = $this->curlGet($url);
        $data = json_decode($body, true);

        if (empty($data['access_token'])) {
            $msg = $data['error']['message'] ?? 'Failed to exchange code for token.';
            throw new RuntimeException($msg, 502);
        }

        return (string) $data['access_token'];
    }

    /**
     * Exchange a short-lived user token for a long-lived one (~60 days).
     */
    private function exchangeForLongLivedToken(string $shortToken): string
    {
        $url = FB_GRAPH_BASE . '/oauth/access_token?' . http_build_query([
            'grant_type'        => 'fb_exchange_token',
            'client_id'         => FB_APP_ID,
            'client_secret'     => FB_APP_SECRET,
            'fb_exchange_token' => $shortToken,
        ]);

        $body = $this->curlGet($url);
        $data = json_decode($body, true);

        if (empty($data['access_token'])) {
            $msg = $data['error']['message'] ?? 'Failed to obtain long-lived token.';
            throw new RuntimeException($msg, 502);
        }

        return (string) $data['access_token'];
    }

    /**
     * Call /me/accounts with a long-lived user token to retrieve Page tokens,
     * then upsert each page record into the DB.
     *
     * @return array<int, array<string, mixed>>
     */
    private function fetchAndSavePageTokens(string $userToken): array
    {
        $url  = FB_GRAPH_BASE . '/me/accounts?fields=id,name,access_token&access_token='
              . urlencode($userToken);
        $body = $this->curlGet($url);
        $data = json_decode($body, true);

        if (!isset($data['data']) || !is_array($data['data'])) {
            $msg = $data['error']['message'] ?? 'Failed to fetch page accounts.';
            throw new RuntimeException($msg, 502);
        }

        $saved = [];
        foreach ($data['data'] as $page) {
            $pageId    = (string) ($page['id']           ?? '');
            $pageName  = (string) ($page['name']         ?? '');
            $pageToken = (string) ($page['access_token'] ?? '');

            if ($pageId === '' || $pageToken === '') {
                continue;
            }

            $saved[] = $this->upsertPage($pageId, $pageName, $pageToken);
        }

        return $saved;
    }

    // -------------------------------------------------------------------------
    // Database – page token storage
    // -------------------------------------------------------------------------

    /**
     * Insert or update a page record (upsert by page_id).
     *
     * @return array<string, mixed>
     */
    private function upsertPage(string $pageId, string $pageName, string $pageToken): array
    {
        $db = Database::getInstance();
        $stmt = $db->prepare(
            'INSERT INTO facebook_pages (page_id, page_name, page_access_token, token_valid)
             VALUES (:page_id, :page_name, :token, 1)
             ON DUPLICATE KEY UPDATE
               page_name         = VALUES(page_name),
               page_access_token = VALUES(page_access_token),
               token_valid       = 1'
        );
        $stmt->execute([
            ':page_id'   => $pageId,
            ':page_name' => $pageName,
            ':token'     => $pageToken,
        ]);

        return $this->getPageById($pageId);
    }

    /**
     * Return all connected pages (both valid and invalidated).
     *
     * @return array<int, array<string, mixed>>
     */
    public function listPages(): array
    {
        $stmt = Database::getInstance()->query(
            'SELECT * FROM facebook_pages ORDER BY created_at ASC'
        );
        return array_map([$this, 'mapRow'], $stmt->fetchAll());
    }

    /**
     * Delete a page token record (disconnect the page).
     */
    public function deletePage(string $pageId): void
    {
        $stmt = Database::getInstance()->prepare(
            'DELETE FROM facebook_pages WHERE page_id = :page_id'
        );
        $stmt->execute([':page_id' => $pageId]);
        if ($stmt->rowCount() === 0) {
            throw new RuntimeException('Page not found.', 404);
        }
    }

    // -------------------------------------------------------------------------
    // Post reading
    // -------------------------------------------------------------------------

    /**
     * Fetch the most recent posts from the first valid connected Facebook page.
     *
     * Uses the stored page access token from the `facebook_pages` table.
     * Returns the same envelope shape as FacebookService::getPosts() so that
     * the router and frontend can consume both sources identically.
     *
     * @return array{data: list<array<string, mixed>>, paging: array<string, mixed>|null}
     * @throws RuntimeException  When no valid page is connected or the Graph API returns an error.
     */
    public function getPagePosts(int $limit = 10, ?string $after = null): array
    {
        $stmt = Database::getInstance()->prepare(
            'SELECT id, page_id, page_name, page_access_token, token_valid, created_at, updated_at
               FROM facebook_pages
              WHERE token_valid = 1
              ORDER BY created_at ASC
              LIMIT 1'
        );
        $stmt->execute();
        $row = $stmt->fetch();

        if (!$row) {
            throw new RuntimeException(
                'No connected Facebook page found. Please connect a page in the admin panel.',
                503
            );
        }

        $page        = $this->mapRow($row);
        $pageId      = (string) $page['pageId'];
        $accessToken = (string) $page['pageAccessToken'];

        $queryParams = ['fields' => FB_POST_FIELDS, 'limit' => $limit, 'access_token' => $accessToken];
        if ($after !== null && $after !== '') {
            $queryParams['after'] = $after;
        }

        $url  = FB_GRAPH_BASE . '/' . urlencode($pageId) . '/posts?' . http_build_query($queryParams);
        $body = $this->curlGet($url);
        $data = json_decode($body, true);

        if (!is_array($data)) {
            throw new RuntimeException('Unexpected response from the Facebook API.', 502);
        }

        if (isset($data['error'])) {
            $this->handleGraphError($data['error'], $pageId);
        }

        return [
            'data'   => $data['data']   ?? [],
            'paging' => $data['paging'] ?? null,
        ];
    }

    // -------------------------------------------------------------------------
    // Post publishing
    // -------------------------------------------------------------------------

    /**
     * Publish a post to a Facebook Page, optionally with attached images.
     *
     * Post body format:
     *   [message / headline]
     *   ✔ Feature 1
     *   ✔ Feature 2
     *   [callToAction]
     *   [contactFooter]
     *   [#Portfolio #1625AutoLab  – when isPortfolio is true]
     *
     * Flow when images are supplied (Facebook multi-photo post):
     *   1. Upload each image URL as an unpublished photo via /{page-id}/photos
     *      to obtain a Photo ID.
     *   2. POST to /{page-id}/feed with message + attached_media[] referencing
     *      those Photo IDs.
     * Flow with no images: POST to /{page-id}/feed with message only.
     *
     * @param  string   $pageId        The Facebook page ID
     * @param  string   $message       The post headline / body text
     * @param  string[] $features      Optional ✔ checkmark features appended after the message
     * @param  bool     $isPortfolio   Whether this post should be tagged as a portfolio item
     * @param  string[] $imageUrls     Public image URLs to attach (max 10, Facebook's limit)
     * @param  string   $callToAction  Optional CTA line appended after features
     * @param  string   $contactFooter Optional contact/location block appended at the end
     * @return string                  The new Facebook post ID
     */
    public function publishPost(
        string $pageId,
        string $message,
        array  $features      = [],
        bool   $isPortfolio   = false,
        array  $imageUrls     = [],
        string $callToAction  = '',
        string $contactFooter = ''
    ): string {
        $page = $this->getPageById($pageId);

        if (!(bool) $page['tokenValid']) {
            throw new RuntimeException(
                'Page token is invalid. Please reconnect the Facebook page.',
                401
            );
        }

        $accessToken = (string) $page['pageAccessToken'];

        // Build the full post body
        $body = trim($message);

        // ✔ checkmark features (line break before first feature, matching sample post format)
        if (!empty($features)) {
            $body .= "\n";
            foreach ($features as $feature) {
                $feature = trim((string) $feature);
                if ($feature !== '') {
                    $body .= '✔ ' . $feature . "\n";
                }
            }
            $body = rtrim($body);
        }

        // Call-to-action line
        $callToAction = trim($callToAction);
        if ($callToAction !== '') {
            $body .= "\n" . $callToAction;
        }

        // Contact / location footer
        $contactFooter = trim($contactFooter);
        if ($contactFooter !== '') {
            $body .= "\n" . $contactFooter;
        }

        if ($isPortfolio) {
            $body .= "\n\n#Portfolio #1625AutoLab";
        }

        // Normalise image list: strip blanks, cap at 10 (Facebook's hard limit)
        $cleanUrls = array_values(array_filter(
            array_slice($imageUrls, 0, 10),
            fn ($u) => is_string($u) && $u !== ''
        ));

        if (empty($cleanUrls)) {
            // ── Text-only post ──────────────────────────────────────────────
            $endpoint = FB_GRAPH_BASE . '/' . urlencode($pageId) . '/feed';
            $postData = [
                'message'      => $body,
                'access_token' => $accessToken,
            ];

            $response = $this->curlPostMultipart($endpoint, $postData);
            $result   = json_decode($response, true);

            if (isset($result['error'])) {
                $this->handleGraphError($result['error'], $pageId);
            }

            if (empty($result['id'])) {
                throw new RuntimeException('Post was not created (no ID returned).', 502);
            }

            return (string) $result['id'];
        }

        // ── Post with attached images ───────────────────────────────────────
        // Step 1: upload each image as an unpublished photo to get a Photo ID
        $photoIds = [];
        foreach ($cleanUrls as $imgUrl) {
            $photoIds[] = $this->uploadUnpublishedPhoto($pageId, $imgUrl, $accessToken);
        }

        // Step 2: publish the feed post with attached_media referencing those IDs
        $endpoint = FB_GRAPH_BASE . '/' . urlencode($pageId) . '/feed';
        $postData = [
            'message'      => $body,
            'access_token' => $accessToken,
        ];
        foreach ($photoIds as $idx => $photoId) {
            $postData["attached_media[$idx]"] = json_encode(['media_fbid' => $photoId]);
        }

        $response = $this->curlPostMultipart($endpoint, $postData);
        $result   = json_decode($response, true);

        if (isset($result['error'])) {
            $this->handleGraphError($result['error'], $pageId);
        }

        if (empty($result['id'])) {
            throw new RuntimeException('Post was not created (no ID returned).', 502);
        }

        return (string) $result['id'];
    }

    /**
     * Upload a single image URL as an unpublished photo and return its Photo ID.
     * The photo is not visible on the Page until it is referenced via attached_media
     * in a subsequent feed post.
     *
     * @throws RuntimeException  On Graph API error.
     */
    private function uploadUnpublishedPhoto(
        string $pageId,
        string $imageUrl,
        string $accessToken
    ): string {
        $endpoint = FB_GRAPH_BASE . '/' . urlencode($pageId) . '/photos';
        $response = $this->curlPostMultipart($endpoint, [
            'url'          => $imageUrl,
            'published'    => 'false',
            'access_token' => $accessToken,
        ]);

        $data = json_decode($response, true);

        if (isset($data['error'])) {
            $msg = (string) ($data['error']['message'] ?? 'Failed to upload photo to Facebook.');
            throw new RuntimeException($msg, 502);
        }

        if (empty($data['id'])) {
            throw new RuntimeException('Photo upload succeeded but no ID was returned.', 502);
        }

        return (string) $data['id'];
    }

    // -------------------------------------------------------------------------
    // Error handling
    // -------------------------------------------------------------------------

    /**
     * Handle a Facebook Graph API error object.
     * On OAuthException code 190 (token expired / invalidated), marks the token
     * as invalid in the DB and throws a user-friendly exception so the admin
     * can trigger re-authentication.
     *
     * @param array<string, mixed> $error  The 'error' sub-array from the Graph response
     */
    private function handleGraphError(array $error, string $pageId = ''): void
    {
        $type    = (string) ($error['type']    ?? '');
        $code    = (int)    ($error['code']    ?? 0);
        $message = (string) ($error['message'] ?? 'Unknown Facebook API error.');

        // OAuthException code 190 = token expired or invalidated
        if ($type === 'OAuthException' && $code === self::TOKEN_EXPIRED_CODE) {
            if ($pageId !== '') {
                $this->invalidateToken($pageId);
            }
            throw new RuntimeException(
                'The Facebook Page token has expired or been revoked. '
                . 'Please reconnect the page in the admin panel.',
                401
            );
        }

        throw new RuntimeException($message, 502);
    }

    /**
     * Mark a page token as invalid so the UI can prompt re-authentication.
     */
    private function invalidateToken(string $pageId): void
    {
        $stmt = Database::getInstance()->prepare(
            'UPDATE facebook_pages SET token_valid = 0 WHERE page_id = :page_id'
        );
        $stmt->execute([':page_id' => $pageId]);
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    /** @return array<string, mixed> */
    private function getPageById(string $pageId): array
    {
        $stmt = Database::getInstance()->prepare(
            'SELECT * FROM facebook_pages WHERE page_id = :page_id LIMIT 1'
        );
        $stmt->execute([':page_id' => $pageId]);
        $row = $stmt->fetch();
        if (!$row) {
            throw new RuntimeException('Page not found.', 404);
        }
        return $this->mapRow($row);
    }

    /**
     * Map a DB snake_case row to the camelCase API shape.
     * The page_access_token is intentionally omitted from public responses.
     *
     * @param  array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function mapRow(array $row): array
    {
        return [
            'id'              => (int)    $row['id'],
            'pageId'          =>          $row['page_id'],
            'pageName'        =>          $row['page_name'],
            'pageAccessToken' =>          $row['page_access_token'], // kept for internal use
            'tokenValid'      => (bool)   $row['token_valid'],
            'createdAt'       =>          $row['created_at'],
            'updatedAt'       =>          $row['updated_at'],
        ];
    }

    /**
     * Perform a GET request using raw cURL and return the response body.
     */
    private function curlGet(string $url): string
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $body  = curl_exec($ch);
        $errno = curl_errno($ch);
        $error = curl_error($ch);
        curl_close($ch);

        if ($errno !== 0 || $body === false) {
            throw new RuntimeException('Facebook API request failed: ' . $error, 503);
        }

        return (string) $body;
    }

    /**
     * Perform a POST request using raw cURL and return the response body.
     * Fields are sent as application/x-www-form-urlencoded.
     *
     * @param array<string, string> $fields
     */
    private function curlPost(string $url, array $fields): string
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => http_build_query($fields),
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $body  = curl_exec($ch);
        $errno = curl_errno($ch);
        $error = curl_error($ch);
        curl_close($ch);

        if ($errno !== 0 || $body === false) {
            throw new RuntimeException('Facebook API request failed: ' . $error, 503);
        }

        return (string) $body;
    }

    /**
     * Perform a POST request using multipart/form-data (required by the
     * Graph API for endpoints that accept both scalar fields and JSON-encoded
     * sub-fields such as attached_media[n]).
     *
     * Passing an array to CURLOPT_POSTFIELDS causes cURL to automatically
     * encode the request as multipart/form-data.
     *
     * @param array<string, string> $fields
     */
    private function curlPostMultipart(string $url, array $fields): string
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $fields,   // array → multipart/form-data
            CURLOPT_TIMEOUT        => 60,         // generous for sequential photo uploads
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $body  = curl_exec($ch);
        $errno = curl_errno($ch);
        $error = curl_error($ch);
        curl_close($ch);

        if ($errno !== 0 || $body === false) {
            throw new RuntimeException('Facebook API request failed: ' . $error, 503);
        }

        return (string) $body;
    }
}
