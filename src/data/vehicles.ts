/**
 * Vehicle make/model data focused on the Philippine market.
 * Year range: current year down to 1990.
 */

export const VEHICLE_MAKES = [
  'Toyota', 'Honda', 'Mitsubishi', 'Nissan', 'Ford', 'Suzuki',
  'Hyundai', 'Kia', 'Isuzu', 'Mazda', 'Subaru', 'BMW',
  'Mercedes-Benz', 'Lexus', 'Chevrolet', 'Volkswagen', 'Other',
] as const;

export type VehicleMake = (typeof VEHICLE_MAKES)[number];

export const VEHICLE_MODELS: Record<VehicleMake, string[]> = {
  Toyota: [
    'Vios', 'Corolla', 'Corolla Altis', 'Camry', 'Avalon',
    'Yaris', 'Wigo', 'Agya',
    'RAV4', 'Land Cruiser', 'Land Cruiser Prado', 'FJ Cruiser',
    'Fortuner', 'Rush', 'Innova', 'Avanza',
    'Hilux', 'Tacoma', 'Tundra',
    'Prius', 'C-HR', 'Supra', 'GR86',
  ],
  Honda: [
    'City', 'City Hatchback', 'Civic', 'Accord', 'Insight',
    'Jazz / Fit', 'Brio', 'BR-V', 'HR-V', 'CR-V', 'Pilot', 'Passport',
    'Mobilio', 'Odyssey',
    'Ridgeline',
    'NSX', 'S2000',
  ],
  Mitsubishi: [
    'Mirage', 'Mirage G4', 'Lancer', 'Lancer EX', 'Galant',
    'Xpander', 'Xpander Cross',
    'Montero', 'Montero Sport',
    'Outlander', 'Eclipse Cross', 'ASX',
    'L200 Strada', 'L300',
    'Pajero',
  ],
  Nissan: [
    'Almera', 'Sentra', 'Sylphy', 'Versa',
    'Juke', 'Kicks', 'Qashqai', 'Murano',
    'X-Trail', 'Terra', 'Patrol', 'Armada',
    'Navara', 'Frontier',
    'GT-R', '370Z',
  ],
  Ford: [
    'Fiesta', 'Focus', 'Fusion', 'Mustang',
    'EcoSport', 'Escape', 'Edge', 'Explorer', 'Expedition',
    'Territory',
    'Ranger', 'F-150', 'F-250',
    'Raptor',
  ],
  Suzuki: [
    'Alto', 'Celerio', 'Swift', 'Baleno', 'Ciaz', 'Dzire',
    'Vitara', 'S-Cross', 'Jimny',
    'Ertiga', 'XL6',
    'Carry',
  ],
  Hyundai: [
    'i10 / Grand i10', 'Accent', 'Reina', 'Elantra', 'Sonata', 'Azera',
    'Kona', 'Tucson', 'Santa Fe', 'Palisade',
    'Starex / H-1',
    'Veloster',
  ],
  Kia: [
    'Picanto', 'Rio', 'Soluto',
    'Stonic', 'Seltos', 'Sportage', 'Sorento', 'Telluride',
    'Carnival / Sedona',
    'Stinger', 'K5 Optima',
  ],
  Isuzu: [
    'Elf', 'Crosswind', 'Sportivo',
    'mu-X',
    'D-Max',
  ],
  Mazda: [
    'Mazda2', 'Mazda3', 'Mazda6',
    'CX-3', 'CX-30', 'CX-5', 'CX-8', 'CX-9',
    'MX-5 Miata',
  ],
  Subaru: [
    'Impreza', 'WRX', 'WRX STI',
    'Legacy', 'Outback',
    'Forester', 'XV / Crosstrek', 'Ascent',
    'BRZ',
  ],
  BMW: [
    '1 Series', '2 Series', '3 Series', '4 Series', '5 Series', '7 Series', '8 Series',
    'M2', 'M3', 'M4', 'M5',
    'X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7',
    'Z4', 'i3', 'i4', 'i8',
  ],
  'Mercedes-Benz': [
    'A-Class', 'B-Class', 'C-Class', 'E-Class', 'S-Class', 'CLA', 'CLS',
    'AMG GT', 'AMG C63', 'AMG E63',
    'GLA', 'GLB', 'GLC', 'GLE', 'GLS', 'G-Class',
    'V-Class / Vito',
  ],
  Lexus: [
    'IS', 'ES', 'GS', 'LS',
    'NX', 'RX', 'GX', 'LX',
    'RC', 'LC',
  ],
  Chevrolet: [
    'Spark', 'Sonic', 'Cruze', 'Malibu', 'Impala',
    'Trax', 'Equinox', 'Traverse', 'Tahoe', 'Suburban',
    'Colorado', 'Silverado',
    'Camaro', 'Corvette',
  ],
  Volkswagen: [
    'Polo', 'Golf', 'Jetta', 'Passat', 'Arteon',
    'T-Cross', 'T-Roc', 'Tiguan', 'Touareg', 'Atlas',
    'Transporter', 'Caravelle',
  ],
  Other: ['Other / Not Listed'],
};

const CURRENT_YEAR = new Date().getFullYear();
export const VEHICLE_YEARS: string[] = Array.from(
  { length: CURRENT_YEAR - 1989 },
  (_, i) => String(CURRENT_YEAR - i)
);
