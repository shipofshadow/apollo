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
            $r->addRoute('POST',  '/api/bookings',                  'handleBookingCreate');
            $r->addRoute('GET',   '/api/bookings',                  'handleBookingList');
            $r->addRoute('GET',   '/api/bookings/mine',             'handleBookingMine');
            $r->addRoute('GET',   '/api/bookings/availability',     'handleBookingAvailability');
            $r->addRoute('POST',  '/api/bookings/media',            'handleBookingMediaUpload');
            $r->addRoute('PATCH', '/api/bookings/{id}',             'handleBookingUpdate');
            $r->addRoute('PATCH', '/api/bookings/{id}/parts',       'handleBookingPartsUpdate');

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

            // ── Admin utilities ─────────────────────────────────────────────
            $r->addRoute('POST', '/api/admin/migrate', 'handleMigrateRun');
            $r->addRoute('GET',  '/api/admin/migrate', 'handleMigrateStatus');
            $r->addRoute('GET',  '/api/admin/stats',   'handleAdminStats');

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

    /** @param array<string, string> $vars */
    private function handleBookingAvailability(array $vars = []): void
    {
        $date = trim((string) ($_GET['date'] ?? ''));
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            throw new RuntimeException('A valid date parameter (YYYY-MM-DD) is required.', 422);
        }
        $bookedSlots = (new BookingService())->getBookedSlots($date);
        echo json_encode(['bookedSlots' => $bookedSlots]);
    }

    /** @param array<string, string> $vars */
    private function handleBookingMediaUpload(array $vars = []): void
    {
        if (empty($_FILES['files'])) {
            throw new RuntimeException('No files provided.', 422);
        }

        $uploadDir = UPLOAD_DIR;
        if (!is_dir($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $allowed  = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        $maxBytes = UPLOAD_MAX_MB * 1024 * 1024;
        $urls     = [];

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
            move_uploaded_file($tmpName, $uploadDir . $filename);

            $base = UPLOAD_BASE_URL !== '' ? UPLOAD_BASE_URL : '';
            $urls[] = $base . '/storage/uploads/' . $filename;
        }

        echo json_encode(['urls' => $urls]);
    }

    /** @param array<string, string> $vars */
    private function handleBookingPartsUpdate(array $vars = []): void
    {
        $this->requireAuth('admin');
        $id          = $vars['id'] ?? '';
        $data        = $this->jsonBody();
        $waiting     = (bool) ($data['awaitingParts'] ?? false);
        $partsNotes  = trim((string) ($data['partsNotes'] ?? ''));

        $booking = (new BookingService())->updatePartsStatus($id, $waiting, $partsNotes);
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
                $publishedOnly = ($payload['role'] ?? '') !== 'admin';
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
                $publishedOnly = ($payload['role'] ?? '') !== 'admin';
            } catch (RuntimeException) { /* treat as public */ }
        }

        $post = (new BlogPostService())->getById($id, $publishedOnly);
        echo json_encode(['post' => $post]);
    }

    /** @param array<string, string> $vars */
    private function handleBlogCreate(array $vars = []): void
    {
        $this->requireAuth('admin');
        $data = $this->jsonBody();
        $post = (new BlogPostService())->create($data);
        http_response_code(201);
        echo json_encode(['post' => $post]);
    }

    /** @param array<string, string> $vars */
    private function handleBlogUpdate(array $vars = []): void
    {
        $this->requireAuth('admin');
        $id   = (int) ($vars['id'] ?? 0);
        $data = $this->jsonBody();
        $post = (new BlogPostService())->update($id, $data);
        echo json_encode(['post' => $post]);
    }

    /** @param array<string, string> $vars */
    private function handleBlogDelete(array $vars = []): void
    {
        $this->requireAuth('admin');
        $id = (int) ($vars['id'] ?? 0);
        (new BlogPostService())->delete($id);
        echo json_encode(['message' => 'Blog post deleted.']);
    }

    /** @param array<string, string> $vars */
    private function handleAdminStats(array $vars = []): void
    {
        $this->requireAuth('admin');
        $stats = (new BookingService())->getStats();
        echo json_encode($stats);
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
                $includeInactive = ($payload['role'] ?? '') === 'admin';
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
                $requireActive = ($payload['role'] ?? '') !== 'admin';
            } catch (RuntimeException) { /* stay public */ }
        }

        $product = (new ProductService())->getById($id, $requireActive);
        echo json_encode(['product' => $product]);
    }

    /** @param array<string, string> $vars */
    private function handleProductCreate(array $vars = []): void
    {
        $this->requireAuth('admin');
        $data    = $this->jsonBody();
        $product = (new ProductService())->create($data);
        http_response_code(201);
        echo json_encode(['product' => $product]);
    }

    /** @param array<string, string> $vars */
    private function handleProductUpdate(array $vars = []): void
    {
        $this->requireAuth('admin');
        $id      = (int) ($vars['id'] ?? 0);
        $data    = $this->jsonBody();
        $product = (new ProductService())->update($id, $data);
        echo json_encode(['product' => $product]);
    }

    /** @param array<string, string> $vars */
    private function handleProductDelete(array $vars = []): void
    {
        $this->requireAuth('admin');
        $id = (int) ($vars['id'] ?? 0);
        (new ProductService())->delete($id);
        echo json_encode(['message' => 'Product deleted.']);
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
        $make   = trim((string) ($_GET['make']   ?? ''));
        $model  = trim((string) ($_GET['model']  ?? ''));
        $limit  = isset($_GET['limit'])  && ctype_digit($_GET['limit'])  ? (int) $_GET['limit']  : 50;
        $offset = isset($_GET['offset']) && ctype_digit($_GET['offset']) ? (int) $_GET['offset'] : 0;

        if ($make === '' || $model === '') {
            throw new RuntimeException("Query parameters 'make' and 'model' are required.", 422);
        }

        $trims = (new VehicleService())->getTrims($make, $model, $limit, $offset);
        echo json_encode(['trims' => $trims]);
    }
}

