<?php

declare(strict_types=1);

/**
 * Coordinate registry for the 1625 Autolab checklist PDF templates.
 *
 * IMPORTANT: All coordinate fields here are in MILLIMETRES (mm) because TCPDF/FPDI
 * natively works in mm when the page unit is 'mm'. Previous versions stored px @150dpi
 * which caused systematic offsets. All values in this file were measured directly
 * from the template PDFs using a 5mm grid overlay probe, verified visually.
 *
 * A4 page = 210 × 297mm.
 *
 * Coordinate system: (0,0) = top-left corner of the page.
 * x increases to the right, y increases downward.
 */
final class ChecklistPdfTemplates
{
    /**
     * Returns the template config array for a given service slug and phase.
     * Coordinates are in MILLIMETRES, ready for TCPDF/FPDI Cell/Text calls.
     */
    public static function forServiceAndPhase(string $serviceSlug, string $phase): ?array
    {
        $s = strtolower($serviceSlug);
        $p = strtolower($phase);

        if (str_contains($s, 'headlight') || str_contains($s, 'projector')) {
            return $p === 'after' ? self::headlightAfter() : self::headlightBefore();
        }

        if (str_contains($s, 'android') || str_contains($s, 'headunit') || str_contains($s, 'head unit')) {
            return $p === 'after' ? self::androidAfter() : self::androidBefore();
        }

        return null;
    }

    // ─── Android Head Unit — BEFORE ──────────────────────────────────────────

    public static function androidBefore(): array
    {
        return [
            'key'          => 'android_head_unit_before',
            'template_path' => __DIR__ . '/../templates/checklist/1625_Autolab_Android_Headunit_Before_Installation_Checklist.pdf',
            'service_field_label' => 'headUnitModel',
            'phase'        => 'before',

            // Header text fields – (x, y) = top-left where TCPDF Cell starts.
            // y should sit just above the underline printed in the template.
            // Measured using 5mm grid overlay probe (probe2_android_before.pdf).
            'header_fields' => [
                // Row 1: Customer Name | Date  (underline at y≈43mm, text at y=40.5mm)
                'customer_name'  => ['x' => 50.0, 'y' => 41.5, 'w' => 88.0],
                'date'           => ['x' => 145.0, 'y' => 41.5, 'w' => 26.0],
                // Row 2: Vehicle | Plate Number  (underline at y≈49mm, text at y=47mm)
                'vehicle'        => ['x' => 50.0, 'y' => 51.5, 'w' => 95.0],
                'plate_number'   => ['x' => 145.0, 'y' => 51.5, 'w' => 45.0],
                // Row 3: Head Unit Model | Installer Name  (underline at y≈57mm, text at y=56.5mm)
                'service_field'  => ['x' => 50.0, 'y' => 60.5, 'w' => 90.0],
                'installer_name' => ['x' => 145.0, 'y' => 60.5, 'w' => 45.0],
            ],

            // Checklist item rows (BEFORE table).
            // checkbox_x = left edge of the checkbox square (mm).
            // checkbox_size = square side length (mm).
            // rows_y = top edge of each checkbox square, in row order (mm).
            // notes_x = x position for optional row note text (mm).
            'checklist' => [
                'checkbox_x'    => 130,
                'checkbox_size' => 4.5,
                'notes_x'       => 145.0,
                'rows_y' => [
                    91.3,   // #1  Factory Radio / Head Unit Functioning
                    100.6,   // #2  Steering Wheel Controls (if equipped)
                    110.3,   // #3  Reverse Camera (if equipped)
                    119.6,  // #4  Factory USB Port (if equipped)
                    128.2,  // #5  Dashboard Warning Lights
                    137.5,  // #6  Front & Rear Speakers
                    147.1,   // #7  Wirings are in Good Setup/Condition
                    155.4,   // #8  No Scratches on Dashboard/Trim Panels
                    164.4,  // #9  All Dashboard Clips & Screws Complete
                ],
            ],

            'additional_notes' => [
                'x' => 15,
                'y' => 188
            ],

            // Customer signature and date placement.
            'signature' => [
                'x' => 13.0,
                'y' => 227.0,
                'w' => 128.0,
                'h' => 14.0,
            ],
            'sig_date' => [
                'x' => 135.0,
                'y' => 230.0,
                'w' => 45.0,
                'h' => 14.0,
            ],
        ];
    }

    // ─── Android Head Unit — AFTER ───────────────────────────────────────────

