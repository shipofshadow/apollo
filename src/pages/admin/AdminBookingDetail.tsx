import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  ArrowLeft, Calendar, Car, CheckCircle2, Clock, Edit3,
  FileText, Hash, Image as ImageIcon, Loader2, Mail,
  Package, PenLine, Phone, User, Wrench, X, XCircle,
  ChevronLeft, ChevronRight, AlertTriangle, RefreshCw,
  ClipboardList, BadgeCheck,
} from 'lucide-react';
import {
  fetchAllBookingsAsync,
  updateBookingStatusAsync,
  adminRescheduleBookingAsync,
} from '../../store/bookingSlice';
import { updateBookingPartsApi, fetchAvailabilityApi, fetchShopHoursApi } from '../../services/api';
import type { AppDispatch, RootState } from '../../store';
import type { Booking, ShopDayHours } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatStatus } from '../../utils/formatStatus';

// ── Types ─────────────────────────────────────────────────────────────────────

interface LogEntry {
  timestamp: string;
  action: string;
  detail?: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<Booking['status'], string> = {
  pending:        'bg-yellow-500/10 text-yellow-400  border-yellow-500/30',
  confirmed:      'bg-green-500/10  text-green-400   border-green-500/30',
  completed:      'bg-blue-500/10   text-blue-400    border-blue-500/30',
  cancelled:      'bg-gray-700      text-gray-400    border-gray-600',
  awaiting_parts: 'bg-purple-500/10 text-purple-400  border-purple-500/30',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDateList(shopHours: ShopDayHours[]): Date[] {
  const openDays = shopHours.length
    ? new Set(shopHours.filter(h => h.isOpen).map(h => h.dayOfWeek))
    : new Set([1, 2, 3, 4, 5, 6]);
  const dates: Date[] = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() + 1);
  while (dates.length < 30) {
    if (openDays.has(cursor.getDay())) dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function isoFromDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

// ── AdminReschedulePanel ──────────────────────────────────────────────────────

interface ReschedulePanelProps {
  booking: Booking;
  token: string;
  onSuccess: (updated: Booking, logEntry: LogEntry) => void;
  onCancel: () => void;
}

function AdminReschedulePanel({ booking, token, onSuccess, onCancel }: ReschedulePanelProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { showToast } = useToast();

  const [shopHours,   setShopHours]   = useState<ShopDayHours[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [bookedSlots,    setBookedSlots]    = useState<string[]>([]);
  const [slotCounts,     setSlotCounts]     = useState<Record<string, number>>({});
  const [slotCapacity,   setSlotCapacity]   = useState(3);
  const [shopDayIsOpen,  setShopDayIsOpen]  = useState(true);
  const [slotsLoading,   setSlotsLoading]   = useState(false);
  const [saveBusy,       setSaveBusy]       = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchShopHoursApi()
      .then(({ hours }) => setShopHours(hours))
      .catch(() => {});
  }, []);

  const availableDates = buildDateList(shopHours);

  const handleDateSelect = async (date: Date) => {
    setSelectedDate(date);
    setSelectedTime('');
    setAvailableSlots([]);
    setBookedSlots([]);
    setSlotCounts({});
    setShopDayIsOpen(true);
    setSlotsLoading(true);
    try {
      const res = await fetchAvailabilityApi(isoFromDate(date));
      setShopDayIsOpen(res.isOpen);
      setAvailableSlots(res.availableSlots);
      // Exclude the booking's own current slot from the "booked" list so it shows as available
      const filtered = res.bookedSlots.filter(
        s => !(isoFromDate(date) === booking.appointmentDate && s === booking.appointmentTime)
      );
      setBookedSlots(filtered);
      setSlotCounts(res.slotCounts ?? {});
      setSlotCapacity(res.slotCapacity ?? 3);
    } catch { /* show all slots */ }
    finally { setSlotsLoading(false); }
  };

  const handleSave = async () => {
    if (!selectedDate || !selectedTime) return;
    const dateStr = isoFromDate(selectedDate);
    setSaveBusy(true);
    try {
      const updated = await dispatch(
        adminRescheduleBookingAsync({ token, id: booking.id, appointmentDate: dateStr, appointmentTime: selectedTime })
      ).unwrap();
      showToast('Appointment rescheduled.', 'success');
      onSuccess(updated, {
        timestamp: new Date().toISOString(),
        action: 'Rescheduled',
        detail: `${booking.appointmentDate} ${booking.appointmentTime} → ${dateStr} ${selectedTime}`,
      });
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Failed to reschedule.', 'error');
    } finally {
      setSaveBusy(false);
    }
  };

  const openSlots = availableSlots.filter(s => !bookedSlots.includes(s));
  const unchanged = selectedDate
    ? (isoFromDate(selectedDate) === booking.appointmentDate && selectedTime === booking.appointmentTime)
    : false;

  return (
    <div className="space-y-5">
      {/* Date carousel */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">New Date</p>
        <div className="relative">
          <button
            type="button"
            onClick={() => scrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-brand-darker border border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white -translate-x-3 shadow-md"
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
              const isCurrentBookingDate = isoFromDate(date) === booking.appointmentDate;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleDateSelect(date)}
                  className={`snap-start shrink-0 w-20 p-3 border text-center transition-all rounded-sm relative ${
                    active
                      ? 'border-brand-orange bg-brand-orange/10'
                      : 'border-gray-800 hover:border-gray-600 bg-brand-darker'
                  }`}
                >
                  <div className="text-[10px] text-gray-500 uppercase mb-1">
                    {date.toLocaleDateString('en-PH', { weekday: 'short' })}
                  </div>
                  <div className="text-xl font-display font-bold text-white">{date.getDate()}</div>
                  <div className="text-[10px] text-gray-500 uppercase mt-1">
                    {date.toLocaleDateString('en-PH', { month: 'short' })}
                  </div>
                  {isCurrentBookingDate && (
                    <div className="absolute bottom-1 left-0 right-0 flex justify-center">
                      <span className="w-1 h-1 rounded-full bg-brand-orange" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => scrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-brand-darker border border-gray-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white translate-x-3 shadow-md"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        {selectedDate && (
          <p className="text-xs text-brand-orange mt-2">
            Selected: {selectedDate.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}
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
            <p className="text-sm text-gray-500 py-2">No available slots for this date.</p>
          )}
          {!slotsLoading && shopDayIsOpen && openSlots.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {openSlots.map(slot => {
                const isSelected = selectedTime === slot;
                const spotsLeft  = slotCapacity - (slotCounts[slot] ?? 0);
                const almostFull = spotsLeft === 1;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSelectedTime(slot)}
                    className={`flex flex-col items-center justify-center px-2 py-3 rounded-sm border font-bold transition-colors ${
                      isSelected
                        ? 'bg-brand-orange border-brand-orange text-white'
                        : 'bg-brand-darker border-gray-700 text-white hover:border-brand-orange hover:text-brand-orange'
                    }`}
                  >
                    <span className="text-sm leading-tight">{slot}</span>
                    {spotsLeft > 0 && (
                      <span className={`text-[10px] font-semibold mt-1 ${
                        isSelected ? 'text-orange-100' : almostFull ? 'text-yellow-400' : 'text-gray-500'
                      }`}>
                        {almostFull ? 'Last spot!' : `${spotsLeft} left`}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1 border-t border-gray-800">
        <button
          onClick={handleSave}
          disabled={saveBusy || !selectedDate || !selectedTime || unchanged}
          className="flex items-center gap-2 bg-brand-orange text-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm disabled:opacity-50"
        >
          {saveBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Confirm Reschedule
        </button>
        <button
          onClick={onCancel}
          disabled={saveBusy}
          className="border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 px-5 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors rounded-sm disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  bookingId: string;
  onBack: () => void;
}

export default function AdminBookingDetail({ bookingId, onBack }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const { token } = useAuth();
  const { showToast } = useToast();
  const appointments = useSelector((s: RootState) => s.booking.appointments);

  const booking = appointments.find(b => b.id === bookingId) ?? null;

  const [lightboxUrl,   setLightboxUrl]   = useState<string | null>(null);
  const [rescheduling,  setRescheduling]  = useState(false);
  const [partsOpen,     setPartsOpen]     = useState(false);
  const [partsNotes,    setPartsNotes]    = useState('');
  const [partsBusy,     setPartsBusy]     = useState(false);
  const [statusBusy,    setStatusBusy]    = useState<string | null>(null);
  const [log,           setLog]           = useState<LogEntry[]>([]);

  // Seed the log with the booking's submission time on mount
  useEffect(() => {
    if (!token) return;
    // Ensure we have fresh data
    dispatch(fetchAllBookingsAsync(token));
  }, [token, dispatch]);

  useEffect(() => {
    if (booking) {
      setLog([{
        timestamp: booking.createdAt,
        action: 'Booking submitted',
        detail: `Status: ${formatStatus(booking.status)}`,
      }]);
      setPartsNotes(booking.partsNotes ?? '');
    }
  // only run once when booking first loads
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  const addLog = (entry: LogEntry) => setLog(prev => [...prev, entry]);

  const handleStatus = async (newStatus: Booking['status']) => {
    if (!token || !booking) return;
    setStatusBusy(newStatus);
    try {
      await dispatch(updateBookingStatusAsync({ token, id: booking.id, status: newStatus })).unwrap();
      showToast(`Status updated to ${formatStatus(newStatus)}.`, 'success');
      addLog({
        timestamp: new Date().toISOString(),
        action: `Status changed to ${formatStatus(newStatus)}`,
        detail: `From: ${formatStatus(booking.status)}`,
      });
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Failed to update status.', 'error');
    } finally {
      setStatusBusy(null);
    }
  };

  const handlePartsSave = async () => {
    if (!token || !booking) return;
    setPartsBusy(true);
    try {
      await updateBookingPartsApi(token, booking.id, true, partsNotes);
      await dispatch(updateBookingStatusAsync({ token, id: booking.id, status: 'awaiting_parts' })).unwrap();
      showToast('Parts info saved. Customer notified.', 'success');
      addLog({
        timestamp: new Date().toISOString(),
        action: 'Flagged: Awaiting Parts',
        detail: partsNotes,
      });
      setPartsOpen(false);
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Failed to save parts info.', 'error');
    } finally {
      setPartsBusy(false); }
  };

  if (!booking) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Bookings
        </button>
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 px-5 py-4 rounded-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <p className="text-sm">Booking not found. It may have been deleted.</p>
        </div>
      </div>
    );
  }

  const canModify = booking.status === 'pending' || booking.status === 'confirmed' || booking.status === 'awaiting_parts';
  const canConfirm  = booking.status === 'pending';
  const canComplete = booking.status === 'confirmed';
  const canResume   = booking.status === 'awaiting_parts';
  const canCancel   = canModify;

  return (
    <div className="space-y-5 max-w-4xl">

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
            <X className="w-7 h-7" />
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

      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Back</span>
        </button>
        <div className="h-5 w-px bg-gray-800" />
        <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
          <div className="min-w-0">
            <h2 className="text-lg font-display font-bold text-white uppercase tracking-tight truncate">
              {booking.name}
              <span className="hidden sm:inline text-gray-600 font-normal"> · </span>
              <span className="hidden sm:inline text-gray-400 text-base">{booking.serviceName}</span>
            </h2>
            <p className="text-gray-600 text-xs font-mono flex items-center gap-1 mt-0.5">
              <Hash className="w-3 h-3" />{booking.id}
            </p>
          </div>
          <span className={`ml-auto px-2.5 py-1 text-xs font-bold uppercase tracking-widest rounded-sm border shrink-0 ${STATUS_STYLES[booking.status]}`}>
            {formatStatus(booking.status)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Left column ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Customer */}
          <section className="bg-brand-dark border border-gray-800 rounded-sm p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> Customer
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-brand-darker border border-gray-800 rounded-sm px-4 py-3">
                <p className="text-[10px] text-gray-500 flex items-center gap-1 mb-1.5"><User className="w-3 h-3" /> Name</p>
                <p className="text-white text-sm font-semibold">{booking.name}</p>
              </div>
              <div className="bg-brand-darker border border-gray-800 rounded-sm px-4 py-3">
                <p className="text-[10px] text-gray-500 flex items-center gap-1 mb-1.5"><Mail className="w-3 h-3" /> Email</p>
                <a href={`mailto:${booking.email}`} className="text-gray-200 text-sm break-all hover:text-brand-orange transition-colors">{booking.email}</a>
              </div>
              <div className="bg-brand-darker border border-gray-800 rounded-sm px-4 py-3">
                <p className="text-[10px] text-gray-500 flex items-center gap-1 mb-1.5"><Phone className="w-3 h-3" /> Phone</p>
                <a href={`tel:${booking.phone}`} className="text-gray-200 text-sm hover:text-brand-orange transition-colors">{booking.phone}</a>
              </div>
            </div>
          </section>

          {/* Vehicle */}
          <section className="bg-brand-dark border border-gray-800 rounded-sm p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5" /> Vehicle
            </p>
            <div className="bg-brand-darker border border-gray-800 rounded-sm px-4 py-3">
              <p className="text-white text-sm font-semibold">{booking.vehicleInfo}</p>
              {(booking.vehicleYear || booking.vehicleMake || booking.vehicleModel) && (
                <p className="text-gray-500 text-xs mt-1">
                  {[booking.vehicleYear, booking.vehicleMake, booking.vehicleModel].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </section>

          {/* Service & Appointment */}
          <section className="bg-brand-dark border border-gray-800 rounded-sm p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5" /> Service &amp; Appointment
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-brand-darker border border-gray-800 rounded-sm px-4 py-3">
                <p className="text-[10px] text-gray-500 flex items-center gap-1 mb-1.5"><Calendar className="w-3 h-3" /> Date</p>
                <p className="text-gray-200 text-sm font-medium">{booking.appointmentDate}</p>
              </div>
              <div className="bg-brand-darker border border-gray-800 rounded-sm px-4 py-3">
                <p className="text-[10px] text-gray-500 flex items-center gap-1 mb-1.5"><Clock className="w-3 h-3" /> Time</p>
                <p className="text-gray-200 text-sm font-medium">{booking.appointmentTime}</p>
              </div>
              <div className="sm:col-span-3 bg-brand-darker border border-gray-800 rounded-sm px-4 py-3">
                <p className="text-[10px] text-gray-500 flex items-center gap-1 mb-1.5"><Wrench className="w-3 h-3" /> Service(s)</p>
                <p className="text-gray-200 text-sm">{booking.serviceName}</p>
              </div>
            </div>
          </section>

          {/* Notes */}
          {booking.notes && (
            <section className="bg-brand-dark border border-gray-800 rounded-sm p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Customer Notes
              </p>
              <div className="bg-brand-darker border border-gray-800 rounded-sm px-4 py-3">
                <p className="text-gray-200 text-sm whitespace-pre-wrap">{booking.notes}</p>
              </div>
            </section>
          )}

          {/* Parts / Awaiting */}
          <section className="bg-brand-dark border border-gray-800 rounded-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5" /> Parts / Awaiting
              </p>
              {canModify && !partsOpen && (
                <button
                  onClick={() => setPartsOpen(true)}
                  className="text-xs font-bold uppercase tracking-widest text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
                >
                  <Edit3 className="w-3 h-3" /> {booking.partsNotes ? 'Edit' : 'Flag'}
                </button>
              )}
            </div>

            {!partsOpen && (
              booking.partsNotes
                ? <div className="bg-purple-500/5 border border-purple-500/30 rounded-sm px-4 py-3">
                    <p className="text-purple-200 text-sm whitespace-pre-wrap">{booking.partsNotes}</p>
                  </div>
                : <p className="text-gray-600 text-sm italic">No parts notes recorded.</p>
            )}

            {partsOpen && (
              <div className="space-y-3">
                <textarea
                  rows={4}
                  value={partsNotes}
                  onChange={e => setPartsNotes(e.target.value)}
                  placeholder="e.g. Custom AES shrouds ordered from Japan — ETA 7–10 days"
                  className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-purple-400 transition-colors resize-none rounded-sm text-sm"
                />
                <div className="flex gap-3">
                  <button
                    onClick={handlePartsSave}
                    disabled={partsBusy || !partsNotes.trim()}
                    className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 text-xs font-bold uppercase tracking-widest rounded-sm transition-colors disabled:opacity-50"
                  >
                    {partsBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                    Save &amp; Notify
                  </button>
                  <button
                    onClick={() => { setPartsOpen(false); setPartsNotes(booking.partsNotes ?? ''); }}
                    disabled={partsBusy}
                    className="border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 px-5 py-2 text-xs font-bold uppercase tracking-widest transition-colors rounded-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Admin Reschedule */}
          <section className="bg-brand-dark border border-gray-800 rounded-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-orange flex items-center gap-1.5">
                <Edit3 className="w-3.5 h-3.5" /> Reschedule Appointment
              </p>
              {!rescheduling && (
                <button
                  onClick={() => setRescheduling(true)}
                  className="text-xs font-bold uppercase tracking-widest text-brand-orange hover:text-orange-400 transition-colors flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Reschedule
                </button>
              )}
            </div>
            {!rescheduling ? (
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <Calendar className="w-4 h-4 text-gray-600" />
                  <span>{booking.appointmentDate}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <Clock className="w-4 h-4 text-gray-600" />
                  <span>{booking.appointmentTime}</span>
                </div>
              </div>
            ) : (
              token && (
                <AdminReschedulePanel
                  booking={booking}
                  token={token}
                  // TypeScript fix is here!
                  onSuccess={(_updated, entry) => {
                    addLog(entry);
                    setRescheduling(false);
                  }}
                  onCancel={() => setRescheduling(false)}
                />
              )
            )}
          </section>

          {/* Reference Photos */}
          {booking.mediaUrls && booking.mediaUrls.length > 0 && (
            <section className="bg-brand-dark border border-gray-800 rounded-sm p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" /> Reference Photos ({booking.mediaUrls.length})
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {booking.mediaUrls.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setLightboxUrl(url)}
                    className="aspect-square overflow-hidden rounded-sm border border-gray-700 hover:border-brand-orange transition-colors"
                  >
                    <img
                      src={url}
                      alt={`Photo ${i + 1}`}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Signature */}
          {booking.signatureData && (
            <section className="bg-brand-dark border border-gray-800 rounded-sm p-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-1.5">
                <PenLine className="w-3.5 h-3.5" /> Waiver Signature
              </p>
              <div className="bg-brand-darker border border-gray-800 rounded-sm p-4 flex items-center justify-center">
                <img
                  src={booking.signatureData}
                  alt="Customer signature"
                  className="max-w-full h-20 object-contain"
                />
              </div>
            </section>
          )}
        </div>

        {/* ── Right column ── */}
        <div className="space-y-5">

          {/* Quick Actions */}
          <section className="bg-brand-dark border border-gray-800 rounded-sm p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" /> Quick Actions
            </p>
            <div className="space-y-2">
              {canConfirm && (
                <button
                  onClick={() => handleStatus('confirmed')}
                  disabled={statusBusy !== null}
                  className="w-full flex items-center gap-2 px-4 py-2.5 bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 text-xs font-bold uppercase tracking-widest rounded-sm transition-colors disabled:opacity-50"
                >
                  {statusBusy === 'confirmed' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Confirm Booking
                </button>
              )}
              {canComplete && (
                <button
                  onClick={() => handleStatus('completed')}
                  disabled={statusBusy !== null}
                  className="w-full flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 text-xs font-bold uppercase tracking-widest rounded-sm transition-colors disabled:opacity-50"
                >
                  {statusBusy === 'completed' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BadgeCheck className="w-3.5 h-3.5" />}
                  Mark Completed
                </button>
              )}
              {canResume && (
                <button
                  onClick={() => handleStatus('confirmed')}
                  disabled={statusBusy !== null}
                  className="w-full flex items-center gap-2 px-4 py-2.5 bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 text-xs font-bold uppercase tracking-widest rounded-sm transition-colors disabled:opacity-50"
                >
                  {statusBusy === 'confirmed' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Resume (Parts Arrived)
                </button>
              )}
              {canCancel && (
                <button
                  onClick={() => handleStatus('cancelled')}
                  disabled={statusBusy !== null}
                  className="w-full flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-bold uppercase tracking-widest rounded-sm transition-colors disabled:opacity-50"
                >
                  {statusBusy === 'cancelled' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                  Cancel Booking
                </button>
              )}
              {!canModify && (
                <p className="text-gray-600 text-xs italic">No actions available for a {formatStatus(booking.status).toLowerCase()} booking.</p>
              )}
            </div>
          </section>

          {/* Booking Meta */}
          <section className="bg-brand-dark border border-gray-800 rounded-sm p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4">Booking Info</p>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">Submitted</span>
                <span className="text-gray-300 text-xs">{new Date(booking.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">Status</span>
                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-sm border ${STATUS_STYLES[booking.status]}`}>
                  {formatStatus(booking.status)}
                </span>
              </div>
              {booking.userId && (
                <div className="flex justify-between">
                  <span className="text-gray-500 text-xs">User ID</span>
                  <span className="text-gray-300 text-xs font-mono">#{booking.userId}</span>
                </div>
              )}
            </div>
          </section>

          {/* Activity Log */}
          <section className="bg-brand-dark border border-gray-800 rounded-sm p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" /> Activity Log
            </p>
            {log.length === 0 ? (
              <p className="text-gray-600 text-xs italic">No activity yet this session.</p>
            ) : (
              <ol className="relative border-l border-gray-800 space-y-4 ml-2">
                {log.slice().reverse().map((entry, i) => (
                  <li key={i} className="ml-4">
                    <span className="absolute -left-1.5 w-3 h-3 rounded-full bg-brand-orange/80 border-2 border-brand-darker" />
                    <p className="text-xs font-bold text-white">{entry.action}</p>
                    {entry.detail && (
                      <p className="text-gray-500 text-[11px] mt-0.5 leading-snug">{entry.detail}</p>
                    )}
                    <p className="text-gray-700 text-[10px] mt-1">
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}