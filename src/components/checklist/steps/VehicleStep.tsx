import { Car, Hash, Calendar, Shield } from 'lucide-react';
import type { ChecklistWizardState } from '../types';

interface Props {
  state: ChecklistWizardState;
  onChange: (vehicle: { make: string; model: string; year: string; plateNumber: string }) => void;
}

const COMMON_MAKES = [
  'Toyota',
  'Honda',
  'Mitsubishi',
  'Nissan',
  'Ford',
  'Hyundai',
  'Kia',
  'Isuzu',
  'Subaru',
  'Mazda',
  'Suzuki',
  'MG',
  'Geely',
  'BMW',
  'Mercedes-Benz',
  'Audi',
  'Other',
];

const YEARS = Array.from({ length: 37 }, (_, i) => String(new Date().getFullYear() + 1 - i));

export default function VehicleStep({ state, onChange }: Props) {
  const { vehicle } = state;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-orange">
          STEP 3 OF {state.inspectionMode === 'both' ? '8' : '7'}
        </span>
        <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight">
          Vehicle Information
        </h2>
        <p className="text-xs text-gray-400 font-sans">
          Specify vehicle specs and plate number for identification on inspection reports.
        </p>
      </div>

      <div className="bg-brand-darker border border-gray-800/80 rounded-xl p-6 shadow-xl space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Make */}
          <div className="space-y-2 font-sans">
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5 text-brand-orange" /> Vehicle Make <span className="text-brand-orange">*</span>
            </label>
            <div className="space-y-2">
              <select
                value={COMMON_MAKES.includes(vehicle.make) ? vehicle.make : 'Other'}
                onChange={(e) => {
                  const val = e.target.value;
                  onChange({ ...vehicle, make: val === 'Other' ? '' : val });
                }}
                className="w-full bg-[#121212] border border-gray-800 rounded-lg p-3.5 text-white focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none text-sm font-sans cursor-pointer"
              >
                <option value="" disabled>Select Vehicle Make</option>
                {COMMON_MAKES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>

              {(!COMMON_MAKES.includes(vehicle.make) || vehicle.make === '') && (
                <input
                  type="text"
                  required
                  value={vehicle.make}
                  onChange={(e) => onChange({ ...vehicle, make: e.target.value })}
                  placeholder="Or enter custom make..."
                  className="w-full bg-[#121212] border border-gray-800 rounded-lg p-3 text-white placeholder-gray-600 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none text-xs font-sans"
                />
              )}
            </div>
          </div>

          {/* Model */}
          <div className="space-y-2 font-sans">
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-brand-orange" /> Vehicle Model <span className="text-brand-orange">*</span>
            </label>
            <input
              type="text"
              required
              value={vehicle.model}
              onChange={(e) => onChange({ ...vehicle, model: e.target.value })}
              placeholder="e.g. Vios, Hilux, Fortuner, Civic"
              className="w-full bg-[#121212] border border-gray-800 rounded-lg p-3.5 text-white placeholder-gray-600 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none text-sm font-sans"
            />
          </div>

          {/* Model Year */}
          <div className="space-y-2 font-sans">
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-brand-orange" /> Model Year <span className="text-brand-orange">*</span>
            </label>
            <select
              value={vehicle.year}
              onChange={(e) => onChange({ ...vehicle, year: e.target.value })}
              className="w-full bg-[#121212] border border-gray-800 rounded-lg p-3.5 text-white focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none text-sm font-mono cursor-pointer"
            >
              <option value="" disabled>Select Year</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Plate Number */}
          <div className="space-y-2 font-sans">
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-brand-orange" /> Plate / Conduction Sticker <span className="text-brand-orange">*</span>
            </label>
            <input
              type="text"
              required
              value={vehicle.plateNumber}
              onChange={(e) => onChange({ ...vehicle, plateNumber: e.target.value.toUpperCase() })}
              placeholder="ABC 1234"
              className="w-full bg-[#121212] border border-gray-800 rounded-lg p-3.5 text-white placeholder-gray-600 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none text-sm font-mono uppercase"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
