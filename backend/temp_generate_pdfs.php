<?php
require 'index.php';

$db = Database::getInstance();
$serviceObj = new InquiryChecklistService();

// Let's just get the first existing inquiry
$stmt = $db->query("SELECT i.id, i.service_id, s.title FROM customer_inquiries i JOIN services s ON i.service_id = s.id LIMIT 1");
$inquiry = $stmt->fetch(PDO::FETCH_ASSOC);

if ($inquiry) {
    $inquiryId = $inquiry['id'];
    $serviceId = $inquiry['service_id'];
    $originalTitle = $inquiry['title'];
    
    // Temporarily rename the service so it doesn't match the overlay templates
    $db->exec("UPDATE services SET title = 'Generic Maintenance Service' WHERE id = $serviceId");
    
    // Generate PDFs (this will hit the fallback HTML path now)
    $pdf_before = $serviceObj->getChecklistPdfPublic($inquiryId, 'before');
    file_put_contents('C:\Users\bitress\.gemini\antigravity-ide\brain\2069f0db-b474-4dd5-aa3e-c55d688a812f\generic_preview_before.pdf', $pdf_before);
    
    $pdf_after = $serviceObj->getChecklistPdfPublic($inquiryId, 'after');
    file_put_contents('C:\Users\bitress\.gemini\antigravity-ide\brain\2069f0db-b474-4dd5-aa3e-c55d688a812f\generic_preview_after.pdf', $pdf_after);
    
    // Restore original title
    $stmtRestore = $db->prepare("UPDATE services SET title = ? WHERE id = ?");
    $stmtRestore->execute([$originalTitle, $serviceId]);
    
    echo "Generic PDF fallback generated successfully.";
} else {
    echo "No inquiries found.";
}
