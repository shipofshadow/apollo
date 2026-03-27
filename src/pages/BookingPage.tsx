import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Clock, CheckCircle, ArrowLeft, ArrowRight, Loader2,
  UploadCloud, X,
} from 'lucide-react';
import { submitBookingAsync, resetBookingState } from '../store/bookingSlice';
import { fetchServicesAsync } from '../store/servicesSlice';
import type { AppDispatch, RootState } from '../store';
import { useAuth } from '../context/AuthContext';
import {
  fetchAvailabilityApi, uploadBookingMediaApi,
  fetchVehicleMakesApi, fetchVehicleModelsApi,
  fetchShopHoursApi,
} from '../services/api';
import { BACKEND_URL } from '../config';
import type { ShopDayHours } from '../types';
import { VEHICLE_MAKES as STATIC_MAKES, VEHICLE_MODELS as STATIC_MODELS, VEHICLE_YEARS, type VehicleMake } from '../data/vehicles';
import SignaturePad from '../components/SignaturePad';

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Services',    desc: 'Choose what you need' },
  { label: 'Date & Time', desc: 'Pick a schedule' },
  { label: 'Your Details', desc: 'Tell us about you' },
  { label: 'Confirmed',   desc: 'All done!' },
];

/** Parse "09:00 AM" / "01:00 PM" → 24-hour number (9, 13, etc.) */
function slotToHour(slot: string): number {
  const [timePart, ampm] = slot.split(' ');
  let h = parseInt(timePart.split(':')[0], 10);
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h;
}

function parseDurationMax(duration: string): number {
  const nums = duration.match(/\d+/g);
  if (!nums) return 4;
  return Math.max(...nums.map(Number));
}

function slotCompletionLabel(slot: string, totalHours: number): string {
  const end = slotToHour(slot) + totalHours;
  if (end > 12) return `~${end - 12}:00 PM`;
  if (end === 12) return `~12:00 PM`;
  return `~${end}:00 AM`;
}

