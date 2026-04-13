import React, { useState, useEffect, useRef } from 'react';
import { Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Clock, CheckCircle, ArrowLeft, ArrowRight, Loader2,
  UploadCloud, X, Calendar as CalendarIcon, Car, Bell
} from 'lucide-react';
import { submitBookingAsync, resetBookingState } from '../store/bookingSlice';
import { fetchServicesAsync } from '../store/servicesSlice';
import type { AppDispatch, RootState } from '../store';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  fetchAvailabilityApi, uploadBookingMediaApi,
  fetchVehicleMakesApi, fetchVehicleModelsApi,
  fetchShopHoursApi, fetchMyVehiclesApi,
  createMyVehicleApi,
  fetchShopClosedDatesApi,
  joinWaitlistApi,
  fetchWaitlistClaimApi,
} from '../services/api';
import { BACKEND_URL } from '../config';
import type { ClientVehicle, ShopDayHours } from '../types';
import { VEHICLE_MAKES as STATIC_MAKES, VEHICLE_MODELS as STATIC_MODELS, VEHICLE_YEARS, type VehicleMake } from '../data/vehicles';
import CustomCalendar from '../components/CustomCalendar';
import PageSEO from '../components/PageSEO';
import SignaturePad from '../components/SignaturePad';
import { formatPrice } from '../utils/formatPrice';
import TurnstileWidget from '../components/TurnstileWidget';

// ── Constants & Helpers ───────────────────────────────────────────────────────

const STEPS = [
  { label: 'Services',    desc: 'Choose what you need' },
  { label: 'Date & Time', desc: 'Pick a schedule' },
  { label: 'Your Details', desc: 'Tell us about you' },
  { label: 'Confirmed',   desc: 'All done!' },
];

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

function slotToMinutes(slot: string): number {
  const [timePart, ampm] = slot.split(' ');
  const [hRaw, mRaw] = timePart.split(':').map(Number);
  let h = hRaw;
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + (mRaw || 0);
}

