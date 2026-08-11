import { CheckCircle2, ShieldCheck, Wrench } from 'lucide-react';
import type { ChecklistWizardState, InspectionPhaseMode } from '../types';

interface Props {
  state: ChecklistWizardState;
  onModeChange: (mode: InspectionPhaseMode) => void;
}

export default function ModeSelectionStep({ state, onModeChange }: Props) {
  return (
    <div className="space-y-6 font-sans">
      <div className="space-y-1">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-orange">
          STEP 1 OF 7
        </span>
        <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight">
          Select Inspection Mode
        </h2>
        <p className="text-xs text-gray-400 font-sans">
          Select the inspection process mode for this vehicle intake or turnover.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans">
        {/* BEFORE Only Card */}
        <button
          type="button"
          onClick={() => onModeChange('before_only')}
          className={`p-6 rounded-2xl border text-left transition-all space-y-4 cursor-pointer relative overflow-hidden group ${state.inspectionMode === 'before_only'
            ? 'bg-brand-orange/15 border-brand-orange text-white shadow-xl ring-1 ring-brand-orange/40'
            : 'bg-brand-darker border-gray-800 text-gray-400 hover:border-gray-700 hover:text-white'
            }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-brand-orange/20 border border-brand-orange/30 flex items-center justify-center text-brand-orange font-bold">
              <ShieldCheck className="w-5 h-5" />
            </div>
            {state.inspectionMode === 'before_only' && (
              <CheckCircle2 className="w-5 h-5 text-brand-orange shrink-0" />
            )}
          </div>

          <div className="space-y-1.5">
            <h3 className="text-sm font-mono font-bold uppercase text-brand-orange tracking-wider">
              BEFORE Installation Inspection
            </h3>
            <p className="text-xs font-sans text-gray-300 leading-relaxed">
              Pre-service inspection report. Document pre-existing vehicle condition, OEM functionality, and capture client signature before work begins.
            </p>
          </div>
        </button>

        {/* AFTER Only Card */}
        <button
          type="button"
          onClick={() => onModeChange('after_only')}
          className={`p-6 rounded-2xl border text-left transition-all space-y-4 cursor-pointer relative overflow-hidden group ${state.inspectionMode === 'after_only'
            ? 'bg-amber-500/15 border-amber-500 text-white shadow-xl ring-1 ring-amber-500/40'
            : 'bg-brand-darker border-gray-800 text-gray-400 hover:border-gray-700 hover:text-white'
            }`}
        >
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
              <Wrench className="w-5 h-5" />
            </div>
            {state.inspectionMode === 'after_only' && (
              <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0" />
            )}
          </div>

          <div className="space-y-1.5">
            <h3 className="text-sm font-mono font-bold uppercase text-amber-400 tracking-wider">
              AFTER Installation Inspection
            </h3>
            <p className="text-xs font-sans text-gray-300 leading-relaxed">
              Post-service inspection report. Verify completed installation, test new functions, perform customer orientation, and capture turnover signature.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