/** Build date list from shop hours (falls back to Mon–Sat if hours not loaded) */
function buildDateList(shopHours: ShopDayHours[]): Date[] {
  const openDays = shopHours.length
    ? new Set(shopHours.filter(h => h.isOpen).map(h => h.dayOfWeek))
    : new Set([1, 2, 3, 4, 5, 6]); // Mon–Sat default

  const dates: Date[] = [];
  const cursor = new Date();
  cursor.setDate(cursor.getDate() + 1);
  while (dates.length < 14) {
    if (openDays.has(cursor.getDay())) dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Accepts PH mobile numbers: 09XXXXXXXXX, +639XXXXXXXXX, or with spaces/dashes */
function isValidPhone(phone: string): boolean {
  return /^(\+?63|0)[-\s]?9\d{2}[-\s]?\d{3}[-\s]?\d{4}$/.test(phone.trim());
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BookingPage() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token } = useAuth();
  const { status: bookStatus, error: bookError } = useSelector((s: RootState) => s.booking);
  const services = useSelector((s: RootState) => s.services.items.filter(sv => sv.isActive));

  const [step, setStep] = useState(1);

  // Step 1 – multi-select services (pre-select from location state if present)
  const preselectedId = (location.state as { serviceId?: number } | null)?.serviceId ?? null;
  const [selectedIds, setSelectedIds] = useState<number[]>(
    preselectedId ? [preselectedId] : []
  );

  // Shop hours – loaded on mount to filter the date picker
  const [shopHours,       setShopHours]       = useState<ShopDayHours[]>([]);
  const [shopHoursLoaded, setShopHoursLoaded] = useState(false);

  // Step 2 – date / time / availability
  const [selectedDate,        setSelectedDate]        = useState<Date | null>(null);
  const [selectedTime,        setSelectedTime]        = useState('');
  const [availableSlots,      setAvailableSlots]      = useState<string[]>([]);
  const [bookedSlots,         setBookedSlots]         = useState<string[]>([]);
  const [slotCounts,          setSlotCounts]          = useState<Record<string, number>>({});
  const [slotCapacity,        setSlotCapacity]        = useState(3);
  const [shopDayIsOpen,       setShopDayIsOpen]       = useState(true);
  const [shopCloseTime,       setShopCloseTime]       = useState('18:00');
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  // Step 3 – contact
  const [form, setForm] = useState({
    name:  user?.name  ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    notes: '',
  });
  const [vehicleMake,  setVehicleMake]  = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear,  setVehicleYear]  = useState('');

  // Vehicle data – loaded from CarAPI proxy, fall back to static dataset
  const [dynamicMakes,  setDynamicMakes]  = useState<string[]>([]);
  const [dynamicModels, setDynamicModels] = useState<string[]>([]);
  const [makesLoading,  setMakesLoading]  = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);

  // Resolved lists (dynamic when available, static otherwise)
  const makesList  = dynamicMakes.length  ? dynamicMakes  : [...STATIC_MAKES];
  const modelsList = dynamicModels.length ? dynamicModels
    : vehicleMake ? (STATIC_MODELS[vehicleMake as VehicleMake] ?? []) : [];

  // Step 3 – media upload
  const [mediaFiles,      setMediaFiles]      = useState<File[]>([]);
  const [mediaPreviews,   setMediaPreviews]   = useState<string[]>([]);
  const [mediaUploadBusy, setMediaUploadBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 3 – signature
  const [signatureData, setSignatureData] = useState('');

  // Step 3 – validation errors
  const [formErrors, setFormErrors] = useState<{ phone?: string; email?: string }>({});

  const availableDates = buildDateList(shopHoursLoaded ? shopHours : []);

  const selectedServices = services.filter(s => selectedIds.includes(s.id));
  const totalMaxHours    = selectedServices.reduce(
    (acc, s) => acc + parseDurationMax(s.duration), 0
  );
  const vehicleInfo = [vehicleYear, vehicleMake, vehicleModel].filter(Boolean).join(' ');

  // Load services + shop hours on mount
  useEffect(() => {
    dispatch(fetchServicesAsync(token));
    if (BACKEND_URL) {
      fetchShopHoursApi()
        .then(({ hours }) => setShopHours(hours))
        .catch(() => { /* use default Mon–Sat */ })
        .finally(() => setShopHoursLoaded(true));
    } else {
      setShopHoursLoaded(true);
    }
  }, [dispatch, token]);

  // Re-fetch makes whenever year changes; passes year to the API when selected
  useEffect(() => {
    setDynamicMakes([]);
    setVehicleMake('');
    setDynamicModels([]);
    setVehicleModel('');
    if (!BACKEND_URL) return;
    setMakesLoading(true);
    const year = vehicleYear ? parseInt(vehicleYear, 10) : undefined;
    fetchVehicleMakesApi(year)
      .then(({ makes }) => setDynamicMakes(makes))
      .catch(() => { /* fall back to static */ })
      .finally(() => setMakesLoading(false));
  }, [vehicleYear]);

  // Load models when make changes, passing year when available
  useEffect(() => {
    setDynamicModels([]);
    setVehicleModel('');
    if (!vehicleMake || !BACKEND_URL) return;
    setModelsLoading(true);
    const year = vehicleYear ? parseInt(vehicleYear, 10) : undefined;
    fetchVehicleModelsApi(vehicleMake, year)
      .then(({ models }) => setDynamicModels(models))
      .catch(() => { /* fall back to static */ })
      .finally(() => setModelsLoading(false));
  }, [vehicleMake, vehicleYear]);

  const toggleService = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleDateSelect = async (date: Date) => {
    setSelectedDate(date);
    setSelectedTime('');
    setAvailableSlots([]);
    setBookedSlots([]);
    setSlotCounts({});
    setShopDayIsOpen(true);
    if (!BACKEND_URL) return;
    setAvailabilityLoading(true);
    try {
      const res = await fetchAvailabilityApi(date.toISOString().split('T')[0]);
      setShopDayIsOpen(res.isOpen);
      setShopCloseTime(res.closeTime);
      setAvailableSlots(res.availableSlots);
      setBookedSlots(res.bookedSlots);
      setSlotCounts(res.slotCounts ?? {});
      setSlotCapacity(res.slotCapacity ?? 3);
    } catch { /* show all slots available */ }
    finally { setAvailabilityLoading(false); }
  };

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const added = Array.from(e.target.files ?? []);
    if (!added.length) return;
    setMediaFiles(prev => [...prev, ...added]);
    added.forEach(f => {
      const reader = new FileReader();
      reader.onload = ev => setMediaPreviews(p => [...p, ev.target?.result as string]);
      reader.readAsDataURL(f);
    });
    e.target.value = '';
  };

  const removeFile = (i: number) => {
    setMediaFiles(prev => prev.filter((_, idx) => idx !== i));
    setMediaPreviews(prev => prev.filter((_, idx) => idx !== i));
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(p => ({ ...p, phone: e.target.value }));
    setFormErrors(prev => ({ ...prev, phone: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation
    const errors: { phone?: string; email?: string } = {};
    if (form.phone && !isValidPhone(form.phone)) {
      errors.phone = 'Enter a valid Philippine mobile number (e.g. 09171234567).';
    }
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    let mediaUrls: string[] = [];
    if (mediaFiles.length && BACKEND_URL) {
      setMediaUploadBusy(true);
      try { mediaUrls = await uploadBookingMediaApi(mediaFiles); }
      catch { /* proceed without media */ }
      finally { setMediaUploadBusy(false); }
    }
    const result = await dispatch(
      submitBookingAsync({
        payload: {
          name:            form.name,
          email:           form.email,
          phone:           form.phone,
          vehicleInfo,
          vehicleMake,
          vehicleModel,
          vehicleYear,
          serviceIds:      selectedIds,
          appointmentDate: selectedDate!.toISOString().split('T')[0],
          appointmentTime: selectedTime,
          notes:           form.notes,
          signatureData:   signatureData || undefined,
          mediaUrls:       mediaUrls.length ? mediaUrls : undefined,
        },
        token,
      })
    );
    if (submitBookingAsync.fulfilled.match(result)) setStep(4);
  };

  const reset = () => {
    dispatch(resetBookingState());
    setStep(1);
    setSelectedIds([]);
    setSelectedDate(null);
    setSelectedTime('');
    setAvailableSlots([]);
    setBookedSlots([]);
    setSlotCounts({});
    setShopDayIsOpen(true);
    setForm({ name: user?.name ?? '', email: user?.email ?? '', phone: user?.phone ?? '', notes: '' });
    setVehicleMake(''); setVehicleModel(''); setVehicleYear('');
    setDynamicModels([]);
    setMediaFiles([]); setMediaPreviews([]);
    setSignatureData('');
    setFormErrors({});
  };

  return (
    <div className="pt-32 pb-24 min-h-screen bg-brand-darker">
      <div className="container mx-auto px-4 md:px-6 max-w-4xl">
        <div className="text-center mb-12">
          <span className="text-brand-orange font-bold uppercase tracking-widest text-sm block mb-3">Schedule Your Visit</span>
          <h1 className="text-4xl md:text-5xl font-display font-black text-white uppercase tracking-tighter mb-4">
            Book <span className="text-brand-orange">Appointment</span>
          </h1>
          <p className="text-gray-400 text-lg">Select your services, choose a date and time, then provide your details.</p>
        </div>

        {/* Step indicators */}
        <div className="flex justify-between items-center mb-12 relative">
          <div className="absolute left-0 top-5 -translate-y-1/2 w-full h-0.5 bg-gray-800 z-0" />
          <div className="absolute left-0 top-5 -translate-y-1/2 h-0.5 bg-brand-orange z-0 transition-all duration-500"
            style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }} />
          {STEPS.map(({ label, desc }, i) => {
            const n = i + 1;
            const active = step >= n;
            return (
              <div key={n} className="relative z-10 flex flex-col items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${active ? 'bg-brand-orange text-white' : 'bg-gray-800 text-gray-500'}`}>
                  {n === STEPS.length && step === STEPS.length ? <CheckCircle className="w-5 h-5" /> : n}
                </div>
                <span className={`hidden md:block text-xs font-bold uppercase tracking-widest ${active ? 'text-brand-orange' : 'text-gray-600'}`}>{label}</span>
                <span className={`hidden lg:block text-[11px] -mt-1 ${active ? 'text-gray-400' : 'text-gray-700'}`}>{desc}</span>
              </div>
            );
          })}
        </div>

        <div className="bg-brand-dark border border-gray-800 p-6 md:p-10 rounded-sm">

          {/* ── Step 1: Services ── */}
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-display font-bold text-white uppercase mb-2">1. Select Services</h2>
              <p className="text-sm text-gray-400 mb-6">Tap the services you'd like — you can choose more than one. Prices and estimated times are shown on each card.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map(svc => {
                  const active = selectedIds.includes(svc.id);
                  return (
                    <button key={svc.id} onClick={() => toggleService(svc.id)}
                      className={`p-6 border text-left transition-all rounded-sm relative ${active ? 'border-brand-orange bg-brand-orange/10' : 'border-gray-800 hover:border-gray-600'}`}>
                      {active && (
                        <span className="absolute top-3 right-3 w-5 h-5 bg-brand-orange rounded-full flex items-center justify-center">
                          <CheckCircle className="w-3 h-3 text-white" />
                        </span>
                      )}
                      <h3 className="text-lg font-bold text-white mb-2 pr-8">{svc.title}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {svc.duration}</span>
                        <span className="text-brand-orange font-bold">{svc.startingPrice}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
              {selectedIds.length > 0 && (
                <div className="mt-6 bg-brand-darker border border-gray-700 rounded-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                  <div>
                    <span className="text-gray-400">Selected: </span>
                    <span className="text-white font-semibold">{selectedServices.map(s => s.title).join(', ')}</span>
                  </div>
                  <span className="text-brand-orange font-bold flex items-center gap-1 shrink-0">
                    <Clock className="w-4 h-4" /> Est. {totalMaxHours}h max
                  </span>
                </div>
              )}
              <div className="mt-8 flex justify-end">
                <button onClick={() => setStep(2)} disabled={selectedIds.length === 0}
                  className="w-full sm:w-auto bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 rounded-sm"
                  title={selectedIds.length === 0 ? 'Please select at least one service to continue' : undefined}>
                  Choose Date & Time <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Date & Time ── */}
          {step === 2 && (
            <div>
              <h2 className="text-2xl font-display font-bold text-white uppercase mb-2">2. Choose a Date & Time</h2>
              <p className="text-sm text-gray-400 mb-6">Scroll left/right to see more dates, then pick a time that works for you.</p>
              <div className="mb-8">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Available Dates</p>
                <div className="flex overflow-x-auto pb-3 gap-3 snap-x">
                  {availableDates.map((date, i) => (
                    <button key={i} onClick={() => handleDateSelect(date)}
                      className={`snap-start shrink-0 w-24 p-4 border text-center transition-all rounded-sm ${selectedDate?.toDateString() === date.toDateString() ? 'border-brand-orange bg-brand-orange/10' : 'border-gray-800 hover:border-gray-600'}`}>
                      <div className="text-xs text-gray-400 uppercase mb-1">{date.toLocaleDateString('en-PH', { weekday: 'short' })}</div>
                      <div className="text-2xl font-display font-bold text-white">{date.getDate()}</div>
                      <div className="text-xs text-gray-500 uppercase mt-1">{date.toLocaleDateString('en-PH', { month: 'short' })}</div>
                    </button>
                  ))}
                </div>
              </div>
              {selectedDate && (
                <div className="mb-8">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500 block mb-1">
                    Appointment Time *
                    {availabilityLoading && (
                      <span className="ml-2 text-gray-600 normal-case font-normal inline-flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Checking…
                      </span>
                    )}
                  </label>

                  {!availabilityLoading && !shopDayIsOpen && (
                    <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-sm">
                      The shop is closed on this date. Please choose a different day.
                    </p>
                  )}

                  {!availabilityLoading && shopDayIsOpen && (() => {
                    const [closeH] = shopCloseTime.split(':').map(Number);
                    const visibleSlots = availableSlots.filter(time =>
                      !bookedSlots.includes(time) && slotToHour(time) + totalMaxHours <= closeH
                    );
                    return (
                      <>
                        <p className="text-xs text-gray-600 mb-3">
                          Closes at {shopCloseTime} · Slots that won't fit your job duration are hidden.
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {visibleSlots.length === 0 && (
                            <p className="col-span-full text-sm text-gray-500 py-2">No available slots for this date.</p>
                          )}
                          {visibleSlots.map(time => {
                            const isSelected  = selectedTime === time;
                            const completion  = slotCompletionLabel(time, totalMaxHours);
                            const takenCount  = slotCounts[time] ?? 0;
                            const spotsLeft   = slotCapacity - takenCount;
                            const almostFull  = spotsLeft === 1;
                            const baseClass   = 'flex flex-col items-center justify-center px-2 py-3 rounded-sm border font-bold transition-colors focus:outline-none';
                            const stateClass  = isSelected
                              ? 'bg-brand-orange border-brand-orange text-white'
                              : 'bg-brand-darker border-gray-700 text-white hover:border-brand-orange hover:text-brand-orange';
                            return (
                              <button
                                key={time}
                                type="button"
                                onClick={() => setSelectedTime(time)}
                                className={`${baseClass} ${stateClass}`}
                              >
                                <span className="text-sm leading-tight">{time}</span>
                                <span className={`text-[10px] font-normal mt-0.5 ${isSelected ? 'text-orange-200' : 'text-gray-500'}`}>
                                  done by {completion}
                                </span>
                                {spotsLeft > 0 && (
                                  <span className={`text-[10px] font-semibold mt-1 ${isSelected ? 'text-orange-100' : almostFull ? 'text-yellow-400' : 'text-gray-400'}`}>
                                    {almostFull ? 'Last spot!' : `${spotsLeft} spots left`}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
              <div className="mt-8 flex flex-col-reverse sm:flex-row justify-between gap-4">
                <button onClick={() => setStep(1)} className="w-full sm:w-auto text-gray-400 hover:text-white px-6 py-3 font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 border border-gray-800 rounded-sm">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button onClick={() => setStep(3)} disabled={!selectedDate || !selectedTime || !shopDayIsOpen}
                  className="w-full sm:w-auto bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 rounded-sm"
                  title={!selectedDate ? 'Please pick a date first' : !selectedTime ? 'Please pick a time slot' : undefined}>
                  Enter Your Details <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Details ── */}
          {step === 3 && (
            <div>
              <h2 className="text-2xl font-display font-bold text-white uppercase mb-2">3. Your Details</h2>
              <p className="text-sm text-gray-400 mb-6">Fill in your contact info and vehicle details so we can prepare for your visit.</p>
              {!user && (
                <div className="mb-6 flex items-center justify-between bg-brand-orange/10 border border-brand-orange/30 px-4 py-3 rounded-sm text-sm">
                  <span className="text-gray-300">Have an account? Sign in to pre-fill your details.</span>
                  <Link to="/login?redirect=/booking" className="text-brand-orange font-bold hover:text-orange-400 transition-colors ml-4 shrink-0">Sign In</Link>
                </div>
              )}
              <form id="booking-form" onSubmit={handleSubmit} className="space-y-6">
                {/* Contact */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Full Name *</label>
                    <input type="text" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors rounded-sm" placeholder="Juan dela Cruz" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Phone Number *</label>
                    <input type="tel" required value={form.phone}
                      onChange={handlePhoneChange}
                      className={`w-full bg-brand-darker border text-white px-4 py-3 focus:outline-none transition-colors rounded-sm ${formErrors.phone ? 'border-red-500 focus:border-red-400' : 'border-gray-700 focus:border-brand-orange'}`}
                      placeholder="09XXXXXXXXX" />
                    {formErrors.phone && <p className="text-xs text-red-400 mt-1">{formErrors.phone}</p>}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Email Address *</label>
                    <input type="email" required value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                      className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors rounded-sm" placeholder="juan@email.com" />
                  </div>
                </div>
                {/* Vehicle */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">
                    Vehicle *
                    {makesLoading && <span className="ml-2 text-gray-600 normal-case font-normal">Loading makes…</span>}
                  </p>
                  <p className="text-xs text-gray-600 mb-3">Select the year first, then the make and model of your car.</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs text-gray-600 uppercase tracking-widest">Year</label>
                      <select required value={vehicleYear} onChange={e => setVehicleYear(e.target.value)}
                        className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors rounded-sm appearance-none">
                        <option value="">Select year…</option>
                        {VEHICLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-gray-600 uppercase tracking-widest">Make</label>
                      <select required value={vehicleMake}
                        onChange={e => { setVehicleMake(e.target.value); setVehicleModel(''); }}
                        disabled={makesLoading}
                        className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors rounded-sm appearance-none disabled:opacity-60">
                        <option value="">{makesLoading ? 'Loading…' : 'Select make…'}</option>
                        {makesList.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-gray-600 uppercase tracking-widest">
                        Model
                        {modelsLoading && <span className="ml-1 text-gray-600 normal-case font-normal">Loading…</span>}
                      </label>
                      <select required value={vehicleModel} onChange={e => setVehicleModel(e.target.value)}
                        disabled={!vehicleMake || modelsLoading}
                        className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors rounded-sm appearance-none disabled:opacity-40">
                        <option value="">{modelsLoading ? 'Loading…' : 'Select model…'}</option>
                        {modelsList.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                {/* Notes */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Additional Notes</label>
                  <textarea rows={3} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors resize-none rounded-sm"
                    placeholder="Describe your vision or specific parts you want used…" />
                </div>
                {/* Media upload */}
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500">
                    Reference Photos <span className="text-gray-600 normal-case font-normal">(optional)</span>
                  </label>
                  <p className="text-xs text-gray-600 -mt-1">Upload photos of your vehicle or inspiration images to help us understand what you're looking for.</p>
                  <div onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-gray-700 rounded-sm p-6 text-center cursor-pointer hover:border-gray-500 transition-colors">
                    <UploadCloud className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Click to upload photos <span className="text-gray-700">(JPEG, PNG, WebP · max 10 MB each)</span></p>
                    <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileAdd} />
                  </div>
                  {mediaPreviews.length > 0 && (
                    <div className="flex flex-wrap gap-3">
                      {mediaPreviews.map((src, i) => (
                        <div key={i} className="relative w-20 h-20 rounded-sm overflow-hidden border border-gray-700">
                          <img src={src} alt="" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => removeFile(i)}
                            className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors">
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Signature pad */}
                <SignaturePad value={signatureData} onChange={setSignatureData} />
                {/* Summary */}
                <div className="bg-brand-darker border border-gray-700 rounded-sm p-4 space-y-2 text-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Booking Summary</p>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Services</span>
                    <span className="text-white font-semibold text-right max-w-[60%]">{selectedServices.map(s => s.title).join(', ')}</span>
                  </div>
                  <div className="flex justify-between"><span className="text-gray-400">Vehicle</span><span className="text-white">{vehicleInfo || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Date</span><span className="text-white">{selectedDate?.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Time</span><span className="text-white">{selectedTime}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Est. Duration</span><span className="text-brand-orange font-bold">up to {totalMaxHours} hours</span></div>
                </div>
                {bookError && <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/30 p-3 rounded-sm">{bookError}</p>}
              </form>
              <div className="mt-8 flex flex-col-reverse sm:flex-row justify-between gap-4 pt-6 border-t border-gray-800">
                <button onClick={() => setStep(2)} className="w-full sm:w-auto text-gray-400 hover:text-white px-6 py-3 font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 border border-gray-800 rounded-sm">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button type="submit" form="booking-form"
                  disabled={bookStatus === 'loading' || mediaUploadBusy || !signatureData}
                  title={!signatureData ? 'Please sign the waiver to continue' : undefined}
                  className="w-full sm:w-auto bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 rounded-sm disabled:opacity-60">
                  {(bookStatus === 'loading' || mediaUploadBusy)
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> {mediaUploadBusy ? 'Uploading…' : 'Submitting…'}</>
                    : <><CheckCircle className="w-4 h-4" /> Confirm Booking</>}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Success ── */}
          {step === 4 && (
            <div className="text-center py-12">
              <CheckCircle className="w-24 h-24 text-brand-orange mx-auto mb-6" />
              <h2 className="text-3xl md:text-4xl font-display font-bold text-white uppercase mb-4">You're All Set!</h2>
              <p className="text-gray-400 text-lg mb-2 max-w-md mx-auto">
                Thank you, <span className="text-white font-bold">{form.name}</span>! Your appointment has been booked for{" "}
                <span className="text-white">{selectedDate?.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}</span>{" "}
                at <span className="text-white">{selectedTime}</span>.
              </p>
              <p className="text-sm text-gray-500 mb-2">Services: {selectedServices.map(s => s.title).join(', ')}</p>
              <p className="text-sm text-gray-600 mb-8">We'll send a confirmation to your email. If you need to change anything, just give us a call.</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                {user ? (
                  <button onClick={() => navigate('/client/bookings')}
                    className="bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm">
                    View My Bookings
                  </button>
                ) : (
                  <Link to={`/register?redirect=/client/bookings&name=${encodeURIComponent(form.name)}&email=${encodeURIComponent(form.email)}&phone=${encodeURIComponent(form.phone)}`}
                    className="bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm">
                    Create an Account to Track Your Booking
                  </Link>
                )}
                <button onClick={reset} className="border border-gray-600 text-white px-8 py-3 font-bold uppercase tracking-widest hover:border-brand-orange hover:text-brand-orange transition-colors rounded-sm">
                  Book Another Service
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
