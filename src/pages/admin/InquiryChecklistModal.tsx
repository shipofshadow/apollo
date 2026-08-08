import { useState, useEffect } from 'react';
import { X, Save, CheckCircle, CheckCircle2, Loader2, Send, Plus } from 'lucide-react';
import {
  fetchInquiryChecklistPhaseApi,
  saveInquiryChecklistPhaseApi,
  submitInquiryChecklistPhaseApi,
  sendInquiryChecklistPhaseApi,
  fetchServiceByIdApi
} from '../../services/api';
import type { InquiryChecklist, ChecklistPhase, InquiryChecklistResponse, ServiceVariation } from '../../types';

interface InquiryChecklistModalProps {
  inquiryId: string;
  phase: ChecklistPhase;
  token: string;
  onClose: () => void;
  onSaved: () => void;
}

function ServiceFieldValueSelector({
  label,
  value,
  onChange,
  variations,
  disabled = false,
  placeholderText = 'Type custom model / setup details...'
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  variations: ServiceVariation[];
  disabled?: boolean;
  placeholderText?: string;
}) {
  const matchedPreset = variations.find(v => v.name === value);
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
            {value}
          </span>
        )}
      </div>

      {/* Preset Cards Grid */}
      {variations.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {variations.map(v => {
            const isSelected = value === v.name;
            return (
              <button
                key={v.id}
                type="button"
                disabled={disabled}
                onClick={() => {
                  setShowCustomInput(false);
                  onChange(v.name);
                }}
                className={`relative flex items-center justify-between p-3 rounded-md border text-left transition-all duration-200 ${isSelected
                  ? 'bg-brand-orange/15 border-brand-orange text-white shadow-md shadow-brand-orange/10 font-bold'
                  : 'bg-[#151515] border-gray-800 text-gray-300 hover:border-gray-600 hover:bg-[#1c1c1c]'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
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
            disabled={disabled}
            onClick={() => {
              setShowCustomInput(true);
              if (matchedPreset) onChange('');
            }}
            className={`flex items-center justify-center gap-1.5 p-3 rounded-md border text-xs font-bold transition-all duration-200 ${showCustomInput || isCustomActive
              ? 'bg-brand-orange/15 border-brand-orange text-brand-orange'
              : 'bg-[#151515] border-dashed border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
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
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            autoFocus={showCustomInput && !value}
            className="w-full bg-[#151515] border border-brand-orange/50 text-white px-4 py-3 rounded-md text-sm placeholder-gray-600 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none transition-all pr-20"
            placeholder={placeholderText}
          />
          {value && !disabled && (
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

export default function InquiryChecklistModal({ inquiryId, phase, token, onClose, onSaved }: InquiryChecklistModalProps) {
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
  const [sending, setSending] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{ message: string, action: () => void } | null>(null);
  const [alertModal, setAlertModal] = useState<string | null>(null);

  useEffect(() => {
    loadChecklist();
  }, [inquiryId, phase]);

  const loadChecklist = async () => {
    try {
      setLoading(true);
      const data = await fetchInquiryChecklistPhaseApi(token, inquiryId, phase);
      setChecklist(data);
      if (data) {
        setResponses(data.responses);
        setGeneralNotes(data.generalNotes || '');
        setInstallerName(data.installerName || '');
        setServiceFieldValue(data.serviceFieldValue || '');
        setCustomerAcknowledged(data.customerAcknowledged || false);

        if (data.serviceId) {
          fetchServiceByIdApi(data.serviceId, token)
            .then(res => {
              if (res?.service?.variations) {
                setServiceVariations(res.service.variations);
              }
            })
            .catch(err => console.error('Failed to load service variations:', err));
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load checklist');
    } finally {
      setLoading(false);
    }
  };

  const handleResponseChange = (index: number, field: 'isChecked' | 'notes', value: boolean | string) => {
    const next = [...responses];
    next[index] = { ...next[index], [field]: value };
    setResponses(next);
  };

  const handleSaveDraft = async () => {
    if (!checklist) return;
    try {
      setSaving(true);
      await saveInquiryChecklistPhaseApi(token, inquiryId, phase, checklist.id, responses, generalNotes, installerName, customerAcknowledged, serviceFieldValue);
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!checklist) return;
    setConfirmModal({
      message: 'Are you sure you want to submit this checklist? It cannot be edited afterwards.',
      action: async () => {
        try {
          setSubmitting(true);
          await saveInquiryChecklistPhaseApi(token, inquiryId, phase, checklist.id, responses, generalNotes, installerName, customerAcknowledged, serviceFieldValue);
          await submitInquiryChecklistPhaseApi(token, inquiryId, phase, checklist.id, installerName, customerAcknowledged, serviceFieldValue);
          onSaved();
          onClose();
        } catch (err: any) {
          setError(err.message || 'Failed to submit');
        } finally {
          setSubmitting(false);
        }
      }
    });
  };

  const handleSendToClient = async () => {
    setConfirmModal({
      message: 'Are you sure you want to generate a PDF and send it to the client via email?',
      action: async () => {
        try {
          setSending(true);
          await sendInquiryChecklistPhaseApi(token, inquiryId, phase);
          setAlertModal('Report queued — will be delivered to client & shop owners shortly.');
        } catch (err: any) {
          setError(err.message || 'Failed to send');
        } finally {
          setSending(false);
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <Loader2 className="w-8 h-8 animate-spin text-brand-orange" />
      </div>
    );
  }

  if (!checklist) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <div className="bg-brand-dark p-6 rounded border border-gray-800 max-w-md w-full text-center">
          <p className="text-gray-400 mb-4">No checklist template found for this service.</p>
          <button onClick={onClose} className="px-4 py-2 bg-gray-800 text-white rounded">Close</button>
        </div>
      </div>
    );
  }

  const isSubmitted = false; // locking removed — checklist is always editable

  // Group responses for after phase
  const groupedResponses = phase === 'after'
    ? responses.reduce((acc: Record<string, InquiryChecklistResponse[]>, resp: InquiryChecklistResponse) => {
      const sec = resp.item.section || 'General';
      if (!acc[sec]) acc[sec] = [];
      acc[sec].push(resp);
      return acc;
    }, {})
    : null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-md overflow-hidden">
      <div className="flex-shrink-0 border-b border-gray-800 bg-brand-dark px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white uppercase tracking-widest">
            {phase === 'before' ? 'Before Installation Checklist' : phase === 'after' ? 'After Installation Checklist' : 'Checklist'}
          </h2>
          <p className="text-gray-400 text-sm mt-1">Inquiry #{inquiryId}</p>
        </div>
        <div className="flex items-center gap-3">
          {checklist.submittedAt && (
            <button
              onClick={handleSendToClient}
              disabled={sending}
              className="flex items-center gap-2 px-4 py-2 bg-brand-orange hover:bg-orange-600 text-white rounded-sm font-bold uppercase tracking-wider text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send PDF Report
            </button>
          )}

          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-sm">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 lg:p-10">
        <div className="max-w-4xl mx-auto space-y-8 bg-brand-dark border border-gray-800 rounded-sm p-6 lg:p-10">

          {error && (
            <div className="bg-red-900/30 border border-red-500/40 text-red-400 p-4 rounded-sm">
              {error}
            </div>
          )}

          {checklist.submittedAt && (
            <div className="bg-green-900/20 border border-green-500/30 text-green-400 p-4 rounded-sm flex items-center gap-3">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <div>
                <p className="font-bold">Checklist Submitted</p>
                <p className="text-sm opacity-80">Submitted on {new Date(checklist.submittedAt!).toLocaleString()}. You can still edit and re-submit.</p>
              </div>
            </div>
          )}

          {phase === 'before' ? (
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
                        <span className="text-gray-200">{resp.item.label}</span>
                        {resp.item.description && <div className="text-xs text-gray-500 mt-1">{resp.item.description}</div>}
                      </td>
                      <td className="p-3 text-center">
                        <input type="checkbox"
                          checked={resp.isChecked}
                          disabled={isSubmitted}
                          onChange={e => handleResponseChange(index, 'isChecked', e.target.checked)}
                          className="w-5 h-5 accent-brand-orange bg-brand-darker border-gray-700 cursor-pointer"
                        />
                      </td>
                      <td className="p-3">
                        {resp.item.hasNotes ? (
                          <textarea
                            value={resp.notes || ''}
                            disabled={isSubmitted}
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
                        <label key={resp.id} className={`flex items-start gap-3 cursor-pointer p-2 rounded hover:bg-gray-800/50 transition-colors ${isSubmitted ? 'pointer-events-none' : ''}`}>
                          <input type="checkbox"
                            checked={resp.isChecked}
                            disabled={isSubmitted}
                            onChange={() => handleResponseChange(idx, 'isChecked', !resp.isChecked)}
                            className="w-5 h-5 accent-brand-orange bg-brand-darker border-gray-700 mt-0.5"
                          />
                          <div>
                            <span className="text-gray-200 text-sm leading-tight block">{resp.item.label}</span>
                            {resp.item.description && <span className="text-xs text-gray-500 mt-0.5 block">{resp.item.description}</span>}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-4 pt-6 border-t border-gray-800">
            <div>
              <label className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-2">General Notes</label>
              <textarea
                value={generalNotes}
                onChange={e => setGeneralNotes(e.target.value)}
                disabled={isSubmitted}
                className="w-full bg-brand-darker border border-gray-700 text-white p-3 focus:border-brand-orange rounded-sm"
                rows={3}
                placeholder="Any additional observations or notes..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-xs font-bold uppercase tracking-widest text-gray-400 block mb-2">Installer Name</label>
                <input
                  type="text"
                  value={installerName}
                  onChange={e => setInstallerName(e.target.value)}
                  disabled={isSubmitted}
                  className="w-full bg-brand-darker border border-gray-700 text-white p-3 focus:border-brand-orange rounded-sm"
                  placeholder="Technician name"
                />
              </div>

              {checklist.serviceId === 2 && (
                <ServiceFieldValueSelector
                  label="Headlight Setup"
                  value={serviceFieldValue}
                  onChange={setServiceFieldValue}
                  variations={serviceVariations}
                  disabled={isSubmitted}
                  placeholderText="e.g. Bi-LED Retrofit, Laser Projector..."
                />
              )}

              {checklist.serviceId === 1 && (
                <ServiceFieldValueSelector
                  label="Head Unit Model"
                  value={serviceFieldValue}
                  onChange={setServiceFieldValue}
                  variations={serviceVariations}
                  disabled={isSubmitted}
                  placeholderText="e.g. Toyota OEM 10.1&quot;, Pioneer..."
                />
              )}

              {checklist.serviceId !== 1 && checklist.serviceId !== 2 && (
                <ServiceFieldValueSelector
                  label="Service Details / Variation"
                  value={serviceFieldValue}
                  onChange={setServiceFieldValue}
                  variations={serviceVariations}
                  disabled={isSubmitted}
                  placeholderText="Enter custom service details..."
                />
              )}

              <div className="flex items-center h-full pt-6">
                <label className={`flex items-center gap-3 cursor-pointer ${isSubmitted ? 'pointer-events-none' : ''}`}>
                  <input type="checkbox"
                    checked={customerAcknowledged}
                    onChange={e => setCustomerAcknowledged(e.target.checked)}
                    disabled={isSubmitted}
                    className="w-5 h-5 accent-brand-orange"
                  />
                  <span className="text-sm text-gray-300 font-bold tracking-wide">Customer Acknowledgement Signed</span>
                </label>
              </div>
            </div>
          </div>

        </div>
      </div>

      <div className="flex-shrink-0 bg-brand-dark border-t border-gray-800 p-4 px-6 flex items-center justify-between">
        <button type="button" onClick={onClose} className="px-6 py-2 border border-gray-700 text-gray-400 hover:text-white font-bold uppercase tracking-widest transition-colors rounded-sm">
          Cancel
        </button>

        <div className="flex gap-4">
          <button type="button" onClick={handleSaveDraft} disabled={saving || submitting}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 font-bold uppercase tracking-widest transition-colors rounded-sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Draft
          </button>

          <button type="button" onClick={handleSubmit} disabled={saving || submitting}
            className="flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white px-6 py-2 font-bold uppercase tracking-widest transition-colors rounded-sm">
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
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const action = confirmModal.action;
                  setConfirmModal(null);
                  action();
                }}
                className="px-4 py-2 bg-brand-orange hover:bg-orange-600 text-white rounded font-bold transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {alertModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-brand-dark border border-gray-800 rounded p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-white font-bold mb-4 text-lg">Alert</h3>
            <p className="text-gray-300 mb-6">{alertModal}</p>
            <div className="flex justify-end">
              <button
                onClick={() => setAlertModal(null)}
                className="px-4 py-2 bg-brand-orange hover:bg-orange-600 text-white rounded font-bold transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
