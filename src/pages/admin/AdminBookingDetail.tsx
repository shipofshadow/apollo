import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  ArrowLeft, Car, CheckCircle2, Clock, Edit3,
  FileText, Image as ImageIcon, Loader2, Mail,
  Package, Phone, User, Wrench, X, XCircle,
  ChevronLeft, ChevronRight, AlertTriangle, RefreshCw,
  ClipboardList, BadgeCheck, Camera, Plus, StickyNote, Trash2,
  Shield, Award, Activity
} from 'lucide-react';
import {
  fetchAllBookingsAsync,
  updateBookingStatusAsync,
  adminRescheduleBookingAsync,
} from '../../store/bookingSlice';
import {
  updateBookingPartsApi,
  fetchAvailabilityApi,
  fetchShopHoursApi,
  fetchShopClosedDatesApi,
  fetchBuildUpdatesApi,
  fetchBookingActivityApi,
  createBuildUpdateApi,
  uploadBuildUpdateMediaApi,
  updateInternalNotesApi,
  updateBookingQaPhotosApi,
  deleteBookingApi,
  fetchCustomerStatsApi,
  fetchTeamMembersApi,
  fetchAdminUsersApi,
  assignBookingTechnicianApi,
  type AdminManagedUser,
} from '../../services/api';
import type { AppDispatch, RootState } from '../../store';
import type { Booking, BuildUpdate, ShopDayHours, CustomerStats, BookingActivityLog, TeamMember } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatStatus } from '../../utils/formatStatus';

