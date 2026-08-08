<?php

declare(strict_types=1);

use setasign\Fpdi\Tcpdf\Fpdi;

require_once __DIR__ . '/ChecklistPdfTemplates.php';

/**
 * Renders a filled checklist PDF by importing the original flat PDF page as a
 * template (via FPDI) and drawing text + checkmarks on top of it at fixed
 * coordinates (via TCPDF), instead of rebuilding the document as HTML.
 *
 * Requires: composer require setasign/fpdi setasign/fpdi-tcpdf tecnickcom/tcpdf
 */
final class ChecklistPdfOverlayRenderer
{
    private const INK_COLOR = [30, 41, 59];   // #1e293b - matches the template's dark navy text
    private const CHECK_COLOR = [249, 115, 22]; // #f97316 - brand orange, for checkmarks

    /**
     * @param array<string, mixed> $checklist Result of InquiryChecklistService::formatChecklistResponse()
     * @param array<string, mixed> $inquiry   Row from customer_inquiries (array or mapped assoc array)
     * @param array<string, mixed> $template  ChecklistPdfTemplates::forServiceTitle() result
     * @return string Raw PDF bytes
     */
    public function render(array $checklist, array $inquiry, array $template, ?array $beforeChecklist = null): string
    {
        if (!is_file($template['template_path'])) {
            throw new RuntimeException("Checklist template PDF not found at: {$template['template_path']}");
        }

        $pdf = new Fpdi('P', 'mm', 'A4');
        $pdf->SetAutoPageBreak(false);
        $pdf->SetMargins(0, 0, 0);
        $pdf->setPrintHeader(false);
        $pdf->setPrintFooter(false);

        $pageCount = $pdf->setSourceFile($template['template_path']);
        $templateId = $pdf->importPage(1);
        $size = $pdf->getTemplateSize($templateId);

        $pdf->AddPage($size['orientation'], [$size['width'], $size['height']]);
        $pdf->useTemplate($templateId, 0, 0, $size['width'], $size['height'], true);

        $pdf->SetFont('helvetica', '', 10);
        $pdf->SetTextColor(...self::INK_COLOR);

        $this->drawHeaderFields($pdf, $template, $checklist, $inquiry);

        if ($checklist['phase'] === 'before') {
            $this->drawBeforeTable($pdf, $template, $checklist);
        } else {
            // For after phase: draw the before section using before checklist data,
            // then draw the after sections using the after checklist data.
            if ($beforeChecklist !== null && isset($template['before'])) {
                $this->drawBeforeTable($pdf, $template, $beforeChecklist);
            }
            $this->drawAfterSections($pdf, $template, $checklist);
        }

        if (!empty($checklist['customerAcknowledged'])) {
            $this->drawAcknowledgement($pdf, $template);
        }

        return $pdf->Output('', 'S');
    }

    private function px(float $px): float
    {
        return ChecklistPdfTemplates::toMM($px);
    }

    /**
     * @param array<string, mixed> $template
     * @param array<string, mixed> $checklist
     * @param array<string, mixed> $inquiry
     */
    private function drawHeaderFields(Fpdi $pdf, array $template, array $checklist, array $inquiry): void
    {
        $fields = $template['header_fields'];

        $customerName = (string) ($inquiry['fullName'] ?? $inquiry['full_name'] ?? '');
        $vehicle = trim(
            (string) ($inquiry['make'] ?? '') . ' ' .
            (string) ($inquiry['model'] ?? '') . ' ' .
            (string) ($inquiry['yearModel'] ?? $inquiry['year_model'] ?? '')
        );
        $plateNumber = (string) ($inquiry['plateNumber'] ?? $inquiry['plate_number'] ?? '');
        $installerName = (string) ($checklist['installerName'] ?? '');
        $serviceFieldValue = (string) ($checklist['serviceFieldValue'] ?? ''); // headlight setup / head unit model

        // Use the appointment/booking date from the inquiry as the PDF date
        $dateSource = $inquiry['appointment_date'] ?? $inquiry['created_at'] ?? $checklist['createdAt'] ?? null;
        $date = $dateSource ? date('M j, Y', strtotime((string) $dateSource)) : date('M j, Y');


        $this->text($pdf, $fields['customer_name'], $customerName);
        $this->text($pdf, $fields['date'], $date);
        $this->text($pdf, $fields['vehicle'], $vehicle);
        $this->text($pdf, $fields['plate_number'], $plateNumber);
        $this->text($pdf, $fields['service_field'], $serviceFieldValue);
        $this->text($pdf, $fields['installer_name'], $installerName);
    }

