<?php
require_once __DIR__ . '/config/init.php';
try {
    $db = Database::getInstance();
    $stmt = $db->query("SELECT * FROM migrations");
    print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
} catch (Exception $e) {
    echo $e->getMessage();
}
