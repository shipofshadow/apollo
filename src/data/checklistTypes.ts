export interface ChecklistItemDef {
  id: string;
  label: string;
  hasNotes?: boolean;
}

export interface ChecklistTypeDef {
  key: string; // e.g. 'android-headunit-before'
  serviceSlug: 'android-headunit' | 'projector-headlight';
  phaseSlug: 'before' | 'after';
  serviceName: string; // e.g. 'Android Head Unit Installation'
  phaseLabel: string; // 'Before' or 'After'
  title: string;
  serviceFieldLabel: string; // 'Head Unit Model' or 'Headlight Setup'
  serviceFieldPlaceholder: string;
  items: ChecklistItemDef[];
  orientationItems?: string[];
  aftercareGuidelines?: string[];
  confirmationText: string;
}

export const CHECKLIST_TYPES: Record<string, ChecklistTypeDef> = {
  'android-headunit-before': {
    key: 'android-headunit-before',
    serviceSlug: 'android-headunit',
    phaseSlug: 'before',
    serviceName: 'Android Head Unit Installation',
    phaseLabel: 'Before',
    title: 'Android Head Unit Installation — Before Installation Checklist',
    serviceFieldLabel: 'Head Unit Model',
    serviceFieldPlaceholder: 'e.g. 9-inch Android 12 Head Unit',
    items: [
      { id: 'item_1', label: 'Factory Radio / Head Unit Functioning', hasNotes: true },
      { id: 'item_2', label: 'Steering Wheel Controls Functioning (if equipped)', hasNotes: true },
      { id: 'item_3', label: 'Reverse Camera Functioning (if equipped)', hasNotes: true },
      { id: 'item_4', label: 'Factory USB Port Functioning (if equipped)', hasNotes: true },
      { id: 'item_5', label: 'Dashboard Warning Lights Checked', hasNotes: true },
      { id: 'item_6', label: 'Front & Rear Speakers Functioning', hasNotes: true },
      { id: 'item_7', label: 'No Scratches on Dashboard / Trim Panels', hasNotes: true },
      { id: 'item_8', label: 'All Dashboard Clips & Screws Complete', hasNotes: true },
      { id: 'item_9', label: 'Wirings are in Good Setup/Condition', hasNotes: true },
    ],
    confirmationText:
      'I confirm that the above items were checked and the existing condition of the vehicle was documented before installation.',
  },
  'android-headunit-after': {
    key: 'android-headunit-after',
    serviceSlug: 'android-headunit',
    phaseSlug: 'after',
    serviceName: 'Android Head Unit Installation',
    phaseLabel: 'After',
    title: 'Android Head Unit Installation — After Installation Checklist',
    serviceFieldLabel: 'Head Unit Model',
    serviceFieldPlaceholder: 'e.g. 9-inch Android 12 Head Unit',
    items: [
      { id: 'item_1', label: 'Android Head Unit Powers ON Properly', hasNotes: true },
      { id: 'item_2', label: 'Touchscreen Responds Correctly', hasNotes: true },
      { id: 'item_3', label: 'FM/AM Radio Working', hasNotes: true },
      { id: 'item_4', label: 'Wi-Fi Connection Working', hasNotes: true },
      { id: 'item_5', label: 'Apple CarPlay/Android Auto Working', hasNotes: true },
      { id: 'item_6', label: 'GPS Navigation Working', hasNotes: true },
      { id: 'item_7', label: 'USB Ports Working', hasNotes: true },
      { id: 'item_8', label: 'Steering Wheel Controls Working (if equipped)', hasNotes: true },
      { id: 'item_9', label: 'All Camera (Front, Rear, Left and Right) are Working Properly', hasNotes: true },
      { id: 'item_10', label: 'All Speakers Producing Sound', hasNotes: true },
      { id: 'item_11', label: 'Equalizer / Audio Settings Verified', hasNotes: true },
      { id: 'item_12', label: 'No Dashboard Warning Lights', hasNotes: true },
      { id: 'item_13', label: 'No Loose Trim or Rattling', hasNotes: true },
      { id: 'item_14', label: 'No Exposed Wiring', hasNotes: true },
      { id: 'item_15', label: 'Vehicle Starts Normally', hasNotes: true },
      { id: 'item_16', label: 'Interior is Clean After Installation', hasNotes: true },
    ],
    orientationItems: [
      'Basic operation demonstrated',
      "Customer's phone connected",
      'Apple CarPlay/Android Auto connected',
      'All cameras demonstrated',
      'Warranty explained',
      'Questions answered',
    ],
    aftercareGuidelines: [
      'Do not force-remove the head unit or trim panels.',
      'Avoid installing additional accessories without consulting the installer.',
      'Report software or hardware issues promptly.',
      'Do not modify installed wiring without consulting 1625 Autolab.',
      'Contact 1625 Autolab before attempting resets or wiring modifications.',
    ],
    confirmationText:
      'I have inspected the completed installation and confirm that the functions and condition of the vehicle were checked and explained to me.',
  },
  'projector-headlight-before': {
    key: 'projector-headlight-before',
    serviceSlug: 'projector-headlight',
    phaseSlug: 'before',
    serviceName: 'Projector Headlight Retrofit',
    phaseLabel: 'Before',
    title: 'Projector Headlight Retrofit — Before Installation Checklist',
    serviceFieldLabel: 'Headlight Setup',
    serviceFieldPlaceholder: 'e.g. Bi-LED Projector 3.0" + Shroud',
    items: [
      { id: 'item_1', label: 'Low Beam Functionality', hasNotes: true },
      { id: 'item_2', label: 'High Beam Functionality', hasNotes: true },
      { id: 'item_3', label: 'Left Turn Signal', hasNotes: true },
      { id: 'item_4', label: 'Right Turn Signal', hasNotes: true },
      { id: 'item_5', label: 'Parking Lights', hasNotes: true },
      { id: 'item_6', label: 'DRL (if equipped)', hasNotes: true },
      { id: 'item_7', label: 'Foglights (if equipped)', hasNotes: true },
      { id: 'item_8', label: 'Hazard Lights', hasNotes: true },
      { id: 'item_9', label: 'No Dashboard Error', hasNotes: true },
      { id: 'item_10', label: 'No Scratches on Headlight, Bumper, or Nearby Side Panel', hasNotes: true },
      { id: 'item_11', label: 'Headlight Fitment/Condition', hasNotes: true },
      { id: 'item_12', label: 'Complete Screws & Clips', hasNotes: true },
      { id: 'item_13', label: 'Wirings are in Good Setup/Condition', hasNotes: true },
    ],
    confirmationText:
      'I confirm that the above items were checked and the existing condition of the vehicle was documented before installation.',
  },
  'projector-headlight-after': {
    key: 'projector-headlight-after',
    serviceSlug: 'projector-headlight',
    phaseSlug: 'after',
    serviceName: 'Projector Headlight Retrofit',
    phaseLabel: 'After',
    title: 'Projector Headlight Retrofit — After Installation Checklist',
    serviceFieldLabel: 'Headlight Setup',
    serviceFieldPlaceholder: 'e.g. Bi-LED Projector 3.0" + Shroud',
    items: [
      { id: 'item_1', label: 'Low Beam Functioning', hasNotes: true },
      { id: 'item_2', label: 'High Beam Functioning', hasNotes: true },
      { id: 'item_3', label: 'Left Turn Signal Functioning', hasNotes: true },
      { id: 'item_4', label: 'Right Turn Signal Functioning', hasNotes: true },
      { id: 'item_5', label: 'Parking Lights Functioning', hasNotes: true },
      { id: 'item_6', label: 'DRL Functioning (if equipped)', hasNotes: true },
      { id: 'item_7', label: 'Foglights Functioning (if equipped)', hasNotes: true },
      { id: 'item_8', label: 'Hazard Lights Functioning', hasNotes: true },
      { id: 'item_9', label: 'No Dashboard Error', hasNotes: true },
      { id: 'item_10', label: 'Projector Alignment Verified', hasNotes: true },
      { id: 'item_11', label: 'Headlight Fitment & Gaps Verified', hasNotes: true },
      { id: 'item_12', label: 'Bumper & Headlight Properly Reinstalled', hasNotes: true },
      { id: 'item_13', label: 'All Screws & Clips Complete', hasNotes: true },
      { id: 'item_14', label: 'Wiring Properly Secured', hasNotes: true },
      { id: 'item_15', label: 'No Exposed or Loose Wiring', hasNotes: true },
      { id: 'item_16', label: 'Headlight & Bumper Free From New Scratches', hasNotes: true },
    ],
    orientationItems: [
      'Headlight functions demonstrated',
      'High/low beam operation explained',
      'Customer inspected completed installation',
      'Warranty coverage explained',
      'Customer questions answered',
    ],
    aftercareGuidelines: [
      'Avoid opening, removing, or modifying the headlight assembly.',
      'Avoid pressure-washing directly around the headlight seals.',
      'Check for unusual moisture, condensation, flickering, or lighting issues.',
      'Report installation-related concerns to 1625 Autolab within 7 days.',
      'Do not modify installed wiring without consulting the installer.',
      'Contact 1625 Autolab before attempting repairs or modifications.',
    ],
    confirmationText:
      'I have inspected the completed installation and confirm that the functions and condition of the vehicle were checked and explained to me.',
  },
};

export function getChecklistTypeDef(serviceSlug: string, phaseSlug: string): ChecklistTypeDef | null {
  const key = `${serviceSlug}-${phaseSlug}`;
  return CHECKLIST_TYPES[key] ?? null;
}
