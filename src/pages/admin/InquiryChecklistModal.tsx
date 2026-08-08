import { useState, useEffect } from 'react';
import { X, Save, CheckCircle, CheckCircle2, Loader2, Plus } from 'lucide-react';
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
        <label className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
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
                className={`relative flex items-center justify-between p-3 rounded-md border text-left transition-all duration-200 ${isSelected
                  ? 'bg-brand-orange/15 border-brand-orange text-white shadow-md shadow-brand-orange/10 font-bold'
                  : 'bg-[#151515] border-gray-800 text-gray-300 hover:border-gray-600 hover:bg-[#1c1c1c]'
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
            className={`flex items-center justify-center gap-1.5 p-3 rounded-md border text-xs font-bold transition-all duration-200 ${showCustomInput || isCustomActive
              ? 'bg-brand-orange/15 border-brand-orange text-brand-orange'
              : 'bg-[#151515] border-dashed border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
              }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Custom Entry</span>
          </button>
        </div>
      )}

      {/* Expandable Custom Input Field */}
      {(showCustomInput || isCustomActive || variations.length === 0) && (
        <div className="relative animate-in fade-in slide-in-from-top-1 duration-200">
          <input
            type="text"
            value={matchedPreset ? '' : value}
            onChange={e => onChange(e.target.value)}
            autoFocus={showCustomInput && !value}
            className="w-full bg-[#151515] border border-brand-orange/50 text-white px-4 py-3 rounded-md text-sm placeholder-gray-600 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none transition-all pr-20"
            placeholder={placeholderText}
          />
          {value && !matchedPreset && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-[10px] font-bold uppercase tracking-widest bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded transition-colors"
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
  1: { label: 'Head Unit Model', placeholder: 'e.g. Toyota OEM 10.1", Pioneer...' },
  2: { label: 'Headlight Setup', placeholder: 'e.g. Bi-LED Retrofit, Laser Projector...' }
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
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-md overflow-hidden">
      {/* Backdrop overlay for closing */}
      <div className="absolute inset-0 z-[-1]" onClick={handleCloseRequest} />

      <div className="flex-shrink-0 border-b border-gray-800/80 bg-[#121212] px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 z-10">
        <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-brand-orange" />
              Installation Checklists
            </h2>
            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mt-1.5">Inquiry #{inquiryId}</p>
          </div>
          
          <div className="flex bg-[#1a1a1a] p-1 rounded border border-gray-800/80 shadow-inner">
             <button onClick={() => handleTabSwitch('before')} className={`px-5 py-2 text-[10px] font-bold uppercase tracking-widest rounded transition-all cursor-pointer ${currentPhase === 'before' ? 'bg-brand-orange text-white shadow-lg shadow-brand-orange/20' : 'text-gray-500 hover:text-white hover:bg-gray-800/50'}`}>
               Before
             </button>
             <button onClick={() => handleTabSwitch('after')} className={`px-5 py-2 text-[10px] font-bold uppercase tracking-widest rounded transition-all cursor-pointer ${currentPhase === 'after' ? 'bg-brand-orange text-white shadow-lg shadow-brand-orange/20' : 'text-gray-500 hover:text-white hover:bg-gray-800/50'}`}>
               After
             </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {checklist?.submittedAt && (
            <div className="hidden md:flex bg-green-900/20 border border-green-500/30 text-green-400 px-3 py-1.5 rounded-sm items-center gap-2">
              <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="text-[10px] font-bold uppercase tracking-widest">Submitted</span>
            </div>
          )}
          <button onClick={handleCloseRequest} className="p-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-sm cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 lg:p-10 relative z-10">
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <Loader2 className="w-8 h-8 animate-spin text-brand-orange" />
          </div>
        )}

        {!loading && !checklist && (
          <div className="max-w-md mx-auto text-center bg-brand-dark p-6 rounded border border-gray-800 mt-10">
            <p className="text-gray-400 mb-4">No checklist template found for this service.</p>
            <button onClick={handleCloseRequest} className="px-4 py-2 bg-gray-800 text-white rounded font-bold">Close</button>
          </div>
        )}

        {!loading && checklist && (
          <div className="max-w-4xl mx-auto space-y-8 bg-brand-dark border border-gray-800 rounded-sm p-6 lg:p-10">
            {error && (
              <div className="bg-red-900/30 border border-red-500/40 text-red-400 p-4 rounded-sm font-bold text-sm">
                {error}
              </div>
            )}

            {currentPhase === 'before' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-700 bg-gray-900/50">
                      <th className="p-3 text-xs font-bold uppercase tracking-widest text-gray-400">Item</th>
                      <th className="p-3 text-xs font-bold uppercase tracking-widest text-gray-400 text-center w-24">Check</th>
                      <th className="p-3 text-xs font-bold uppercase tracking-widest text-gray-400 w-1/3">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {responses.map((resp, index) => (
                      <tr key={resp.id} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                        <td className="p-3">
                          <label htmlFor={`resp-${resp.id}`} className="text-gray-200 cursor-pointer">{resp.item.label}</label>
                          {resp.item.description && <div className="text-xs text-gray-500 mt-1">{resp.item.description}</div>}
                        </td>
                        <td className="p-3 text-center">
                          <input type="checkbox"
                            id={`resp-${resp.id}`}
                            checked={resp.isChecked}
                            onChange={e => handleResponseChange(index, 'isChecked', e.target.checked)}
                            className="w-5 h-5 accent-brand-orange bg-brand-darker border-gray-700 cursor-pointer"
                          />
                        </td>
                        <td className="p-3">
                          {resp.item.hasNotes ? (
                            <textarea
                              value={resp.notes || ''}
                              onChange={e => handleResponseChange(index, 'notes', e.target.value)}
                              className="w-full bg-brand-darker border border-gray-700 text-white p-2 text-sm focus:border-brand-orange rounded-sm resize-none"
                              rows={1}
                              placeholder="Optional notes..."
                            />
                          ) : (
                            <span className="text-gray-600 text-sm italic">N/A</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {groupedResponses && Object.entries(groupedResponses).map(([section, sectionResponses]) => (
                  <div key={section} className="bg-gray-900/30 border border-gray-800 rounded-sm p-4">
                    <h4 className="text-sm font-bold text-white uppercase tracking-widest mb-4 pb-2 border-b border-gray-800">{section}</h4>
                    <div className="space-y-3">
                      {sectionResponses.map((resp) => {
                        const idx = responses.findIndex(r => r.id === resp.id);
                        return (
                          <div key={resp.id} className="flex items-start gap-3 p-2 rounded hover:bg-gray-800/50 transition-colors">
                            <input type="checkbox"
                              id={`resp-${resp.id}`}
                              checked={resp.isChecked}
                              onChange={() => handleResponseChange(idx, 'isChecked', !resp.isChecked)}
                              className="w-5 h-5 accent-brand-orange bg-brand-darker border-gray-700 mt-0.5 cursor-pointer"
                            />
                            <label htmlFor={`resp-${resp.id}`} className="cursor-pointer">
                              <span className="text-gray-200 text-sm leading-tight block">{resp.item.label}</span>
                              {resp.item.description && <span className="text-xs text-gray-500 mt-0.5 block">{resp.item.description}</span>}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-4 pt-6 border-t border-gray-800">
              <div>
                <label htmlFor="generalNotes" className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-2 cursor-pointer">General Notes</label>
                <textarea
                  id="generalNotes"
                  value={generalNotes}
                  onChange={e => { setGeneralNotes(e.target.value); setIsDirty(true); }}
                  className="w-full bg-brand-darker border border-gray-700 text-white p-3 focus:border-brand-orange rounded-sm"
                  rows={3}
                  placeholder="Any additional observations or notes..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="installerName" className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-2 cursor-pointer">Installer Name</label>
                  <input
                    id="installerName"
                    type="text"
                    value={installerName}
                    onChange={e => { setInstallerName(e.target.value); setIsDirty(true); }}
                    className="w-full bg-brand-darker border border-gray-700 text-white p-3 focus:border-brand-orange rounded-sm"
                    placeholder="Technician name"
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

                <div className="flex items-center h-full pt-6">
                  <div className="flex items-center gap-3">
                    <input type="checkbox"
                      id="customerAck"
                      checked={customerAcknowledged}
                      onChange={e => { setCustomerAcknowledged(e.target.checked); setIsDirty(true); }}
                      className="w-5 h-5 accent-brand-orange cursor-pointer"
                    />
                    <label htmlFor="customerAck" className="text-sm text-gray-300 font-bold tracking-wide cursor-pointer">
                      Customer Acknowledgement Signed
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 bg-brand-dark border-t border-gray-800 p-4 px-6 flex items-center justify-between z-10">
        <button type="button" onClick={handleCloseRequest} className="px-6 py-2 border border-gray-700 text-gray-400 hover:text-white font-bold uppercase tracking-widest transition-colors rounded-sm cursor-pointer">
          Cancel
        </button>

        <div className="flex gap-4">
          <button type="button" onClick={handleSaveDraft} disabled={saving || submitting || !checklist}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 font-bold uppercase tracking-widest transition-colors rounded-sm cursor-pointer disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Draft
          </button>

          <button type="button" onClick={handleSubmit} disabled={saving || submitting || !checklist}
            className="flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white px-6 py-2 font-bold uppercase tracking-widest transition-colors rounded-sm cursor-pointer disabled:opacity-50">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Submit
          </button>
        </div>
      </div>
      
      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-brand-dark border border-gray-800 rounded p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-white font-bold mb-4 text-lg">Confirmation</h3>
            <p className="text-gray-300 mb-6">{confirmModal.message}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const action = confirmModal.action;
                  setConfirmModal(null);
                  action();
                }}
                className="px-4 py-2 bg-brand-orange hover:bg-orange-600 text-white rounded font-bold transition-colors cursor-pointer"
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
