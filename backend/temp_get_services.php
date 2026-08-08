<?php
require __DIR__.'/config/init.php';
$db = Database::getInstance();
$stmt = $db->query('SELECT id, title FROM services');
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
