<?php

declare(strict_types=1);

use setasign\Fpdi\Tcpdf\Fpdi;

require_once __DIR__ . '/ChecklistPdfTemplates.php';

/**
 * Renders a filled checklist PDF by importing the original flat PDF template
 * page via FPDI and drawing header text, checkmarks, and the signature on top.
 *
 * All coordinates in the template config are in MILLIMETRES and are used
 * directly with TCPDF (which operates in mm when the page unit is 'mm').
 */
final class ChecklistPdfOverlayRenderer
{
    /** Dark navy for body text */
    private const INK       = [30, 41, 59];
    /** Brand orange for checkmarks */
    private const CHECK_INK = [249, 115, 22];

    /**
     * @param array<string, mixed> $payload  Decoded JSON payload from the frontend
     * @param array<string, mixed> $template Template config from ChecklistPdfTemplates
     * @return string Raw PDF binary string
     */
    public function renderPublicChecklist(array $payload, array $template): string
    {
        $templatePath = $template['template_path'];

        if (!is_file($templatePath)) {
            throw new RuntimeException("Checklist template PDF not found: {$templatePath}");
        }

        $realPath = $templatePath;
        $tmpNormalizedPath = null;
        $rawContent = (string) file_get_contents($templatePath);

        // Normalize CRLF line endings to LF if git converted line endings on server deployment.
        // This ensures FPDI xref offsets match 100% perfectly without any object type errors.
        if (str_contains($rawContent, "\r\n")) {
            $normalizedContent = str_replace("\r\n", "\n", $rawContent);
            $tmpNormalizedPath = tempnam(sys_get_temp_dir(), 'tpl_norm_') . '.pdf';
            file_put_contents($tmpNormalizedPath, $normalizedContent);
            $realPath = $tmpNormalizedPath;
        }

        try {
            $pdf = new Fpdi('P', 'mm', 'A4');
            $pdf->SetAutoPageBreak(false);
            $pdf->SetMargins(0, 0, 0);
            $pdf->setPrintHeader(false);
            $pdf->setPrintFooter(false);
            $pdf->SetFont('helvetica', '', 9);

            $pdf->setSourceFile($realPath);
            $tplId = $pdf->importPage(1);
            $size  = $pdf->getTemplateSize($tplId);

            $pdf->AddPage($size['orientation'], [$size['width'], $size['height']]);
            $pdf->useTemplate($tplId, 0, 0, $size['width'], $size['height'], true);

            // 1. Header fields
            $this->drawHeader($pdf, $template, $payload);

            // 2. Checklist items
            if (!empty($template['checklist']) && !empty($payload['responses'])) {
                $this->drawChecklistRows($pdf, $template['checklist'], $payload['responses']);
            }

            // 3. Orientation items (after-phase templates)
            if (!empty($template['orientation']) && !empty($payload['orientationResponses'])) {
                $this->drawOrientationRows($pdf, $template['orientation'], $payload['orientationResponses']);
            }

            // 4. Additional notes text
            $notesText = $this->str($payload, 'additionalNotes', 'additional_notes', 'notes');
            if ($notesText !== '' && !empty($template['additional_notes'])) {
                $this->drawAdditionalNotes($pdf, $template['additional_notes'], $notesText);
            }

            // 5. Customer signature image
            if (!empty($payload['signature']) && !empty($template['signature'])) {
                $this->drawSignature($pdf, $template['signature'], (string)$payload['signature']);
            }

            // 6. Signature date text
            if (!empty($template['sig_date'])) {
                $dateStr = $this->formatDate($this->str($payload, 'date'));
                $this->drawSigDate($pdf, $template['sig_date'], $dateStr);
            }

            return $pdf->Output('', 'S');
        } finally {
            if ($tmpNormalizedPath !== null && file_exists($tmpNormalizedPath)) {
                @unlink($tmpNormalizedPath);
            }
        }
    }

    // ─── Header ─────────────────────────────────────────────────────────────

