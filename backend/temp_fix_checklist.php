<?php
require 'index.php';

$db = Database::getInstance();

echo "Fixing checklist id=4...\n";

$db->beginTransaction();
try {
    $db->exec("UPDATE inquiry_checklists SET service_id = 1 WHERE id = 4");

    $stmtItems = $db->prepare(
        "SELECT id FROM service_checklist_items WHERE service_id = 1 AND phase = 'after' AND is_active = 1 ORDER BY sort_order"
    );
    $stmtItems->execute();
    $items = $stmtItems->fetchAll(PDO::FETCH_ASSOC);
    echo "Found " . count($items) . " headlight after items\n";

    $db->exec("DELETE FROM inquiry_checklist_responses WHERE checklist_id = 4");

    $stmtInsert = $db->prepare(
        "INSERT INTO inquiry_checklist_responses (checklist_id, item_id, is_checked, notes) VALUES (4, :item_id, 1, NULL)"
    );
    foreach ($items as $item) {
        $stmtInsert->execute([':item_id' => $item['id']]);
    }

    $db->commit();
    echo "Done! Replaced with " . count($items) . " headlight after items (all pre-checked).\n";
} catch (Exception $e) {
    $db->rollBack();
    echo "Error: " . $e->getMessage() . "\n";
}
