<?php
require_once __DIR__ . '/../Engine/Database.php';

try {
    $db = Database::getInstance();
    $sql = file_get_contents(__DIR__ . '/../migrations/099_drop_inquiry_checklists.sql');
    $db->exec($sql);
    echo "Migration 099 executed cleanly!\n";
} catch (\Throwable $e) {
    echo "Error executing 099: " . $e->getMessage() . "\n";
}
