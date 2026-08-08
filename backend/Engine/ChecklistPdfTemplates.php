<?php

declare(strict_types=1);

/**
 * Coordinate registry for the flat (non-fillable) 1625 Autolab checklist PDFs.
 *
 * IMPORTANT CONTEXT:
 * Both source PDFs (Headlight Retrofit, Android Head Unit) are single flattened
 * images with no real text/form layer (confirmed: 0 extractable chars, 1 image
 * per page). So there is nothing to "fill" via AcroForm fields - the only way to
 * put data on them is to overlay text/marks at fixed pixel coordinates on top of
 * the original page, which is what this file describes.
 *
 * All coordinates below were measured directly from the source PDFs by rendering
 * them at 150 DPI and detecting the underline positions (header fields) and
 * checkbox squares (body items) with OpenCV contour detection, then verified
 * visually. They are stored here in "px" at 150 DPI; toMM() converts to mm for
 * FPDI/TCPDF (which draws in mm on an A4 page: 210 x 297mm).
 *
 * Both templates are A4 portrait: 595.28 x 841.89 pt == 210 x 297mm.
 */
final class ChecklistPdfTemplates
{
    public const DPI = 150;

    /** Convert a pixel measurement (at self::DPI) to millimeters. */
    public static function toMM(float $px): float
    {
        return $px * (25.4 / self::DPI);
    }

    /**
     * Returns the template config array for a given service title, or null if
     * no overlay template exists for it (caller should fall back to the
     * generic mPDF HTML renderer in that case).
     */
    public static function forServiceTitle(string $serviceTitle): ?array
    {
        $t = strtolower($serviceTitle);

        if (str_contains($t, 'headlight')) {
            return self::headlightRetrofit();
        }

        if (str_contains($t, 'android') || str_contains($t, 'head unit')) {
            return self::androidHeadUnit();
        }

        return null;
    }

