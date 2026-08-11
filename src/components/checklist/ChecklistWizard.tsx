import { useState, useEffect, useCallback } from 'react';
import { Download, Printer, RotateCcw, CheckCircle2, ShieldAlert, Loader2, ArrowLeft } from 'lucide-react';
import PageSEO from '../PageSEO';
import type { ChecklistWizardState } from './types';
import WizardProgress from './WizardProgress';
import WizardNavigation from './WizardNavigation';
import { DraftStatus, DraftRecoveryModal } from './DraftStatus';
import ChecklistOverviewModal from './ChecklistOverviewModal';

import ModeSelectionStep from './steps/ModeSelectionStep';
import CustomerStep from './steps/CustomerStep';
import VehicleStep from './steps/VehicleStep';
import ServiceSelectionStep from './steps/ServiceSelectionStep';
import TechnicianStep from './steps/TechnicianStep';
import BeforeChecklistStep from './steps/BeforeChecklistStep';
import AfterChecklistStep from './steps/AfterChecklistStep';
import ReviewStep from './steps/ReviewStep';

import { getChecklistTypeDef } from '../../data/checklistTypes';
import { BACKEND_URL } from '../../config';
import { fetchServicesApi, fetchPublicChecklistSubmissionApi, type ReferenceLookupResult } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

function generateDraftId(): string {
  return 'checklist_draft_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
}

