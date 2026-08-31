import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import PageSEO from '../components/PageSEO';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { BACKEND_URL } from '../config';
import {
  fetchInquiryAvailabilityApi,
  fetchShopClosedDatesApi,
  fetchShopHoursApi,
  fetchSiteSettingsApi,
  joinWaitlistApi,
  fetchServicesApi
} from '../services/api';
import type { ShopDayHours } from '../types';
import CustomCalendar from '../components/CustomCalendar';
import TurnstileWidget from '../components/TurnstileWidget';

// Icons
import {
  FaUser,
  FaCar,
  FaCalendarAlt,
  FaClock,
  FaWrench,
  FaBell
} from 'react-icons/fa';
import { Loader2, ArrowRight, CheckCircle, Check, Sparkles, ShieldCheck, Copy, Store, Home } from 'lucide-react';

const YEARS = Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i);

function formatDateYMD(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function slotToMinutes(slot: string): number {
  const [timePart, ampm] = slot.split(' ');
  const [hourRaw, minuteRaw] = timePart.split(':').map(Number);
  let hour = hourRaw;
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return hour * 60 + (minuteRaw || 0);
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function formatCloseTimeString(closeTime: string, openMinutes?: number): string {
  if (!closeTime) return '';
  const [hStr, mStr] = closeTime.split(':');
  const h = Number(hStr || '0');
  const m = Number(mStr || '0');
  const closeRaw = (h % 24) * 60 + m;
  const d = new Date();
  d.setHours(h === 24 ? 0 : h, m, 0, 0);

  if (openMinutes === undefined) {
    return format(d, 'h:mm aa');
  }

  if (closeRaw <= openMinutes) {
    if (closeRaw === 0) return '12:00 AM (next day)';
    return `${format(d, 'h:mm aa')} (next day)`;
  }

  return format(d, 'h:mm aa');
}

function buildDateList(shopHours: ShopDayHours[], closedDatesSet: Set<string>, weeks: number = 2): Date[] {
  const openDays = shopHours.length
    ? new Set(shopHours.filter((hour) => hour.isOpen).map((hour) => hour.dayOfWeek))
    : new Set([1, 2, 3, 4, 5, 6]);

  const targetCount = Math.max(1, weeks) * 7;
  const dates: Date[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (dates.length < targetCount) {
    const iso = formatDateYMD(cursor);
    if (openDays.has(cursor.getDay()) && !closedDatesSet.has(iso)) dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

const INITIAL_FORM_STATE = {
  fullName: '',
  address: '',
  contactNumber: '',
  emailAddress: '',
  facebookName: '',
  make: '',
  model: '',
  yearModel: '',
  plateNumber: '',
  serviceType: 'shop_visit' as 'shop_visit' | 'home_service',
  appointmentDate: '', // Will store as YYYY-MM-DD
  appointmentTime: '', // Will store as h:mm aa (e.g. 2:30 PM)
  productToPurchase: ''
};

const inputClass = "w-full h-11 bg-black/40 border border-gray-800 text-white px-3.5 py-2.5 rounded-lg text-sm placeholder-gray-600 focus:outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange/50 transition-all duration-200";

export default function CustomerFormPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [step, setStep] = useState(1);
  const [submittedData, setSubmittedData] = useState<typeof formData | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const { showToast } = useToast();
  const { user, token } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [slotCounts, setSlotCounts] = useState<Record<string, number>>({});
  const [slotCapacity, setSlotCapacity] = useState(3);
  const [shopHours, setShopHours] = useState<ShopDayHours[]>([]);
  const [shopHoursLoaded, setShopHoursLoaded] = useState(false);
  const [closedDatesSet, setClosedDatesSet] = useState<Set<string>>(new Set());
  const [shopDayIsOpen, setShopDayIsOpen] = useState(true);
  const [closureReason, setClosureReason] = useState<string | null>(null);
  const [shopCloseTime, setShopCloseTime] = useState('18:00');
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [waitlistJoining, setWaitlistJoining] = useState(false);
  const [waitlistJoined, setWaitlistJoined] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [privacyAgreed, setPrivacyAgreed] = useState(true);
  const [searchParams] = useSearchParams();
  const [services, setServices] = useState<any[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [bookingHorizonWeeks, setBookingHorizonWeeks] = useState(2);

  const availableDates = buildDateList(shopHoursLoaded ? shopHours : [], closedDatesSet, bookingHorizonWeeks);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    fetchServicesApi()
      .then(res => {
        const svcs = res.services || [];
        setServices(svcs);
        const prefilledSvc = searchParams.get('serviceId') || searchParams.get('service');
        if (prefilledSvc) {
          const matched = svcs.find((s: any) => String(s.id) === prefilledSvc || s.slug === prefilledSvc || s.title.toLowerCase().includes(prefilledSvc.toLowerCase()));
          if (matched) {
            setSelectedServiceId(String(matched.id));
          }
        }
      })
      .catch(() => { });
  }, [searchParams]);

  useEffect(() => {
    const prefilledDate = searchParams.get('date')?.trim() ?? '';
    const prefilledTime = searchParams.get('time')?.trim() ?? '';

    if (prefilledDate) {
      const parsedDate = new Date(`${prefilledDate}T00:00:00`);
      if (!Number.isNaN(parsedDate.getTime())) {
        setSelectedDate(parsedDate);
        setFormData((prev) => ({ ...prev, appointmentDate: prefilledDate }));
      }
    }

    if (prefilledTime) {
      setSelectedTime(prefilledTime);
      setFormData((prev) => ({ ...prev, appointmentTime: prefilledTime }));
    }
  }, [searchParams]);

  useEffect(() => {
    const prefilledDate = searchParams.get('date')?.trim() ?? '';
    if (!prefilledDate || !BACKEND_URL || !shopHoursLoaded) return;

    const parsedDate = new Date(`${prefilledDate}T00:00:00`);
    if (Number.isNaN(parsedDate.getTime())) return;

    void handleDateSelect(parsedDate);
  }, [searchParams, shopHoursLoaded]);

  useEffect(() => {
    if (!BACKEND_URL) {
      setShopHoursLoaded(true);
      return;
    }

    Promise.all([fetchShopHoursApi(), fetchShopClosedDatesApi(), fetchSiteSettingsApi()])
      .then(([{ hours }, closedDatesData, { settings }]) => {
        setShopHours(hours);
        const dates = (closedDatesData as { closedDates: { date: string }[] }).closedDates ?? [];
        setClosedDatesSet(new Set(dates.map((date) => date.date)));
        setBookingHorizonWeeks(Math.max(1, parseInt(settings.booking_horizon_weeks ?? '2', 10) || 2));
      })
      .catch(() => { })
      .finally(() => setShopHoursLoaded(true));
  }, []);

  const handleDateSelect = async (date: Date) => {
    setSelectedDate(date);
    setSelectedTime('');
    setAvailableSlots([]);
    setBookedSlots([]);
    setSlotCounts({});
    setShopDayIsOpen(true);
    setClosureReason(null);
    setFormData((prev) => ({ ...prev, appointmentDate: format(date, 'yyyy-MM-dd'), appointmentTime: '' }));

    if (!BACKEND_URL) return;

    setAvailabilityLoading(true);
    try {
      const response = await fetchInquiryAvailabilityApi(formatDateYMD(date));
      setShopDayIsOpen(response.isOpen);
      setClosureReason(response.closureReason ?? null);
      setShopCloseTime(response.closeTime);
      setAvailableSlots(response.availableSlots);
      setBookedSlots(response.bookedSlots);
      setSlotCounts(response.slotCounts ?? {});
      setSlotCapacity(response.slotCapacity ?? 3);
    } catch (error) {
      console.error('Unable to load availability', error);
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setFormData((prev) => ({ ...prev, appointmentTime: time }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.plateNumber.trim()) {
      showToast('Please enter your Vehicle Plate / CS Number.', 'error');
      return;
    }

    if (!formData.appointmentDate || !formData.appointmentTime) {
      showToast('Please choose a date and time for your appointment.', 'error');
      return;
    }

    if (!privacyAgreed) {
      showToast('Please agree to the Privacy Policy to submit your schedule request.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      // Submit Inquiry via Backend API (Backend automatically syncs to Google Sheets with Reference Number)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${BACKEND_URL}/api/inquiries`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...formData,
          serviceId: selectedServiceId ? Number(selectedServiceId) : undefined,
          'cf-turnstile-response': turnstileToken
        }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.detail ?? 'Unable to submit inquiry to the database.');
      }

      showToast('Form submitted successfully! A confirmation notification has been scheduled.', 'success');

      setSubmittedData({ ...formData });
      setSubmittedId(result?.inquiry?.id ?? null);
      setSubmittedRef(result?.inquiry?.referenceNumber ?? result?.inquiry?.reference_number ?? null);

      setFormData(INITIAL_FORM_STATE);
      setSelectedDate(null);
      setSelectedTime('');
      setStep(2);

    } catch (error) {
      console.error('Error submitting form:', error);
      showToast(error instanceof Error ? error.message : 'An error occurred. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
      setTurnstileToken('');
      setTurnstileKey(k => k + 1);
    }
  };

  const selectedServiceObj = services.find((s: any) => String(s.id) === selectedServiceId);

  return (
    <div className="pt-28 sm:pt-32 pb-24 min-h-screen bg-brand-darker text-gray-200 font-sans">
      <PageSEO
        title="1625 Autolab Schedule Request"
        description="Fill out this form to order products or schedule a service with 1625 Autolab."
        image="https://cdn.1625autolab.com/1625autolab/logos/order.png"
        appendSiteName={true}
      />

      <div className="container mx-auto px-4 md:px-6 max-w-7xl">

        {/* ── 1. Page Header & Process Bar ────────────────────────── */}
        {step === 1 && (
          <header className="mb-10 text-center relative">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-orange/10 border border-brand-orange/30 text-brand-orange text-[11px] font-bold uppercase tracking-[0.2em] mb-4">
              <Sparkles className="w-3.5 h-3.5" /> 1625 Autolab Booking
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-white uppercase tracking-wide">
              Request a <span className="text-brand-orange">Schedule</span>
            </h1>
            <p className="text-gray-400 text-xs sm:text-sm md:text-base max-w-xl mx-auto mt-2 leading-relaxed">
              Lock in your spot on the floor. Drop your details below and our team will confirm your appointment schedule.
            </p>

            {/* Visual Process Indicator */}
            <div className="mt-8 max-w-xl mx-auto flex items-center justify-between relative px-2">
              <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-800 -translate-y-1/2 -z-10" />

              {/* Step 1: Details */}
              <div className="flex flex-col items-center gap-1.5 bg-brand-darker px-3">
                <span className="w-7 h-7 rounded-full bg-brand-orange text-white font-mono font-bold text-xs flex items-center justify-center shadow-lg shadow-brand-orange/30">
                  01
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-orange">Details</span>
              </div>

              {/* Step 2: Schedule */}
              <div className="flex flex-col items-center gap-1.5 bg-brand-darker px-3">
                <span className={`w-7 h-7 rounded-full font-mono font-bold text-xs flex items-center justify-center transition-colors ${selectedDate && selectedTime
                  ? 'bg-brand-orange text-white shadow-lg shadow-brand-orange/30'
                  : 'bg-gray-800 text-gray-400 border border-gray-700'
                  }`}>
                  02
                </span>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${selectedDate && selectedTime ? 'text-brand-orange' : 'text-gray-500'
                  }`}>
                  Schedule
                </span>
              </div>

              {/* Step 3: Confirmation */}
              <div className="flex flex-col items-center gap-1.5 bg-brand-darker px-3">
                <span className="w-7 h-7 rounded-full bg-gray-800 text-gray-500 border border-gray-700 font-mono font-bold text-xs flex items-center justify-center">
                  03
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Confirm</span>
              </div>
            </div>
          </header>
        )}

        {/* ── Main Form Workflow (Step 1) ─────────────────────────── */}
        {step === 1 && (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* Left Main Column (8 cols) */}
            <div className="lg:col-span-8 space-y-8">

              {/* Card Wrapper */}
              <div className="bg-brand-dark border border-gray-800 rounded-xl p-5 sm:p-8 shadow-xl space-y-8">

                {/* ── Section 01: Client Details ─────────────────────── */}
                <section className="space-y-5 border-b border-gray-800/80 pb-8">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-brand-orange/10 border border-brand-orange/30 flex items-center justify-center text-brand-orange font-mono font-bold text-xs">
                      01
                    </span>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <FaUser className="text-brand-orange w-3.5 h-3.5" /> Client Details
                      </h2>
                      <p className="text-xs text-gray-400">How can our service team contact you?</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Row 1: Name & Phone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label htmlFor="fullName" className="block text-xs font-semibold text-gray-300">
                          Full Name <span className="text-brand-orange">*</span>
                        </label>
                        <input
                          type="text" id="fullName" name="fullName" required
                          value={formData.fullName} onChange={handleChange}
                          className={inputClass}
                          placeholder="Juan Dela Cruz"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="contactNumber" className="block text-xs font-semibold text-gray-300">
                          Contact Number <span className="text-brand-orange">*</span>
                        </label>
                        <input
                          type="tel" id="contactNumber" name="contactNumber" required
                          value={formData.contactNumber} onChange={handleChange}
                          className={inputClass}
                          placeholder="0912 345 6789"
                        />
                      </div>
                    </div>

                    {/* Row 2: Email & Facebook */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label htmlFor="emailAddress" className="block text-xs font-semibold text-gray-300">
                          Email Address <span className="text-brand-orange">*</span>
                        </label>
                        <input
                          type="email" id="emailAddress" name="emailAddress" required
                          value={formData.emailAddress} onChange={handleChange}
                          className={inputClass}
                          placeholder="juan@example.com"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="facebookName" className="block text-xs font-semibold text-gray-300">
                          Facebook Profile <span className="text-brand-orange">*</span>
                        </label>
                        <input
                          type="text" id="facebookName" name="facebookName" required
                          value={formData.facebookName} onChange={handleChange}
                          className={inputClass}
                          placeholder="Profile Name or Facebook link"
                        />
                      </div>
                    </div>

                    {/* Row 3: Address */}
                    <div className="space-y-1.5">
                      <label htmlFor="address" className="block text-xs font-semibold text-gray-300">
                        Complete Address <span className="text-brand-orange">*</span>
                      </label>
                      <input
                        type="text" id="address" name="address" required
                        value={formData.address} onChange={handleChange}
                        className={inputClass}
                        placeholder="House/Block No., Street, Barangay, City/Province"
                      />
                    </div>
                  </div>
                </section>

                {/* ── Section 02: Vehicle Specs ──────────────────────── */}
                <section className="space-y-5 border-b border-gray-800/80 pb-8">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-brand-orange/10 border border-brand-orange/30 flex items-center justify-center text-brand-orange font-mono font-bold text-xs">
                      02
                    </span>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <FaCar className="text-brand-orange w-3.5 h-3.5" /> Vehicle Specs
                      </h2>
                      <p className="text-xs text-gray-400">Tell us about your vehicle setup.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label htmlFor="plateNumber" className="block text-xs font-semibold text-gray-300">
                        Plate / CS Number <span className="text-brand-orange">*</span>
                      </label>
                      <input
                        type="text" id="plateNumber" name="plateNumber" required
                        value={formData.plateNumber} onChange={handleChange}
                        className={`${inputClass} uppercase font-mono`}
                        placeholder="ABC-1234 / CS Number"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="yearModel" className="block text-xs font-semibold text-gray-300">
                        Year Model <span className="text-brand-orange">*</span>
                      </label>
                      <select
                        id="yearModel" name="yearModel" required
                        value={formData.yearModel} onChange={handleChange}
                        className={`${inputClass} cursor-pointer`}
                      >
                        <option value="" disabled>Select Year</option>
                        {YEARS.map(year => (
                          <option key={year} value={year}>{year}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="make" className="block text-xs font-semibold text-gray-300">
                        Make <span className="text-brand-orange">*</span>
                      </label>
                      <input
                        type="text" id="make" name="make" required
                        value={formData.make} onChange={handleChange}
                        className={inputClass}
                        placeholder="e.g. Honda / Toyota / Ford"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="model" className="block text-xs font-semibold text-gray-300">
                        Model <span className="text-brand-orange">*</span>
                      </label>
                      <input
                        type="text" id="model" name="model" required
                        value={formData.model} onChange={handleChange}
                        className={inputClass}
                        placeholder="e.g. Civic RS / Fortuner / Raptor"
                      />
                    </div>
                  </div>
                </section>

                {/* ── Section 03: Service & Request ──────────────────── */}
                <section className="space-y-6 border-b border-gray-800/80 pb-8">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-brand-orange/10 border border-brand-orange/30 flex items-center justify-center text-brand-orange font-mono font-bold text-xs">
                      03
                    </span>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <FaWrench className="text-brand-orange w-3.5 h-3.5" /> Service &amp; Request
                      </h2>
                      <p className="text-xs text-gray-400">Select your preferred service location and package details.</p>
                    </div>
                  </div>

                  {/* ── Shop Visit vs Home Service Selection ────────────── */}
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-gray-300">
                      Service Location / Type <span className="text-brand-orange">*</span>
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {/* Shop Visit Option */}
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, serviceType: 'shop_visit' }))}
                        className={`p-4 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between cursor-pointer ${
                          formData.serviceType === 'shop_visit'
                            ? 'border-brand-orange bg-brand-orange/10 ring-1 ring-brand-orange/50 shadow-md'
                            : 'border-gray-800 bg-brand-darker/60 hover:border-gray-700 hover:bg-brand-darker'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`p-2 rounded-lg ${
                            formData.serviceType === 'shop_visit' ? 'bg-brand-orange text-white' : 'bg-gray-800 text-gray-400'
                          }`}>
                            <Store className="w-3.5 h-3.5" />
                          </span>
                          {formData.serviceType === 'shop_visit' && <Check className="w-4 h-4 text-brand-orange" />}
                        </div>
                        <div>
                          <h3 className={`text-xs font-bold uppercase tracking-wider mb-1 ${
                            formData.serviceType === 'shop_visit' ? 'text-brand-orange' : 'text-white'
                          }`}>
                            Shop Visit
                          </h3>
                          <p className="text-[10px] text-gray-400 leading-relaxed">
                            Visit our shop in KM 20 Ortigas Ave Ext., Cainta, Philippines, 1900.
                          </p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-gray-800/80 flex items-center justify-between text-[9px] font-mono uppercase">
                          <span className={formData.serviceType === 'shop_visit' ? 'text-brand-orange font-bold' : 'text-gray-500'}>
                            {formData.serviceType === 'shop_visit' ? '✓ Selected' : 'Select'}
                          </span>
                          <span className="text-gray-500">1625 Autolab</span>
                        </div>
                      </button>

                      {/* Home Service Option */}
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, serviceType: 'home_service' }))}
                        className={`p-4 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between cursor-pointer ${
                          formData.serviceType === 'home_service'
                            ? 'border-brand-orange bg-brand-orange/10 ring-1 ring-brand-orange/50 shadow-md'
                            : 'border-gray-800 bg-brand-darker/60 hover:border-gray-700 hover:bg-brand-darker'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className={`p-2 rounded-lg ${
                            formData.serviceType === 'home_service' ? 'bg-brand-orange text-white' : 'bg-gray-800 text-gray-400'
                          }`}>
                            <Home className="w-3.5 h-3.5" />
                          </span>
                          {formData.serviceType === 'home_service' && <Check className="w-4 h-4 text-brand-orange" />}
                        </div>
                        <div>
                          <h3 className={`text-xs font-bold uppercase tracking-wider mb-1 ${
                            formData.serviceType === 'home_service' ? 'text-brand-orange' : 'text-white'
                          }`}>
                            Home Service
                          </h3>
                          <p className="text-[10px] text-gray-400 leading-relaxed">
                            On-site installation at your doorstep. <span className="text-amber-400/90 font-medium">Subject to home service / travel fee.</span>
                          </p>
                        </div>
                        <div className="mt-3 pt-2 border-t border-gray-800/80 flex items-center justify-between text-[9px] font-mono uppercase">
                          <span className={formData.serviceType === 'home_service' ? 'text-brand-orange font-bold' : 'text-gray-500'}>
                            {formData.serviceType === 'home_service' ? '✓ Selected' : 'Select'}
                          </span>
                          <span className="text-amber-400 font-semibold">+ Service Fee</span>
                        </div>
                      </button>
                    </div>

                    {/* Home Service Fee Notice Banner */}
                    {formData.serviceType === 'home_service' && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 text-xs text-amber-200/90 leading-relaxed animate-fadeIn">
                        <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-amber-300">Home Service Fee Notice: </span>
                          An additional home service / travel fee applies depending on your location and distance. Our team will verify your address and confirm the total fee prior to dispatch.
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Selectable Service Cards */}
                  {services.length > 0 && (
                    <div className="space-y-3">
                      <label className="block text-xs font-semibold text-gray-300">
                        Select Primary Service <span className="text-gray-500 font-normal">(optional)</span>
                      </label>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {services.map((s: any) => {
                          const isSelected = selectedServiceId === String(s.id);
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => setSelectedServiceId(isSelected ? '' : String(s.id))}
                              className={`p-4 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between cursor-pointer ${isSelected
                                ? 'border-brand-orange bg-brand-orange/10 ring-1 ring-brand-orange/50 shadow-md'
                                : 'border-gray-800 bg-brand-darker/60 hover:border-gray-700 hover:bg-brand-darker'
                                }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className={`p-2 rounded-lg ${isSelected ? 'bg-brand-orange text-white' : 'bg-gray-800 text-gray-400'}`}>
                                  <FaWrench className="w-3.5 h-3.5" />
                                </span>
                                {isSelected && <Check className="w-4 h-4 text-brand-orange" />}
                              </div>
                              <div>
                                <h3 className={`text-xs font-bold uppercase tracking-wider mb-1 ${isSelected ? 'text-brand-orange' : 'text-white'}`}>
                                  {s.title}
                                </h3>
                                {s.startingPrice && (
                                  <p className="text-[10px] text-gray-400 font-mono">From {s.startingPrice}</p>
                                )}
                              </div>
                              <div className="mt-3 pt-2 border-t border-gray-800/80 flex items-center justify-between text-[9px] font-mono uppercase">
                                <span className={isSelected ? 'text-brand-orange font-bold' : 'text-gray-500'}>
                                  {isSelected ? '✓ Selected' : 'Select'}
                                </span>
                                {s.variations?.length ? (
                                  <span className="text-gray-500">{s.variations.length} Options</span>
                                ) : null}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Tell us what you need Textarea */}
                  <div className="space-y-1.5">
                    <label htmlFor="productToPurchase" className="block text-xs font-semibold text-gray-300">
                      Tell Us What You Need <span className="text-brand-orange">*</span>
                    </label>
                    <textarea
                      id="productToPurchase" name="productToPurchase" required rows={4}
                      value={formData.productToPurchase} onChange={handleChange}
                      className="w-full bg-black/40 border border-gray-800 text-white px-3.5 py-3 rounded-lg text-sm placeholder-gray-600 focus:outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange/50 transition-all resize-none leading-relaxed"
                      placeholder="Tell us about the installation, vehicle setup, preferences, or anything our team should know."
                    />
                  </div>
                </section>

                {/* ── Section 04: Appointment Schedule ──────────────── */}
                <section className="space-y-5">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-brand-orange/10 border border-brand-orange/30 flex items-center justify-center text-brand-orange font-mono font-bold text-xs">
                      04
                    </span>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <FaCalendarAlt className="text-brand-orange w-3.5 h-3.5" /> Appointment Schedule
                      </h2>
                      <p className="text-xs text-gray-400">Choose your preferred date and time slot.</p>
                    </div>
                  </div>

                  {/* Date & Time Grid */}
                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch pt-2">

                    {/* Left: Custom Calendar (6 cols) */}
                    <div className="xl:col-span-6 flex flex-col bg-brand-darker/60 border border-gray-800 p-4 sm:p-5 rounded-xl min-w-0">
                      <p className="text-xs font-bold flex items-center gap-2 uppercase tracking-widest text-brand-orange mb-4">
                        <FaCalendarAlt className="w-3.5 h-3.5" /> Select a Date
                      </p>
                      <div className="flex-1">
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

                    {/* Right: Time Slots Panel (6 cols) */}
                    <div className="xl:col-span-6 flex flex-col bg-brand-darker/60 border border-gray-800 p-4 sm:p-5 rounded-xl min-w-0">

                      {/* Time Slots Header */}
                      <div className="flex items-center justify-between mb-4">
                        <label className="text-xs font-bold uppercase tracking-widest text-brand-orange flex items-center gap-2">
                          <FaClock className="w-3.5 h-3.5" /> Select a Time
                        </label>
                        {availabilityLoading && (
                          <span className="text-gray-400 text-xs flex items-center gap-1.5 font-mono">
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-orange" /> Checking slots…
                          </span>
                        )}
                      </div>

                      {/* Selected Date Summary Badge */}
                      {selectedDate && (
                        <div className="mb-4 p-2.5 rounded-lg bg-brand-orange/10 border border-brand-orange/20 flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-orange">Selected Date</span>
                          <span className="text-xs font-semibold text-white">
                            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                          </span>
                        </div>
                      )}

                      {/* Empty State: No Date Selected */}
                      {!selectedDate ? (
                        <div className="flex-1 flex flex-col items-center justify-center border border-dashed border-gray-800 rounded-lg p-8 text-center bg-black/20">
                          <FaCalendarAlt className="mb-3 text-3xl text-gray-600" />
                          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-300">Choose a Date</h3>
                          <p className="text-xs text-gray-500 mt-1 max-w-xs">
                            Select an available date on the calendar to view open appointment time slots.
                          </p>
                        </div>
                      ) : (
                        <div className="flex-1">

                          {/* Closed Day Notice */}
                          {!availabilityLoading && !shopDayIsOpen && (
                            <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-lg text-center">
                              <p className="text-xs font-semibold text-amber-400">
                                {closureReason
                                  ? `Shop closed: ${closureReason}`
                                  : 'Not accepting appointments for this date.'}
                              </p>
                            </div>
                          )}

                          {!availabilityLoading && shopDayIsOpen && (() => {
                            let openMinutes = 6 * 60;
                            if (selectedDate && shopHours.length) {
                              const day = shopHours.find(h => h.dayOfWeek === selectedDate.getDay());
                              if (day?.openTime && day.isOpen) {
                                const [oh, om] = day.openTime.split(':').map(Number);
                                openMinutes = (oh % 24) * 60 + (om || 0);
                              }
                            }

                            const [closeHStr, closeMStr] = shopCloseTime.split(':');
                            const closeHNum = Number(closeHStr || '0');
                            const closeMNum = Number(closeMStr || '0');
                            let closeMinutes = (closeHNum % 24) * 60 + closeMNum;
                            if (closeMinutes <= openMinutes) closeMinutes += 24 * 60;

                            const now = new Date();
                            const nowMinutes = now.getHours() * 60 + now.getMinutes();
                            const isTodaySelected = !!selectedDate && isSameLocalDay(selectedDate, now);
                            const visibleSlots = availableSlots.filter((time) => {
                              if (bookedSlots.includes(time)) return false;
                              let slotStart = slotToMinutes(time);
                              if (slotStart < openMinutes) slotStart += 24 * 60;
                              if (slotStart > closeMinutes) return false;
                              if (isTodaySelected && slotStart <= nowMinutes) return false;
                              return true;
                            });

                            return (
                              <>
                                <p className="text-[11px] text-gray-400 mb-3 pb-3 border-b border-gray-800">
                                  Operating hours: 6:00 AM to {formatCloseTimeString(shopCloseTime)}.
                                </p>

                                <div className="w-full">
                                  {/* No Slots Available & Waitlist Workflow */}
                                  {visibleSlots.length === 0 && (
                                    <div className="space-y-3 rounded-lg border border-brand-orange/20 bg-brand-orange/5 p-5 text-center">
                                      <FaClock className="w-6 h-6 text-brand-orange mx-auto opacity-80" />
                                      <div>
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-brand-orange">
                                          No Appointments Available
                                        </h3>
                                        <p className="text-xs text-gray-400 mt-1">
                                          {isTodaySelected
                                            ? 'No slots remaining for today.'
                                            : 'There are currently no available slots for this date.'}
                                        </p>
                                      </div>

                                      {(() => {
                                        const slotKey = `${selectedDate ? formatDateYMD(selectedDate) : ''}|all`;
                                        if (waitlistJoined === slotKey) {
                                          return (
                                            <p className="text-xs font-semibold text-green-400 flex items-center justify-center gap-1.5 pt-1">
                                              <CheckCircle className="w-3.5 h-3.5" /> You are on the waitlist!
                                            </p>
                                          );
                                        }
                                        return (
                                          <button
                                            type="button"
                                            disabled={waitlistJoining}
                                            onClick={async () => {
                                              const dateStr = selectedDate ? formatDateYMD(selectedDate) : '';
                                              setWaitlistJoining(true);
                                              try {
                                                await joinWaitlistApi({
                                                  slotDate: dateStr,
                                                  slotTime: 'any',
                                                  name: formData.fullName || user?.name || '',
                                                  email: formData.emailAddress || user?.email || '',
                                                  phone: formData.contactNumber || user?.phone || '',
                                                  serviceIds: '',
                                                }, token);
                                                setWaitlistJoined(slotKey);
                                                showToast("You've joined the waitlist!", 'success');
                                              } catch (error) {
                                                showToast(error instanceof Error ? error.message : 'Could not join waitlist.', 'error');
                                              } finally {
                                                setWaitlistJoining(false);
                                              }
                                            }}
                                            className="inline-flex items-center gap-2 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-colors disabled:opacity-50 cursor-pointer"
                                          >
                                            <FaBell className="w-3 h-3 text-brand-orange" />
                                            {waitlistJoining ? 'Joining Waitlist…' : 'Join Waitlist'}
                                          </button>
                                        );
                                      })()}
                                    </div>
                                  )}

                                  {/* Available Slots Grid */}
                                  {visibleSlots.length > 0 && (
                                    <>
                                      {visibleSlots.length > 6 && (
                                        <div className="mb-2 text-[10px] text-gray-500 font-mono flex items-center justify-between">
                                          <span>{visibleSlots.length} slots available</span>
                                          <span>Scroll for more slots ↓</span>
                                        </div>
                                      )}
                                      <div className="max-h-80 overflow-y-auto pr-1.5 scroll-smooth [scrollbar-width:thin]">
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                          {visibleSlots.map((time) => {
                                            const isSelected = selectedTime === time;
                                            const takenCount = slotCounts[time] ?? 0;
                                            const spotsLeft = slotCapacity - takenCount;
                                            const almostFull = spotsLeft === 1;

                                            return (
                                              <button
                                                key={time}
                                                type="button"
                                                onClick={() => handleTimeSelect(time)}
                                                className={`p-3 rounded-lg border text-center transition-all duration-200 flex flex-col items-center justify-center cursor-pointer focus:outline-none ${isSelected
                                                  ? 'border-brand-orange bg-brand-orange text-white shadow-lg'
                                                  : 'border-gray-800 bg-brand-dark hover:border-brand-orange/60 hover:bg-black/40 text-gray-200'
                                                  }`}
                                              >
                                                <span className="text-xs font-bold font-mono tracking-wide">{time}</span>
                                                <span className={`text-[10px] font-semibold mt-0.5 ${isSelected
                                                  ? 'text-white/90'
                                                  : almostFull
                                                    ? 'text-brand-orange'
                                                    : 'text-gray-500'
                                                  }`}>
                                                  {isSelected ? '✓ SELECTED' : almostFull ? 'LAST SPOT' : `${spotsLeft} spots left`}
                                                </span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </>
                            );
                          })()}
                        </div>
                      )}

                    </div>

                  </div>
                </section>

              </div>
            </div>

            {/* ── Right Column: Sticky Booking Summary (4 cols) ────── */}
            <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-6">
              <div className="bg-brand-dark border border-gray-800 p-5 sm:p-6 rounded-xl shadow-xl space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-brand-orange">Request Summary</span>
                    <h2 className="text-base font-bold uppercase tracking-wider text-white">Your Request</h2>
                  </div>
                  <span className="text-[10px] font-mono uppercase bg-brand-orange/15 border border-brand-orange/30 text-brand-orange px-2.5 py-1 rounded-full font-bold">
                    Live Draft
                  </span>
                </div>

                {/* Summary Rows */}
                <div className="space-y-3.5 text-xs font-mono">

                  {/* Client */}
                  <div className="bg-brand-darker/70 border border-gray-800/80 p-3 rounded-lg space-y-0.5">
                    <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold block">Client</span>
                    <span className="text-white font-sans font-semibold text-xs block">
                      {formData.fullName || <span className="text-gray-600 font-normal italic">Not provided</span>}
                    </span>
                    {formData.contactNumber && <span className="text-gray-400 text-[11px] block">{formData.contactNumber}</span>}
                  </div>

                  {/* Vehicle */}
                  <div className="bg-brand-darker/70 border border-gray-800/80 p-3 rounded-lg space-y-0.5">
                    <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold block">Vehicle</span>
                    <span className="text-white font-sans font-semibold text-xs block">
                      {formData.yearModel || formData.make || formData.model
                        ? `${formData.yearModel} ${formData.make} ${formData.model}`.trim()
                        : <span className="text-gray-600 font-normal italic">Not provided</span>}
                    </span>
                    {formData.plateNumber && <span className="text-gray-400 text-[11px] block uppercase">Plate: {formData.plateNumber}</span>}
                  </div>

                  {/* Service Delivery Type Summary */}
                  <div className="bg-brand-darker/70 border border-gray-800/80 p-3 rounded-lg space-y-0.5">
                    <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold block">Service Location</span>
                    <span className="text-white font-sans font-semibold text-xs flex items-center gap-1.5 mt-0.5">
                      {formData.serviceType === 'home_service' ? (
                        <>
                          <Home className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-amber-300">Home Service (Mobile Dispatch)</span>
                        </>
                      ) : (
                        <>
                          <Store className="w-3.5 h-3.5 text-brand-orange" />
                          <span className="text-brand-orange">Shop Visit (1625 Autolab)</span>
                        </>
                      )}
                    </span>
                    {formData.serviceType === 'home_service' && (
                      <span className="text-[10px] text-amber-400/90 block mt-1 font-sans">
                        * Note: Additional home service fee applies
                      </span>
                    )}
                  </div>

                  {/* Service */}
                  <div className="bg-brand-darker/70 border border-gray-800/80 p-3 rounded-lg space-y-0.5">
                    <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold block">Primary Service</span>
                    <span className="text-brand-orange font-sans font-semibold text-xs block leading-snug">
                      {selectedServiceObj ? selectedServiceObj.title : <span className="text-gray-600 font-normal italic">None selected</span>}
                    </span>
                  </div>

                  {/* Appointment Schedule Highlight */}
                  <div className={`p-3 rounded-lg border transition-all ${formData.appointmentDate && formData.appointmentTime
                    ? 'bg-brand-orange/10 border-brand-orange/40 ring-1 ring-brand-orange/20'
                    : 'bg-brand-darker/70 border-gray-800/80'
                    }`}>
                    <span className="text-[9px] uppercase tracking-widest text-gray-500 font-bold block">Appointment</span>
                    {formData.appointmentDate ? (
                      <span className="text-white font-sans font-semibold text-xs block">
                        {format(new Date(`${formData.appointmentDate}T00:00:00`), 'EEEE, MMM d, yyyy')}
                      </span>
                    ) : (
                      <span className="text-gray-600 font-normal italic text-xs block">Date not selected</span>
                    )}

                    {formData.appointmentTime ? (
                      <span className="text-brand-orange font-bold text-xs block mt-0.5">
                        {formData.appointmentTime}
                      </span>
                    ) : (
                      <span className="text-gray-600 font-normal italic text-[11px] block mt-0.5">Time slot not selected</span>
                    )}
                  </div>

                </div>

                {/* Security Turnstile Widget */}
                <div className="pt-2 flex justify-center">
                  <TurnstileWidget
                    onVerify={setTurnstileToken}
                    onExpire={() => setTurnstileToken('')}
                    resetKey={turnstileKey}
                  />
                </div>

                {/* Privacy Policy Consent Agreement */}
                <div className="pt-1 text-left">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={privacyAgreed}
                      onChange={(e) => setPrivacyAgreed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-gray-700 bg-brand-darker text-brand-orange focus:ring-brand-orange shrink-0 cursor-pointer"
                    />
                    <span className="text-xs text-gray-300 leading-relaxed">
                      I agree to the collection and processing of my personal data in accordance with 1625 Autolab's{' '}
                      <Link to="/privacy-policy" className="text-brand-orange underline font-semibold hover:text-orange-400" target="_blank">
                        Privacy Policy
                      </Link>{' '}
                      (Republic Act No. 10173). *
                    </span>
                  </label>
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={isSubmitting || !turnstileToken || !privacyAgreed}
                  title={
                    !turnstileToken
                      ? 'Please complete the security check above'
                      : !privacyAgreed
                        ? 'Please agree to the Privacy Policy'
                        : undefined
                  }
                  className="w-full bg-brand-orange hover:bg-orange-600 text-white py-3.5 rounded-lg font-bold uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting Request…</span>
                    </>
                  ) : (
                    <>
                      <span>Request Appointment</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <p className="text-[10px] text-gray-500 text-center flex items-center justify-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-gray-400" /> Secure 1625 Autolab Reservation
                </p>

              </div>
            </div>

          </form>
        )}

        {/* ── 16. Confirmation Success View (Step 2) ──────────────── */}
        {step === 2 && submittedData && (
          <div className="max-w-3xl mx-auto py-12 px-4 text-center space-y-8 animate-fadeIn">

            {/* Success Check Icon */}
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/10 border border-green-500/30 shadow-xl text-green-400 mb-2">
              <CheckCircle className="w-10 h-10" />
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-orange">Request Received</span>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-white uppercase tracking-tight">
                You're All Set!
              </h1>
              <p className="text-gray-300 text-sm sm:text-base max-w-xl mx-auto pt-2 leading-relaxed">
                Your appointment request has been successfully submitted. We've sent a confirmation notification to <strong className="text-white font-mono">{submittedData.emailAddress}</strong>. Our team will confirm your slot shortly.
              </p>
            </div>

            {/* Reference Number Hero Banner */}
            {submittedRef && (
              <div className="bg-gradient-to-r from-brand-darker via-brand-dark to-brand-darker border-2 border-brand-orange/40 rounded-xl p-6 text-center space-y-3 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 px-3 py-1 bg-brand-orange text-black font-mono font-extrabold text-[10px] uppercase rounded-bl-lg">
                  Official Reference
                </div>
                <p className="text-xs uppercase tracking-widest text-gray-400 font-bold">Inquiry Reference Number</p>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-2xl sm:text-3xl md:text-4xl font-mono font-extrabold text-brand-orange tracking-widest">
                    {submittedRef}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(submittedRef);
                      showToast('Reference Number copied to clipboard!', 'success');
                    }}
                    className="p-2.5 bg-brand-dark hover:bg-gray-800 border border-brand-orange/40 hover:border-brand-orange text-white rounded-lg transition-colors cursor-pointer"
                    title="Copy Reference Number"
                  >
                    <Copy className="w-4 h-4 text-brand-orange" />
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 max-w-md mx-auto">
                  Please save this reference number (<strong className="text-white font-mono">{submittedRef}</strong>) to track or reference your inquiry with 1625 Autolab support.
                </p>
              </div>
            )}

            {/* Appointment Summary Card */}
            <div className="bg-brand-dark border border-gray-800 rounded-xl p-6 sm:p-8 text-left space-y-6 shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-800 pb-4">
                <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-white flex items-center gap-2">
                  <FaCalendarAlt className="text-brand-orange" /> Appointment Summary
                </h2>
                {(submittedRef || submittedId) && (
                  <span className="text-[10px] font-mono uppercase bg-brand-darker border border-gray-800 text-brand-orange px-2.5 py-1 rounded font-bold">
                    REF: {submittedRef || submittedId}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                <div className="bg-brand-darker/60 p-3.5 rounded-lg border border-gray-800/80">
                  <span className="block text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-1">Client Name</span>
                  <span className="text-white font-sans font-semibold text-sm">{submittedData.fullName}</span>
                </div>

                <div className="bg-brand-darker/60 p-3.5 rounded-lg border border-gray-800/80">
                  <span className="block text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-1">Vehicle</span>
                  <span className="text-white font-sans font-semibold text-sm">
                    {submittedData.yearModel} {submittedData.make} {submittedData.model}
                  </span>
                </div>

                <div className="bg-brand-darker/60 p-3.5 rounded-lg border border-gray-800/80">
                  <span className="block text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-1">Service Location</span>
                  <span className="text-white font-sans font-semibold text-sm flex items-center gap-1.5">
                    {submittedData.serviceType === 'home_service' ? '🏠 Home Service' : '🏬 Shop Visit'}
                  </span>
                  {submittedData.serviceType === 'home_service' && (
                    <span className="text-[10px] text-amber-400 font-sans block mt-1">
                      * Home service fee applies (to be confirmed upon dispatch)
                    </span>
                  )}
                </div>

                <div className="bg-brand-darker/60 p-3.5 rounded-lg border border-gray-800/80">
                  <span className="block text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-1">Requested Date</span>
                  <span className="text-white font-sans font-semibold text-sm">
                    {submittedData.appointmentDate ? format(new Date(`${submittedData.appointmentDate}T00:00:00`), 'MMM d, yyyy') : 'N/A'}
                  </span>
                </div>

                <div className="bg-brand-darker/60 p-3.5 rounded-lg border border-gray-800/80">
                  <span className="block text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-1">Requested Time</span>
                  <span className="text-brand-orange font-sans font-bold text-sm">{submittedData.appointmentTime || 'N/A'}</span>
                </div>

                <div className="sm:col-span-2 bg-brand-darker/60 p-3.5 rounded-lg border border-gray-800/80">
                  <span className="block text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-1">Request Notes</span>
                  <span className="text-gray-300 font-sans text-xs">{submittedData.productToPurchase || 'None provided'}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              {user ? (
                <Link
                  to="/client/inquiries"
                  className="w-full sm:w-auto bg-brand-orange text-white px-8 py-3.5 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 rounded-lg text-xs shadow-lg"
                >
                  View My Inquiries
                </Link>
              ) : (
                <Link
                  to="/"
                  className="w-full sm:w-auto bg-brand-orange text-white px-8 py-3.5 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 rounded-lg text-xs shadow-lg"
                >
                  Return to Home
                </Link>
              )}

              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full sm:w-auto bg-brand-dark border border-gray-700 text-white px-8 py-3.5 font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 rounded-lg text-xs cursor-pointer"
              >
                Submit Another Request
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}