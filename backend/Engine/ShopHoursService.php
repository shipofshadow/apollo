<?php

declare(strict_types=1);

/**
 * Manages shop opening hours and generates appointment time slots.
 *
 * When DB_NAME is configured, hours are stored in the `shop_hours` table.
 * Otherwise the built-in defaults are used (Mon–Sat, 09:00–18:00, 2 h slots).
 *
 * All times are stored in "HH:MM" (24-hour) format in the DB and returned
 * in that format by getAll(). The generateSlots() helper converts them to
 * the "hh:MM AM/PM" strings expected by the booking system.
 */
class ShopHoursService
{
    private bool $useDb;

    /** Day-of-week label for display */
    public const DAY_NAMES = [
        'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
    ];

    /**
     * Hard-coded defaults used when no database is available.
     * Mirrors the seed data inserted by migration 009.
     *
     * @var array<int, array{dayOfWeek:int,isOpen:bool,openTime:string,closeTime:string,slotIntervalH:int}>
     */
    private const DEFAULTS = [
        ['dayOfWeek' => 0, 'isOpen' => false, 'openTime' => '09:00', 'closeTime' => '18:00', 'slotIntervalH' => 2],
        ['dayOfWeek' => 1, 'isOpen' => true,  'openTime' => '09:00', 'closeTime' => '18:00', 'slotIntervalH' => 2],
        ['dayOfWeek' => 2, 'isOpen' => true,  'openTime' => '09:00', 'closeTime' => '18:00', 'slotIntervalH' => 2],
        ['dayOfWeek' => 3, 'isOpen' => true,  'openTime' => '09:00', 'closeTime' => '18:00', 'slotIntervalH' => 2],
        ['dayOfWeek' => 4, 'isOpen' => true,  'openTime' => '09:00', 'closeTime' => '18:00', 'slotIntervalH' => 2],
        ['dayOfWeek' => 5, 'isOpen' => true,  'openTime' => '09:00', 'closeTime' => '18:00', 'slotIntervalH' => 2],
        ['dayOfWeek' => 6, 'isOpen' => true,  'openTime' => '09:00', 'closeTime' => '18:00', 'slotIntervalH' => 2],
    ];

    public function __construct()
    {
        $this->useDb = DB_NAME !== '';
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    /**
     * Return hours for all 7 days (Sun=0 … Sat=6).
     *
     * @return array<int, array{dayOfWeek:int,isOpen:bool,openTime:string,closeTime:string,slotIntervalH:int}>
     */
    public function getAll(): array
    {
        if (!$this->useDb) {
            return self::DEFAULTS;
        }

        $rows = Database::getInstance()
            ->query('SELECT * FROM shop_hours ORDER BY day_of_week ASC')
            ->fetchAll(\PDO::FETCH_ASSOC);

        if (empty($rows)) {
            return self::DEFAULTS;
        }

        return array_map([$this, 'mapRow'], $rows);
    }

    /**
     * Persist a full set of seven day records in a single transaction.
     *
     * @param  array<int, array{dayOfWeek:int,isOpen:bool,openTime:string,closeTime:string,slotIntervalH:int}> $hours
     * @return array<int, array{dayOfWeek:int,isOpen:bool,openTime:string,closeTime:string,slotIntervalH:int}>
     */
    public function updateAll(array $hours): array
    {
        $this->validateHours($hours);

        if (!$this->useDb) {
            // No persistence without DB — return the submitted data as-is.
            return $hours;
        }

        $db   = Database::getInstance();
        $stmt = $db->prepare(
            'INSERT INTO shop_hours (day_of_week, is_open, open_time, close_time, slot_interval_h)
             VALUES (:dow, :open_flag, :open_time, :close_time, :interval)
             ON DUPLICATE KEY UPDATE
                 is_open         = VALUES(is_open),
                 open_time       = VALUES(open_time),
                 close_time      = VALUES(close_time),
                 slot_interval_h = VALUES(slot_interval_h)'
        );

        $db->beginTransaction();
        try {
            foreach ($hours as $day) {
                $stmt->execute([
                    ':dow'        => $day['dayOfWeek'],
                    ':open_flag'  => (int) $day['isOpen'],
                    ':open_time'  => $day['openTime'] . ':00',
                    ':close_time' => $day['closeTime'] . ':00',
                    ':interval'   => $day['slotIntervalH'],
                ]);
            }
            $db->commit();
        } catch (\Throwable $e) {
            $db->rollBack();
            throw $e;
        }

        return $this->getAll();
    }

    /**
     * Return the hours record for a specific calendar date.
     * If the date is in shop_closed_dates it is treated as closed (isOpen=false)
     * regardless of the weekly schedule.
     *
     * @param  string $date  YYYY-MM-DD
     * @return array{dayOfWeek:int,isOpen:bool,openTime:string,closeTime:string,slotIntervalH:int,closureReason:string|null}
     */
    public function getForDate(string $date): array
    {
        $dow = (int) date('w', strtotime($date)); // 0=Sun … 6=Sat

        // Check one-off closure override first
        $closure = $this->getClosureForDate($date);
        if ($closure !== null) {
            return [
                'dayOfWeek'    => $dow,
                'isOpen'       => false,
                'openTime'     => '09:00',
                'closeTime'    => '18:00',
                'slotIntervalH' => 2,
                'closureReason' => $closure['reason'],
            ];
        }

        $all = $this->getAll();
        foreach ($all as $row) {
            if ($row['dayOfWeek'] === $dow) {
                return array_merge($row, ['closureReason' => null]);
            }
        }
        // Fallback: closed
        return ['dayOfWeek' => $dow, 'isOpen' => false, 'openTime' => '09:00', 'closeTime' => '18:00', 'slotIntervalH' => 2, 'closureReason' => null];
    }

    // -------------------------------------------------------------------------
    // Closed-dates (holidays / special closures) CRUD
    // -------------------------------------------------------------------------

    /**
     * Return all future and recent closed dates (ordered ascending).
     * Returns dates from 30 days ago forward so the admin can see recent ones.
     *
     * @return array<int, array{date:string,reason:string|null,isYearly:bool}>
     */
    public function getClosedDates(): array
    {
        if (!$this->useDb) {
            return [];
        }

        $rows = Database::getInstance()
            ->prepare(
                'SELECT closed_date, reason, is_yearly FROM shop_closed_dates
                  WHERE closed_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                  ORDER BY closed_date ASC'
            );
        $rows->execute();
        return array_map(static fn(array $r): array => [
            'date'     => $r['closed_date'],
            'reason'   => $r['reason'],
            'isYearly' => (bool)$r['is_yearly'],
        ], $rows->fetchAll(\PDO::FETCH_ASSOC));
    }

    /**
     * Add a closure date.
     *
     * @param  string      $date     YYYY-MM-DD
     * @param  string|null $reason   Optional label
     * @param  bool        $isYearly Whether this closure repeats yearly
     */
    public function addClosedDate(string $date, ?string $reason, bool $isYearly = false): void
    {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            throw new RuntimeException('Invalid date format. Expected YYYY-MM-DD.', 422);
        }

        if (!$this->useDb) {
            return;
        }

        $stmt = Database::getInstance()->prepare(
            'INSERT INTO shop_closed_dates (closed_date, reason, is_yearly)
             VALUES (:date, :reason, :isYearly)
             ON DUPLICATE KEY UPDATE reason = VALUES(reason), is_yearly = VALUES(is_yearly)'
        );
        $stmt->execute([':date' => $date, ':reason' => $reason, ':isYearly' => (int)$isYearly]);
    }

