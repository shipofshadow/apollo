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
  fetchShopHoursApi, fetchMyVehiclesApi,
  fetchShopClosedDatesApi,
} from '../services/api';
import { BACKEND_URL } from '../config';
import type { ClientVehicle, ShopDayHours } from '../types';
import { VEHICLE_MAKES as STATIC_MAKES, VEHICLE_MODELS as STATIC_MODELS, VEHICLE_YEARS, type VehicleMake } from '../data/vehicles';
import CustomCalendar from '../components/CustomCalendar';
import PageSEO from '../components/PageSEO';
import SignaturePad from '../components/SignaturePad';
import { formatPrice } from '../utils/formatPrice';

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
function formatDateYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}
/** Parse "09:30 AM" / "01:00 PM" into minutes from midnight. */
function slotToMinutes(slot: string): number {
  const [timePart, ampm] = slot.split(' ');
  const [hRaw, mRaw] = timePart.split(':').map(Number);
  let h = hRaw;
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + (mRaw || 0);
}

/** Build date list from shop hours (falls back to Mon–Sat if hours not loaded) */
function buildDateList(shopHours: ShopDayHours[], closedDatesSet: Set<string>): Date[] {
  const openDays = shopHours.length
    ? new Set(shopHours.filter(h => h.isOpen).map(h => h.dayOfWeek))
    : new Set([1, 2, 3, 4, 5, 6]); // Mon–Sat default

  const dates: Date[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (dates.length < 14) {
    const iso = formatDateYMD(cursor);
    if (openDays.has(cursor.getDay()) && !closedDatesSet.has(iso)) dates.push(new Date(cursor));
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
  const { status: bookStatus, error: bookError, appointments } = useSelector((s: RootState) => s.booking);
  const services = useSelector((s: RootState) => s.services.items.filter(sv => sv.isActive));

  const [step, setStep] = useState(1);

  // Step 1 – single-select service (pre-select from location state if present)
  const preselectedState = (location.state as { serviceId?: number; variationId?: number } | null) ?? null;
  const preselectedId = preselectedState?.serviceId ?? null;
  const [selectedId, setSelectedId] = useState<number | null>(preselectedId);
  // Step 1 – variation selection for the selected service: { [serviceId]: variationId }
  const [selectedVariationIds, setSelectedVariationIds] = useState<Record<number, number>>(
    preselectedId !== null && preselectedState?.variationId
      ? { [preselectedId]: preselectedState.variationId }
      : {}
  );

  // Shop hours – loaded on mount to filter the date picker
  const [shopHours,       setShopHours]       = useState<ShopDayHours[]>([]);
  const [shopHoursLoaded, setShopHoursLoaded] = useState(false);
  const [closedDatesSet,  setClosedDatesSet]  = useState<Set<string>>(new Set());

  // Step 2 – date / time / availability
  const [selectedDate,        setSelectedDate]        = useState<Date | null>(null);
  const [selectedTime,        setSelectedTime]        = useState('');
  const [availableSlots,      setAvailableSlots]      = useState<string[]>([]);
  const [bookedSlots,         setBookedSlots]         = useState<string[]>([]);
  const [slotCounts,          setSlotCounts]          = useState<Record<string, number>>({});
  const [slotCapacity,        setSlotCapacity]        = useState(3);
  const [shopDayIsOpen,       setShopDayIsOpen]       = useState(true);
  const [closureReason,       setClosureReason]       = useState<string | null>(null);
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
  const [myVehicles, setMyVehicles] = useState<ClientVehicle[]>([]);
  const [myVehiclesLoading, setMyVehiclesLoading] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const suppressYearResetRef = useRef(false);
  const suppressMakeResetRef = useRef(false);

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

  const availableDates = buildDateList(shopHoursLoaded ? shopHours : [], closedDatesSet);

  const selectedServices = services.filter(s => s.id === selectedId);
  const totalMaxHours    = selectedServices.reduce(
    (acc, s) => acc + parseDurationMax(s.duration), 0
  );
  const vehicleInfo = [vehicleYear, vehicleMake, vehicleModel].filter(Boolean).join(' ');

  /** Return the effective price for a service: variation price if one is selected, otherwise startingPrice */
  const getEffectivePrice = (svcId: number): string | null => {
    const svc = services.find(s => s.id === svcId);
    if (!svc) return null;
    const varId = selectedVariationIds[svcId];
    if (varId !== undefined) {
      const variation = svc.variations?.find(v => v.id === varId);
      if (variation?.price) return variation.price;
    }
    return svc.startingPrice || null;
  };

  // Load services + shop hours + closed dates on mount
  useEffect(() => {
    dispatch(fetchServicesAsync(token));
    if (BACKEND_URL) {
      Promise.all([fetchShopHoursApi(), fetchShopClosedDatesApi()])
        .then(([{ hours }, cdData]) => {
          setShopHours(hours);
          const cd = (cdData as { closedDates: { date: string }[] }).closedDates ?? [];
          setClosedDatesSet(new Set(cd.map(d => d.date)));
        })
        .catch(() => { /* use default Mon–Sat */ })
        .finally(() => setShopHoursLoaded(true));
    } else {
      setShopHoursLoaded(true);
    }
  }, [dispatch, token]);

  useEffect(() => {
    if (!token || !user) {
      setMyVehicles([]);
      setSelectedVehicleId('');
      return;
    }
    setMyVehiclesLoading(true);
    fetchMyVehiclesApi(token)
      .then(({ vehicles }) => setMyVehicles(vehicles))
      .catch(() => setMyVehicles([]))
      .finally(() => setMyVehiclesLoading(false));
  }, [token, user]);

  // Re-fetch makes whenever year changes; passes year to the API when selected
  useEffect(() => {
    const shouldResetVehicleFields = !suppressYearResetRef.current;
    suppressYearResetRef.current = false;

    setDynamicMakes([]);
    if (shouldResetVehicleFields) {
      setVehicleMake('');
      setDynamicModels([]);
      setVehicleModel('');
    }
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
    const shouldResetModel = !suppressMakeResetRef.current;
    suppressMakeResetRef.current = false;

    setDynamicModels([]);
    if (shouldResetModel) setVehicleModel('');
    if (!vehicleMake || !BACKEND_URL) return;
    setModelsLoading(true);
    const year = vehicleYear ? parseInt(vehicleYear, 10) : undefined;
    fetchVehicleModelsApi(vehicleMake, year)
      .then(({ models }) => setDynamicModels(models))
      .catch(() => { /* fall back to static */ })
      .finally(() => setModelsLoading(false));
  }, [vehicleMake, vehicleYear]);

  const toggleService = (id: number) => {
    if (selectedId === id) {
      // Deselect current service and clear package selection
      setSelectedId(null);
      setSelectedVariationIds({});
      return;
    }

    // Switch selected service and clear old package selection
    setSelectedId(id);
    setSelectedVariationIds({});
  };

  const selectVariation = (serviceId: number, variationId: number) => {
    setSelectedVariationIds(prev => {
      // Toggle off if already selected
      if (prev[serviceId] === variationId) {
        const next = { ...prev };
        delete next[serviceId];
        return next;
      }
      return { ...prev, [serviceId]: variationId };
    });
  };

  const handleDateSelect = async (date: Date) => {
    setSelectedDate(date);
    setSelectedTime('');
    setAvailableSlots([]);
    setBookedSlots([]);
    setSlotCounts({});
    setShopDayIsOpen(true);
    setClosureReason(null);
    if (!BACKEND_URL) return;
    setAvailabilityLoading(true);
    try {
      const res = await fetchAvailabilityApi(formatDateYMD(date));
      setShopDayIsOpen(res.isOpen);
      setClosureReason(res.closureReason ?? null);
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
          serviceIds:      selectedId !== null ? [selectedId] : [],
          selectedVariations: Object.entries(selectedVariationIds)
            .filter(([svcId]) => selectedId !== null && Number(svcId) === selectedId)
            .map(([svcId, varId]) => {
            const svc = services.find(s => s.id === Number(svcId));
            const variation = svc?.variations?.find(v => v.id === varId);
            return {
              serviceId:     Number(svcId),
              variationId:   varId,
              variationName: variation?.name ?? '',
            };
            }),
          appointmentDate: formatDateYMD(selectedDate!),
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
    setSelectedId(null);
    setSelectedVariationIds({});
    setSelectedDate(null);
    setSelectedTime('');
    setAvailableSlots([]);
    setBookedSlots([]);
    setSlotCounts({});
    setShopDayIsOpen(true);
    setForm({ name: user?.name ?? '', email: user?.email ?? '', phone: user?.phone ?? '', notes: '' });
    setVehicleMake(''); setVehicleModel(''); setVehicleYear('');
    setSelectedVehicleId('');
    setDynamicModels([]);
    setMediaFiles([]); setMediaPreviews([]);
    setSignatureData('');
    setFormErrors({});
  };

  return (
    <div className="pt-32 pb-24 min-h-screen bg-brand-darker">
      <PageSEO
        title="Book a Service"
        description="Schedule your automotive retrofitting or customization service at 1625 Auto Lab. Book online in minutes with live availability."
      />
      <div className="container mx-auto px-4 md:px-6 max-w-4xl">
        <div className="text-center mb-12">
          <span className="text-brand-orange font-bold uppercase tracking-widest text-sm block mb-3">Schedule Your Visit</span>
          <h1 className="text-4xl md:text-5xl font-display font-black text-white uppercase tracking-tighter mb-4">
            Book <span className="text-brand-orange">Appointment</span>
          </h1>
          <p className="text-gray-400 text-lg">Select your services, choose a date and time, then provide your details.</p>
        </div>

        {/* Step indicators */}
        <div className="flex justify-between items-center mb-6 md:mb-12 relative">
          <div className="absolute left-0 top-3.5 md:top-5 -translate-y-1/2 w-full h-0.5 bg-gray-800 z-0" />
          <div className="absolute left-0 top-3.5 md:top-5 -translate-y-1/2 h-0.5 bg-brand-orange z-0 transition-all duration-500"
            style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }} />
          {STEPS.map((stepItem, i) => {
            const n = i + 1;
            const active = step >= n;
            return (
              <div key={n} className="relative z-10 flex flex-col items-center gap-0.5 md:gap-2">
                <div className={`w-7 md:w-10 h-7 md:h-10 rounded-full flex items-center justify-center font-bold text-xs md:text-sm transition-colors ${active ? 'bg-brand-orange text-white' : 'bg-gray-800 text-gray-500'}`}>
                  {n === STEPS.length && step === STEPS.length ? <CheckCircle className="w-3.5 md:w-5 h-3.5 md:h-5" /> : n}
                </div>
                <span className={`hidden sm:block text-[8px] md:text-xs font-bold uppercase tracking-widest line-clamp-1 text-center max-w-12 md:max-w-none ${active ? 'text-brand-orange' : 'text-gray-600'}`}>{stepItem.label}</span>
              </div>
            );
          })}
        </div>

        <div className="bg-brand-dark border border-gray-800 p-3 md:p-6 lg:p-10 rounded-sm">

          {/* ── Step 1: Services ── */}
          {step === 1 && (
            <div>
              <h2 className="text-lg md:text-2xl font-display font-bold text-white uppercase mb-1 md:mb-2">1. Select a Service</h2>
              <p className="text-xs md:text-sm text-gray-400 mb-4 md:mb-6">Tap the service you'd like. Price and estimated time are shown on each card.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
                {services.map(svc => {
                  const active = selectedId === svc.id;
                  return (
                    <button key={svc.id} type="button" onClick={() => toggleService(svc.id)}
                      className={`p-6 border text-left transition-all rounded-sm relative ${active ? 'border-brand-orange bg-brand-orange/10' : 'border-gray-800 hover:border-gray-600'}`}>
                      {active && (
                        <span className="absolute top-3 right-3 w-5 h-5 bg-brand-orange rounded-full flex items-center justify-center">
                          <CheckCircle className="w-3 h-3 text-white" />
                        </span>
                      )}
                      <h3 className="text-lg font-bold text-white mb-2 pr-8">{svc.title}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {svc.duration}</span>
                        <span className="text-brand-orange font-bold">{formatPrice(svc.startingPrice)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Variation picker – shown for each selected service that has variations */}
              {selectedServices.some(s => s.variations && s.variations.length > 0) && (
                <div className="mt-6 space-y-4">
                  {selectedServices.filter(s => s.variations && s.variations.length > 0).map(svc => (
                    <div key={svc.id} className="bg-brand-darker border border-gray-700 rounded-sm p-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                        {svc.title} — Choose a Package
                        <span className="ml-1 font-normal text-gray-600">(optional)</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {svc.variations.map(v => {
                          const picked = selectedVariationIds[svc.id] === v.id;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => selectVariation(svc.id, v.id)}
                              className={`px-4 py-2 border text-sm font-bold uppercase tracking-widest rounded-sm transition-colors ${
                                picked
                                  ? 'bg-brand-orange text-white border-brand-orange'
                                  : 'text-gray-400 border-gray-700 hover:border-brand-orange hover:text-white'
                              }`}
                            >
                              {v.name}
                              {v.price && (
                                <span className={`ml-2 font-normal normal-case tracking-normal ${picked ? 'text-orange-200' : 'text-gray-500'}`}>
                                  {formatPrice(v.price)}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedId !== null && (
                <div className="mt-6 bg-brand-darker border border-gray-700 rounded-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
                  <div>
                    <span className="text-gray-400">Selected: </span>
                    <span className="text-white font-semibold">{selectedServices.map(s => s.title).join(', ')}</span>
                    {Object.keys(selectedVariationIds).length > 0 && (
                      <div className="mt-1 text-xs text-brand-orange">
                        {Object.entries(selectedVariationIds).map(([svcId, varId]) => {
                          const svc = services.find(s => s.id === Number(svcId));
                          const variation = svc?.variations?.find(v => v.id === varId);
                          return variation ? (
                            <span key={svcId} className="mr-3">
                              <strong>{variation.name}</strong>
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                    <div className="mt-1 text-xs text-gray-400 space-y-0.5">
                      {selectedServices.map(svc => {
                        const price = getEffectivePrice(svc.id);
                        return price ? (
                          <div key={svc.id}>
                            <span className="text-brand-orange font-bold">{formatPrice(price)}</span>
                          </div>
                        ) : null;
                      })}
                    </div>
                  </div>
                  <span className="text-brand-orange font-bold flex items-center gap-1 shrink-0">
                    <Clock className="w-4 h-4" /> Est. {totalMaxHours}h max
                  </span>
                </div>
              )}
              <div className="mt-8 flex justify-end">
                <button type="button" onClick={() => setStep(2)} disabled={selectedId === null}
                  className="w-full sm:w-auto bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 rounded-sm"
                  title={selectedId === null ? 'Please select a service to continue' : undefined}>
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
                <div className="max-w-md mx-auto">
                  <CustomCalendar
                    value={selectedDate}
                    onChange={handleDateSelect}
                    availableDates={availableDates}
                    closedDatesSet={closedDatesSet}
                    slotCounts={slotCounts}
                    slotCapacity={slotCapacity}
                  />
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
                      {closureReason
                        ? `Shop closed – ${closureReason}. Please choose a different day.`
                        : 'The shop is closed on this date. Please choose a different day.'}
                    </p>
                  )}

                  {!availabilityLoading && shopDayIsOpen && (() => {
                    const [closeH] = shopCloseTime.split(':').map(Number);
                    const now = new Date();
                    const nowMinutes = now.getHours() * 60 + now.getMinutes();
                    const isTodaySelected = !!selectedDate && isSameLocalDay(selectedDate, now);
                    const visibleSlots = availableSlots.filter(time =>
                      !bookedSlots.includes(time)
                      && slotToHour(time) + totalMaxHours <= closeH
                      && (!isTodaySelected || slotToMinutes(time) > nowMinutes)
                    );
                    return (
                      <>
                        <p className="text-xs text-gray-600 mb-3">
                          Closes at {shopCloseTime} · Slots that won't fit your job duration are hidden.
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {visibleSlots.length === 0 && (
                            <p className="col-span-full text-sm text-gray-500 py-2">
                              {isTodaySelected
                                ? 'No available slots left for today.'
                                : 'No available slots for this date.'}
                            </p>
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
              <h2 className="text-lg md:text-2xl font-display font-bold text-white uppercase mb-1 md:mb-2">3. Your Details</h2>
              <p className="text-xs md:text-sm text-gray-400 mb-4 md:mb-6">Fill in your contact info and vehicle details so we can prepare for your visit.</p>
              {!user && (
                <div className="mb-4 md:mb-6 flex items-center justify-between bg-brand-orange/10 border border-brand-orange/30 px-3 md:px-4 py-2 md:py-3 rounded-sm text-xs md:text-sm gap-2">
                  <span className="text-gray-300">Have an account? Sign in to pre-fill your details.</span>
                  <Link to="/login?redirect=/booking" className="text-brand-orange font-bold hover:text-orange-400 transition-colors shrink-0">Sign In</Link>
                </div>
              )}
              <form id="booking-form" onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
                {/* Contact */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-5">
                  <div className="space-y-1.5 md:space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Full Name *</label>
                    <input type="text" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full bg-brand-darker border border-gray-700 text-white px-2 md:px-4 py-2 md:py-3 focus:outline-none focus:border-brand-orange transition-colors rounded-sm text-xs md:text-sm" placeholder="Juan dela Cruz" />
                  </div>
                  <div className="space-y-1.5 md:space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Phone Number *</label>
                    <input type="tel" required value={form.phone}
                      onChange={handlePhoneChange}
                      className={`w-full bg-brand-darker border text-white px-2 md:px-4 py-2 md:py-3 focus:outline-none transition-colors rounded-sm text-xs md:text-sm ${formErrors.phone ? 'border-red-500 focus:border-red-400' : 'border-gray-700 focus:border-brand-orange'}`}
                      placeholder="09XXXXXXXXX" />
                    {formErrors.phone && <p className="text-xs text-red-400 mt-0.5">{formErrors.phone}</p>}
                  </div>
                  <div className="space-y-1.5 md:space-y-2 md:col-span-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Email Address *</label>
                    <input type="email" required value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                      className="w-full bg-brand-darker border border-gray-700 text-white px-2 md:px-4 py-2 md:py-3 focus:outline-none focus:border-brand-orange transition-colors rounded-sm text-xs md:text-sm" placeholder="juan@email.com" />
                  </div>
                </div>
                {/* Vehicle */}
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">
                    Vehicle *
                    {makesLoading && <span className="ml-2 text-gray-600 normal-case font-normal">Loading makes…</span>}
                  </p>
                  <p className="text-xs text-gray-600 mb-3">Select the year first, then the make and model of your car.</p>
                  {!!user && (
                    <div className="mb-4 space-y-2">
                      <label className="text-xs text-gray-600 uppercase tracking-widest">
                        Saved Vehicle
                        {myVehiclesLoading && <span className="ml-1 normal-case">Loading…</span>}
                      </label>
                      <select
                        value={selectedVehicleId}
                        onChange={e => {
                          const id = e.target.value;
                          setSelectedVehicleId(id);
                          if (!id) return;
                          const picked = myVehicles.find(v => String(v.id) === id);
                          if (!picked) return;
                          suppressYearResetRef.current = true;
                          suppressMakeResetRef.current = true;
                          setVehicleYear(picked.year);
                          setVehicleMake(picked.make);
                          setVehicleModel(picked.model);
                        }}
                        className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors rounded-sm appearance-none"
                      >
                        <option value="">{myVehicles.length ? 'Choose from My Garage…' : 'No saved vehicles yet'}</option>
                        {myVehicles.map(v => (
                          <option key={v.id} value={v.id}>
                            {v.year} {v.make} {v.model}{v.licensePlate ? ` (${v.licensePlate})` : ''}
                          </option>
                        ))}
                      </select>
                      {selectedVehicleId && (() => {
                        const selectedVehicle = myVehicles.find(v => String(v.id) === selectedVehicleId);
                        if (!selectedVehicle?.imageUrl) return null;
                        return (
                          <div className="rounded-sm border border-gray-700 overflow-hidden bg-black/20">
                            <img src={selectedVehicle.imageUrl} alt={`${selectedVehicle.year} ${selectedVehicle.make} ${selectedVehicle.model}`} className="w-full h-28 object-cover" />
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs text-gray-600 uppercase tracking-widest">Year</label>
                      <select required value={vehicleYear} onChange={e => { setSelectedVehicleId(''); setVehicleYear(e.target.value); }}
                        className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors rounded-sm appearance-none">
                        <option value="">Select year…</option>
                        {VEHICLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-gray-600 uppercase tracking-widest">Make</label>
                      <select required value={vehicleMake}
                        onChange={e => { setSelectedVehicleId(''); setVehicleMake(e.target.value); setVehicleModel(''); }}
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
                      <select required value={vehicleModel} onChange={e => { setSelectedVehicleId(''); setVehicleModel(e.target.value); }}
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
                  {selectedServices.map(svc => {
                    const price = getEffectivePrice(svc.id);
                    return price ? (
                      <div key={svc.id} className="flex justify-between">
                        <span className="text-gray-500 pl-4">{svc.title}</span>
                        <span className="text-brand-orange font-bold">{formatPrice(price)}</span>
                      </div>
                    ) : null;
                  })}
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
                            {appointments.length > 0 && appointments[0].referenceNumber && (
                              <div className="mb-6 inline-block bg-black/40 border border-brand-orange/50 rounded-sm px-4 py-3">
                                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Your Reference Number</p>
                                <p className="text-xl font-mono font-bold text-brand-orange">{appointments[0].referenceNumber}</p>
                              </div>
                            )}
              <p className="text-gray-400 text-lg mb-2 max-w-md mx-auto">
                Thank you, <span className="text-white font-bold">{form.name}</span>! Your appointment has been booked for{" "}
                <span className="text-white">{selectedDate?.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}</span>{" "}
                at <span className="text-white">{selectedTime}</span>.
              </p>
              <p className="text-sm text-gray-500 mb-2">Services: {selectedServices.map(s => s.title).join(', ')}</p>
              {Object.keys(selectedVariationIds).length > 0 && (
                <p className="text-sm text-gray-500 mb-2">
                  Packages:{' '}
                  {Object.entries(selectedVariationIds).map(([svcId, varId]) => {
                    const svc = services.find(s => s.id === Number(svcId));
                    const variation = svc?.variations?.find(v => v.id === varId);
                    return variation ? `${svc?.title} – ${variation.name}` : null;
                  }).filter(Boolean).join(', ')}
                </p>
              )}
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
