import { useState } from 'react';
import { CheckSquare, CheckCircle2, Sparkles, ShieldCheck, Download, Loader2, Eye } from 'lucide-react';
import { getChecklistTypeDef } from '../../../data/checklistTypes';
import SignatureCanvas from '../../SignatureCanvas';
import ChecklistOverviewModal from '../ChecklistOverviewModal';
import type { ChecklistWizardState } from '../types';

import { BACKEND_URL } from '../../../config';

interface Props {
  state: ChecklistWizardState;
  onItemCheckChange: (itemId: string, checked: boolean) => void;
  onItemNotesChange: (itemId: string, notes: string) => void;
  onOrientationCheckChange: (index: number, checked: boolean) => void;
  onConfirmationChange: (confirmed: boolean) => void;
  onSignatureChange: (signature: string | null) => void;
}

export default function AfterChecklistStep({
  state,
  onItemCheckChange,
  onItemNotesChange,
  onOrientationCheckChange,
  onConfirmationChange,
  onSignatureChange,
}: Props) {
  const [downloadingAfter, setDownloadingAfter] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [showOverviewModal, setShowOverviewModal] = useState(false);

  const serviceSlug = state.service.type === 'headunit' ? 'android-headunit' : 'projector-headlight';
  const checklistDef = getChecklistTypeDef(serviceSlug, 'after');

  if (!checklistDef) {
    return (
      <div className="p-6 bg-red-950/40 border border-red-500/40 rounded-xl text-red-300 text-xs font-mono">
        Failed to load After Checklist definition for {serviceSlug}.
      </div>
    );
  }

  const totalItems = checklistDef.items.length;
  const completedItems = checklistDef.items.filter(
    (item) => state.after.itemResponses[item.id]?.checked
  ).length;

  const progressPercent = Math.round((completedItems / totalItems) * 100);

  const confirmationStatement = checklistDef.confirmationText ||
    'I have inspected the completed installation and confirm that the functions and condition of the vehicle were checked and explained to me.';

  const handleDownloadAfterPdf = async () => {
    if (!state.after.signature) {
      setDownloadError('Customer post-service signature is required prior to downloading the After PDF.');
      return;
    }

    setDownloadingAfter(true);
    setDownloadError(null);
    try {
      const responses = checklistDef.items.map((item) => ({
        label: item.label,
        isChecked: Boolean(state.after.itemResponses[item.id]?.checked),
        notes: state.after.itemResponses[item.id]?.notes || '',
      }));

      const orientationArray = checklistDef.orientationItems
        ? checklistDef.orientationItems.map((_, idx) => Boolean(state.after.orientationResponses[idx]))
        : [];

      const serviceNameText = state.service.isCustom
        ? state.service.customName
        : state.service.serviceName || (serviceSlug === 'android-headunit' ? 'Android Head Unit' : 'Projector Headlight Retrofit');

      const variationText = state.service.isCustom
        ? state.service.customVariation
        : state.service.variationName;

      const serviceFieldValue = variationText ? `${serviceNameText} - ${variationText}` : serviceNameText;
      const fullVehicleText = `${state.vehicle.make} ${state.vehicle.model} ${state.vehicle.year}`.trim();

      const payload = {
        serviceSlug,
        phaseSlug: 'after',
        customerName: state.customer.name,
        customerEmail: state.customer.email,
        date: state.date,
        vehicle: fullVehicleText,
        vehicleMake: state.vehicle.make,
        vehicleModel: state.vehicle.model,
        vehicleYear: state.vehicle.year,
        plateNumber: state.vehicle.plateNumber,
        serviceFieldValue,
        installerName: state.technician.name,
        responses,
        orientationResponses: orientationArray,
        additionalNotes: state.before.additionalNotes,
        customerAcknowledged: state.after.confirmed,
        signature: state.after.signature,
      };

      const response = await fetch(`${BACKEND_URL}/api/public/checklist/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`PDF Render Error (Status ${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `1625_Autolab_${serviceSlug}_AFTER_${state.vehicle.plateNumber || 'Report'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      console.error(err);
      setDownloadError(err.message || 'Failed to download After PDF.');
    } finally {
      setDownloadingAfter(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Overview Modal */}
      <ChecklistOverviewModal
        isOpen={showOverviewModal}
        phase="after"
        state={state}
        onClose={() => setShowOverviewModal(false)}
        onEdit={() => setShowOverviewModal(false)}
        onDownloadPdf={handleDownloadAfterPdf}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-orange">
            STEP {state.inspectionMode === 'both' ? '7 OF 8' : '6 OF 7'}
          </span>
          <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight">
            AFTER INSTALLATION CHECKLIST
          </h2>
          <p className="text-xs text-gray-400 font-sans">
            Verify post-installation quality, test installed functionality, complete customer orientation, and capture post-service customer signature.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowOverviewModal(true)}
            className="px-3.5 py-2.5 bg-brand-darker border border-gray-800 hover:border-gray-600 text-gray-300 hover:text-white text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-brand-orange" />
            <span>Overview</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadAfterPdf}
            disabled={downloadingAfter || completedItems < totalItems}
            className="px-4 py-2.5 bg-brand-darker border border-brand-orange/40 hover:border-brand-orange text-brand-orange text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            {downloadingAfter ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download AFTER PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {downloadError && (
        <div className="p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-red-300 text-xs font-mono">
          {downloadError}
        </div>
      )}

      {/* Submitted / Saved Phase Banner */}
      {state.after.signature && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs text-emerald-300 shadow-md">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <strong className="text-emerald-400 uppercase tracking-wider block font-bold text-xs">✓ Post-Service Inspection Verified &amp; Signed</strong>
              <span className="text-[11px] text-emerald-300/80">Checklist report submitted and saved to database for REF: {state.draftId || 'N/A'}.</span>
            </div>
          </div>
          <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full shrink-0">
            Phase Completed
          </span>
        </div>
      )}

      {/* Progress Bar & Quick Action Buttons Container */}
      <div className="bg-[#121212] border border-gray-800/80 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-mono text-xs text-brand-orange font-bold uppercase tracking-wider">
            <CheckSquare className="w-4 h-4" /> Checklist Progress
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-xs text-white font-bold">
              {completedItems} / {totalItems} COMPLETED ({progressPercent}%)
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  checklistDef.items.forEach((item) => {
                    onItemCheckChange(item.id, true);
                  });
                  if (checklistDef.orientationItems) {
                    checklistDef.orientationItems.forEach((_, idx) => {
                      onOrientationCheckChange(idx, true);
                    });
                  }
                }}
                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-mono font-extrabold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Select All Pass</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  checklistDef.items.forEach((item) => {
                    onItemCheckChange(item.id, false);
                  });
                  if (checklistDef.orientationItems) {
                    checklistDef.orientationItems.forEach((_, idx) => {
                      onOrientationCheckChange(idx, false);
                    });
                  }
                }}
                className="px-2.5 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>

        <div className="w-full h-2.5 bg-brand-darker border border-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              completedItems === totalItems
                ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]'
                : 'bg-gradient-to-r from-brand-orange to-amber-500'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Inspection Item Cards */}
      <div className="space-y-3">
        {checklistDef.items.map((item, idx) => {
          const resp = state.after.itemResponses[item.id] || { checked: false, notes: '' };
          return (
            <div
              key={item.id}
              onClick={(e) => {
                if ((e.target as HTMLElement).tagName === 'INPUT' && (e.target as HTMLInputElement).type === 'text') return;
                onItemCheckChange(item.id, !resp.checked);
              }}
              className={`p-4 rounded-xl border transition-all space-y-3 cursor-pointer select-none ${
                resp.checked
                  ? 'bg-[#161616] border-emerald-500/40 shadow-lg'
                  : 'bg-brand-darker/60 border-gray-800/80 hover:border-gray-700'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-3 cursor-pointer text-xs font-semibold text-gray-200 flex-1 min-w-0">
                  <input
                    type="checkbox"
                    checked={resp.checked}
                    onChange={(e) => {
                      e.stopPropagation();
                      onItemCheckChange(item.id, e.target.checked);
                    }}
                    className="w-5 h-5 rounded border-gray-700 text-brand-orange focus:ring-brand-orange bg-black/40 cursor-pointer shrink-0"
                  />
                  <span className="truncate">
                    <span className="text-brand-orange font-mono mr-2">#{idx + 1}</span>
                    {item.label}
                  </span>
                </label>

                {resp.checked ? (
                  <span className="text-[10px] font-mono font-bold uppercase text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-500/30 shrink-0 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Pass / OK
                  </span>
                ) : (
                  <span className="text-[10px] font-mono uppercase text-gray-500 shrink-0">Unchecked</span>
                )}
              </div>

              {item.hasNotes && (
                <div className="pl-8" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={resp.notes}
                    onChange={(e) => onItemNotesChange(item.id, e.target.value)}
                    placeholder="Add optional condition note or remark..."
                    className="w-full bg-black/40 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:border-brand-orange outline-none font-mono"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Customer Orientation Section */}
      {checklistDef.orientationItems && checklistDef.orientationItems.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2 border-b border-gray-800/80 pb-3">
            <Sparkles className="w-4 h-4 text-brand-orange" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white">
              Customer Orientation &amp; Walkthrough
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {checklistDef.orientationItems.map((itemLabel, idx) => {
              const isChecked = Boolean(state.after.orientationResponses[idx]);
              return (
                <label
                  key={idx}
                  className={`p-4 rounded-xl border flex items-center gap-3 cursor-pointer select-none text-xs text-gray-200 transition-all ${
                    isChecked ? 'bg-[#161616] border-emerald-500/40' : 'bg-brand-darker/60 border-gray-800/80'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => onOrientationCheckChange(idx, e.target.checked)}
                    className="w-5 h-5 rounded border-gray-700 text-brand-orange focus:ring-brand-orange bg-black/40 cursor-pointer shrink-0"
                  />
                  <span className="leading-tight">{itemLabel}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Aftercare Guidelines */}
      {checklistDef.aftercareGuidelines && checklistDef.aftercareGuidelines.length > 0 && (
        <div className="bg-brand-darker/80 border border-gray-800 rounded-xl p-5 space-y-3 shadow-lg">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-brand-orange" />
            <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-white">
              Aftercare Guidelines &bull; 7-Day Protocol
            </h4>
          </div>
          <ul className="list-disc list-inside text-xs text-gray-400 space-y-1.5 leading-relaxed font-sans">
            {checklistDef.aftercareGuidelines.map((rule, idx) => (
              <li key={idx}>{rule}</li>
            ))}
          </ul>
        </div>
      )}

      {/* AFTER Customer Confirmation & Signature Pad */}
      <div className="border-t border-gray-800/80 pt-6 space-y-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4.5 h-4.5 text-brand-orange" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white">
            Post-Service Customer Confirmation &amp; Signature
          </h3>
        </div>

        <div className="p-4 bg-brand-darker border border-gray-800 rounded-xl space-y-3">
          <label className="flex items-start gap-3 cursor-pointer select-none text-xs font-semibold text-gray-200">
            <input
              type="checkbox"
              required
              checked={state.after.confirmed}
              onChange={(e) => onConfirmationChange(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded border-gray-700 text-brand-orange focus:ring-brand-orange bg-black/40 cursor-pointer shrink-0"
            />
            <span className="leading-relaxed">{confirmationStatement}</span>
          </label>
        </div>

        <SignatureCanvas
          value={state.after.signature}
          onChange={onSignatureChange}
          label="Customer Post-Service Signature"
        />
      </div>
    </div>
  );
}
