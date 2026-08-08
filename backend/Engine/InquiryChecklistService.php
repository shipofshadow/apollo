<?php

declare(strict_types=1);

class InquiryChecklistService
{
    private $db;
    private $notificationService;
    private $activity;

    public function __construct()
    {
        if (DB_NAME === '') {
            throw new RuntimeException("Database is required for checklist service.");
        }
        $this->db = Database::getInstance();
        $this->notificationService = new NotificationService();
        $this->activity = new InquiryActivityService();
    }

    /**
     * @return array<string, mixed>
     */
    public function getForInquiry(string $inquiryId): array
    {
        return [
            'before' => $this->getOrInit($inquiryId, 'before'),
            'after' => $this->getOrInit($inquiryId, 'after'),
            'acknowledgement' => $this->getOrInit($inquiryId, 'acknowledgement')
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function getOrInit(string $inquiryId, string $phase): ?array
    {
        // 1. Get Inquiry to ensure it exists and get service_id
        $inquirySvc = new InquiryService();
        // Since InquiryService::dbGetById is private, we will query directly
        $stmtInq = $this->db->prepare('SELECT id, service_id FROM customer_inquiries WHERE id = :id');
        $stmtInq->execute([':id' => $inquiryId]);
        $inquiry = $stmtInq->fetch(PDO::FETCH_ASSOC);

        if (!$inquiry) {
            throw new RuntimeException("Inquiry not found.", 404);
        }
        if (!$inquiry['service_id']) {
            return null; // No service assigned, no checklist possible
        }

        $serviceId = (int)$inquiry['service_id'];

        // 2. Look for existing checklist
        $stmtCheck = $this->db->prepare(
            'SELECT id, inquiry_id, service_id, phase, submitted_by, general_notes, 
                    customer_acknowledged, installer_name, service_field_value, submitted_at, created_at, updated_at
             FROM inquiry_checklists
             WHERE inquiry_id = :inquiry_id AND phase = :phase'
        );
        $stmtCheck->execute([':inquiry_id' => $inquiryId, ':phase' => $phase]);
        $checklistRow = $stmtCheck->fetch(PDO::FETCH_ASSOC);

        // If the inquiry's service changed and this draft checklist wasn't submitted yet, reset it to match the new service
        if ($checklistRow && (int)$checklistRow['service_id'] !== $serviceId && empty($checklistRow['submitted_at'])) {
            $stmtDel = $this->db->prepare('DELETE FROM inquiry_checklists WHERE id = :id');
            $stmtDel->execute([':id' => $checklistRow['id']]);
            $checklistRow = false;
        }

        $isNew = false;
        if (!$checklistRow) {
            // Create a draft checklist
            $this->db->beginTransaction();
            try {
                $prevInstaller = null;
                $prevNotes = null;
                $prevFieldValue = null;
                if ($phase === 'after' || $phase === 'acknowledgement') {
                    $stmtPrev = $this->db->prepare('SELECT installer_name, general_notes, service_field_value FROM inquiry_checklists WHERE inquiry_id = :inquiry_id AND phase = :phase');
                    $stmtPrev->execute([':inquiry_id' => $inquiryId, ':phase' => 'before']);
                    if ($prev = $stmtPrev->fetch(PDO::FETCH_ASSOC)) {
                        $prevInstaller = $prev['installer_name'];
                        $prevNotes = $prev['general_notes'];
                        $prevFieldValue = $prev['service_field_value'];
                    }
                }

                $stmtInsert = $this->db->prepare(
                    'INSERT INTO inquiry_checklists (inquiry_id, service_id, phase, installer_name, general_notes, service_field_value)
                     VALUES (:inquiry_id, :service_id, :phase, :installer_name, :general_notes, :service_field_value)'
                );
                $stmtInsert->execute([
                    ':inquiry_id' => $inquiryId,
                    ':service_id' => $serviceId,
                    ':phase' => $phase,
                    ':installer_name' => $prevInstaller,
                    ':general_notes' => $prevNotes,
                    ':service_field_value' => $prevFieldValue
                ]);
                $checklistId = (int)$this->db->lastInsertId();

                // Populate with active template items for this service/phase
                $stmtItems = $this->db->prepare(
                    'SELECT id FROM service_checklist_items WHERE service_id = :service_id AND phase = :phase AND is_active = 1'
                );
                $stmtItems->execute([':service_id' => $serviceId, ':phase' => $phase]);
                $templateItems = $stmtItems->fetchAll(PDO::FETCH_ASSOC);

                if (count($templateItems) > 0) {
                    // For after/acknowledgement, try to seed from before responses
                    $beforeResponsesMap = [];
                    if ($phase === 'after' || $phase === 'acknowledgement') {
                        $stmtBeforeChecklist = $this->db->prepare(
                            'SELECT id FROM inquiry_checklists WHERE inquiry_id = :inquiry_id AND phase = :phase LIMIT 1'
                        );
                        $stmtBeforeChecklist->execute([':inquiry_id' => $inquiryId, ':phase' => 'before']);
                        if ($beforeChecklist = $stmtBeforeChecklist->fetch(PDO::FETCH_ASSOC)) {
                            $stmtBeforeResp = $this->db->prepare(
                                'SELECT item_id, is_checked, notes FROM inquiry_checklist_responses WHERE checklist_id = :checklist_id'
                            );
                            $stmtBeforeResp->execute([':checklist_id' => $beforeChecklist['id']]);
                            foreach ($stmtBeforeResp->fetchAll(PDO::FETCH_ASSOC) as $br) {
                                $beforeResponsesMap[(int)$br['item_id']] = $br;
                            }
                        }
                    }

                    $stmtResp = $this->db->prepare(
                        'INSERT INTO inquiry_checklist_responses (checklist_id, item_id, is_checked, notes)
                         VALUES (:checklist_id, :item_id, :is_checked, :notes)'
                    );
                    foreach ($templateItems as $ti) {
                        $itemId = (int)$ti['id'];
                        $isChecked = 0;
                        $notes = null;
                        if (isset($beforeResponsesMap[$itemId])) {
                            $isChecked = (int)$beforeResponsesMap[$itemId]['is_checked'];
                            $notes = $beforeResponsesMap[$itemId]['notes'];
                        }
                        $stmtResp->execute([
                            ':checklist_id' => $checklistId,
                            ':item_id'      => $itemId,
                            ':is_checked'   => $isChecked,
                            ':notes'        => $notes,
                        ]);
                    }
                }

                $this->db->commit();
                $isNew = true;
                
                // Fetch the newly created checklist
                $stmtCheck->execute([':inquiry_id' => $inquiryId, ':phase' => $phase]);
                $checklistRow = $stmtCheck->fetch(PDO::FETCH_ASSOC);
            } catch (Exception $e) {
                $this->db->rollBack();
                throw $e;
            }
        }

        // ---- Backfill installer_name / general_notes / service_field_value from 'before' when opening 'after' ----
        if ($checklistRow
            && ($phase === 'after' || $phase === 'acknowledgement')
            && (empty($checklistRow['installer_name']) || empty($checklistRow['general_notes']) || empty($checklistRow['service_field_value']))
        ) {
            $stmtPrev = $this->db->prepare(
                'SELECT installer_name, general_notes, service_field_value FROM inquiry_checklists
                 WHERE inquiry_id = :inquiry_id AND phase = :phase'
            );
            $stmtPrev->execute([':inquiry_id' => $inquiryId, ':phase' => 'before']);
            if ($prev = $stmtPrev->fetch(PDO::FETCH_ASSOC)) {
                $newInstaller  = empty($checklistRow['installer_name']) ? $prev['installer_name'] : $checklistRow['installer_name'];
                $newNotes      = empty($checklistRow['general_notes'])  ? $prev['general_notes']  : $checklistRow['general_notes'];
                $newFieldValue = empty($checklistRow['service_field_value']) ? $prev['service_field_value'] : $checklistRow['service_field_value'];
                if ($newInstaller !== $checklistRow['installer_name'] || $newNotes !== $checklistRow['general_notes'] || $newFieldValue !== $checklistRow['service_field_value']) {
                    $stmtUpd = $this->db->prepare(
                        'UPDATE inquiry_checklists
                         SET installer_name = :installer_name, general_notes = :general_notes, service_field_value = :service_field_value
                         WHERE id = :id'
                    );
                    $stmtUpd->execute([
                        ':installer_name'     => $newInstaller,
                        ':general_notes'      => $newNotes,
                        ':service_field_value' => $newFieldValue,
                        ':id'                 => $checklistRow['id']
                    ]);
                    $checklistRow['installer_name']     = $newInstaller;
                    $checklistRow['general_notes']      = $newNotes;
                    $checklistRow['service_field_value'] = $newFieldValue;
                }
            }
        }

        return $this->formatChecklistResponse($checklistRow);
    }

    /**
     * @param array<int, array<string, mixed>> $responses
     * @return array<string, mixed>
     */
    public function saveResponses(int $checklistId, array $responses, ?string $generalNotes, ?string $installerName = null, bool $customerAcknowledged = false, ?string $serviceFieldValue = null): array
    {
        $this->db->beginTransaction();
        try {
            $stmtUpdateChecklist = $this->db->prepare(
                'UPDATE inquiry_checklists 
                 SET general_notes = :notes, installer_name = :installer, customer_acknowledged = :ack,
                     service_field_value = :service_field_value
                 WHERE id = :id'
            );
            $stmtUpdateChecklist->execute([
                ':notes' => $generalNotes,
                ':installer' => $installerName,
                ':ack' => (int)$customerAcknowledged,
                ':service_field_value' => $serviceFieldValue,
                ':id' => $checklistId
            ]);

            $stmtUpdateItem = $this->db->prepare(
                'UPDATE inquiry_checklist_responses 
                 SET is_checked = :is_checked, notes = :notes 
                 WHERE id = :id AND checklist_id = :checklist_id'
            );

            foreach ($responses as $resp) {
                $stmtUpdateItem->execute([
                    ':is_checked' => (int)($resp['isChecked'] ?? 0),
                    ':notes' => $resp['notes'] ?? null,
                    ':id' => (int)($resp['id'] ?? 0),
                    ':checklist_id' => $checklistId
                ]);
            }

            $this->db->commit();
        } catch (Exception $e) {
            $this->db->rollBack();
            throw $e;
        }

        $stmt = $this->db->prepare('SELECT * FROM inquiry_checklists WHERE id = :id');
        $stmt->execute([':id' => $checklistId]);
        return $this->formatChecklistResponse($stmt->fetch(PDO::FETCH_ASSOC));
    }

    /**
     * @return array<string, mixed>
     */
    public function submit(int $checklistId, int $userId, ?string $installerName = null, bool $customerAcknowledged = false, ?string $serviceFieldValue = null): array
    {
        $stmtFetch = $this->db->prepare('SELECT inquiry_id, phase, submitted_at FROM inquiry_checklists WHERE id = :id');
        $stmtFetch->execute([':id' => $checklistId]);
        $info = $stmtFetch->fetch(PDO::FETCH_ASSOC);

        if (!$info) {
            throw new RuntimeException("Checklist not found.");
        }

        $wasAlreadySubmitted = !empty($info['submitted_at']);

        $stmt = $this->db->prepare(
            'UPDATE inquiry_checklists 
             SET submitted_at = COALESCE(submitted_at, CURRENT_TIMESTAMP),
                 submitted_by = COALESCE(submitted_by, :user_id),
                 installer_name = COALESCE(:installer, installer_name),
                 customer_acknowledged = :ack,
                 service_field_value = COALESCE(:service_field_value, service_field_value)
             WHERE id = :id'
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':installer' => $installerName,
            ':ack' => (int)$customerAcknowledged,
            ':service_field_value' => $serviceFieldValue,
            ':id' => $checklistId
        ]);

        if (!$wasAlreadySubmitted) {
            $this->activity->add(
                $info['inquiry_id'],
                ActivityEvents::INQUIRY_INTERNAL_NOTES_UPDATED,
                ucfirst($info['phase']) . ' checklist submitted',
                null,
                $userId,
                'staff'
            );
        }

        $stmtGet = $this->db->prepare('SELECT * FROM inquiry_checklists WHERE id = :id');
        $stmtGet->execute([':id' => $checklistId]);
        return $this->formatChecklistResponse($stmtGet->fetch(PDO::FETCH_ASSOC));
    }
    
    public function sendToClient(string $inquiryId, string $phase, int $sentByUserId): void
    {
        $db = Database::getInstance();
        $stmt = $db->prepare('SELECT id, email_address, full_name, service_id, user_id FROM customer_inquiries WHERE id = :id OR id = :inq_id');
        $stmt->execute([':id' => $inquiryId, ':inq_id' => 'inq-' . $inquiryId]);
        $inquiry = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$inquiry) {
            throw new RuntimeException("Inquiry not found.");
        }

        $clientEmail = $inquiry['email_address'] ?? '';
        if (!$clientEmail) {
            throw new RuntimeException("Client has no email address configured on inquiry.");
        }

        // Queue PDF generation + email send entirely in the background worker.
        // This avoids generating the ~1.6MB overlay PDF and doing SMTP in the HTTP request thread.
        $queue = new NotificationJobQueueService();
        $queue->dispatch('checklist_sent', [
            'inquiryId' => $inquiry['id'],
            'phase'     => $phase,
        ], null, false);

        $stmtUpdate = $db->prepare('UPDATE inquiry_checklists SET sent_at = CURRENT_TIMESTAMP WHERE inquiry_id = :id AND phase = :phase');
        $stmtUpdate->execute([':id' => $inquiryId, ':phase' => $phase]);

        // Log activity immediately so the UI reflects the action without waiting for the worker.
        $this->activity->add(
            $inquiryId,
            ActivityEvents::INQUIRY_INTERNAL_NOTES_UPDATED,
            'Installation checklist PDF report queued for delivery to client & shop owners',
            null,
            $sentByUserId,
            'staff'
        );

        // Notify client in-app immediately if they have an account.
        if (!empty($inquiry['user_id'])) {
            $serviceName = 'Service';
            if (!empty($inquiry['service_id'])) {
                $stmtSrv = $db->prepare('SELECT title FROM services WHERE id = :id');
                $stmtSrv->execute([':id' => $inquiry['service_id']]);
                if ($rowSrv = $stmtSrv->fetch(PDO::FETCH_ASSOC)) {
                    $serviceName = $rowSrv['title'];
                }
            }
            $inapp = new InAppNotificationService();
            $inapp->notifyUser(
                $inquiry['user_id'],
                'checklist_sent',
                "Installation Checklist for your {$serviceName} is being sent to your email.",
                ['inquiryId' => $inquiryId, 'phase' => $phase]
            );
        }
    }
    public function getChecklistPdfPublic(string $inquiryId, string $phase): string
    {
        $db = Database::getInstance();

        $stmt = $db->prepare(
            'SELECT id, full_name, service_id, created_at, appointment_date,
                    make, model, year_model, plate_number
             FROM customer_inquiries WHERE id = :id'
        );
        $stmt->execute([':id' => $inquiryId]);
        $inquiry = $stmt->fetch(\PDO::FETCH_ASSOC);

        if (!$inquiry || !$inquiry['service_id']) {
            throw new RuntimeException("Inquiry or associated service not found.");
        }

        $stmtService = $db->prepare('SELECT title FROM services WHERE id = :id');
        $stmtService->execute([':id' => $inquiry['service_id']]);
        $serviceName = $stmtService->fetchColumn() ?: 'Unknown Service';

        $checklistRow = $this->getOrInit($inquiryId, $phase);

        // For after phase, also load before data so the PDF can render both sections
        $beforeChecklistRow = null;
        if ($phase === 'after' || $phase === 'acknowledgement') {
            try {
                $beforeChecklistRow = $this->getOrInit($inquiryId, 'before');
            } catch (\Throwable $e) {
                // If no before checklist exists yet, just skip
            }
        }

        return $this->generateChecklistPdf($checklistRow, $inquiry, (string)$serviceName, $beforeChecklistRow);
    }

