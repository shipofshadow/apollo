<?php
require 'vendor/autoload.php';
$pdo = new PDO("mysql:host=localhost;dbname=dionysus", 'root', '');
$stmt = $pdo->query("SELECT id, name FROM services");
print_r($stmt->fetchAll(PDO::FETCH_ASSOC));