export default function ChecklistWizard() {
  const { user, token, isAdmin, hasPermission } = useAuth();
  const canAutoFill = Boolean(token && (isAdmin || user?.role === 'owner' || hasPermission('bookings:manage')));

  const [wizardState, setWizardState] = useState<ChecklistWizardState>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const phaseParam = urlParams.get('phase');
    let initialMode: ChecklistWizardState['inspectionMode'] = 'before_only';
    if (phaseParam === 'after') initialMode = 'after_only';

    return {
      draftId: generateDraftId(),
      inspectionMode: initialMode,
      currentStep: 1,
      customer: { name: '', email: '' },
      date: new Date().toISOString().split('T')[0],
      vehicle: { make: '', model: '', year: '', plateNumber: '' },
      service: {
        type: null,
        serviceId: null,
        serviceName: '',
        variationId: null,
        variationName: '',
        isCustom: false,
        customName: '',
        customVariation: '',
      },
      technician: { id: null, name: '' },
      before: { itemResponses: {}, additionalNotes: '', confirmed: false, signature: null },
      after: { itemResponses: {}, orientationResponses: {}, confirmed: false, signature: null },
      confirmed: false,
      signature: null,
    };
  });

  const [maxReachedStep, setMaxReachedStep] = useState(1);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  const [pendingDraftState, setPendingDraftState] = useState<ChecklistWizardState | null>(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [downloadingPhase, setDownloadingPhase] = useState<'before' | 'after' | null>(null);

  // Phase overview modal popup trigger
  const [overviewPhase, setOverviewPhase] = useState<'before' | 'after' | null>(null);

  // Check localStorage for active unfinished draft on initial mount
  useEffect(() => {
    try {
      const LOCAL_KEY = '1625_checklist_wizard_active_draft';
      const savedRaw = localStorage.getItem(LOCAL_KEY);
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw) as ChecklistWizardState;
        if (parsed && parsed.customer && (parsed.customer.name || parsed.vehicle.plateNumber)) {
          setPendingDraftState(parsed);
          setShowRecoveryModal(true);
        }
      }
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Save to localStorage & autosave trigger
  useEffect(() => {
    if (submitSuccess) return;
    setSaveStatus('saving');
    const timer = setTimeout(() => {
      try {
        const LOCAL_KEY = '1625_checklist_wizard_active_draft';
        localStorage.setItem(LOCAL_KEY, JSON.stringify(wizardState));
        setSaveStatus('saved');
        setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } catch {
        setSaveStatus('idle');
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [wizardState, submitSuccess]);

  const handleResumeDraft = () => {
    if (pendingDraftState) {
      setWizardState(pendingDraftState);
      setMaxReachedStep(pendingDraftState.currentStep);
    }
    setShowRecoveryModal(false);
  };

  const handleStartNewDraft = () => {
    localStorage.removeItem('1625_checklist_wizard_active_draft');
    setShowRecoveryModal(false);
  };

  const handleAutoFillFromReference = async (match: ReferenceLookupResult) => {
    let dbServices: any[] = [];
    try {
      const res = await fetchServicesApi(null);
      dbServices = res.services || [];
    } catch {
      // Ignore service fetch failure
    }

    const prodName = match.productToPurchase || match.serviceName || '';
    let matchedSvc = match.serviceId ? dbServices.find((s) => s.id === match.serviceId) : undefined;
    if (!matchedSvc && prodName) {
      const pLower = prodName.toLowerCase();
      matchedSvc = dbServices.find((s) => pLower.includes(s.title.toLowerCase()) || s.title.toLowerCase().includes(pLower));
    }

    let serviceData: ChecklistWizardState['service'];

    if (matchedSvc) {
      const defaultVar = matchedSvc.variations && matchedSvc.variations.length > 0 ? matchedSvc.variations[0] : null;
      const catLower = (matchedSvc.category || '').toLowerCase();
      const titleLower = matchedSvc.title.toLowerCase();
      const isHeadlights = catLower.includes('headlight') || catLower.includes('lighting') || titleLower.includes('headlight') || titleLower.includes('projector');

      serviceData = {
        type: isHeadlights ? 'headlights' : 'headunit',
        serviceId: String(matchedSvc.id),
        serviceName: matchedSvc.title,
        variationId: defaultVar ? String(defaultVar.id) : null,
        variationName: defaultVar ? defaultVar.name : '',
        isCustom: false,
        customName: '',
        customVariation: '',
      };
    } else {
      const pLower = prodName.toLowerCase();
      const isHeadlights = pLower.includes('headlight') || pLower.includes('projector') || pLower.includes('retrofit');
      serviceData = {
        type: isHeadlights ? 'headlights' : 'headunit',
        serviceId: null,
        serviceName: '',
        variationId: null,
        variationName: '',
        isCustom: true,
        customName: prodName || 'Selected Package',
        customVariation: '',
      };
    }

    const ref = match.referenceNumber || match.id;

    let beforeItemResponses: Record<string, { checked: boolean; notes: string }> = {};
    let beforeNotes = '';
    let beforeConfirmed = false;
    let beforeSignature = null;

    let afterItemResponses: Record<string, { checked: boolean; notes: string }> = {};
    let afterOrientation: Record<number, boolean> = {};
    let afterConfirmed = false;
    let afterSignature = null;
    let techName = '';

    if (ref) {
      try {
        const [beforeRes, afterRes] = await Promise.all([
          fetchPublicChecklistSubmissionApi(ref, 'before').catch(() => ({ submission: null })),
          fetchPublicChecklistSubmissionApi(ref, 'after').catch(() => ({ submission: null })),
        ]);

        const sSlug = serviceData.type === 'headunit' ? 'android-headunit' : 'projector-headlight';

        if (beforeRes && beforeRes.submission && beforeRes.submission.payload) {
          const p = beforeRes.submission.payload;
          if (Array.isArray(p.responses)) {
            const def = getChecklistTypeDef(sSlug, 'before');
            if (def) {
              def.items.forEach((item, idx) => {
                if (p.responses[idx]) {
                  beforeItemResponses[item.id] = {
                    checked: Boolean(p.responses[idx].isChecked),
                    notes: p.responses[idx].notes || '',
                  };
                }
              });
            }
          }
          beforeNotes = p.additionalNotes || beforeRes.submission.general_notes || '';
          beforeConfirmed = Boolean(p.customerAcknowledged || beforeRes.submission.customer_name);
          beforeSignature = p.signature || beforeRes.submission.signature_data || null;
          if (beforeRes.submission.installer_name) {
            techName = beforeRes.submission.installer_name;
          }
        }

        if (afterRes && afterRes.submission && afterRes.submission.payload) {
          const p = afterRes.submission.payload;
          if (Array.isArray(p.responses)) {
            const def = getChecklistTypeDef(sSlug, 'after');
            if (def) {
              def.items.forEach((item, idx) => {
                if (p.responses[idx]) {
                  afterItemResponses[item.id] = {
                    checked: Boolean(p.responses[idx].isChecked),
                    notes: p.responses[idx].notes || '',
                  };
                }
              });
            }
          }
          if (Array.isArray(p.orientationResponses)) {
            p.orientationResponses.forEach((val: boolean, idx: number) => {
              afterOrientation[idx] = Boolean(val);
            });
          }
          afterConfirmed = Boolean(p.customerAcknowledged || afterRes.submission.customer_name);
          afterSignature = p.signature || afterRes.submission.signature_data || null;
          if (afterRes.submission.installer_name) {
            techName = afterRes.submission.installer_name;
          }
        }
      } catch {
        // Ignore submission restore errors
      }
    }

    setWizardState((prev) => ({
      ...prev,
      draftId: match.referenceNumber || match.id || prev.draftId,
      customer: {
        name: match.customerName || prev.customer.name,
        email: match.customerEmail || prev.customer.email,
      },
      vehicle: {
        make: match.vehicleMake || prev.vehicle.make,
        model: match.vehicleModel || prev.vehicle.model,
        year: match.vehicleYear || prev.vehicle.year,
        plateNumber: match.plateNumber || prev.vehicle.plateNumber,
      },
      service: serviceData,
      technician: {
        id: prev.technician.id,
        name: techName || prev.technician.name,
      },
      before: {
        itemResponses: Object.keys(beforeItemResponses).length > 0 ? beforeItemResponses : prev.before.itemResponses,
        additionalNotes: beforeNotes || prev.before.additionalNotes,
        confirmed: beforeConfirmed || prev.before.confirmed,
        signature: beforeSignature || prev.before.signature,
      },
      after: {
        itemResponses: Object.keys(afterItemResponses).length > 0 ? afterItemResponses : prev.after.itemResponses,
        orientationResponses: Object.keys(afterOrientation).length > 0 ? afterOrientation : prev.after.orientationResponses,
        confirmed: afterConfirmed || prev.after.confirmed,
        signature: afterSignature || prev.after.signature,
      },
    }));
  };

  const buildPhasePayload = (phase: 'before' | 'after') => {
    const serviceSlug = wizardState.service.type === 'headunit' ? 'android-headunit' : 'projector-headlight';
    const checklistDef = getChecklistTypeDef(serviceSlug, phase);

    const responses = checklistDef
      ? checklistDef.items.map((item) => ({
        label: item.label,
        isChecked: Boolean(
          phase === 'before'
            ? wizardState.before.itemResponses[item.id]?.checked
            : wizardState.after.itemResponses[item.id]?.checked
        ),
        notes:
          phase === 'before'
            ? wizardState.before.itemResponses[item.id]?.notes || ''
            : wizardState.after.itemResponses[item.id]?.notes || '',
      }))
      : [];

    const orientationArray = phase === 'after' && checklistDef?.orientationItems
      ? checklistDef.orientationItems.map((_, idx) => Boolean(wizardState.after.orientationResponses[idx]))
      : [];

    const serviceNameText = wizardState.service.isCustom
      ? wizardState.service.customName
      : wizardState.service.serviceName || (serviceSlug === 'android-headunit' ? 'Android Head Unit' : 'Projector Headlight Retrofit');

    const variationText = wizardState.service.isCustom
      ? wizardState.service.customVariation
      : wizardState.service.variationName;

    const serviceFieldValue = variationText ? `${serviceNameText} - ${variationText}` : serviceNameText;
    const fullVehicleText = `${wizardState.vehicle.make} ${wizardState.vehicle.model} ${wizardState.vehicle.year}`.trim();

    const phaseSignature = phase === 'before' ? (wizardState.before.signature || wizardState.signature) : (wizardState.after.signature || wizardState.signature);
    const phaseConfirmed = phase === 'before' ? wizardState.before.confirmed : wizardState.after.confirmed;

    const activeRef = (wizardState.draftId && !wizardState.draftId.startsWith('DRAFT_'))
      ? wizardState.draftId
      : (wizardState.vehicle.plateNumber || wizardState.customer.email || wizardState.draftId);

    return {
      serviceSlug,
      phaseSlug: phase,
      phase: phase,
      customerName: wizardState.customer.name,
      customerEmail: wizardState.customer.email,
      date: wizardState.date,
      vehicle: fullVehicleText,
      vehicleMake: wizardState.vehicle.make,
      vehicleModel: wizardState.vehicle.model,
      vehicleYear: wizardState.vehicle.year,
      plateNumber: wizardState.vehicle.plateNumber,
      serviceFieldValue,
      installerName: wizardState.technician.name,
      responses,
      orientationResponses: orientationArray,
      additionalNotes: wizardState.before.additionalNotes,
      customerAcknowledged: phaseConfirmed,
      signature: phaseSignature,
      referenceNumber: activeRef,
      inquiryId: activeRef,
    };
  };

  // Helper to trigger PDF download for either phase ('before' or 'after')
  const downloadPhasePdf = async (phase: 'before' | 'after') => {
    setDownloadingPhase(phase);
    try {
      const payload = buildPhasePayload(phase);

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
      a.download = `1625_Autolab_${payload.serviceSlug}_${phase.toUpperCase()}_${wizardState.vehicle.plateNumber || 'Report'}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      console.error(err);
      alert('Failed to generate PDF: ' + err.message);
    } finally {
      setDownloadingPhase(null);
    }
  };

  // Step Validation logic
  const validateCurrentStep = useCallback((): boolean => {
    const errors: string[] = [];
    const step = wizardState.currentStep;

    if (step === 1) {
      if (!wizardState.inspectionMode) errors.push('Please select an Inspection Mode.');
    } else if (step === 2) {
      if (!wizardState.customer.name.trim()) errors.push('Customer Name is required.');
      if (!wizardState.customer.email.trim()) errors.push('Customer Email is required.');
    } else if (step === 3) {
      if (!wizardState.vehicle.make.trim()) errors.push('Vehicle Make is required.');
      if (!wizardState.vehicle.model.trim()) errors.push('Vehicle Model is required.');
      if (!wizardState.vehicle.year.trim()) errors.push('Model Year is required.');
      if (!wizardState.vehicle.plateNumber.trim()) errors.push('Plate Number is required.');
    } else if (step === 4) {
      if (!wizardState.service.type) {
        errors.push('Please select a Service Category (Headlights or Headunit).');
      }
      if (wizardState.service.isCustom) {
        if (!wizardState.service.customName.trim()) errors.push('Custom Service / Model name is required.');
      } else {
        if (!wizardState.service.serviceName.trim() && !wizardState.service.serviceId) {
          errors.push('Please select a service model from the catalog or enter custom service.');
        }
      }
    } else if (step === 5) {
      if (!wizardState.technician.name.trim()) errors.push('Technician / Installer name is required.');
    } else if (step === 6) {
      const activePhase = wizardState.inspectionMode === 'after_only' ? 'after' : 'before';
      const serviceSlug = wizardState.service.type === 'headunit' ? 'android-headunit' : 'projector-headlight';
      const phaseDef = getChecklistTypeDef(serviceSlug, activePhase);

      if (activePhase === 'before') {
        if (phaseDef) {
          const unchecked = phaseDef.items.filter((item) => !wizardState.before.itemResponses[item.id]?.checked);
          if (unchecked.length > 0) {
            errors.push(`Please check all ${phaseDef.items.length} items in the Before Checklist.`);
          }
        }
        if (!wizardState.before.confirmed) errors.push('Pre-service customer confirmation checkbox is required.');
        if (!wizardState.before.signature) errors.push('Customer Pre-Service signature is required.');
      } else {
        if (phaseDef) {
          const unchecked = phaseDef.items.filter((item) => !wizardState.after.itemResponses[item.id]?.checked);
          if (unchecked.length > 0) {
            errors.push(`Please check all ${phaseDef.items.length} items in the After Checklist.`);
          }
          if (phaseDef.orientationItems && phaseDef.orientationItems.length > 0) {
            const uncheckedOrient = phaseDef.orientationItems.filter(
              (_, idx) => !wizardState.after.orientationResponses[idx]
            );
            if (uncheckedOrient.length > 0) {
              errors.push('Please check all customer orientation items.');
            }
          }
        }
        if (!wizardState.after.confirmed) errors.push('Post-service customer confirmation checkbox is required.');
        if (!wizardState.after.signature) errors.push('Customer Post-Service signature is required.');
      }
    } else if (step === 7) {
      if (wizardState.inspectionMode === 'both') {
        const serviceSlug = wizardState.service.type === 'headunit' ? 'android-headunit' : 'projector-headlight';
        const afterDef = getChecklistTypeDef(serviceSlug, 'after');
        if (afterDef) {
          const unchecked = afterDef.items.filter((item) => !wizardState.after.itemResponses[item.id]?.checked);
          if (unchecked.length > 0) {
            errors.push(`Please check all ${afterDef.items.length} items in the After Checklist.`);
          }
          if (afterDef.orientationItems && afterDef.orientationItems.length > 0) {
            const uncheckedOrient = afterDef.orientationItems.filter(
              (_, idx) => !wizardState.after.orientationResponses[idx]
            );
            if (uncheckedOrient.length > 0) {
              errors.push('Please check all customer orientation items.');
            }
          }
        }
        if (!wizardState.after.confirmed) errors.push('Post-service customer confirmation checkbox is required.');
        if (!wizardState.after.signature) errors.push('Customer Post-Service signature is required.');
      }
    }

    setValidationErrors(errors);
    return errors.length === 0;
  }, [wizardState]);

  const handleNextStep = () => {
    if (!validateCurrentStep()) return;

    // Trigger Overview Modal on Step 6 (Before / After depending on mode) and Step 7 (After in combined mode)
    if (wizardState.currentStep === 6) {
      const phase = wizardState.inspectionMode === 'after_only' ? 'after' : 'before';
      setOverviewPhase(phase);
      return;
    }

    if (wizardState.currentStep === 7 && wizardState.inspectionMode === 'both') {
      setOverviewPhase('after');
      return;
    }

    const maxStep = wizardState.inspectionMode === 'both' ? 8 : 7;
    const nextStep = Math.min(maxStep, wizardState.currentStep + 1);
    setWizardState((prev) => ({ ...prev, currentStep: nextStep }));
    setMaxReachedStep((prev) => Math.max(prev, nextStep));
    setValidationErrors([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleConfirmAndProceedFromModal = () => {
    const targetPhase = overviewPhase;
    setOverviewPhase(null);

    // Save phase submission to DB without sending email (email is sent upon final submission in handleFinalSubmit)
    if (targetPhase === 'before') {
      sendPhaseSubmissionToDb('before', false);
    } else if (targetPhase === 'after') {
      sendPhaseSubmissionToDb('after', false);
    }

    const nextStep = wizardState.inspectionMode === 'both' ? (targetPhase === 'before' ? 7 : 8) : 7;
    setWizardState((prev) => ({ ...prev, currentStep: nextStep }));
    setMaxReachedStep((prev) => Math.max(prev, nextStep));
    setValidationErrors([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrevStep = () => {
    const prevStep = Math.max(1, wizardState.currentStep - 1);
    setWizardState((prev) => ({ ...prev, currentStep: prevStep }));
    setValidationErrors([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleJumpToStep = (targetStep: number) => {
    if (targetStep <= maxReachedStep) {
      setWizardState((prev) => ({ ...prev, currentStep: targetStep }));
      setValidationErrors([]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const sendPhaseSubmissionToDb = async (phase: 'before' | 'after', sendEmail: boolean = false, emailPhase?: 'before' | 'after' | 'final') => {
    try {
      const payload = buildPhasePayload(phase);
      const requestBody = {
        ...payload,
        sendEmail,
        emailPhase: emailPhase || phase,
      };

      await fetch(`${BACKEND_URL}/api/checklist/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
    } catch (e) {
      console.error(`Failed to save ${phase} phase checklist to DB:`, e);
    }
  };

  const handleFinalSubmit = async () => {
    if (!validateCurrentStep()) return;
    setIsSubmitting(true);
    setValidationErrors([]);

    try {
      if (wizardState.inspectionMode === 'before_only') {
        // Send BEFORE PDF report email only
        await sendPhaseSubmissionToDb('before', true, 'before');
      } else if (wizardState.inspectionMode === 'after_only') {
        // Send AFTER PDF report email only
        await sendPhaseSubmissionToDb('after', true, 'after');
      } else {
        // Full Combined mode: save BEFORE phase, then save AFTER phase & send FINAL combined email containing BOTH PDFs!
        await sendPhaseSubmissionToDb('before', false);
        await sendPhaseSubmissionToDb('after', true, 'final');
      }

      // Clear draft storage
      localStorage.removeItem('1625_checklist_wizard_active_draft');
      setSubmitSuccess(true);
    } catch (err: any) {
      console.error(err);
      setValidationErrors(['Failed to save checklist submission. (' + err.message + ')']);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success view with dual download buttons and BACK TO CHECKLIST button
  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-brand-dark pt-28 sm:pt-36 pb-24 px-4 sm:px-6 lg:px-8 font-sans">
        <PageSEO title="Checklist Completed | 1625 Autolab" description="Checklist submitted and PDF report generated." />

        <div className="max-w-2xl mx-auto bg-[#121212] border border-gray-800/80 rounded-2xl p-8 sm:p-10 shadow-2xl text-center space-y-6">
          <div className="w-20 h-20 bg-emerald-950/50 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto text-emerald-400 shadow-xl">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-brand-orange">Workflow Success</span>
            <h1 className="text-2xl sm:text-3xl font-display font-black text-white uppercase tracking-tight">Installation Checklist Completed</h1>
            <p className="text-xs text-gray-400 font-mono max-w-md mx-auto leading-relaxed">
              The PDF inspection report has been generated. You can download both BEFORE and AFTER inspection reports below.
            </p>
          </div>

          {/* Dual PDF Download Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-gray-800/80">
            <button
              type="button"
              onClick={() => downloadPhasePdf('before')}
              disabled={downloadingPhase === 'before'}
              className="px-5 py-3.5 bg-brand-darker border border-amber-500/40 hover:border-amber-500 text-amber-400 text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
            >
              {downloadingPhase === 'before' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating BEFORE PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download BEFORE PDF</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => downloadPhasePdf('after')}
              disabled={downloadingPhase === 'after'}
              className="px-5 py-3.5 bg-brand-orange hover:bg-orange-600 text-white text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
            >
              {downloadingPhase === 'after' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating AFTER PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download AFTER PDF</span>
                </>
              )}
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            {/* BACK TO CHECKLIST BUTTON */}
            <button
              type="button"
              onClick={() => setSubmitSuccess(false)}
              className="w-full sm:w-auto px-6 py-3 bg-brand-darker border border-gray-800 hover:border-gray-600 text-gray-300 hover:text-white text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-brand-orange" /> Back to Checklist
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="w-full sm:w-auto px-6 py-3 bg-brand-darker border border-gray-800 hover:border-gray-600 text-white text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-brand-orange" /> Print Screen
            </button>

            <button
              type="button"
              onClick={() => {
                setSubmitSuccess(false);
                localStorage.removeItem('1625_checklist_wizard_active_draft');
                setWizardState({
                  draftId: generateDraftId(),
                  inspectionMode: 'before_only',
                  currentStep: 1,
                  customer: { name: '', email: '' },
                  date: new Date().toISOString().split('T')[0],
                  vehicle: { make: '', model: '', year: '', plateNumber: '' },
                  service: { type: null, serviceId: null, serviceName: '', variationId: null, variationName: '', isCustom: false, customName: '', customVariation: '' },
                  technician: { id: null, name: '' },
                  before: { itemResponses: {}, additionalNotes: '', confirmed: false, signature: null },
                  after: { itemResponses: {}, orientationResponses: {}, confirmed: false, signature: null },
                  confirmed: false,
                  signature: null,
                });
                setMaxReachedStep(1);
              }}
              className="w-full sm:w-auto px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-mono font-bold uppercase tracking-wider rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> Start New Checklist
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-dark pt-28 sm:pt-36 pb-24 px-4 sm:px-6 lg:px-8 font-sans">
      <PageSEO title="Guided Installation Checklist Wizard | 1625 Autolab" description="Guided multi-step installation checklist wizard for 1625 Autolab vehicle services." />

      {/* Overview Modal trigger on Continue */}
      {overviewPhase && (
        <ChecklistOverviewModal
          isOpen={true}
          phase={overviewPhase}
          state={wizardState}
          onClose={() => setOverviewPhase(null)}
          onEdit={() => setOverviewPhase(null)}
          onDownloadPdf={() => downloadPhasePdf(overviewPhase)}
          onConfirmProceed={handleConfirmAndProceedFromModal}
        />
      )}

      {/* Draft Recovery Modal */}
      {showRecoveryModal && pendingDraftState && (
        <DraftRecoveryModal
          savedState={pendingDraftState}
          onResume={handleResumeDraft}
          onStartNew={handleStartNewDraft}
        />
      )}

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Header Controls Bar */}
        <div className="flex items-center justify-between no-print gap-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-brand-orange bg-brand-orange/10 border border-brand-orange/20 px-3 py-1.5 rounded-lg shadow-md">
              Checklist Wizard
            </span>
          </div>

          <DraftStatus saveStatus={saveStatus} lastSavedTime={lastSavedTime} />
        </div>

        {/* Wizard Progress Bar */}
        <WizardProgress
          currentStep={wizardState.currentStep}
          maxReachedStep={maxReachedStep}
          inspectionMode={wizardState.inspectionMode}
          onStepClick={handleJumpToStep}
        />

        {/* Validation Errors Banner */}
        {validationErrors.length > 0 && (
          <div className="bg-red-950/50 border border-red-500/40 rounded-xl p-5 space-y-2 no-print shadow-xl">
            <div className="flex items-center gap-2 text-red-300 text-xs font-mono font-bold uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" /> Please complete required fields before continuing
            </div>
            <ul className="list-disc list-inside text-xs text-red-300/90 space-y-1 font-mono">
              {validationErrors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Active Step Content Container */}
        <main className="bg-[#121212] border border-gray-800/80 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          {/* Step 1: Mode Selection */}
          {wizardState.currentStep === 1 && (
            <ModeSelectionStep
              state={wizardState}
              onModeChange={(mode) => setWizardState((prev) => ({ ...prev, inspectionMode: mode }))}
            />
          )}

          {/* Step 2: Customer Info */}
          {wizardState.currentStep === 2 && (
            <CustomerStep
              state={wizardState}
              token={token}
              canAutoFill={canAutoFill}
              onChange={(customer) => setWizardState((prev) => ({ ...prev, customer }))}
              onAutoFillAll={handleAutoFillFromReference}
            />
          )}

          {/* Step 3: Vehicle Info */}
          {wizardState.currentStep === 3 && (
            <VehicleStep
              state={wizardState}
              onChange={(vehicle) => setWizardState((prev) => ({ ...prev, vehicle }))}
            />
          )}

          {/* Step 4: Service Choice */}
          {wizardState.currentStep === 4 && (
            <ServiceSelectionStep
              state={wizardState}
              onChange={(service) => setWizardState((prev) => ({ ...prev, service }))}
            />
          )}

          {/* Step 5: Technician Assignment */}
          {wizardState.currentStep === 5 && (
            <TechnicianStep
              state={wizardState}
              onChange={(technician) => setWizardState((prev) => ({ ...prev, technician }))}
            />
          )}

          {/* Step 6: Before Checklist OR After Checklist (if after_only mode) */}
          {wizardState.currentStep === 6 && (
            wizardState.inspectionMode === 'after_only' ? (
              <AfterChecklistStep
                state={wizardState}
                onItemCheckChange={(itemId, checked) =>
                  setWizardState((prev) => ({
                    ...prev,
                    after: {
                      ...prev.after,
                      itemResponses: {
                        ...prev.after.itemResponses,
                        [itemId]: {
                          checked,
                          notes: prev.after.itemResponses[itemId]?.notes || '',
                        },
                      },
                    },
                  }))
                }
                onItemNotesChange={(itemId, notes) =>
                  setWizardState((prev) => ({
                    ...prev,
                    after: {
                      ...prev.after,
                      itemResponses: {
                        ...prev.after.itemResponses,
                        [itemId]: {
                          checked: prev.after.itemResponses[itemId]?.checked || false,
                          notes,
                        },
                      },
                    },
                  }))
                }
                onOrientationCheckChange={(index, checked) =>
                  setWizardState((prev) => ({
                    ...prev,
                    after: {
                      ...prev.after,
                      orientationResponses: {
                        ...prev.after.orientationResponses,
                        [index]: checked,
                      },
                    },
                  }))
                }
                onConfirmationChange={(confirmed) =>
                  setWizardState((prev) => ({
                    ...prev,
                    after: { ...prev.after, confirmed },
                  }))
                }
                onSignatureChange={(signature) =>
                  setWizardState((prev) => ({
                    ...prev,
                    after: { ...prev.after, signature },
                  }))
                }
              />
            ) : (
              <BeforeChecklistStep
                state={wizardState}
                onItemCheckChange={(itemId, checked) =>
                  setWizardState((prev) => ({
                    ...prev,
                    before: {
                      ...prev.before,
                      itemResponses: {
                        ...prev.before.itemResponses,
                        [itemId]: {
                          checked,
                          notes: prev.before.itemResponses[itemId]?.notes || '',
                        },
                      },
                    },
                  }))
                }
                onItemNotesChange={(itemId, notes) =>
                  setWizardState((prev) => ({
                    ...prev,
                    before: {
                      ...prev.before,
                      itemResponses: {
                        ...prev.before.itemResponses,
                        [itemId]: {
                          checked: prev.before.itemResponses[itemId]?.checked || false,
                          notes,
                        },
                      },
                    },
                  }))
                }
                onAdditionalNotesChange={(additionalNotes) =>
                  setWizardState((prev) => ({
                    ...prev,
                    before: {
                      ...prev.before,
                      additionalNotes,
                    },
                  }))
                }
                onConfirmationChange={(confirmed) =>
                  setWizardState((prev) => ({
                    ...prev,
                    before: { ...prev.before, confirmed },
                  }))
                }
                onSignatureChange={(signature) =>
                  setWizardState((prev) => ({
                    ...prev,
                    before: { ...prev.before, signature },
                  }))
                }
              />
            )
          )}

          {/* Step 7: After Checklist (combined mode) OR Review Step (single mode) */}
          {wizardState.currentStep === 7 && (
            wizardState.inspectionMode === 'both' ? (
              <AfterChecklistStep
                state={wizardState}
                onItemCheckChange={(itemId, checked) =>
                  setWizardState((prev) => ({
                    ...prev,
                    after: {
                      ...prev.after,
                      itemResponses: {
                        ...prev.after.itemResponses,
                        [itemId]: {
                          checked,
                          notes: prev.after.itemResponses[itemId]?.notes || '',
                        },
                      },
                    },
                  }))
                }
                onItemNotesChange={(itemId, notes) =>
                  setWizardState((prev) => ({
                    ...prev,
                    after: {
                      ...prev.after,
                      itemResponses: {
                        ...prev.after.itemResponses,
                        [itemId]: {
                          checked: prev.after.itemResponses[itemId]?.checked || false,
                          notes,
                        },
                      },
                    },
                  }))
                }
                onOrientationCheckChange={(index, checked) =>
                  setWizardState((prev) => ({
                    ...prev,
                    after: {
                      ...prev.after,
                      orientationResponses: {
                        ...prev.after.orientationResponses,
                        [index]: checked,
                      },
                    },
                  }))
                }
                onConfirmationChange={(confirmed) =>
                  setWizardState((prev) => ({
                    ...prev,
                    after: { ...prev.after, confirmed },
                  }))
                }
                onSignatureChange={(signature) =>
                  setWizardState((prev) => ({
                    ...prev,
                    after: { ...prev.after, signature },
                  }))
                }
              />
            ) : (
              <ReviewStep
                state={wizardState}
                onJumpToStep={handleJumpToStep}
              />
            )
          )}

          {/* Step 8: Review Step (combined mode) */}
          {wizardState.currentStep === 8 && wizardState.inspectionMode === 'both' && (
            <ReviewStep
              state={wizardState}
              onJumpToStep={handleJumpToStep}
            />
          )}

          {/* Navigation Controls Bar */}
          <WizardNavigation
            currentStep={wizardState.currentStep}
            totalSteps={wizardState.inspectionMode === 'both' ? 8 : 7}
            canContinue={true}
            isSubmitting={isSubmitting}
            onBack={handlePrevStep}
            onContinue={wizardState.currentStep === (wizardState.inspectionMode === 'both' ? 8 : 7) ? handleFinalSubmit : handleNextStep}
            continueText={
              wizardState.currentStep === 6
                ? (wizardState.inspectionMode === 'after_only' ? 'Review After Overview →' : 'Review Before Overview →')
                : wizardState.currentStep === 7
                  ? (wizardState.inspectionMode === 'both' ? 'Review After Overview →' : 'Submit Checklist')
                  : wizardState.currentStep === 8
                    ? 'Submit Checklist'
                    : 'Continue'
            }
          />
        </main>
      </div>
    </div>
  );
}
