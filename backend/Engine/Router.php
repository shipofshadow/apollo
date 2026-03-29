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
            $r->addRoute('POST', '/api/auth/forgot-password',  'handleAuthForgotPassword');
            $r->addRoute('POST', '/api/auth/reset-password',   'handleAuthResetPassword');

            // ── Bookings ────────────────────────────────────────────────────
            $r->addRoute('POST',  '/api/bookings',                  'handleBookingCreate');
            $r->addRoute('GET',   '/api/bookings',                  'handleBookingList');
            $r->addRoute('GET',   '/api/bookings/mine',             'handleBookingMine');
            $r->addRoute('GET',   '/api/bookings/availability',     'handleBookingAvailability');
            $r->addRoute('POST',  '/api/bookings/media',            'handleBookingMediaUpload');
            $r->addRoute('GET',   '/api/bookings/{id}',             'handleBookingGet');
            $r->addRoute('PATCH', '/api/bookings/{id}',             'handleBookingUpdate');
            $r->addRoute('PATCH', '/api/bookings/{id}/cancel',      'handleBookingCancel');
            $r->addRoute('PATCH', '/api/bookings/{id}/reschedule',        'handleBookingReschedule');
            $r->addRoute('PATCH', '/api/bookings/{id}/admin-reschedule', 'handleAdminBookingReschedule');
            $r->addRoute('PATCH', '/api/bookings/{id}/parts',             'handleBookingPartsUpdate');

            // ── Build updates (progress photos – admin write, owner read) ────
            $r->addRoute('GET',  '/api/bookings/{id}/build-updates',       'handleBuildUpdateList');
            $r->addRoute('POST', '/api/bookings/{id}/build-updates',       'handleBuildUpdateCreate');
            $r->addRoute('POST', '/api/bookings/{id}/build-updates/media', 'handleBuildUpdateMediaUpload');

            // ── In-app notifications ────────────────────────────────────────
            $r->addRoute('GET',    '/api/notifications',              'handleNotificationList');
            $r->addRoute('PATCH',  '/api/notifications/read-all',     'handleNotificationReadAll');
            $r->addRoute('PATCH',  '/api/notifications/{id:\d+}/read','handleNotificationRead');
            $r->addRoute('DELETE', '/api/notifications/{id:\d+}',     'handleNotificationDelete');

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
            $r->addRoute('GET', '/api/shop/hours', 'handleShopHoursGet');
            $r->addRoute('PUT', '/api/shop/hours', 'handleShopHoursPut');

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

            // ── Contact message (public) ─────────────────────────────────────
            $r->addRoute('POST', '/api/contact', 'handleContactMessage');

            // ── Admin utilities ─────────────────────────────────────────────
            $r->addRoute('POST', '/api/admin/migrate', 'handleMigrateRun');
            $r->addRoute('GET',  '/api/admin/migrate', 'handleMigrateStatus');
            $r->addRoute('GET',  '/api/admin/stats',   'handleAdminStats');
            $r->addRoute('POST', '/api/admin/upload',  'handleAdminMediaUpload');

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
        $token = Auth::tokenFromHeader();
        if ($token !== null) {
            Auth::logout($token);
        }
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
    private function handleBookingGet(array $vars = []): void
    {
        $payload = $this->requireAuth();
        $id      = $vars['id'] ?? '';
        $userId  = (int) ($payload['sub'] ?? 0);

        $booking = (new BookingService())->getById($id, $userId);
        echo json_encode(['booking' => $booking]);
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
        $this->requireAuth('admin');
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
            'isOpen'        => $dayHours['isOpen'],
            'openTime'      => $dayHours['openTime'],
            'closeTime'     => $dayHours['closeTime'],
            'slotIntervalH' => $dayHours['slotIntervalH'],
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
        $this->requireAuth('admin');
        $data  = $this->jsonBody();
        $input = $data['hours'] ?? $data; // accept both {hours:[...]} and [...] directly

        if (!is_array($input)) {
            throw new RuntimeException('Expected an array of day-hour objects.', 422);
        }

        $updated = (new ShopHoursService())->updateAll(array_values($input));
        echo json_encode(['hours' => $updated]);
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

            if (R2Uploader::isConfigured()) {
                $uploader = new R2Uploader();
                $urls[]   = $uploader->upload($tmpName, $filename, $mime, 'bookings/');
            } else {
                move_uploaded_file($tmpName, $uploadDir . $filename);
                $base   = UPLOAD_BASE_URL !== '' ? UPLOAD_BASE_URL : '';
                $urls[] = $base . '/storage/uploads/' . $filename;
            }
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
        $role    = (string) ($payload['role'] ?? '');
        $userId  = (int) ($payload['sub'] ?? 0);

        // Admins see any booking's updates; clients may only see their own
        if ($role !== 'admin') {
            // Verify this booking belongs to the authenticated user
            (new BookingService())->getById($id, $userId);
        }

        $updates = (new BuildUpdateService())->getByBookingId($id);
        echo json_encode(['updates' => $updates]);
    }

    /** @param array<string, string> $vars */
    private function handleBuildUpdateCreate(array $vars = []): void
    {
        $this->requireAuth('admin');
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
        $this->requireAuth('admin');

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

            if (R2Uploader::isConfigured()) {
                $uploader = new R2Uploader();
                $urls[]   = $uploader->upload($tmpName, $filename, $mime, 'builds/');
            } else {
                move_uploaded_file($tmpName, $uploadDir . $filename);
                $base   = UPLOAD_BASE_URL !== '' ? UPLOAD_BASE_URL : '';
                $urls[] = $base . '/storage/uploads/' . $filename;
            }
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
        $isAdmin   = ($payload['role'] ?? '') === 'admin';
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
        $isAdmin = ($payload['role'] ?? '') === 'admin';
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
        $isAdmin = ($payload['role'] ?? '') === 'admin';
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
        $isAdmin = ($payload['role'] ?? '') === 'admin';
        $userId  = (int) ($payload['sub'] ?? 0);
        $id      = (int) ($vars['id'] ?? 0);

        (new UserNotificationService())->delete($id, $isAdmin, $userId);
        echo json_encode(['ok' => true]);
    }

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
    private function handleServiceGetBySlug(array $vars = []): void
    {
        $slug          = $vars['slug'] ?? '';
        $requireActive = true;
        $token = Auth::tokenFromHeader();
        if ($token !== null) {
            try {
                $payload = Auth::decodeToken($token);
                $requireActive = ($payload['role'] ?? '') !== 'admin';
            } catch (RuntimeException) { /* stay public */ }
        }

        $service = (new ServiceCrudService())->getBySlug($slug, $requireActive);
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
        $this->requireAuth('admin');
        $id        = (int) ($vars['id'] ?? 0);
        $data      = $this->jsonBody();
        $variation = (new ServiceCrudService())->createVariation($id, $data);
        http_response_code(201);
        echo json_encode(['variation' => $variation]);
    }

    /** @param array<string, string> $vars */
    private function handleServiceVariationUpdate(array $vars = []): void
    {
        $this->requireAuth('admin');
        $id        = (int) ($vars['id']  ?? 0);
        $vid       = (int) ($vars['vid'] ?? 0);
        $data      = $this->jsonBody();
        $variation = (new ServiceCrudService())->updateVariation($id, $vid, $data);
        echo json_encode(['variation' => $variation]);
    }

    /** @param array<string, string> $vars */
    private function handleServiceVariationDelete(array $vars = []): void
    {
        $this->requireAuth('admin');
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

    /** @param array<string, string> $vars */
    private function handleAdminMediaUpload(array $vars = []): void
    {
        $this->requireAuth('admin');

        $allowed_types = ['services', 'products', 'blog', 'team', 'testimonials', 'portfolio'];
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

        if (R2Uploader::isConfigured()) {
            $uploader = new R2Uploader();
            $url      = $uploader->upload($tmpName, $filename, $mime, $subdir);
        } else {
            $uploadDir = UPLOAD_DIR . $subdir;
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }
            move_uploaded_file($tmpName, $uploadDir . $filename);
            $base = UPLOAD_BASE_URL !== '' ? UPLOAD_BASE_URL : '';
            $url  = $base . '/storage/uploads/' . $subdir . $filename;
        }

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
        $this->requireAuth('admin');
        $id        = (int) ($vars['id'] ?? 0);
        $data      = $this->jsonBody();
        $variation = (new ProductService())->createVariation($id, $data);
        http_response_code(201);
        echo json_encode(['variation' => $variation]);
    }

    /** @param array<string, string> $vars */
    private function handleProductVariationUpdate(array $vars = []): void
    {
        $this->requireAuth('admin');
        $id        = (int) ($vars['id']  ?? 0);
        $vid       = (int) ($vars['vid'] ?? 0);
        $data      = $this->jsonBody();
        $variation = (new ProductService())->updateVariation($id, $vid, $data);
        echo json_encode(['variation' => $variation]);
    }

    /** @param array<string, string> $vars */
    private function handleProductVariationDelete(array $vars = []): void
    {
        $this->requireAuth('admin');
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
                $includeInactive = ($payload['role'] ?? '') === 'admin';
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
                $requireActive = ($payload['role'] ?? '') !== 'admin';
            } catch (RuntimeException) { /* stay public */ }
        }

        $item = (new PortfolioService())->getById($id, $requireActive);
        echo json_encode(['portfolioItem' => $item]);
    }

    /** @param array<string, string> $vars */
    private function handlePortfolioCreate(array $vars = []): void
    {
        $this->requireAuth('admin');
        $data = $this->jsonBody();
        $item = (new PortfolioService())->create($data);
        http_response_code(201);
        echo json_encode(['portfolioItem' => $item]);
    }

    /** @param array<string, string> $vars */
    private function handlePortfolioUpdate(array $vars = []): void
    {
        $this->requireAuth('admin');
        $id   = (int) ($vars['id'] ?? 0);
        $data = $this->jsonBody();
        $item = (new PortfolioService())->update($id, $data);
        echo json_encode(['portfolioItem' => $item]);
    }

    /** @param array<string, string> $vars */
    private function handlePortfolioDelete(array $vars = []): void
    {
        $this->requireAuth('admin');
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
        $this->requireAuth('admin');
        $data     = $this->jsonBody();
        $category = (new PortfolioCategoryService())->create($data);
        http_response_code(201);
        echo json_encode(['category' => $category]);
    }

    /** @param array<string, string> $vars */
    private function handlePortfolioCategoryUpdate(array $vars = []): void
    {
        $this->requireAuth('admin');
        $id       = (int) ($vars['id'] ?? 0);
        $data     = $this->jsonBody();
        $category = (new PortfolioCategoryService())->update($id, $data);
        echo json_encode(['category' => $category]);
    }

    /** @param array<string, string> $vars */
    private function handlePortfolioCategoryDelete(array $vars = []): void
    {
        $this->requireAuth('admin');
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
        $this->requireAuth('admin');
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
        $this->requireAuth('admin');
        $data   = $this->jsonBody();
        $member = (new TeamMemberService())->create($data);
        http_response_code(201);
        echo json_encode(['member' => $member]);
    }

    /** @param array<string, string> $vars */
    private function handleTeamMemberUpdate(array $vars = []): void
    {
        $this->requireAuth('admin');
        $id     = (int) ($vars['id'] ?? 0);
        $data   = $this->jsonBody();
        $member = (new TeamMemberService())->update($id, $data);
        echo json_encode(['member' => $member]);
    }

    /** @param array<string, string> $vars */
    private function handleTeamMemberDelete(array $vars = []): void
    {
        $this->requireAuth('admin');
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
        $this->requireAuth('admin');
        $data        = $this->jsonBody();
        $testimonial = (new TestimonialService())->create($data);
        http_response_code(201);
        echo json_encode(['testimonial' => $testimonial]);
    }

    /** @param array<string, string> $vars */
    private function handleTestimonialUpdate(array $vars = []): void
    {
        $this->requireAuth('admin');
        $id          = (int) ($vars['id'] ?? 0);
        $data        = $this->jsonBody();
        $testimonial = (new TestimonialService())->update($id, $data);
        echo json_encode(['testimonial' => $testimonial]);
    }

    /** @param array<string, string> $vars */
    private function handleTestimonialDelete(array $vars = []): void
    {
        $this->requireAuth('admin');
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
        $this->requireAuth('admin');
        $data = $this->jsonBody();
        $faq  = (new FaqService())->create($data);
        http_response_code(201);
        echo json_encode(['faq' => $faq]);
    }

    /** @param array<string, string> $vars */
    private function handleFaqUpdate(array $vars = []): void
    {
        $this->requireAuth('admin');
        $id   = (int) ($vars['id'] ?? 0);
        $data = $this->jsonBody();
        $faq  = (new FaqService())->update($id, $data);
        echo json_encode(['faq' => $faq]);
    }

    /** @param array<string, string> $vars */
    private function handleFaqDelete(array $vars = []): void
    {
        $this->requireAuth('admin');
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
                $includeInactive = ($payload['role'] ?? '') === 'admin';
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
                $requireActive = ($payload['role'] ?? '') !== 'admin';
            } catch (RuntimeException) { /* stay public */ }
        }

        $offer = (new OfferService())->getById($id, $requireActive);
        echo json_encode(['offer' => $offer]);
    }

    /** @param array<string, string> $vars */
    private function handleOfferCreate(array $vars = []): void
    {
        $this->requireAuth('admin');
        $data  = $this->jsonBody();
        $offer = (new OfferService())->create($data);
        http_response_code(201);
        echo json_encode(['offer' => $offer]);
    }

    /** @param array<string, string> $vars */
    private function handleOfferUpdate(array $vars = []): void
    {
        $this->requireAuth('admin');
        $id    = (int) ($vars['id'] ?? 0);
        $data  = $this->jsonBody();
        $offer = (new OfferService())->update($id, $data);
        echo json_encode(['offer' => $offer]);
    }

    /** @param array<string, string> $vars */
    private function handleOfferDelete(array $vars = []): void
    {
        $this->requireAuth('admin');
        $id = (int) ($vars['id'] ?? 0);
        (new OfferService())->delete($id);
        echo json_encode(['message' => 'Offer deleted.']);
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
}

