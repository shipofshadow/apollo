import { useEffect, useState, useRef } from 'react';
import {
  ArrowLeft, CheckCircle2, Clock,
  Trash2, AlertTriangle, User, Car, Activity,
  ChevronLeft, ChevronRight, ChevronDown, Calendar, ClipboardList,
  StickyNote, FileText, Save, X, Send, Wrench, RefreshCw, Loader2, BadgeCheck, XCircle, Lock
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
  generateInquiryChecklistPdfApi,
  fetchShopHoursApi,
  fetchShopClosedDatesApi,
  fetchInquiryChecklistsApi,
  sendInquiryChecklistPhaseApi
} from '../../services/api';
import type { ShopDayHours, Inquiry, Service } from '../../types';
import { INQUIRY_STAGES } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatStatus } from '../../utils/formatStatus';
import InquiryChecklistModal from './InquiryChecklistModal';

function buildDateList(shopHours: ShopDayHours[], closedDatesSet: Set<string>): Date[] {
  const openDays = shopHours.length
    ? new Set(shopHours.filter(h => h.isOpen).map(h => h.dayOfWeek))
    : new Set([1, 2, 3, 4, 5, 6]);
  const dates: Date[] = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() + 1);
  while (dates.length < 30) {
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
    Promise.all([fetchShopHoursApi(), fetchShopClosedDatesApi()])
      .then(([{ hours }, cdData]) => {
        setShopHours(hours);
        const cd = (cdData as { closedDates: { date: string }[] }).closedDates ?? [];
        setClosedDatesSet(new Set(cd.map(d => d.date)));
      })
      .catch(() => { });
  }, []);

  const availableDates = buildDateList(shopHours, closedDatesSet);

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
    <div className="space-y-5 bg-[#121212] border border-gray-800 p-5 rounded mt-4">
      {/* Target Date Carousel */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-orange mb-3">Target Date</p>
        <div className="relative">
          <button
            type="button"
            onClick={() => scrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-[#151515] border border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:border-brand-orange -translate-x-3 transition-colors"
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
                  className={`snap-start shrink-0 w-20 p-3 border text-center transition-all rounded relative ${active
                    ? 'border-brand-orange bg-brand-orange/10'
                    : 'border-gray-800 hover:border-gray-600 bg-[#181818]'
                    }`}
                >
                  <div className="text-[10px] text-gray-500 uppercase font-mono mb-1">
                    {date.toLocaleDateString('en-PH', { weekday: 'short', timeZone: 'Asia/Manila' })}
                  </div>
                  <div className="text-xl font-bold text-white">{date.getDate()}</div>
                  <div className="text-[10px] text-gray-500 uppercase font-mono mt-1">
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
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-[#151515] border border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:border-brand-orange translate-x-3 transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {selectedDate && (
          <p className="text-[10px] font-mono uppercase tracking-widest text-brand-orange mt-3">
            Selection: {selectedDate.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' })}
          </p>
        )}
      </div>

      {/* Target Time Slots */}
      {selectedDate && (
        <div className="pt-4 border-t border-gray-800/50">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-orange mb-3 flex items-center gap-2">
            Target Time
            {slotsLoading && (
              <span className="text-gray-500 font-mono flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Polling...
              </span>
            )}
          </p>
          {!slotsLoading && !shopDayIsOpen && (
            <p className="text-xs text-red-400 font-mono bg-red-500/10 border border-red-500/20 px-4 py-3 rounded">
              [SYSTEM] Shop closed on selected date.
            </p>
          )}
          {!slotsLoading && shopDayIsOpen && openSlots.length === 0 && (
            <p className="text-xs text-gray-500 font-mono py-2">[SYSTEM] Zero capacity for selected date.</p>
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
                    className={`flex flex-col items-center justify-center p-3 rounded border font-mono transition-all ${isSelected
                      ? 'bg-brand-orange/20 border-brand-orange text-brand-orange shadow-[inset_0_0_10px_rgba(249,115,22,0.2)]'
                      : 'bg-[#181818] border-gray-800 text-gray-300 hover:border-gray-500 hover:text-white'
                      }`}
                  >
                    <span className="text-sm font-bold">{slot}</span>
                    {spotsLeft > 0 && (
                      <span className={`text-[9px] uppercase tracking-wider mt-1.5 ${isSelected ? 'text-brand-orange' : almostFull ? 'text-yellow-500' : 'text-gray-600'
                        }`}>
                        {almostFull ? 'Critical' : `CAP: ${spotsLeft}`}
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
          className="flex-1 flex items-center justify-center gap-2 bg-brand-orange text-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {saveBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Execute Reschedule
        </button>
        <button
          onClick={onCancel}
          disabled={saveBusy}
          className="px-5 py-2.5 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 text-xs font-bold uppercase tracking-widest transition-colors rounded disabled:opacity-30"
        >
          Abort
        </button>
      </div>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  'pending': 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
  'confirmed': 'bg-blue-500/10 text-blue-400 border border-blue-500/30',
  'in_progress': 'bg-brand-orange/10 text-brand-orange border border-brand-orange/30',
  'completed': 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
  'cancelled': 'bg-red-500/10 text-red-400 border border-red-500/30',
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
}

type ConfirmDialogState = {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: 'default' | 'danger';
};

export default function AdminInquiryDetail({ inquiryId, onBack }: Props) {
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

  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editNotes, setEditNotes] = useState('');
  const [notesLoading, setNotesLoading] = useState(false);

  // Checklists
  const [checklistsState, setChecklistsState] = useState<{ before?: any; after?: any }>({});
  const [activeChecklistPhase, setActiveChecklistPhase] = useState<'before' | 'after' | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [sendPdfLoading, setSendPdfLoading] = useState<string | null>(null);

  const isAfterSubmitted = Boolean(checklistsState.after?.submittedAt);
  const isAfterSent = Boolean(checklistsState.after?.sentAt);
  const isStatusLocked = inquiry?.status === 'completed' && isAfterSubmitted;

  // Activity log pagination
  const ACTIVITY_PAGE_SIZE = 3;
  const [activityPage, setActivityPage] = useState(0);

  const blobUrlsRef = useRef<string[]>([]);
  useEffect(() => {
    return () => blobUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
  }, []);

  const id = inquiryId.replace('inq-', '');

  const handlePreviewPdf = async (phase: string = 'after') => {
    if (!token || !inquiry) return;
    setPreviewLoading(phase);
    try {
      const blob = await generateInquiryChecklistPdfApi(token, inquiry.id.replace('inq-', ''), phase);
      const url = URL.createObjectURL(blob);
      blobUrlsRef.current.push(url);
      window.open(url, '_blank');
    } catch (err: any) {
      console.error(err);
      showToast('Failed to generate PDF: ' + err.message, 'error');
    } finally {
      setPreviewLoading(null);
    }
  };

  const handleSendPdf = async (phase: string = 'after') => {
    if (!token || !inquiry) return;
    setSendPdfLoading(phase);
    try {
      await sendInquiryChecklistPhaseApi(token, inquiry.id.replace('inq-', ''), phase);
      showToast(`Inspection report PDF sent to client & shop owners.`, 'success');
      await loadChecklistsState(); // reload to get sentAt
      const activitiesRes = await fetchInquiryActivityApi(token, String(id));
      setActivityLogs((activitiesRes as InquiryActivityLog[]) || []);
    } catch (err: any) {
      showToast('Failed to send PDF: ' + err.message, 'error');
    } finally {
      setSendPdfLoading(null);
    }
  };

  const lastNoteUpdate = activityLogs.slice().reverse().find(log => log.eventType === 'inquiry_internal_notes_updated');

  const loadChecklistsState = async () => {
    if (!token || !id) return;
    try {
      const res = await fetchInquiryChecklistsApi(token, String(id));
      setChecklistsState(res || {});
    } catch (err) {
      console.error('Failed to load checklists state', err);
    }
  };

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
      await loadChecklistsState();
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
      showToast('Status updated.', 'success');
      // Refresh activities
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
      showToast('Internal notes updated.', 'success');
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
          confirmLabel: 'Confirm',
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
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-brand-orange">
          <Clock className="w-8 h-8 animate-spin" />
          <p className="text-sm font-semibold uppercase tracking-widest">Loading Inquiry Details...</p>
        </div>
      </div>
    );
  }

  if (error || !inquiry) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-red-400 bg-red-500/10 px-8 py-6 rounded-lg border border-red-500/20 text-center shadow-lg">
          <AlertTriangle className="w-10 h-10" />
          <p className="text-sm font-semibold">{error || 'Inquiry not found'}</p>
          <button onClick={onBack} className="mt-4 text-xs font-bold uppercase tracking-widest underline hover:text-white transition-colors">Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-8">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-gray-500 hover:text-brand-orange text-[10px] font-mono uppercase tracking-widest transition-colors w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Return to Appointments
        </button>

        <div className="relative border border-gray-800/80 rounded-lg bg-[#121212] overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-orange via-brand-orange/50 to-transparent" />

          <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-4">
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-brand-orange/80">
                  Inquiry Details
                </p>
                <span className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest rounded border ${STATUS_STYLES[inquiry.status] || 'bg-gray-800 text-gray-300'}`}>
                  {formatStatus(inquiry.status as any)}
                </span>
              </div>

              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight flex items-center gap-3">
                Inquiry <span className="text-gray-500/50 text-2xl">#{inquiry.id.substring(0, 8)}</span>
              </h1>

              <div className="flex items-center gap-3 pt-2 text-xs font-mono">
                <span className="text-gray-500 bg-[#181818] px-2.5 py-1 rounded border border-gray-800">
                  Submitted by {inquiry.fullName}
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end">
              <button
                onClick={() => handlePreviewPdf('after')}
                disabled={previewLoading === 'after'}
                className="flex items-center gap-2 px-5 py-2.5 rounded-sm font-bold uppercase tracking-widest text-xs border border-brand-orange/40 text-brand-orange hover:bg-brand-orange hover:text-white transition-all shadow-lg shadow-brand-orange/10 disabled:opacity-50 cursor-pointer"
              >
                {previewLoading === 'after' ? <Clock className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Preview Installation Checklist
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Tabbed Content */}
        <div className="lg:col-span-8 space-y-6">

          {/* Tab Navigation */}
          <div className="bg-[#121212] border border-gray-800/80 rounded-lg p-2 flex overflow-x-auto hide-scrollbar shadow-xl">
            {[
              { id: 'overview', label: 'Overview', icon: <FileText className="w-4 h-4" /> },
              { id: 'checklists', label: 'Checklists', icon: <ClipboardList className="w-4 h-4" /> },
              { id: 'notes', label: 'Internal Notes', icon: <StickyNote className="w-4 h-4" /> },
              { id: 'activity', label: 'Activity Log', icon: <Activity className="w-4 h-4" />, badge: activityLogs.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-5 py-3 rounded-md text-xs font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id
                  ? 'bg-brand-orange text-white shadow-md'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                  }`}
              >
                {tab.icon}
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`ml-1 px-1.5 py-0.5 rounded text-[9px] font-black leading-none ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-gray-800 text-gray-400'}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-8">
              {/* Inquiry Details (Client + Vehicle) */}
              <div className="bg-[#121212] border border-gray-800/80 p-8 rounded-lg relative overflow-hidden shadow-xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">

                  {/* Client Column */}
                  <div>
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-gray-800/80 pb-4">
                      <User className="w-4 h-4 text-brand-orange" /> Client Details
                    </h3>
                    <div className="space-y-5">
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Full Name</p>
                        <p className="text-white font-medium text-sm">{inquiry.fullName}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Email Address</p>
                        <p className="text-white font-medium text-sm">{inquiry.emailAddress || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Contact Number</p>
                        <p className="text-white font-medium text-sm">{inquiry.contactNumber || 'N/A'}</p>
                      </div>
                      {inquiry.facebookName && (
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Facebook Name</p>
                          <p className="text-white font-medium text-sm">{inquiry.facebookName}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Vehicle Column */}
                  <div>
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-gray-800/80 pb-4">
                      <Car className="w-4 h-4 text-brand-orange" /> Vehicle Info
                    </h3>
                    <div className="space-y-5">
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Make & Model</p>
                        <p className="text-white font-medium text-sm">{inquiry.make} {inquiry.model} {inquiry.year || ''}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Plate Number</p>
                        <p className="text-white font-medium text-sm uppercase">{inquiry.plateNumber || 'N/A'}</p>
                      </div>
                      <div className="bg-brand-orange/5 border border-brand-orange/20 rounded p-4 mt-2">
                        <p className="text-[10px] text-brand-orange/80 uppercase tracking-widest font-mono mb-1">Product / Service</p>
                        <p className="text-brand-orange font-bold text-sm leading-relaxed">{inquiry.productToPurchase || 'Service inquiry'}</p>
                      </div>
                    </div>
                  </div>

                </div>
              </div>


              <div className="bg-[#121212] border border-gray-800/80 p-6 rounded-lg shadow-xl relative overflow-hidden">
                <h3 className="text-[10px] font-bold text-brand-orange uppercase tracking-widest mb-6 flex items-center justify-between border-b border-gray-800/80 pb-4">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Appointment Schedule
                  </div>
                  {!isEditingSchedule && inquiry.status !== 'completed' && inquiry.status !== 'cancelled' && (
                    <button
                      onClick={() => setIsEditingSchedule(true)}
                      className="text-[10px] font-bold uppercase tracking-widest text-brand-orange hover:text-orange-400 transition-colors flex items-center gap-1"
                    >
                      <Calendar className="w-3 h-3" /> Reschedule
                    </button>
                  )}
                </h3>

                {!isEditingSchedule ? (
                  <div className="space-y-3">
                    <div className="bg-[#181818] border border-gray-800 rounded p-4 flex justify-between items-center">
                      <span className="text-xs text-gray-500 font-mono">Target Date</span>
                      <span className="text-sm font-bold text-gray-200">
                        {inquiry.appointmentDate
                          ? new Date(inquiry.appointmentDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
                          : 'Not Scheduled'}
                      </span>
                    </div>
                    <div className="bg-[#181818] border border-gray-800 rounded p-4 flex justify-between items-center">
                      <span className="text-xs text-gray-500 font-mono">Target Time</span>
                      <span className="text-sm font-bold text-brand-orange">
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

          {activeTab === 'checklists' && (
            <div className="space-y-8">


              {/* Linked Service Section */}
              <div className="bg-[#121212] border border-gray-800/80 p-6 lg:p-8 rounded-lg shadow-xl relative overflow-hidden">
                <div className="flex items-center justify-between border-b border-gray-800/80 pb-4 mb-4">
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-brand-orange" /> Linked Service & Checklist Template
                  </h3>
                  {inquiry.serviceId ? (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-brand-orange/10 border border-brand-orange/30 text-brand-orange px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3" /> Inquiry Linked
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                      <AlertTriangle className="w-3 h-3" /> Unlinked Inquiry
                    </span>
                  )}
                </div>

                {inquiry.serviceId && !isChangingService ? (
                  /* Summary Card for Inquiry with Linked Service */
                  (() => {
                    const linkedSvc = services.find(s => s.id === inquiry.serviceId);
                    return (
                      <div className="bg-[#151515] border border-brand-orange/40 rounded-lg p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                          <div className="p-3.5 rounded-lg bg-brand-orange/20 border border-brand-orange/30 text-brand-orange shrink-0">
                            <Wrench className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="text-base font-bold text-white uppercase tracking-wider mt-0.5">
                              {linkedSvc ? linkedSvc.title : `Service #${inquiry.serviceId}`}
                            </h4>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => setIsChangingService(true)}
                          className="px-4 py-2 border border-gray-700 hover:border-brand-orange text-gray-300 hover:text-brand-orange text-xs font-bold uppercase tracking-widest rounded transition-colors cursor-pointer"
                        >
                          Change Checklist
                        </button>
                      </div>
                    );
                  })()
                ) : (
                  /* Full Service Selector Grid for Old Inquiries or when Changing Service */
                  <div>
                    <p className="text-xs text-gray-400 mb-4">
                      {!inquiry.serviceId
                        ? 'This inquiry has no linked service template yet. Select a service below to enable installation checklists:'
                        : 'Select a service below to update the active checklist template:'}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                            className={`relative flex flex-col justify-between p-4 rounded-lg border text-left transition-all duration-300 group cursor-pointer ${isSelected
                              ? 'border-brand-orange bg-brand-orange/10 shadow-[0_0_20px_rgba(249,115,22,0.15)] ring-1 ring-brand-orange/40'
                              : 'border-gray-800 bg-[#151515] hover:border-gray-600 hover:bg-[#1a1a1a]'
                              }`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-3">
                                <div className={`p-2.5 rounded-md ${isSelected ? 'bg-brand-orange text-white' : 'bg-gray-800/80 text-gray-400 group-hover:text-white group-hover:bg-gray-700'} transition-colors`}>
                                  <Wrench className="w-4 h-4" />
                                </div>
                                {isSelected && (
                                  <CheckCircle2 className="w-4 h-4 text-brand-orange animate-in zoom-in duration-200" />
                                )}
                              </div>
                              <h4 className={`text-xs font-bold uppercase tracking-wider mb-1 ${isSelected ? 'text-brand-orange' : 'text-white'}`}>
                                {s.title}
                              </h4>
                              {s.startingPrice && (
                                <p className="text-[10px] font-mono text-gray-400 mb-2">From {s.startingPrice}</p>
                              )}
                            </div>

                            <div className="mt-3 pt-2 border-t border-gray-800/60 flex items-center justify-between text-[10px]">
                              <span className={`font-mono uppercase ${isSelected ? 'text-brand-orange font-bold' : 'text-gray-500'}`}>
                                {isSelected ? 'Active Service' : 'Select'}
                              </span>
                              {s.variations?.length ? (
                                <span className="text-gray-600 font-mono">{s.variations.length} Options</span>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {isChangingService && inquiry.serviceId && (
                      <div className="mt-3 text-right">
                        <button
                          type="button"
                          onClick={() => setIsChangingService(false)}
                          className="text-xs text-gray-500 hover:text-gray-300 font-mono uppercase underline cursor-pointer"
                        >
                          Cancel Service Change
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {servicesLoading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 backdrop-blur-xs rounded-lg">
                    <div className="flex items-center gap-3 bg-[#121212] px-6 py-3.5 rounded-full border border-gray-800 shadow-2xl">
                      <Loader2 className="w-4 h-4 animate-spin text-brand-orange" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-brand-orange">Updating Linked Service...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Checklists Section */}
              {inquiry.serviceId && (
                <div className="bg-[#121212] border border-gray-800/80 p-8 rounded-lg shadow-xl relative overflow-hidden">
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2 mb-6 pb-4 border-b border-gray-800/80">
                    <ClipboardList className="w-4 h-4 text-brand-orange" /> Installation Checklists
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Before Checklist Card */}
                    <div className="bg-brand-dark border border-gray-800 rounded p-5 flex flex-col relative">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-bold text-white uppercase tracking-widest">Before Installation</h4>
                      </div>
                      <p className="text-xs text-gray-500 mb-6 flex-1">Pre-installation inspection checklist to verify vehicle condition before work begins.</p>

                      {['pending', 'confirmed'].includes(inquiry.status) ? (
                        <div className="flex items-center justify-center p-3 border border-dashed border-gray-700 rounded bg-black/20 text-xs text-gray-500 text-center">
                          Locked. Unlocks when status is In Progress.
                        </div>
                      ) : (
                        <button
                          onClick={() => setActiveChecklistPhase('before')}
                          className="w-full py-2.5 bg-brand-orange hover:bg-orange-600 text-white text-xs font-bold uppercase tracking-widest rounded transition-colors cursor-pointer"
                        >
                          Before Installation Checklist
                        </button>
                      )}
                    </div>

                    {/* After Checklist Card */}
                    <div className="bg-brand-dark border border-gray-800 rounded p-5 flex flex-col relative">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-bold text-white uppercase tracking-widest">After Installation</h4>
                      </div>
                      <p className="text-xs text-gray-500 mb-6 flex-1">Post-installation quality check and customer orientation to verify functionality.</p>

                      {inquiry.status !== 'completed' ? (
                        <div className="flex items-center justify-center p-3 border border-dashed border-gray-700 rounded bg-black/20 text-xs text-gray-500 text-center">
                          Locked. Unlocks when status is Completed.
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setActiveChecklistPhase('after')}
                            className="flex-1 py-2.5 bg-brand-orange hover:bg-orange-600 text-white text-xs font-bold uppercase tracking-widest rounded transition-colors cursor-pointer"
                          >
                            After Installation Checklist
                          </button>

                        </div>
                      )}
                    </div>

                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'notes' && (
            <div className="space-y-8">
              {/* Internal Notes Section */}
              <div className="bg-[#121212] border border-gray-800/80 p-8 rounded-lg shadow-xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-800/80">
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                    <StickyNote className="w-4 h-4 text-brand-orange" /> Internal Notes
                  </h3>
                  {!isEditingNotes && (
                    <button
                      onClick={() => {
                        setEditNotes(inquiry.internalNotes || '');
                        setIsEditingNotes(true);
                      }}
                      className="text-[10px] font-bold uppercase tracking-widest text-brand-orange hover:text-white transition-colors"
                    >
                      Edit Notes
                    </button>
                  )}
                </div>

                {isEditingNotes ? (
                  <div className="space-y-4">
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Add internal notes about this inquiry..."
                      className="w-full bg-black/40 border border-gray-700 rounded-sm p-4 text-sm text-white placeholder-gray-600 focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none min-h-[120px] resize-y"
                    />
                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={() => setIsEditingNotes(false)}
                        className="px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-widest border border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors flex items-center gap-2"
                      >
                        <X className="w-3.5 h-3.5" /> Cancel
                      </button>
                      <button
                        onClick={handleNotesSave}
                        disabled={notesLoading}
                        className="px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-widest bg-brand-orange text-white hover:bg-orange-600 transition-colors shadow-lg shadow-brand-orange/20 flex items-center gap-2 disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" /> {notesLoading ? 'Saving...' : 'Save Notes'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-black/20 rounded p-5 border border-gray-800/50 min-h-[80px] flex flex-col justify-between">
                    {inquiry.internalNotes ? (
                      <>
                        <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap mb-4">{inquiry.internalNotes}</p>
                        {lastNoteUpdate && (
                          <p className="text-[10px] text-gray-500 font-mono text-right mt-2 border-t border-gray-800/50 pt-2">
                            Last updated by <span className="text-gray-400 font-bold">{lastNoteUpdate.actorName || 'System'}</span> on {new Date(lastNoteUpdate.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })}
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-4 text-gray-600 gap-2">
                        <FileText className="w-6 h-6 opacity-30" />
                        <p className="text-[10px] uppercase tracking-widest font-bold">No internal notes</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-8">
              {/* Activity Timeline */}
              <div className="bg-[#121212] border border-gray-800/80 rounded-lg p-8 shadow-xl">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-6 flex items-center gap-2 border-b border-gray-800/80 pb-4">
                  <Activity className="w-4 h-4 text-brand-orange" /> Activity Log
                </p>
                {activityLogs.length === 0 ? (
                  <p className="text-gray-600 text-xs font-mono text-center py-4">No activity recorded.</p>
                ) : (() => {
                  const reversed = activityLogs.slice().reverse();
                  const totalPages = Math.ceil(reversed.length / ACTIVITY_PAGE_SIZE);
                  const pageEntries = reversed.slice(activityPage * ACTIVITY_PAGE_SIZE, (activityPage + 1) * ACTIVITY_PAGE_SIZE);
                  return (
                    <>
                      <div className="space-y-5 font-mono">
                        {pageEntries.map((entry) => (
                          <div key={entry.id} className="border-b border-gray-800/40 pb-4 last:border-0 last:pb-0">
                            <p className="text-[10px] text-brand-orange mb-1.5">
                              {new Date(entry.createdAt).toLocaleString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </p>
                            <p className="text-xs text-gray-300 uppercase font-bold tracking-wide">
                              {entry.action}
                              {entry.actorName && (
                                <span className="text-gray-500 font-normal lowercase tracking-normal ml-1"> by {entry.actorName}</span>
                              )}
                            </p>
                            {entry.detail && (
                              <p className="text-[11px] text-gray-500 mt-2 pl-3 border-l-2 border-gray-700 leading-relaxed">{entry.detail}</p>
                            )}
                          </div>
                        ))}
                      </div>
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-800">
                          <button
                            onClick={() => setActivityPage(p => Math.max(0, p - 1))}
                            disabled={activityPage === 0}
                            className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-gray-700 rounded text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 transition-colors"
                          >
                            <ChevronLeft className="w-3 h-3" /> Prev
                          </button>
                          <span className="text-[10px] font-mono text-gray-500">
                            Page {activityPage + 1} / {totalPages}
                          </span>
                          <button
                            onClick={() => setActivityPage(p => Math.min(totalPages - 1, p + 1))}
                            disabled={activityPage >= totalPages - 1}
                            className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border border-gray-700 rounded text-gray-400 hover:text-white hover:border-gray-500 disabled:opacity-30 transition-colors"
                          >
                            Next <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

            </div>
          )}
        </div>

        {/* Right Column: Schedule & Status Actions Workflow */}
        <div className="lg:col-span-4 space-y-8 lg:sticky lg:top-6 self-start">
          {/* Status Workflow & Actions */}
          <div className="bg-[#121212] border border-gray-800/80 rounded-lg p-6 shadow-xl relative overflow-hidden space-y-6">
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-orange flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-brand-orange" /> Actions
              </p>
              <span className={`text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${STATUS_STYLES[inquiry.status] || 'bg-gray-800 text-gray-300'}`}>
                {formatStatus(inquiry.status)}
              </span>
            </div>

            {/* Visual Workflow Stepper Bar */}
            <div className="bg-[#161616] border border-gray-800 p-4 rounded-lg">

              <div className="relative">
                {/* Connecting Line */}
                <div className="absolute top-3 left-[12%] right-[12%] h-0.5 bg-gray-800 z-0" />

                {/* Progress Fill */}
                {(() => {
                  const stages = INQUIRY_STAGES;
                  const currentIndex = stages.indexOf(inquiry.status as any);
                  const widthPct = currentIndex > 0 ? (currentIndex / (stages.length - 1)) * 76 : 0;
                  return (
                    <div
                      className="absolute top-3 left-[12%] h-0.5 bg-gradient-to-r from-amber-500 via-brand-orange to-emerald-500 z-0 transition-all duration-500"
                      style={{ width: `${widthPct}%` }}
                    />
                  );
                })()}

                {/* Grid Steps */}
                <div className="grid grid-cols-4 relative z-10">
                  {[
                    { key: 'pending', label: 'Pending', activeColor: 'bg-amber-500 text-black ring-amber-500/30' },
                    { key: 'confirmed', label: 'Confirmed', activeColor: 'bg-blue-500 text-white ring-blue-500/30' },
                    { key: 'in_progress', label: 'In Progress', activeColor: 'bg-brand-orange text-white ring-brand-orange/30' },
                    { key: 'completed', label: 'Completed', activeColor: 'bg-emerald-500 text-white ring-emerald-500/30' },
                  ].map((step, idx) => {
                    const stages = INQUIRY_STAGES;
                    const currentIndex = stages.indexOf(inquiry.status as any);
                    const isDone = currentIndex >= idx;
                    const isCurrent = inquiry.status === step.key;

                    return (
                      <div key={step.key} className="flex flex-col items-center text-center">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${isCurrent
                          ? `${step.activeColor} ring-4 scale-110 shadow-lg font-black`
                          : isDone
                            ? 'bg-gray-700 text-green-400 border border-green-500/50'
                            : 'bg-[#222] text-gray-600 border border-gray-800'
                          }`}>
                          {isDone ? '✓' : idx + 1}
                        </div>
                        <span className={`text-[9px] font-mono uppercase tracking-wider mt-2.5 whitespace-nowrap ${isCurrent ? 'text-white font-bold' : isDone ? 'text-gray-300' : 'text-gray-600'
                          }`}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Recommended Next Action / Primary Execution Card */}
            <div className="space-y-3">
              <p className="text-[9px] font-mono uppercase tracking-widest text-gray-500">Next Step</p>

              {inquiry.status === 'pending' && (
                <div className="bg-green-500/5 border border-green-500/30 rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-green-400">Confirm Appointment</h4>
                      <p className="text-[11px] text-gray-400 mt-1">Confirm the customer's appointment date and time.</p>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                  </div>
                  <button
                    onClick={() => requestConfirmation(
                      {
                        title: 'Confirm Inquiry?',
                        message: 'Confirm this inquiry appointment date & time.',
                        confirmLabel: 'Confirm Inquiry',
                      },
                      () => handleStatusChange('confirmed')
                    )}
                    disabled={statusLoading}
                    className="w-full py-3 bg-green-600 hover:bg-green-500 text-white text-xs font-bold uppercase tracking-widest rounded transition-all shadow-lg shadow-green-600/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {statusLoading ? <Clock className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Confirm Inquiry Now
                  </button>
                </div>
              )}

              {inquiry.status === 'confirmed' && (
                <div className="bg-blue-500/5 border border-blue-500/30 rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400">Start Service</h4>
                      <p className="text-[11px] text-gray-400 mt-1">The vehicle has arrived. Start the service to begin work.</p>
                    </div>
                    <Wrench className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                  </div>
                  <button
                    onClick={() => requestConfirmation(
                      {
                        title: 'Start Service?',
                        message: 'Set inquiry status to In Progress to begin work.',
                        confirmLabel: 'Start Service',
                      },
                      () => handleStatusChange('in_progress')
                    )}
                    disabled={statusLoading}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold uppercase tracking-widest rounded transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {statusLoading ? <Clock className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}
                    Start Service (In Progress)
                  </button>
                </div>
              )}

              {inquiry.status === 'in_progress' && (
                <div className="bg-brand-orange/5 border border-brand-orange/30 rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-brand-orange">Service In Progress</h4>
                      <p className="text-[11px] text-gray-400 mt-1">Fill out the inspection checklist or mark the service as completed.</p>
                    </div>
                    <BadgeCheck className="w-5 h-5 text-brand-orange shrink-0 mt-0.5" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      onClick={() => setActiveChecklistPhase('before')}
                      className="py-3 px-4 bg-[#1a1a1a] border border-brand-orange/40 text-brand-orange hover:bg-brand-orange hover:text-white text-[10px] font-bold uppercase tracking-widest rounded transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" /> Pre-Service Checklist
                    </button>
                    <button
                      onClick={() => requestConfirmation(
                        {
                          title: 'Complete Service?',
                          message: 'Mark this service as completed. You will then be able to fill out the final checklist.',
                          confirmLabel: 'Mark Completed',
                        },
                        async () => {
                          const success = await handleStatusChange('completed');
                          if (success) setActiveChecklistPhase('after');
                        }
                      )}
                      disabled={statusLoading}
                      className="py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold uppercase tracking-widest rounded transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {statusLoading ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <BadgeCheck className="w-3.5 h-3.5" />}
                      Mark Completed
                    </button>
                  </div>
                </div>
              )}

              {inquiry.status === 'completed' && (
                <div className="bg-emerald-500/5 border border-emerald-500/30 rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">Service Completed</h4>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {!isAfterSubmitted
                          ? 'The service is finished. Please complete the final checklist before sending the report to the customer.'
                          : !isAfterSent
                            ? 'The service is finished and the final checklist is complete. You can now send the final report to the customer.'
                            : 'The final report has been sent to the customer and shop owners.'}
                      </p>
                    </div>
                    {isAfterSent ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <BadgeCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => setActiveChecklistPhase('after')}
                      className="py-3 px-4 bg-[#1a1a1a] border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600 hover:text-white text-[10px] font-bold uppercase tracking-widest rounded transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ClipboardList className="w-3.5 h-3.5" /> {isAfterSubmitted ? 'View Installation Checklists' : 'Final Installation Checklist'}
                    </button>
                    <button
                      onClick={() => handlePreviewPdf('after')}
                      disabled={previewLoading === 'after'}
                      className="py-3 px-4 bg-[#1a1a1a] border border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white text-[10px] font-bold uppercase tracking-widest rounded transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {previewLoading === 'after' ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />} Preview Report
                    </button>
                    {isAfterSent ? (
                      <button
                        onClick={() => handleSendPdf('after')}
                        disabled={!!sendPdfLoading}
                        className="py-3 px-4 bg-[#1a1a1a] border border-brand-orange/40 text-brand-orange hover:bg-orange-600 hover:text-white text-[10px] font-bold uppercase tracking-widest rounded transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                      >
                        {sendPdfLoading === 'after' ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Re-send Report
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSendPdf('after')}
                        disabled={!!sendPdfLoading}
                        className="py-3 px-4 bg-brand-orange hover:bg-orange-600 text-white text-[10px] font-bold uppercase tracking-widest rounded transition-all shadow-lg shadow-brand-orange/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                      >
                        {sendPdfLoading === 'after' ? <Clock className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Send Report
                      </button>
                    )}
                  </div>
                </div>
              )}

              {inquiry.status === 'cancelled' && (
                <div className="bg-red-500/5 border border-red-500/30 rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-red-400">Service Cancelled</h4>
                      <p className="text-[11px] text-gray-400 mt-1">This service has been cancelled.</p>
                    </div>
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  </div>
                  <button
                    onClick={() => requestConfirmation(
                      {
                        title: 'Re-open Service?',
                        message: 'Re-open this service back to pending status.',
                        confirmLabel: 'Re-open',
                      },
                      () => handleStatusChange('pending')
                    )}
                    disabled={statusLoading}
                    className="w-full py-3 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold uppercase tracking-widest rounded transition-all shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {statusLoading ? <Clock className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Re-open Service
                  </button>
                </div>
              )}
            </div>

            {/* Quick Utility Actions */}
            <div className="pt-4 border-t border-gray-800 space-y-3 relative">
              <p className="text-[9px] uppercase font-mono tracking-widest text-gray-500">More Actions</p>

              {/* Status Dropdown */}
              <div ref={statusDropdownRef} className="relative">
                {isStatusLocked ? (
                  <div className="w-full flex items-center justify-between bg-emerald-950/30 border border-emerald-800/40 rounded p-3 text-xs font-bold uppercase tracking-widest text-emerald-300">
                    <span className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-emerald-400" />
                      Status Locked (Completed & Finalized)
                    </span>
                    <BadgeCheck className="w-4 h-4 text-emerald-400" />
                  </div>
                ) : (
                  <button
                    onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)}
                    disabled={statusLoading}
                    className="w-full flex items-center justify-between bg-[#161616] border border-gray-700 hover:border-brand-orange/50 rounded p-3 text-xs font-bold uppercase tracking-widest text-white transition-all disabled:opacity-50 group cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-brand-orange" />
                      Change Status Manually ({formatStatus(inquiry.status)})
                    </span>
                    {statusLoading ? (
                      <Clock className="w-4 h-4 text-brand-orange animate-spin" />
                    ) : (
                      <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-300 ${isStatusDropdownOpen ? 'rotate-180' : ''}`} />
                    )}
                  </button>
                )}

                {isStatusDropdownOpen && (
                  <div className="absolute bottom-full mb-2 inset-x-0 bg-[#1a1a1a] border border-gray-700 rounded-md shadow-2xl z-50 overflow-hidden">
                    {[...INQUIRY_STAGES, 'cancelled'].map((s) => {
                      if (s === inquiry.status) return null;

                      let hoverClass = 'hover:bg-gray-800';
                      let textClass = 'text-gray-300';

                      if (s === 'confirmed') { hoverClass = 'hover:bg-blue-500/10 hover:text-blue-400'; }
                      else if (s === 'in_progress') { hoverClass = 'hover:bg-brand-orange/10 hover:text-brand-orange'; }
                      else if (s === 'completed') { hoverClass = 'hover:bg-emerald-500/10 hover:text-emerald-400'; }
                      else if (s === 'cancelled') { hoverClass = 'hover:bg-red-500/10 hover:text-red-400'; }
                      else if (s === 'pending') { hoverClass = 'hover:bg-amber-500/10 hover:text-amber-400'; }

                      return (
                        <button
                          key={s}
                          onClick={() => {
                            setIsStatusDropdownOpen(false);
                            requestConfirmation(
                              {
                                title: 'Update Status?',
                                message: `Change inquiry status to ${formatStatus(s as any)}?`,
                                confirmLabel: 'Confirm',
                                tone: s === 'cancelled' ? 'danger' : 'default',
                              },
                              () => handleStatusChange(s)
                            );
                          }}
                          className={`w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-widest transition-colors border-b border-gray-800 last:border-0 flex items-center justify-between cursor-pointer ${textClass} ${hoverClass}`}
                        >
                          {formatStatus(s as any)}
                          <ChevronRight className="w-3.5 h-3.5 opacity-40" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Cancel Button (if active) */}
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
                  className="w-full flex justify-between items-center px-4 py-3 bg-[#161616] border border-red-500/30 text-red-400 hover:bg-red-500/10 text-[10px] font-bold uppercase tracking-widest rounded transition-all disabled:opacity-30 group cursor-pointer"
                >
                  <span>Cancel Inquiry</span>
                  <XCircle className="w-4 h-4 opacity-50 group-hover:opacity-100" />
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
                className="w-full flex justify-between items-center px-4 py-3 bg-transparent border border-red-500/40 text-red-500 hover:bg-red-500/10 hover:border-red-500 text-[10px] font-bold uppercase tracking-widest rounded transition-all disabled:opacity-30 group cursor-pointer"
              >
                <span>{isDeleting ? 'Deleting...' : 'Delete Inquiry Record'}</span>
                {isDeleting ? <Clock className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 opacity-70 group-hover:opacity-100" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Action Confirmation Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded border border-gray-700 bg-[#121212] p-6 shadow-2xl">
            <h3 className={`text-[10px] font-mono font-bold uppercase tracking-widest mb-4 border-b border-gray-800 pb-2 ${confirmDialog.tone === 'danger' ? 'text-red-500' : 'text-brand-orange'}`}>
              {confirmDialog.tone === 'danger' ? '// Action Required' : '// Please Confirm'}
            </h3>
            <p className="text-lg font-bold text-white mb-2">{confirmDialog.title}</p>
            <p className="text-sm text-gray-400 mb-6">{confirmDialog.message}</p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={closeConfirmation}
                disabled={confirmBusy}
                className="px-4 py-2 rounded border border-gray-700 text-xs font-bold uppercase tracking-widest text-gray-400 hover:border-gray-500 hover:text-white disabled:opacity-30 transition-colors"
              >
                Abort
              </button>
              <button
                type="button"
                onClick={() => void runConfirmedAction()}
                disabled={confirmBusy}
                className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-widest text-white disabled:opacity-30 transition-colors ${confirmDialog.tone === 'danger' ? 'bg-red-600 hover:bg-red-500' : 'bg-brand-orange hover:bg-orange-600'
                  }`}
              >
                {confirmBusy ? 'Executing...' : confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeChecklistPhase && token && (
        <InquiryChecklistModal
          inquiryId={inquiry.id}
          initialPhase={activeChecklistPhase}
          token={token}
          onClose={() => setActiveChecklistPhase(null)}
          onSaved={() => {
            fetchData();
          }}
        />
      )}
    </div>
  );
}