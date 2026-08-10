import { useState } from 'react';
import { CheckSquare, CheckCircle2, Car, UserCheck, Wrench, FileText, Download, Loader2, ShieldCheck, Eye } from 'lucide-react';
import { getChecklistTypeDef } from '../../../data/checklistTypes';
import SignatureCanvas from '../../SignatureCanvas';
import ChecklistOverviewModal from '../ChecklistOverviewModal';
import type { ChecklistWizardState } from '../types';

import { BACKEND_URL } from '../../../config';

interface Props {
  state: ChecklistWizardState;
  onItemCheckChange: (itemId: string, checked: boolean) => void;
  onItemNotesChange: (itemId: string, notes: string) => void;
  onAdditionalNotesChange: (notes: string) => void;
  onConfirmationChange: (confirmed: boolean) => void;
  onSignatureChange: (signature: string | null) => void;
}

export default function BeforeChecklistStep({
  state,
  onItemCheckChange,
  onItemNotesChange,
  onAdditionalNotesChange,
  onConfirmationChange,
  onSignatureChange,
}: Props) {
  const [downloadingBefore, setDownloadingBefore] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [showOverviewModal, setShowOverviewModal] = useState(false);

  const serviceSlug = state.service.type === 'headunit' ? 'android-headunit' : 'projector-headlight';
  const checklistDef = getChecklistTypeDef(serviceSlug, 'before');

  if (!checklistDef) {
    return (
      <div className="p-6 bg-red-950/40 border border-red-500/40 rounded-xl text-red-300 text-xs font-mono">
        Failed to load Before Checklist definition for {serviceSlug}.
      </div>
    );
  }

  const totalItems = checklistDef.items.length;
  const completedItems = checklistDef.items.filter(
    (item) => state.before.itemResponses[item.id]?.checked
  ).length;

  const progressPercent = Math.round((completedItems / totalItems) * 100);

  const vehicleSummary = [state.vehicle.make, state.vehicle.model, state.vehicle.year].filter(Boolean).join(' ');
  const serviceSummary = state.service.isCustom
    ? state.service.customName
    : state.service.serviceName || (serviceSlug === 'android-headunit' ? 'Android Head Unit' : 'Projector Headlight');
  const variationSummary = state.service.isCustom ? state.service.customVariation : state.service.variationName;

  const confirmationStatement = checklistDef.confirmationText ||
    'I confirm that the above items were checked and the existing condition of the vehicle was documented before installation.';

  const handleDownloadBeforePdf = async () => {
    if (!state.before.signature) {
      setDownloadError('Customer signature is required on the Before Checklist prior to downloading.');
      return;
    }

    setDownloadingBefore(true);
    setDownloadError(null);
    try {
      const responses = checklistDef.items.map((item) => ({
        label: item.label,
        isChecked: Boolean(state.before.itemResponses[item.id]?.checked),
        notes: state.before.itemResponses[item.id]?.notes || '',
      }));

      const serviceFieldValue = variationSummary ? `${serviceSummary} - ${variationSummary}` : serviceSummary;
      const fullVehicleText = vehicleSummary.trim();

      const payload = {
        serviceSlug,
        phaseSlug: 'before',
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
        additionalNotes: state.before.additionalNotes,
        customerAcknowledged: state.before.confirmed,
        signature: state.before.signature,
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
      a.download = `1625_Autolab_${serviceSlug}_BEFORE_${state.vehicle.plateNumber || 'Report'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      console.error(err);
      setDownloadError(err.message || 'Failed to download Before PDF.');
    } finally {
      setDownloadingBefore(false);
    }
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Overview Modal */}
      <ChecklistOverviewModal
        isOpen={showOverviewModal}
        phase="before"
        state={state}
        onClose={() => setShowOverviewModal(false)}
        onEdit={() => setShowOverviewModal(false)}
        onDownloadPdf={handleDownloadBeforePdf}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-orange">
            STEP 5 OF 7
          </span>
          <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight">
            BEFORE INSTALLATION CHECKLIST
          </h2>
          <p className="text-xs text-gray-400 font-sans">
            Document existing vehicle condition, test OEM functionality, and capture pre-service customer signature.
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
            onClick={handleDownloadBeforePdf}
            disabled={downloadingBefore || completedItems < totalItems}
            className="px-4 py-2.5 bg-brand-darker border border-brand-orange/40 hover:border-brand-orange text-brand-orange text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            {downloadingBefore ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download BEFORE PDF</span>
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

      {/* Summary Header Card */}
      <div className="bg-brand-darker border border-gray-800/80 rounded-xl p-5 shadow-xl grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
        <div className="flex items-center gap-2.5">
          <Car className="w-4 h-4 text-brand-orange shrink-0" />
          <div>
            <span className="text-[10px] text-gray-500 uppercase block">Vehicle</span>
            <span className="text-white font-bold block">{vehicleSummary || 'N/A'}</span>
            {state.vehicle.plateNumber && (
              <span className="text-brand-orange uppercase text-[11px] font-bold block">{state.vehicle.plateNumber}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Wrench className="w-4 h-4 text-brand-orange shrink-0" />
          <div>
            <span className="text-[10px] text-gray-500 uppercase block">Service</span>
            <span className="text-white font-bold block truncate">{serviceSummary}</span>
            {variationSummary && <span className="text-gray-400 text-[11px] block truncate">{variationSummary}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <UserCheck className="w-4 h-4 text-brand-orange shrink-0" />
          <div>
            <span className="text-[10px] text-gray-500 uppercase block">Technician</span>
            <span className="text-white font-bold block">{state.technician.name || 'Not assigned'}</span>
          </div>
        </div>
      </div>

      {/* Progress Bar & Quick Pass Container */}
      <div className="bg-[#121212] border border-gray-800/80 rounded-xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-mono text-xs text-brand-orange font-bold uppercase tracking-wider">
            <CheckSquare className="w-4 h-4" /> Checklist Progress
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-white font-bold">
              {completedItems} / {totalItems} COMPLETED ({progressPercent}%)
            </span>

            <button
              type="button"
              onClick={() => {
                const allChecked = completedItems === totalItems;
                checklistDef.items.forEach((item) => {
                  onItemCheckChange(item.id, !allChecked);
                });
              }}
              className={`px-3.5 py-1.5 text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 shadow-md cursor-pointer ${
                completedItems === totalItems
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-500/30'
                  : 'bg-emerald-500 text-black hover:bg-emerald-400 font-extrabold shadow-emerald-500/20'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{completedItems === totalItems ? 'Uncheck All' : 'Check All Pass / OK'}</span>
            </button>
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

      {/* Checklist Item Cards */}
      <div className="space-y-3 font-sans">
        {checklistDef.items.map((item, idx) => {
          const resp = state.before.itemResponses[item.id] || { checked: false, notes: '' };
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

      {/* Additional Workshop / Pre-Service Notes */}
      <div className="space-y-2 pt-3">
        <label className="block text-xs font-mono uppercase tracking-widest text-gray-300 font-bold flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5 text-brand-orange" /> Pre-Service Vehicle Observations &amp; Additional Notes
        </label>
        <textarea
          value={state.before.additionalNotes}
          onChange={(e) => onAdditionalNotesChange(e.target.value)}
          placeholder="Enter pre-service vehicle observations, existing scratches/dents, customer requests, or special technician notes prior to installation..."
          className="w-full bg-brand-darker border border-gray-800 rounded-xl p-4 text-xs text-white placeholder-gray-600 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none min-h-[95px] resize-y leading-relaxed font-sans"
        />
      </div>

      {/* BEFORE Customer Confirmation & Signature Pad */}
      <div className="border-t border-gray-800/80 pt-6 space-y-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4.5 h-4.5 text-brand-orange" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-white">
            Pre-Service Customer Confirmation &amp; Signature
          </h3>
        </div>

        <div className="p-4 bg-brand-darker border border-gray-800 rounded-xl space-y-3">
          <label className="flex items-start gap-3 cursor-pointer select-none text-xs font-semibold text-gray-200">
            <input
              type="checkbox"
              required
              checked={state.before.confirmed}
              onChange={(e) => onConfirmationChange(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded border-gray-700 text-brand-orange focus:ring-brand-orange bg-black/40 cursor-pointer shrink-0"
            />
            <span className="leading-relaxed">{confirmationStatement}</span>
          </label>
        </div>

        <SignatureCanvas
          value={state.before.signature}
          onChange={onSignatureChange}
          label="Customer Pre-Service Signature"
        />
      </div>
    </div>
  );
}