    /**
     * @param array{x:int,y:int} $pos px coordinates (baseline, left-aligned)
     */
    private function text(Fpdi $pdf, array $pos, string $value): void
    {
        if ($value === '') {
            return;
        }
        // Available width to the right edge of the header box (~1150px) minus x.
        $maxWidthPx = 1140 - $pos['x'];
        $pdf->SetXY($this->px((float) $pos['x']), $this->px((float) $pos['y']) - 3.2);
        $pdf->Cell($this->px((float) $maxWidthPx), 5, $value, 0, 0, 'L');
    }

    /**
     * @param array<string, mixed> $template
     * @param array<string, mixed> $checklist
     */
    private function drawBeforeTable(Fpdi $pdf, array $template, array $checklist): void
    {
        $cfg = $template['before'];
        $rowsY = $cfg['rows_y'];
        $boxSize = (float) $cfg['checkbox_size'];
        $checkboxX = (float) $cfg['checkbox_x'];
        $notesX = (float) $cfg['notes_x'];

        $responses = $checklist['responses'];

        foreach ($rowsY as $i => $yTop) {
            if (!isset($responses[$i])) {
                continue;
            }
            $resp = $responses[$i];
            $centerY = $yTop + $boxSize / 2;

            if (!empty($resp['isChecked'])) {
                $this->drawCheckmark($pdf, $checkboxX, $yTop, $boxSize);
            }

            $notes = trim((string) ($resp['notes'] ?? ''));
            if ($notes !== '') {
                $pdf->SetFont('helvetica', '', 9);
                $pdf->SetXY($this->px($notesX), $this->px($centerY) - 3);
                $pdf->Cell($this->px(1149 - $notesX), 5, $notes, 0, 0, 'L');
                $pdf->SetFont('helvetica', '', 10);
            }
        }
    }

    /**
     * @param array<string, mixed> $template
     * @param array<string, mixed> $checklist
     */
    private function drawAfterSections(Fpdi $pdf, array $template, array $checklist): void
    {
        // Group responses by section (uppercased) to match the template keys.
        $bySection = [];
        foreach ($checklist['responses'] as $resp) {
            $section = strtoupper((string)($resp['item']['section'] ?? ''));
            $bySection[$section][] = $resp;
        }

        foreach ($template['after_sections'] as $sectionKey => $cfg) {
            $items = $bySection[strtoupper($sectionKey)] ?? [];
            $boxSize = (float) $cfg['checkbox_size'];
            $checkboxX = (float) $cfg['checkbox_x'];

            foreach ($cfg['rows_y'] as $i => $yTop) {
                if (!isset($items[$i])) {
                    continue;
                }
                if (!empty($items[$i]['isChecked'])) {
                    $this->drawCheckmark($pdf, $checkboxX, $yTop, $boxSize);
                }
            }
        }
    }

    /**
     * @param array<string, mixed> $template
     */
    private function drawAcknowledgement(Fpdi $pdf, array $template): void
    {
        $cfg = $template['acknowledgement'];
        $this->drawCheckmark($pdf, (float) $cfg['checkbox_x'], (float) $cfg['checkbox_y'], (float) $cfg['checkbox_size']);
    }

    /**
     * Draws a simple two-stroke checkmark centered inside a checkbox square
     * given in px (150dpi) coordinates: top-left x, top-left y, side length.
     */
    private function drawCheckmark(Fpdi $pdf, float $boxLeftPx, float $boxTopPx, float $sizePx): void
    {
        $left = $this->px($boxLeftPx);
        $top = $this->px($boxTopPx);
        $size = $this->px($sizePx);

        // Tick proportions relative to the box, inset ~18% on each side.
        $inset = $size * 0.18;
        $x1 = $left + $inset;
        $y1 = $top + $size * 0.55;
        $x2 = $left + $size * 0.42;
        $y2 = $top + $size - $inset;
        $x3 = $left + $size - $inset;
        $y3 = $top + $inset;

        $pdf->SetLineWidth(0.6);
        $pdf->SetDrawColor(...self::CHECK_COLOR);
        $pdf->Line($x1, $y1, $x2, $y2);
        $pdf->Line($x2, $y2, $x3, $y3);
    }
}