    public static function androidAfter(): array
    {
        return [
            'key'          => 'android_head_unit_after',
            'template_path' => __DIR__ . '/../templates/checklist/1625_Autolab_Android_Headunit_After_Installation_Checklist.pdf',
            'service_field_label' => 'headUnitModel',
            'phase'        => 'after',

             'header_fields' => [
                // Row 1: Customer Name | Date  (underline at y≈43mm, text at y=40.5mm)
                'customer_name'  => ['x' => 50.0, 'y' => 34.5, 'w' => 88.0],
                'date'           => ['x' => 145.0, 'y' => 34.5, 'w' => 26.0],
                // Row 2: Vehicle | Plate Number  (underline at y≈49mm, text at y=47mm)
                'vehicle'        => ['x' => 50.0, 'y' => 43.5, 'w' => 95.0],
                'plate_number'   => ['x' => 145.0, 'y' => 43.5, 'w' => 45.0],
                // Row 3: Head Unit Model | Installer Name  (underline at y≈57mm, text at y=56.5mm)
                'service_field'  => ['x' => 50.0, 'y' => 50.5, 'w' => 90.0],
                'installer_name' => ['x' => 145.0, 'y' => 50.5, 'w' => 45.0],
            ],

            // After checklist: 16 function/vehicle check items in a combined table.
            // Items appear in a single list in the CHECK column (x≈119mm).
            'checklist' => [
                'checkbox_x'    => 129.5,
                'checkbox_size' => 4.5,
                'notes_x'       => 142.0,
                'rows_y' => [
                    75.3,   // #1  Android Head Unit Powers ON Properly
                    82.4,   // #2  Touchscreen Responds Correctly
                    90.2,   // #3  FM/AM Radio Working
                    96.3,   // #4  Wi-Fi Connection Working
                    103.2,  // #5  Apple CarPlay/Android Auto Working
                    109.5,  // #6  GPS Navigation Working
                    116.6,  // #7  USB Ports Working
                    123.7,  // #8  Steering Wheel Controls (if equipped)
                    130.8,  // #9  All Cameras Working Properly
                    136.3,  // #10 All Speakers Producing Sound
                    143.0,  // #11 Equalizer / Audio Settings Verified
                    149.0,  // #12 No Dashboard Warning Lights
                    157.2,  // #13 No Loose Trim or Rattling
                    163.3,  // #14 No Exposed Wiring
                    170.4,  // #15 Vehicle Starts Normally
                    177.5,  // #16 Interior is Clean After Installation
                ],
            ],

            // Customer orientation checkboxes (left section, below table).
            // Orientation section header appears at y≈191mm.
            'orientation' => [
                'checkbox_x'    => 18.0,
                'checkbox_size' => 4.0,
                'rows_y' => [
                    193.5,  // O#1 Basic operation demonstrated
                    200.5,  // O#2 Customer's phone connected
                    205.5,  // O#3 Apple CarPlay/Android Auto connected
                    214.5,  // O#4 All cameras demonstrated
                    220.5,  // O#5 Warranty explained
                    226.5,  // O#6 Questions answered
                ],
            ],

            'signature' => [
                'x' => 13.0,
                'y' => 253.0,
                'w' => 128.0,
                'h' => 13.0,
            ],
            'sig_date' => [
                'x' => 130.0,
                'y' => 253.0,
                'w' => 45.0,
                'h' => 13.0,
            ],
        ];
    }

    // ─── Projector Headlight — BEFORE ────────────────────────────────────────

