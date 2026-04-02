import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  ArrowLeft, User, Mail, Phone,
  FileText, CheckCircle2, XCircle, Loader2, AlertCircle,
  Edit3, ChevronDown, ChevronUp, Image as ImageIcon,
  Package, BadgeCheck, ChevronLeft, ChevronRight, Camera, Printer,
  Wrench, History,
} from 'lucide-react';
import {
  fetchBookingByIdAsync,
  cancelMyBookingAsync,
  rescheduleMyBookingAsync,
} from '../../store/bookingSlice';
import { fetchAvailabilityApi, fetchShopHoursApi, fetchShopClosedDatesApi, fetchBuildUpdatesApi, fetchBookingActivityApi } from '../../services/api';
import type { AppDispatch, RootState } from '../../store';
import type { Booking, BuildUpdate, ShopDayHours, BookingActivityLog } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatStatus } from '../../utils/formatStatus';
import BookingReviewWidget from '../../components/BookingReviewWidget';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<Booking['status'], string> = {
  pending:        'bg-yellow-500/10 text-yellow-400  border-yellow-500/30',
  confirmed:      'bg-green-500/10  text-green-400   border-green-500/30',
  completed:      'bg-blue-500/10   text-blue-400    border-blue-500/30',
  cancelled:      'bg-gray-700      text-gray-400    border-gray-600',
  awaiting_parts: 'bg-purple-500/10 text-purple-400  border-purple-500/30',
};

// Timeline steps in order
type TimelineStep = {
  key: string;
  label: string;
  icon: typeof CheckCircle2;
  activeForStatuses: Booking['status'][];
  completedForStatuses: Booking['status'][];
};

