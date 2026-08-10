import { User, Car, Wrench, UserCheck, Pencil, ShieldCheck, Check } from 'lucide-react';
import { getChecklistTypeDef } from '../../../data/checklistTypes';
import type { ChecklistWizardState } from '../types';

interface Props {
  state: ChecklistWizardState;
  onJumpToStep: (step: number) => void;
  onConfirmationChange?: (confirmed: boolean) => void;
  onSignatureChange?: (signature: string | null) => void;
}

export default function ReviewStep({
  state,
  onJumpToStep,
}: Props) {
  const serviceSlug = state.service.type === 'headunit' ? 'android-headunit' : 'projector-headlight';
  const beforeDef = getChecklistTypeDef(serviceSlug, 'before');
  const afterDef = getChecklistTypeDef(serviceSlug, 'after');

  const beforeCompleted = beforeDef
    ? beforeDef.items.filter((item) => state.before.itemResponses[item.id]?.checked).length === beforeDef.items.length
    : false;

  const afterCompleted = afterDef
    ? afterDef.items.filter((item) => state.after.itemResponses[item.id]?.checked).length === afterDef.items.length
    : false;

  const displayDate = new Date(state.date + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const vehicleText = [state.vehicle.make, state.vehicle.model, state.vehicle.year].filter(Boolean).join(' ');

  const serviceText = state.service.isCustom
    ? state.service.customName
    : state.service.serviceName || (serviceSlug === 'android-headunit' ? 'Android Head Unit Installation' : 'Projector Headlight Retrofit');

  const variationText = state.service.isCustom
    ? state.service.customVariation
    : state.service.variationName;

  const hasBeforeSignature = Boolean(state.before.signature);
  const hasAfterSignature = Boolean(state.after.signature);

  return (
    <div className="space-y-6 font-sans">
      <div className="space-y-1">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-orange">
          STEP 7 OF 7
        </span>
        <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight">
          Final Review &amp; PDF Submission
        </h2>
        <p className="text-xs text-gray-400 font-sans">
          Review all documented customer details, vehicle condition, inspection findings, and client signatures before rendering PDF reports.
        </p>
      </div>

      {/* Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Customer Summary */}
        <div className="bg-brand-darker border border-gray-800/80 rounded-xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between border-b border-gray-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-brand-orange" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">Customer</h3>
            </div>
            <button
              type="button"
              onClick={() => onJumpToStep(1)}
              className="text-[11px] font-mono text-brand-orange hover:underline flex items-center gap-1 uppercase font-bold cursor-pointer"
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
          </div>
          <div className="space-y-1 text-xs font-mono">
            <p className="text-white font-bold text-sm">{state.customer.name || 'Not specified'}</p>
            <p className="text-gray-400">{state.customer.email || 'No email provided'}</p>
            <p className="text-gray-500 text-[11px] pt-1">Date: {displayDate}</p>
          </div>
        </div>

        {/* Vehicle Summary */}
        <div className="bg-brand-darker border border-gray-800/80 rounded-xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between border-b border-gray-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <Car className="w-4 h-4 text-brand-orange" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">Vehicle</h3>
            </div>
            <button
              type="button"
              onClick={() => onJumpToStep(2)}
              className="text-[11px] font-mono text-brand-orange hover:underline flex items-center gap-1 uppercase font-bold cursor-pointer"
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
          </div>
          <div className="space-y-1 text-xs font-mono">
            <p className="text-white font-bold text-sm">{vehicleText || 'Not specified'}</p>
            <p className="text-brand-orange font-bold uppercase">{state.vehicle.plateNumber || 'No plate'}</p>
          </div>
        </div>

        {/* Service Summary */}
        <div className="bg-brand-darker border border-gray-800/80 rounded-xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between border-b border-gray-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-brand-orange" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">Service Model</h3>
            </div>
            <button
              type="button"
              onClick={() => onJumpToStep(3)}
              className="text-[11px] font-mono text-brand-orange hover:underline flex items-center gap-1 uppercase font-bold cursor-pointer"
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
          </div>
          <div className="space-y-1 text-xs font-mono">
            <p className="text-white font-bold text-sm truncate">{serviceText}</p>
            {variationText && <p className="text-gray-400 truncate">{variationText}</p>}
            <span className="inline-block mt-1 text-[10px] font-mono uppercase text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/30">
              {state.service.type?.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Technician Summary */}
        <div className="bg-brand-darker border border-gray-800/80 rounded-xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between border-b border-gray-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-brand-orange" />
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">Technician</h3>
            </div>
            <button
              type="button"
              onClick={() => onJumpToStep(4)}
              className="text-[11px] font-mono text-brand-orange hover:underline flex items-center gap-1 uppercase font-bold cursor-pointer"
            >
              <Pencil className="w-3 h-3" /> Edit
            </button>
          </div>
          <div className="space-y-1 text-xs font-mono">
            <p className="text-white font-bold text-sm">{state.technician.name || 'Not assigned'}</p>
          </div>
        </div>
      </div>

      {/* Checklist & Signatures Verification Summary */}
      <div className="bg-[#121212] border border-gray-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex items-center gap-2 border-b border-gray-800/80 pb-3">
          <ShieldCheck className="w-4.5 h-4.5 text-brand-orange" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white">
            Inspection Findings &amp; Signature Verification
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Before Phase Verification */}
          <div className="p-4 bg-brand-darker border border-gray-800 rounded-xl space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <span className="font-bold text-white uppercase">Before Installation</span>
              <button
                type="button"
                onClick={() => onJumpToStep(5)}
                className="text-[11px] text-brand-orange hover:underline uppercase font-bold cursor-pointer"
              >
                Edit
              </button>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Checklist Items:</span>
                <span className={`font-bold ${beforeCompleted ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {beforeCompleted ? '✓ Completed' : 'Incomplete'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Pre-Service Signature:</span>
                <span className={`font-bold ${hasBeforeSignature ? 'text-emerald-400' : 'text-red-400'}`}>
                  {hasBeforeSignature ? '✓ Signed' : 'Missing'}
                </span>
              </div>
            </div>
          </div>

          {/* After Phase Verification */}
          <div className="p-4 bg-brand-darker border border-gray-800 rounded-xl space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <span className="font-bold text-white uppercase">After Installation</span>
              <button
                type="button"
                onClick={() => onJumpToStep(6)}
                className="text-[11px] text-brand-orange hover:underline uppercase font-bold cursor-pointer"
              >
                Edit
              </button>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Checklist Items:</span>
                <span className={`font-bold ${afterCompleted ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {afterCompleted ? '✓ Completed' : 'Incomplete'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Post-Service Signature:</span>
                <span className={`font-bold ${hasAfterSignature ? 'text-emerald-400' : 'text-red-400'}`}>
                  {hasAfterSignature ? '✓ Signed' : 'Missing'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {hasBeforeSignature && hasAfterSignature && (
          <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-xs font-mono text-emerald-300 flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Both Pre-Service and Post-Service customer signatures are captured. Ready for submission.</span>
          </div>
        )}
      </div>
    </div>
  );
}
