import { useEffect, useState, useRef } from 'react';
import {
  ArrowLeft, CheckCircle2,
  Trash2, AlertTriangle, User, Car, Activity, Tag,
  ChevronLeft, ChevronRight, ChevronDown, Calendar, ClipboardList,
  StickyNote, FileText, Save, Wrench, RefreshCw, Loader2, BadgeCheck, XCircle, Mail, Phone
} from 'lucide-react';
import {
  fetchInquiryByIdApi,
  deleteInquiryApi,
  updateInquiryStatusApi,
  rescheduleInquiryApi,
  fetchInquiryActivityApi,
  fetchInquiryAvailabilityApi,
  updateInquiryInternalNotesApi,
  fetchServicesApi,
  updateInquiryServiceIdApi,
  fetchShopHoursApi,
  fetchShopClosedDatesApi,
  fetchSiteSettingsApi,
  fetchPublicChecklistSubmissionApi,
} from '../../services/api';
import type { ShopDayHours, Inquiry, Service } from '../../types';
import { INQUIRY_STAGES } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatStatus } from '../../utils/formatStatus';
import { BACKEND_URL } from '../../config';
import EditInquiryModal from '../../components/admin/EditInquiryModal';

function buildDateList(shopHours: ShopDayHours[], closedDatesSet: Set<string>, weeks: number = 4): Date[] {
  const openDays = shopHours.length
    ? new Set(shopHours.filter(h => h.isOpen).map(h => h.dayOfWeek))
    : new Set([1, 2, 3, 4, 5, 6]);
  const dates: Date[] = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() + 1);
  const targetCount = Math.max(1, weeks) * 7;
  while (dates.length < targetCount) {
    const iso = cursor.toISOString().slice(0, 10);
    if (openDays.has(cursor.getDay()) && !closedDatesSet.has(iso)) dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function isoFromDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

interface ReschedulePanelProps {
  inquiry: Inquiry;
  token: string;
  onSuccess: (updatedDate: string, updatedTime: string) => void;
  onCancel: () => void;
}

function AdminInquiryReschedulePanel({ inquiry, token, onSuccess, onCancel }: ReschedulePanelProps) {
  const { showToast } = useToast();

  const [shopHours, setShopHours] = useState<ShopDayHours[]>([]);
  const [closedDatesSet, setClosedDatesSet] = useState<Set<string>>(new Set());
  const [bookingHorizonWeeks, setBookingHorizonWeeks] = useState(4);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [slotCounts, setSlotCounts] = useState<Record<string, number>>({});
  const [slotCapacity, setSlotCapacity] = useState(3);
  const [shopDayIsOpen, setShopDayIsOpen] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([fetchShopHoursApi(), fetchShopClosedDatesApi(), fetchSiteSettingsApi()])
      .then(([{ hours }, cdData, { settings }]) => {
        setShopHours(hours);
        const cd = (cdData as { closedDates: { date: string }[] }).closedDates ?? [];
        setClosedDatesSet(new Set(cd.map(d => d.date)));
        setBookingHorizonWeeks(Math.max(1, parseInt(settings.booking_horizon_weeks ?? '4', 10) || 4));
      })
      .catch(() => { });
  }, []);

  const availableDates = buildDateList(shopHours, closedDatesSet, bookingHorizonWeeks);

  const handleDateSelect = async (date: Date) => {
    setSelectedDate(date);
    setSelectedTime('');
    setAvailableSlots([]);
    setBookedSlots([]);
    setSlotCounts({});
    setShopDayIsOpen(true);
    setSlotsLoading(true);
    try {
      const res = await fetchInquiryAvailabilityApi(isoFromDate(date));
      setShopDayIsOpen(res.isOpen ?? true);
      setAvailableSlots(res.availableSlots ?? []);
      const filtered = (res.bookedSlots ?? []).filter(
        s => !(isoFromDate(date) === inquiry.appointmentDate && s === inquiry.appointmentTime)
      );
      setBookedSlots(filtered);
      setSlotCounts(res.slotCounts ?? {});
      setSlotCapacity(res.slotCapacity ?? 3);
    } catch {
      /* fallback */
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedDate || !selectedTime) return;
    const dateStr = isoFromDate(selectedDate);
    setSaveBusy(true);
    try {
      await rescheduleInquiryApi(token, inquiry.id, dateStr, selectedTime);
      showToast('Inquiry rescheduled successfully.', 'success');
      onSuccess(dateStr, selectedTime);
    } catch (e: any) {
      showToast(e.message || 'Failed to reschedule.', 'error');
    } finally {
      setSaveBusy(false);
    }
  };

  const openSlots = availableSlots.filter(s => !bookedSlots.includes(s));
  const unchanged = selectedDate
    ? (isoFromDate(selectedDate) === inquiry.appointmentDate && selectedTime === inquiry.appointmentTime)
    : false;

  return (
    <div className="space-y-5 bg-brand-darker border border-gray-800 p-5 rounded-xl mt-4">
      {/* Target Date Carousel */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-orange mb-3">Select Date</p>
        <div className="relative">
          <button
            type="button"
            onClick={() => scrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-brand-dark border border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:border-brand-orange -translate-x-3 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <div
            ref={scrollRef}
            className="flex overflow-x-auto gap-2 pb-2 snap-x px-1 scrollbar-hide"
            style={{ scrollbarWidth: 'none' }}
          >
            {availableDates.map((date, i) => {
              const active = selectedDate?.toDateString() === date.toDateString();
              const isCurrentInquiryDate = isoFromDate(date) === inquiry.appointmentDate;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleDateSelect(date)}
                  className={`snap-start shrink-0 w-20 p-3 border text-center transition-all rounded-lg relative cursor-pointer ${active
                      ? 'border-brand-orange bg-brand-orange/15 shadow-md'
                      : 'border-gray-800 hover:border-gray-700 bg-brand-dark'
                    }`}
                >
                  <div className="text-[10px] text-gray-400 uppercase font-mono mb-0.5">
                    {date.toLocaleDateString('en-PH', { weekday: 'short', timeZone: 'Asia/Manila' })}
                  </div>
                  <div className="text-lg font-mono font-bold text-white">{date.getDate()}</div>
                  <div className="text-[10px] text-gray-500 uppercase font-mono mt-0.5">
                    {date.toLocaleDateString('en-PH', { month: 'short', timeZone: 'Asia/Manila' })}
                  </div>
                  {isCurrentInquiryDate && (
                    <div className="absolute bottom-1 left-0 right-0 flex justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-orange shadow-[0_0_8px_rgba(249,115,22,0.8)]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => scrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-brand-dark border border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:border-brand-orange translate-x-3 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {selectedDate && (
          <p className="text-[11px] font-mono text-brand-orange mt-3 font-semibold">
            Selection: {selectedDate.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' })}
          </p>
        )}
      </div>

      {/* Target Time Slots */}
      {selectedDate && (
        <div className="pt-4 border-t border-gray-800">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-orange mb-3 flex items-center gap-2">
            Select Time Slot
            {slotsLoading && (
              <span className="text-gray-500 font-mono flex items-center gap-1 text-xs">
                <Loader2 className="w-3 h-3 animate-spin text-brand-orange" /> Checking availability…
              </span>
            )}
          </p>
          {!slotsLoading && !shopDayIsOpen && (
            <p className="text-xs text-red-400 font-mono bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-lg">
              Shop closed on selected date.
            </p>
          )}
          {!slotsLoading && shopDayIsOpen && openSlots.length === 0 && (
            <p className="text-xs text-gray-400 font-mono py-2">No available time slots for this date.</p>
          )}
          {!slotsLoading && shopDayIsOpen && openSlots.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {openSlots.map(slot => {
                const isSelected = selectedTime === slot;
                const spotsLeft = slotCapacity - (slotCounts[slot] ?? 0);
                const almostFull = spotsLeft === 1;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSelectedTime(slot)}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all cursor-pointer ${isSelected
                        ? 'bg-brand-orange text-white border-brand-orange shadow-lg font-bold'
                        : 'bg-brand-dark border-gray-800 text-gray-300 hover:border-gray-700 hover:text-white'
                      }`}
                  >
                    <span className="text-xs font-bold font-mono">{slot}</span>
                    {spotsLeft > 0 && (
                      <span className={`text-[10px] font-semibold mt-1 ${isSelected ? 'text-white/90' : almostFull ? 'text-brand-orange' : 'text-gray-500'
                        }`}>
                        {almostFull ? '1 spot left' : `${spotsLeft} spots available`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-4 border-t border-gray-800">
        <button
          onClick={handleSave}
          disabled={saveBusy || !selectedDate || !selectedTime || unchanged}
          className="flex-1 flex items-center justify-center gap-2 bg-brand-orange hover:bg-orange-600 text-white px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all rounded-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-md"
        >
          {saveBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Save New Appointment
        </button>
        <button
          onClick={onCancel}
          disabled={saveBusy}
          className="px-5 py-2.5 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600 text-xs font-bold uppercase tracking-wider transition-all rounded-lg disabled:opacity-40 cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

const STATUS_BADGE_STYLE: Record<string, string> = {
  'pending': 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
  'confirmed': 'bg-blue-500/10 text-blue-400 border border-blue-500/30',
  'in_progress': 'bg-brand-orange/10 text-brand-orange border border-brand-orange/30',
  'completed': 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
  'cancelled': 'bg-red-500/10 text-red-400 border border-red-500/30',
};

const STATUS_DOT_STYLE: Record<string, string> = {
  'pending': 'bg-amber-400',
  'confirmed': 'bg-blue-400',
  'in_progress': 'bg-brand-orange',
  'completed': 'bg-emerald-400',
  'cancelled': 'bg-red-400',
};

type InquiryActivityLog = {
  id: number;
  action: string;
  eventType?: string;
  detail: string | null;
  createdAt: string;
  actorName?: string | null;
};

interface Props {
  inquiryId: string;
  onBack: () => void;
  backLabel?: string;
}

type ConfirmDialogState = {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: 'default' | 'danger';
};

/* ── Detail Page Skeleton Loader ───────────────────────────────── */
function DetailSkeleton() {
  return (
    <div className="w-full space-y-8 animate-pulse">
      <div className="h-8 w-40 bg-brand-dark border border-gray-800 rounded-lg" />
      <div className="h-32 bg-brand-dark border border-gray-800 rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          <div className="h-14 bg-brand-dark border border-gray-800 rounded-xl" />
          <div className="h-80 bg-brand-dark border border-gray-800 rounded-xl" />
        </div>
        <div className="lg:col-span-4 h-96 bg-brand-dark border border-gray-800 rounded-xl" />
      </div>
    </div>
  );
}

export default function AdminInquiryDetail({ inquiryId, onBack, backLabel = 'Return to Appointments' }: Props) {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [activityLogs, setActivityLogs] = useState<InquiryActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  type TabType = 'overview' | 'checklists' | 'notes' | 'activity';
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const [statusLoading, setStatusLoading] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | (() => Promise<any>)>(null);

  const [services, setServices] = useState<Service[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [isChangingService, setIsChangingService] = useState(false);

  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [isEditInquiryModalOpen, setIsEditInquiryModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsStatusDropdownOpen(false);
      }
    };
    if (isStatusDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isStatusDropdownOpen]);

  // Notes & Activity
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [notesLoading, setNotesLoading] = useState(false);

  // Checklist Submissions State & Preview Phase & View Mode
  const [submissionsState, setSubmissionsState] = useState<{ before?: any; after?: any }>({});
  const [previewPhase, setPreviewPhase] = useState<'before' | 'after'>('before');
  const [viewMode, setViewMode] = useState<'visual' | 'pdf'>('visual');

  // Admin Checklist Control States & Handlers
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [isResettingPhase, setIsResettingPhase] = useState(false);
  const [isEditingChecklist, setIsEditingChecklist] = useState(false);
  const [editedPayload, setEditedPayload] = useState<any>(null);
  const [isSavingChecklist, setIsSavingChecklist] = useState(false);

  const handleResendChecklistEmail = async (phase: 'before' | 'after' | 'final') => {
    if (!token || !inquiry) return;
    const ref = inquiry.referenceNumber || inquiry.id;
    try {
      setIsResendingEmail(true);
      const res = await fetch(`${BACKEND_URL}/api/admin/checklist/resend-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ ref, phase }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Checklist PDF report email queued and sent (${phase.toUpperCase()}).`, 'success');
      } else {
        throw new Error(data.message || 'Failed to resend email.');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to resend email.', 'error');
    } finally {
      setIsResendingEmail(false);
    }
  };

  const handleResetChecklistPhase = async (phase: 'before' | 'after') => {
    if (!token || !inquiry) return;
    const ref = inquiry.referenceNumber || inquiry.id;

    if (!window.confirm(`Are you sure you want to reset the ${phase.toUpperCase()} inspection checklist? This will delete the submission and allow a fresh inspection to be recorded.`)) {
      return;
    }

    try {
      setIsResettingPhase(true);
      const res = await fetch(`${BACKEND_URL}/api/admin/checklist/submission/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ ref, phase }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Inspection submission for ${phase.toUpperCase()} phase reset successfully.`, 'success');
        setIsEditingChecklist(false);
        fetchData();
      } else {
        throw new Error(data.message || 'Failed to reset inspection.');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to reset inspection.', 'error');
    } finally {
      setIsResettingPhase(false);
    }
  };

  const handleStartEditingChecklist = () => {
    const currentSub = submissionsState[previewPhase];
    if (!currentSub) return;
    const payload = JSON.parse(JSON.stringify(currentSub.payload || {}));
    if (!payload.installerName && currentSub.installer_name) {
      payload.installerName = currentSub.installer_name;
    }
    if (!payload.additionalNotes && currentSub.general_notes) {
      payload.additionalNotes = currentSub.general_notes;
    }
    setEditedPayload(payload);
    setIsEditingChecklist(true);
  };

  const handleSaveChecklistEdit = async () => {
    if (!token || !inquiry || !editedPayload) return;
    const ref = inquiry.referenceNumber || inquiry.id;

    try {
      setIsSavingChecklist(true);
      const res = await fetch(`${BACKEND_URL}/api/admin/checklist/submission/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ref,
          phase: previewPhase,
          payload: editedPayload,
        }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('Checklist submission updated successfully.', 'success');
        setIsEditingChecklist(false);
        fetchData();
      } else {
        throw new Error(data.message || 'Failed to update checklist.');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update checklist.', 'error');
    } finally {
      setIsSavingChecklist(false);
    }
  };

  // Activity log pagination
  const ACTIVITY_PAGE_SIZE = 5;
  const [activityPage, setActivityPage] = useState(0);

  const blobUrlsRef = useRef<string[]>([]);
  useEffect(() => {
    return () => blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
  }, []);

  const id = inquiryId.replace('inq-', '');

  const lastNoteUpdate = activityLogs.slice().reverse().find(log => log.eventType === 'inquiry_internal_notes_updated');

  const fetchData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [res, activitiesRes] = await Promise.all([
        fetchInquiryByIdApi(token, String(id)),
        fetchInquiryActivityApi(token, String(id))
      ]);
      setInquiry((res as { inquiry: any }).inquiry);
      setActivityLogs((activitiesRes as InquiryActivityLog[]) || []);

      const ref = (res as any).inquiry?.referenceNumber || (res as any).inquiry?.id;
      if (ref) {
        Promise.all([
          fetchPublicChecklistSubmissionApi(ref, 'before').catch(() => ({ submission: null })),
          fetchPublicChecklistSubmissionApi(ref, 'after').catch(() => ({ submission: null })),
        ]).then(([beforeRes, afterRes]) => {
          setSubmissionsState({
            before: beforeRes.submission,
            after: afterRes.submission,
          });
        });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  const fetchServices = async () => {
    try {
      setServicesLoading(true);
      const res = await fetchServicesApi(token);
      setServices(res.services || []);
    } catch (err) {
      console.error(err);
    } finally {
      setServicesLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string): Promise<boolean> => {
    if (!token || !inquiry) return false;
    setStatusLoading(true);
    try {
      const res = await updateInquiryStatusApi(token, inquiry.id, newStatus);
      setInquiry({ ...inquiry, status: res.inquiry.status });
      showToast('Status updated successfully.', 'success');
      const activitiesRes = await fetchInquiryActivityApi(token, String(id));
      setActivityLogs((activitiesRes as InquiryActivityLog[]) || []);
      return true;
    } catch (err) {
      showToast((err as Error).message, 'error');
      return false;
    } finally {
      setStatusLoading(false);
    }
  };

  const handleNotesSave = async () => {
    if (!token || !inquiry) return;
    setNotesLoading(true);
    try {
      const res = await updateInquiryInternalNotesApi(token, inquiry.id, editNotes);
      setInquiry({ ...inquiry, internalNotes: res.inquiry.internalNotes });
      setIsEditingNotes(false);
      showToast('Internal notes saved.', 'success');
      const activitiesRes = await fetchInquiryActivityApi(token, String(id));
      setActivityLogs((activitiesRes as InquiryActivityLog[]) || []);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setNotesLoading(false);
    }
  };

  const handleServiceChange = async (serviceId: string, serviceName: string) => {
    if (!token || !inquiry) return;
    const sId = serviceId ? parseInt(serviceId, 10) : null;

    const updateService = async () => {
      try {
        setServicesLoading(true);
        const res = await updateInquiryServiceIdApi(token, inquiry.id, sId);
        setInquiry(res.inquiry);
        showToast('Service linked successfully.', 'success');
        const activitiesRes = await fetchInquiryActivityApi(token, String(id));
        setActivityLogs((activitiesRes as InquiryActivityLog[]) || []);
        setActivityPage(0);
      } catch (err) {
        showToast((err as Error).message, 'error');
      } finally {
        setServicesLoading(false);
      }
    };

    if (inquiry.serviceId) {
      requestConfirmation(
        {
          title: 'Change Linked Service',
          message: `Are you sure you want to link this inquiry to "${serviceName}"? This will change the active checklist template.`,
          confirmLabel: 'Change Service',
          tone: 'default',
        },
        updateService
      );
    } else {
      updateService();
    }
  };

  const handleDelete = async () => {
    if (!token || !inquiry) return;
    setIsDeleting(true);
    try {
      await deleteInquiryApi(token, inquiry.id);
      showToast('Inquiry deleted.', 'success');
      onBack();
    } catch (err) {
      showToast((err as Error).message, 'error');
      setIsDeleting(false);
    }
  };

  const requestConfirmation = (dialog: ConfirmDialogState, action: () => Promise<any>) => {
    setConfirmDialog(dialog);
    setConfirmAction(() => action);
  };

  const closeConfirmation = () => {
    if (confirmBusy) return;
    setConfirmDialog(null);
    setConfirmAction(null);
  };

  const runConfirmedAction = async () => {
    if (!confirmAction) return;
    setConfirmBusy(true);
    try {
      await confirmAction();
      setConfirmDialog(null);
      setConfirmAction(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  if (loading) {
    return <DetailSkeleton />;
  }

  if (error || !inquiry) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-red-400 bg-red-950/40 px-8 py-6 rounded-xl border border-red-500/30 text-center shadow-xl">
          <AlertTriangle className="w-10 h-10" />
          <p className="text-sm font-semibold">{error || 'Inquiry record not found.'}</p>
          <button
            onClick={onBack}
            className="mt-2 text-xs font-bold uppercase tracking-widest text-brand-orange hover:underline cursor-pointer"
          >
            {backLabel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 font-sans">

      {/* ── Top Back Navigation ──────────────────────────────────── */}
      <div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-brand-orange text-xs font-mono uppercase tracking-widest transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> {backLabel}
        </button>
      </div>

      {/* ── 2. Inquiry Header Card ────────────────────────────────── */}
      <header className="bg-brand-dark border border-gray-800 rounded-xl p-5 sm:p-7 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-orange">Inquiry Record</span>
              <span className="text-gray-600">•</span>
              <span className="text-xs font-mono text-gray-400">#{inquiry.id.substring(0, 8)}</span>
              {inquiry.referenceNumber && (
                <>
                  <span className="text-gray-600">•</span>
                  <span className="text-xs font-mono font-bold text-brand-orange bg-brand-orange/10 border border-brand-orange/40 px-2.5 py-0.5 rounded-md flex items-center gap-1.5 shadow-sm">
                    <Tag className="w-3 h-3 text-brand-orange" />
                    <span>REF: {inquiry.referenceNumber}</span>
                  </span>
                </>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-white uppercase tracking-tight">
              {inquiry.fullName}
            </h1>
          </div>

          {/* Status Badge & Open Public Checklist Button */}
          <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
            <div className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-2 border ${STATUS_BADGE_STYLE[inquiry.status] || 'bg-gray-800 text-gray-300 border-gray-700'
              }`}>
              <span className={`w-2 h-2 rounded-full ${STATUS_DOT_STYLE[inquiry.status] || 'bg-gray-400'}`} />
              <span>{formatStatus(inquiry.status)}</span>
            </div>

            <button
              type="button"
              onClick={() => setIsEditInquiryModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg font-bold uppercase tracking-wider text-xs border border-amber-500/50 bg-amber-500/10 text-amber-400 hover:bg-amber-500 hover:text-black transition-all shadow-md cursor-pointer"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Edit Inquiry</span>
            </button>

            <a
              href={`/checklist?ref=${encodeURIComponent(inquiry.referenceNumber || inquiry.id)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg font-bold uppercase tracking-wider text-xs border border-brand-orange/40 text-brand-orange hover:bg-brand-orange hover:text-white transition-all shadow-md cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Open Public Checklist</span>
            </a>
          </div>
        </div>

        {/* Compact Metadata Row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs font-mono text-gray-300">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-brand-orange shrink-0" />
            <span className="truncate">Ref: <strong className="text-white">{inquiry.referenceNumber || 'N/A'}</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <Car className="w-4 h-4 text-brand-orange shrink-0" />
            <span className="truncate">
              {inquiry.make} {inquiry.model} {inquiry.year ? `(${inquiry.year})` : ''}
              {inquiry.plateNumber ? ` • ${inquiry.plateNumber}` : ''}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-brand-orange shrink-0" />
            <span className="truncate">{inquiry.emailAddress || 'No email'}</span>
          </div>

          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-brand-orange shrink-0" />
            <span className="truncate">{inquiry.contactNumber || 'No phone'}</span>
          </div>
        </div>
      </header>

      {/* ── Main Layout Grid (8 cols left / 4 cols right) ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

        {/* Left Column: Segmented Tabs & Content (8 cols) */}
        <div className="lg:col-span-8 space-y-6">

          {/* ── 4. Segmented Tab Navigation ───────────────────────── */}
          <div className="bg-brand-dark border border-gray-800 rounded-xl p-1.5 flex overflow-x-auto [scrollbar-width:none] shadow-lg gap-1">
            {[
              { id: 'overview', label: 'Overview', icon: <FileText className="w-4 h-4" /> },
              { id: 'checklists', label: 'Checklists', icon: <ClipboardList className="w-4 h-4" /> },
              { id: 'notes', label: 'Internal Notes', icon: <StickyNote className="w-4 h-4" /> },
              { id: 'activity', label: 'Activity Log', icon: <Activity className="w-4 h-4" />, badge: activityLogs.length },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${activeTab === tab.id
                    ? 'bg-brand-orange text-white shadow-md'
                    : 'text-gray-400 hover:text-white hover:bg-brand-darker/60'
                  }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono leading-none ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-gray-800 text-gray-400'
                    }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Tab Content: Overview ─────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">

              {/* Customer & Vehicle Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* 5. Customer Card */}
                <div className="bg-brand-dark border border-gray-800 p-6 rounded-xl shadow-lg space-y-4">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-brand-orange flex items-center gap-2 border-b border-gray-800 pb-3">
                    <User className="w-4 h-4" /> Customer Details
                  </h2>
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-[10px] font-mono text-gray-500 uppercase block">Full Name</span>
                      <span className="text-white font-semibold text-sm block mt-0.5">{inquiry.fullName}</span>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono text-gray-500 uppercase block">Email Address</span>
                      <span className="text-gray-300 font-mono block mt-0.5">{inquiry.emailAddress || 'Not provided'}</span>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono text-gray-500 uppercase block">Contact Number</span>
                      <span className="text-gray-300 font-mono block mt-0.5">{inquiry.contactNumber || 'Not provided'}</span>
                    </div>

                    {inquiry.facebookName && (
                      <div>
                        <span className="text-[10px] font-mono text-gray-500 uppercase block">Facebook Profile</span>
                        <span className="text-gray-300 font-medium block mt-0.5">{inquiry.facebookName}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 5. Vehicle Card */}
                <div className="bg-brand-dark border border-gray-800 p-6 rounded-xl shadow-lg space-y-4">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-brand-orange flex items-center gap-2 border-b border-gray-800 pb-3">
                    <Car className="w-4 h-4" /> Vehicle Specs
                  </h2>
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-[10px] font-mono text-gray-500 uppercase block">Make &amp; Model</span>
                      <span className="text-white font-bold text-sm block mt-0.5">
                        {inquiry.make} {inquiry.model} {inquiry.year ? `(${inquiry.year})` : ''}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono text-gray-500 uppercase block">Plate / CS Number</span>
                      <span className="text-gray-300 font-mono uppercase font-bold block mt-0.5">
                        {inquiry.plateNumber || 'N/A'}
                      </span>
                    </div>

                    <div className="bg-brand-orange/10 border border-brand-orange/20 p-3 rounded-lg mt-2">
                      <span className="text-[10px] font-mono text-brand-orange uppercase block font-bold">Product / Service Request</span>
                      <p className="text-white font-medium text-xs mt-1 leading-relaxed">
                        {inquiry.productToPurchase || 'Service inquiry'}
                      </p>
                    </div>
                  </div>
                </div>

              </div>

              {/* 6. Appointment Schedule Card */}
              <div className="bg-brand-dark border border-gray-800 p-6 rounded-xl shadow-lg space-y-4">
                <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-brand-orange flex items-center gap-2">
                    <Calendar className="w-4 h-4" /> Appointment Schedule
                  </h2>
                  {!isEditingSchedule && inquiry.status !== 'completed' && inquiry.status !== 'cancelled' && (
                    <button
                      type="button"
                      onClick={() => setIsEditingSchedule(true)}
                      className="text-xs font-bold uppercase tracking-wider text-brand-orange hover:text-orange-400 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> Reschedule
                    </button>
                  )}
                </div>

                {!isEditingSchedule ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-brand-darker border border-gray-800/80 p-4 rounded-lg">
                      <span className="text-[10px] font-mono text-gray-500 uppercase block">Appointment Date</span>
                      <span className="text-white font-bold text-sm block mt-1">
                        {inquiry.appointmentDate
                          ? new Date(inquiry.appointmentDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                          : 'Not Scheduled'}
                      </span>
                    </div>

                    <div className="bg-brand-darker border border-gray-800/80 p-4 rounded-lg">
                      <span className="text-[10px] font-mono text-gray-500 uppercase block">Appointment Time</span>
                      <span className="text-brand-orange font-mono font-bold text-sm block mt-1">
                        {inquiry.appointmentTime || 'Not Scheduled'}
                      </span>
                    </div>
                  </div>
                ) : (
                  token && (
                    <AdminInquiryReschedulePanel
                      inquiry={inquiry}
                      token={token}
                      onSuccess={async (updatedDate, updatedTime) => {
                        setInquiry(prev => prev ? { ...prev, appointmentDate: updatedDate, appointmentTime: updatedTime } : null);
                        setIsEditingSchedule(false);
                        if (token && inquiryId) {
                          try {
                            const res = await fetchInquiryActivityApi(token, inquiryId);
                            setActivityLogs((res as InquiryActivityLog[]) || []);
                          } catch { }
                        }
                      }}
                      onCancel={() => setIsEditingSchedule(false)}
                    />
                  )
                )}
              </div>

            </div>
          )}

          {/* ── Tab Content: Checklists ──────────────────────────── */}
          {activeTab === 'checklists' && (
            <div className="space-y-6">

              {/* Linked Service Card */}
              <div className="bg-brand-dark border border-gray-800 p-6 rounded-xl shadow-lg space-y-4">
                <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-brand-orange flex items-center gap-2">
                    <Wrench className="w-4 h-4" /> Linked Service Template
                  </h2>
                  {inquiry.serviceId ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-green-500/10 border border-green-500/30 text-green-400 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Linked
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-400 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Unlinked
                    </span>
                  )}
                </div>

                {inquiry.serviceId && !isChangingService ? (
                  (() => {
                    const linkedSvc = services.find(s => s.id === inquiry.serviceId);
                    return (
                      <div className="bg-brand-darker border border-brand-orange/30 p-4 rounded-lg flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-3 rounded-lg bg-brand-orange/20 text-brand-orange">
                            <Wrench className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                              {linkedSvc ? linkedSvc.title : `Service #${inquiry.serviceId}`}
                            </h3>
                            <p className="text-xs text-gray-400">Active checklist template</p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsChangingService(true)}
                          className="px-4 py-2 border border-gray-700 hover:border-brand-orange text-gray-300 hover:text-brand-orange text-xs font-bold uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                        >
                          Change Service
                        </button>
                      </div>
                    );
                  })()
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-gray-400">
                      {!inquiry.serviceId
                        ? 'Select a service below to attach an installation checklist template:'
                        : 'Select a service below to update the active checklist template:'}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {services.map(s => {
                        const isSelected = inquiry.serviceId === s.id;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            disabled={servicesLoading}
                            onClick={() => {
                              if (!isSelected) {
                                handleServiceChange(String(s.id), s.title);
                                setIsChangingService(false);
                              }
                            }}
                            className={`p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${isSelected
                                ? 'border-brand-orange bg-brand-orange/10 ring-1 ring-brand-orange/40 shadow-md'
                                : 'border-gray-800 bg-brand-darker hover:border-gray-700 hover:bg-black/30'
                              }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className={`p-2 rounded-lg ${isSelected ? 'bg-brand-orange text-white' : 'bg-gray-800 text-gray-400'}`}>
                                <Wrench className="w-4 h-4" />
                              </span>
                              {isSelected && <CheckCircle2 className="w-4 h-4 text-brand-orange" />}
                            </div>

                            <div>
                              <h4 className={`text-xs font-bold uppercase tracking-wider mb-1 ${isSelected ? 'text-brand-orange' : 'text-white'}`}>
                                {s.title}
                              </h4>
                              {s.startingPrice && (
                                <p className="text-[10px] font-mono text-gray-400">From {s.startingPrice}</p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {isChangingService && inquiry.serviceId && (
                      <div className="text-right pt-2">
                        <button
                          type="button"
                          onClick={() => setIsChangingService(false)}
                          className="text-xs text-gray-500 hover:text-gray-300 font-mono uppercase underline cursor-pointer"
                        >
                          Cancel Change
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>



            </div>
          )}

          {/* ── Tab Content: Internal Notes ───────────────────────── */}
          {activeTab === 'notes' && (
            <div className="bg-brand-dark border border-gray-800 p-6 rounded-xl shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <h2 className="text-xs font-bold uppercase tracking-widest text-brand-orange flex items-center gap-2">
                  <StickyNote className="w-4 h-4" /> Internal Workspace Notes
                </h2>
                {!isEditingNotes && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditNotes(inquiry.internalNotes || '');
                      setIsEditingNotes(true);
                    }}
                    className="text-xs font-bold uppercase tracking-wider text-brand-orange hover:text-orange-400 transition-colors cursor-pointer"
                  >
                    {inquiry.internalNotes ? 'Edit Notes' : '+ Add Note'}
                  </button>
                )}
              </div>

              {isEditingNotes ? (
                <div className="space-y-3">
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Add internal notes about customer preferences, vehicle condition, or service details..."
                    className="w-full bg-black/40 border border-gray-800 rounded-lg p-4 text-sm text-white placeholder-gray-600 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none min-h-[140px] resize-y leading-relaxed"
                  />
                  <div className="flex gap-3 justify-end">
                    <button
                      type="button"
                      onClick={() => setIsEditingNotes(false)}
                      className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border border-gray-800 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleNotesSave}
                      disabled={notesLoading}
                      className="px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-brand-orange hover:bg-orange-600 text-white transition-colors shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {notesLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      <span>Save Notes</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-brand-darker rounded-lg p-5 border border-gray-800/80 min-h-[100px] flex flex-col justify-between">
                  {inquiry.internalNotes ? (
                    <>
                      <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{inquiry.internalNotes}</p>
                      {lastNoteUpdate && (
                        <p className="text-[10px] text-gray-500 font-mono text-right mt-4 pt-2 border-t border-gray-800">
                          Last updated by <span className="text-gray-300 font-bold">{lastNoteUpdate.actorName || 'System'}</span> on {new Date(lastNoteUpdate.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })}
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-gray-800 rounded-lg p-6">
                      <StickyNote className="w-8 h-8 text-gray-600 mb-2" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">No internal notes yet</h3>
                      <p className="text-xs text-gray-500 mt-1 max-w-xs">
                        Add notes about customer preferences, vehicle condition, or service details.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Tab Content: Checklists Live Visual & PDF Preview ────── */}
          {activeTab === 'checklists' && (
            <div className="space-y-6 font-sans">
              
              {/* Phase Selector & View Mode Toolbar */}
              <div className="bg-brand-dark border border-gray-800 rounded-xl p-4 sm:p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                
                {/* Left: Phase Switcher (Before / After) */}
                <div className="bg-brand-darker border border-gray-800 rounded-lg p-1 flex items-center gap-1 self-start">
                  <button
                    type="button"
                    onClick={() => setPreviewPhase('before')}
                    className={`px-3.5 py-2 rounded-md text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                      previewPhase === 'before'
                        ? 'bg-brand-orange text-white shadow-md'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Pre-Service (Before)</span>
                    {submissionsState.before ? (
                      <span className="w-2 h-2 rounded-full bg-green-400" title="Submitted" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-amber-400" title="Not submitted" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setPreviewPhase('after')}
                    className={`px-3.5 py-2 rounded-md text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                      previewPhase === 'after'
                        ? 'bg-brand-orange text-white shadow-md'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Post-Service (After)</span>
                    {submissionsState.after ? (
                      <span className="w-2 h-2 rounded-full bg-green-400" title="Submitted" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-amber-400" title="Not submitted" />
                    )}
                  </button>
                </div>

                {/* Right: View Mode Toggle & Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {submissionsState[previewPhase] && (
                    <div className="bg-brand-darker border border-gray-800 rounded-lg p-1 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setViewMode('visual')}
                        className={`px-3 py-1.5 rounded-md text-[11px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                          viewMode === 'visual'
                            ? 'bg-gray-700 text-white shadow'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        Visual Checklist
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('pdf')}
                        className={`px-3 py-1.5 rounded-md text-[11px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                          viewMode === 'pdf'
                            ? 'bg-gray-700 text-white shadow'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        PDF Document
                      </button>
                    </div>
                  )}

                  {submissionsState[previewPhase] ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleResendChecklistEmail(previewPhase)}
                        disabled={isResendingEmail}
                        className="px-3 py-1.5 bg-blue-950/60 hover:bg-blue-900/80 border border-blue-500/40 text-blue-300 hover:text-white text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Resend official PDF report email to customer and shop admins"
                      >
                        {isResendingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" /> : <Mail className="w-3.5 h-3.5 text-blue-400" />}
                        <span>Resend Email</span>
                      </button>

                      <button
                        type="button"
                        onClick={isEditingChecklist ? () => setIsEditingChecklist(false) : handleStartEditingChecklist}
                        className={`px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                          isEditingChecklist
                            ? 'bg-amber-500 text-black font-extrabold shadow-md'
                            : 'bg-brand-darker hover:bg-gray-800 border border-gray-700 text-amber-300 hover:text-amber-200'
                        }`}
                      >
                        <Wrench className="w-3.5 h-3.5" />
                        <span>{isEditingChecklist ? 'Cancel Edit' : 'Edit Checklist'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleResetChecklistPhase(previewPhase)}
                        disabled={isResettingPhase}
                        className="px-3 py-1.5 bg-red-950/60 hover:bg-red-900/80 border border-red-500/40 text-red-300 hover:text-white text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        title="Reset submission and delete record to re-allow fresh inspection"
                      >
                        {isResettingPhase ? <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" /> : <Trash2 className="w-3.5 h-3.5 text-red-400" />}
                        <span>Reset</span>
                      </button>

                      <a
                        href={`${BACKEND_URL}/api/public/checklist/pdf?ref=${encodeURIComponent(inquiry.referenceNumber || inquiry.id)}&phase=${previewPhase}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-brand-darker hover:bg-gray-800 border border-gray-700 text-gray-200 hover:text-white text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-brand-orange" />
                        <span>Open PDF</span>
                      </a>
                      <a
                        href={`${BACKEND_URL}/api/public/checklist/pdf?ref=${encodeURIComponent(inquiry.referenceNumber || inquiry.id)}&phase=${previewPhase}`}
                        download={`1625_Autolab_${inquiry.referenceNumber || inquiry.id}_${previewPhase.toUpperCase()}_Checklist.pdf`}
                        className="px-3 py-1.5 bg-brand-orange hover:bg-orange-600 text-white text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition-colors shadow-md flex items-center gap-1.5 cursor-pointer"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                    </div>
                  ) : (
                    <a
                      href={`/checklist?ref=${encodeURIComponent(inquiry.referenceNumber || inquiry.id)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-brand-orange hover:bg-orange-600 text-white text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition-colors shadow-md flex items-center gap-2 cursor-pointer"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Open Public Checklist to Complete</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Main Checklist Preview & Editor Body */}
              {submissionsState[previewPhase] ? (() => {
                const currentSub = submissionsState[previewPhase];
                const currentPayload = currentSub.payload || {};

                return isEditingChecklist && editedPayload ? (
                  /* ── ADMIN INTERACTIVE CHECKLIST EDITOR ────────────── */
                  <div className="bg-brand-dark border border-amber-500/40 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
                    <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                      <div>
                        <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest block">ADMIN OVERRIDE MODE</span>
                        <h2 className="text-lg font-display font-bold text-white uppercase">Editing {previewPhase.toUpperCase()} Inspection Checklist</h2>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSaveChecklistEdit}
                          disabled={isSavingChecklist}
                          className="px-4 py-2 bg-brand-orange hover:bg-orange-600 text-white font-mono text-xs font-bold uppercase tracking-wider rounded-lg shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {isSavingChecklist ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                          <span>Save Changes</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsEditingChecklist(false)}
                          className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-mono text-xs font-bold uppercase rounded-lg cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-brand-darker border border-gray-800 p-4 rounded-xl font-mono text-xs">
                      <div>
                        <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Technician / Installer Name</label>
                        <input
                          type="text"
                          value={editedPayload.installerName || ''}
                          onChange={(e) => setEditedPayload({ ...editedPayload, installerName: e.target.value })}
                          className="w-full bg-brand-dark border border-gray-700 rounded-lg px-3 py-2 text-white font-bold focus:border-brand-orange focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 uppercase font-bold block mb-1">Vehicle Details</label>
                        <input
                          type="text"
                          value={editedPayload.vehicle || ''}
                          onChange={(e) => setEditedPayload({ ...editedPayload, vehicle: e.target.value })}
                          className="w-full bg-brand-dark border border-gray-700 rounded-lg px-3 py-2 text-gray-300 focus:border-brand-orange focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Editable Checklist Items */}
                    {Array.isArray(editedPayload.responses) && (
                      <div className="space-y-4 pt-2">
                        <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 block border-b border-gray-800 pb-2">
                          Edit Inspection Checkmarks &amp; Notes
                        </span>
                        <div className="grid grid-cols-1 gap-3">
                          {editedPayload.responses.map((resp: any, idx: number) => (
                            <div key={idx} className="p-4 bg-brand-darker border border-gray-800 rounded-xl space-y-3">
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-xs font-semibold text-white">{resp.label}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = [...editedPayload.responses];
                                    next[idx].isChecked = !next[idx].isChecked;
                                    setEditedPayload({ ...editedPayload, responses: next });
                                  }}
                                  className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider cursor-pointer border transition-all ${
                                    resp.isChecked
                                      ? 'bg-green-500/20 text-green-400 border-green-500/40'
                                      : 'bg-red-500/20 text-red-400 border-red-500/40'
                                  }`}
                                >
                                  {resp.isChecked ? '✓ Pass' : '✕ Fail / Skip'}
                                </button>
                              </div>
                              <input
                                type="text"
                                placeholder="Technician Notes (optional)..."
                                value={resp.notes || ''}
                                onChange={(e) => {
                                  const next = [...editedPayload.responses];
                                  next[idx].notes = e.target.value;
                                  setEditedPayload({ ...editedPayload, responses: next });
                                }}
                                className="w-full bg-brand-dark border border-gray-800 rounded-lg px-3 py-1.5 text-xs text-amber-300 font-mono focus:border-brand-orange focus:outline-none"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Editable General Notes */}
                    <div className="space-y-2 pt-2">
                      <label className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400 block">General Technician Remarks</label>
                      <textarea
                        rows={3}
                        value={editedPayload.additionalNotes || ''}
                        onChange={(e) => setEditedPayload({ ...editedPayload, additionalNotes: e.target.value })}
                        className="w-full bg-brand-darker border border-gray-800 rounded-xl p-3 text-xs text-white font-mono focus:border-brand-orange focus:outline-none"
                      />
                    </div>
                  </div>
                ) : viewMode === 'visual' ? (
                  /* ── 1. NATIVE REACT VISUAL CHECKLIST PREVIEW ────────────── */
                  <div className="bg-brand-dark border border-gray-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
                    
                    {/* Header Banner */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-5">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 font-mono text-[10px] font-bold text-brand-orange uppercase tracking-widest">
                          <span>1625 AUTOLAB QUALITY CONTROL &amp; INSPECTION REPORT</span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-display font-black text-white uppercase tracking-tight">
                          {previewPhase === 'before' ? 'Pre-Service Inspection (Before Work)' : 'Post-Service Inspection (After Work)'}
                        </h2>
                      </div>

                      <div className="flex items-center gap-2 font-mono text-xs text-gray-400 bg-brand-darker border border-gray-800 px-3 py-1.5 rounded-lg shrink-0">
                        <span>REF:</span>
                        <strong className="text-brand-orange">{inquiry.referenceNumber || inquiry.id}</strong>
                      </div>
                    </div>

                    {/* Customer & Vehicle Info Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-brand-darker border border-gray-800/80 p-4 rounded-xl text-xs font-mono">
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase font-bold block mb-0.5">Customer Name</span>
                        <span className="text-white font-bold">{currentPayload.customerName || inquiry.fullName || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase font-bold block mb-0.5">Vehicle Details</span>
                        <span className="text-gray-200">{currentPayload.vehicle || `${inquiry.make} ${inquiry.model} (${inquiry.year})`}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase font-bold block mb-0.5">Plate Number</span>
                        <span className="text-brand-orange font-bold">{currentPayload.plateNumber || inquiry.plateNumber || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase font-bold block mb-0.5">Installer / Tech</span>
                        <span className="text-white font-bold">{currentSub.installer_name || 'Shop Technician'}</span>
                      </div>
                    </div>

                    {/* Service & Package Spec */}
                    <div className="p-4 bg-gradient-to-r from-[#181818] via-brand-darker to-[#181818] border border-gray-800 rounded-xl space-y-1">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-orange">Service &amp; Package Specification</span>
                      <p className="text-sm font-display font-bold text-white uppercase">
                        {currentPayload.serviceFieldValue || currentSub.service_title || inquiry.productToPurchase || 'Vehicle Service Package'}
                      </p>
                    </div>

                    {/* Inspection Checklist Items Grid */}
                    {Array.isArray(currentPayload.responses) && currentPayload.responses.length > 0 && (
                      <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between font-mono text-xs border-b border-gray-800/80 pb-2">
                          <span className="font-bold uppercase tracking-wider text-gray-300">Inspection Checklist Verification</span>
                          <span className="text-gray-400">
                            Passed: <strong className="text-green-400">{currentPayload.responses.filter((r: any) => r.isChecked).length}</strong> / {currentPayload.responses.length}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {currentPayload.responses.map((resp: any, idx: number) => (
                            <div
                              key={idx}
                              className={`p-3.5 rounded-xl border flex flex-col justify-between space-y-2 transition-all ${
                                resp.isChecked
                                  ? 'bg-brand-darker border-green-500/30 shadow-sm'
                                  : 'bg-brand-darker/50 border-gray-800'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <span className="text-xs font-semibold text-gray-200">
                                  {resp.label}
                                </span>
                                {resp.isChecked ? (
                                  <span className="text-[10px] font-mono font-bold uppercase text-green-400 bg-green-500/10 border border-green-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                                    <CheckCircle2 className="w-3 h-3" /> Pass
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-mono font-bold uppercase text-gray-500 bg-gray-800/80 px-2 py-0.5 rounded-full shrink-0">
                                    Skipped
                                  </span>
                                )}
                              </div>

                              {resp.notes && (
                                <p className="text-[11px] font-mono text-amber-300 bg-amber-950/20 border border-amber-500/20 p-2 rounded-lg">
                                  <strong className="text-amber-400">Note:</strong> {resp.notes}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Post-Service Orientation Checks (if after phase) */}
                    {previewPhase === 'after' && Array.isArray(currentPayload.orientationResponses) && currentPayload.orientationResponses.length > 0 && (
                      <div className="space-y-3 pt-4 border-t border-gray-800">
                        <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-brand-orange">
                          Post-Service Orientation &amp; Customer Walkthrough
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
                          {['Orientation Completed', 'Functions Demonstrated', 'Customer Satisfaction'].map((title, idx) => {
                            const isDone = Boolean(currentPayload.orientationResponses[idx]);
                            return (
                              <div key={idx} className="p-3 bg-brand-darker border border-gray-800 rounded-xl flex items-center justify-between">
                                <span className="text-gray-300">{title}</span>
                                <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${isDone ? 'text-green-400 bg-green-500/10 border border-green-500/30' : 'text-gray-500 bg-gray-800'}`}>
                                  {isDone ? '✓ Verified' : 'Pending'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* General Technician Notes */}
                    {currentSub.general_notes && (
                      <div className="p-4 bg-brand-darker border border-gray-800 rounded-xl space-y-1.5 font-mono text-xs">
                        <span className="text-brand-orange font-bold uppercase text-[10px] tracking-wider block">Technician Final Notes</span>
                        <p className="text-gray-300 leading-relaxed">{currentSub.general_notes}</p>
                      </div>
                    )}

                    {/* Signature Block */}
                    {currentSub.signature_data && (
                      <div className="pt-4 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-6">
                        <div className="space-y-1 text-xs font-mono">
                          <span className="text-gray-400 uppercase font-bold block">Customer Acknowledgment &amp; Approval</span>
                          <p className="text-gray-500 text-[11px] max-w-sm">
                            Inspection verified and acknowledged by customer / representative.
                          </p>
                        </div>

                        <div className="bg-brand-darker border border-gray-800 rounded-xl p-4 text-center space-y-2 w-full sm:w-64">
                          <div className="h-20 flex items-center justify-center bg-black/40 rounded-lg p-2 border border-gray-800/80">
                            <img
                              src={currentSub.signature_data}
                              alt="Customer Signature"
                              className="max-h-full max-w-full object-contain filter drop-shadow-md"
                            />
                          </div>
                          <div className="border-t border-gray-800 pt-1 text-[10px] font-mono text-gray-400 uppercase">
                            Authorized Customer Signature
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                ) : (
                  /* ── 2. EMBEDDED PDF DOCUMENT VIEW ───────────────────────── */
                  <div className="bg-brand-dark border border-gray-800 rounded-xl overflow-hidden shadow-2xl space-y-0">
                    <div className="bg-[#141414] px-4 py-2.5 border-b border-gray-800 flex items-center justify-between text-xs font-mono text-gray-400">
                      <span className="flex items-center gap-2 text-white font-bold uppercase">
                        <FileText className="w-4 h-4 text-brand-orange" />
                        <span>Official PDF Document View — {previewPhase.toUpperCase()} INSPECTION</span>
                      </span>
                      <span className="text-[10px] text-brand-orange font-bold uppercase bg-brand-orange/10 border border-brand-orange/30 px-2 py-0.5 rounded">
                        PDF Engine Render
                      </span>
                    </div>

                    <div className="w-full bg-[#1e1e1e] relative min-h-[650px] sm:min-h-[750px]">
                      <iframe
                        key={`${inquiry.referenceNumber || inquiry.id}-${previewPhase}`}
                        src={`${BACKEND_URL}/api/public/checklist/pdf?ref=${encodeURIComponent(inquiry.referenceNumber || inquiry.id)}&phase=${previewPhase}#toolbar=0&navpanes=0`}
                        title={`Checklist PDF Preview - ${previewPhase}`}
                        className="w-full h-[650px] sm:h-[750px] border-0 rounded-b-xl"
                      />
                    </div>
                  </div>
                );
              })() : (
                /* ── 3. NOT SUBMITTED YET WARNING CARD ───────────────────── */
                <div className="bg-brand-dark border border-gray-800 rounded-xl p-10 text-center space-y-4 shadow-xl font-sans">
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-full w-16 h-16 flex items-center justify-center mx-auto text-amber-400">
                    <AlertTriangle className="w-8 h-8" />
                  </div>
                  <div className="space-y-1 max-w-md mx-auto">
                    <h3 className="text-base font-display font-bold text-white uppercase tracking-wider">
                      {previewPhase === 'before' ? 'Pre-Service Inspection' : 'Post-Service Inspection'} Not Available Yet
                    </h3>
                    <p className="text-xs text-gray-400 leading-relaxed font-mono">
                      No inspection submission was recorded for this inquiry phase yet. The technician or customer can complete the inspection on the shop tablet.
                    </p>
                  </div>

                  <div className="pt-2">
                    <a
                      href={`/checklist?ref=${encodeURIComponent(inquiry.referenceNumber || inquiry.id)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-orange hover:bg-orange-600 text-white text-xs font-mono font-bold uppercase tracking-wider rounded-lg transition-colors shadow-lg cursor-pointer"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Open Public Checklist to Complete</span>
                    </a>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ── Tab Content: Activity Log ─────────────────────────── */}
          {activeTab === 'activity' && (
            <div className="bg-brand-dark border border-gray-800 p-6 rounded-xl shadow-lg space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-brand-orange flex items-center gap-2 border-b border-gray-800 pb-3">
                <Activity className="w-4 h-4" /> Activity History Timeline
              </h2>

              {activityLogs.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-500 font-mono">No activity recorded for this inquiry.</div>
              ) : (() => {
                const reversed = activityLogs.slice().reverse();
                const totalPages = Math.ceil(reversed.length / ACTIVITY_PAGE_SIZE);
                const pageEntries = reversed.slice(activityPage * ACTIVITY_PAGE_SIZE, (activityPage + 1) * ACTIVITY_PAGE_SIZE);
                return (
                  <div className="space-y-6">
                    <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-800">
                      {pageEntries.map((entry) => (
                        <div key={entry.id} className="relative">
                          <span className="absolute -left-[23px] top-1.5 w-2.5 h-2.5 rounded-full bg-brand-orange border-2 border-brand-dark" />
                          <p className="text-[10px] font-mono text-gray-500 mb-0.5">
                            {new Date(entry.createdAt).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </p>
                          <p className="text-xs font-bold text-white uppercase tracking-wide">
                            {entry.action}
                            {entry.actorName && (
                              <span className="text-gray-400 font-normal lowercase tracking-normal ml-1">by {entry.actorName}</span>
                            )}
                          </p>
                          {entry.detail && (
                            <p className="text-xs text-gray-400 mt-1 bg-brand-darker border border-gray-800/80 p-2.5 rounded-lg leading-relaxed">
                              {entry.detail}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>

                    {totalPages > 1 && (
                      <div className="flex items-center justify-between pt-4 border-t border-gray-800 font-mono text-xs">
                        <button
                          type="button"
                          onClick={() => setActivityPage(p => Math.max(0, p - 1))}
                          disabled={activityPage === 0}
                          className="flex items-center gap-1 px-3 py-1.5 border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:border-gray-700 disabled:opacity-30 transition-colors cursor-pointer"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" /> Prev
                        </button>
                        <span className="text-gray-500">
                          Page {activityPage + 1} / {totalPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setActivityPage(p => Math.min(totalPages - 1, p + 1))}
                          disabled={activityPage >= totalPages - 1}
                          className="flex items-center gap-1 px-3 py-1.5 border border-gray-800 rounded-lg text-gray-400 hover:text-white hover:border-gray-700 disabled:opacity-30 transition-colors cursor-pointer"
                        >
                          Next <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

        </div>

        {/* ── 8. Right Column: Workflow Control Panel (4 cols) ──────── */}
        <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-6">
          <div className="bg-brand-dark border border-gray-800 p-6 rounded-xl shadow-xl space-y-6">

            {/* Sidebar Header */}
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-brand-orange flex items-center gap-2">
                <Wrench className="w-4 h-4" /> Workflow Actions
              </h2>
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${STATUS_BADGE_STYLE[inquiry.status] || 'bg-gray-800 text-gray-300'
                }`}>
                {formatStatus(inquiry.status)}
              </span>
            </div>

            {/* 9. Workflow Progress Stepper */}
            <div className="bg-brand-darker border border-gray-800 p-4 rounded-xl space-y-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500 block font-bold">Service Workflow Progress</span>

              <div className="relative">
                {/* Stepper Progress Line */}
                <div className="absolute top-3 left-[10%] right-[10%] h-0.5 bg-gray-800 -z-0" />
                {(() => {
                  const stages = INQUIRY_STAGES;
                  const currentIndex = stages.indexOf(inquiry.status as any);
                  const widthPct = currentIndex > 0 ? (currentIndex / (stages.length - 1)) * 80 : 0;
                  return (
                    <div
                      className="absolute top-3 left-[10%] h-0.5 bg-brand-orange transition-all duration-300 -z-0"
                      style={{ width: `${widthPct}%` }}
                    />
                  );
                })()}

                <div className="grid grid-cols-4 relative z-10">
                  {[
                    { key: 'pending', label: 'Pending' },
                    { key: 'confirmed', label: 'Confirmed' },
                    { key: 'in_progress', label: 'In Progress' },
                    { key: 'completed', label: 'Completed' },
                  ].map((step, idx) => {
                    const stages = INQUIRY_STAGES;
                    const currentIndex = stages.indexOf(inquiry.status as any);
                    const isDone = currentIndex >= idx;
                    const isCurrent = inquiry.status === step.key;

                    return (
                      <div key={step.key} className="flex flex-col items-center text-center">
                        <div className={`w-6 h-6 rounded-full font-mono text-[10px] font-bold flex items-center justify-center transition-all ${isCurrent
                            ? 'bg-brand-orange text-white ring-4 ring-brand-orange/30 shadow-lg scale-110'
                            : isDone
                              ? 'bg-gray-700 text-green-400 border border-green-500/40'
                              : 'bg-gray-800 text-gray-500 border border-gray-700'
                          }`}>
                          {isDone ? '✓' : idx + 1}
                        </div>
                        <span className={`text-[8px] font-mono uppercase tracking-wider mt-2 ${isCurrent ? 'text-brand-orange font-bold' : isDone ? 'text-gray-300' : 'text-gray-600'
                          }`}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 10. Next Action Card */}
            <div className="space-y-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500 block font-bold">Recommended Next Action</span>

              {inquiry.status === 'pending' && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 space-y-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-green-400">Confirm Appointment</h3>
                    <p className="text-xs text-gray-300 mt-1">Review and confirm the customer's scheduled appointment date and time.</p>
                  </div>
                  <button
                    onClick={() => requestConfirmation(
                      {
                        title: 'Confirm Appointment?',
                        message: 'Are you sure you want to confirm this appointment schedule?',
                        confirmLabel: 'Confirm Appointment',
                      },
                      () => handleStatusChange('confirmed')
                    )}
                    disabled={statusLoading}
                    className="w-full py-3 bg-green-600 hover:bg-green-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {statusLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Confirm Appointment
                  </button>
                </div>
              )}

              {inquiry.status === 'confirmed' && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 space-y-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-blue-400">Start Service</h3>
                    <p className="text-xs text-gray-300 mt-1">The customer has arrived and the service can begin.</p>
                  </div>
                  <button
                    onClick={() => requestConfirmation(
                      {
                        title: 'Start Service?',
                        message: 'Set inquiry status to In Progress to begin work on the vehicle.',
                        confirmLabel: 'Start Service',
                      },
                      () => handleStatusChange('in_progress')
                    )}
                    disabled={statusLoading}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {statusLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
                    Start Service
                  </button>
                </div>
              )}

              {inquiry.status === 'in_progress' && (
                <div className="bg-brand-orange/10 border border-brand-orange/30 rounded-xl p-4 space-y-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-brand-orange">Service In Progress</h3>
                    <p className="text-xs text-gray-300 mt-1">Installation or service work is currently in progress.</p>
                  </div>

                  <button
                    onClick={() => requestConfirmation(
                      {
                        title: 'Complete Service?',
                        message: 'Are you sure you want to mark this service as completed?',
                        confirmLabel: 'Mark Completed',
                      },
                      async () => {
                        await handleStatusChange('completed');
                      }
                    )}
                    disabled={statusLoading}
                    className="w-full py-2.5 px-3 bg-green-600 hover:bg-green-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {statusLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BadgeCheck className="w-3.5 h-3.5" />}
                    Mark Done
                  </button>
                </div>
              )}

              {inquiry.status === 'completed' && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Service Completed</h3>
                  <p className="text-xs text-gray-300">Service has been successfully completed.</p>
                </div>
              )}

              {inquiry.status === 'cancelled' && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-3">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-red-400">Service Cancelled</h3>
                    <p className="text-xs text-gray-300 mt-1">This inquiry service has been cancelled.</p>
                  </div>
                  <button
                    onClick={() => requestConfirmation(
                      {
                        title: 'Re-open Service?',
                        message: 'Re-open this service back to pending status.',
                        confirmLabel: 'Re-open Service',
                      },
                      () => handleStatusChange('pending')
                    )}
                    disabled={statusLoading}
                    className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {statusLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Re-open Service
                  </button>
                </div>
              )}
            </div>

            {/* Other Actions Dropdown & Delete */}
            <div className="pt-4 border-t border-gray-800 space-y-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500 block font-bold">More Actions</span>

              {/* Status Dropdown */}
              <div ref={statusDropdownRef} className="relative">
                <button
                  onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                  disabled={statusLoading}
                  className="w-full flex items-center justify-between bg-brand-darker border border-gray-800 hover:border-brand-orange/50 rounded-lg p-3 text-xs font-bold uppercase tracking-wider text-white transition-all disabled:opacity-50 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-brand-orange" /> Change Status
                  </span>
                  {statusLoading ? (
                    <Loader2 className="w-4 h-4 text-brand-orange animate-spin" />
                  ) : (
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
                  )}
                </button>

                {isStatusDropdownOpen && (
                  <div className="absolute bottom-full mb-2 inset-x-0 bg-brand-dark border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                    {[...INQUIRY_STAGES, 'cancelled'].map((s) => {
                      if (s === inquiry.status) return null;
                      return (
                        <button
                          key={s}
                          onClick={() => {
                            setIsStatusDropdownOpen(false);
                            requestConfirmation(
                              {
                                title: 'Update Status?',
                                message: `Change inquiry status to ${formatStatus(s as any)}?`,
                                confirmLabel: 'Update Status',
                                tone: s === 'cancelled' ? 'danger' : 'default',
                              },
                              () => handleStatusChange(s)
                            );
                          }}
                          className="w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-b border-gray-800/80 last:border-0 flex items-center justify-between hover:bg-brand-darker hover:text-brand-orange cursor-pointer text-gray-300"
                        >
                          <span>{formatStatus(s as any)}</span>
                          <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Cancel Button */}
              {inquiry.status !== 'cancelled' && inquiry.status !== 'completed' && (
                <button
                  onClick={() => requestConfirmation(
                    {
                      title: 'Cancel Inquiry?',
                      message: 'Irreversible status change to cancelled.',
                      confirmLabel: 'Cancel Inquiry',
                      tone: 'danger',
                    },
                    () => handleStatusChange('cancelled')
                  )}
                  disabled={statusLoading}
                  className="w-full flex justify-between items-center px-4 py-3 bg-brand-darker border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-bold uppercase tracking-wider rounded-lg transition-all disabled:opacity-40 cursor-pointer"
                >
                  <span>Cancel Inquiry</span>
                  <XCircle className="w-4 h-4 opacity-60" />
                </button>
              )}

              {/* Delete Inquiry Button */}
              <button
                onClick={() => requestConfirmation(
                  {
                    title: 'Delete Inquiry?',
                    message: 'This permanently deletes the inquiry record and cannot be undone.',
                    confirmLabel: 'Delete Inquiry',
                    tone: 'danger',
                  },
                  handleDelete
                )}
                disabled={isDeleting}
                className="w-full flex justify-between items-center px-4 py-3 bg-transparent border border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs font-bold uppercase tracking-wider rounded-lg transition-all disabled:opacity-40 cursor-pointer"
              >
                <span>{isDeleting ? 'Deleting…' : 'Delete Record'}</span>
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 opacity-60" />}
              </button>
            </div>

          </div>
        </div>

      </div>

      {/* ── 15. Action Confirmation Modal ──────────────────────────── */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-xl border border-gray-700 bg-brand-dark p-6 shadow-2xl space-y-4">
            <h3 className={`text-xs font-mono font-bold uppercase tracking-widest border-b border-gray-800 pb-2 ${confirmDialog.tone === 'danger' ? 'text-red-400' : 'text-brand-orange'
              }`}>
              Confirm Action
            </h3>
            <div>
              <p className="text-base font-bold text-white uppercase tracking-wide">{confirmDialog.title}</p>
              <p className="text-xs text-gray-300 mt-1 leading-relaxed">{confirmDialog.message}</p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeConfirmation}
                disabled={confirmBusy}
                className="px-4 py-2 rounded-lg border border-gray-800 text-xs font-bold uppercase tracking-wider text-gray-400 hover:border-gray-700 hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void runConfirmedAction()}
                disabled={confirmBusy}
                className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-white disabled:opacity-40 transition-colors shadow-md cursor-pointer ${confirmDialog.tone === 'danger' ? 'bg-red-600 hover:bg-red-500' : 'bg-brand-orange hover:bg-orange-600'
                  }`}
              >
                {confirmBusy ? 'Executing…' : confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 16. Edit Inquiry Modal ───────────────────────────────────── */}
      {isEditInquiryModalOpen && inquiry && (
        <EditInquiryModal
          isOpen={isEditInquiryModalOpen}
          inquiry={inquiry}
          services={services}
          onClose={() => setIsEditInquiryModalOpen(false)}
          onSaveSuccess={(updatedInquiry) => {
            setInquiry(updatedInquiry);
            if (token) {
              fetchInquiryActivityApi(token, String(id)).then((activitiesRes) => {
                setActivityLogs((activitiesRes as InquiryActivityLog[]) || []);
              });
            }
          }}
        />
      )}

    </div>
  );
}