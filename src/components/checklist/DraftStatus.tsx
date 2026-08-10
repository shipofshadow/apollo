import { Save, CheckCircle2, RotateCcw, AlertCircle } from 'lucide-react';
import type { ChecklistWizardState } from './types';

interface DraftStatusProps {
  saveStatus: 'idle' | 'saving' | 'saved';
  lastSavedTime?: string | null;
}

export function DraftStatus({ saveStatus, lastSavedTime }: DraftStatusProps) {
  if (saveStatus === 'idle' && !lastSavedTime) return null;

  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-brand-darker border border-gray-800 rounded-full text-[11px] font-mono text-gray-400">
      {saveStatus === 'saving' ? (
        <>
          <Save className="w-3 h-3 text-amber-400 animate-pulse" />
          <span>Saving draft...</span>
        </>
      ) : (
        <>
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          <span>Draft saved {lastSavedTime ? `at ${lastSavedTime}` : 'locally'}</span>
        </>
      )}
    </div>
  );
}

interface DraftRecoveryModalProps {
  savedState: ChecklistWizardState;
  onResume: () => void;
  onStartNew: () => void;
}

export function DraftRecoveryModal({ savedState, onResume, onStartNew }: DraftRecoveryModalProps) {
  const customerName = savedState.customer.name || 'Unnamed Customer';
  const vehicleText = [savedState.vehicle.make, savedState.vehicle.model, savedState.vehicle.year]
    .filter(Boolean)
    .join(' ');
  const plateText = savedState.vehicle.plateNumber || '';
  const serviceType = savedState.service.type
    ? savedState.service.type.toUpperCase()
    : 'Not Selected';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans no-print">
      <div className="w-full max-w-lg bg-[#121212] border border-gray-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95">
        <div className="flex items-center gap-3 border-b border-gray-800/80 pb-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-orange">
              Unfinished Draft Found
            </span>
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">Resume Checklist Draft?</h2>
          </div>
        </div>

        <div className="bg-brand-darker border border-gray-800 rounded-xl p-4 space-y-2 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-gray-500 uppercase">Customer:</span>
            <span className="text-white font-bold">{customerName}</span>
          </div>
          {vehicleText && (
            <div className="flex justify-between">
              <span className="text-gray-500 uppercase">Vehicle:</span>
              <span className="text-gray-300">{vehicleText}</span>
            </div>
          )}
          {plateText && (
            <div className="flex justify-between">
              <span className="text-gray-500 uppercase">Plate Number:</span>
              <span className="text-brand-orange font-bold uppercase">{plateText}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500 uppercase">Service Category:</span>
            <span className="text-emerald-400 font-bold">{serviceType}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 uppercase">Progress:</span>
            <span className="text-gray-300 font-bold">Step {savedState.currentStep} of 8</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onResume}
            className="w-full sm:flex-1 py-3.5 bg-brand-orange hover:bg-orange-600 text-white text-xs font-mono font-bold uppercase tracking-widest rounded-xl transition-all shadow-lg cursor-pointer"
          >
            Resume Draft
          </button>
          <button
            type="button"
            onClick={onStartNew}
            className="w-full sm:w-auto px-5 py-3.5 bg-brand-darker border border-gray-800 hover:border-red-500/40 text-gray-400 hover:text-red-400 text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" /> Start New
          </button>
        </div>
      </div>
    </div>
  );
}
