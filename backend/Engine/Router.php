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
    public function dispatch(): void
    {
        header('Content-Type: application/json');

        $dispatcher = simpleDispatcher(function (FastRoute\RouteCollector $r): void {
            // ── Public ──────────────────────────────────────────────────────
            $r->addRoute('GET',  '/health',             'handleHealth');
            $r->addRoute('GET',  '/api/posts',          'handlePosts');

            // ── Services (public read, admin write) ─────────────────────────
            $r->addRoute('GET',    '/api/services',          'handleServiceList');
            $r->addRoute('GET',    '/api/services/{id:\d+}', 'handleServiceGet');
            $r->addRoute('POST',   '/api/services',          'handleServiceCreate');
            $r->addRoute('PUT',    '/api/services/{id:\d+}', 'handleServiceUpdate');
            $r->addRoute('DELETE', '/api/services/{id:\d+}', 'handleServiceDelete');

            // ── Auth ────────────────────────────────────────────────────────
            $r->addRoute('POST', '/api/auth/register',  'handleAuthRegister');
            $r->addRoute('POST', '/api/auth/login',     'handleAuthLogin');
            $r->addRoute('POST', '/api/auth/logout',    'handleAuthLogout');
            $r->addRoute('GET',  '/api/auth/me',        'handleAuthMe');
            $r->addRoute('PUT',  '/api/auth/profile',   'handleAuthProfile');

            // ── Bookings ────────────────────────────────────────────────────
            $r->addRoute('POST',  '/api/bookings',          'handleBookingCreate');
            $r->addRoute('GET',   '/api/bookings',           'handleBookingList');
            $r->addRoute('GET',   '/api/bookings/mine',      'handleBookingMine');
            $r->addRoute('PATCH', '/api/bookings/{id}',      'handleBookingUpdate');

            // ── Admin utilities ─────────────────────────────────────────────
            $r->addRoute('POST', '/api/admin/migrate', 'handleMigrateRun');
            $r->addRoute('GET',  '/api/admin/migrate', 'handleMigrateStatus');
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
            http_response_code($e->getCode() ?: 500);
            echo json_encode(['detail' => $e->getMessage()]);
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
        $result = (new UserService())->login($email, $pass);
        echo json_encode($result);
    }

    /** @param array<string, string> $vars */
    private function handleAuthLogout(array $vars = []): void
    {
        // JWT is stateless; the client simply discards the token.
        // Future: add token to a blocklist here.
        echo json_encode(['message' => 'Logged out successfully.']);
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

    // -------------------------------------------------------------------------
    // Booking handlers
    // -------------------------------------------------------------------------

    /** @param array<string, string> $vars */
    private function handleBookingCreate(array $vars = []): void
    {
        // Optional auth – link booking to user if a valid token is present
        $userId = null;
        $token  = Auth::tokenFromHeader();
        if ($token !== null) {
            try {
                $payload = Auth::decodeToken($token);
                $userId  = (int) ($payload['sub'] ?? 0) ?: null;
            } catch (RuntimeException) {
                // invalid token → treat as anonymous booking
            }
        }

        $data    = $this->jsonBody();
        $booking = (new BookingService())->create($data, $userId);
        http_response_code(201);
        echo json_encode(['booking' => $booking]);
    }

    /** @param array<string, string> $vars */
    private function handleBookingList(array $vars = []): void
    {
        $this->requireAuth('admin');
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
    private function handleBookingUpdate(array $vars = []): void
    {
        $this->requireAuth('admin');
        $id     = $vars['id'] ?? '';
        $data   = $this->jsonBody();
        $status = (string) ($data['status'] ?? '');

        $booking = (new BookingService())->updateStatus($id, $status);
        echo json_encode(['booking' => $booking]);
    }

    // -------------------------------------------------------------------------
    // Service handlers
    // -------------------------------------------------------------------------

    /** @param array<string, string> $vars */
    private function handleServiceList(array $vars = []): void
    {
        // Admin sees all; public sees only active
        $includeInactive = false;
        $token = Auth::tokenFromHeader();
        if ($token !== null) {
            try {
                $payload = Auth::decodeToken($token);
                $includeInactive = ($payload['role'] ?? '') === 'admin';
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
                $requireActive = ($payload['role'] ?? '') !== 'admin';
            } catch (RuntimeException) { /* stay public */ }
        }

        $service = (new ServiceCrudService())->getById($id, $requireActive);
        echo json_encode(['service' => $service]);
    }

    /** @param array<string, string> $vars */
    private function handleServiceCreate(array $vars = []): void
    {
        $this->requireAuth('admin');
        $data    = $this->jsonBody();
        $service = (new ServiceCrudService())->create($data);
        http_response_code(201);
        echo json_encode(['service' => $service]);
    }

    /** @param array<string, string> $vars */
    private function handleServiceUpdate(array $vars = []): void
    {
        $this->requireAuth('admin');
        $id      = (int) ($vars['id'] ?? 0);
        $data    = $this->jsonBody();
        $service = (new ServiceCrudService())->update($id, $data);
        echo json_encode(['service' => $service]);
    }

    /** @param array<string, string> $vars */
    private function handleServiceDelete(array $vars = []): void
    {
        $this->requireAuth('admin');
        $id = (int) ($vars['id'] ?? 0);
        (new ServiceCrudService())->delete($id);
        echo json_encode(['message' => 'Service deleted.']);
    }

    // -------------------------------------------------------------------------
    // Migration handlers
    // -------------------------------------------------------------------------

    /** @param array<string, string> $vars */
    private function handleMigrateRun(array $vars = []): void
    {
        $this->requireAuth('admin');
        $result = (new MigrationRunner())->run();
        echo json_encode($result);
    }

    /** @param array<string, string> $vars */
    private function handleMigrateStatus(array $vars = []): void
    {
        $this->requireAuth('admin');
        $status = (new MigrationRunner())->status();
        echo json_encode(['migrations' => $status]);
    }
}