    /**
     * @return array<string, mixed>
     */
    public static function headlightRetrofit(): array
    {
        return [
            'key' => 'headlight_retrofit',

            // Path to the blank source PDF on disk. Adjust to your actual storage path.
            'template_path' => __DIR__ . '/../templates/checklist/1625_Autolab_Headlight_Retrofit_Checklist.pdf',

            // Label shown in the "vehicle/service field" line (row 3, left column).
            // For this template that's "Headlight Setup:".
            'service_field_label' => 'headlightSetup',

            // Header text fields. x/y are the TEXT BASELINE position in px (150dpi),
            // i.e. where drawing should start, just above the printed underline.
            'header_fields' => [
                'customer_name'   => ['x' => 282, 'y' => 234],
                'date'            => ['x' => 756, 'y' => 234],
                'vehicle'         => ['x' => 203, 'y' => 279],
                'plate_number'    => ['x' => 839, 'y' => 279],
                'service_field'   => ['x' => 282, 'y' => 325], // Headlight Setup
                'installer_name'  => ['x' => 839, 'y' => 325],
            ],

            // BEFORE INSTALLATION table. One row per service_checklist_items row
            // (phase=before) in sort_order. Checkbox box size + notes column start x.
            'before' => [
                'checkbox_size' => 21,
                'checkbox_x'    => 588, // left edge of checkbox square
                'notes_x'       => 694,
                // y = TOP edge of each checkbox square, in row order
                'rows_y' => [464, 511, 556, 602, 647, 693, 739, 784, 830, 876, 921],
                // Reference labels in PDF order (for sanity-checking DB item order;
                // not required to match exactly, but count + order should).
                'labels' => [
                    'Low Beam', 'High Beam', 'Parklight', 'No Dashboard Error',
                    'Left Turn Signal', 'Right Turn Signal', 'Foglights (if equipped)',
                    'DRL (if equipped)', 'Hazzard Lights',
                    'No Bumper and Headlight scratches', 'Complete Screws',
                ],
            ],

            // AFTER INSTALLATION table, grouped into named sections/columns.
            // Section key MUST match the `section` column value stored on
            // service_checklist_items for phase=after.
            'after_sections' => [
                'FUNCTION CHECK' => [
                    'checkbox_size' => 16,
                    'checkbox_x'    => 104,
                    'rows_y' => [1089, 1112, 1135, 1157, 1180, 1203, 1226, 1248],
                    'labels' => [
                        'Low Beam is working properly.', 'High Beam is working properly.',
                        'Left Turn Signal is working.', 'Right Turn Signal is working.',
                        'Parklight is working.', 'Foglights (if equipped) are working.',
                        'DRL (if equipped) is working.', 'Hazzard Lights are working.',
                    ],
                ],
                'VEHICLE CHECK' => [
                    'checkbox_size' => 16,
                    'checkbox_x'    => 104,
                    'rows_y' => [1310, 1330, 1350, 1387],
                    'labels' => [
                        'No dashboard warning lights.', 'Headlights are securely installed.',
                        'Front bumper and panels are properly reinstalled.',
                        'Vehicle is free from any installation-related damage.',
                    ],
                ],
                'ALIGNMENT & CONDITION' => [
                    'checkbox_size' => 18,
                    'checkbox_x'    => 478,
                    'rows_y' => [1090, 1154, 1244, 1311],
                    'labels' => [
                        'Headlights are properly aimed and even.',
                        'No visible moisture or condensation inside the headlights.',
                        'Lenses are clean and free from scratches.',
                        'No loose wiring or exposed connectors.',
                    ],
                ],
                'EXPLANATION & DOCUMENTS' => [
                    'checkbox_size' => 18,
                    'checkbox_x'    => 827,
                    'rows_y' => [1092, 1161, 1214, 1269],
                    'labels' => [
                        'Retrofit operation and features explained.',
                        'Care instructions explained.',
                        'Warranty document provided.',
                        'Questions answered.',
                    ],
                ],
            ],

            // "I have inspected my vehicle..." checkbox.
            'acknowledgement' => [
                'checkbox_size' => 18,
                'checkbox_x'    => 108,
                'checkbox_y'    => 1618,
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public static function androidHeadUnit(): array
    {
        return [
            'key' => 'android_head_unit',

            'template_path' => __DIR__ . '/../templates/checklist/1625_Autolab_Android_Head_Unit_Installation_Checklist_v2(1).pdf',

            'service_field_label' => 'headUnitModel',

            'header_fields' => [
                'customer_name'   => ['x' => 275, 'y' => 230],
                'date'            => ['x' => 746, 'y' => 230],
                'vehicle'         => ['x' => 193, 'y' => 276],
                'plate_number'    => ['x' => 828, 'y' => 276],
                'service_field'   => ['x' => 275, 'y' => 325], // Head Unit Model
                'installer_name'  => ['x' => 828, 'y' => 325],
            ],

            'before' => [
                'checkbox_size' => 20,
                'checkbox_x'    => 588,
                'notes_x'       => 694,
                'rows_y' => [479, 528, 578, 628, 678, 728, 778, 828, 878],
                'labels' => [
                    'Radio is functioning', 'Steering Wheel Controls (if equipped)',
                    'Reverse Camera (if equipped)', 'Factory USB Port (if equipped)',
                    'Dashboard Warning Lights', 'Speakers (Front & Rear)',
                    'Wirings are in good setup/condition',
                    'No scratches on dashboard/trim panels',
                    'All dashboard clips & screws complete',
                ],
            ],

            'after_sections' => [
                'FUNCTION CHECK' => [
                    'checkbox_size' => 18,
                    'checkbox_x'    => 98,
                    'rows_y' => [1057, 1087, 1116, 1145, 1174, 1204, 1232, 1261, 1289, 1340, 1369],
                    'labels' => [
                        'Android Head Unit powers ON properly', 'Touchscreen responds correctly',
                        'FM/AM Radio working', 'Wi-Fi connection working',
                        'Apple CarPlay/Android Auto working', 'GPS Navigation working',
                        'USB ports working', 'Steering Wheel Controls working (if equipped)',
                        'All Camera (Front, Rear, Left and Right) are working properly',
                        'All speakers producing sound', 'Equalizer / Audio settings verified',
                    ],
                ],
                'VEHICLE CHECK' => [
                    'checkbox_size' => 18,
                    'checkbox_x'    => 491,
                    'rows_y' => [1058, 1106, 1157, 1208, 1260, 1311],
                    'labels' => [
                        'Dashboard panels properly reinstalled', 'No dashboard warning lights',
                        'No loose trim or rattling', 'No exposed wiring',
                        'Vehicle starts normally', 'Interior is clean after installation',
                    ],
                ],
                'CUSTOMER ORIENTATION' => [
                    'checkbox_size' => 18,
                    'checkbox_x'    => 827,
                    'rows_y' => [1058, 1106, 1175, 1247, 1295, 1344],
                    'labels' => [
                        'Demonstrated basic operation', "Connected customer's Bluetooth phone",
                        'Apple CarPlay/Android Auto connected', 'Demonstrated all cameras',
                        'Warranty explained', 'Questions answered',
                    ],
                ],
            ],

            'acknowledgement' => [
                'checkbox_size' => 20,
                'checkbox_x'    => 101,
                'checkbox_y'    => 1615,
            ],
        ];
    }
}