    public static function headlightBefore(): array
    {
        return [
            'key'          => 'projector_headlight_before',
            'template_path' => __DIR__ . '/../templates/checklist/1625_Autolab_Projector_Headlight_Before_Installation_Checklist_With_Logo.pdf',
            'service_field_label' => 'headlightSetup',
            'phase'        => 'before',

            'header_fields' => [
                // Row 1: Customer Name | Date  (underline at y≈43mm, text at y=40.5mm)
                'customer_name'  => ['x' => 50.0, 'y' => 41.5, 'w' => 88.0],
                'date'           => ['x' => 145.0, 'y' => 41.5, 'w' => 26.0],
                // Row 2: Vehicle | Plate Number  (underline at y≈49mm, text at y=47mm)
                'vehicle'        => ['x' => 50.0, 'y' => 51.5, 'w' => 95.0],
                'plate_number'   => ['x' => 145.0, 'y' => 51.5, 'w' => 45.0],
                // Row 3: Head Unit Model | Installer Name  (underline at y≈57mm, text at y=56.5mm)
                'service_field'  => ['x' => 50.0, 'y' => 60.5, 'w' => 90.0],
                'installer_name' => ['x' => 145.0, 'y' => 60.5, 'w' => 45.0],
            ],
            'checklist' => [
                'checkbox_x'    => 130.5,
                'checkbox_size' => 4.5,
                'notes_x'       => 147.0,
                'rows_y' => [
                    91.3,   // #1  Low Beam Functionality
                    99.6,   // #2  High Beam Functionality
                    107.9,   // #3  Left Turn Signal
                    116.2,  // #4  Right Turn Signal
                    124.5,  // #5  Parking Lights
                    132.8,  // #6  DRL (if equipped)
                    141.1,  // #7  Foglights (if equipped)
                    149.4,  // #8  Hazard Lights
                    157.7,  // #9  No Dashboard Error
                    166.0,  // #10 No Scratches on Headlight/Bumper/Panel
                    174.3,  // #11 Headlight Fitment/Condition
                    182.6,  // #12 Complete Screws & Clips
                    190.9,  // #13 Wirings are in Good Setup/Condition
                ],
            ],

             'additional_notes' => [
                'x' => 15,
                'y' => 215
            ],


            'signature' => [
                'x' => 13.0,
                'y' => 255.0,
                'w' => 128.0,
                'h' => 14.0,
            ],
            'sig_date' => [
                'x' => 130.0,
                'y' => 255.0,
                'w' => 45.0,
                'h' => 14.0,
            ],
        ];
    }

    // ─── Projector Headlight — AFTER ─────────────────────────────────────────

    public static function headlightAfter(): array
    {
        return [
            'key'          => 'projector_headlight_after',
            'template_path' => __DIR__ . '/../templates/checklist/1625_Autolab_Projector_Headlight_After_Installation_Checklist.pdf',
            'service_field_label' => 'headlightSetup',
            'phase'        => 'after',

            'header_fields' => [
                // Row 1: Customer Name | Date  (underline at y≈43mm, text at y=40.5mm)
                'customer_name'  => ['x' => 50.0, 'y' => 34.5, 'w' => 88.0],
                'date'           => ['x' => 145.0, 'y' => 34.5, 'w' => 26.0],
                // Row 2: Vehicle | Plate Number  (underline at y≈49mm, text at y=47mm)
                'vehicle'        => ['x' => 50.0, 'y' => 43.5, 'w' => 95.0],
                'plate_number'   => ['x' => 145.0, 'y' => 43.5, 'w' => 45.0],
                // Row 3: Head Unit Model | Installer Name  (underline at y≈57mm, text at y=56.5mm)
                'service_field'  => ['x' => 50.0, 'y' => 50.5, 'w' => 90.0],
                'installer_name' => ['x' => 145.0, 'y' => 50.5, 'w' => 45.0],
            ],


            'checklist' => [  
                'checkbox_x'    => 129.5,
                'checkbox_size' => 4.5,
                'notes_x'       => 142.0,
                'rows_y' => [
                    75.3,   // #1  Low Beam Functioning
                    82.4,   // #2  High Beam Functioning
                    90.2,   // #3  Left Turn Signal Functioning
                    96.3,   // #4  Right Turn Signal Functioning
                    103.2,  // #5  Parking Lights Functioning
                    109.5,  // #6  DRL Functioning (if equipped)
                    116.6,  // #7  Foglights Functioning (if equipped)
                    123.7,  // #8  Hazard Lights Functioning
                    130.8,  // #9  No Dashboard Error
                    136.3,  // #10 Projector Alignment Verified
                    143.0,  // #11 Headlight Fitment & Gaps Verified
                    149.0,  // #12 Bumper & Headlight Properly Reinstalled
                    157.2,  // #13 All Screws & Clips Complete
                    163.3,  // #14 Wiring Properly Secured
                    170.4,  // #15 No Exposed or Loose Wiring
                    177.5,  // #16 Headlight & Bumper Free From New Scratches
                ],
            ],

            'orientation' => [
                'checkbox_x'    => 18.0,
                'checkbox_size' => 4.0,
                'rows_y' => [
                    194.5,  // O#1 Headlight functions demonstrated
                    203,  // O#2 High/low beam operation explained
                    209.5,  // O#3 Customer inspected completed installation
                    216.5,  // O#4 Warranty coverage explained
                    224.5,  // O#5 Customer questions answered
                ],
            ],

            'signature' => [
                'x' => 13.0,
                'y' => 255.0,
                'w' => 128.0,
                'h' => 13.0,
            ],
            'sig_date' => [
                'x' => 130.0,
                'y' => 255.0,
                'w' => 45.0,
                'h' => 13.0,
            ],
        ];
    }
}