function buildDateList(shopHours: ShopDayHours[], closedDatesSet: Set<string>): Date[] {
  const openDays = shopHours.length
    ? new Set(shopHours.filter(h => h.isOpen).map(h => h.dayOfWeek))
    : new Set([1, 2, 3, 4, 5, 6]); 

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

function isValidPhone(phone: string): boolean {
  return /^(\+?63|0)[-\s]?9\d{2}[-\s]?\d{3}[-\s]?\d{4}$/.test(phone.trim());
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BookingPage() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token, hasPermission } = useAuth();
  const { showToast } = useToast();
  const { status: bookStatus, error: bookError, appointments } = useSelector((s: RootState) => s.booking);
  const services = useSelector((s: RootState) => s.services.items.filter(sv => sv.isActive));

  const [step, setStep] = useState(1);

  const preselectedState = (location.state as { serviceId?: number; variationId?: number } | null) ?? null;
  const preselectedId = preselectedState?.serviceId ?? null;
  const [selectedId, setSelectedId] = useState<number | null>(preselectedId);
  const [selectedVariationIds, setSelectedVariationIds] = useState<Record<number, number>>(
    preselectedId !== null && preselectedState?.variationId
      ? { [preselectedId]: preselectedState.variationId }
      : {}
  );

  const [shopHours, setShopHours] = useState<ShopDayHours[]>([]);
  const [shopHoursLoaded, setShopHoursLoaded] = useState(false);
  const [closedDatesSet, setClosedDatesSet] = useState<Set<string>>(new Set());

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [slotCounts, setSlotCounts] = useState<Record<string, number>>({});
  const [slotCapacity, setSlotCapacity] = useState(3);
  const [waitlistJoining, setWaitlistJoining] = useState(false);
  const [waitlistJoined, setWaitlistJoined] = useState<string | null>(null); // "date|time" key
  const [shopDayIsOpen, setShopDayIsOpen] = useState(true);
  const [closureReason, setClosureReason] = useState<string | null>(null);
  const [shopCloseTime, setShopCloseTime] = useState('18:00');
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [waitlistClaimToken, setWaitlistClaimToken] = useState<string>('');
  const [waitlistClaimNotice, setWaitlistClaimNotice] = useState<string | null>(null);

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

  const [dynamicMakes, setDynamicMakes] = useState<string[]>([]);
  const [dynamicModels, setDynamicModels] = useState<string[]>([]);
  const [makesLoading, setMakesLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);

  const makesList  = dynamicMakes.length  ? dynamicMakes  : [...STATIC_MAKES];
  const modelsList = dynamicModels.length ? dynamicModels
    : vehicleMake ? (STATIC_MODELS[vehicleMake as VehicleMake] ?? []) : [];

  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [mediaUploadBusy, setMediaUploadBusy] = useState(false);
  const [vehicleSaveBusy, setVehicleSaveBusy] = useState(false);
  const [showVehicleSaveModal, setShowVehicleSaveModal] = useState(false);
  const vehicleSaveDecisionResolverRef = useRef<((shouldSave: boolean) => void) | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [signatureData, setSignatureData] = useState('');
  const [formErrors, setFormErrors] = useState<{ phone?: string; email?: string }>({});
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileKey,   setTurnstileKey]   = useState(0);

  const availableDates = buildDateList(shopHoursLoaded ? shopHours : [], closedDatesSet);
  const selectedServices = services.filter(s => s.id === selectedId);
  const totalMaxHours    = selectedServices.reduce(
    (acc, s) => acc + parseDurationMax(s.duration), 0
  );
  const vehicleInfo = [vehicleYear, vehicleMake, vehicleModel].filter(Boolean).join(' ');

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

  useEffect(() => {
    dispatch(fetchServicesAsync(token));
    if (BACKEND_URL) {
      Promise.all([fetchShopHoursApi(), fetchShopClosedDatesApi()])
        .then(([{ hours }, cdData]) => {
          setShopHours(hours);
          const cd = (cdData as { closedDates: { date: string }[] }).closedDates ?? [];
          setClosedDatesSet(new Set(cd.map(d => d.date)));
        })
        .catch(() => {})
        .finally(() => setShopHoursLoaded(true));
    } else {
      setShopHoursLoaded(true);
    }
  }, [dispatch, token]);

  useEffect(() => {
    const tokenFromUrl = new URLSearchParams(location.search).get('waitlist_claim')?.trim() ?? '';
    if (!tokenFromUrl || !BACKEND_URL) {
      return;
    }

    setWaitlistClaimToken(tokenFromUrl);
    fetchWaitlistClaimApi(tokenFromUrl)
      .then(({ entry }) => {
        const date = entry.slotDate ? new Date(`${entry.slotDate}T00:00:00`) : null;
        if (date && !Number.isNaN(date.getTime())) {
          setSelectedDate(date);
          void handleDateSelect(date);
        }

        if (entry.slotTime && entry.slotTime !== 'any') {
          setSelectedTime(entry.slotTime);
        }

        setWaitlistClaimNotice(`Waitlist claim active. Complete your booking in this window to secure ${entry.slotDate} ${entry.slotTime === 'any' ? '(any available slot)' : `at ${entry.slotTime}`}.`);
      })
      .catch((e: unknown) => {
        setWaitlistClaimToken('');
        setWaitlistClaimNotice((e as Error).message ?? 'This waitlist claim link is invalid or expired.');
      });
  }, [location.search]);

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
      .catch(() => {})
      .finally(() => setMakesLoading(false));
  }, [vehicleYear]);

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
      .catch(() => {})
      .finally(() => setModelsLoading(false));
  }, [vehicleMake, vehicleYear]);

  const toggleService = (id: number) => {
    if (selectedId === id) {
      setSelectedId(null);
      setSelectedVariationIds({});
      return;
    }
    setSelectedId(id);
    setSelectedVariationIds({});
  };

  const selectVariation = (serviceId: number, variationId: number) => {
    setSelectedVariationIds(prev => {
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
    } catch {}
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

  const askToSaveVehicle = () => {
    setShowVehicleSaveModal(true);
    return new Promise<boolean>(resolve => {
      vehicleSaveDecisionResolverRef.current = resolve;
    });
  };

  const resolveVehicleSaveModal = (shouldSave: boolean) => {
    setShowVehicleSaveModal(false);
    vehicleSaveDecisionResolverRef.current?.(shouldSave);
    vehicleSaveDecisionResolverRef.current = null;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(p => ({ ...p, phone: e.target.value }));
    setFormErrors(prev => ({ ...prev, phone: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors: { phone?: string; email?: string } = {};
    if (form.phone && !isValidPhone(form.phone)) {
      errors.phone = 'Enter a valid Philippine mobile number (e.g. 09171234567).';
    }
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});

    if (user && token && !selectedVehicleId && vehicleYear && vehicleMake && vehicleModel) {
      const vehicleAlreadySaved = myVehicles.some(v =>
        v.year.trim() === vehicleYear.trim()
        && v.make.trim().toLowerCase() === vehicleMake.trim().toLowerCase()
        && v.model.trim().toLowerCase() === vehicleModel.trim().toLowerCase()
      );

      if (!vehicleAlreadySaved) {
        const shouldSaveVehicle = await askToSaveVehicle();
        if (shouldSaveVehicle) {
          setVehicleSaveBusy(true);
          try {
            const { vehicle } = await createMyVehicleApi(token, {
              year: vehicleYear,
              make: vehicleMake,
              model: vehicleModel,
            });
            setMyVehicles(prev => [vehicle, ...prev]);
            setSelectedVehicleId(String(vehicle.id));
            showToast('Vehicle saved to your Garage.', 'success');
          } catch (e) {
            showToast((e as Error).message ?? 'Could not save vehicle to Garage.', 'error');
          } finally {
            setVehicleSaveBusy(false);
          }
        }
      }
    }

    let mediaUrls: string[] = [];
    if (mediaFiles.length && BACKEND_URL) {
      setMediaUploadBusy(true);
      try { mediaUrls = await uploadBookingMediaApi(mediaFiles); }
      catch {}
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
          'cf-turnstile-response': turnstileToken,
          waitlistClaimToken: waitlistClaimToken || undefined,
        },
        token,
      })
    );
    if (submitBookingAsync.fulfilled.match(result)) {
      setStep(4);
    } else {
      setTurnstileKey(k => k + 1);
    }
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
    setTurnstileToken('');
    setTurnstileKey(k => k + 1);
  };

  // Shared generic input style
  const inputClass = "w-full bg-black/20 border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange transition-all rounded-sm text-sm";

  // Non-client internal roles cannot submit bookings through the public form.
  if (user && !hasPermission('client:self')) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="pt-32 pb-24 min-h-screen bg-brand-darker">
      <PageSEO
        title="Book a Service"
        description="Schedule your automotive retrofitting or customization service at 1625 Auto Lab. Book online in minutes with live availability."
      />
      <div className="container mx-auto px-4 md:px-6 max-w-5xl">
        <div className="text-center mb-12">
          <span className="text-brand-orange font-bold uppercase tracking-widest text-sm block mb-3">Schedule Your Visit</span>
          <h1 className="text-4xl md:text-5xl font-display font-black text-white uppercase tracking-tighter mb-4">
            Book <span className="text-brand-orange">Appointment</span>
          </h1>
          <p className="text-gray-400 text-lg">Select your services, choose a date and time, then provide your details.</p>
          {waitlistClaimNotice && (
            <div className="mt-4 mx-auto max-w-3xl text-left border border-brand-orange/30 bg-brand-orange/10 px-4 py-3 rounded-sm">
              <p className="text-sm text-brand-orange">{waitlistClaimNotice}</p>
            </div>
          )}
        </div>

        {/* Step indicators */}
        <div className="flex justify-between items-center mb-8 md:mb-12 relative max-w-3xl mx-auto">
          <div className="absolute left-0 top-3.5 md:top-5 -translate-y-1/2 w-full h-0.5 bg-gray-800 z-0" />
          <div className="absolute left-0 top-3.5 md:top-5 -translate-y-1/2 h-0.5 bg-brand-orange z-0 transition-all duration-500"
            style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }} />
          {STEPS.map((stepItem, i) => {
            const n = i + 1;
            const active = step >= n;
            return (
              <div key={n} className="relative z-10 flex flex-col items-center gap-2">
                <div className={`w-7 md:w-10 h-7 md:h-10 rounded-full flex items-center justify-center font-bold text-xs md:text-sm transition-colors duration-300 ${active ? 'bg-brand-orange text-white shadow-[0_0_15px_rgba(255,102,0,0.4)]' : 'bg-gray-800 text-gray-500'}`}>
                  {n === STEPS.length && step === STEPS.length ? <CheckCircle className="w-4 md:w-5 h-4 md:h-5" /> : n}
                </div>
                <span className={`hidden sm:block text-[10px] md:text-xs font-bold uppercase tracking-widest line-clamp-1 text-center ${active ? 'text-brand-orange' : 'text-gray-600'}`}>{stepItem.label}</span>
              </div>
            );
          })}
        </div>

        <div className="bg-brand-dark border border-gray-800 p-4 md:p-8 lg:p-10 rounded-sm shadow-2xl">

          {/* ── Step 1: Services ── */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <h2 className="text-xl md:text-2xl font-display font-bold text-white uppercase mb-2">1. Select a Service</h2>
              <p className="text-sm text-gray-400 mb-6">Tap the service you'd like. Price and estimated time are shown on each card.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map(svc => {
                  const active = selectedId === svc.id;
                  return (
                    <button key={svc.id} type="button" onClick={() => toggleService(svc.id)}
                      className={`p-6 border text-left transition-all duration-200 rounded-sm relative group ${active ? 'border-brand-orange bg-brand-orange/5 shadow-md scale-[1.01]' : 'border-gray-800 bg-black/20 hover:border-gray-600 hover:-translate-y-1 hover:shadow-lg'}`}>
                      {active && (
                        <span className="absolute top-4 right-4 w-6 h-6 bg-brand-orange rounded-full flex items-center justify-center shadow-md">
                          <CheckCircle className="w-3.5 h-3.5 text-white" />
                        </span>
                      )}
                      <h3 className="text-lg font-bold text-white mb-2 pr-10">{svc.title}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-400">
                        <span className="flex items-center gap-1"><Clock className="w-4 h-4 text-gray-500" /> {svc.duration}</span>
                        <span className="text-brand-orange font-bold bg-brand-orange/10 px-2 py-0.5 rounded">{formatPrice(svc.startingPrice)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Variation picker */}
              {selectedServices.some(s => s.variations && s.variations.length > 0) && (
                <div className="mt-6 space-y-4">
                  {selectedServices.filter(s => s.variations && s.variations.length > 0).map(svc => (
                    <div key={svc.id} className="bg-black/30 border border-gray-700 rounded-sm p-5 shadow-inner">
                      <p className="text-xs font-bold uppercase tracking-widest text-brand-orange mb-4 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        {svc.title} — Choose a Package
                        <span className="font-normal text-gray-500 ml-auto normal-case tracking-normal">(optional)</span>
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {svc.variations.map(v => {
                          const picked = selectedVariationIds[svc.id] === v.id;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => selectVariation(svc.id, v.id)}
                              className={`p-3 border text-sm text-left rounded-sm transition-all duration-200 flex flex-col justify-center ${
                                picked
                                  ? 'bg-brand-orange/10 border-brand-orange text-white shadow-sm'
                                  : 'bg-brand-dark border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
                              }`}
                            >
                              <span className="font-bold uppercase tracking-wide">{v.name}</span>
                              {v.price && (
                                <span className={`mt-1 font-mono text-xs ${picked ? 'text-brand-orange' : 'text-gray-500'}`}>
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

              {/* Service Selection Summary footer */}
              <div className="mt-8 pt-6 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm flex-1 w-full">
                   {selectedId !== null ? (
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <div className="flex items-center gap-2 text-white">
                            <span className="w-2 h-2 rounded-full bg-brand-orange"></span>
                            <span className="font-bold">{selectedServices.map(s => s.title).join(', ')}</span>
                        </div>
                        <span className="hidden sm:inline text-gray-600">|</span>
                        <span className="text-gray-400 flex items-center gap-1">
                          <Clock className="w-4 h-4" /> Max {totalMaxHours}h
                        </span>
                      </div>
                   ) : (
                     <span className="text-gray-500 italic">No service selected yet.</span>
                   )}
                </div>
                
                <button type="button" onClick={() => setStep(2)} disabled={selectedId === null}
                  className="w-full sm:w-auto bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 rounded-sm"
                  title={selectedId === null ? 'Please select a service to continue' : undefined}>
                  Next Step <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Date & Time ── */}
          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-500">
              <h2 className="text-xl md:text-2xl font-display font-bold text-white uppercase mb-2">2. Choose a Date & Time</h2>
              <p className="text-sm text-gray-400 mb-8">Select a day from the calendar, then pick an available time slot.</p>
              
              {/* 2-Column Layout on Desktop */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
                
                {/* Left Col: Calendar */}
                <div className="lg:col-span-7">
                  <div className="bg-black/20 border border-gray-800 p-4 md:p-6 rounded-sm">
                    <p className="text-xs font-bold flex items-center gap-2 uppercase tracking-widest text-brand-orange mb-6">
                      <CalendarIcon className="w-4 h-4" /> Available Dates
                    </p>
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

                {/* Right Col: Time Slots */}
                <div className="lg:col-span-5">
                  <div className="h-full flex flex-col">
                    <div className="flex items-center justify-between mb-6">
                      <label className="text-xs font-bold uppercase tracking-widest text-brand-orange flex items-center gap-2">
                        <Clock className="w-4 h-4" /> Appointment Time *
                      </label>
                      {availabilityLoading && (
                        <span className="text-gray-500 text-xs flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Checking…
                        </span>
                      )}
                    </div>

                    {!selectedDate ? (
                        <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-800 rounded-sm p-10 text-center bg-black/10">
                            <CalendarIcon className="w-10 h-10 text-gray-700 mb-3" />
                            <p className="text-gray-500 text-sm">Please select a date from the calendar to view available time slots.</p>
                        </div>
                    ) : (
                        <div className="flex-1">
                          {!availabilityLoading && !shopDayIsOpen && (
                            <div className="bg-red-500/10 border border-red-500/20 px-6 py-4 rounded-sm text-center">
                              <p className="text-sm text-red-400">
                                {closureReason
                                  ? `Shop closed – ${closureReason}. Please choose a different day.`
                                  : 'The shop is closed on this date. Please choose a different day.'}
                              </p>
                            </div>
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
                                <p className="text-xs text-gray-500 mb-4 pb-4 border-b border-gray-800">
                                  Shop closes at {shopCloseTime}. Slots that won't accommodate your {totalMaxHours}h service duration are hidden.
                                </p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                  {visibleSlots.length === 0 && !isTodaySelected && (
                                    <div className="col-span-full py-6 text-center bg-brand-orange/5 border border-brand-orange/10 rounded-sm space-y-3 px-4">
                                      <p className="text-sm text-brand-orange/80">
                                        No available slots for this date.
                                      </p>
                                      {(() => {
                                        const slotKey = `${selectedDate ? selectedDate.toISOString().slice(0,10) : ''}|all`;
                                        if (waitlistJoined === slotKey) {
                                          return <p className="text-xs text-green-400 font-semibold">✓ You're on the waitlist! We'll notify you if a slot opens.</p>;
                                        }
                                        return (
                                          <button
                                            disabled={waitlistJoining}
                                            onClick={async () => {
                                              const dateStr = selectedDate ? selectedDate.toISOString().slice(0,10) : '';
                                              setWaitlistJoining(true);
                                              try {
                                                await joinWaitlistApi({
                                                  slotDate: dateStr,
                                                  slotTime: 'any',
                                                  name: form.name || user?.name || '',
                                                  email: form.email || user?.email || '',
                                                  phone: form.phone || user?.phone || '',
                                                  serviceIds: selectedServices.map(s => s.id).join(','),
                                                }, token);
                                                setWaitlistJoined(slotKey);
                                                showToast("You've joined the waitlist!", 'success');
                                              } catch (e) {
                                                showToast((e as Error).message ?? 'Could not join waitlist.', 'error');
                                              } finally {
                                                setWaitlistJoining(false);
                                              }
                                            }}
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-orange text-white text-xs font-bold uppercase tracking-widest rounded-sm hover:bg-orange-600 transition-colors disabled:opacity-50"
                                          >
                                            <Bell className="w-3.5 h-3.5" />
                                            {waitlistJoining ? 'Joining…' : 'Join Waitlist'}
                                          </button>
                                        );
                                      })()}
                                    </div>
                                  )}
                                  {visibleSlots.length === 0 && isTodaySelected && (
                                    <p className="col-span-full text-sm text-brand-orange/80 py-6 text-center bg-brand-orange/5 border border-brand-orange/10 rounded-sm">
                                      No available slots left for today.
                                    </p>
                                  )}
                                  {visibleSlots.map(time => {
                                    const isSelected  = selectedTime === time;
                                    const completion  = slotCompletionLabel(time, totalMaxHours);
                                    const takenCount  = slotCounts[time] ?? 0;
                                    const spotsLeft   = slotCapacity - takenCount;
                                    const almostFull  = spotsLeft === 1;
                                    
                                    return (
                                      <button
                                        key={time}
                                        type="button"
                                        onClick={() => setSelectedTime(time)}
                                        className={`flex flex-col items-center justify-center p-3 rounded-sm border transition-all duration-200 focus:outline-none ${
                                            isSelected
                                            ? 'bg-brand-orange border-brand-orange text-white shadow-[0_0_10px_rgba(255,102,0,0.3)]'
                                            : 'bg-black/20 border-gray-700 text-gray-300 hover:border-brand-orange/70 hover:text-white hover:bg-black/40'
                                        }`}
                                      >
                                        <span className="text-sm font-bold tracking-wide">{time}</span>
                                        <span className={`text-[10px] mt-1 ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                                          done by {completion}
                                        </span>
                                        {spotsLeft > 0 && (
                                          <span className={`text-[10px] font-semibold mt-1 ${isSelected ? 'text-white' : almostFull ? 'text-brand-orange' : 'text-gray-500'}`}>
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
                  </div>
                </div>
              </div>

              <div className="mt-10 pt-6 border-t border-gray-800 flex flex-col-reverse sm:flex-row justify-between gap-4">
                <button onClick={() => setStep(1)} className="w-full sm:w-auto text-gray-400 hover:text-white px-6 py-3 font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 border border-gray-800 rounded-sm">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button onClick={() => setStep(3)} disabled={!selectedDate || !selectedTime || !shopDayIsOpen}
                  className="w-full sm:w-auto bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 rounded-sm"
                  title={!selectedDate ? 'Please pick a date first' : !selectedTime ? 'Please pick a time slot' : undefined}>
                  Next Step <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Details ── */}
          {step === 3 && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-500 relative">
              
              <div className="mb-6">
                <h2 className="text-xl md:text-2xl font-display font-bold text-white uppercase mb-2">3. Your Details</h2>
                <p className="text-sm text-gray-400">Fill in your contact info and vehicle details so we can prepare for your visit.</p>
              </div>

              {!user && (
                <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between bg-brand-orange/5 border border-brand-orange/20 px-4 py-3 rounded-sm text-sm gap-4">
                  <span className="text-gray-300">Have an account? Sign in to pre-fill your details and save this vehicle.</span>
                  <Link to="/login?redirect=/booking" className="bg-brand-orange/20 text-brand-orange px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-sm hover:bg-brand-orange hover:text-white transition-colors shrink-0 text-center">
                    Sign In
                  </Link>
                </div>
              )}

              {/* 2-Column Layout for Form vs Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
                
                {/* Left Col: The Form */}
                <div className="lg:col-span-8">
                  <form id="booking-form" onSubmit={handleSubmit} className="space-y-8">
                    
                    {/* Section: Contact */}
                    <fieldset className="border border-gray-800 p-5 md:p-6 rounded-sm bg-black/10">
                        <legend className="text-xs font-bold uppercase tracking-widest text-brand-orange px-2 bg-brand-dark">Contact Info</legend>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Full Name *</label>
                            <input type="text" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                              className={inputClass} placeholder="Juan dela Cruz" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Phone Number *</label>
                            <input type="tel" required value={form.phone} onChange={handlePhoneChange}
                              className={`${inputClass} ${formErrors.phone ? '!border-red-500 focus:!ring-red-500' : ''}`} placeholder="09XXXXXXXXX" />
                            {formErrors.phone && <p className="text-xs text-red-400 mt-1">{formErrors.phone}</p>}
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Email Address *</label>
                            <input type="email" required value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                              className={inputClass} placeholder="juan@email.com" />
                          </div>
                        </div>
                    </fieldset>

                    {/* Section: Vehicle */}
                    <fieldset className="border border-gray-800 p-5 md:p-6 rounded-sm bg-black/10">
                        <legend className="text-xs font-bold uppercase tracking-widest text-brand-orange px-2 bg-brand-dark flex items-center gap-2">
                            <Car className="w-4 h-4" /> Vehicle Details *
                        </legend>
                        <div className="mt-2">
                            {makesLoading && <p className="text-xs text-brand-orange mb-3 animate-pulse">Syncing vehicle databases...</p>}
                            
                            {!!user && (
                                <div className="mb-6 p-4 bg-black/20 border border-gray-700 rounded-sm">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-2">
                                    Load from Garage {myVehiclesLoading && <span className="normal-case tracking-normal ml-2 text-gray-500">(Loading...)</span>}
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
                                    className={`${inputClass} appearance-none bg-brand-dark cursor-pointer`}
                                >
                                    <option value="">{myVehicles.length ? 'Choose a saved vehicle...' : 'No saved vehicles yet'}</option>
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
                                    <div className="mt-4 rounded-sm border border-gray-700 overflow-hidden h-32 relative">
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
                                        <img src={selectedVehicle.imageUrl} alt="Vehicle" className="w-full h-full object-cover" />
                                        <span className="absolute bottom-2 left-3 z-20 text-xs font-bold text-white shadow-sm">Selected Vehicle</span>
                                    </div>
                                    );
                                })()}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block">Year</label>
                                <select required value={vehicleYear} onChange={e => { setSelectedVehicleId(''); setVehicleYear(e.target.value); }}
                                    className={`${inputClass} appearance-none cursor-pointer`}>
                                    <option value="">Select year…</option>
                                    {VEHICLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                                </div>
                                <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block">Make</label>
                                <select required value={vehicleMake}
                                    onChange={e => { setSelectedVehicleId(''); setVehicleMake(e.target.value); setVehicleModel(''); }}
                                    disabled={makesLoading}
                                    className={`${inputClass} appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}>
                                    <option value="">{makesLoading ? 'Loading…' : 'Select make…'}</option>
                                    {makesList.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                                </div>
                                <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block">
                                    Model {modelsLoading && <span className="text-brand-orange animate-pulse ml-1">•</span>}
                                </label>
                                <select required value={vehicleModel} onChange={e => { setSelectedVehicleId(''); setVehicleModel(e.target.value); }}
                                    disabled={!vehicleMake || modelsLoading}
                                    className={`${inputClass} appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}>
                                    <option value="">{modelsLoading ? 'Loading…' : 'Select model…'}</option>
                                    {modelsList.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                                </div>
                            </div>
                        </div>
                    </fieldset>

                    {/* Section: Notes & Media */}
                    <fieldset className="border border-gray-800 p-5 md:p-6 rounded-sm bg-black/10">
                        <legend className="text-xs font-bold uppercase tracking-widest text-brand-orange px-2 bg-brand-dark">Additional Info</legend>
                        <div className="mt-2 space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Project Notes / Requests</label>
                                <textarea rows={3} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                                className={`${inputClass} resize-y min-h-[100px]`}
                                placeholder="Describe your vision, issues you're facing, or specific parts you want used…" />
                            </div>

                            <div className="space-y-3">
                                <label className="text-xs font-bold uppercase tracking-widest text-gray-500 flex justify-between items-end">
                                    <span>Reference Photos <span className="text-gray-600 normal-case font-normal">(optional)</span></span>
                                    <span className="text-[10px] text-gray-600 normal-case">Max 10MB each</span>
                                </label>
                                <div onClick={() => fileInputRef.current?.click()}
                                className="border-2 border-dashed border-gray-700 bg-black/20 rounded-sm p-6 text-center cursor-pointer hover:border-brand-orange/50 hover:bg-brand-orange/5 transition-all group">
                                <UploadCloud className="w-8 h-8 text-gray-500 mx-auto mb-2 group-hover:text-brand-orange transition-colors" />
                                <p className="text-sm text-gray-400">Click to browse or drag photos here</p>
                                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileAdd} />
                                </div>
                                
                                {mediaPreviews.length > 0 && (
                                <div className="flex flex-wrap gap-3 pt-2">
                                    {mediaPreviews.map((src, i) => (
                                    <div key={i} className="relative w-20 h-20 rounded-sm overflow-hidden border border-gray-600 group">
                                        <img src={src} alt="" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <button type="button" onClick={() => removeFile(i)}
                                        className="absolute top-1 right-1 w-6 h-6 bg-red-600 rounded-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 shadow-lg">
                                        <X className="w-3.5 h-3.5 text-white" />
                                        </button>
                                    </div>
                                    ))}
                                </div>
                                )}
                            </div>
                        </div>
                    </fieldset>

                    {/* Section: Signature */}
                    <div className="space-y-2">
    <SignaturePad 
        value={signatureData} 
        onChange={setSignatureData} 
        isModal 
    />
</div>


                    <TurnstileWidget
                      onVerify={setTurnstileToken}
                      onExpire={() => setTurnstileToken('')}
                      resetKey={turnstileKey}
                    />

                    {bookError && (
                        <div className="bg-red-500/10 border-l-4 border-red-500 p-4 rounded-sm">
                            <p className="text-sm text-red-400 font-medium">{bookError}</p>
                        </div>
                    )}
                  </form>
                </div>

                {/* Right Col: Sticky Summary Panel */}
                <div className="lg:col-span-4 relative">
                  <div className="sticky top-24 bg-black/30 border border-gray-700 rounded-sm p-5 md:p-6 shadow-xl">
                    <p className="text-sm font-bold uppercase tracking-widest text-brand-orange border-b border-gray-800 pb-4 mb-4">Booking Summary</p>
                    
                    <div className="space-y-5 text-sm">
                        
                        {/* Summary Block: Service */}
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block mb-1">Service Required</span>
                            <div className="text-white font-medium">{selectedServices.map(s => s.title).join(', ')}</div>
                            <div className="mt-1 space-y-1">
                                {selectedServices.map(svc => {
                                const price = getEffectivePrice(svc.id);
                                const varId = selectedVariationIds[svc.id];
                                const variation = varId ? svc.variations?.find(v => v.id === varId) : null;
                                
                                return price ? (
                                    <div key={svc.id} className="flex justify-between items-start">
                                    <span className="text-gray-400 text-xs">
                                        {variation ? `+ ${variation.name}` : 'Base service'}
                                    </span>
                                    <span className="text-brand-orange font-mono">{formatPrice(price)}</span>
                                    </div>
                                ) : null;
                                })}
                            </div>
                        </div>

                        {/* Summary Block: Schedule */}
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block mb-1">Schedule</span>
                            <div className="text-white font-medium">{selectedDate?.toLocaleDateString('en-PH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</div>
                            <div className="text-gray-300">{selectedTime} <span className="text-gray-500">({totalMaxHours}h estimated)</span></div>
                        </div>

                        {/* Summary Block: Vehicle */}
                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 block mb-1">Vehicle</span>
                            <div className="text-white font-medium">{vehicleInfo || <span className="text-gray-600 italic">Pending...</span>}</div>
                        </div>

                    </div>
                  </div>
                </div>

              </div>

              {/* Action Buttons */}
              <div className="mt-10 pt-6 border-t border-gray-800 flex flex-col-reverse sm:flex-row justify-between gap-4">
                <button onClick={() => setStep(2)} className="w-full sm:w-auto text-gray-400 hover:text-white px-6 py-3 font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 border border-gray-800 rounded-sm">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button type="submit" form="booking-form"
                  disabled={bookStatus === 'loading' || mediaUploadBusy || vehicleSaveBusy || !signatureData || !turnstileToken}
                  title={!signatureData ? 'Please sign the waiver to continue' : !turnstileToken ? 'Please complete the CAPTCHA' : undefined}
                  className="w-full sm:w-auto bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 rounded-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(255,102,0,0.2)]">
                  {(bookStatus === 'loading' || mediaUploadBusy || vehicleSaveBusy)
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> {vehicleSaveBusy ? 'Saving Vehicle…' : mediaUploadBusy ? 'Uploading…' : 'Finalizing…'}</>
                    : <><CheckCircle className="w-4 h-4" /> Confirm Booking</>}
                </button>
              </div>

            </div>
          )}

          {/* ── Step 4: Success ── */}
          {step === 4 && (
            <div className="text-center py-16 animate-in zoom-in-95 duration-500">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-brand-orange/10 mb-8 shadow-[0_0_30px_rgba(255,102,0,0.2)]">
                <CheckCircle className="w-12 h-12 text-brand-orange" />
              </div>
              <h2 className="text-3xl md:text-5xl font-display font-black text-white uppercase tracking-tight mb-4">You're All Set!</h2>
              
              {appointments.length > 0 && appointments[0].referenceNumber && (
                <div className="mb-8 inline-block bg-black/40 border border-brand-orange/30 rounded-sm px-6 py-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Your Reference Number</p>
                  <p className="text-2xl md:text-3xl font-mono font-bold text-brand-orange tracking-wider">{appointments[0].referenceNumber}</p>
                </div>
              )}
              
              <div className="bg-black/20 border border-gray-800 p-6 rounded-sm max-w-xl mx-auto mb-8 text-left">
                  <p className="text-gray-300 text-lg mb-4 text-center">
                    Thank you, <span className="text-white font-bold">{form.name}</span>!
                  </p>
                  <div className="grid grid-cols-2 gap-4 text-sm mt-4">
                      <div>
                          <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Date & Time</p>
                          <p className="text-white">{selectedDate?.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                          <p className="text-white">{selectedTime}</p>
                      </div>
                      <div>
                          <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Vehicle</p>
                          <p className="text-white">{vehicleInfo}</p>
                      </div>
                      <div className="col-span-2 mt-2 pt-4 border-t border-gray-800">
                          <p className="text-gray-500 text-xs uppercase tracking-widest mb-1">Services</p>
                          <p className="text-white">{selectedServices.map(s => s.title).join(', ')}</p>
                          {Object.keys(selectedVariationIds).length > 0 && (
                            <p className="text-brand-orange text-xs mt-1 font-mono">
                            + {Object.entries(selectedVariationIds).map(([svcId, varId]) => {
                                const svc = services.find(s => s.id === Number(svcId));
                                const variation = svc?.variations?.find(v => v.id === varId);
                                return variation ? variation.name : null;
                            }).filter(Boolean).join(', ')}
                            </p>
                          )}
                      </div>
                  </div>
              </div>
              
              <p className="text-sm text-gray-500 mb-8 max-w-md mx-auto">We'll send a confirmation to your email. If you need to modify or cancel, please contact us directly.</p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-lg mx-auto">
                {user ? (
                  <button
                    onClick={() => {
                      if (appointments.length > 0) {
                        navigate(`/client/bookings/${appointments[0].id}`);
                      } else {
                        navigate('/client/bookings');
                      }
                    }}
                    className="w-full bg-brand-orange text-white px-8 py-3.5 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm shadow-md">
                    View Dashboard
                  </button>
                ) : (
                  <Link to={`/register?redirect=/client/bookings&name=${encodeURIComponent(form.name)}&email=${encodeURIComponent(form.email)}&phone=${encodeURIComponent(form.phone)}`}
                    className="w-full bg-brand-orange text-white px-8 py-3.5 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm text-center shadow-md">
                    Track Booking
                  </Link>
                )}
                <button onClick={reset} className="w-full border border-gray-600 text-gray-300 px-8 py-3.5 font-bold uppercase tracking-widest hover:border-brand-orange hover:text-brand-orange transition-colors rounded-sm">
                  Book Another
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showVehicleSaveModal && (
        <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-sm border border-gray-700 bg-brand-dark shadow-2xl p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-orange mb-2">Save Vehicle</p>
            <h3 className="text-xl font-display font-bold text-white mb-2">Save this vehicle to Garage?</h3>
            <p className="text-sm text-gray-400 mb-5">
              You can reuse this vehicle next time for faster booking checkout.
            </p>
            <div className="rounded-sm border border-gray-800 bg-black/20 px-3 py-2 text-sm text-gray-300 mb-6">
              {vehicleInfo || 'Selected vehicle'}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => resolveVehicleSaveModal(false)}
                className="px-4 py-2 rounded-sm border border-gray-700 text-gray-300 text-xs font-bold uppercase tracking-widest hover:border-gray-500 hover:text-white"
              >
                Not Now
              </button>
              <button
                type="button"
                onClick={() => resolveVehicleSaveModal(true)}
                className="px-4 py-2 rounded-sm bg-brand-orange text-white text-xs font-bold uppercase tracking-widest hover:bg-orange-600"
              >
                Save Vehicle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
