<?php

declare(strict_types=1);

/**
 * Manages per-user notification preferences (email vs in-app per event type).
 *
 * A row is created with all defaults (everything enabled) the first time
 * a user fetches or saves their preferences.  This means a missing row is
 * equivalent to "all on" so the UI can reliably toggle individual channels.
 */
class NotificationPreferencesService
{
    private \PDO $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Public API
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Return the preferences for a user, creating the default row if needed.
     *
     * @return array<string, mixed>
     */
    public function getForUser(int $userId): array
    {
        $row = $this->fetchRow($userId);
        if ($row === null) {
            $this->ensureRow($userId);
            $row = $this->fetchRow($userId);
        }
        return $this->format($row ?? []);
    }

    /**
     * Upsert preferences from the validated payload.
     *
     * @param  array<string, mixed> $data  Keys are the column names minus the
     *                                      leading "email_" / "inapp_" prefix.
     * @return array<string, mixed>  Updated preferences
     */
    public function save(int $userId, array $data): array
    {
        $this->ensureRow($userId);

        $allowed = [
            'email_new_booking',
            'email_status_changed',
            'email_build_update',
            'email_parts_update',
            'inapp_status_changed',
            'inapp_build_update',
            'inapp_parts_update',
            'inapp_new_booking',
            'inapp_assignment',
            'inapp_security_alert',
            'inapp_slot_available',
            'sms_new_booking',
            'sms_assignment',
            'sms_status_changed',
        ];

        $aliases = [
            'emailNewBooking' => 'email_new_booking',
            'emailStatusChanged' => 'email_status_changed',
            'emailBuildUpdate' => 'email_build_update',
            'emailPartsUpdate' => 'email_parts_update',
            'inappStatusChanged' => 'inapp_status_changed',
            'inappBuildUpdate' => 'inapp_build_update',
            'inappPartsUpdate' => 'inapp_parts_update',
            'inappNewBooking' => 'inapp_new_booking',
            'inappAssignment' => 'inapp_assignment',
            'inappSecurityAlert' => 'inapp_security_alert',
            'inappSlotAvailable' => 'inapp_slot_available',
            'smsNewBooking' => 'sms_new_booking',
            'smsAssignment' => 'sms_assignment',
            'smsStatusChanged' => 'sms_status_changed',
        ];

        foreach ($aliases as $from => $to) {
            if (array_key_exists($from, $data) && !array_key_exists($to, $data)) {
                $data[$to] = $data[$from];
            }
        }

        $sets   = [];
        $params = [':uid' => $userId];
        foreach ($allowed as $col) {
            if (array_key_exists($col, $data)) {
                $sets[]         = "{$col} = :{$col}";
                $params[":{$col}"] = $data[$col] ? 1 : 0;
            }
        }

        if (!empty($sets)) {
            $sql = 'UPDATE notification_preferences SET ' . implode(', ', $sets)
                 . ' WHERE user_id = :uid';
            $this->db->prepare($sql)->execute($params);
        }

        return $this->getForUser($userId);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Convenience checkers used by notification dispatch code
    // ─────────────────────────────────────────────────────────────────────────

    public function emailEnabled(int $userId, string $type): bool
    {
        $col = 'email_' . $type;
        return $this->getColumnValue($userId, $col);
    }

    public function inappEnabled(int $userId, string $type): bool
    {
        $col = 'inapp_' . $type;
        return $this->getColumnValue($userId, $col);
    }

    public function smsEnabled(int $userId, string $type): bool
    {
        $col = 'sms_' . $type;
        return $this->getColumnValue($userId, $col);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private function getColumnValue(int $userId, string $col): bool
    {
        $allowed = [
            'email_new_booking', 'email_status_changed', 'email_build_update', 'email_parts_update',
            'inapp_status_changed', 'inapp_build_update', 'inapp_parts_update',
            'inapp_new_booking', 'inapp_assignment', 'inapp_security_alert', 'inapp_slot_available',
            'sms_new_booking', 'sms_assignment', 'sms_status_changed',
        ];
        if (!in_array($col, $allowed, true)) {
            return true; // default on for unknown types
        }
        $row = $this->fetchRow($userId);
        if ($row === null) return true; // no row → defaults are all on
        return (bool) ($row[$col] ?? 1);
    }

    /** @return array<string, mixed>|null */
    private function fetchRow(int $userId): ?array
    {
        $stmt = $this->db->prepare(
            'SELECT * FROM notification_preferences WHERE user_id = :uid LIMIT 1'
        );
        $stmt->execute([':uid' => $userId]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    private function ensureRow(int $userId): void
    {
        $this->db->prepare(
            'INSERT IGNORE INTO notification_preferences (user_id) VALUES (:uid)'
        )->execute([':uid' => $userId]);
    }

    /** @param array<string, mixed> $row */
    private function format(array $row): array
    {
        return [
            'emailNewBooking'    => (bool) ($row['email_new_booking']    ?? 1),
            'emailStatusChanged' => (bool) ($row['email_status_changed'] ?? 1),
            'emailBuildUpdate'   => (bool) ($row['email_build_update']   ?? 1),
            'emailPartsUpdate'   => (bool) ($row['email_parts_update']   ?? 1),
            'inappStatusChanged' => (bool) ($row['inapp_status_changed'] ?? 1),
            'inappBuildUpdate'   => (bool) ($row['inapp_build_update']   ?? 1),
            'inappPartsUpdate'   => (bool) ($row['inapp_parts_update']   ?? 1),
            'inappNewBooking'    => (bool) ($row['inapp_new_booking']    ?? 1),
            'inappAssignment'    => (bool) ($row['inapp_assignment']     ?? 1),
            'inappSecurityAlert' => (bool) ($row['inapp_security_alert'] ?? 1),
            'inappSlotAvailable' => (bool) ($row['inapp_slot_available'] ?? 1),
            'smsNewBooking'      => (bool) ($row['sms_new_booking']      ?? 1),
            'smsAssignment'      => (bool) ($row['sms_assignment']       ?? 1),
            'smsStatusChanged'   => (bool) ($row['sms_status_changed']   ?? 1),
        ];
    }
}
