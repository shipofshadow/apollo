<?php
require 'index.php';
$db = Database::getInstance();
$stmt = $db->query('DESCRIBE customer_inquiries');
foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $r) {
    echo $r['Field'] . ' | ' . $r['Type'] . "\n";
}
echo "\n--- inquiry_checklists ---\n";
$stmt2 = $db->query('DESCRIBE inquiry_checklists');
foreach ($stmt2->fetchAll(PDO::FETCH_ASSOC) as $r) {
    echo $r['Field'] . ' | ' . $r['Type'] . "\n";
}
