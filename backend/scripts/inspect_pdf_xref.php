<?php
$dir = __DIR__ . '/../templates/checklist/';
$files = glob($dir . '*.pdf');

foreach ($files as $f) {
    $content = file_get_contents($f);
    $header = substr($content, 0, 50);
    $tail = substr($content, -200);
    $hasXrefKeyword = (strpos($content, "\nxref\n") !== false || strpos($content, "\rxref\r") !== false || strpos($content, "\r\nxref\r\n") !== false);
    $hasObjStm = (strpos($content, '/ObjStm') !== false);
    $hasXrefType = (strpos($content, '/Type /XRef') !== false || strpos($content, '/Type/XRef') !== false);
    
    echo "File: " . basename($f) . "\n";
    echo "  Header: " . trim($header) . "\n";
    echo "  Has 'xref' keyword: " . ($hasXrefKeyword ? "YES" : "NO") . "\n";
    echo "  Has '/ObjStm': " . ($hasObjStm ? "YES" : "NO") . "\n";
    echo "  Has '/Type /XRef': " . ($hasXrefType ? "YES" : "NO") . "\n";
    echo "  Tail length: " . strlen($tail) . "\n\n";
}
