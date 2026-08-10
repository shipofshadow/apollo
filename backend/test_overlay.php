<?php
/**
 * End-to-end test of ChecklistPdfOverlayRenderer with the new coordinate system.
 * Run: php test_overlay.php android_before|android_after|headlight_before|headlight_after
 * Output: test_overlay_<template>.pdf
 */

ini_set('display_errors', 1);
error_reporting(E_ALL);

require __DIR__ . '/vendor/autoload.php';
require __DIR__ . '/Engine/ChecklistPdfTemplates.php';
require __DIR__ . '/Engine/ChecklistPdfOverlayRenderer.php';

$templateKey = $argv[1] ?? 'android_before';

[$serviceSlug, $phase] = match($templateKey) {
    'android_before'    => ['android-headunit', 'before'],
    'android_after'     => ['android-headunit', 'after'],
    'headlight_before'  => ['projector-headlight', 'before'],
    'headlight_after'   => ['projector-headlight', 'after'],
    default             => ['android-headunit', 'before'],
};

$template = ChecklistPdfTemplates::forServiceAndPhase($serviceSlug, $phase);
if ($template === null) {
    echo "ERROR: No template found for {$serviceSlug}/{$phase}\n";
    exit(1);
}

// Build a fake payload with realistic data
$isAfter = $phase === 'after';

$responsesCount = $isAfter ? 16 : 13;
if ($serviceSlug === 'android-headunit' && !$isAfter) $responsesCount = 9;
if ($serviceSlug === 'android-headunit' && $isAfter)  $responsesCount = 16;

$responses = [];
for ($i = 0; $i < $responsesCount; $i++) {
    $responses[] = [
        'isChecked' => true,
        'notes'     => $i % 3 === 0 ? 'Test note for item #' . ($i + 1) : '',
    ];
}

$orientationResponses = [];
if ($isAfter) {
    $oCount = ($serviceSlug === 'android-headunit') ? 6 : 5;
    for ($i = 0; $i < $oCount; $i++) {
        $orientationResponses[] = true;
    }
}

// Create a transparent-background PNG signature (matching what the real canvas produces)
$fakeSigGd = imagecreatetruecolor(300, 80);
imagesavealpha($fakeSigGd, true);
imagealphablending($fakeSigGd, false);
$transparent = imagecolorallocatealpha($fakeSigGd, 0, 0, 0, 127);
imagefill($fakeSigGd, 0, 0, $transparent);
imagealphablending($fakeSigGd, true);
$orange = imagecolorallocate($fakeSigGd, 249, 115, 22);
imagesetthickness($fakeSigGd, 3);
imageline($fakeSigGd, 10, 60, 80, 20, $orange);
imageline($fakeSigGd, 80, 20, 150, 55, $orange);
imageline($fakeSigGd, 150, 55, 240, 15, $orange);
ob_start();
imagepng($fakeSigGd);
$pngBytes = ob_get_clean();
imagedestroy($fakeSigGd);
$sigDataUrl = 'data:image/png;base64,' . base64_encode($pngBytes);

$payload = [
    'serviceSlug'          => $serviceSlug,
    'phaseSlug'            => $phase,
    'customerName'         => 'Juan dela Cruz',
    'date'                 => '2025-08-10',
    'vehicle'              => 'Toyota Vios 2022 (Silver)',
    'plateNumber'          => 'ABC 1234',
    'serviceFieldValue'    => $serviceSlug === 'android-headunit'
                              ? '9-inch Android 12 Head Unit'
                              : 'Bi-LED 3.0" Projector + Shroud',
    'installerName'        => 'Carlo Santos',
    'responses'            => $responses,
    'orientationResponses' => $orientationResponses,
    'customerAcknowledged' => true,
    'signature'            => $sigDataUrl,
    'additional_notes' => 'lorem ipsum dolor sit amet'
];

$renderer = new ChecklistPdfOverlayRenderer();
$pdfBytes = $renderer->renderPublicChecklist($payload, $template);

$outFile = __DIR__ . '/test_overlay_' . $templateKey . '.pdf';
file_put_contents($outFile, $pdfBytes);
echo "Saved: $outFile (" . strlen($pdfBytes) . " bytes)\n";
