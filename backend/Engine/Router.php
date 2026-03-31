<?php

declare(strict_types=1);

use FastRoute\Dispatcher;
use function FastRoute\simpleDispatcher;

/**
 * Front-controller router using nikic/fast-route.
 *
 * Resolves the request path/method to the appropriate handler and converts
 * any RuntimeException into a structured JSON error response.
 */
class Router
{
    /** @var array<string, string[]>|null */
    private ?array $rolePermissionsCache = null;

    /** @var array<string, string[]> */
    private const FALLBACK_ROLE_PERMISSIONS = [
        'admin' => [
            'analytics:view',
            'bookings:manage',
            'bookings:assign-tech',
            'bookings:notes',
            'build-updates:manage',
            'clients:manage',
            'users:manage',
            'roles:view',
            'roles:manage',
            'reviews:manage',
            'services:manage',
            'products:manage',
            'content:manage',
            'settings:manage',
            'shop-hours:manage',
            'media:upload',
        ],
        'manager' => [
            'analytics:view',
            'bookings:manage',
            'bookings:assign-tech',
            'bookings:notes',
            'build-updates:manage',
            'clients:manage',
            'security:audit:view',
            'roles:view',
            'reviews:manage',
            'services:manage',
            'products:manage',
            'media:upload',
        ],
        'staff' => [
            'bookings:manage',
            'build-updates:manage',
            'clients:manage',
            'roles:view',
            'media:upload',
        ],
        'client' => ['client:self'],
    ];