    private function generateChecklistPdf(array $checklist, array $inquiry, string $serviceName, ?array $beforeChecklist = null): string
    {
        require_once __DIR__ . '/ChecklistPdfTemplates.php';
        require_once __DIR__ . '/ChecklistPdfOverlayRenderer.php';

        $template = ChecklistPdfTemplates::forServiceTitle($serviceName);

        if ($template !== null && is_file($template['template_path'])) {
            try {
                // Use the stored service_field_value from the checklist itself.
                $checklist['serviceFieldValue'] = (string) ($checklist['serviceFieldValue'] ?? $checklist['service_field_value'] ?? $inquiry['additional_info'] ?? '');

                $renderer = new ChecklistPdfOverlayRenderer();
                return $renderer->render($checklist, $inquiry, $template, $beforeChecklist);
            } catch (\Throwable $e) {
                error_log('Checklist overlay PDF failed, falling back to HTML renderer: ' . $e->getMessage());
                // fall through to the HTML fallback below
            }
        }

        return $this->generateChecklistPdfFallback($checklist, $inquiry, $serviceName);
    }

    private function generateChecklistPdfFallback(array $checklist, array $inquiry, string $serviceName): string
    {
        if (!class_exists('\Mpdf\Mpdf')) {
            throw new RuntimeException("PDF generation library not found.");
        }
        
        $mpdf = new \Mpdf\Mpdf([
            'margin_left' => 15,
            'margin_right' => 15,
            'margin_top' => 15,
            'margin_bottom' => 15,
            'margin_header' => 0,
            'margin_footer' => 0,
        ]);
        
        $phaseLabel = strtoupper($checklist['phase']) . ' INSTALLATION CHECKLIST';
        
        $html = '<div style="font-family: sans-serif;">';
        $html .= '<h2 style="color: #f97316;">1625 AUTOLAB</h2>';
        $html .= '<h1 style="color: #1e293b; border-bottom: 2px solid #f97316; padding-bottom: 10px;">' . strtoupper($serviceName) . '</h1>';
        $html .= '<h3 style="background-color: #f97316; color: white; padding: 5px 10px;">' . $phaseLabel . '</h3>';
        
        $html .= '<table style="width: 100%; margin-bottom: 20px; font-size: 14px;">';
        $html .= '<tr><td style="padding: 5px;"><strong>Customer:</strong> ' . htmlspecialchars($inquiry['full_name']) . '</td>';
        $html .= '<td style="padding: 5px;"><strong>Date:</strong> ' . date('Y-m-d', strtotime($checklist['submittedAt'] ?? $checklist['updatedAt'])) . '</td></tr>';
        $html .= '<tr><td style="padding: 5px;"><strong>Vehicle:</strong> ' . htmlspecialchars($inquiry['make'] . ' ' . $inquiry['model'] . ' ' . $inquiry['year_model']) . '</td>';
        $html .= '<td style="padding: 5px;"><strong>Plate Number:</strong> ' . htmlspecialchars($inquiry['plate_number'] ?? 'N/A') . '</td></tr>';
        if ($checklist['installerName']) {
            $html .= '<tr><td colspan="2" style="padding: 5px;"><strong>Installer Name:</strong> ' . htmlspecialchars($checklist['installerName']) . '</td></tr>';
        }
        $html .= '</table>';
        
        // Group items by section
        $itemsBySection = [];
        foreach ($checklist['responses'] as $resp) {
            $sec = $resp['item']['section'] ?? 'General';
            $itemsBySection[$sec][] = $resp;
        }
        
        if ($checklist['phase'] === 'before') {
            $html .= '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">';
            $html .= '<tr style="background-color: #1e293b; color: white;">';
            $html .= '<th style="padding: 8px; text-align: left; border: 1px solid #ccc;">ITEM</th>';
            $html .= '<th style="padding: 8px; text-align: center; border: 1px solid #ccc; width: 80px;">CHECK</th>';
            $html .= '<th style="padding: 8px; text-align: left; border: 1px solid #ccc; width: 200px;">NOTES</th>';
            $html .= '</tr>';
            
            foreach ($checklist['responses'] as $resp) {
                $check = $resp['isChecked'] ? '✓' : ' ';
                $html .= '<tr>';
                $html .= '<td style="padding: 8px; border: 1px solid #ccc;">' . htmlspecialchars($resp['item']['label']) . '</td>';
                $html .= '<td style="padding: 8px; text-align: center; border: 1px solid #ccc; font-weight: bold; font-size: 16px;">' . $check . '</td>';
                $html .= '<td style="padding: 8px; border: 1px solid #ccc;">' . htmlspecialchars($resp['notes'] ?? '') . '</td>';
                $html .= '</tr>';
            }
            $html .= '</table>';
        } else {
            // After phase grouped
            $html .= '<table style="width: 100%;">';
            $html .= '<tr>';
            $colCount = count($itemsBySection);
            $width = $colCount > 0 ? (100 / $colCount) : 100;
            
            foreach ($itemsBySection as $section => $responses) {
                $html .= '<td style="width: ' . $width . '%; vertical-align: top; padding: 0 10px;">';
                $html .= '<div style="background-color: #1e293b; color: white; padding: 5px; text-align: center; font-weight: bold; font-size: 12px; margin-bottom: 10px;">' . strtoupper($section) . '</div>';
                $html .= '<table style="width: 100%; font-size: 12px; border-collapse: collapse;">';
                foreach ($responses as $resp) {
                    $box = $resp['isChecked'] ? '☑' : '☐';
                    $html .= '<tr>';
                    $html .= '<td style="width: 20px; font-size: 16px; padding: 2px 0;">' . $box . '</td>';
                    $html .= '<td style="padding: 2px 0;">' . htmlspecialchars($resp['item']['label']) . '</td>';
                    $html .= '</tr>';
                }
                $html .= '</table>';
                $html .= '</td>';
            }
            $html .= '</tr>';
            $html .= '</table>';
        }
        
        if ($checklist['customerAcknowledged']) {
            $html .= '<div style="margin-top: 30px; padding: 10px; border: 1px solid #f97316;">';
            $html .= '<h4 style="color: #f97316; margin-top: 0;">CUSTOMER ACKNOWLEDGEMENT</h4>';
            $html .= '<p style="font-size: 13px;">☑ I have inspected my vehicle and confirm that the installation has been completed to my satisfaction.</p>';
            $html .= '</div>';
        }

        if ($checklist['generalNotes']) {
            $html .= '<div style="margin-top: 20px;">';
            $html .= '<h4>General Notes</h4>';
            $html .= '<p style="font-size: 13px; border: 1px solid #ccc; padding: 10px;">' . nl2br(htmlspecialchars($checklist['generalNotes'])) . '</p>';
            $html .= '</div>';
        }
        
        $html .= '</div>';
        $mpdf->WriteHTML($html);
        return $mpdf->Output('', 'S');
    }

