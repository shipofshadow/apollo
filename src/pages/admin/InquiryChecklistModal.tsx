import { useState, useEffect } from 'react';
import { X, Save, CheckCircle, CheckCircle2, Loader2, Plus, ShieldCheck, User, FileText, AlertTriangle, ClipboardList } from 'lucide-react';
import {
  fetchInquiryChecklistPhaseApi,
  saveInquiryChecklistPhaseApi,
  submitInquiryChecklistPhaseApi,
  fetchServiceByIdApi
} from '../../services/api';
import type { InquiryChecklist, ChecklistPhase, InquiryChecklistResponse, ServiceVariation } from '../../types';

interface InquiryChecklistModalProps {
  inquiryId: string;
  initialPhase: ChecklistPhase;
  token: string;
  onClose: () => void;
  onSaved: () => void;
}

function ServiceFieldValueSelector({
  label,
  value,
  onChange,
  variations,
  placeholderText = 'Type custom model / setup details...'
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  variations: ServiceVariation[];
  placeholderText?: string;
}) {
  const matchedPreset = variations.find(v => v.id.toString() === value || v.name === value);
  const isCustomActive = Boolean(value && !matchedPreset);
  const [showCustomInput, setShowCustomInput] = useState(isCustomActive);

  return (
    <div className="space-y-3">
      {/* Field Label & Active Badge */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-2">
          <span>{label}</span>
        </label>
        {value && (
          <span className="text-[10px] bg-brand-orange/20 border border-brand-orange/40 text-brand-orange px-2.5 py-0.5 rounded font-mono font-bold tracking-wide truncate max-w-[200px]">
            {matchedPreset ? matchedPreset.name : value}
          </span>
        )}
      </div>

      {/* Preset Cards Grid */}
      {variations.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {variations.map(v => {
            const isSelected = matchedPreset?.id === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  setShowCustomInput(false);
                  onChange(v.id.toString());
                }}
                className={`relative flex items-center justify-between p-3 rounded-lg border text-left transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'bg-brand-orange/15 border-brand-orange text-white shadow-md font-bold'
                    : 'bg-brand-darker border-gray-800 text-gray-300 hover:border-gray-700 hover:bg-black/30'
                }`}
              >
                <span className="text-xs font-semibold truncate pr-1">{v.name}</span>
                {isSelected && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-brand-orange shrink-0" />
                )}
              </button>
            );
          })}

          {/* Custom Entry Toggle Card */}
          <button
            type="button"
            onClick={() => {
              setShowCustomInput(true);
              if (matchedPreset) onChange('');
            }}
            className={`flex items-center justify-center gap-1.5 p-3 rounded-lg border text-xs font-bold transition-all duration-200 cursor-pointer ${
              showCustomInput || isCustomActive
                ? 'bg-brand-orange/15 border-brand-orange text-brand-orange'
                : 'bg-brand-darker border-dashed border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Custom Entry</span>
          </button>
        </div>
      )}

      {/* Expandable Custom Input Field */}
      {(showCustomInput || isCustomActive || variations.length === 0) && (
        <div className="relative animate-in fade-in duration-200">
          <input
            type="text"
            value={matchedPreset ? '' : value}
            onChange={e => onChange(e.target.value)}
            autoFocus={showCustomInput && !value}
            className="w-full bg-brand-darker border border-brand-orange/50 text-white px-4 py-2.5 rounded-lg text-xs placeholder-gray-600 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none transition-all pr-20"
            placeholder={placeholderText}
          />
          {value && !matchedPreset && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-[10px] font-bold uppercase tracking-widest bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const SERVICE_TYPE_MAP: Record<number, { label: string; placeholder: string }> = {
  1: { label: 'Head Unit Model', placeholder: 'e.g. Toyota OEM 10.1", Pioneer…' },
  2: { label: 'Headlight Setup', placeholder: 'e.g. Bi-LED Retrofit, Laser Projector…' }
};

export default function InquiryChecklistModal({ inquiryId, initialPhase, token, onClose, onSaved }: InquiryChecklistModalProps) {
  const [currentPhase, setCurrentPhase] = useState<ChecklistPhase>(initialPhase);
  const [checklist, setChecklist] = useState<InquiryChecklist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [responses, setResponses] = useState<InquiryChecklistResponse[]>([]);
  const [generalNotes, setGeneralNotes] = useState('');
  const [installerName, setInstallerName] = useState('');
  const [serviceFieldValue, setServiceFieldValue] = useState('');
  const [customerAcknowledged, setCustomerAcknowledged] = useState(false);
  const [serviceVariations, setServiceVariations] = useState<ServiceVariation[]>([]);

  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [isDirty, setIsDirty] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ message: string, action: () => void } | null>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirmModal) {
        handleCloseRequest();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isDirty, confirmModal]);

  useEffect(() => {
    let isMounted = true;
    
    const loadChecklist = async () => {
      try {
        setLoading(true);
        setError(null);
        setServiceVariations([]);
        setChecklist(null);
        
        const data = await fetchInquiryChecklistPhaseApi(token, inquiryId, currentPhase);
        if (!isMounted) return;
        
        setChecklist(data);
        if (data) {
          setResponses(data.responses);
          setGeneralNotes(data.generalNotes || '');
          setInstallerName(data.installerName || '');
          setServiceFieldValue(data.serviceFieldValue || '');
          setCustomerAcknowledged(data.customerAcknowledged || false);
          setIsDirty(false);

          if (data.serviceId) {
            fetchServiceByIdApi(data.serviceId, token)
              .then(res => {
                if (!isMounted) return;
                if (res?.service?.variations) {
                  setServiceVariations(res.service.variations);
                }
              })
              .catch(err => {
                if (isMounted) console.error('Failed to load service variations:', err);
              });
          }
        }
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || 'Failed to load checklist');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadChecklist();
    
    return () => {
      isMounted = false;
    };
  }, [inquiryId, currentPhase, token]);

  const handleResponseChange = (index: number, field: 'isChecked' | 'notes', value: boolean | string) => {
    const next = [...responses];
    next[index] = { ...next[index], [field]: value };
    setResponses(next);
    setIsDirty(true);
  };

  const handleSaveDraft = async () => {
    if (!checklist) return;
    try {
      setError(null);
      setSaving(true);
      await saveInquiryChecklistPhaseApi(token, inquiryId, currentPhase, checklist.id, responses, generalNotes, installerName, customerAcknowledged, serviceFieldValue);
      setIsDirty(false);
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!checklist) return;
    
    if (!installerName.trim()) {
      setError('Installer name is required before submitting.');
      return;
    }
    if (!customerAcknowledged) {
      setError('Customer acknowledgement must be signed before submitting.');
      return;
    }

    setConfirmModal({
      message: 'Are you sure you want to submit this checklist? It cannot be edited afterwards.',
      action: async () => {
        try {
          setError(null);
          setSubmitting(true);
          await saveInquiryChecklistPhaseApi(token, inquiryId, currentPhase, checklist.id, responses, generalNotes, installerName, customerAcknowledged, serviceFieldValue);
          await submitInquiryChecklistPhaseApi(token, inquiryId, currentPhase, checklist.id, installerName, customerAcknowledged, serviceFieldValue);
          setIsDirty(false);
          onSaved();
          onClose();
        } catch (err: any) {
          setError(`Draft saved, but submission failed: ${err.message || 'Unknown error'}`);
        } finally {
          setSubmitting(false);
        }
      }
    });
  };

  const handleCloseRequest = () => {
    if (isDirty) {
      setConfirmModal({
        message: 'You have unsaved changes. Are you sure you want to discard them?',
        action: () => onClose()
      });
    } else {
      onClose();
    }
  };

  const handleTabSwitch = (newPhase: ChecklistPhase) => {
    if (currentPhase === newPhase) return;
    if (isDirty) {
      setConfirmModal({
        message: 'You have unsaved changes. Switching tabs will discard them. Continue?',
        action: () => setCurrentPhase(newPhase)
      });
    } else {
      setCurrentPhase(newPhase);
    }
  };

  const groupedResponses = currentPhase === 'after'
    ? responses.reduce((acc: Record<string, InquiryChecklistResponse[]>, resp: InquiryChecklistResponse) => {
      const sec = resp.item.section || 'General';
      if (!acc[sec]) acc[sec] = [];
      acc[sec].push(resp);
      return acc;
    }, {})
    : null;

  const serviceConfig = checklist 
    ? SERVICE_TYPE_MAP[checklist.serviceId] || { label: 'Service Details / Variation', placeholder: 'Enter custom service details...' }
    : { label: '', placeholder: '' };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex flex-col bg-black/80 backdrop-blur-md overflow-hidden font-sans">
      {/* Backdrop overlay */}
      <div className="absolute inset-0 z-[-1]" onClick={handleCloseRequest} />

      {/* Modal Header */}
      <div className="flex-shrink-0 border-b border-gray-800 bg-brand-dark px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 z-10 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-orange">Installation Inspection</span>
              <span className="text-gray-600 text-xs">•</span>
              <span className="text-xs font-mono text-gray-400">Inquiry #{inquiryId.replace('inq-', '')}</span>
            </div>
            <h2 className="text-lg font-display font-bold text-white uppercase tracking-wide flex items-center gap-2 mt-0.5">
              <ClipboardList className="w-5 h-5 text-brand-orange" />
              {currentPhase === 'before' ? 'Pre-Service Vehicle Checklist' : 'Post-Service Quality Checklist'}
            </h2>
          </div>
          
          {/* Phase Segmented Toggle */}
          <div className="flex bg-brand-darker p-1 rounded-lg border border-gray-800 shadow-inner">
            <button
              type="button"
              onClick={() => handleTabSwitch('before')}
              className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all cursor-pointer ${
                currentPhase === 'before'
                  ? 'bg-brand-orange text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              Before Service
            </button>
            <button
              type="button"
              onClick={() => handleTabSwitch('after')}
              className={`px-4 py-1.5 text-xs font-bold uppercase tracking-wider rounded-md transition-all cursor-pointer ${
                currentPhase === 'after'
                  ? 'bg-brand-orange text-white shadow-md'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              After Service
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {checklist?.submittedAt && (
            <div className="flex bg-green-500/10 border border-green-500/30 text-green-400 px-3 py-1.5 rounded-lg items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Submitted Report</span>
            </div>
          )}
          <button
            type="button"
            onClick={handleCloseRequest}
            aria-label="Close modal"
            className="p-2 text-gray-400 hover:text-white bg-brand-darker hover:bg-gray-800 border border-gray-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Checklist Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 relative z-10 [scrollbar-width:thin]">
        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
            <Loader2 className="w-8 h-8 animate-spin text-brand-orange mb-2" />
            <p className="text-xs font-mono text-gray-400 uppercase tracking-widest">Loading Checklist Template…</p>
          </div>
        )}

        {!loading && !checklist && (
          <div className="max-w-md mx-auto text-center bg-brand-dark p-8 rounded-xl border border-gray-800 mt-10 shadow-xl space-y-4">
            <AlertTriangle className="w-10 h-10 text-brand-orange mx-auto opacity-80" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">No Checklist Template</h3>
            <p className="text-xs text-gray-400">No active checklist template exists for this service.</p>
            <button
              onClick={handleCloseRequest}
              className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Close Window
            </button>
          </div>
        )}

        {!loading && checklist && (
          <div className="max-w-4xl mx-auto space-y-8 bg-brand-dark border border-gray-800 rounded-xl p-6 lg:p-8 shadow-2xl">
            
            {error && (
              <div className="bg-red-950/40 border border-red-500/30 text-red-300 p-4 rounded-lg text-xs font-semibold flex items-center gap-3 shadow-md">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Before Installation Table View */}
            {currentPhase === 'before' ? (
              <div className="overflow-x-auto border border-gray-800 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-800 bg-brand-darker">
                      <th className="p-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">Inspection Item</th>
                      <th className="p-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center w-24">Pass</th>
                      <th className="p-3.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 w-1/3">Notes / Condition</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/80">
                    {responses.map((resp, index) => (
                      <tr key={resp.id} className="hover:bg-brand-darker/60 transition-colors">
                        <td className="p-3.5">
                          <label htmlFor={`resp-${resp.id}`} className="text-white text-xs font-semibold cursor-pointer block">{resp.item.label}</label>
                          {resp.item.description && <div className="text-[11px] text-gray-400 mt-0.5">{resp.item.description}</div>}
                        </td>
                        <td className="p-3.5 text-center">
                          <input
                            type="checkbox"
                            id={`resp-${resp.id}`}
                            checked={resp.isChecked}
                            onChange={e => handleResponseChange(index, 'isChecked', e.target.checked)}
                            className="w-5 h-5 accent-brand-orange bg-brand-darker border-gray-700 cursor-pointer rounded"
                          />
                        </td>
                        <td className="p-3.5">
                          {resp.item.hasNotes ? (
                            <textarea
                              value={resp.notes || ''}
                              onChange={e => handleResponseChange(index, 'notes', e.target.value)}
                              className="w-full bg-brand-darker border border-gray-800 text-white p-2.5 text-xs focus:border-brand-orange rounded-lg resize-none placeholder-gray-600 outline-none"
                              rows={1}
                              placeholder="Optional observations…"
                            />
                          ) : (
                            <span className="text-gray-600 text-xs font-mono italic">N/A</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              /* After Installation Grouped Cards Grid */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {groupedResponses && Object.entries(groupedResponses).map(([section, sectionResponses]) => (
                  <div key={section} className="bg-brand-darker border border-gray-800 rounded-xl p-5 space-y-4">
                    <h4 className="text-xs font-bold text-brand-orange uppercase tracking-wider border-b border-gray-800 pb-2">
                      {section}
                    </h4>
                    <div className="space-y-3">
                      {sectionResponses.map((resp) => {
                        const idx = responses.findIndex(r => r.id === resp.id);
                        return (
                          <div key={resp.id} className="flex items-start gap-3 p-2.5 rounded-lg border border-gray-800/80 bg-brand-dark hover:border-gray-700 transition-colors">
                            <input
                              type="checkbox"
                              id={`resp-${resp.id}`}
                              checked={resp.isChecked}
                              onChange={() => handleResponseChange(idx, 'isChecked', !resp.isChecked)}
                              className="w-5 h-5 accent-brand-orange bg-brand-darker border-gray-700 mt-0.5 cursor-pointer rounded shrink-0"
                            />
                            <label htmlFor={`resp-${resp.id}`} className="cursor-pointer">
                              <span className="text-xs font-semibold text-white leading-tight block">{resp.item.label}</span>
                              {resp.item.description && <span className="text-[11px] text-gray-400 mt-0.5 block">{resp.item.description}</span>}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Metadata & Sign-off Fields */}
            <div className="space-y-6 pt-6 border-t border-gray-800">
              
              {/* General Observations */}
              <div className="space-y-1.5">
                <label htmlFor="generalNotes" className="text-xs font-bold uppercase tracking-widest text-gray-300 block flex items-center gap-2 cursor-pointer">
                  <FileText className="w-3.5 h-3.5 text-brand-orange" /> General Observations &amp; Technician Notes
                </label>
                <textarea
                  id="generalNotes"
                  value={generalNotes}
                  onChange={e => { setGeneralNotes(e.target.value); setIsDirty(true); }}
                  className="w-full bg-brand-darker border border-gray-800 text-white p-3.5 focus:border-brand-orange rounded-lg text-xs placeholder-gray-600 outline-none leading-relaxed"
                  rows={3}
                  placeholder="Record any additional observations, vehicle scratch notes, or technician remarks..."
                />
              </div>

              {/* Grid: Installer Name & Service Spec */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label htmlFor="installerName" className="text-xs font-bold uppercase tracking-widest text-gray-300 block flex items-center gap-2 cursor-pointer">
                    <User className="w-3.5 h-3.5 text-brand-orange" /> Technician / Installer Name <span className="text-brand-orange">*</span>
                  </label>
                  <input
                    id="installerName"
                    type="text"
                    value={installerName}
                    onChange={e => { setInstallerName(e.target.value); setIsDirty(true); }}
                    className="w-full bg-brand-darker border border-gray-800 text-white px-3.5 py-2.5 focus:border-brand-orange rounded-lg text-xs placeholder-gray-600 outline-none font-mono"
                    placeholder="Enter technician full name"
                  />
                </div>

                <ServiceFieldValueSelector
                  key={currentPhase}
                  label={serviceConfig.label}
                  value={serviceFieldValue}
                  onChange={(val) => { setServiceFieldValue(val); setIsDirty(true); }}
                  variations={serviceVariations}
                  placeholderText={serviceConfig.placeholder}
                />
              </div>

              {/* Customer Acknowledgement Sign-off */}
              <div className="bg-brand-darker border border-brand-orange/20 p-4 rounded-xl flex items-center gap-3">
                <input
                  type="checkbox"
                  id="customerAck"
                  checked={customerAcknowledged}
                  onChange={e => { setCustomerAcknowledged(e.target.checked); setIsDirty(true); }}
                  className="w-5 h-5 accent-brand-orange cursor-pointer rounded shrink-0"
                />
                <label htmlFor="customerAck" className="text-xs text-white font-bold tracking-wide cursor-pointer flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-brand-orange shrink-0" />
                  <span>Customer Acknowledgement Signed &amp; Orientation Verified <span className="text-brand-orange">*</span></span>
                </label>
              </div>

            </div>

          </div>
        )}
      </div>

      {/* Modal Action Footer */}
      <div className="flex-shrink-0 bg-brand-dark border-t border-gray-800 p-4 px-6 flex items-center justify-between z-10 shadow-2xl">
        <button
          type="button"
          onClick={handleCloseRequest}
          className="px-5 py-2.5 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
        >
          Close
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={saving || submitting || !checklist}
            className="flex items-center gap-2 bg-brand-darker border border-gray-800 hover:border-gray-700 text-gray-200 px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors rounded-lg disabled:opacity-40 cursor-pointer"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-brand-orange" />}
            <span>Save Draft</span>
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || submitting || !checklist}
            className="flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white px-6 py-2.5 text-xs font-bold uppercase tracking-wider transition-all rounded-lg disabled:opacity-40 shadow-md cursor-pointer"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            <span>Submit Report</span>
          </button>
        </div>
      </div>
      
      {/* Action Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
          <div className="bg-brand-dark border border-gray-800 rounded-xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h3 className="text-xs font-mono font-bold uppercase tracking-widest text-brand-orange border-b border-gray-800 pb-2">
              Confirm Action
            </h3>
            <p className="text-xs text-gray-300 leading-relaxed">{confirmModal.message}</p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 border border-gray-800 text-gray-400 hover:text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const action = confirmModal.action;
                  setConfirmModal(null);
                  action();
                }}
                className="px-5 py-2 bg-brand-orange hover:bg-orange-600 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-md cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