    public function dispatch(): void
    {
        header('Content-Type: application/json');

        $dispatcher = simpleDispatcher(function (FastRoute\RouteCollector $r): void {
            // ── Public ──────────────────────────────────────────────────────
            $r->addRoute('GET',  '/health',             'handleHealth');
            $r->addRoute('GET',  '/api/posts',          'handlePosts');

            // ── Services (public read, admin write) ─────────────────────────
            $r->addRoute('GET',    '/api/services',                   'handleServiceList');
            $r->addRoute('GET',    '/api/services/{id:\d+}',          'handleServiceGet');
            $r->addRoute('GET',    '/api/services/{slug:[a-z0-9]+(?:-[a-z0-9]+)*}', 'handleServiceGetBySlug');
            $r->addRoute('POST',   '/api/services',                   'handleServiceCreate');
            $r->addRoute('PUT',    '/api/services/{id:\d+}',          'handleServiceUpdate');
            $r->addRoute('DELETE', '/api/services/{id:\d+}',          'handleServiceDelete');
            // Service variations (admin write, public read via parent service)
            $r->addRoute('GET',    '/api/services/{id:\d+}/variations',              'handleServiceVariationList');
            $r->addRoute('POST',   '/api/services/{id:\d+}/variations',              'handleServiceVariationCreate');
            $r->addRoute('PUT',    '/api/services/{id:\d+}/variations/{vid:\d+}',    'handleServiceVariationUpdate');
            $r->addRoute('DELETE', '/api/services/{id:\d+}/variations/{vid:\d+}',    'handleServiceVariationDelete');

            // ── Auth ────────────────────────────────────────────────────────
            $r->addRoute('POST', '/api/auth/register',         'handleAuthRegister');
            $r->addRoute('POST', '/api/auth/login',            'handleAuthLogin');
            $r->addRoute('POST', '/api/auth/logout',           'handleAuthLogout');
            $r->addRoute('GET',  '/api/auth/me',               'handleAuthMe');
            $r->addRoute('PUT',  '/api/auth/profile',          'handleAuthProfile');
            $r->addRoute('POST', '/api/auth/avatar-upload',    'handleAuthAvatarUpload');
            $r->addRoute('POST', '/api/auth/forgot-password',  'handleAuthForgotPassword');
            $r->addRoute('POST', '/api/auth/reset-password',   'handleAuthResetPassword');
            $r->addRoute('GET',  '/api/auth/sessions',         'handleAuthSessionList');
            $r->addRoute('DELETE', '/api/auth/sessions/revoke-others', 'handleAuthSessionRevokeOthers');
            $r->addRoute('DELETE', '/api/auth/sessions/{id:\d+}', 'handleAuthSessionRevoke');

            // ── Bookings ────────────────────────────────────────────────────
            $r->addRoute('POST',  '/api/bookings',                  'handleBookingCreate');
            $r->addRoute('POST',  '/api/booking/external',          'handleBookingExternalCreate');
            $r->addRoute('GET',   '/api/bookings',                  'handleBookingList');
            $r->addRoute('GET',   '/api/bookings/mine',             'handleBookingMine');
            $r->addRoute('GET',   '/api/bookings/availability',     'handleBookingAvailability');
            $r->addRoute('POST',  '/api/bookings/media',            'handleBookingMediaUpload');
            $r->addRoute('GET',   '/api/bookings/{id}',             'handleBookingGet');
            $r->addRoute('PATCH', '/api/bookings/{id}',             'handleBookingUpdate');
            $r->addRoute('PATCH', '/api/bookings/{id}/assign-tech', 'handleBookingAssignTech');
            $r->addRoute('PATCH', '/api/bookings/{id}/cancel',      'handleBookingCancel');
            $r->addRoute('PATCH', '/api/bookings/{id}/reschedule',        'handleBookingReschedule');
            $r->addRoute('PATCH', '/api/bookings/{id}/admin-reschedule', 'handleAdminBookingReschedule');
            $r->addRoute('PATCH', '/api/bookings/{id}/parts',             'handleBookingPartsUpdate');
            $r->addRoute('PATCH', '/api/bookings/{id}/qa-photos',         'handleBookingQaPhotosUpdate');
            $r->addRoute('PATCH', '/api/bookings/{id}/notes',             'handleBookingInternalNotes');
            $r->addRoute('GET',   '/api/bookings/{id}/activity',          'handleBookingActivityList');

            // ── Build updates (progress photos – admin write, owner read) ────
            $r->addRoute('GET',  '/api/bookings/{id}/build-updates',       'handleBuildUpdateList');
            $r->addRoute('POST', '/api/bookings/{id}/build-updates',       'handleBuildUpdateCreate');
            $r->addRoute('POST', '/api/bookings/{id}/build-updates/media', 'handleBuildUpdateMediaUpload');

            // ── Reviews (client write after completed, admin moderate) ───────
            $r->addRoute('GET',    '/api/reviews/published',        'handlePublishedReviewList');
            $r->addRoute('GET',    '/api/bookings/{id}/review',    'handleBookingReviewGet');
            $r->addRoute('POST',   '/api/bookings/{id}/review',    'handleBookingReviewCreate');
            $r->addRoute('GET',    '/api/reviews',                 'handleReviewList');
            $r->addRoute('PATCH',  '/api/reviews/{id:\d+}/approve','handleReviewApprove');
            $r->addRoute('PATCH',  '/api/reviews/{id:\d+}/reject', 'handleReviewReject');
            $r->addRoute('DELETE', '/api/reviews/{id:\d+}',        'handleReviewDelete');

            // ── In-app notifications ────────────────────────────────────────
            $r->addRoute('GET',    '/api/notifications',              'handleNotificationList');
            $r->addRoute('PATCH',  '/api/notifications/read-all',     'handleNotificationReadAll');
            $r->addRoute('PATCH',  '/api/notifications/{id:\d+}/read','handleNotificationRead');
            $r->addRoute('DELETE', '/api/notifications/{id:\d+}',     'handleNotificationDelete');

            // ── Notification preferences ─────────────────────────────────────
            $r->addRoute('GET', '/api/auth/notification-preferences', 'handleNotificationPrefsGet');
            $r->addRoute('PUT', '/api/auth/notification-preferences', 'handleNotificationPrefsSave');

            // ── Customer loyalty stats ────────────────────────────────────────
            $r->addRoute('GET', '/api/customers/{userId:\d+}/stats', 'handleCustomerStats');

            // ── Client vehicle garage ─────────────────────────────────────────
            $r->addRoute('GET',    '/api/client/vehicles',          'handleClientVehicleList');
            $r->addRoute('POST',   '/api/client/vehicles',          'handleClientVehicleCreate');
            $r->addRoute('POST',   '/api/client/vehicles/media',    'handleClientVehicleMediaUpload');
            $r->addRoute('PUT',    '/api/client/vehicles/{id:\d+}', 'handleClientVehicleUpdate');
            $r->addRoute('DELETE', '/api/client/vehicles/{id:\d+}', 'handleClientVehicleDelete');

            // ── Blog posts (public read, admin write) ───────────────────────
            $r->addRoute('GET',    '/api/blog',              'handleBlogList');
            $r->addRoute('GET',    '/api/blog/{id:\d+}',     'handleBlogGet');
            $r->addRoute('POST',   '/api/blog',              'handleBlogCreate');
            $r->addRoute('PUT',    '/api/blog/{id:\d+}',     'handleBlogUpdate');
            $r->addRoute('DELETE', '/api/blog/{id:\d+}',     'handleBlogDelete');

            // ── Products (public read, admin write) ─────────────────────────
            $r->addRoute('GET',    '/api/products',          'handleProductList');
            $r->addRoute('GET',    '/api/products/{id:\d+}', 'handleProductGet');
            $r->addRoute('POST',   '/api/products',          'handleProductCreate');
            $r->addRoute('PUT',    '/api/products/{id:\d+}', 'handleProductUpdate');
            $r->addRoute('DELETE', '/api/products/{id:\d+}', 'handleProductDelete');
            // Product variations (admin write, public read via parent product)
            $r->addRoute('GET',    '/api/products/{id:\d+}/variations',              'handleProductVariationList');
            $r->addRoute('POST',   '/api/products/{id:\d+}/variations',              'handleProductVariationCreate');
            $r->addRoute('PUT',    '/api/products/{id:\d+}/variations/{vid:\d+}',    'handleProductVariationUpdate');
            $r->addRoute('DELETE', '/api/products/{id:\d+}/variations/{vid:\d+}',    'handleProductVariationDelete');

            // ── Portfolio (public read, admin write) ─────────────────────────
            $r->addRoute('GET',    '/api/portfolio',                          'handlePortfolioList');
            $r->addRoute('GET',    '/api/portfolio/{id:\d+}',                 'handlePortfolioGet');
            $r->addRoute('GET',    '/api/portfolio/slug/{slug}',               'handlePortfolioGetBySlug');
            $r->addRoute('POST',   '/api/portfolio',                          'handlePortfolioCreate');
            $r->addRoute('PUT',    '/api/portfolio/{id:\d+}',                 'handlePortfolioUpdate');
            $r->addRoute('DELETE', '/api/portfolio/{id:\d+}',                 'handlePortfolioDelete');

            // ── Portfolio Categories (public read, admin write) ───────────────
            $r->addRoute('GET',    '/api/portfolio-categories',               'handlePortfolioCategoryList');
            $r->addRoute('GET',    '/api/portfolio-categories/{id:\d+}',      'handlePortfolioCategoryGet');
            $r->addRoute('POST',   '/api/portfolio-categories',               'handlePortfolioCategoryCreate');
            $r->addRoute('PUT',    '/api/portfolio-categories/{id:\d+}',      'handlePortfolioCategoryUpdate');
            $r->addRoute('DELETE', '/api/portfolio-categories/{id:\d+}',      'handlePortfolioCategoryDelete');

            // ── Shop hours ──────────────────────────────────────────────────
            $r->addRoute('GET', '/api/shop/hours',                       'handleShopHoursGet');
            $r->addRoute('PUT', '/api/shop/hours',                       'handleShopHoursPut');
            $r->addRoute('GET',    '/api/shop/closed-dates',             'handleShopClosedDatesGet');
            $r->addRoute('POST',   '/api/shop/closed-dates',             'handleShopClosedDatesAdd');
            $r->addRoute('DELETE', '/api/shop/closed-dates/{date}',      'handleShopClosedDatesRemove');

            // ── Site settings (public read, admin write) ─────────────────────
            $r->addRoute('GET', '/api/site-settings', 'handleSiteSettingsGet');
            $r->addRoute('PUT', '/api/site-settings', 'handleSiteSettingsPut');

            // ── Team members (public read, admin write) ──────────────────────
            $r->addRoute('GET',    '/api/team-members',          'handleTeamMemberList');
            $r->addRoute('POST',   '/api/team-members',          'handleTeamMemberCreate');
            $r->addRoute('PUT',    '/api/team-members/{id:\d+}', 'handleTeamMemberUpdate');
            $r->addRoute('DELETE', '/api/team-members/{id:\d+}', 'handleTeamMemberDelete');

            // ── Testimonials (public read, admin write) ──────────────────────
            $r->addRoute('GET',    '/api/testimonials',          'handleTestimonialList');
            $r->addRoute('POST',   '/api/testimonials',          'handleTestimonialCreate');
            $r->addRoute('PUT',    '/api/testimonials/{id:\d+}', 'handleTestimonialUpdate');
            $r->addRoute('DELETE', '/api/testimonials/{id:\d+}', 'handleTestimonialDelete');

            // ── FAQ ──────────────────────────────────────────────────────────────
            $r->addRoute('GET',    '/api/faq',              'handleFaqList');
            $r->addRoute('POST',   '/api/faq',              'handleFaqCreate');
            $r->addRoute('PUT',    '/api/faq/{id:\d+}',     'handleFaqUpdate');
            $r->addRoute('DELETE', '/api/faq/{id:\d+}',     'handleFaqDelete');

            // ── Offers (public read, admin write) ────────────────────────────
            $r->addRoute('GET',    '/api/offers',          'handleOfferList');
            $r->addRoute('GET',    '/api/offers/{id:\d+}', 'handleOfferGet');
            $r->addRoute('POST',   '/api/offers',          'handleOfferCreate');
            $r->addRoute('PUT',    '/api/offers/{id:\d+}', 'handleOfferUpdate');
            $r->addRoute('DELETE', '/api/offers/{id:\d+}', 'handleOfferDelete');

            // ── Before/After (public read, admin write) ─────────────────────
            $r->addRoute('GET',    '/api/before-after',          'handleBeforeAfterList');
            $r->addRoute('GET',    '/api/before-after/{id:\d+}', 'handleBeforeAfterGet');
            $r->addRoute('POST',   '/api/before-after',          'handleBeforeAfterCreate');
            $r->addRoute('PUT',    '/api/before-after/{id:\d+}', 'handleBeforeAfterUpdate');
            $r->addRoute('DELETE', '/api/before-after/{id:\d+}', 'handleBeforeAfterDelete');

            // ── Contact message (public) ─────────────────────────────────────
            $r->addRoute('POST', '/api/contact', 'handleContactMessage');

            // ── Admin utilities ─────────────────────────────────────────────
            $r->addRoute('POST', '/api/admin/migrate', 'handleMigrateRun');
            $r->addRoute('GET',  '/api/admin/migrate', 'handleMigrateStatus');
            $r->addRoute('GET',  '/api/admin/stats',   'handleAdminStats');
            $r->addRoute('POST', '/api/admin/upload',  'handleAdminMediaUpload');
            $r->addRoute('GET',  '/api/admin/users',   'handleAdminUserList');
            $r->addRoute('POST', '/api/admin/users',   'handleAdminUserCreate');
            $r->addRoute('PATCH', '/api/admin/users/{id:\d+}/role', 'handleAdminUserRoleUpdate');
            $r->addRoute('GET',  '/api/admin/clients', 'handleAdminClientList');
            $r->addRoute('GET',  '/api/admin/roles',   'handleAdminRoleList');
            $r->addRoute('GET',  '/api/admin/roles/audit', 'handleAdminRoleAuditList');
            $r->addRoute('GET',  '/api/admin/security/audit', 'handleAdminSecurityAuditList');
            $r->addRoute('GET',  '/api/admin/security/audit/export', 'handleAdminSecurityAuditExport');
            $r->addRoute('POST', '/api/admin/roles',   'handleAdminRoleCreate');
            $r->addRoute('PUT',  '/api/admin/roles/{id:\d+}', 'handleAdminRoleUpdate');
            $r->addRoute('DELETE', '/api/admin/roles/{id:\d+}', 'handleAdminRoleDelete');

            // ── Vehicle data (API Ninjas proxy) ──────────────────────────────
            $r->addRoute('GET', '/api/vehicles/makes',  'handleVehicleMakes');
            $r->addRoute('GET', '/api/vehicles/models', 'handleVehicleModels');
            $r->addRoute('GET', '/api/vehicles/trims',  'handleVehicleTrims');
        });

        $path   = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

        $routeInfo = $dispatcher->dispatch($method, $path);

        try {
            switch ($routeInfo[0]) {
                case Dispatcher::FOUND:
                    $this->{$routeInfo[1]}($routeInfo[2]);
                    break;

                case Dispatcher::METHOD_NOT_ALLOWED:
                    http_response_code(405);
                    echo json_encode(['detail' => 'Method Not Allowed']);
                    break;

                default:
                    http_response_code(404);
                    echo json_encode(['detail' => 'Not Found']);
            }
        } catch (RuntimeException $e) {
            http_response_code((int) $e->getCode() ?: 500);
            echo json_encode(['detail' => $e->getMessage()]);
        } catch (\Throwable $e) {
            // Catches PDOException and any other uncaught error so PHP never
            // emits a fatal-error HTML page inside a JSON API.
            http_response_code(500);
            echo json_encode(['detail' => 'Internal server error: ' . $e->getMessage()]);
        }
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /** @return array<string, mixed> */
    private function jsonBody(): array
    {
        $raw = file_get_contents('php://input') ?: '{}';
        $data = json_decode($raw, true);
        return is_array($data) ? $data : [];
    }

    /**
     * Require a valid Bearer JWT and return its payload.
     * Optionally enforce a specific role.
     *
     * @return array<string, mixed>
     */
    private function requireAuth(?string $role = null): array
    {
        $payload = Auth::user();

        if ($role !== null && ($payload['role'] ?? '') !== $role) {
            throw new RuntimeException('Forbidden.', 403);
        }

        return $payload;
    }

    /**
     * Require one of the provided roles.
     *
     * @param string[] $roles
     * @return array<string, mixed>
     */
    private function requireRoles(array $roles): array
    {
        $payload = Auth::user();
        $role = (string) ($payload['role'] ?? '');

        if (!in_array($role, $roles, true)) {
            throw new RuntimeException('Forbidden.', 403);
        }

        return $payload;
    }

    private function isBackofficeRole(string $role): bool
    {
        return in_array($role, ['admin', 'manager', 'staff'], true);
    }

    private function getClientIp(): string
    {
        $candidates = [
            $_SERVER['HTTP_CF_CONNECTING_IP'] ?? null,
            $_SERVER['HTTP_X_FORWARDED_FOR'] ?? null,
            $_SERVER['REMOTE_ADDR'] ?? null,
        ];

        foreach ($candidates as $candidate) {
            if (!is_string($candidate) || trim($candidate) === '') {
                continue;
            }

            $first = trim(explode(',', $candidate)[0]);
            if ($first !== '') {
                return substr($first, 0, 64);
            }
        }

        return '';
    }

    private function getUserAgent(): string
    {
        $ua = trim((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''));
        if ($ua === '') {
            return '';
        }

        return mb_substr($ua, 0, 500);
    }

    private function formatRetryAfterHuman(int $seconds): string
    {
        $seconds = max(0, $seconds);
        $minutes = intdiv($seconds, 60);
        $remain = $seconds % 60;

        if ($minutes <= 0) {
            return $remain . ' second' . ($remain === 1 ? '' : 's');
        }

        if ($remain === 0) {
            return $minutes . ' minute' . ($minutes === 1 ? '' : 's');
        }

        return $minutes . ' minute' . ($minutes === 1 ? '' : 's')
            . ' ' . $remain . ' second' . ($remain === 1 ? '' : 's');
    }

    /** @return array<string, string[]> */
    private function getPermissionMap(): array
    {
        if ($this->rolePermissionsCache !== null) {
            return $this->rolePermissionsCache;
        }

        $map = self::FALLBACK_ROLE_PERMISSIONS;

        try {
            $roles = (new UserService())->listRoles();
            if (!empty($roles)) {
                $dynamic = [];
                foreach ($roles as $role) {
                    $key = strtolower(trim((string) ($role['key'] ?? '')));
                    if ($key === '') {
                        continue;
                    }

                    $permissions = is_array($role['permissions'] ?? null)
                        ? array_values(array_filter(array_map('strval', $role['permissions']), static fn (string $v): bool => $v !== ''))
                        : [];

                    $dynamic[$key] = $permissions;
                }

                if (!empty($dynamic)) {
                    $map = $dynamic;
                }
            }
        } catch (\Throwable) {
            // Keep static fallback map when role records are unavailable.
        }

        $this->rolePermissionsCache = $map;
        return $map;
    }

    private function hasPermissionByRole(string $role, string $permission): bool
    {
        $role = strtolower(trim($role));
        if ($role === '') {
            return false;
        }

        $permissions = $this->getPermissionMap()[$role] ?? [];
        if ($role === 'admin') {
            return true;
        }

        return in_array($permission, $permissions, true);
    }

    /** @param array<string, mixed> $payload */
    private function hasPermission(array $payload, string $permission): bool
    {
        return $this->hasPermissionByRole((string) ($payload['role'] ?? ''), $permission);
    }

    /**
     * @param array<string, mixed> $payload
     * @param string[] $permissions
     */
    private function hasAnyPermission(array $payload, array $permissions): bool
    {
        foreach ($permissions as $permission) {
            if ($this->hasPermission($payload, $permission)) {
                return true;
            }
        }

        return false;
    }

    /** @return array<string, mixed> */
    private function requirePermission(string $permission): array
    {
        $payload = Auth::user();
        if (!$this->hasPermission($payload, $permission)) {
            throw new RuntimeException('Forbidden.', 403);
        }

        return $payload;
    }

    // -------------------------------------------------------------------------
    // Public handlers
    // -------------------------------------------------------------------------

    /** @param array<string, string> $vars */
    private function handleHealth(array $vars = []): void
    {
        echo json_encode(['status' => 'ok']);
    }

    /** @param array<string, string> $vars */
    private function handlePosts(array $vars = []): void
    {
        if (FB_ACCESS_TOKEN === '') {
            throw new RuntimeException('FB_ACCESS_TOKEN is not configured on the server.', 500);
        }

        $limit = max(1, min(100, (int) ($_GET['limit'] ?? 10)));
        $after = (isset($_GET['after']) && $_GET['after'] !== '') ? (string) $_GET['after'] : null;

        $cacheKey = 'apollo_posts_' . $limit;
        if ($after === null && CACHE_TTL_SECONDS > 0) {
            $cached = Cache::get($cacheKey);
            if ($cached !== null) {
                echo json_encode($cached);
                return;
            }
        }

        $service = new FacebookService();
        $result  = $service->getPosts($limit, $after);

        if ($after === null && CACHE_TTL_SECONDS > 0) {
            Cache::set($cacheKey, $result, CACHE_TTL_SECONDS);
        }

        echo json_encode($result);
    }

    // -------------------------------------------------------------------------
    // Auth handlers
    // -------------------------------------------------------------------------

    /** @param array<string, string> $vars */
    private function handleAuthRegister(array $vars = []): void
    {
        $data   = $this->jsonBody();
        $result = (new UserService())->register($data);
        http_response_code(201);
        echo json_encode($result);
    }

    /** @param array<string, string> $vars */
    private function handleAuthLogin(array $vars = []): void
    {
        $data   = $this->jsonBody();
        $email  = (string) ($data['email']    ?? '');
        $pass   = (string) ($data['password'] ?? '');
        $security = null;
        $ip = $this->getClientIp();
        $ua = $this->getUserAgent();

        if (DB_NAME !== '') {
            $security = new AuthSecurityService();
            $retryAfter = $security->getRetryAfterSeconds($email, $ip);
            if ($retryAfter > 0) {
                header('Retry-After: ' . (string) $retryAfter);
                $security->recordBlockedLoginAttempt(
                    $email,
                    $ip,
                    $ua,
                    $retryAfter,
                    'Blocked before credential verification.'
                );

                if ($security->isSuspiciousLogin($email, $ip) && $security->shouldSendSuspiciousAlert($email, $ip)) {
                    (new UserNotificationService())->createForAdmin(
                        'status_changed',
                        'Suspicious Login Pattern',
                        'Repeated login failures detected for ' . strtolower(trim($email)) . ' from IP ' . ($ip !== '' ? $ip : 'unknown') . '.',
                        ['email' => strtolower(trim($email)), 'ipAddress' => $ip]
                    );
                    $security->markSuspiciousAlertSent($email, $ip, $ua, 'Admin suspicious login alert sent.');
                }

                throw new RuntimeException('Too many failed attempts. Try again in ' . $this->formatRetryAfterHuman($retryAfter) . '.', 429);
            }
        }

        try {
            $result = (new UserService())->login($email, $pass);

            if ($security !== null) {
                $payload = Auth::decodeToken((string) ($result['token'] ?? ''));
                $uid = (int) ($payload['sub'] ?? 0);
                $exp = (int) ($payload['exp'] ?? (time() + JWT_TTL));

                $security->recordLoginAttempt($email, true, $uid > 0 ? $uid : null, $ip, $ua, 'Login successful.');
                if ($uid > 0) {
                    $security->createSession($uid, (string) $result['token'], $exp, $ip, $ua);
                }

                if ($security->isSuspiciousLogin($email, $ip) && $security->shouldSendSuspiciousAlert($email, $ip)) {
                    (new UserNotificationService())->createForAdmin(
                        'status_changed',
                        'Suspicious Login Pattern',
                        'Repeated login failures detected for ' . strtolower(trim($email)) . ' from IP ' . ($ip !== '' ? $ip : 'unknown') . '.',
                        ['email' => strtolower(trim($email)), 'ipAddress' => $ip]
                    );
                    $security->markSuspiciousAlertSent($email, $ip, $ua, 'Admin suspicious login alert sent.');
                }
            }

            echo json_encode($result);
        } catch (RuntimeException $e) {
            if ($security !== null) {
                $security->recordLoginAttempt($email, false, null, $ip, $ua, $e->getMessage());

                $retryAfter = $security->getRetryAfterSeconds($email, $ip);
                if ($retryAfter > 0) {
                    header('Retry-After: ' . (string) $retryAfter);
                }

                if ($security->isSuspiciousLogin($email, $ip) && $security->shouldSendSuspiciousAlert($email, $ip)) {
                    (new UserNotificationService())->createForAdmin(
                        'status_changed',
                        'Suspicious Login Pattern',
                        'Repeated login failures detected for ' . strtolower(trim($email)) . ' from IP ' . ($ip !== '' ? $ip : 'unknown') . '.',
                        ['email' => strtolower(trim($email)), 'ipAddress' => $ip]
                    );
                    $security->markSuspiciousAlertSent($email, $ip, $ua, 'Admin suspicious login alert sent.');
                }
            }

            throw $e;
        }
    }

    /** @param array<string, string> $vars */
    private function handleAuthLogout(array $vars = []): void
    {
        $token = Auth::tokenFromHeader();
        if ($token !== null) {
            if (DB_NAME !== '') {
                (new AuthSecurityService())->endSessionByToken($token, 'logout');
            }
            Auth::logout($token);
        }
        echo json_encode(['message' => 'Logged out successfully.']);
    }

    /** @param array<string, string> $vars */
    private function handleAuthSessionList(array $vars = []): void
    {
        if (DB_NAME === '') {
            echo json_encode(['sessions' => []]);
            return;
        }

        $payload = $this->requireAuth();
        $userId = (int) ($payload['sub'] ?? 0);
        $token = Auth::tokenFromHeader();
        $currentHash = $token !== null ? hash('sha256', $token) : null;

        $sessions = (new AuthSecurityService())->listSessions($userId, $currentHash);
        echo json_encode(['sessions' => $sessions]);
    }

    /** @param array<string, string> $vars */
    private function handleAuthSessionRevoke(array $vars = []): void
    {
        if (DB_NAME === '') {
            echo json_encode(['ok' => true]);
            return;
        }

        $payload = $this->requireAuth();
        $userId = (int) ($payload['sub'] ?? 0);
        $sessionId = (int) ($vars['id'] ?? 0);
        if ($sessionId <= 0) {
            throw new RuntimeException('Invalid session id.', 422);
        }

        $ok = (new AuthSecurityService())->revokeSessionById($userId, $sessionId);
        if (!$ok) {
            throw new RuntimeException('Session not found.', 404);
        }

        echo json_encode(['ok' => true]);
    }

    /** @param array<string, string> $vars */
    private function handleAuthSessionRevokeOthers(array $vars = []): void
    {
        if (DB_NAME === '') {
            echo json_encode(['revoked' => 0]);
            return;
        }

        $payload = $this->requireAuth();
        $userId = (int) ($payload['sub'] ?? 0);
        $token = Auth::tokenFromHeader();
        if ($token === null) {
            throw new RuntimeException('Unauthenticated.', 401);
        }

        $currentHash = hash('sha256', $token);
        $revoked = (new AuthSecurityService())->revokeOtherSessions($userId, $currentHash);

        echo json_encode(['revoked' => $revoked]);
    }

    /** @param array<string, string> $vars */
    private function handleAuthMe(array $vars = []): void
    {
        $payload = $this->requireAuth();
        $user    = (new UserService())->findById((int) $payload['sub']);
        echo json_encode(['user' => $user]);
    }

    /** @param array<string, string> $vars */
    private function handleAuthProfile(array $vars = []): void
    {
        $payload = $this->requireAuth();
        $data    = $this->jsonBody();
        $user    = (new UserService())->updateProfile((int) $payload['sub'], $data);
        echo json_encode(['user' => $user]);
    }

    /** @param array<string, string> $vars */
    private function handleAuthAvatarUpload(array $vars = []): void
    {
        $this->requireAuth();

        if (empty($_FILES['file'])) {
            throw new RuntimeException('No file provided.', 422);
        }

        $file     = $_FILES['file'];
        $tmpName  = $file['tmp_name'];
        $mime     = $file['type'];
        $size     = $file['size'];
        $error    = $file['error'];

        if ($error !== UPLOAD_ERR_OK) {
            throw new RuntimeException("File upload error (code $error).", 422);
        }
        $allowed_mimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!in_array($mime, $allowed_mimes, true) || !@getimagesize($tmpName)) {
            throw new RuntimeException('Only JPEG, PNG, WebP and GIF images are accepted.', 422);
        }
        $maxBytes = UPLOAD_MAX_MB * 1024 * 1024;
        if ($size > $maxBytes) {
            throw new RuntimeException('File must be under ' . UPLOAD_MAX_MB . ' MB.', 422);
        }

        $ext      = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $filename = bin2hex(random_bytes(16)) . '.' . $ext;

        $storage = new UploadStorage();
        $url     = $storage->upload($tmpName, $filename, $mime, 'users/');

        echo json_encode(['url' => $url]);
    }

