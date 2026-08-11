import { UserCheck } from 'lucide-react';
import type { ChecklistWizardState } from '../types';

interface Props {
  state: ChecklistWizardState;
  onChange: (technician: { id: string | null; name: string }) => void;
}

export default function TechnicianStep({ state, onChange }: Props) {
  const { technician } = state;

  return (
    <div className="space-y-6 font-sans">
      <div className="space-y-1">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-orange">
          STEP 5 OF {state.inspectionMode === 'both' ? '8' : '7'}
        </span>
        <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight">
          Technician / Installer
        </h2>
        <p className="text-xs text-gray-400 font-sans">
          Enter the name of the lead technician performing the vehicle service and inspection.
        </p>
      </div>

      <div className="bg-brand-darker border border-gray-800/80 rounded-xl p-6 shadow-xl space-y-4">
        <div className="space-y-2">
          <label className="block text-xs font-mono font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
            <UserCheck className="w-3.5 h-3.5 text-brand-orange" /> Lead Technician Name <span className="text-brand-orange">*</span>
          </label>
          <input
            type="text"
            required
            value={technician.name}
            onChange={(e) => onChange({ id: null, name: e.target.value })}
            placeholder="Enter lead technician name (e.g. Juan Dela Cruz)..."
            className="w-full bg-[#121212] border border-gray-800 rounded-xl p-4 text-white placeholder-gray-600 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none text-sm font-sans"
          />
        </div>
      </div>
    </div>
  );
}