const TIMELINE_STEPS: TimelineStep[] = [
  {
    key: 'submitted',
    label: 'Submitted',
    icon: FileText,
    activeForStatuses: ['pending'],
    completedForStatuses: ['confirmed', 'completed', 'awaiting_parts'],
  },
  {
    key: 'confirmed',
    label: 'Confirmed',
    icon: CheckCircle2,
    activeForStatuses: ['confirmed'],
    completedForStatuses: ['completed', 'awaiting_parts'],
  },
  {
    key: 'in_progress',
    label: 'In Progress',
    icon: BadgeCheck,
    activeForStatuses: ['awaiting_parts'],
    completedForStatuses: ['completed'],
  },
  {
    key: 'completed',
    label: 'Completed',
    icon: BadgeCheck,
    activeForStatuses: ['completed'],
    completedForStatuses: [],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDisplayDate(isoDate: string): string {
  try {
    return new Date(isoDate + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

function formatActivityLabel(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

function getActivityPresentation(log: BookingActivityLog) {
  const signature = `${log.eventType} ${log.action}`.toLowerCase();

  if (signature.includes('cancel')) {
    return {
      icon: XCircle,
      iconClass: 'text-red-400',
      dotClass: 'bg-red-500/10 border-red-500/40',
      cardClass: 'border-red-500/20',
      title: 'Booking Cancelled',
    };
  }

  if (signature.includes('reschedul')) {
    return {
      icon: Edit3,
      iconClass: 'text-amber-400',
      dotClass: 'bg-amber-500/10 border-amber-500/40',
      cardClass: 'border-amber-500/20',
      title: 'Rescheduled',
    };
  }

  if (signature.includes('build') || signature.includes('photo') || signature.includes('media')) {
    return {
      icon: Camera,
      iconClass: 'text-brand-orange',
      dotClass: 'bg-brand-orange/10 border-brand-orange/40',
      cardClass: 'border-brand-orange/20',
      title: 'Build Update',
    };
  }

  if (signature.includes('part')) {
    return {
      icon: Package,
      iconClass: 'text-purple-400',
      dotClass: 'bg-purple-500/10 border-purple-500/40',
      cardClass: 'border-purple-500/20',
      title: 'Parts Update',
    };
  }

  if (signature.includes('status') || signature.includes('confirm') || signature.includes('complete')) {
    return {
      icon: CheckCircle2,
      iconClass: 'text-green-400',
      dotClass: 'bg-green-500/10 border-green-500/40',
      cardClass: 'border-green-500/20',
      title: 'Status Updated',
    };
  }

  return {
    icon: FileText,
    iconClass: 'text-gray-300',
    dotClass: 'bg-gray-700/40 border-gray-600',
    cardClass: 'border-gray-700',
    title: formatActivityLabel(log.action || log.eventType || 'Activity'),
  };
}

function buildRescheduleDateList(shopHours: ShopDayHours[], closedDatesSet: Set<string>): Date[] {
  const openDays = shopHours.length
    ? new Set(shopHours.filter(h => h.isOpen).map(h => h.dayOfWeek))
    : new Set([1, 2, 3, 4, 5, 6]); // Mon–Sat default
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

// ── Reschedule panel ─────────────────────────────────────────────────────────

interface ReschedulePanelProps {
  booking: Booking;
  token: string;
  onSuccess: (updated: Booking) => void;
  onCancel: () => void;
}

function ReschedulePanel({ booking, token, onSuccess, onCancel }: ReschedulePanelProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { showToast } = useToast();

  const [shopHours,      setShopHours]      = useState<ShopDayHours[]>([]);
  const [closedDatesSet, setClosedDatesSet] = useState<Set<string>>(new Set());
  const [selectedDate,   setSelectedDate]   = useState<Date | null>(null);
  const [selectedTime,   setSelectedTime]   = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [bookedSlots,    setBookedSlots]    = useState<string[]>([]);
  const [shopDayIsOpen,  setShopDayIsOpen]  = useState(true);
  const [slotsLoading,   setSlotsLoading]   = useState(false);
  const [saveBusy,       setSaveBusy]       = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Load shop hours once to build the date list
  useEffect(() => {
    Promise.all([fetchShopHoursApi(), fetchShopClosedDatesApi()])
      .then(([{ hours }, cdData]) => {
        setShopHours(hours);
        const cd = (cdData as { closedDates: { date: string }[] }).closedDates ?? [];
        setClosedDatesSet(new Set(cd.map(d => d.date)));
      })
      .catch(() => {});
  }, []);

  const availableDates = buildRescheduleDateList(shopHours, closedDatesSet);

  // Fetch availability whenever a date is selected
  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedTime('');
    setAvailableSlots([]);
    setBookedSlots([]);
    setShopDayIsOpen(true);
    const iso = date.toISOString().split('T')[0];
    setSlotsLoading(true);
    fetchAvailabilityApi(iso)
      .then(res => {
        setShopDayIsOpen(res.isOpen);
        // Exclude the booking's current slot so it stays selectable
        const booked = res.bookedSlots.filter(
          s => !(iso === booking.appointmentDate && s === booking.appointmentTime)
        );
        setAvailableSlots(res.availableSlots);
        setBookedSlots(booked);
      })
      .catch(() => {})
      .finally(() => setSlotsLoading(false));
  };

  const handleSave = async () => {
    if (!selectedDate || !selectedTime) return;
    const iso = selectedDate.toISOString().split('T')[0];
    setSaveBusy(true);
    try {
      const updated = await dispatch(
        rescheduleMyBookingAsync({ token, id: booking.id, appointmentDate: iso, appointmentTime: selectedTime })
      ).unwrap();
      showToast('Appointment rescheduled successfully.', 'success');
      onSuccess(updated);
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Failed to reschedule.', 'error');
    } finally {
      setSaveBusy(false);
    }
  };

  const openSlots = availableSlots.filter(s => !bookedSlots.includes(s));
  const selectedIso = selectedDate?.toISOString().split('T')[0] ?? '';
  const unchanged   = selectedIso === booking.appointmentDate && selectedTime === booking.appointmentTime;

  return (
    <div className="bg-gradient-to-br from-brand-dark to-[#171717] border border-gray-800 rounded-xl p-5 md:p-6 space-y-5">
      <h3 className="text-xs font-bold uppercase tracking-widest text-brand-orange flex items-center gap-2">
        <Edit3 className="w-3.5 h-3.5" />
        Reschedule Appointment
      </h3>

      {/* Date carousel */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">New Date</p>
        <div className="relative">
          <button
            type="button"
            onClick={() => scrollRef.current?.scrollBy({ left: -180, behavior: 'smooth' })}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-brand-darker border border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white -translate-x-3.5 shadow"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          <div
            ref={scrollRef}
            className="flex overflow-x-auto gap-2 pb-1 snap-x px-1"
            style={{ scrollbarWidth: 'none' }}
          >
            {availableDates.map((date, i) => {
              const active     = selectedDate?.toDateString() === date.toDateString();
              const isCurrent  = date.toISOString().split('T')[0] === booking.appointmentDate;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleDateSelect(date)}
                  className={`snap-start shrink-0 w-[72px] p-3 border text-center transition-all rounded-sm relative ${
                    active
                      ? 'border-brand-orange bg-brand-orange/10'
                      : 'border-gray-800 hover:border-gray-600 bg-brand-darker'
                  }`}
                >
                  <div className="text-[10px] text-gray-400 uppercase mb-1">
                    {date.toLocaleDateString('en-PH', { weekday: 'short' })}
                  </div>
                  <div className="text-xl font-display font-bold text-white">{date.getDate()}</div>
                  <div className="text-[10px] text-gray-500 uppercase mt-1">
                    {date.toLocaleDateString('en-PH', { month: 'short' })}
                  </div>
                  {isCurrent && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand-orange" />
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => scrollRef.current?.scrollBy({ left: 180, behavior: 'smooth' })}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-brand-darker border border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white translate-x-3.5 shadow"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {selectedDate && (
          <p className="text-xs text-brand-orange mt-2">
            {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </div>

      {/* Time slots */}
      {selectedDate && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">
            New Time
            {slotsLoading && (
              <span className="ml-2 text-gray-600 normal-case font-normal inline-flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Checking…
              </span>
            )}
          </p>
          {!slotsLoading && !shopDayIsOpen && (
            <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-sm">
              The shop is closed on this date. Please choose a different day.
            </p>
          )}
          {!slotsLoading && shopDayIsOpen && openSlots.length === 0 && (
            <p className="text-gray-500 text-sm py-2">No available slots for this date. Please choose another day.</p>
          )}
          {!slotsLoading && shopDayIsOpen && openSlots.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {openSlots.map(slot => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setSelectedTime(slot)}
                  className={`flex flex-col items-center justify-center px-2 py-2.5 rounded-sm border font-bold transition-colors text-sm ${
                    selectedTime === slot
                      ? 'bg-brand-orange border-brand-orange text-white'
                      : 'bg-brand-darker border-gray-700 text-white hover:border-brand-orange hover:text-brand-orange'
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          onClick={handleSave}
          disabled={saveBusy || !selectedDate || !selectedTime || unchanged}
          className="flex items-center gap-2 bg-brand-orange text-white px-5 py-2 text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-md disabled:opacity-50"
        >
          {saveBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Save Changes
        </button>
        <button
          onClick={onCancel}
          disabled={saveBusy}
          className="border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 px-5 py-2 text-xs font-bold uppercase tracking-widest transition-colors rounded-md disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BookingDetail() {
  const { id }              = useParams<{ id: string }>();
  const dispatch            = useDispatch<AppDispatch>();
  const navigate            = useNavigate();
  const { token, user }     = useAuth();
  const { showToast }       = useToast();
  const appointments        = useSelector((s: RootState) => s.booking.appointments);

  const [booking, setBooking]             = useState<Booking | null>(null);
  const [loading, setLoading]             = useState(true);
  const [loadError, setLoadError]         = useState<string | null>(null);
  const [rescheduling, setRescheduling]   = useState(false);
  const [cancelTarget, setCancelTarget]   = useState(false);
  const [cancelBusy, setCancelBusy]       = useState(false);
  const [mediaExpanded, setMediaExpanded] = useState(false);
  const [buildUpdates,  setBuildUpdates]  = useState<BuildUpdate[]>([]);
  const [activityLogs,  setActivityLogs]  = useState<BookingActivityLog[]>([]);
  const [activityExpanded, setActivityExpanded] = useState(false);
  const [lightboxUrl,   setLightboxUrl]   = useState<string | null>(null);

  // Try redux cache first (only if it belongs to the current user), then fetch
  useEffect(() => {
    if (!id || !token) return;

    const cached = appointments.find(
      b => b.id === id && b.userId != null && b.userId === user?.id
    );
    if (cached) {
      setBooking(cached);
      setLoading(false);
      // Refresh in the background for up-to-date data
      dispatch(fetchBookingByIdAsync({ token, id }))
        .unwrap()
        .then(updated => { if (updated.userId === user?.id) setBooking(updated); })
        .catch(() => {/* use cached */});
      return;
    }

    setLoading(true);
    dispatch(fetchBookingByIdAsync({ token, id }))
      .unwrap()
      .then(fetched => {
        // The backend already enforces ownership (returns 403 for other users),
        // but guard here too for defense in depth.
        if (user == null || fetched.userId !== user.id) {
          setLoadError('You are not authorized to view this booking.');
        } else {
          setBooking(fetched);
        }
      })
      .catch((e: unknown) => setLoadError((e as Error).message ?? 'Failed to load booking.'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);

  const handleCancelConfirm = async () => {
    if (!token || !booking) return;
    setCancelBusy(true);
    try {
      const updated = await dispatch(cancelMyBookingAsync({ token, id: booking.id })).unwrap();
      setBooking(updated);
      showToast('Booking cancelled successfully.', 'success');
      setCancelTarget(false);
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Failed to cancel booking.', 'error');
    } finally {
      setCancelBusy(false);
    }
  };

  // Load build updates after booking is known
  useEffect(() => {
    if (!token || !booking) return;
    fetchBuildUpdatesApi(token, booking.id)
      .then(({ updates }) => setBuildUpdates(updates))
      .catch(() => {});
    fetchBookingActivityApi(token, booking.id)
      .then(({ logs }) => setActivityLogs(logs))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, booking?.id]);

  // ── Loading / Error ──────────────────────────────────────────────────────────

  if (loading && !booking) {
    return (
      <div className="flex justify-center items-center py-24">
        <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
      </div>
    );
  }

  if (loadError || !booking) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Link to="/client/bookings" className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Bookings
        </Link>
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 px-5 py-4 rounded-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{loadError ?? 'Booking not found.'}</p>
        </div>
        <button
          onClick={() => navigate('/client/bookings')}
          className="bg-brand-orange text-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm"
        >
          Return to My Bookings
        </button>
      </div>
    );
  }

  const canModify = booking.status === 'pending' || booking.status === 'confirmed';
  const isConfirmed = booking.status === 'confirmed';
  const hasMedia  = (booking.mediaUrls ?? []).length > 0;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 w-full">
      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white/70 hover:text-white"
            onClick={() => setLightboxUrl(null)}
          >
            <XCircle className="w-7 h-7" />
          </button>
          <img
            src={lightboxUrl}
            alt="Full size"
            className="max-w-full max-h-[90vh] object-contain rounded-sm"
            referrerPolicy="no-referrer"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* Back link */}
      <Link
        to="/client/bookings"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors px-1"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Bookings
      </Link>

     {/* Hero Header - System Variant */}
    <div className="relative border border-gray-800/80 rounded-xl bg-[#121212] overflow-hidden shadow-2xl">
      
      {/* Activity indicator line */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-orange via-brand-orange/50 to-transparent" />

      <div className="p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          
          {/* Primary Identity */}
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-4">
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-brand-orange/80">
                // Dispatch Overview
              </p>
              <span className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest rounded border ${STATUS_STYLES[booking.status]}`}>
                {formatStatus(booking.status)}
              </span>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight leading-none">
              {booking.serviceName}
            </h1>

            {/* Added: Service Variations */}
            {booking.selectedVariations && booking.selectedVariations.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {booking.selectedVariations.map((v) => (
                  <span 
                    key={`${v.serviceId}-${v.variationId}`} 
                    className="inline-flex items-center px-2 py-1 bg-white/5 border border-white/10 rounded text-[11px] font-medium text-gray-300"
                  >
                    <span className="text-brand-orange/70 mr-1.5 font-mono">+</span>
                    {v.variationName}
                  </span>
                ))}
              </div>
            )}
            
            <div className="flex items-center gap-3 pt-2 text-xs font-mono">
              {booking.referenceNumber && (
                <span className="text-brand-orange bg-brand-orange/10 px-2 py-1 rounded border border-brand-orange/20 font-bold">
                  REF:{booking.referenceNumber}
                </span>
              )}
              <span className="text-gray-500">SYS_ID:{booking.id}</span>
            </div>
          </div>
        </div>

        {/* Execution Telemetry */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-px bg-gray-800/50 border border-gray-800/50 rounded-lg overflow-hidden">
          <div className="bg-[#151515] p-4 transition-colors hover:bg-[#181818]">
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">Execution Date</p>
            <p className="text-sm font-semibold text-gray-200">{formatDisplayDate(booking.appointmentDate)}</p>
          </div>
          <div className="bg-[#151515] p-4 transition-colors hover:bg-[#181818]">
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">Local Time</p>
            <p className="text-sm font-semibold text-gray-200">{booking.appointmentTime}</p>
          </div>
          <div className="bg-[#151515] p-4 transition-colors hover:bg-[#181818]">
            <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">Target Asset</p>
            <p className="text-sm font-semibold text-gray-200 truncate">{booking.vehicleInfo}</p>
          </div>
        </div>
      </div>
    </div>

      {/* Status timeline */}
      {booking.status !== 'cancelled' && (
        <div className="bg-gradient-to-br from-brand-dark to-[#191919] border border-gray-800 rounded-xl px-5 py-5 md:px-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4">Progress</p>
          <div className="flex items-center gap-0 overflow-x-auto pb-1">
            {TIMELINE_STEPS.map((step, i) => {
              const isCompleted = step.completedForStatuses.includes(booking.status);
              const isActive    = step.activeForStatuses.includes(booking.status);
              const Icon        = step.icon;
              const isLast      = i === TIMELINE_STEPS.length - 1;
              return (
                <div key={step.key} className="flex items-center flex-1 min-w-[140px]">
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                      isCompleted ? 'bg-brand-orange border-brand-orange' :
                      isActive    ? 'bg-brand-orange/20 border-brand-orange' :
                                    'bg-brand-darker border-gray-700'
                    }`}>
                      <Icon className={`w-3.5 h-3.5 ${isCompleted ? 'text-white' : isActive ? 'text-brand-orange' : 'text-gray-600'}`} />
                    </div>
                    <span className={`text-[9px] font-bold uppercase tracking-widest mt-1.5 text-center leading-tight ${
                      isCompleted || isActive ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  {!isLast && (
                    <div className={`h-0.5 flex-1 mx-1 mb-4 rounded-full ${isCompleted ? 'bg-brand-orange' : 'bg-gray-700'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {booking.status === 'cancelled' && (
        <div className="flex items-center gap-3 bg-gray-700/30 border border-gray-700 text-gray-400 px-5 py-4 rounded-xl">
          <XCircle className="w-4 h-4 shrink-0" />
          <p className="text-sm">This booking has been cancelled.</p>
        </div>
      )}

      {/* Awaiting parts note */}
      {booking.status === 'awaiting_parts' && booking.partsNotes && (
        <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl px-5 py-4 flex items-start gap-3">
          <Package className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400 mb-1">Awaiting Parts</p>
            <p className="text-purple-300 text-sm">{booking.partsNotes}</p>
          </div>
        </div>
      )}
<div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
  {/* --- CORE PAYLOAD: SERVICE & LOGISTICS --- */}
  <div className="xl:col-span-2 flex flex-col gap-6">
    <div className="bg-[#121212] border border-gray-800/80 rounded-lg p-6 md:p-8 relative overflow-hidden">
      {/* Top accent line */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-brand-orange via-brand-orange/50 to-transparent" />

      {/* Header Block */}
      <div className="flex flex-col md:flex-row justify-between gap-6 mb-8">
        <div>
          <p className="text-[10px] font-mono text-brand-orange/80 uppercase tracking-widest mb-2">
            // Primary Payload
          </p>
          <h2 className="text-3xl font-black text-white tracking-tight">{booking.serviceName}</h2>
          
          {/* Variations as sub-tags */}
          {booking.selectedVariations && booking.selectedVariations.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {booking.selectedVariations.map((v) => (
                <span 
                  key={`${v.serviceId}-${v.variationId}`} 
                  className="inline-flex items-center px-2 py-1 bg-white/5 border border-white/10 rounded text-xs font-medium text-gray-300"
                >
                  {v.variationName}
                </span>
              ))}
            </div>
          )}
        </div>

        {booking.referenceNumber && (
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase text-gray-500 font-bold tracking-widest mb-1">Ref_ID</p>
            <p className="text-sm font-mono text-brand-orange bg-brand-orange/10 px-3 py-1.5 rounded border border-brand-orange/20">
              {booking.referenceNumber}
            </p>
          </div>
        )}
      </div>

      {/* Specs Grid (1px gap trick for inner borders) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-800/50 rounded-lg overflow-hidden border border-gray-800/50">
        
        {/* Vehicle Details */}
        {(booking.vehicleMake || booking.vehicleModel || booking.vehicleYear) && (
          <div className="bg-[#151515] p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500" /> Target Hardware
            </p>
            <dl className="space-y-2">
              {[
                { label: 'Year', val: booking.vehicleYear },
                { label: 'Make', val: booking.vehicleMake },
                { label: 'Model', val: booking.vehicleModel }
              ].map(spec => spec.val && (
                <div key={spec.label} className="flex justify-between items-center border-b border-white/5 pb-2 last:border-0 last:pb-0">
                  <dt className="text-xs text-gray-500 uppercase tracking-wider">{spec.label}</dt>
                  <dd className="text-sm font-semibold text-white">{spec.val}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {/* Assigned Tech */}
        {booking.assignedTech ? (
          <div className="bg-[#151515] p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-orange" /> Assigned Operator
            </p>
            <div className="flex items-center gap-4">
              {booking.assignedTech.imageUrl ? (
                <img
                  src={booking.assignedTech.imageUrl}
                  alt={booking.assignedTech.name}
                  className="w-12 h-12 rounded-full object-cover border border-brand-orange/30 shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-brand-darker border border-gray-700 flex items-center justify-center shrink-0">
                  <Wrench className="w-5 h-5 text-gray-400" />
                </div>
              )}
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-white truncate">{booking.assignedTech.name}</p>
                {booking.assignedTech.role && (
                  <p className="text-[10px] font-mono text-brand-orange/80 mt-0.5 truncate">{booking.assignedTech.role}</p>
                )}
                <p className="text-[10px] text-gray-600 mt-0.5">Your installer for this job</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#151515] p-5 flex items-center justify-center text-xs text-gray-600 font-mono uppercase tracking-widest">
            Pending Operator...
          </div>
        )}
      </div>

      {/* Notes */}
      {booking.notes && (
        <div className="mt-6 bg-brand-orange/5 border-l-2 border-brand-orange p-4 rounded-r-lg">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-orange/70 mb-2">Contextual Notes</p>
          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{booking.notes}</p>
        </div>
      )}

      {/* Calibration Certificate */}
      {booking.calibrationData && booking.status === 'completed' && (
        <div className="mt-6 bg-[#111] border border-brand-orange/20 rounded-lg p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-orange/70 mb-4 flex items-center gap-2">
            <BadgeCheck className="w-3.5 h-3.5 text-brand-orange" /> Calibration Certificate
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
            {booking.calibrationData.beamAngle && (
              <div>
                <p className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mb-1">Beam Angle</p>
                <p className="text-sm font-bold text-white">{booking.calibrationData.beamAngle}</p>
              </div>
            )}
            {booking.calibrationData.luxOutput && (
              <div>
                <p className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mb-1">Lux Output</p>
                <p className="text-sm font-bold text-white">{booking.calibrationData.luxOutput}</p>
              </div>
            )}
            {booking.assignedTech && (
              <div>
                <p className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mb-1">Technician</p>
                <p className="text-sm font-bold text-white">{booking.assignedTech.name}</p>
              </div>
            )}
            <div>
              <p className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mb-1">Date</p>
              <p className="text-sm font-bold text-white">{booking.appointmentDate}</p>
            </div>
          </div>
          {booking.calibrationData.notes && (
            <p className="text-xs text-gray-400 leading-relaxed border-t border-white/5 pt-3">{booking.calibrationData.notes}</p>
          )}
          <button
            onClick={() => window.print()}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand-orange/10 border border-brand-orange/30 text-brand-orange text-[10px] font-bold uppercase tracking-widest rounded hover:bg-brand-orange/20 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" /> Print / Save PDF
          </button>
        </div>
      )}
    </div>

    {/* Action Panel */}
    {canModify && (
      <div className="bg-[#121212] border border-gray-800/80 rounded-lg p-4 flex flex-wrap gap-3">
        {!rescheduling && (
          <button
            onClick={() => setRescheduling(true)}
            disabled={isConfirmed}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-transparent border border-gray-700 hover:border-brand-orange hover:text-brand-orange text-gray-300 px-6 py-2.5 text-xs font-bold uppercase tracking-widest rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Edit3 className="w-3.5 h-3.5" /> Reschedule
          </button>
        )}
        <button
          onClick={() => setCancelTarget(true)}
          disabled={isConfirmed}
          className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-transparent border border-gray-700 hover:border-red-500 hover:text-red-500 hover:bg-red-500/10 text-gray-300 px-6 py-2.5 text-xs font-bold uppercase tracking-widest rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <XCircle className="w-3.5 h-3.5" /> Terminate
        </button>
      </div>
    )}
  </div>

  {/* --- TELEMETRY & CONTACT (SIDEBAR) --- */}
  <div className="xl:col-span-1 space-y-6">
    
    {/* Client Identity */}
    <div className="bg-[#121212] border border-gray-800/80 rounded-lg p-6">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-6">Client Identity</p>
      <ul className="space-y-5">
        {[
          { icon: User, label: 'Name', val: booking.name },
          { icon: Mail, label: 'Email', val: booking.email },
          { icon: Phone, label: 'Phone', val: booking.phone }
        ].map((contact, i) => (
          <li key={i} className="flex items-start gap-4">
            <contact.icon className="w-4 h-4 text-gray-600 mt-0.5 shrink-0" />
            <div className="overflow-hidden">
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-0.5">{contact.label}</p>
              <p className="text-sm font-medium text-gray-200 truncate">{contact.val}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>

    {/* System Meta */}
    <div className="bg-[#121212] border border-gray-800/80 rounded-lg p-6 font-mono">
      <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-gray-500 mb-4">System Meta</p>
      <div className="space-y-4 text-xs">
        <div>
          <span className="text-gray-600 block mb-1">UUID</span>
          <p className="text-gray-400 break-all">{booking.id}</p>
        </div>
        <div>
          <span className="text-gray-600 block mb-1">Timestamp</span>
          <p className="text-gray-400">
            {new Date(booking.createdAt).toISOString().replace('T', ' ').substring(0, 19)}Z
          </p>
        </div>
      </div>
    </div>

  </div>
</div>

      {/* Media attachments */}
      {hasMedia && (
        <div className="bg-gradient-to-br from-brand-dark to-[#191919] border border-gray-800 rounded-xl overflow-hidden">
          <button
            onClick={() => setMediaExpanded(v => !v)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-900/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-gray-500" />
              <span className="text-xs font-bold uppercase tracking-widest text-gray-300">
                Attachments ({(booking.mediaUrls ?? []).length})
              </span>
            </div>
            {mediaExpanded ? <ChevronUp className="w-4 h-4 text-gray-600" /> : <ChevronDown className="w-4 h-4 text-gray-600" />}
          </button>
          {mediaExpanded && (
            <div className="px-6 pb-6 grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-gray-800">
              {(booking.mediaUrls ?? []).map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="group block aspect-video bg-brand-darker rounded-md overflow-hidden border border-gray-700 hover:border-brand-orange/50 transition-colors">
                  <img src={url} alt={`Attachment ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Build Progress Feed */}
      {buildUpdates.length > 0 && (
        <div className="bg-gradient-to-br from-brand-dark to-[#191919] border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-800 flex items-center gap-2">
            <Camera className="w-4 h-4 text-brand-orange" />
            <span className="text-xs font-bold uppercase tracking-widest text-gray-300">
              Build Progress ({buildUpdates.length} update{buildUpdates.length !== 1 ? 's' : ''})
            </span>
          </div>
          <ol className="divide-y divide-gray-800">
            {buildUpdates.slice().reverse().map(upd => (
              <li key={upd.id} className="px-6 py-5 space-y-3">
                <p className="text-[10px] font-mono text-gray-500">
                  {new Date(upd.createdAt).toLocaleString('en-US', {
                    year: 'numeric', month: 'short', day: 'numeric',
                    hour: 'numeric', minute: '2-digit',
                  })}
                </p>
                {upd.note && (
                  <p className="text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">{upd.note}</p>
                )}
                {upd.photoUrls.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {upd.photoUrls.map((url, j) => (
                      <button
                        key={j}
                        onClick={() => setLightboxUrl(url)}
                        className="group block aspect-video bg-brand-darker rounded-md overflow-hidden border border-gray-700 hover:border-brand-orange/50 transition-colors"
                      >
                        <img
                          src={url}
                          alt={`Progress photo ${j + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Booking Activity Log Timeline */}
      {activityLogs.length > 0 && (
        <div className="bg-gradient-to-br from-brand-dark to-[#191919] border border-gray-800 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setActivityExpanded(v => !v)}
            aria-expanded={activityExpanded}
            className="w-full px-6 py-4 border-b border-gray-800 flex items-center justify-between gap-3 hover:bg-gray-900/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-brand-orange" />
              <span className="text-xs font-bold uppercase tracking-widest text-gray-300">
                Activity Log
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                {activityLogs.length} event{activityLogs.length !== 1 ? 's' : ''}
              </span>
              {activityExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-500" />
              )}
            </div>
          </button>

          {!activityExpanded && (
            <div className="px-6 py-3 text-xs text-gray-500">
              Tap to view the full timeline.
            </div>
          )}

          {activityExpanded && (
            <ol className="px-4 md:px-6 py-2">
              {activityLogs.slice().reverse().map((log, i) => {
              const visual = getActivityPresentation(log);
              const Icon = visual.icon;
              const isLast = i === activityLogs.length - 1;
              return (
                <li key={log.id} className="relative pl-10 md:pl-12 py-3.5">
                  {!isLast && (
                    <span className="absolute left-[13px] md:left-[15px] top-12 bottom-0 w-px bg-gray-800" />
                  )}
                  <div className={`absolute left-0 top-4 w-7 h-7 rounded-full border flex items-center justify-center ${visual.dotClass}`}>
                    <Icon className={`w-3.5 h-3.5 ${visual.iconClass}`} />
                  </div>

                  <div className={`rounded-lg border bg-black/20 px-4 py-3.5 ${visual.cardClass}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-100 leading-tight">
                          {visual.title}
                        </p>
                        <p className="text-[10px] font-mono text-gray-500 mt-1">
                          {new Date(log.createdAt).toLocaleString('en-US', {
                            year: 'numeric', month: 'short', day: 'numeric',
                            hour: 'numeric', minute: '2-digit',
                          })}
                        </p>
                      </div>
                      <span className={`shrink-0 inline-block px-2 py-1 text-[9px] font-bold uppercase tracking-widest rounded-sm ${
                        log.actorRole === 'admin' ? 'bg-brand-orange/10 text-brand-orange' :
                        log.actorRole === 'client' ? 'bg-blue-500/10 text-blue-400' :
                        'bg-gray-700/40 text-gray-300'
                      }`}>
                        {log.actorRole === 'system' ? 'System' : formatActivityLabel(log.actorRole)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="inline-block px-2 py-1 text-[9px] font-bold uppercase tracking-widest rounded-sm bg-gray-800 text-gray-300 border border-gray-700">
                        {formatActivityLabel(log.eventType)}
                      </span>
                      <span className="inline-block px-2 py-1 text-[9px] font-bold uppercase tracking-widest rounded-sm bg-gray-900 text-gray-400 border border-gray-800">
                        {formatActivityLabel(log.action)}
                      </span>
                    </div>

                    {log.detail && (
                      <p className="text-xs text-gray-300 mt-3 leading-relaxed whitespace-pre-wrap border-t border-gray-800 pt-3">
                        {log.detail}
                      </p>
                    )}
                  </div>
                </li>
              );
              })}
            </ol>
          )}
        </div>
      )}


      {/* Build Showcase link – only for completed bookings with a build slug */}
      {booking.status === 'completed' && booking.buildSlug && (
        <div className="mb-8">
          <a
            href={`/builds/${encodeURIComponent(booking.buildSlug)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block bg-brand-orange text-white px-6 py-3 font-bold uppercase tracking-widest rounded-sm hover:bg-orange-600 transition-colors mb-2"
          >
            View Build Showcase
          </a>
          <p className="text-xs text-gray-400 mt-1">Share or view your before/after build page.</p>
        </div>
      )}

      {/* Review widget – only for completed bookings */}
      {booking.status === 'completed' && token && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3 ml-1">
            Rate Your Experience
          </p>
          <BookingReviewWidget bookingId={booking.id} token={token} />
        </div>
      )}

      {/* Print Receipt */}
      {(booking.status === 'completed' || booking.status === 'confirmed') && (
        <div className="bg-gradient-to-br from-brand-dark to-[#191919] border border-gray-800 rounded-xl px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-white text-sm font-semibold">Receipt / Summary</p>
            <p className="text-gray-500 text-xs mt-0.5">Print or save as PDF</p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 border border-gray-700 text-gray-300 hover:border-brand-orange hover:text-brand-orange px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors rounded-md"
          >
            <Printer className="w-3.5 h-3.5" /> Print Receipt
          </button>
        </div>
      )}

      {/* Reschedule panel */}
      {canModify && rescheduling && token && (
        <ReschedulePanel
          booking={booking}
          token={token}
          onSuccess={(updated) => { setBooking(updated); setRescheduling(false); }}
          onCancel={() => setRescheduling(false)}
        />
      )}

      {/* Cancel confirmation modal */}
      {cancelTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-brand-dark border border-gray-700 rounded-xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-400" />
              <h3 className="text-white font-bold uppercase tracking-wide text-sm">Cancel Booking?</h3>
            </div>
            <p className="text-gray-400 text-sm">
              Are you sure you want to cancel this appointment? This action can't be undone, but you can always book a new one.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleCancelConfirm}
                disabled={cancelBusy}
                className="flex-1 flex items-center justify-center gap-2 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors rounded-md disabled:opacity-50"
              >
                {cancelBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                Yes, Cancel It
              </button>
              <button
                onClick={() => setCancelTarget(false)}
                disabled={cancelBusy}
                className="flex-1 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors rounded-md disabled:opacity-50"
              >
                No, Keep It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
