<?php
require 'Engine/Database.php';
$db = Database::getInstance();
$stmt = $db->query('SHOW COLUMNS FROM products');
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