    private function drawHeader(Fpdi $pdf, array $template, array $payload): void
    {
        $fields = $template['header_fields'];
        $pdf->SetTextColor(...self::INK);
        $pdf->SetFont('helvetica', '', 9);

        $customerName  = $this->str($payload, 'customerName', 'fullName');
        $date          = $this->formatDate($this->str($payload, 'date'));
        $vehicle       = $this->str($payload, 'vehicle');
        $plateNumber   = $this->str($payload, 'plateNumber');
        $serviceObj = is_array($payload['service'] ?? null) ? $payload['service'] : [];
        $serviceField  = $this->str($payload, 'serviceFieldValue', 'headUnitModel', 'headlightSetup', 'variationName', 'customVariation');
        if ($serviceField === '' && !empty($serviceObj)) {
            $serviceField = trim((string)($serviceObj['variationName'] ?? $serviceObj['customVariation'] ?? $serviceObj['serviceName'] ?? ''));
        }
        $installerName = $this->str($payload, 'installerName');

        $this->cell($pdf, $fields['customer_name'],  $customerName);
        $this->cell($pdf, $fields['date'],           $date);
        $this->cell($pdf, $fields['vehicle'],        $vehicle);
        $this->cell($pdf, $fields['plate_number'],   $plateNumber);
        $this->cell($pdf, $fields['service_field'],  $serviceField);
        $this->cell($pdf, $fields['installer_name'], $installerName);
    }

    // ─── Checklist rows ──────────────────────────────────────────────────────

    private function drawChecklistRows(Fpdi $pdf, array $cfg, array $responses): void
    {
        $cbX    = (float)$cfg['checkbox_x'];
        $cbSize = (float)$cfg['checkbox_size'];
        $notesX = (float)$cfg['notes_x'];
        $rowsY  = $cfg['rows_y'];

        foreach ($rowsY as $i => $yTop) {
            if (!isset($responses[$i])) {
                continue;
            }
            $resp = $responses[$i];
            $isChecked = is_array($resp)
                ? (!empty($resp['isChecked']) || !empty($resp['checked']))
                : (bool)$resp;

            if ($isChecked) {
                $this->drawCheckmark($pdf, $cbX, (float)$yTop, $cbSize);
            }

            $notes = is_array($resp) ? trim((string)($resp['notes'] ?? '')) : '';
            if ($notes !== '') {
                $pdf->SetFont('helvetica', '', 7.5);
                $pdf->SetTextColor(...self::INK);
                $pdf->SetXY($notesX, (float)$yTop + 0.5);
                $pdf->Cell(195 - $notesX, 4, $notes, 0, 0, 'L');
                $pdf->SetFont('helvetica', '', 9);
            }
        }
    }

    // ─── Orientation rows ────────────────────────────────────────────────────

    private function drawOrientationRows(Fpdi $pdf, array $cfg, array $responses): void
    {
        $cbX    = (float)$cfg['checkbox_x'];
        $cbSize = (float)$cfg['checkbox_size'];
        $rowsY  = $cfg['rows_y'];

        foreach ($rowsY as $i => $yTop) {
            $isChecked = !empty($responses[$i]);
            if ($isChecked) {
                $this->drawCheckmark($pdf, $cbX, (float)$yTop, $cbSize);
            }
        }
    }

    // ─── Signature ───────────────────────────────────────────────────────────

    private function drawSignature(Fpdi $pdf, array $cfg, string $dataUrl): void
    {
        if (!str_contains($dataUrl, 'data:image')) {
            return;
        }

        $parts = explode(',', $dataUrl, 2);
        if (count($parts) !== 2) {
            return;
        }

        $rawImg = base64_decode($parts[1]);
        if ($rawImg === false || strlen($rawImg) < 100) {
            return;
        }

        try {
            // Process signature via GD to make white/light background 100% transparent
            if (function_exists('imagecreatefromstring')) {
                $gdImg = @imagecreatefromstring($rawImg);
                if ($gdImg !== false) {
                    $width  = imagesx($gdImg);
                    $height = imagesy($gdImg);

                    $transparentImg = imagecreatetruecolor($width, $height);
                    imagealphablending($transparentImg, false);
                    imagesavealpha($transparentImg, true);

                    $transColor = imagecolorallocatealpha($transparentImg, 0, 0, 0, 127);
                    imagefill($transparentImg, 0, 0, $transColor);

                    for ($x = 0; $x < $width; $x++) {
                        for ($y = 0; $y < $height; $y++) {
                            $rgba = imagecolorat($gdImg, $x, $y);
                            $r = ($rgba >> 16) & 0xFF;
                            $g = ($rgba >> 8) & 0xFF;
                            $b = $rgba & 0xFF;
                            $a = ($rgba >> 24) & 0x7F;

                            // Convert white and light background pixels (R,G,B > 190) to 100% transparent
                            if ($a > 100 || ($r > 190 && $g > 190 && $b > 190)) {
                                imagesetpixel($transparentImg, $x, $y, $transColor);
                            } else {
                                $inkColor = imagecolorallocatealpha($transparentImg, $r, $g, $b, $a);
                                imagesetpixel($transparentImg, $x, $y, $inkColor);
                            }
                        }
                    }

                    ob_start();
                    imagepng($transparentImg);
                    $processedPng = ob_get_clean();
                    imagedestroy($gdImg);
                    imagedestroy($transparentImg);

                    if ($processedPng !== false && strlen($processedPng) > 100) {
                        $rawImg = $processedPng;
                    }
                }
            }

            $pdf->Image(
                '@' . $rawImg,
                (float)$cfg['x'],
                (float)$cfg['y'],
                (float)$cfg['w'],
                (float)$cfg['h'],
                'PNG'
            );
        } catch (\Throwable $e) {
            error_log('PDF signature embed failed: ' . $e->getMessage());
        }
    }