// ── Types ─────────────────────────────────────────────────────────────────────

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<Booking['status'], string> = {
  pending:        'bg-yellow-500/10 text-yellow-500  border-yellow-500/30',
  confirmed:      'bg-green-500/10  text-green-400   border-green-500/30',
  completed:      'bg-blue-500/10   text-blue-400    border-blue-500/30',
  cancelled:      'bg-[#1a1a1a]     text-gray-500    border-gray-800',
  awaiting_parts: 'bg-purple-500/10 text-purple-400  border-purple-500/30',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── AdminReschedulePanel ──────────────────────────────────────────────────────

interface ReschedulePanelProps {
  booking: Booking;
  token: string;
  onSuccess: (updated: Booking) => void;
  onCancel: () => void;
}

function AdminReschedulePanel({ booking, token, onSuccess, onCancel }: ReschedulePanelProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { showToast } = useToast();

  const [shopHours,   setShopHours]   = useState<ShopDayHours[]>([]);
  const [closedDatesSet, setClosedDatesSet] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [bookedSlots,    setBookedSlots]    = useState<string[]>([]);
  const [slotCounts,     setSlotCounts]     = useState<Record<string, number>>({});
  const [slotCapacity,   setSlotCapacity]   = useState(3);
  const [shopDayIsOpen,  setShopDayIsOpen]  = useState(true);
  const [slotsLoading,   setSlotsLoading]   = useState(false);
  const [saveBusy,       setSaveBusy]       = useState(false);
  const [confirmOpen,    setConfirmOpen]    = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([fetchShopHoursApi(), fetchShopClosedDatesApi()])
      .then(([{ hours }, cdData]) => {
        setShopHours(hours);
        const cd = (cdData as { closedDates: { date: string }[] }).closedDates ?? [];
        setClosedDatesSet(new Set(cd.map(d => d.date)));
      })
      .catch(() => {});
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
      onSuccess(updated);
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
    <div className="space-y-5 bg-[#121212] border border-gray-800 p-5 rounded mt-4">
      {/* Date carousel */}
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
              const isCurrentBookingDate = isoFromDate(date) === booking.appointmentDate;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleDateSelect(date)}
                  className={`snap-start shrink-0 w-20 p-3 border text-center transition-all rounded relative ${
                    active
                      ? 'border-brand-orange bg-brand-orange/10'
                      : 'border-gray-800 hover:border-gray-600 bg-[#181818]'
                  }`}
                >
                  <div className="text-[10px] text-gray-500 uppercase font-mono mb-1">
                    {date.toLocaleDateString('en-PH', { weekday: 'short' })}
                  </div>
                  <div className="text-xl font-bold text-white">{date.getDate()}</div>
                  <div className="text-[10px] text-gray-500 uppercase font-mono mt-1">
                    {date.toLocaleDateString('en-PH', { month: 'short' })}
                  </div>
                  {isCurrentBookingDate && (
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
             Selection: {selectedDate.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        )}
      </div>

      {/* Time slots */}
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
              [SYSTEM] Shop offline on selected date.
            </p>
          )}
          {!slotsLoading && shopDayIsOpen && openSlots.length === 0 && (
            <p className="text-xs text-gray-500 font-mono py-2">[SYSTEM] Zero capacity for selected date.</p>
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
                    className={`flex flex-col items-center justify-center p-3 rounded border font-mono transition-all ${
                      isSelected
                        ? 'bg-brand-orange/20 border-brand-orange text-brand-orange shadow-[inset_0_0_10px_rgba(249,115,22,0.2)]'
                        : 'bg-[#181818] border-gray-800 text-gray-300 hover:border-gray-500 hover:text-white'
                    }`}
                  >
                    <span className="text-sm font-bold">{slot}</span>
                    {spotsLeft > 0 && (
                      <span className={`text-[9px] uppercase tracking-wider mt-1.5 ${
                        isSelected ? 'text-brand-orange' : almostFull ? 'text-yellow-500' : 'text-gray-600'
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

      {/* Actions */}
      <div className="flex items-center gap-3 pt-5 mt-5 border-t border-gray-800">
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={saveBusy || !selectedDate || !selectedTime || unchanged}
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-brand-orange text-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {saveBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Execute Reschedule
        </button>
        <button
          onClick={onCancel}
          disabled={saveBusy}
          className="flex-1 sm:flex-none border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 px-5 py-2.5 text-xs font-bold uppercase tracking-widest transition-colors rounded disabled:opacity-30"
        >
          Abort
        </button>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded border border-gray-700 bg-[#121212] p-6 shadow-2xl">
            <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-orange mb-4 border-b border-gray-800 pb-2">
              // Authorization Required
            </h3>
            <p className="text-sm text-gray-300 mb-6">Execute time modification for this dispatch sequence?</p>
            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={saveBusy}
                className="px-4 py-2 rounded border border-gray-700 text-xs font-bold uppercase tracking-widest text-gray-400 hover:border-gray-500 hover:text-white disabled:opacity-30 transition-colors"
              >
                Abort
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleSave();
                  setConfirmOpen(false);
                }}
                disabled={saveBusy}
                className="px-4 py-2 rounded bg-brand-orange text-xs font-bold uppercase tracking-widest text-white hover:bg-orange-600 disabled:opacity-30 transition-colors"
              >
                {saveBusy ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  bookingId: string;
  onBack: () => void;
}

type ConfirmDialogState = {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: 'default' | 'danger';
};

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
  const [deleteBusy,    setDeleteBusy]    = useState(false);
  const [activityLogs,  setActivityLogs]  = useState<BookingActivityLog[]>([]);
  const [teamMembers,   setTeamMembers]   = useState<TeamMember[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AdminManagedUser[]>([]);
  const [selectedTechUserId, setSelectedTechUserId] = useState('');
  const [assignTechBusy, setAssignTechBusy] = useState(false);

  // Internal notes state
  const [internalNotes,     setInternalNotes]     = useState('');
  const [notesEditing,      setNotesEditing]      = useState(false);
  const [notesBusy,         setNotesBusy]         = useState(false);

  // Customer loyalty stats
  const [customerStats,     setCustomerStats]     = useState<CustomerStats | null>(null);

  // Build updates state
  const [buildUpdates,      setBuildUpdates]      = useState<BuildUpdate[]>([]);
  const [buildUpdateOpen,   setBuildUpdateOpen]   = useState(false);
  const [buildUpdateNote,   setBuildUpdateNote]   = useState('');
  const [buildUpdatePhotos, setBuildUpdatePhotos] = useState<string[]>([]);
  const [buildUpdateBusy,   setBuildUpdateBusy]   = useState(false);
  const [photoUploading,    setPhotoUploading]    = useState(false);
  const buildPhotoInputRef = useRef<HTMLInputElement>(null);
  const [beforePhotos,      setBeforePhotos]      = useState<string[]>([]);
  const [afterPhotos,       setAfterPhotos]       = useState<string[]>([]);
  const [qaUploadingStage,  setQaUploadingStage]  = useState<'before' | 'after' | null>(null);
  const [qaSavingStage,     setQaSavingStage]     = useState<'before' | 'after' | null>(null);
  const [checkInOpen,       setCheckInOpen]       = useState(false);
  const [checkInBusy,       setCheckInBusy]       = useState(false);
  const [completeOpen,      setCompleteOpen]      = useState(false);
  const [completeBusy,      setCompleteBusy]      = useState(false);
  const beforePhotoInputRef = useRef<HTMLInputElement>(null);
  const afterPhotoInputRef = useRef<HTMLInputElement>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | (() => Promise<void>)>(null);

  useEffect(() => {
    if (!token) return;
    dispatch(fetchAllBookingsAsync(token));
  }, [token, dispatch]);

  useEffect(() => {
    if (!booking) return;

    setPartsNotes(booking.partsNotes ?? '');
    setInternalNotes(booking.internalNotes ?? '');
    setBeforePhotos(booking.beforePhotos ?? []);
    setAfterPhotos(booking.afterPhotos ?? []);
    if (booking.assignedTech?.userId != null) {
      setSelectedTechUserId(String(booking.assignedTech.userId));
    } else if (booking.assignedTechId != null) {
      const linked = teamMembers.find(member => member.id === booking.assignedTechId);
      setSelectedTechUserId(linked?.userId != null ? String(linked.userId) : '');
    } else {
      setSelectedTechUserId('');
    }

    if (token && booking.userId) {
      fetchCustomerStatsApi(token, booking.userId)
        .then(r => setCustomerStats(r.stats))
        .catch(() => {});
    }
  }, [booking, token, teamMembers]);

  useEffect(() => {
    if (!token) return;
    fetchTeamMembersApi(token)
      .then(({ members }) => setTeamMembers(members))
      .catch(() => setTeamMembers([]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    fetchAdminUsersApi(token)
      .then(({ users }) => setAssignableUsers(users.filter(user => user.role !== 'client')))
      .catch(() => setAssignableUsers([]));
  }, [token]);

  useEffect(() => {
    if (!token || !bookingId) return;
    fetchBuildUpdatesApi(token, bookingId)
      .then(({ updates }) => setBuildUpdates(updates))
      .catch(() => {});
  }, [token, bookingId]);

  const reloadActivity = async () => {
    if (!token || !bookingId) return;
    try {
      const { logs } = await fetchBookingActivityApi(token, bookingId);
      setActivityLogs(logs);
    } catch {
      setActivityLogs([]);
    }
  };

  useEffect(() => {
    void reloadActivity();
  }, [token, bookingId]);

  const requestConfirmation = (dialog: ConfirmDialogState, action: () => Promise<void>) => {
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

  const handleSaveInternalNotes = async () => {
    if (!token || !booking) return;
    setNotesBusy(true);
    try {
      await updateInternalNotesApi(token, booking.id, internalNotes);
      setNotesEditing(false);
      showToast('Internal notes saved.', 'success');
      await reloadActivity();
    } catch (e) {
      showToast((e as Error).message, 'error');
    } finally {
      setNotesBusy(false);
    }
  };

  const handleStatus = async (newStatus: Booking['status']) => {
    if (!token || !booking) return;
    setStatusBusy(newStatus);
    try {
      await dispatch(updateBookingStatusAsync({ token, id: booking.id, status: newStatus })).unwrap();
      showToast(`Status updated to ${formatStatus(newStatus)}.`, 'success');
      await reloadActivity();
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Failed to update status.', 'error');
    } finally {
      setStatusBusy(null);
    }
  };

  const handleDeleteBooking = async () => {
    if (!token || !booking) return;
    setDeleteBusy(true);
    try {
      await deleteBookingApi(token, booking.id);
      await dispatch(fetchAllBookingsAsync(token)).unwrap();
      showToast('Booking deleted.', 'success');
      onBack();
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Failed to delete booking.', 'error');
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleAssignTechnician = async () => {
    if (!token || !booking) return;
    const assignedUserId = selectedTechUserId === '' ? null : Number(selectedTechUserId);
    if (assignedUserId !== null && (!Number.isInteger(assignedUserId) || assignedUserId <= 0)) {
      showToast('Please select a valid technician.', 'error');
      return;
    }

    setAssignTechBusy(true);
    try {
      await assignBookingTechnicianApi(token, booking.id, { assignedUserId });
      await dispatch(fetchAllBookingsAsync(token)).unwrap();
      await reloadActivity();
      showToast(assignedUserId ? 'Technician assigned.' : 'Technician unassigned.', 'success');
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Failed to assign technician.', 'error');
    } finally {
      setAssignTechBusy(false);
    }
  };

  const handlePartsSave = async () => {
    if (!token || !booking) return;
    setPartsBusy(true);
    try {
      await updateBookingPartsApi(token, booking.id, true, partsNotes);
      await dispatch(updateBookingStatusAsync({ token, id: booking.id, status: 'awaiting_parts' })).unwrap();
      showToast('Parts info saved. Customer notified.', 'success');
      await reloadActivity();
      setPartsOpen(false);
    } catch (e: unknown) {
      showToast((e as Error).message ?? 'Failed to save parts info.', 'error');
    } finally {
      setPartsBusy(false); }
  };

  const handleBuildPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!token || !e.target.files?.length) return;
    const files = Array.from(e.target.files);
    setPhotoUploading(true);
    try {
      const urls = await uploadBuildUpdateMediaApi(token, booking!.id, files);
      setBuildUpdatePhotos(prev => [...prev, ...urls]);
    } catch (err: unknown) {
      showToast((err as Error).message ?? 'Photo upload failed.', 'error');
    } finally {
      setPhotoUploading(false);
      if (buildPhotoInputRef.current) buildPhotoInputRef.current.value = '';
    }
  };

  const handleBuildUpdateSubmit = async () => {
    if (!token || !booking) return;
    if (!buildUpdateNote.trim() && buildUpdatePhotos.length === 0) return;
    setBuildUpdateBusy(true);
    try {
      const { update } = await createBuildUpdateApi(token, booking.id, {
        note: buildUpdateNote.trim(),
        photoUrls: buildUpdatePhotos,
      });
      setBuildUpdates(prev => [...prev, update]);
      setBuildUpdateNote('');
      setBuildUpdatePhotos([]);
      setBuildUpdateOpen(false);
      showToast('Build update posted.', 'success');
      await reloadActivity();
    } catch (err: unknown) {
      showToast((err as Error).message ?? 'Failed to post update.', 'error');
    } finally {
      setBuildUpdateBusy(false);
    }
  };

  const handleQaPhotoUpload = async (
    stage: 'before' | 'after',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!token || !booking || !e.target.files?.length) return;

    setQaUploadingStage(stage);
    try {
      const urls = await uploadBuildUpdateMediaApi(token, booking.id, Array.from(e.target.files));
      if (stage === 'before') {
        setBeforePhotos(prev => [...prev, ...urls]);
      } else {
        setAfterPhotos(prev => [...prev, ...urls]);
      }
      showToast(`${urls.length} ${stage} photo(s) uploaded.`, 'success');
    } catch (err: unknown) {
      showToast((err as Error).message ?? 'Photo upload failed.', 'error');
    } finally {
      setQaUploadingStage(null);
      if (stage === 'before' && beforePhotoInputRef.current) beforePhotoInputRef.current.value = '';
      if (stage === 'after' && afterPhotoInputRef.current) afterPhotoInputRef.current.value = '';
    }
  };

  const handleSaveQaPhotos = async (stage: 'before' | 'after') => {
    if (!token || !booking) return;
    const photoUrls = stage === 'before' ? beforePhotos : afterPhotos;
    if (photoUrls.length === 0) {
      showToast(`Add at least one ${stage} photo.`, 'error');
      return;
    }

    setQaSavingStage(stage);
    try {
      await updateBookingQaPhotosApi(token, booking.id, { stage, photoUrls });
      await dispatch(fetchAllBookingsAsync(token)).unwrap();
      await reloadActivity();
      showToast(`${stage === 'before' ? 'Before' : 'After'} photos saved.`, 'success');
    } catch (err: unknown) {
      showToast((err as Error).message ?? 'Failed to save photos.', 'error');
    } finally {
      setQaSavingStage(null);
    }
  };

  const handleCheckInConfirm = async () => {
    if (!token || !booking) return;
    if (beforePhotos.length === 0) {
      showToast('Add at least one before photo to continue.', 'error');
      return;
    }

    setCheckInBusy(true);
    try {
      await updateBookingQaPhotosApi(token, booking.id, { stage: 'before', photoUrls: beforePhotos });
      await dispatch(fetchAllBookingsAsync(token)).unwrap();
      await handleStatus('confirmed');
      setCheckInOpen(false);
    } catch (err: unknown) {
      showToast((err as Error).message ?? 'Failed to confirm booking.', 'error');
    } finally {
      setCheckInBusy(false);
    }
  };

  const handleCompleteConfirm = async () => {
    if (!token || !booking) return;
    if (afterPhotos.length === 0) {
      showToast('Add at least one after photo to continue.', 'error');
      return;
    }

    setCompleteBusy(true);
    try {
      await updateBookingQaPhotosApi(token, booking.id, { stage: 'after', photoUrls: afterPhotos });
      await dispatch(fetchAllBookingsAsync(token)).unwrap();
      await handleStatus('completed');
      setCompleteOpen(false);
    } catch (err: unknown) {
      showToast((err as Error).message ?? 'Failed to complete booking.', 'error');
    } finally {
      setCompleteBusy(false);
    }
  };

  if (!booking) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="inline-flex items-center gap-2 text-gray-500 hover:text-white text-[10px] font-mono uppercase tracking-widest transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Return
        </button>
        <div className="flex items-center gap-3 bg-red-500/5 border border-red-500/20 text-red-400 px-5 py-4 rounded font-mono text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <p>Payload dropped. Booking not found in current state.</p>
        </div>
      </div>
    );
  }

  const canModify = booking.status === 'pending' || booking.status === 'confirmed' || booking.status === 'awaiting_parts';
  const canConfirm  = booking.status === 'pending';
  const canComplete = booking.status === 'confirmed';
  const canResume   = booking.status === 'awaiting_parts';
  const canCancel   = canModify;
  const isFinalized = booking.status === 'completed' || booking.status === 'cancelled';
  const hasBeforePhotos = beforePhotos.length > 0;
  const hasAfterPhotos = (booking.afterPhotos?.length ?? 0) > 0;

  return (
    <div className="space-y-6 w-full max-w-[1400px]">

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={lightboxUrl}
            alt="Asset Inspection"
            className="max-w-full max-h-[90vh] object-contain rounded border border-gray-800"
            referrerPolicy="no-referrer"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* Navigation & Header */}
      <div className="flex flex-col gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-gray-500 hover:text-brand-orange text-[10px] font-mono uppercase tracking-widest transition-colors w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Return to Operations
        </button>

        <div className="relative border border-gray-800/80 rounded-lg bg-[#121212] overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand-orange via-brand-orange/50 to-transparent" />
          
          <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-4">
                  <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-brand-orange/80">
                  Booking Details
                </p>
                <span className={`px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest rounded border ${STATUS_STYLES[booking.status]}`}>
                  {formatStatus(booking.status)}
                </span>
              </div>
              
              <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                {booking.name}
              </h1>
              
              <div className="flex items-center gap-3 pt-2 text-xs font-mono">
                {booking.referenceNumber && (
                  <span className="text-brand-orange bg-brand-orange/10 px-2.5 py-1 rounded border border-brand-orange/20 font-bold">
                    REF:{booking.referenceNumber}
                  </span>
                )}
                <span className="text-gray-500 bg-[#181818] px-2.5 py-1 rounded border border-gray-800">
                  Booking ID: {booking.id}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ── LEFT COLUMN (Core Payload & Execution) ── */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Core Specs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-800/50 border border-gray-800/80 rounded-lg overflow-hidden">
            
            {/* Payload (Service & Variations) */}
            <div className="bg-[#121212] p-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
                <Wrench className="w-3.5 h-3.5 text-gray-400" /> Service Details
              </p>
              <h3 className="text-lg font-bold text-gray-200 mb-2">{booking.serviceName}</h3>
              {booking.selectedVariations && booking.selectedVariations.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {booking.selectedVariations.map(v => (
                    <span key={`${v.serviceId}-${v.variationId}`} className="inline-flex items-center text-[10px] font-mono bg-white/5 border border-white/10 px-2 py-1 rounded text-gray-400">
                      <span className="text-brand-orange/60 mr-1.5">+</span>{v.variationName}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Target Asset (Vehicle) */}
            <div className="bg-[#121212] p-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
                <Car className="w-3.5 h-3.5 text-gray-400" /> Vehicle
              </p>
              <h3 className="text-lg font-bold text-white mb-2">{booking.vehicleInfo}</h3>
              {(booking.vehicleYear || booking.vehicleMake || booking.vehicleModel) && (
                <div className="flex gap-2">
                  {[
                    { label: 'YR', val: booking.vehicleYear },
                    { label: 'MK', val: booking.vehicleMake },
                    { label: 'MD', val: booking.vehicleModel }
                  ].map(spec => spec.val && (
                    <div key={spec.label} className="bg-[#181818] border border-gray-800 px-2 py-1 rounded text-center min-w-[40px]">
                      <p className="text-[8px] uppercase text-gray-600 font-bold mb-0.5">{spec.label}</p>
                      <p className="text-xs font-mono text-gray-300">{spec.val}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Client Identity */}
            <div className="bg-[#121212] p-6 md:col-span-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-gray-400" /> Customer Information
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-[#181818] border border-gray-800 flex items-center justify-center shrink-0">
                    <Mail className="w-3.5 h-3.5 text-gray-500" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[9px] text-gray-600 uppercase tracking-widest font-bold">Email</p>
                    <a href={`mailto:${booking.email}`} className="text-sm text-gray-300 hover:text-brand-orange transition-colors truncate block">{booking.email}</a>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-[#181818] border border-gray-800 flex items-center justify-center shrink-0">
                    <Phone className="w-3.5 h-3.5 text-gray-500" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[9px] text-gray-600 uppercase tracking-widest font-bold">Phone</p>
                    <a href={`tel:${booking.phone}`} className="text-sm font-mono text-gray-300 hover:text-brand-orange transition-colors truncate block">{booking.phone}</a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Dispatch Logic (Time & Operator) */}
          <div className="bg-[#121212] border border-gray-800/80 rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* Schedule */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-gray-400" /> Appointment Schedule
                  </p>
                  {!rescheduling && (
                    <button
                      onClick={() => setRescheduling(true)}
                      disabled={isFinalized}
                      className="text-[10px] font-bold uppercase tracking-widest text-brand-orange hover:text-orange-400 transition-colors flex items-center gap-1 disabled:opacity-30"
                    >
                      <Edit3 className="w-3 h-3" /> Change Time
                    </button>
                  )}
                </div>

                {!rescheduling ? (
                  <div className="space-y-3">
                    <div className="bg-[#181818] border border-gray-800 rounded p-3 flex justify-between items-center">
                      <span className="text-xs text-gray-500 font-mono">Date</span>
                      <span className="text-sm font-bold text-gray-200">{booking.appointmentDate}</span>
                    </div>
                    <div className="bg-[#181818] border border-gray-800 rounded p-3 flex justify-between items-center">
                      <span className="text-xs text-gray-500 font-mono">Time</span>
                      <span className="text-sm font-bold text-gray-200">{booking.appointmentTime}</span>
                    </div>
                  </div>
                ) : (
                  token && (
                    <AdminReschedulePanel
                      booking={booking}
                      token={token}
                      onSuccess={async (_updated) => {
                        await reloadActivity();
                        setRescheduling(false);
                      }}
                      onCancel={() => setRescheduling(false)}
                    />
                  )
                )}
              </div>

              {/* Operator */}
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
                  <Wrench className="w-3.5 h-3.5 text-gray-400" /> Assigned Technician
                </p>
                
                <div className="space-y-3">
                  <select
                    value={selectedTechUserId}
                    onChange={e => setSelectedTechUserId(e.target.value)}
                    disabled={isFinalized || assignTechBusy}
                    className="w-full bg-[#181818] border border-gray-800 text-white px-3 py-3 rounded focus:outline-none focus:border-brand-orange transition-colors text-sm font-semibold"
                  >
                    <option value="">[ Not Assigned ]</option>
                    {assignableUsers.map(member => (
                      <option key={member.id} value={member.id}>
                        {member.name}{member.role ? ` — ${member.role}` : ''}
                      </option>
                    ))}
                  </select>
                  
                  <button
                    type="button"
                    onClick={() => requestConfirmation(
                      {
                        title: 'Update Operator?',
                        message: selectedTechUserId
                          ? 'Locking in operator assignment for this payload.'
                          : 'Clearing current operator assignment.',
                        confirmLabel: 'Execute',
                      },
                      handleAssignTechnician,
                    )}
                    disabled={assignTechBusy || !token || isFinalized}
                    className="w-full py-2.5 bg-brand-darker border border-gray-700 hover:border-brand-orange text-gray-300 hover:text-brand-orange text-[10px] font-bold uppercase tracking-widest rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {assignTechBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    Save Technician
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Context Blocks (Notes & Parts) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-800/50 border border-gray-800/80 rounded-lg overflow-hidden">
            
            {/* Customer Notes */}
            <div className="bg-[#121212] p-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-gray-400" /> Customer Notes
              </p>
              {booking.notes ? (
                <div className="bg-[#181818] border border-gray-800 rounded p-4">
                  <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{booking.notes}</p>
                </div>
              ) : (
                <p className="text-gray-600 text-xs font-mono bg-[#181818] border border-gray-800 border-dashed rounded p-4 text-center">No notes provided.</p>
              )}
            </div>

            {/* Parts Notes */}
            <div className="bg-[#121212] p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-purple-400 flex items-center gap-2">
                  <Package className="w-3.5 h-3.5" /> Parts / Materials
                </p>
                {canModify && !partsOpen && (
                  <button
                    onClick={() => setPartsOpen(true)}
                    className="text-[10px] font-bold uppercase tracking-widest text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3" /> {booking.partsNotes ? 'Edit' : 'Add'}
                  </button>
                )}
              </div>

              {!partsOpen ? (
                booking.partsNotes ? (
                  <div className="bg-purple-500/5 border border-purple-500/20 rounded p-4">
                    <p className="text-purple-200 text-sm whitespace-pre-wrap">{booking.partsNotes}</p>
                  </div>
                ) : (
                  <p className="text-gray-600 text-xs font-mono bg-[#181818] border border-gray-800 border-dashed rounded p-4 text-center">No parts or materials pending.</p>
                )
              ) : (
                <div className="space-y-3">
                  <textarea
                    rows={4}
                    value={partsNotes}
                    onChange={e => setPartsNotes(e.target.value)}
                    placeholder="Enter missing parts or delivery info..."
                    className="w-full bg-[#181818] border border-gray-800 text-white px-3 py-3 rounded focus:outline-none focus:border-purple-400 transition-colors resize-none text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => requestConfirmation(
                        {
                          title: 'Save Parts Update?',
                          message: 'Save parts/materials notes and notify customer of delay.',
                          confirmLabel: 'Save & Notify',
                        },
                        handlePartsSave,
                      )}
                      disabled={partsBusy || !partsNotes.trim()}
                      className="flex-1 bg-purple-600/20 border border-purple-500/50 hover:bg-purple-600/40 text-purple-300 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded transition-colors disabled:opacity-30 flex items-center justify-center gap-2"
                    >
                      {partsBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Package className="w-3.5 h-3.5" />}
                      Save
                    </button>
                    <button
                      onClick={() => { setPartsOpen(false); setPartsNotes(booking.partsNotes ?? ''); }}
                      disabled={partsBusy}
                      className="px-4 py-2.5 bg-transparent border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 text-[10px] font-bold uppercase tracking-widest transition-colors rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Reference Imagery */}
          {booking.mediaUrls && booking.mediaUrls.length > 0 && (
            <div className="bg-[#121212] border border-gray-800/80 rounded-lg p-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
                <ImageIcon className="w-3.5 h-3.5 text-gray-400" /> Reference Photos [{booking.mediaUrls.length}]
              </p>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {booking.mediaUrls.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setLightboxUrl(url)}
                    className="aspect-square overflow-hidden rounded border border-gray-800 hover:border-brand-orange transition-colors relative group"
                  >
                    <div className="absolute inset-0 bg-brand-orange/10 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none" />
                    <img
                      src={url}
                      alt={`Ref ${i + 1}`}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      referrerPolicy="no-referrer"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* QA Imagery (Before/After) */}
          <div className="bg-[#121212] border border-gray-800/80 rounded-lg p-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
              <Camera className="w-3.5 h-3.5 text-gray-400" /> Before & After Photos
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-800/50 rounded overflow-hidden">
              
              {/* Before */}
              <div className="bg-[#151515] p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">Before Service</p>
                  <span className="text-[10px] text-gray-600 font-mono">COUNT:{beforePhotos.length}</span>
                </div>
                
                <input
                  ref={beforePhotoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => void handleQaPhotoUpload('before', e)}
                />
                
                <div className="flex gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => beforePhotoInputRef.current?.click()}
                    disabled={qaUploadingStage !== null || booking.status === 'completed'}
                    className="flex-1 border border-dashed border-gray-600 hover:border-brand-orange text-gray-400 hover:text-brand-orange py-2 text-[10px] font-bold uppercase tracking-widest transition-colors rounded disabled:opacity-30 flex items-center justify-center gap-2"
                  >
                    {qaUploadingStage === 'before' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Add Media
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveQaPhotos('before')}
                    disabled={qaSavingStage !== null || beforePhotos.length === 0 || booking.status === 'completed'}
                    className="px-4 py-2 bg-brand-darker border border-gray-700 hover:border-brand-orange text-gray-300 hover:text-brand-orange text-[10px] font-bold uppercase tracking-widest rounded disabled:opacity-30 transition-colors"
                  >
                    {qaSavingStage === 'before' ? 'Syncing...' : 'Sync'}
                  </button>
                </div>

                {beforePhotos.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2">
                    {beforePhotos.map((url, i) => (
                      <div key={i} className="relative aspect-square rounded overflow-hidden border border-gray-700 group">
                        <img src={url} alt="Before" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <button
                          type="button"
                          onClick={() => setBeforePhotos(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute top-1 right-1 w-5 h-5 bg-red-500/90 rounded border border-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-16 border border-dashed border-gray-800 rounded flex items-center justify-center">
                    <p className="text-[9px] font-mono text-yellow-500 uppercase tracking-widest">Required for check-in</p>
                  </div>
                )}
              </div>

              {/* After */}
              <div className="bg-[#151515] p-5">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">After Service</p>
                  <span className="text-[10px] text-gray-600 font-mono">COUNT:{afterPhotos.length}</span>
                </div>
                
                <input
                  ref={afterPhotoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => void handleQaPhotoUpload('after', e)}
                />
                
                <div className="flex gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => afterPhotoInputRef.current?.click()}
                    disabled={qaUploadingStage !== null || booking.status === 'completed'}
                    className="flex-1 border border-dashed border-gray-600 hover:border-brand-orange text-gray-400 hover:text-brand-orange py-2 text-[10px] font-bold uppercase tracking-widest transition-colors rounded disabled:opacity-30 flex items-center justify-center gap-2"
                  >
                    {qaUploadingStage === 'after' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                    Add Media
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSaveQaPhotos('after')}
                    disabled={qaSavingStage !== null || afterPhotos.length === 0 || booking.status === 'completed'}
                    className="px-4 py-2 bg-brand-darker border border-gray-700 hover:border-brand-orange text-gray-300 hover:text-brand-orange text-[10px] font-bold uppercase tracking-widest rounded disabled:opacity-30 transition-colors"
                  >
                    {qaSavingStage === 'after' ? 'Syncing...' : 'Sync'}
                  </button>
                </div>

                {afterPhotos.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2">
                    {afterPhotos.map((url, i) => (
                      <div key={i} className="relative aspect-square rounded overflow-hidden border border-gray-700 group">
                        <img src={url} alt="After" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <button
                          type="button"
                          onClick={() => setAfterPhotos(prev => prev.filter((_, idx) => idx !== i))}
                          className="absolute top-1 right-1 w-5 h-5 bg-red-500/90 rounded border border-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-16 border border-dashed border-gray-800 rounded flex items-center justify-center">
                    <p className="text-[9px] font-mono text-yellow-500 uppercase tracking-widest">Required for completion</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Build Updates (Timeline) */}
          <div className="bg-[#121212] border border-gray-800/80 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-orange flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" /> Progress Updates
              </p>
              {!buildUpdateOpen && (
                <button
                  onClick={() => setBuildUpdateOpen(true)}
                  disabled={isFinalized}
                  className="text-[10px] font-bold uppercase tracking-widest text-brand-orange hover:text-orange-400 transition-colors flex items-center gap-1 bg-brand-orange/10 px-3 py-1.5 rounded disabled:opacity-30"
                >
                  <Plus className="w-3 h-3" /> Append Node
                </button>
              )}
            </div>

            {/* Post new update form */}
            {buildUpdateOpen && (
              <div className="mb-6 border border-brand-orange/30 bg-[#151515] rounded p-5 shadow-[inset_0_0_20px_rgba(249,115,22,0.05)]">
                <textarea
                  rows={3}
                  value={buildUpdateNote}
                  onChange={e => setBuildUpdateNote(e.target.value)}
                  placeholder="Describe the update..."
                  className="w-full bg-[#121212] border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors resize-none rounded text-sm font-mono mb-4"
                />

                <input
                  ref={buildPhotoInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={isFinalized}
                  onChange={handleBuildPhotoUpload}
                />
                
                <div className="flex items-center gap-3 mb-4">
                  <button
                    type="button"
                    onClick={() => buildPhotoInputRef.current?.click()}
                    disabled={photoUploading || isFinalized}
                    className="flex items-center gap-2 border border-dashed border-gray-600 hover:border-brand-orange text-gray-400 hover:text-brand-orange px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors rounded disabled:opacity-30"
                  >
                    {photoUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                    Attach Media
                  </button>
                  <span className="text-[9px] font-mono text-gray-500">{buildUpdatePhotos.length} Attached</span>
                </div>

                {buildUpdatePhotos.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4 p-3 bg-[#121212] rounded border border-gray-800">
                    {buildUpdatePhotos.map((url, i) => (
                      <div key={i} className="relative w-14 h-14 group rounded overflow-hidden border border-gray-700">
                        <img src={url} alt="Upload" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <button
                          type="button"
                          onClick={() => setBuildUpdatePhotos(prev => prev.filter((_, j) => j !== i))}
                          className="absolute top-0.5 right-0.5 w-4 h-4 bg-red-500 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-2.5 h-2.5 text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => requestConfirmation(
                      {
                        title: 'Add Progress Update?',
                        message: 'This will add a new update to the customer timeline.',
                        confirmLabel: 'Add Update',
                      },
                      handleBuildUpdateSubmit,
                    )}
                    disabled={isFinalized || buildUpdateBusy || photoUploading || (!buildUpdateNote.trim() && buildUpdatePhotos.length === 0)}
                    className="flex-1 bg-brand-orange hover:bg-orange-600 text-white px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest rounded transition-colors disabled:opacity-30 flex items-center justify-center gap-2"
                  >
                    {buildUpdateBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
                    Add Update
                  </button>
                  <button
                    onClick={() => { setBuildUpdateOpen(false); setBuildUpdateNote(''); setBuildUpdatePhotos([]); }}
                    disabled={buildUpdateBusy}
                    className="px-5 py-2.5 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 text-[10px] font-bold uppercase tracking-widest transition-colors rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Existing updates */}
            <div className="relative">
              {buildUpdates.length > 0 && (
                <div className="absolute top-0 bottom-0 left-4 w-px bg-gray-800" />
              )}
              <div className="space-y-6 relative">
                {buildUpdates.length === 0 && !buildUpdateOpen ? (
                  <p className="text-gray-600 text-xs font-mono bg-[#181818] p-4 rounded border border-gray-800 border-dashed text-center">Timeline empty.</p>
                ) : (
                  buildUpdates.slice().reverse().map((upd) => (
                    <div key={upd.id} className="relative pl-10">
                      <div className="absolute left-[13px] top-1.5 w-2 h-2 rounded-full bg-brand-orange ring-4 ring-[#121212]" />
                      <div className="bg-[#151515] border border-gray-800 rounded p-4">
                        <p className="text-[9px] text-gray-500 font-mono mb-2">
                          SYS_TIME: {new Date(upd.createdAt).toISOString().replace('T', ' ').substring(0, 19)}Z
                        </p>
                        {upd.note && (
                          <p className="text-gray-200 text-sm whitespace-pre-wrap leading-relaxed">{upd.note}</p>
                        )}
                        {upd.photoUrls.length > 0 && (
                          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 mt-4 pt-4 border-t border-gray-800/50">
                            {upd.photoUrls.map((url, j) => (
                              <button
                                key={j}
                                onClick={() => setLightboxUrl(url)}
                                className="aspect-square rounded overflow-hidden border border-gray-700 hover:border-brand-orange transition-colors"
                              >
                                <img src={url} alt="Progress" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          
        </div>

        {/* ── RIGHT COLUMN (Telemetry & Execution Controls) ── */}
        <div className="space-y-6">

          {/* Quick Actions / Dispatch Controls */}
          <div className="bg-[#121212] border border-gray-800/80 rounded-lg p-6  top-6">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-orange/80 mb-6 pb-4 border-b border-gray-800 flex items-center gap-2">
              <ClipboardList className="w-3.5 h-3.5 text-brand-orange" /> Actions
            </p>
            
            <div className="space-y-3">
              {canConfirm && (
                <button
                  onClick={() => setCheckInOpen(true)}
                  disabled={statusBusy !== null}
                  className="w-full flex justify-between items-center px-4 py-3 bg-[#151515] border border-green-500/30 text-green-400 hover:bg-green-500/10 text-[10px] font-bold uppercase tracking-widest rounded transition-colors disabled:opacity-30 group"
                >
                  <span>Check In</span>
                  {statusBusy === 'confirmed' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 opacity-50 group-hover:opacity-100" />}
                </button>
              )}
              {canComplete && (
                <button
                  onClick={() => setCompleteOpen(true)}
                  disabled={statusBusy !== null}
                  className="w-full flex justify-between items-center px-4 py-3 bg-[#151515] border border-blue-500/30 text-blue-400 hover:bg-blue-500/10 text-[10px] font-bold uppercase tracking-widest rounded transition-colors disabled:opacity-30 group"
                >
                  <span>Mark as Completed</span>
                  {statusBusy === 'completed' ? <Loader2 className="w-4 h-4 animate-spin" /> : <BadgeCheck className="w-4 h-4 opacity-50 group-hover:opacity-100" />}
                </button>
              )}
              {canResume && (
                <button
                  onClick={() => requestConfirmation(
                    {
                      title: 'Resume Operation?',
                      message: 'Routing status back to confirmed state.',
                      confirmLabel: 'Resume',
                    },
                    async () => handleStatus('confirmed'),
                  )}
                  disabled={statusBusy !== null}
                  className="w-full flex justify-between items-center px-4 py-3 bg-[#151515] border border-green-500/30 text-green-400 hover:bg-green-500/10 text-[10px] font-bold uppercase tracking-widest rounded transition-colors disabled:opacity-30 group"
                >
                  <span>Resume (Parts Cleared)</span>
                  {statusBusy === 'confirmed' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 opacity-50 group-hover:opacity-100" />}
                </button>
              )}
              {canCancel && (
                <button
                  onClick={() => requestConfirmation(
                    {
                      title: 'Terminate Sequence?',
                      message: 'Irreversible status change to cancelled.',
                      confirmLabel: 'Terminate',
                      tone: 'danger',
                    },
                    async () => handleStatus('cancelled'),
                  )}
                  disabled={statusBusy !== null}
                  className="w-full flex justify-between items-center px-4 py-3 bg-[#151515] border border-red-500/30 text-red-400 hover:bg-red-500/10 text-[10px] font-bold uppercase tracking-widest rounded transition-colors disabled:opacity-30 group"
                >
                  <span>Cancel Booking</span>
                  {statusBusy === 'cancelled' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4 opacity-50 group-hover:opacity-100" />}
                </button>
              )}
              <button
                onClick={() => requestConfirmation(
                  {
                    title: 'Delete Booking Record?',
                    message: 'This permanently deletes the booking and cannot be undone.',
                    confirmLabel: 'Delete Booking',
                    tone: 'danger',
                  },
                  handleDeleteBooking,
                )}
                disabled={statusBusy !== null || deleteBusy}
                className="w-full flex justify-between items-center px-4 py-3 bg-[#151515] border border-red-500/40 text-red-300 hover:bg-red-500/10 text-[10px] font-bold uppercase tracking-widest rounded transition-colors disabled:opacity-30 group"
              >
                <span>{deleteBusy ? 'Deleting...' : 'Delete Booking'}</span>
                {deleteBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 opacity-50 group-hover:opacity-100" />}
              </button>
              
              {!canModify && (
                <div className="bg-[#151515] border border-gray-800 rounded p-3 flex items-center justify-center">
                  <p className="text-gray-600 text-[10px] font-mono uppercase tracking-widest">Actions Locked ({formatStatus(booking.status)})</p>
                </div>
              )}
              
              <div className="pt-2 space-y-1">
                {canConfirm && !hasBeforePhotos && (
                  <p className="text-[9px] font-mono text-yellow-500 bg-yellow-500/10 p-2 rounded border border-yellow-500/20">! Ingest photos required prior to Auth.</p>
                )}
                {canComplete && !hasAfterPhotos && (
                  <p className="text-[9px] font-mono text-yellow-500 bg-yellow-500/10 p-2 rounded border border-yellow-500/20">! Egest photos required prior to Auth.</p>
                )}
              </div>
            </div>
          </div>

          {/* Internal Notes */}
          <div className="bg-[#121212] border border-gray-800/80 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
                <StickyNote className="w-3.5 h-3.5 text-gray-400" /> Internal Notes
              </p>
              {!notesEditing && (
                <button
                  onClick={() => setNotesEditing(true)}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-gray-500 hover:text-brand-orange transition-colors"
                >
                  <Edit3 className="w-3 h-3" /> {internalNotes ? 'Edit' : 'Add'}
                </button>
              )}
            </div>

            {!notesEditing ? (
              <div className="bg-[#151515] border border-gray-800 rounded p-4">
                {internalNotes ? (
                  <p className="text-gray-300 text-sm whitespace-pre-wrap leading-relaxed">{internalNotes}</p>
                ) : (
                  <p className="text-gray-600 text-[10px] font-mono uppercase tracking-widest text-center">No notes yet.</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={internalNotes}
                  onChange={e => setInternalNotes(e.target.value)}
                  rows={5}
                  placeholder="Enter notes (not visible to customer)..."
                  maxLength={5000}
                  className="w-full bg-[#181818] border border-gray-700 text-white text-sm px-3 py-3 rounded focus:outline-none focus:border-brand-orange resize-y transition-colors font-mono"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => requestConfirmation(
                      {
                        title: 'Save Notes?',
                        message: 'These notes are for internal use only.',
                        confirmLabel: 'Save',
                      },
                      handleSaveInternalNotes,
                    )}
                    disabled={notesBusy}
                    className="flex-1 px-4 py-2 bg-brand-darker border border-gray-700 hover:border-brand-orange text-gray-300 hover:text-brand-orange text-[10px] font-bold uppercase tracking-widest rounded transition-colors disabled:opacity-30 flex items-center justify-center gap-2"
                  >
                    {notesBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Save
                  </button>
                  <button
                    onClick={() => { setNotesEditing(false); setInternalNotes(booking.internalNotes ?? ''); }}
                    className="px-4 py-2 border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 text-[10px] font-bold uppercase tracking-widest transition-colors rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Customer History */}
          {customerStats && (
            <div className="bg-[#121212] border border-gray-800/80 rounded-lg p-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
                <Award className="w-3.5 h-3.5 text-gray-400" /> Customer History
              </p>
              <div className="grid grid-cols-2 gap-px bg-gray-800/50 rounded overflow-hidden">
                <div className="bg-[#151515] p-4 text-center">
                  <p className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mb-1">Total Visits</p>
                  <p className="text-2xl font-black text-white">{customerStats.totalVisits}</p>
                </div>
                <div className="bg-[#151515] p-4 text-center">
                  <p className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mb-1">Completed Visits</p>
                  <p className="text-2xl font-black text-blue-400">{customerStats.completedVisits}</p>
                </div>
              </div>
              <div className="mt-4 text-center">
                <p className="text-[9px] font-mono text-gray-600 uppercase tracking-widest">
                  Customer Since: {customerStats.memberSince ? new Date(customerStats.memberSince).toISOString().split('T')[0] : 'UNKNOWN'}
                </p>
              </div>
              {customerStats.totalVisits >= 5 && (
                <div className="mt-4 flex items-center justify-center gap-2 bg-brand-orange/10 border border-brand-orange/30 rounded py-2">
                  <Shield className="w-3.5 h-3.5 text-brand-orange shrink-0" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-brand-orange">Loyal Customer</span>
                </div>
              )}
            </div>
          )}

          {/* Activity Log */}
          <div className="bg-[#121212] border border-gray-800/80 rounded-lg p-6">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-6 flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-gray-400" /> Activity Log
            </p>
            {activityLogs.length === 0 ? (
              <p className="text-gray-600 text-[10px] font-mono text-center">Log empty.</p>
            ) : (
              <div className="space-y-4 font-mono">
                {activityLogs.slice().reverse().map((entry) => (
                  <div key={entry.id} className="border-b border-gray-800/50 pb-3 last:border-0 last:pb-0">
                    <p className="text-[9px] text-brand-orange mb-1">
                      {new Date(entry.createdAt).toISOString().replace('T', ' ').substring(0, 19)}Z
                    </p>
                    <p className="text-[11px] text-gray-300 uppercase font-bold"> {entry.action}</p>
                    {entry.detail && (
                      <p className="text-[10px] text-gray-500 mt-1 pl-3 border-l border-gray-700">{entry.detail}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── MODALS ── */}

      {/* Action Confirmation Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded border border-gray-700 bg-[#121212] p-6 shadow-2xl">
            <h3 className={`text-[10px] font-mono font-bold uppercase tracking-widest mb-4 border-b border-gray-800 pb-2 ${confirmDialog.tone === 'danger' ? 'text-red-500' : 'text-brand-orange'}`}>
              // Auth required
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
                className={`px-4 py-2 rounded text-xs font-bold uppercase tracking-widest text-white disabled:opacity-30 transition-colors ${
                  confirmDialog.tone === 'danger' ? 'bg-red-600 hover:bg-red-500' : 'bg-brand-orange hover:bg-orange-600'
                }`}
              >
                {confirmBusy ? 'Executing...' : confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Check-In Modal */}
      {checkInOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl rounded border border-gray-700 bg-[#121212] p-6 shadow-2xl">
            <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-green-500 mb-4 border-b border-gray-800 pb-2">
              // Ingest Protocol
            </h3>
            <p className="text-lg font-bold text-white mb-1">Confirm Check-In</p>
            <p className="text-sm text-gray-400 mb-6">Visual verification required to authorize.</p>

            <div className="bg-[#151515] border border-gray-800 rounded p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">Stage 1: Ingest Photos</p>
                <span className="text-[10px] text-gray-600 font-mono">COUNT:{beforePhotos.length}</span>
              </div>
              
              <input
                ref={beforePhotoInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => void handleQaPhotoUpload('before', e)}
              />
              
              <button
                type="button"
                onClick={() => beforePhotoInputRef.current?.click()}
                disabled={qaUploadingStage !== null || checkInBusy}
                className="w-full py-3 mb-4 border border-dashed border-gray-600 hover:border-brand-orange text-gray-400 hover:text-brand-orange text-[10px] font-bold uppercase tracking-widest transition-colors rounded disabled:opacity-30 flex items-center justify-center gap-2"
              >
                {qaUploadingStage === 'before' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                Add Media
              </button>

              {beforePhotos.length > 0 ? (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {beforePhotos.map((url, i) => (
                    <div key={i} className="relative aspect-square rounded overflow-hidden border border-gray-700 group">
                      <img src={url} alt="Before" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <button
                        type="button"
                        onClick={() => setBeforePhotos(prev => prev.filter((_, idx) => idx !== i))}
                        disabled={checkInBusy}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500/90 rounded border border-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-16 border border-dashed border-gray-800 bg-[#181818] rounded flex items-center justify-center">
                  <p className="text-[9px] font-mono text-yellow-500 uppercase tracking-widest">! Req for check-in</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setCheckInOpen(false)}
                disabled={checkInBusy}
                className="px-4 py-2 rounded border border-gray-700 text-xs font-bold uppercase tracking-widest text-gray-400 hover:border-gray-500 hover:text-white disabled:opacity-30 transition-colors"
              >
                Abort
              </button>
              <button
                type="button"
                onClick={() => void handleCheckInConfirm()}
                disabled={checkInBusy || qaUploadingStage !== null || beforePhotos.length === 0}
                className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest text-white bg-green-600 hover:bg-green-500 disabled:opacity-30 transition-colors"
              >
                {checkInBusy ? 'Executing...' : 'Confirm Booking'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Modal */}
      {completeOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl rounded border border-gray-700 bg-[#121212] p-6 shadow-2xl">
            <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-blue-500 mb-4 border-b border-gray-800 pb-2">
              // Egest Protocol
            </h3>
            <p className="text-lg font-bold text-white mb-1">Complete Mission</p>
            <p className="text-sm text-gray-400 mb-6">Final visual verification required to close.</p>

            <div className="bg-[#151515] border border-gray-800 rounded p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">Stage 2: Egest Photos</p>
                <span className="text-[10px] text-gray-600 font-mono">COUNT:{afterPhotos.length}</span>
              </div>
              
              <input
                ref={afterPhotoInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => void handleQaPhotoUpload('after', e)}
              />
              
              <button
                type="button"
                onClick={() => afterPhotoInputRef.current?.click()}
                disabled={qaUploadingStage !== null || completeBusy}
                className="w-full py-3 mb-4 border border-dashed border-gray-600 hover:border-brand-orange text-gray-400 hover:text-brand-orange text-[10px] font-bold uppercase tracking-widest transition-colors rounded disabled:opacity-30 flex items-center justify-center gap-2"
              >
                {qaUploadingStage === 'after' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                Add Media
              </button>

              {afterPhotos.length > 0 ? (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {afterPhotos.map((url, i) => (
                    <div key={i} className="relative aspect-square rounded overflow-hidden border border-gray-700 group">
                      <img src={url} alt="After" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <button
                        type="button"
                        onClick={() => setAfterPhotos(prev => prev.filter((_, idx) => idx !== i))}
                        disabled={completeBusy}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500/90 rounded border border-red-400 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-16 border border-dashed border-gray-800 bg-[#181818] rounded flex items-center justify-center">
                  <p className="text-[9px] font-mono text-yellow-500 uppercase tracking-widest">! Req for completion</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setCompleteOpen(false)}
                disabled={completeBusy}
                className="px-4 py-2 rounded border border-gray-700 text-xs font-bold uppercase tracking-widest text-gray-400 hover:border-gray-500 hover:text-white disabled:opacity-30 transition-colors"
              >
                Abort
              </button>
              <button
                type="button"
                onClick={() => void handleCompleteConfirm()}
                disabled={completeBusy || qaUploadingStage !== null || afterPhotos.length === 0}
                className="px-4 py-2 rounded text-xs font-bold uppercase tracking-widest text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-30 transition-colors"
              >
                {completeBusy ? 'Executing...' : 'Confirm Booking'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}