<?php
require 'index.php';
$db = Database::getInstance();
$stmt = $db->query("SELECT i.id, s.title FROM customer_inquiries i JOIN services s ON i.service_id = s.id WHERE s.title LIKE '%Headlight%' OR s.title LIKE '%Android%' LIMIT 5");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