    private function formatChecklistResponse(array $row): array
    {
        $stmtResp = $this->db->prepare(
            'SELECT r.id, r.checklist_id, r.item_id, r.is_checked, r.notes, 
                    i.phase, i.section, i.label, i.description, i.has_notes, i.sort_order
             FROM inquiry_checklist_responses r
             JOIN service_checklist_items i ON r.item_id = i.id
             WHERE r.checklist_id = :checklist_id
             ORDER BY i.sort_order ASC'
        );
        $stmtResp->execute([':checklist_id' => $row['id']]);
        $responseRows = $stmtResp->fetchAll(PDO::FETCH_ASSOC);

        $responses = array_map(function($r) {
            return [
                'id' => (int)$r['id'],
                'checklistId' => (int)$r['checklist_id'],
                'itemId' => (int)$r['item_id'],
                'isChecked' => (bool)$r['is_checked'],
                'notes' => $r['notes'],
                'item' => [
                    'id' => (int)$r['item_id'],
                    'phase' => $r['phase'],
                    'section' => $r['section'],
                    'label' => $r['label'],
                    'description' => $r['description'],
                    'hasNotes' => (bool)$r['has_notes'],
                    'sortOrder' => (int)$r['sort_order']
                ]
            ];
        }, $responseRows);

        return [
            'id' => (int)$row['id'],
            'inquiryId' => $row['inquiry_id'],
            'serviceId' => (int)$row['service_id'],
            'phase' => $row['phase'],
            'submittedBy' => $row['submitted_by'] ? (int)$row['submitted_by'] : null,
            'generalNotes' => $row['general_notes'],
            'customerAcknowledged' => (bool)$row['customer_acknowledged'],
            'installerName' => $row['installer_name'],
            'serviceFieldValue' => $row['service_field_value'] ?? null,
            'submittedAt' => $row['submitted_at'],
            'sentAt' => $row['sent_at'] ?? null,
            'createdAt' => $row['created_at'],
            'updatedAt' => $row['updated_at'],
            'responses' => $responses
        ];
    }


}
