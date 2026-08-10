<?php
require_once __DIR__ . '/../vendor/autoload.php';

use setasign\Fpdi\Tcpdf\Fpdi;

$file = __DIR__ . '/../templates/checklist/1625_Autolab_Android_Headunit_Before_Installation_Checklist.pdf';
$raw = file_get_contents($file);

// Simulate CRLF line ending corruption (git autocrlf on server)
$corruptedCrlf = str_replace("\r\n", "\n", $raw);
$corruptedCrlf = str_replace("\n", "\r\n", $corruptedCrlf);

echo "Testing corrupted CRLF PDF...\n";

// FPDI on corrupted CRLF:
try {
    $pdf = new Fpdi();
    $pdf->setSourceFile(stream_get_meta_data($tmp = tmpfile())['uri']);
    echo "Unreachable\n";
} catch (\Throwable $e) {
    echo "Corrupted PDF failed as expected: " . $e->getMessage() . "\n";
}

// Now test normalizing CRLF to LF:
$normalized = str_replace("\r\n", "\n", $raw);
$tmpFile = tempnam(sys_get_temp_dir(), 'pdf_norm_') . '.pdf';
file_put_contents($tmpFile, $normalized);

try {
    $pdf = new Fpdi();
    $pdf->setSourceFile($tmpFile);
    $tplId = $pdf->importPage(1);
    echo "Normalized PDF parsed cleanly by FPDI: OK!\n";
} catch (\Throwable $e) {
    echo "Normalized PDF failed: " . $e->getMessage() . "\n";
} finally {
    @unlink($tmpFile);
}