    /**
     * Remove a one-off closure date.
     *
     * @param  string $date  YYYY-MM-DD
     */
    public function removeClosedDate(string $date): void
    {
        if (!$this->useDb) {
            return;
        }

        Database::getInstance()
            ->prepare('DELETE FROM shop_closed_dates WHERE closed_date = :date')
            ->execute([':date' => $date]);
    }

    /**
     * Return the closure record for a specific date, or null if not found.
     *
     * @return array{date:string,reason:string|null,isYearly:bool}|null
     */
    private function getClosureForDate(string $date): ?array
    {
        if (!$this->useDb) {
            return null;
        }

        $stmt = Database::getInstance()->prepare(
            'SELECT closed_date, reason, is_yearly FROM shop_closed_dates WHERE closed_date = :date LIMIT 1'
        );
        $stmt->execute([':date' => $date]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);
        if (!$row) {
            return null;
        }
        return ['date' => $row['closed_date'], 'reason' => $row['reason'], 'isYearly' => (bool)$row['is_yearly']];
    }

    /**
     * Generate the list of time-slot labels (e.g. "09:00 AM") for a day record.
     *
     * @param  array{dayOfWeek:int,isOpen:bool,openTime:string,closeTime:string,slotIntervalH:int} $dayHours
     * @return string[]
     */
    public function generateSlots(array $dayHours): array
    {
        if (!$dayHours['isOpen']) {
            return [];
        }

        [$openH,  $openM]  = array_map('intval', explode(':', $dayHours['openTime']));
        [$closeH, $closeM] = array_map('intval', explode(':', $dayHours['closeTime']));

        $openMinutes  = $openH  * 60 + $openM;
        $closeMinutes = $closeH * 60 + $closeM;
        $stepMinutes  = $dayHours['slotIntervalH'] * 60;

        $slots = [];
        for ($m = $openMinutes; $m < $closeMinutes; $m += $stepMinutes) {
            $h    = intdiv($m, 60);
            $min  = $m % 60;
            $ampm = $h < 12 ? 'AM' : 'PM';
            $h12  = $h === 0 ? 12 : ($h > 12 ? $h - 12 : $h);
            $slots[] = sprintf('%02d:%02d %s', $h12, $min, $ampm);
        }

        return $slots;
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /** @param array<string, mixed> $row */
    private function mapRow(array $row): array
    {
        return [
            'dayOfWeek'    => (int)  $row['day_of_week'],
            'isOpen'       => (bool) $row['is_open'],
            'openTime'     => substr((string) $row['open_time'],  0, 5), // "HH:MM"
            'closeTime'    => substr((string) $row['close_time'], 0, 5),
            'slotIntervalH' => (int) $row['slot_interval_h'],
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $hours
     */
    private function validateHours(array $hours): void
    {
        foreach ($hours as $day) {
            $dow = (int) ($day['dayOfWeek'] ?? -1);
            if ($dow < 0 || $dow > 6) {
                throw new RuntimeException("Invalid dayOfWeek: $dow", 422);
            }
            foreach (['openTime', 'closeTime'] as $field) {
                if (!preg_match('/^\d{2}:\d{2}$/', (string) ($day[$field] ?? ''))) {
                    throw new RuntimeException("Invalid $field format – expected HH:MM.", 422);
                }
            }
            $iv = (int) ($day['slotIntervalH'] ?? 0);
            if ($iv < 1 || $iv > 8) {
                throw new RuntimeException("slotIntervalH must be between 1 and 8.", 422);
            }
        }
    }
}