    /** @param array<string, string> $vars */
    private function handleAuthForgotPassword(array $vars = []): void
    {
        $data  = $this->jsonBody();
        $email = strtolower(trim((string) ($data['email'] ?? '')));

        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new RuntimeException('A valid email address is required.', 422);
        }

        $token = Auth::generatePasswordResetToken($email);

        if ($token !== null) {
            $resetUrl = APP_URL . '/reset-password?token=' . urlencode($token);
            (new NotificationService())->passwordReset($email, $resetUrl);
        }

        // Always return 200 to prevent email enumeration
        echo json_encode(['message' => 'If that email is registered, a reset link has been sent.']);
    }

    /** @param array<string, string> $vars */
    private function handleAuthResetPassword(array $vars = []): void
    {
        $data     = $this->jsonBody();
        $token    = trim((string) ($data['token']    ?? ''));
        $password = (string) ($data['password']       ?? '');
        $confirm  = (string) ($data['passwordConfirm'] ?? '');

        if ($token === '') {
            throw new RuntimeException('Reset token is required.', 422);
        }
        if ($password !== $confirm) {
            throw new RuntimeException('Passwords do not match.', 422);
        }

        Auth::resetPassword($token, $password);
        echo json_encode(['message' => 'Your password has been updated. You can now sign in.']);
    }

    // -------------------------------------------------------------------------
    // Booking handlers
    // -------------------------------------------------------------------------


    /**
     * Handle external booking creation (chatbot, integrations, etc).
     * Accepts a JSON payload and sets source to 'chatbot'.
     * No authentication required.
     * @param array<string, string> $vars
     */
    private function handleBookingExternalCreate(array $vars = []): void
    {
        $data = $this->jsonBody();
        $data['source'] = 'chatbot';
        $booking = (new BookingService())->create($data, null);
        http_response_code(201);
        echo json_encode(['booking' => $booking]);
    }

    /** @param array<string, string> $vars */
    private function handleBookingList(array $vars = []): void
    {
        $this->requirePermission('bookings:manage');
        $bookings = (new BookingService())->getAll();
        echo json_encode(['bookings' => $bookings]);
    }

    /** @param array<string, string> $vars */
    private function handleBookingMine(array $vars = []): void
    {
        $payload  = $this->requireAuth();
        $bookings = (new BookingService())->getByUserId((int) $payload['sub']);
        echo json_encode(['bookings' => $bookings]);
    }

    /** @param array<string, string> $vars */
    private function handleBookingGet(array $vars = []): void
    {
        $payload = $this->requireAuth();
        $id      = $vars['id'] ?? '';
        $userId  = (int) ($payload['sub'] ?? 0);

        if ($this->hasPermission($payload, 'bookings:manage')) {
            $booking = (new BookingService())->adminFindById($id);
            if ($booking === null) {
                throw new RuntimeException('Booking not found.', 404);
            }
            echo json_encode(['booking' => $booking]);
            return;
        }

        $booking = (new BookingService())->getById($id, $userId);
        echo json_encode(['booking' => $booking]);
    }

    /** @param array<string, string> $vars */
    private function handleBookingActivityList(array $vars = []): void
    {
        if (DB_NAME === '') {
            echo json_encode(['logs' => []]);
            return;
        }

        $payload = $this->requireAuth();
        $id      = $vars['id'] ?? '';
        $userId  = (int) ($payload['sub'] ?? 0);

        if (!$this->hasPermission($payload, 'bookings:manage')) {
            (new BookingService())->getById($id, $userId);
        }

        $logs = (new BookingActivityService())->getForBooking($id);
        echo json_encode(['logs' => $logs]);
    }

    /** @param array<string, string> $vars */
    private function handleBookingReschedule(array $vars = []): void
    {
        $payload = $this->requireAuth();
        $id      = $vars['id'] ?? '';
        $userId  = (int) ($payload['sub'] ?? 0);
        $data    = $this->jsonBody();

        $date = trim((string) ($data['appointmentDate'] ?? ''));
        $time = trim((string) ($data['appointmentTime'] ?? ''));

        if ($date === '') {
            throw new RuntimeException('appointmentDate is required.', 422);
        }
        if ($time === '') {
            throw new RuntimeException('appointmentTime is required.', 422);
        }

        $booking = (new BookingService())->reschedule($id, $userId, $date, $time);
        echo json_encode(['booking' => $booking]);
    }

    /** @param array<string, string> $vars */
    private function handleAdminBookingReschedule(array $vars = []): void
    {
        $this->requirePermission('bookings:manage');
        $id   = $vars['id'] ?? '';
        $data = $this->jsonBody();

        $date = trim((string) ($data['appointmentDate'] ?? ''));
        $time = trim((string) ($data['appointmentTime'] ?? ''));

        if ($date === '') {
            throw new RuntimeException('appointmentDate is required.', 422);
        }
        if ($time === '') {
            throw new RuntimeException('appointmentTime is required.', 422);
        }

        $booking = (new BookingService())->adminReschedule($id, $date, $time);
        echo json_encode(['booking' => $booking]);
    }

    /** @param array<string, string> $vars */
    private function handleBookingUpdate(array $vars = []): void
    {
        $this->requirePermission('bookings:manage');
        $id     = $vars['id'] ?? '';
        $data   = $this->jsonBody();
        $status = (string) ($data['status'] ?? '');

        $booking = (new BookingService())->updateStatus($id, $status);
        echo json_encode(['booking' => $booking]);
    }

    /** @param array<string, string> $vars */
    private function handleBookingAssignTech(array $vars = []): void
    {
        $this->requirePermission('bookings:assign-tech');
        $id   = $vars['id'] ?? '';
        $data = $this->jsonBody();

        $rawUserId = $data['assignedUserId'] ?? ($data['assigned_user_id'] ?? null);
        $rawTechId = $data['assignedTechId'] ?? ($data['assigned_tech_id'] ?? null);
        $assignedTechId = null;
        if ($rawUserId !== null && $rawUserId !== '') {
            $assignedUserId = (int) $rawUserId;
            if ($assignedUserId <= 0) {
                throw new RuntimeException('assignedUserId must be a positive integer or null.', 422);
            }

            $stmt = Database::getInstance()->prepare(
                'SELECT id FROM team_members WHERE user_id = :user_id LIMIT 1'
            );
            $stmt->execute([':user_id' => $assignedUserId]);
            $existing = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;

            if ($existing) {
                $assignedTechId = (int) ($existing['id'] ?? 0);
            } else {
                $created = (new TeamMemberService())->create([
                    'userId' => $assignedUserId,
                    'sortOrder' => 999,
                    'isActive' => true,
                ]);
                $assignedTechId = (int) ($created['id'] ?? 0);
            }

            if ($assignedTechId <= 0) {
                throw new RuntimeException('Unable to link selected user to a technician profile.', 422);
            }
        } elseif ($rawTechId !== null && $rawTechId !== '') {
            $assignedTechId = (int) $rawTechId;
            if ($assignedTechId <= 0) {
                throw new RuntimeException('assignedTechId must be a positive integer or null.', 422);
            }
        }

        $booking = (new BookingService())->assignTechnician($id, $assignedTechId);
        echo json_encode(['booking' => $booking]);
    }

    /** @param array<string, string> $vars */
    private function handleBookingAvailability(array $vars = []): void
    {
        $date = trim((string) ($_GET['date'] ?? ''));
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            throw new RuntimeException('A valid date parameter (YYYY-MM-DD) is required.', 422);
        }

        $svc      = new ShopHoursService();
        $dayHours = $svc->getForDate($date);
        $allSlots = $svc->generateSlots($dayHours);

        $bookingSvc  = new BookingService();
        $bookedSlots = $dayHours['isOpen']
            ? $bookingSvc->getBookedSlots($date)
            : [];
        $slotCounts  = $dayHours['isOpen']
            ? $bookingSvc->getSlotCounts($date)
            : [];

        echo json_encode([
            'isOpen'         => $dayHours['isOpen'],
            'openTime'       => $dayHours['openTime'],
            'closeTime'      => $dayHours['closeTime'],
            'slotIntervalH'  => $dayHours['slotIntervalH'],
            'closureReason'  => $dayHours['closureReason'] ?? null,
            'availableSlots' => $allSlots,
            'bookedSlots'    => $bookedSlots,
            'slotCapacity'   => $bookingSvc->getSlotCapacity(),
            'slotCounts'     => $slotCounts,
        ]);
    }

    /** @param array<string, string> $vars */
    private function handleShopHoursGet(array $vars = []): void
    {
        $hours = (new ShopHoursService())->getAll();
        echo json_encode(['hours' => $hours]);
    }

    /** @param array<string, string> $vars */
    private function handleShopHoursPut(array $vars = []): void
    {
        $this->requirePermission('shop-hours:manage');
        $data  = $this->jsonBody();
        $input = $data['hours'] ?? $data; // accept both {hours:[...]} and [...] directly

        if (!is_array($input)) {
            throw new RuntimeException('Expected an array of day-hour objects.', 422);
        }

        $updated = (new ShopHoursService())->updateAll(array_values($input));
        echo json_encode(['hours' => $updated]);
    }

    /** @param array<string, string> $vars */
    private function handleShopClosedDatesGet(array $vars = []): void
    {
        $dates = (new ShopHoursService())->getClosedDates();
        echo json_encode(['closedDates' => $dates]);
    }

    /** @param array<string, string> $vars */
    private function handleShopClosedDatesAdd(array $vars = []): void
    {
        $this->requirePermission('shop-hours:manage');
        $data     = $this->jsonBody();
        $date     = trim((string) ($data['date']   ?? ''));
        $reason   = isset($data['reason']) ? trim((string) $data['reason']) : null;
        $isYearly = (bool) ($data['isYearly'] ?? false);
        if ($reason === '') $reason = null;

        (new ShopHoursService())->addClosedDate($date, $reason, $isYearly);
        $dates = (new ShopHoursService())->getClosedDates();
        echo json_encode(['closedDates' => $dates]);
    }

    /** @param array<string, string> $vars */
    private function handleShopClosedDatesRemove(array $vars = []): void
    {
        $this->requirePermission('shop-hours:manage');
        $date = trim($vars['date'] ?? '');
        (new ShopHoursService())->removeClosedDate($date);
        $dates = (new ShopHoursService())->getClosedDates();
        echo json_encode(['closedDates' => $dates]);
    }

    /** @param array<string, string> $vars */
    private function handleBookingMediaUpload(array $vars = []): void
    {
        if (empty($_FILES['files'])) {
            throw new RuntimeException('No files provided.', 422);
        }

        $allowed  = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        $maxBytes = UPLOAD_MAX_MB * 1024 * 1024;
        $urls     = [];
        $storage  = new UploadStorage();

        // $_FILES['files'] may be a single file or multiple (files[])
        $files = $_FILES['files'];
        $count = is_array($files['name']) ? count($files['name']) : 1;

        for ($i = 0; $i < $count; $i++) {
            $tmpName = is_array($files['tmp_name']) ? $files['tmp_name'][$i] : $files['tmp_name'];
            $mime    = is_array($files['type'])     ? $files['type'][$i]     : $files['type'];
            $size    = is_array($files['size'])     ? $files['size'][$i]     : $files['size'];
            $error   = is_array($files['error'])    ? $files['error'][$i]    : $files['error'];

            if ($error !== UPLOAD_ERR_OK) {
                throw new RuntimeException("File upload error (code $error).", 422);
            }
            if (!in_array($mime, $allowed, true) || !@getimagesize($tmpName)) {
                throw new RuntimeException("Only JPEG, PNG, WebP and GIF images are accepted.", 422);
            }
            if ($size > $maxBytes) {
                throw new RuntimeException("Each file must be under " . UPLOAD_MAX_MB . " MB.", 422);
            }

            $ext      = pathinfo((is_array($files['name']) ? $files['name'][$i] : $files['name']), PATHINFO_EXTENSION);
            $filename = bin2hex(random_bytes(16)) . '.' . strtolower($ext);

            $urls[] = $storage->upload($tmpName, $filename, $mime, 'bookings/');
        }

        echo json_encode(['urls' => $urls]);
    }

    /** @param array<string, string> $vars */
    private function handleBookingPartsUpdate(array $vars = []): void
    {
        $this->requirePermission('bookings:manage');
        $id          = $vars['id'] ?? '';
        $data        = $this->jsonBody();
        $waiting     = (bool) ($data['awaitingParts'] ?? false);
        $partsNotes  = trim((string) ($data['partsNotes'] ?? ''));

        $booking = (new BookingService())->updatePartsStatus($id, $waiting, $partsNotes);
        echo json_encode(['booking' => $booking]);
    }

    /** @param array<string, string> $vars */
    private function handleBookingQaPhotosUpdate(array $vars = []): void
    {
        $payload = $this->requirePermission('bookings:manage');
        $id      = $vars['id'] ?? '';
        $data    = $this->jsonBody();

        $stage = trim((string) ($data['stage'] ?? ''));
        $photoUrls = array_values(array_filter(
            is_array($data['photoUrls'] ?? null) ? $data['photoUrls'] : [],
            fn($v) => is_string($v) && trim($v) !== ''
        ));

        $booking = (new BookingService())->updateQaPhotos(
            $id,
            $stage,
            $photoUrls,
            (int) ($payload['sub'] ?? 0) ?: null
        );

        echo json_encode(['booking' => $booking]);
    }

    /** @param array<string, string> $vars */
    private function handleBookingCancel(array $vars = []): void
    {
        $payload = $this->requireAuth();
        $id      = $vars['id'] ?? '';
        $userId  = (int) ($payload['sub'] ?? 0);

        $booking = (new BookingService())->cancelByUser($id, $userId);
        echo json_encode(['booking' => $booking]);
    }

    // -------------------------------------------------------------------------
    // Build-update handlers
    // -------------------------------------------------------------------------

    /** @param array<string, string> $vars */
    private function handleBuildUpdateList(array $vars = []): void
    {
        $payload = $this->requireAuth();
        $id      = $vars['id'] ?? '';
        $userId  = (int) ($payload['sub'] ?? 0);

        // Users with build update permission see any booking; clients only their own.
        if (!$this->hasAnyPermission($payload, ['build-updates:manage', 'bookings:manage'])) {
            // Verify this booking belongs to the authenticated user
            (new BookingService())->getById($id, $userId);
        }

        $updates = (new BuildUpdateService())->getByBookingId($id);
        echo json_encode(['updates' => $updates]);
    }

    /** @param array<string, string> $vars */
    private function handleBuildUpdateCreate(array $vars = []): void
    {
        $payload   = $this->requirePermission('build-updates:manage');
        $actorId   = (int) ($payload['sub'] ?? 0);
        $id        = $vars['id'] ?? '';
        $data      = $this->jsonBody();
        $note      = trim((string) ($data['note'] ?? ''));
        $photoUrls = array_values(array_filter(
            is_array($data['photoUrls'] ?? null) ? $data['photoUrls'] : [],
            fn($v) => is_string($v) && $v !== ''
        ));

        if ($note === '' && count($photoUrls) === 0) {
            throw new RuntimeException('A note or at least one photo is required.', 422);
        }

        $update = (new BuildUpdateService())->create($id, $note, $photoUrls);

        if (DB_NAME !== '') {
            $photoCount = count($photoUrls);
            $detail = $note !== '' ? $note : null;
            if ($detail === null && $photoCount > 0) {
                $detail = $photoCount . ' photo(s)';
            }
            (new BookingActivityService())->add(
                $id,
                'build_update_posted',
                'Build update posted',
                $detail,
                $actorId > 0 ? $actorId : null,
                'admin'
            );
        }

        // Notify the customer that a new build progress update was posted
        $booking = (new BookingService())->adminFindById($id);
        if ($booking !== null) {
            (new NotificationService())->buildUpdateCreated($booking, $update);

            // In-app notification for the client
            $uid = (int) ($booking['userId'] ?? 0);
            if ($uid > 0) {
                $svcName = (string) ($booking['serviceName'] ?? 'your service');
                $snippet = $note !== '' ? ': ' . mb_strimwidth($note, 0, 60, '…') : '';
                (new UserNotificationService())->createForUser(
                    $uid,
                    'build_update',
                    'Build Progress Update',
                    "New update on your {$svcName} job{$snippet}",
                    ['bookingId' => $id]
                );
            }
        }

        http_response_code(201);
        echo json_encode(['update' => $update]);
    }

    /** @param array<string, string> $vars */
    private function handleBuildUpdateMediaUpload(array $vars = []): void
    {
        $this->requirePermission('build-updates:manage');

        if (empty($_FILES['files'])) {
            throw new RuntimeException('No files provided.', 422);
        }

        $allowed  = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        $maxBytes = UPLOAD_MAX_MB * 1024 * 1024;
        $urls     = [];
        $storage  = new UploadStorage();

        $files = $_FILES['files'];
        $count = is_array($files['name']) ? count($files['name']) : 1;

        for ($i = 0; $i < $count; $i++) {
            $tmpName = is_array($files['tmp_name']) ? $files['tmp_name'][$i] : $files['tmp_name'];
            $mime    = is_array($files['type'])     ? $files['type'][$i]     : $files['type'];
            $size    = is_array($files['size'])     ? $files['size'][$i]     : $files['size'];
            $error   = is_array($files['error'])    ? $files['error'][$i]    : $files['error'];

            if ($error !== UPLOAD_ERR_OK) {
                throw new RuntimeException("File upload error (code $error).", 422);
            }
            if (!in_array($mime, $allowed, true) || !@getimagesize($tmpName)) {
                throw new RuntimeException('Only JPEG, PNG, WebP and GIF images are accepted.', 422);
            }
            if ($size > $maxBytes) {
                throw new RuntimeException('Each file must be under ' . UPLOAD_MAX_MB . ' MB.', 422);
            }

            $origName = is_array($files['name']) ? $files['name'][$i] : $files['name'];
            $ext      = strtolower(pathinfo((string) $origName, PATHINFO_EXTENSION));
            $filename = bin2hex(random_bytes(16)) . '.' . $ext;

            $urls[] = $storage->upload($tmpName, $filename, $mime, 'builds/');
        }

        echo json_encode(['urls' => $urls]);
    }

    // -------------------------------------------------------------------------
    // Notification handlers
    // -------------------------------------------------------------------------

    /** @param array<string, string> $vars */
    private function handleNotificationList(array $vars = []): void
    {
        if (DB_NAME === '') {
            echo json_encode(['notifications' => [], 'unreadCount' => 0]);
            return;
        }

        $payload   = $this->requireAuth();
        $isAdmin   = $this->hasAnyPermission($payload, ['bookings:manage', 'clients:manage', 'analytics:view', 'users:manage', 'roles:view']);
        $userId    = (int) ($payload['sub'] ?? 0);
        $svc       = new UserNotificationService();

        $notifications = $svc->getForViewer($isAdmin, $userId);
        $unreadCount   = $svc->getUnreadCount($isAdmin, $userId);

        echo json_encode(['notifications' => $notifications, 'unreadCount' => $unreadCount]);
    }

    /** @param array<string, string> $vars */
    private function handleNotificationRead(array $vars = []): void
    {
        if (DB_NAME === '') {
            echo json_encode(['ok' => true]);
            return;
        }

        $payload = $this->requireAuth();
    $isAdmin = $this->hasAnyPermission($payload, ['bookings:manage', 'clients:manage', 'analytics:view', 'users:manage', 'roles:view']);
        $userId  = (int) ($payload['sub'] ?? 0);
        $id      = (int) ($vars['id'] ?? 0);

        (new UserNotificationService())->markRead($id, $isAdmin, $userId);
        echo json_encode(['ok' => true]);
    }

    /** @param array<string, string> $vars */
    private function handleNotificationReadAll(array $vars = []): void
    {
        if (DB_NAME === '') {
            echo json_encode(['ok' => true]);
            return;
        }

        $payload = $this->requireAuth();
    $isAdmin = $this->hasAnyPermission($payload, ['bookings:manage', 'clients:manage', 'analytics:view', 'users:manage', 'roles:view']);
        $userId  = (int) ($payload['sub'] ?? 0);

        (new UserNotificationService())->markAllRead($isAdmin, $userId);
        echo json_encode(['ok' => true]);
    }

    /** @param array<string, string> $vars */
    private function handleNotificationDelete(array $vars = []): void
    {
        if (DB_NAME === '') {
            echo json_encode(['ok' => true]);
            return;
        }

        $payload = $this->requireAuth();
    $isAdmin = $this->hasAnyPermission($payload, ['bookings:manage', 'clients:manage', 'analytics:view', 'users:manage', 'roles:view']);
        $userId  = (int) ($payload['sub'] ?? 0);
        $id      = (int) ($vars['id'] ?? 0);

        (new UserNotificationService())->delete($id, $isAdmin, $userId);
        echo json_encode(['ok' => true]);
    }

    // -------------------------------------------------------------------------
    // Review handlers
    // -------------------------------------------------------------------------

    /** @param array<string, string> $vars */
    private function handlePublishedReviewList(array $vars = []): void
    {
        $serviceId = isset($_GET['service_id']) ? (int) $_GET['service_id'] : null;
        $reviews   = (new ReviewService())->getPublished($serviceId);
        echo json_encode(['reviews' => $reviews]);
    }

    /** @param array<string, string> $vars */
    private function handleBookingReviewGet(array $vars = []): void
    {
        $id      = $vars['id'] ?? '';
        $review  = (new ReviewService())->getForBooking($id);
        echo json_encode(['review' => $review]);
    }

    /** @param array<string, string> $vars */
    private function handleBookingReviewCreate(array $vars = []): void
    {
        $payload = $this->requireAuth('client');
        $userId  = (int) ($payload['sub'] ?? 0);
        $id      = $vars['id'] ?? '';

        $data    = json_decode(file_get_contents('php://input') ?: '{}', true) ?? [];
        $review  = (new ReviewService())->create($id, $userId, $data);
        http_response_code(201);
        echo json_encode(['review' => $review]);
    }

    /** @param array<string, string> $vars */
    private function handleReviewList(array $vars = []): void
    {
        $this->requirePermission('reviews:manage');
        $reviews = (new ReviewService())->getAll();
        echo json_encode(['reviews' => $reviews]);
    }

    /** @param array<string, string> $vars */
    private function handleReviewApprove(array $vars = []): void
    {
        $this->requirePermission('reviews:manage');
        (new ReviewService())->approve((int) ($vars['id'] ?? 0));
        echo json_encode(['ok' => true]);
    }

    /** @param array<string, string> $vars */
    private function handleReviewReject(array $vars = []): void
    {
        $this->requirePermission('reviews:manage');
        (new ReviewService())->reject((int) ($vars['id'] ?? 0));
        echo json_encode(['ok' => true]);
    }

    /** @param array<string, string> $vars */
    private function handleReviewDelete(array $vars = []): void
    {
        $this->requirePermission('reviews:manage');
        (new ReviewService())->delete((int) ($vars['id'] ?? 0));
        echo json_encode(['ok' => true]);
    }

    // -------------------------------------------------------------------------
    // Internal notes handler
    // -------------------------------------------------------------------------

    /** @param array<string, string> $vars */
    private function handleBookingInternalNotes(array $vars = []): void
    {
        $this->requirePermission('bookings:notes');
        $id   = $vars['id'] ?? '';
        $data = json_decode(file_get_contents('php://input') ?: '{}', true) ?? [];
        $notes = mb_substr((string) ($data['internalNotes'] ?? ''), 0, 5000);
        $booking = (new BookingService())->updateInternalNotes($id, $notes);
        echo json_encode(['booking' => $booking]);
    }

    /** @param array<string, string> $vars */
    private function handleAdminUserList(array $vars = []): void
    {
        $this->requirePermission('users:manage');
        $filters = [
            'search' => (string) ($_GET['search'] ?? ''),
            'role'   => (string) ($_GET['role'] ?? ''),
        ];
        $users = (new UserService())->listUsers($filters);
        echo json_encode(['users' => $users]);
    }

    /** @param array<string, string> $vars */
    private function handleAdminUserCreate(array $vars = []): void
    {
        $this->requirePermission('users:manage');
        $data = $this->jsonBody();
        $user = (new UserService())->createByAdmin($data);
        http_response_code(201);
        echo json_encode(['user' => $user]);
    }

    /** @param array<string, string> $vars */
    private function handleAdminUserRoleUpdate(array $vars = []): void
    {
        $payload = $this->requirePermission('users:manage');
        $id = (int) ($vars['id'] ?? 0);
        if ($id <= 0) {
            throw new RuntimeException('Invalid user id.', 422);
        }

        $data = $this->jsonBody();
        $role = (string) ($data['role'] ?? '');
        if ($role === '') {
            throw new RuntimeException('role is required.', 422);
        }

        $actorId = (int) ($payload['sub'] ?? 0);
        $actorName = (string) ($payload['name'] ?? '');
        $user = (new UserService())->updateRole($id, $role, $actorId > 0 ? $actorId : null, $actorName);
        echo json_encode(['user' => $user]);
    }

    /** @param array<string, string> $vars */
    private function handleAdminClientList(array $vars = []): void
    {
        $this->requirePermission('clients:manage');
        $filters = ['search' => (string) ($_GET['search'] ?? '')];
        $clients = (new UserService())->listClients($filters);
        echo json_encode(['clients' => $clients]);
    }

    /** @param array<string, string> $vars */
    private function handleAdminRoleList(array $vars = []): void
    {
        $this->requirePermission('roles:view');
        $roles = (new UserService())->listRoles();
        echo json_encode(['roles' => $roles]);
    }

    /** @param array<string, string> $vars */
    private function handleAdminRoleAuditList(array $vars = []): void
    {
        $this->requirePermission('roles:view');
        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 120;
        $logs = (new UserService())->listRoleAuditLogs($limit);

        $format = strtolower(trim((string) ($_GET['format'] ?? 'json')));
        if ($format === 'csv') {
            header('Content-Type: text/csv; charset=utf-8');
            header('Content-Disposition: attachment; filename="role-audit-logs.csv"');
            $out = fopen('php://output', 'wb');
            if ($out === false) {
                throw new RuntimeException('Unable to stream CSV.', 500);
            }

            fputcsv($out, ['id', 'action', 'roleKey', 'targetUserEmail', 'actorName', 'actorEmail', 'createdAt']);
            foreach ($logs as $log) {
                fputcsv($out, [
                    (string) ($log['id'] ?? ''),
                    (string) ($log['action'] ?? ''),
                    (string) ($log['roleKey'] ?? ''),
                    (string) ($log['targetUserEmail'] ?? ''),
                    (string) ($log['actorName'] ?? ''),
                    (string) ($log['actorEmail'] ?? ''),
                    (string) ($log['created_at'] ?? ''),
                ]);
            }
            fclose($out);
            return;
        }

        echo json_encode(['logs' => $logs]);
    }

    /** @param array<string, string> $vars */
    private function handleAdminSecurityAuditList(array $vars = []): void
    {
        $this->requirePermission('security:audit:view');

        if (DB_NAME === '') {
            echo json_encode(['logs' => []]);
            return;
        }

        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 200;
        $logs = (new AuthSecurityService())->listAuthAuditLogs($limit);
        echo json_encode(['logs' => $logs]);
    }

    /** @param array<string, string> $vars */
    private function handleAdminSecurityAuditExport(array $vars = []): void
    {
        $this->requirePermission('security:audit:view');

        if (DB_NAME === '') {
            throw new RuntimeException('Database is required for audit export.', 503);
        }

        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 1000;
        $logs = (new AuthSecurityService())->listAuthAuditLogs($limit);

        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="auth-security-audit.csv"');
        $out = fopen('php://output', 'wb');
        if ($out === false) {
            throw new RuntimeException('Unable to stream CSV.', 500);
        }

        fputcsv($out, ['id', 'eventType', 'outcome', 'email', 'userName', 'ipAddress', 'userAgent', 'detail', 'createdAt']);
        foreach ($logs as $log) {
            fputcsv($out, [
                (string) ($log['id'] ?? ''),
                (string) ($log['eventType'] ?? ''),
                (string) ($log['outcome'] ?? ''),
                (string) ($log['email'] ?? ''),
                (string) ($log['userName'] ?? ''),
                (string) ($log['ipAddress'] ?? ''),
                (string) ($log['userAgent'] ?? ''),
                (string) ($log['detail'] ?? ''),
                (string) ($log['createdAt'] ?? ''),
            ]);
        }
        fclose($out);
    }

    /** @param array<string, string> $vars */
    private function handleAdminRoleCreate(array $vars = []): void
    {
        $payload = $this->requirePermission('roles:manage');
        $data = $this->jsonBody();
        $actorId = (int) ($payload['sub'] ?? 0);
        $actorName = (string) ($payload['name'] ?? '');
        $role = (new UserService())->createRole($data, $actorId > 0 ? $actorId : null, $actorName);
        http_response_code(201);
        echo json_encode(['role' => $role]);
    }

    /** @param array<string, string> $vars */
    private function handleAdminRoleUpdate(array $vars = []): void
    {
        $payload = $this->requirePermission('roles:manage');
        $id = (int) ($vars['id'] ?? 0);
        if ($id <= 0) {
            throw new RuntimeException('Invalid role id.', 422);
        }

        $data = $this->jsonBody();
        $actorId = (int) ($payload['sub'] ?? 0);
        $actorName = (string) ($payload['name'] ?? '');
        $role = (new UserService())->updateRoleDefinition($id, $data, $actorId > 0 ? $actorId : null, $actorName);
        echo json_encode(['role' => $role]);
    }

    /** @param array<string, string> $vars */
    private function handleAdminRoleDelete(array $vars = []): void
    {
        $payload = $this->requirePermission('roles:manage');
        $id = (int) ($vars['id'] ?? 0);
        if ($id <= 0) {
            throw new RuntimeException('Invalid role id.', 422);
        }

        $actorId = (int) ($payload['sub'] ?? 0);
        $actorName = (string) ($payload['name'] ?? '');
        (new UserService())->deleteRole($id, $actorId > 0 ? $actorId : null, $actorName);
        echo json_encode(['message' => 'Role deleted.']);
    }

    // -------------------------------------------------------------------------
    // Notification preferences handlers
    // -------------------------------------------------------------------------

    /** @param array<string, string> $vars */
    private function handleNotificationPrefsGet(array $vars = []): void
    {
        if (DB_NAME === '') {
            echo json_encode(['preferences' => null]);
            return;
        }
        $payload = $this->requireAuth();
        $userId  = (int) ($payload['sub'] ?? 0);
        $prefs   = (new NotificationPreferencesService())->getForUser($userId);
        echo json_encode(['preferences' => $prefs]);
    }

    /** @param array<string, string> $vars */
    private function handleNotificationPrefsSave(array $vars = []): void
    {
        if (DB_NAME === '') {
            echo json_encode(['preferences' => null]);
            return;
        }
        $payload = $this->requireAuth();
        $userId  = (int) ($payload['sub'] ?? 0);
        $data    = json_decode(file_get_contents('php://input') ?: '{}', true) ?? [];
        $prefs   = (new NotificationPreferencesService())->save($userId, $data);
        echo json_encode(['preferences' => $prefs]);
    }

    // -------------------------------------------------------------------------
    // Customer loyalty stats handler
    // -------------------------------------------------------------------------

    /** @param array<string, string> $vars */
    private function handleCustomerStats(array $vars = []): void
    {
        $this->requireAuth('admin');
        $userId = (int) ($vars['userId'] ?? 0);
        $stats  = (new BookingService())->getCustomerStats($userId);
        echo json_encode(['stats' => $stats]);
    }

    /** @param array<string, string> $vars */
    private function handleClientVehicleList(array $vars = []): void
    {
        $payload = $this->requireAuth();
        $userId  = (int) ($payload['sub'] ?? 0);
        $vehicles = (new VehicleCrudService())->getByUserId($userId);
        echo json_encode(['vehicles' => $vehicles]);
    }

    /** @param array<string, string> $vars */
    private function handleClientVehicleCreate(array $vars = []): void
    {
        $payload = $this->requireAuth();
        $userId  = (int) ($payload['sub'] ?? 0);
        $data    = $this->jsonBody();
        $vehicle = (new VehicleCrudService())->create($userId, $data);
        http_response_code(201);
        echo json_encode(['vehicle' => $vehicle]);
    }

    /** @param array<string, string> $vars */
    private function handleClientVehicleMediaUpload(array $vars = []): void
    {
        $this->requireAuth();

        if (empty($_FILES['file'])) {
            throw new RuntimeException('No file provided.', 422);
        }

        $file     = $_FILES['file'];
        $tmpName  = $file['tmp_name'];
        $mime     = $file['type'];
        $size     = $file['size'];
        $error    = $file['error'];

        if ($error !== UPLOAD_ERR_OK) {
            throw new RuntimeException("File upload error (code $error).", 422);
        }
        $allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!in_array($mime, $allowedMimes, true) || !@getimagesize($tmpName)) {
            throw new RuntimeException('Only JPEG, PNG, WebP and GIF images are accepted.', 422);
        }
        $maxBytes = UPLOAD_MAX_MB * 1024 * 1024;
        if ($size > $maxBytes) {
            throw new RuntimeException('File must be under ' . UPLOAD_MAX_MB . ' MB.', 422);
        }

        $ext      = strtolower(pathinfo((string) $file['name'], PATHINFO_EXTENSION));
        $filename = bin2hex(random_bytes(16)) . '.' . $ext;

        $storage = new UploadStorage();
        $url     = $storage->upload($tmpName, $filename, $mime, 'vehicles/');

        echo json_encode(['url' => $url]);
    }

    /** @param array<string, string> $vars */
    private function handleClientVehicleUpdate(array $vars = []): void
    {
        $payload = $this->requireAuth();
        $userId  = (int) ($payload['sub'] ?? 0);
        $id      = (int) ($vars['id'] ?? 0);
        $data    = $this->jsonBody();
        $vehicle = (new VehicleCrudService())->update($id, $userId, $data);
        echo json_encode(['vehicle' => $vehicle]);
    }

    /** @param array<string, string> $vars */
    private function handleClientVehicleDelete(array $vars = []): void
    {
        $payload = $this->requireAuth();
        $userId  = (int) ($payload['sub'] ?? 0);
        $id      = (int) ($vars['id'] ?? 0);
        (new VehicleCrudService())->delete($id, $userId);
        echo json_encode(['ok' => true]);
    }

    /** @param array<string, string> $vars */
    private function handleServiceList(array $vars = []): void
    {
        // Service managers see inactive entries; public sees active only.
        $includeInactive = false;
        $token = Auth::tokenFromHeader();
        if ($token !== null) {
            try {
                $payload = Auth::decodeToken($token);
                $includeInactive = $this->hasPermissionByRole((string) ($payload['role'] ?? ''), 'services:manage');
            } catch (RuntimeException) { /* treat as public */ }
        }

        $services = (new ServiceCrudService())->getAll($includeInactive);
        echo json_encode(['services' => $services]);
    }

    /** @param array<string, string> $vars */
    private function handleServiceGet(array $vars = []): void
    {
        $id           = (int) ($vars['id'] ?? 0);
        $requireActive = true;
        $token = Auth::tokenFromHeader();
        if ($token !== null) {
            try {
                $payload = Auth::decodeToken($token);
                $requireActive = !$this->hasPermissionByRole((string) ($payload['role'] ?? ''), 'services:manage');
            } catch (RuntimeException) { /* stay public */ }
        }

        $service = (new ServiceCrudService())->getById($id, $requireActive);
        echo json_encode(['service' => $service]);
    }

    /** @param array<string, string> $vars */
    private function handleServiceGetBySlug(array $vars = []): void
    {
        $slug          = $vars['slug'] ?? '';
        $requireActive = true;
        $token = Auth::tokenFromHeader();
        if ($token !== null) {
            try {
                $payload = Auth::decodeToken($token);
                $requireActive = !$this->hasPermissionByRole((string) ($payload['role'] ?? ''), 'services:manage');
            } catch (RuntimeException) { /* stay public */ }
        }

        $service = (new ServiceCrudService())->getBySlug($slug, $requireActive);
        echo json_encode(['service' => $service]);
    }

    /** @param array<string, string> $vars */
    private function handleServiceCreate(array $vars = []): void
    {
        $this->requirePermission('services:manage');
        $data    = $this->jsonBody();
        $service = (new ServiceCrudService())->create($data);
        http_response_code(201);
        echo json_encode(['service' => $service]);
    }

    /** @param array<string, string> $vars */
    private function handleServiceUpdate(array $vars = []): void
    {
        $this->requirePermission('services:manage');
        $id      = (int) ($vars['id'] ?? 0);
        $data    = $this->jsonBody();
        $service = (new ServiceCrudService())->update($id, $data);
        echo json_encode(['service' => $service]);
    }

    /** @param array<string, string> $vars */
    private function handleServiceDelete(array $vars = []): void
    {
        $this->requirePermission('services:manage');
        $id = (int) ($vars['id'] ?? 0);
        (new ServiceCrudService())->delete($id);
        echo json_encode(['message' => 'Service deleted.']);
    }

    // -------------------------------------------------------------------------
    // Service variation handlers
    // -------------------------------------------------------------------------

    /** @param array<string, string> $vars */
    private function handleServiceVariationList(array $vars = []): void
    {
        $id      = (int) ($vars['id'] ?? 0);
        $service = (new ServiceCrudService())->getById($id, false);
        echo json_encode(['variations' => $service['variations'] ?? []]);
    }

    /** @param array<string, string> $vars */
    private function handleServiceVariationCreate(array $vars = []): void
    {
        $this->requirePermission('services:manage');
        $id        = (int) ($vars['id'] ?? 0);
        $data      = $this->jsonBody();
        $variation = (new ServiceCrudService())->createVariation($id, $data);
        http_response_code(201);
        echo json_encode(['variation' => $variation]);
    }

    /** @param array<string, string> $vars */
    private function handleServiceVariationUpdate(array $vars = []): void
    {
        $this->requirePermission('services:manage');
        $id        = (int) ($vars['id']  ?? 0);
        $vid       = (int) ($vars['vid'] ?? 0);
        $data      = $this->jsonBody();
        $variation = (new ServiceCrudService())->updateVariation($id, $vid, $data);
        echo json_encode(['variation' => $variation]);
    }

    /** @param array<string, string> $vars */
    private function handleServiceVariationDelete(array $vars = []): void
    {
        $this->requirePermission('services:manage');
        $id  = (int) ($vars['id']  ?? 0);
        $vid = (int) ($vars['vid'] ?? 0);
        (new ServiceCrudService())->deleteVariation($id, $vid);
        echo json_encode(['message' => 'Variation deleted.']);
    }

    // -------------------------------------------------------------------------
    // Blog post handlers
    // -------------------------------------------------------------------------

    /** @param array<string, string> $vars */
    private function handleBlogList(array $vars = []): void
    {
        $publishedOnly = true;
        $token = Auth::tokenFromHeader();
        if ($token !== null) {
            try {
                $payload = Auth::decodeToken($token);
                $publishedOnly = !$this->hasPermissionByRole((string) ($payload['role'] ?? ''), 'content:manage');
            } catch (RuntimeException) { /* treat as public */ }
        }

        $posts = (new BlogPostService())->getAll($publishedOnly);
        echo json_encode(['posts' => $posts]);
    }

    /** @param array<string, string> $vars */
    private function handleBlogGet(array $vars = []): void
    {
        $id            = (int) ($vars['id'] ?? 0);
        $publishedOnly = true;
        $token = Auth::tokenFromHeader();
        if ($token !== null) {
            try {
                $payload = Auth::decodeToken($token);
                $publishedOnly = !$this->hasPermissionByRole((string) ($payload['role'] ?? ''), 'content:manage');
            } catch (RuntimeException) { /* treat as public */ }
        }

        $post = (new BlogPostService())->getById($id, $publishedOnly);
        echo json_encode(['post' => $post]);
    }

    /** @param array<string, string> $vars */
    private function handleBlogCreate(array $vars = []): void
    {
        $this->requirePermission('content:manage');
        $data = $this->jsonBody();
        $post = (new BlogPostService())->create($data);
        http_response_code(201);
        echo json_encode(['post' => $post]);
    }

    /** @param array<string, string> $vars */
    private function handleBlogUpdate(array $vars = []): void
    {
        $this->requirePermission('content:manage');
        $id   = (int) ($vars['id'] ?? 0);
        $data = $this->jsonBody();
        $post = (new BlogPostService())->update($id, $data);
        echo json_encode(['post' => $post]);
    }

    /** @param array<string, string> $vars */
    private function handleBlogDelete(array $vars = []): void
    {
        $this->requirePermission('content:manage');
        $id = (int) ($vars['id'] ?? 0);
        (new BlogPostService())->delete($id);
        echo json_encode(['message' => 'Blog post deleted.']);
    }

    /** @param array<string, string> $vars */
    private function handleAdminStats(array $vars = []): void
    {
        $this->requirePermission('analytics:view');
        $stats = (new BookingService())->getStats();
        echo json_encode($stats);
    }

    /** @param array<string, string> $vars */
    private function handleAdminMediaUpload(array $vars = []): void
    {
        $this->requirePermission('media:upload');

        $allowed_types = ['services', 'products', 'blog', 'team', 'testimonials', 'portfolio', 'before-after'];
        $type = $_POST['type'] ?? '';
        if (!in_array($type, $allowed_types, true)) {
            throw new RuntimeException('Invalid upload type. Must be one of: ' . implode(', ', $allowed_types) . '.', 422);
        }

        if (empty($_FILES['file'])) {
            throw new RuntimeException('No file provided.', 422);
        }

        $file     = $_FILES['file'];
        $tmpName  = $file['tmp_name'];
        $mime     = $file['type'];
        $size     = $file['size'];
        $error    = $file['error'];

        if ($error !== UPLOAD_ERR_OK) {
            throw new RuntimeException("File upload error (code $error).", 422);
        }
        $allowed_mimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!in_array($mime, $allowed_mimes, true) || !@getimagesize($tmpName)) {
            throw new RuntimeException('Only JPEG, PNG, WebP and GIF images are accepted.', 422);
        }
        $maxBytes = UPLOAD_MAX_MB * 1024 * 1024;
        if ($size > $maxBytes) {
            throw new RuntimeException('File must be under ' . UPLOAD_MAX_MB . ' MB.', 422);
        }

        $ext      = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $filename = bin2hex(random_bytes(16)) . '.' . $ext;
        $subdir   = $type . '/';

        $storage = new UploadStorage();
        $url     = $storage->upload($tmpName, $filename, $mime, $subdir);

        echo json_encode(['url' => $url]);
    }

    // -------------------------------------------------------------------------
    // Product handlers
    // -------------------------------------------------------------------------

    /** @param array<string, string> $vars */
    private function handleProductList(array $vars = []): void
    {
        $includeInactive = false;
        $token = Auth::tokenFromHeader();
        if ($token !== null) {
            try {
                $payload = Auth::decodeToken($token);
                $includeInactive = $this->hasPermissionByRole((string) ($payload['role'] ?? ''), 'products:manage');
            } catch (RuntimeException) { /* treat as public */ }
        }

        $products = (new ProductService())->getAll($includeInactive);
        echo json_encode(['products' => $products]);
    }

    /** @param array<string, string> $vars */
    private function handleProductGet(array $vars = []): void
    {
        $id           = (int) ($vars['id'] ?? 0);
        $requireActive = true;
        $token = Auth::tokenFromHeader();
        if ($token !== null) {
            try {
                $payload = Auth::decodeToken($token);
                $requireActive = !$this->hasPermissionByRole((string) ($payload['role'] ?? ''), 'products:manage');
            } catch (RuntimeException) { /* stay public */ }
        }

        $product = (new ProductService())->getById($id, $requireActive);
        echo json_encode(['product' => $product]);
    }

    /** @param array<string, string> $vars */
    private function handleProductCreate(array $vars = []): void
    {
        $this->requirePermission('products:manage');
        $data    = $this->jsonBody();
        $product = (new ProductService())->create($data);
        http_response_code(201);
        echo json_encode(['product' => $product]);
    }

    /** @param array<string, string> $vars */
    private function handleProductUpdate(array $vars = []): void
    {
        $this->requirePermission('products:manage');
        $id      = (int) ($vars['id'] ?? 0);
        $data    = $this->jsonBody();
        $product = (new ProductService())->update($id, $data);
        echo json_encode(['product' => $product]);
    }

    /** @param array<string, string> $vars */
    private function handleProductDelete(array $vars = []): void
    {
        $this->requirePermission('products:manage');
        $id = (int) ($vars['id'] ?? 0);
        (new ProductService())->delete($id);
        echo json_encode(['message' => 'Product deleted.']);
    }

    // -------------------------------------------------------------------------
    // Product variation handlers
    // -------------------------------------------------------------------------

    /** @param array<string, string> $vars */
    private function handleProductVariationList(array $vars = []): void
    {
        $id      = (int) ($vars['id'] ?? 0);
        $product = (new ProductService())->getById($id, false);
        echo json_encode(['variations' => $product['variations'] ?? []]);
    }

    /** @param array<string, string> $vars */
    private function handleProductVariationCreate(array $vars = []): void
    {
        $this->requirePermission('products:manage');
        $id        = (int) ($vars['id'] ?? 0);
        $data      = $this->jsonBody();
        $variation = (new ProductService())->createVariation($id, $data);
        http_response_code(201);
        echo json_encode(['variation' => $variation]);
    }

    /** @param array<string, string> $vars */
    private function handleProductVariationUpdate(array $vars = []): void
    {
        $this->requirePermission('products:manage');
        $id        = (int) ($vars['id']  ?? 0);
        $vid       = (int) ($vars['vid'] ?? 0);
        $data      = $this->jsonBody();
        $variation = (new ProductService())->updateVariation($id, $vid, $data);
        echo json_encode(['variation' => $variation]);
    }

    /** @param array<string, string> $vars */
    private function handleProductVariationDelete(array $vars = []): void
    {
        $this->requirePermission('products:manage');
        $id  = (int) ($vars['id']  ?? 0);
        $vid = (int) ($vars['vid'] ?? 0);
        (new ProductService())->deleteVariation($id, $vid);
        echo json_encode(['message' => 'Variation deleted.']);
    }

    // -------------------------------------------------------------------------
    // Portfolio handlers
    // -------------------------------------------------------------------------

    /** @param array<string, string> $vars */
    private function handlePortfolioList(array $vars = []): void
    {
        $includeInactive = false;
        $token = Auth::tokenFromHeader();
        if ($token !== null) {
            try {
                $payload = Auth::decodeToken($token);
                $includeInactive = $this->hasPermissionByRole((string) ($payload['role'] ?? ''), 'content:manage');
            } catch (RuntimeException) { /* treat as public */ }
        }

        $items = (new PortfolioService())->getAll($includeInactive);
        echo json_encode(['portfolio' => $items]);
    }

    /** @param array<string, string> $vars */
    private function handlePortfolioGet(array $vars = []): void
    {
        $id           = (int) ($vars['id'] ?? 0);
        $requireActive = true;
        $token = Auth::tokenFromHeader();
        if ($token !== null) {
            try {
                $payload = Auth::decodeToken($token);
                $requireActive = !$this->hasPermissionByRole((string) ($payload['role'] ?? ''), 'content:manage');
            } catch (RuntimeException) { /* stay public */ }
        }

        $item = (new PortfolioService())->getById($id, $requireActive);
        echo json_encode(['portfolioItem' => $item]);
    }

    /** @param array<string, string> $vars */
    private function handlePortfolioCreate(array $vars = []): void
    {
        $this->requirePermission('content:manage');
        $data = $this->jsonBody();
        $item = (new PortfolioService())->create($data);
        http_response_code(201);
        echo json_encode(['portfolioItem' => $item]);
    }

    /** @param array<string, string> $vars */
    private function handlePortfolioUpdate(array $vars = []): void
    {
        $this->requirePermission('content:manage');
        $id   = (int) ($vars['id'] ?? 0);
        $data = $this->jsonBody();
        $item = (new PortfolioService())->update($id, $data);
        echo json_encode(['portfolioItem' => $item]);
    }

    /** @param array<string, string> $vars */
    private function handlePortfolioDelete(array $vars = []): void
    {
        $this->requirePermission('content:manage');
        $id = (int) ($vars['id'] ?? 0);
        (new PortfolioService())->delete($id);
        echo json_encode(['message' => 'Portfolio item deleted.']);
    }

    // -------------------------------------------------------------------------
    // Portfolio Category handlers
    // -------------------------------------------------------------------------

    /** @param array<string, string> $vars */
    private function handlePortfolioCategoryList(array $vars = []): void
    {
        $categories = (new PortfolioCategoryService())->getAll();
        echo json_encode(['categories' => $categories]);
    }

    /** @param array<string, string> $vars */
    private function handlePortfolioCategoryGet(array $vars = []): void
    {
        $id       = (int) ($vars['id'] ?? 0);
        $category = (new PortfolioCategoryService())->getById($id);
        echo json_encode(['category' => $category]);
    }

    /** @param array<string, string> $vars */
    private function handlePortfolioCategoryCreate(array $vars = []): void
    {
        $this->requirePermission('content:manage');
        $data     = $this->jsonBody();
        $category = (new PortfolioCategoryService())->create($data);
        http_response_code(201);
        echo json_encode(['category' => $category]);
    }

    /** @param array<string, string> $vars */
    private function handlePortfolioCategoryUpdate(array $vars = []): void
    {
        $this->requirePermission('content:manage');
        $id       = (int) ($vars['id'] ?? 0);
        $data     = $this->jsonBody();
        $category = (new PortfolioCategoryService())->update($id, $data);
        echo json_encode(['category' => $category]);
    }

    /** @param array<string, string> $vars */
    private function handlePortfolioCategoryDelete(array $vars = []): void
    {
        $this->requirePermission('content:manage');
        $id = (int) ($vars['id'] ?? 0);
        (new PortfolioCategoryService())->delete($id);
        echo json_encode(['message' => 'Portfolio category deleted.']);
    }

    // -------------------------------------------------------------------------
    // Migration handlers
    // -------------------------------------------------------------------------

    /** @param array<string, string> $vars */
    private function handleMigrateRun(array $vars = []): void
    {
        $this->requirePermission('settings:manage');
        $result = (new MigrationRunner())->run();
        echo json_encode($result);
    }

    /** @param array<string, string> $vars */
    private function handleMigrateStatus(array $vars = []): void
    {
        $this->requirePermission('settings:manage');
        $status = (new MigrationRunner())->status();
        echo json_encode(['migrations' => $status]);
    }

    // -------------------------------------------------------------------------
    // Vehicle data handlers (API Ninjas proxy)
    // -------------------------------------------------------------------------

    /** @param array<string, string> $vars */
    private function handleVehicleMakes(array $vars = []): void
    {
        $year  = isset($_GET['year']) && ctype_digit($_GET['year'])
            ? (int) $_GET['year']
            : null;

        $makes = (new VehicleService())->getMakes($year);
        echo json_encode(['makes' => $makes]);
    }

    /** @param array<string, string> $vars */
    private function handleVehicleModels(array $vars = []): void
    {
        $make  = trim((string) ($_GET['make'] ?? ''));
        $year  = isset($_GET['year']) && ctype_digit($_GET['year'])
            ? (int) $_GET['year']
            : null;

        if ($make === '') {
            throw new RuntimeException("Query parameter 'make' is required.", 422);
        }

        $models = (new VehicleService())->getModels($make, $year);
        echo json_encode(['models' => $models]);
    }

    /** @param array<string, string> $vars */
    private function handleVehicleTrims(array $vars = []): void
    {
        $make  = trim((string) ($_GET['make']  ?? ''));
        $model = trim((string) ($_GET['model'] ?? ''));
        $limit = isset($_GET['limit']) && ctype_digit($_GET['limit']) ? (int) $_GET['limit'] : 50;
        $page  = isset($_GET['page'])  && ctype_digit($_GET['page'])  ? (int) $_GET['page']  : 1;

        if ($make === '' || $model === '') {
            throw new RuntimeException("Query parameters 'make' and 'model' are required.", 422);
        }

        $trims = (new VehicleService())->getTrims($make, $model, $limit, $page);
        echo json_encode(['trims' => $trims]);
    }

    // -------------------------------------------------------------------------
    // Site settings handlers
    // -------------------------------------------------------------------------

    /** @param array<string, string> $vars */
    private function handleSiteSettingsGet(array $vars = []): void
    {
        $settings = (new SiteSettingsService())->getAll();
        echo json_encode(['settings' => $settings]);
    }

    /** @param array<string, string> $vars */
    private function handleSiteSettingsPut(array $vars = []): void
    {
        $this->requirePermission('settings:manage');
        $data     = $this->jsonBody();
        $settings = (new SiteSettingsService())->update($data);
        echo json_encode(['settings' => $settings]);
    }

    // -------------------------------------------------------------------------
    // Team member handlers
    // -------------------------------------------------------------------------

    /** @param array<string, string> $vars */
    private function handleTeamMemberList(array $vars = []): void
    {
        $activeOnly = true;
        $token = Auth::tokenFromHeader();
        if ($token !== null) {
            try {
                $payload    = Auth::decodeToken($token);
                $activeOnly = ($payload['role'] ?? '') !== 'admin';
            } catch (RuntimeException) { /* treat as public */ }
        }

        $members = (new TeamMemberService())->getAll($activeOnly);
        echo json_encode(['members' => $members]);
    }

    /** @param array<string, string> $vars */
    private function handleTeamMemberCreate(array $vars = []): void
    {
        $this->requirePermission('content:manage');
        $data   = $this->jsonBody();
        $member = (new TeamMemberService())->create($data);
        http_response_code(201);
        echo json_encode(['member' => $member]);
    }

    /** @param array<string, string> $vars */
    private function handleTeamMemberUpdate(array $vars = []): void
    {
        $this->requirePermission('content:manage');
        $id     = (int) ($vars['id'] ?? 0);
        $data   = $this->jsonBody();
        $member = (new TeamMemberService())->update($id, $data);
        echo json_encode(['member' => $member]);
    }

    /** @param array<string, string> $vars */
    private function handleTeamMemberDelete(array $vars = []): void
    {
        $this->requirePermission('content:manage');
        $id = (int) ($vars['id'] ?? 0);
        (new TeamMemberService())->delete($id);
        echo json_encode(['message' => 'Team member deleted.']);
    }

    // -------------------------------------------------------------------------
    // Testimonial handlers
    // -------------------------------------------------------------------------

    /** @param array<string, string> $vars */
    private function handleTestimonialList(array $vars = []): void
    {
        $activeOnly = true;
        $token = Auth::tokenFromHeader();
        if ($token !== null) {
            try {
                $payload    = Auth::decodeToken($token);
                $activeOnly = ($payload['role'] ?? '') !== 'admin';
            } catch (RuntimeException) { /* treat as public */ }
        }

        $testimonials = (new TestimonialService())->getAll($activeOnly);
        echo json_encode(['testimonials' => $testimonials]);
    }

    /** @param array<string, string> $vars */
    private function handleTestimonialCreate(array $vars = []): void
    {
        $this->requirePermission('content:manage');
        $data        = $this->jsonBody();
        $testimonial = (new TestimonialService())->create($data);
        http_response_code(201);
        echo json_encode(['testimonial' => $testimonial]);
    }

    /** @param array<string, string> $vars */
    private function handleTestimonialUpdate(array $vars = []): void
    {
        $this->requirePermission('content:manage');
        $id          = (int) ($vars['id'] ?? 0);
        $data        = $this->jsonBody();
        $testimonial = (new TestimonialService())->update($id, $data);
        echo json_encode(['testimonial' => $testimonial]);
    }

    /** @param array<string, string> $vars */
    private function handleTestimonialDelete(array $vars = []): void
    {
        $this->requirePermission('content:manage');
        $id = (int) ($vars['id'] ?? 0);
        (new TestimonialService())->delete($id);
        echo json_encode(['message' => 'Testimonial deleted.']);
    }

    // -------------------------------------------------------------------------
    // FAQ handlers
    // -------------------------------------------------------------------------

    /** @param array<string, string> $vars */
    private function handleFaqList(array $vars = []): void
    {
        $activeOnly = true;
        $token = Auth::tokenFromHeader();
        if ($token !== null) {
            try {
                $payload    = Auth::decodeToken($token);
                $activeOnly = ($payload['role'] ?? '') !== 'admin';
            } catch (RuntimeException) { /* treat as public */ }
        }

        $faqs = (new FaqService())->getAll($activeOnly);
        echo json_encode(['faqs' => $faqs]);
    }

    /** @param array<string, string> $vars */
    private function handleFaqCreate(array $vars = []): void
    {
        $this->requirePermission('content:manage');
        $data = $this->jsonBody();
        $faq  = (new FaqService())->create($data);
        http_response_code(201);
        echo json_encode(['faq' => $faq]);
    }

    /** @param array<string, string> $vars */
    private function handleFaqUpdate(array $vars = []): void
    {
        $this->requirePermission('content:manage');
        $id   = (int) ($vars['id'] ?? 0);
        $data = $this->jsonBody();
        $faq  = (new FaqService())->update($id, $data);
        echo json_encode(['faq' => $faq]);
    }

    /** @param array<string, string> $vars */
    private function handleFaqDelete(array $vars = []): void
    {
        $this->requirePermission('content:manage');
        $id = (int) ($vars['id'] ?? 0);
        (new FaqService())->delete($id);
        echo json_encode(['message' => 'FAQ deleted.']);
    }

    // -------------------------------------------------------------------------
    // Offer handlers
    // -------------------------------------------------------------------------

    /** @param array<string, string> $vars */
    private function handleOfferList(array $vars = []): void
    {
        $includeInactive = false;
        $token = Auth::tokenFromHeader();
        if ($token !== null) {
            try {
                $payload         = Auth::decodeToken($token);
                $includeInactive = $this->hasPermissionByRole((string) ($payload['role'] ?? ''), 'content:manage');
            } catch (RuntimeException) { /* treat as public */ }
        }

        $offers = (new OfferService())->getAll($includeInactive);
        echo json_encode(['offers' => $offers]);
    }

    /** @param array<string, string> $vars */
    private function handleOfferGet(array $vars = []): void
    {
        $id           = (int) ($vars['id'] ?? 0);
        $requireActive = true;
        $token = Auth::tokenFromHeader();
        if ($token !== null) {
            try {
                $payload       = Auth::decodeToken($token);
                $requireActive = !$this->hasPermissionByRole((string) ($payload['role'] ?? ''), 'content:manage');
            } catch (RuntimeException) { /* stay public */ }
        }

        $offer = (new OfferService())->getById($id, $requireActive);
        echo json_encode(['offer' => $offer]);
    }

    /** @param array<string, string> $vars */
    private function handleOfferCreate(array $vars = []): void
    {
        $this->requirePermission('content:manage');
        $data  = $this->jsonBody();
        $offer = (new OfferService())->create($data);
        http_response_code(201);
        echo json_encode(['offer' => $offer]);
    }

    /** @param array<string, string> $vars */
    private function handleOfferUpdate(array $vars = []): void
    {
        $this->requirePermission('content:manage');
        $id    = (int) ($vars['id'] ?? 0);
        $data  = $this->jsonBody();
        $offer = (new OfferService())->update($id, $data);
        echo json_encode(['offer' => $offer]);
    }

    /** @param array<string, string> $vars */
    private function handleOfferDelete(array $vars = []): void
    {
        $this->requirePermission('content:manage');
        $id = (int) ($vars['id'] ?? 0);
        (new OfferService())->delete($id);
        echo json_encode(['message' => 'Offer deleted.']);
    }

    /** @param array<string, string> $vars */
    private function handleBeforeAfterList(array $vars = []): void
    {
        $includeInactive = false;
        $token = Auth::tokenFromHeader();
        if ($token !== null) {
            try {
                $payload = Auth::decodeToken($token);
                $includeInactive = $this->hasPermissionByRole((string) ($payload['role'] ?? ''), 'content:manage');
            } catch (RuntimeException) { /* treat as public */ }
        }

        $items = (new BeforeAfterService())->getAll($includeInactive);
        echo json_encode(['items' => $items]);
    }

    /** @param array<string, string> $vars */
    private function handleBeforeAfterGet(array $vars = []): void
    {
        $id = (int) ($vars['id'] ?? 0);
        $requireActive = true;
        $token = Auth::tokenFromHeader();
        if ($token !== null) {
            try {
                $payload = Auth::decodeToken($token);
                $requireActive = !$this->hasPermissionByRole((string) ($payload['role'] ?? ''), 'content:manage');
            } catch (RuntimeException) { /* stay public */ }
        }

        $item = (new BeforeAfterService())->getById($id, $requireActive);
        echo json_encode(['item' => $item]);
    }

    /** @param array<string, string> $vars */
    private function handleBeforeAfterCreate(array $vars = []): void
    {
        $this->requirePermission('content:manage');
        $data = $this->jsonBody();
        $item = (new BeforeAfterService())->create($data);
        http_response_code(201);
        echo json_encode(['item' => $item]);
    }

    /** @param array<string, string> $vars */
    private function handleBeforeAfterUpdate(array $vars = []): void
    {
        $this->requirePermission('content:manage');
        $id = (int) ($vars['id'] ?? 0);
        $data = $this->jsonBody();
        $item = (new BeforeAfterService())->update($id, $data);
        echo json_encode(['item' => $item]);
    }

    /** @param array<string, string> $vars */
    private function handleBeforeAfterDelete(array $vars = []): void
    {
        $this->requirePermission('content:manage');
        $id = (int) ($vars['id'] ?? 0);
        (new BeforeAfterService())->delete($id);
        echo json_encode(['message' => 'Before/After item deleted.']);
    }

    // -------------------------------------------------------------------------
    // Contact message handler
    // -------------------------------------------------------------------------

    /** @param array<string, string> $vars */
    private function handleContactMessage(array $vars = []): void
    {
        $data    = $this->jsonBody();
        $name    = trim((string) ($data['name']    ?? ''));
        $email   = trim((string) ($data['email']   ?? ''));
        $phone   = trim((string) ($data['phone']   ?? ''));
        $subject = trim((string) ($data['subject'] ?? ''));
        $message = trim((string) ($data['message'] ?? ''));

        if ($name === '' || $email === '' || $subject === '' || $message === '') {
            http_response_code(422);
            echo json_encode(['detail' => 'Name, email, subject, and message are required.']);
            return;
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            http_response_code(422);
            echo json_encode(['detail' => 'Invalid email address.']);
            return;
        }

        (new NotificationService())->contactMessage([
            'name'    => $name,
            'email'   => $email,
            'phone'   => $phone,
            'subject' => $subject,
            'message' => $message,
        ]);

        echo json_encode(['message' => 'Your message has been sent successfully.']);
    }

        /**
     * Public: Get a portfolio/build item by slug
     */
    private function handlePortfolioGetBySlug(array $vars): void
    {
        $slug = $vars['slug'] ?? '';
        $service = new PortfolioService();
        try {
            $item = $service->getBySlug($slug);
            echo json_encode($item);
        } catch (\Throwable $e) {
            http_response_code($e->getCode() ?: 404);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }
}