    // ─── Additional Notes ────────────────────────────────────────────────────

    private function drawAdditionalNotes(Fpdi $pdf, array $cfg, string $text): void
    {
        if (trim($text) === '') {
            return;
        }

        $pdf->SetTextColor(...self::INK);
        $pdf->SetFont('helvetica', '', 8);
        $x = (float)$cfg['x'];
        $y = (float)$cfg['y'];
        $w = (float)($cfg['w'] ?? 180.0);  // default width spans most of the page
        $h = (float)($cfg['h'] ?? 30.0);

        $pdf->SetXY($x, $y);
        $pdf->MultiCell($w, 4.5, $text, 0, 'L', false, 1, $x, $y, true, 0, false, true, $h, 'T');
        $pdf->SetFont('helvetica', '', 9);
    }

    // ─── Signature Date ──────────────────────────────────────────────────────

    private function drawSigDate(Fpdi $pdf, array $cfg, string $dateStr): void
    {
        if ($dateStr === '') {
            return;
        }

        $pdf->SetTextColor(...self::INK);
        $pdf->SetFont('helvetica', '', 9);
        $x = (float)$cfg['x'];
        $y = (float)$cfg['y'];
        $w = (float)($cfg['w'] ?? 45.0);

        $pdf->SetXY($x, $y);
        $pdf->Cell($w, 4.5, $dateStr, 0, 0, 'C');
    }

    // ─── Drawing primitives ──────────────────────────────────────────────────

    /**
     * Write text into a field position defined by x, y, w in mm.
     */
    private function cell(Fpdi $pdf, array $pos, string $value): void
    {
        if ($value === '') {
            return;
        }
        $pdf->SetXY((float)$pos['x'], (float)$pos['y']);
        $pdf->Cell((float)$pos['w'], 4.5, $value, 0, 0, 'L');
    }

    /**
     * Draw a checkmark (✓ shape) centred inside the given checkbox rectangle.
     * All parameters are in mm.
     */
    private function drawCheckmark(Fpdi $pdf, float $x, float $y, float $size): void
    {
        // Inset the checkmark slightly from the square edges
        $inset = $size * 0.15;

        // Three points: left-mid, bottom-centre, top-right
        $x1 = $x + $inset;
        $y1 = $y + $size * 0.55;

        $x2 = $x + $size * 0.42;
        $y2 = $y + $size - $inset;

        $x3 = $x + $size - $inset;
        $y3 = $y + $inset;

        $pdf->SetDrawColor(...self::CHECK_INK);
        $pdf->SetLineWidth(0.65);
        $pdf->Line($x1, $y1, $x2, $y2);
        $pdf->Line($x2, $y2, $x3, $y3);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    /** Get the first non-empty string from multiple payload keys. */
    private function str(array $payload, string ...$keys): string
    {
        foreach ($keys as $k) {
            $v = trim((string)($payload[$k] ?? ''));
            if ($v !== '') {
                return $v;
            }
        }
        return '';
    }



    private function formatDate(string $date): string
    {
        if ($date === '') {
            return date('M j, Y');
        }
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            return date('M j, Y', (int)strtotime($date));
        }
        return $date;
    }
}
