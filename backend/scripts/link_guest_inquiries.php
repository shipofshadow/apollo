#!/usr/bin/env php
<?php

/**
 * Autolink Guest Inquiries → User Accounts
 *
 * Scans all customer_inquiries rows where user_id IS NULL and
 * links them to a matching users record by email address (case-insensitive).
 *
 * Usage (from the backend/ directory):
 *   php scripts/link_guest_inquiries.php          – run (dry-run=false)
 *   php scripts/link_guest_inquiries.php --dry-run – preview only, no DB writes
 *
 * Safe to run repeatedly — only touches rows where user_id IS NULL.
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/init.php';

$dryRun = in_array('--dry-run', $argv ?? [], true);

echo "\n";
echo "========================================\n";
echo "  Guest Inquiry → Account Auto-Linker  \n";
echo "========================================\n";
echo $dryRun ? "  MODE: DRY RUN (no changes written)\n" : "  MODE: LIVE (writing changes to DB)\n";
echo "\n";

if (DB_NAME === '') {
    fwrite(STDERR, "Error: No database configured (DB_NAME is empty). This script requires a database.\n\n");
    exit(1);
}

try {
    $db = Database::getInstance();

    // Find all unlinked inquiries that have a matching user by email
    $stmt = $db->query(
        "SELECT
            ci.id            AS inquiry_id,
            ci.email_address AS inquiry_email,
            ci.full_name     AS inquiry_name,
            u.id             AS user_id,
            u.email          AS user_email,
            u.name           AS user_name
         FROM customer_inquiries ci
         INNER JOIN users u
            ON LOWER(TRIM(ci.email_address)) = LOWER(TRIM(u.email))
         WHERE ci.user_id IS NULL
         ORDER BY ci.created_at ASC"
    );

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $total = count($rows);

    if ($total === 0) {
        echo "  ✓ Nothing to link — all guest inquiries are already matched or no matches found.\n\n";
        exit(0);
    }

    echo "  Found {$total} unlinked inquiry/user match(es):\n\n";

    $linked = 0;
    $failed = 0;

    foreach ($rows as $row) {
        $inquiryId  = (string) $row['inquiry_id'];
        $userId     = (string) $row['user_id'];
        $email      = (string) $row['inquiry_email'];
        $name       = (string) $row['inquiry_name'];
        $userName   = (string) $row['user_name'];

        echo sprintf(
            "  [%s]  %-30s  →  user #%s (%s)\n",
            $inquiryId,
            mb_strimwidth($name ?: $email, 0, 30, '…'),
            $userId,
            $userName
        );

        if ($dryRun) {
            continue;
        }

        try {
            $update = $db->prepare(
                'UPDATE customer_inquiries SET user_id = :uid WHERE id = :id AND user_id IS NULL'
            );
            $update->execute([':uid' => $userId, ':id' => $inquiryId]);

            if ($update->rowCount() > 0) {
                $linked++;
            }
        } catch (\Throwable $e) {
            fwrite(STDERR, "    [ERROR] inquiry {$inquiryId}: " . $e->getMessage() . "\n");
            $failed++;
        }
    }

    echo "\n";

    if ($dryRun) {
        echo "  DRY RUN complete. {$total} row(s) would be linked.\n";
        echo "  Re-run without --dry-run to apply.\n\n";
    } else {
        echo "  ✓ Linked:  {$linked}\n";
        if ($failed > 0) {
            echo "  ✗ Failed:  {$failed}\n";
        }
        echo "\n  Done.\n\n";
    }

    exit($failed > 0 ? 1 : 0);

} catch (\Throwable $e) {
    fwrite(STDERR, "\nFatal error: " . $e->getMessage() . "\n\n");
    exit(1);
}
