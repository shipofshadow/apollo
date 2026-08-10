import { CheckCircle2, Download, Pencil, X, FileText, User, Car, Wrench, UserCheck, ShieldCheck } from 'lucide-react';
import { getChecklistTypeDef } from '../../data/checklistTypes';
import type { ChecklistWizardState } from './types';

interface OverviewModalProps {
  isOpen: boolean;
  phase: 'before' | 'after';
  state: ChecklistWizardState;
  onClose: () => void;
  onEdit: () => void;
  onDownloadPdf: () => void;
  onConfirmProceed?: () => void;
}

export default function ChecklistOverviewModal({
  isOpen,
  phase,
  state,
  onClose,
  onEdit,
  onDownloadPdf,
  onConfirmProceed,
}: OverviewModalProps) {
  if (!isOpen) return null;

  const serviceSlug = state.service.type === 'headunit' ? 'android-headunit' : 'projector-headlight';
  const checklistDef = getChecklistTypeDef(serviceSlug, phase);

  const responses = phase === 'before' ? state.before.itemResponses : state.after.itemResponses;
  const signature = phase === 'before' ? state.before.signature : state.after.signature;
  const isConfirmed = phase === 'before' ? state.before.confirmed : state.after.confirmed;
  const additionalNotes = phase === 'before' ? state.before.additionalNotes : '';

  const totalItems = checklistDef?.items.length || 0;
  const checkedItemsCount = checklistDef
    ? checklistDef.items.filter((item) => responses[item.id]?.checked).length
    : 0;

  const displayDate = new Date(state.date + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const vehicleSummary = [state.vehicle.make, state.vehicle.model, state.vehicle.year].filter(Boolean).join(' ');
  const serviceSummary = state.service.isCustom
    ? state.service.customName
    : state.service.serviceName || (serviceSlug === 'android-headunit' ? 'Android Head Unit' : 'Projector Headlight Retrofit');
  const variationSummary = state.service.isCustom ? state.service.customVariation : state.service.variationName;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md font-sans no-print">
      <div className="w-full max-w-3xl max-h-[90vh] bg-[#121212] border border-gray-800/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-brand-darker border-b border-gray-800/80 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded border ${
                phase === 'before'
                  ? 'bg-amber-950/60 text-amber-400 border-amber-500/30'
                  : 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30'
              }`}>
                {phase.toUpperCase()} INSTALLATION OVERVIEW
              </span>
              <span className="text-xs font-mono text-gray-400 font-bold uppercase">
                {checkedItemsCount}/{totalItems} Checked
              </span>
            </div>
            <h2 className="text-xl font-display font-black text-white uppercase tracking-tight">
              {checklistDef?.title || `${serviceSummary} (${phase.toUpperCase()})`}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl border border-gray-800 hover:border-gray-600 text-gray-400 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body Scroll Area */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Summary Information Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-3.5 bg-brand-darker border border-gray-800 rounded-xl space-y-1">
              <span className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
                <User className="w-3 h-3 text-brand-orange" /> Customer
              </span>
              <p className="text-white font-bold truncate">{state.customer.name || 'N/A'}</p>
              <p className="text-gray-400 text-[11px] truncate">{state.customer.email}</p>
            </div>

            <div className="p-3.5 bg-brand-darker border border-gray-800 rounded-xl space-y-1">
              <span className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
                <Car className="w-3 h-3 text-brand-orange" /> Vehicle
              </span>
              <p className="text-white font-bold truncate">{vehicleSummary || 'N/A'}</p>
              <p className="text-brand-orange font-bold uppercase text-[11px]">{state.vehicle.plateNumber}</p>
            </div>

            <div className="p-3.5 bg-brand-darker border border-gray-800 rounded-xl space-y-1">
              <span className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
                <Wrench className="w-3 h-3 text-brand-orange" /> Service
              </span>
              <p className="text-white font-bold truncate">{serviceSummary}</p>
              {variationSummary && <p className="text-gray-400 text-[11px] truncate">{variationSummary}</p>}
            </div>

            <div className="p-3.5 bg-brand-darker border border-gray-800 rounded-xl space-y-1">
              <span className="text-[10px] text-gray-500 uppercase flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-brand-orange" /> Technician
              </span>
              <p className="text-white font-bold truncate">{state.technician.name || 'Not assigned'}</p>
              <p className="text-gray-500 text-[11px]">{displayDate}</p>
            </div>
          </div>

          {/* Inspection Items Findings Overview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-gray-800/80 pb-2">
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-brand-orange" /> Inspection Items ({totalItems})
              </h3>
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/50 px-2.5 py-0.5 rounded border border-emerald-500/30">
                {checkedItemsCount === totalItems ? '✓ All Verified' : `${totalItems - checkedItemsCount} Remaining`}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 font-sans">
              {checklistDef?.items.map((item, idx) => {
                const resp = responses[item.id] || { checked: false, notes: '' };
                return (
                  <div
                    key={item.id}
                    className={`p-3 rounded-xl border text-xs flex flex-col justify-between space-y-1.5 ${
                      resp.checked
                        ? 'bg-[#161616] border-emerald-500/30 text-gray-200'
                        : 'bg-brand-darker border-gray-800/60 text-gray-500'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold truncate">
                        <span className="text-brand-orange font-mono mr-1.5">#{idx + 1}</span>
                        {item.label}
                      </span>
                      {resp.checked ? (
                        <span className="text-[9px] font-mono font-bold uppercase text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30 shrink-0">
                          ✓ OK
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono uppercase text-gray-600 shrink-0">Unchecked</span>
                      )}
                    </div>

                    {resp.notes && (
                      <p className="text-[11px] font-mono text-amber-300 bg-black/40 px-2 py-1 rounded border border-gray-800">
                        Note: {resp.notes}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Orientation Section Overview (After phase only) */}
          {phase === 'after' && checklistDef?.orientationItems && checklistDef.orientationItems.length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white border-b border-gray-800/80 pb-2">
                Customer Orientation Checklist
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                {checklistDef.orientationItems.map((itemLabel, idx) => {
                  const isChecked = Boolean(state.after.orientationResponses[idx]);
                  return (
                    <div
                      key={idx}
                      className={`p-2.5 rounded-lg border flex items-center gap-2 ${
                        isChecked ? 'bg-[#161616] border-emerald-500/30 text-emerald-300' : 'bg-brand-darker border-gray-800 text-gray-500'
                      }`}
                    >
                      <CheckCircle2 className={`w-3.5 h-3.5 ${isChecked ? 'text-emerald-400' : 'text-gray-600'}`} />
                      <span>{itemLabel}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pre-service Additional Notes (Before phase only) */}
          {phase === 'before' && additionalNotes && (
            <div className="space-y-2 pt-2 font-mono text-xs">
              <h3 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-brand-orange" /> Pre-Service Vehicle Observations
              </h3>
              <div className="p-3.5 bg-brand-darker border border-gray-800 rounded-xl text-gray-300 leading-relaxed">
                {additionalNotes}
              </div>
            </div>
          )}

          {/* Signature Overview Section */}
          <div className="p-4 bg-brand-darker border border-gray-800 rounded-xl space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <span className="font-bold text-white uppercase flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-brand-orange" /> {phase.toUpperCase()} Client Sign-off
              </span>
              <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase border ${
                signature ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30' : 'bg-red-950/60 text-red-400 border-red-500/30'
              }`}>
                {signature ? '✓ Signed' : 'Signature Missing'}
              </span>
            </div>

            <p className="text-gray-400 text-[11px] leading-relaxed">
              Confirmed: {isConfirmed ? '✓ Yes (Statement Agreed)' : '✕ Not Checked'}
            </p>

            {signature ? (
              <div className="p-2 bg-white border border-gray-300 rounded-lg flex items-center justify-center">
                <img src={signature} alt="Client Signature" className="max-h-24 object-contain" />
              </div>
            ) : (
              <div className="p-4 bg-black/40 border border-dashed border-gray-800 rounded-lg text-center text-gray-500 text-xs">
                No signature captured for {phase} installation checklist.
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 bg-brand-darker border-t border-gray-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              onEdit();
            }}
            className="w-full sm:w-auto px-5 py-3 rounded-xl border border-gray-800 hover:border-gray-600 bg-[#121212] text-xs font-mono font-bold text-gray-300 hover:text-white uppercase transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Pencil className="w-4 h-4 text-brand-orange" /> Edit Checklist
          </button>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={onDownloadPdf}
              className="w-full sm:w-auto px-5 py-3 rounded-xl border border-brand-orange/40 hover:border-brand-orange bg-[#121212] text-xs font-mono font-bold text-brand-orange uppercase transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <Download className="w-4 h-4" /> Download {phase.toUpperCase()} PDF
            </button>

            {onConfirmProceed && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onConfirmProceed();
                }}
                className="w-full sm:w-auto px-6 py-3 bg-brand-orange hover:bg-orange-600 text-white text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg cursor-pointer"
              >
                Confirm &amp; Proceed →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
