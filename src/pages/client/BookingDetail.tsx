import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  ArrowLeft, Calendar, Clock, Car, User, Mail, Phone,
  FileText, CheckCircle2, XCircle, Loader2, AlertCircle,
  Edit3, ChevronDown, ChevronUp, Image as ImageIcon,
  Package, BadgeCheck, ChevronLeft, ChevronRight, Camera, Printer,
} from 'lucide-react';
import {
  fetchBookingByIdAsync,
  cancelMyBookingAsync,
  rescheduleMyBookingAsync,
} from '../../store/bookingSlice';
import { fetchAvailabilityApi, fetchShopHoursApi, fetchBuildUpdatesApi } from '../../services/api';
import type { AppDispatch, RootState } from '../../store';
import type { Booking, BuildUpdate, ShopDayHours } from '../../types';
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

function buildRescheduleDateList(shopHours: ShopDayHours[]): Date[] {
  const openDays = shopHours.length
    ? new Set(shopHours.filter(h => h.isOpen).map(h => h.dayOfWeek))
    : new Set([1, 2, 3, 4, 5, 6]); // Mon–Sat default
  const dates: Date[] = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() + 1);
  while (dates.length < 30) {
    if (openDays.has(cursor.getDay())) dates.push(new Date(cursor));
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
    fetchShopHoursApi()
      .then(({ hours }) => setShopHours(hours))
      .catch(() => {});
  }, []);

  const availableDates = buildRescheduleDateList(shopHours);

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
    <div className="bg-brand-dark border border-gray-800 rounded-sm p-5 space-y-5">
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
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={handleSave}
          disabled={saveBusy || !selectedDate || !selectedTime || unchanged}
          className="flex items-center gap-2 bg-brand-orange text-white px-5 py-2 text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm disabled:opacity-50"
        >
          {saveBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Save Changes
        </button>
        <button
          onClick={onCancel}
          disabled={saveBusy}
          className="border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 px-5 py-2 text-xs font-bold uppercase tracking-widest transition-colors rounded-sm disabled:opacity-50"
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
  const [lightboxUrl,   setLightboxUrl]   = useState<string | null>(null);

  // Try redux cache first (only if it belongs to the current user), then fetch
  useEffect(() => {
    if (!id || !token) return;

    const cached = appointments.find(
      b => b.id === id && !b.id.startsWith('mock') && b.userId != null && b.userId === user?.id
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
    <div className="space-y-6 max-w-3xl">
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
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Bookings
      </Link>

      {/* Hero header */}
      <div className="relative bg-brand-dark border border-gray-800 rounded-sm overflow-hidden px-6 py-5">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-orange" />
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-orange mb-1">Booking Details</p>
            <h1 className="text-xl md:text-2xl font-display font-black text-white uppercase tracking-tighter leading-tight">
              {booking.serviceName}
            </h1>
            <p className="text-gray-500 text-xs mt-1 font-mono">#{booking.id}</p>
          </div>
          <span className={`px-3 py-1.5 text-xs font-bold uppercase tracking-widest rounded-sm border ${STATUS_STYLES[booking.status]}`}>
            {formatStatus(booking.status)}
          </span>
        </div>
      </div>

      {/* Status timeline */}
      {booking.status !== 'cancelled' && (
        <div className="bg-brand-dark border border-gray-800 rounded-sm px-6 py-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4">Progress</p>
          <div className="flex items-center gap-0">
            {TIMELINE_STEPS.map((step, i) => {
              const isCompleted = step.completedForStatuses.includes(booking.status);
              const isActive    = step.activeForStatuses.includes(booking.status);
              const Icon        = step.icon;
              const isLast      = i === TIMELINE_STEPS.length - 1;
              return (
                <div key={step.key} className="flex items-center flex-1 min-w-0">
                  <div className="flex flex-col items-center shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${
                      isCompleted ? 'bg-brand-orange border-brand-orange' :
                      isActive    ? 'bg-brand-orange/20 border-brand-orange' :
                                    'bg-brand-darker border-gray-700'
                    }`}>
                      <Icon className={`w-3.5 h-3.5 ${isCompleted || isActive ? 'text-brand-orange' : 'text-gray-600'}`} />
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
        <div className="flex items-center gap-3 bg-gray-700/30 border border-gray-700 text-gray-400 px-5 py-4 rounded-sm">
          <XCircle className="w-4 h-4 shrink-0" />
          <p className="text-sm">This booking has been cancelled.</p>
        </div>
      )}

      {/* Awaiting parts note */}
      {booking.status === 'awaiting_parts' && booking.partsNotes && (
        <div className="bg-purple-500/5 border border-purple-500/20 rounded-sm px-5 py-4 flex items-start gap-3">
          <Package className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400 mb-1">Awaiting Parts</p>
            <p className="text-purple-300 text-sm">{booking.partsNotes}</p>
          </div>
        </div>
      )}

      {/* Details grid */}
      <div className="bg-brand-dark border border-gray-800 rounded-sm p-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-5">Appointment Info</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Date */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-brand-darker border border-gray-700 rounded-sm flex items-center justify-center shrink-0 mt-0.5">
              <Calendar className="w-4 h-4 text-brand-orange" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-0.5">Date</p>
              <p className="text-white text-sm font-semibold">{formatDisplayDate(booking.appointmentDate)}</p>
            </div>
          </div>

          {/* Time */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-brand-darker border border-gray-700 rounded-sm flex items-center justify-center shrink-0 mt-0.5">
              <Clock className="w-4 h-4 text-brand-orange" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-0.5">Time</p>
              <p className="text-white text-sm font-semibold">{booking.appointmentTime}</p>
            </div>
          </div>

          {/* Vehicle */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-brand-darker border border-gray-700 rounded-sm flex items-center justify-center shrink-0 mt-0.5">
              <Car className="w-4 h-4 text-brand-orange" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-0.5">Vehicle</p>
              <p className="text-white text-sm font-semibold">{booking.vehicleInfo}</p>
            </div>
          </div>

          {/* Service */}
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-brand-darker border border-gray-700 rounded-sm flex items-center justify-center shrink-0 mt-0.5">
              <BadgeCheck className="w-4 h-4 text-brand-orange" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-0.5">Service</p>
              <p className="text-white text-sm font-semibold">{booking.serviceName}</p>
            </div>
          </div>
        </div>

        {/* Notes */}
        {booking.notes && (
          <div className="mt-5 pt-5 border-t border-gray-800">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-brand-darker border border-gray-700 rounded-sm flex items-center justify-center shrink-0 mt-0.5">
                <FileText className="w-4 h-4 text-brand-orange" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-0.5">Notes</p>
                <p className="text-gray-300 text-sm leading-relaxed">{booking.notes}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Contact info */}
      <div className="bg-brand-dark border border-gray-800 rounded-sm p-6">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-5">Contact Information</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-brand-darker border border-gray-700 rounded-sm flex items-center justify-center shrink-0 mt-0.5">
              <User className="w-4 h-4 text-gray-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-0.5">Name</p>
              <p className="text-gray-300 text-sm">{booking.name}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-brand-darker border border-gray-700 rounded-sm flex items-center justify-center shrink-0 mt-0.5">
              <Mail className="w-4 h-4 text-gray-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-0.5">Email</p>
              <p className="text-gray-300 text-sm break-all">{booking.email}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-brand-darker border border-gray-700 rounded-sm flex items-center justify-center shrink-0 mt-0.5">
              <Phone className="w-4 h-4 text-gray-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-0.5">Phone</p>
              <p className="text-gray-300 text-sm">{booking.phone}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Media attachments */}
      {hasMedia && (
        <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">
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
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="group block aspect-video bg-brand-darker rounded-sm overflow-hidden border border-gray-700 hover:border-brand-orange/50 transition-colors">
                  <img src={url} alt={`Attachment ${i + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Build Progress Feed */}
      {buildUpdates.length > 0 && (
        <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">
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
                        className="group block aspect-video bg-brand-darker rounded-sm overflow-hidden border border-gray-700 hover:border-brand-orange/50 transition-colors"
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
        <div className="bg-brand-dark border border-gray-800 rounded-sm px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-white text-sm font-semibold">Receipt / Summary</p>
            <p className="text-gray-500 text-xs mt-0.5">Print or save as PDF</p>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 border border-gray-700 text-gray-300 hover:border-brand-orange hover:text-brand-orange px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors rounded-sm"
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

      {/* Action buttons */}
      {canModify && (
        <div className="bg-brand-dark border border-gray-800 rounded-sm px-6 py-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4">Actions</p>
          <div className="flex flex-wrap gap-3">
            {!rescheduling && (
              <button
                onClick={() => setRescheduling(true)}
                disabled={isConfirmed}
                className="flex items-center gap-2 border border-brand-orange/50 text-brand-orange hover:bg-brand-orange/10 px-5 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors rounded-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Edit3 className="w-3.5 h-3.5" /> Reschedule
              </button>
            )}
            <button
              onClick={() => setCancelTarget(true)}
              disabled={isConfirmed}
              className="flex items-center gap-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 px-5 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors rounded-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <XCircle className="w-3.5 h-3.5" /> Cancel Booking
            </button>
          </div>
        </div>
      )}

      {/* Cancel confirmation modal */}
      {cancelTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-brand-dark border border-gray-700 rounded-sm p-6 max-w-sm w-full space-y-4">
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
                className="flex-1 flex items-center justify-center gap-2 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors rounded-sm disabled:opacity-50"
              >
                {cancelBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                Yes, Cancel It
              </button>
              <button
                onClick={() => setCancelTarget(false)}
                disabled={cancelBusy}
                className="flex-1 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors rounded-sm disabled:opacity-50"
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
