import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import PageSEO from '../components/PageSEO';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { BACKEND_URL } from '../config';
import { fetchInquiryAvailabilityApi, fetchShopClosedDatesApi, fetchShopHoursApi, joinWaitlistApi } from '../services/api';
import type { ShopDayHours } from '../types';
import CustomCalendar from '../components/CustomCalendar';
import TurnstileWidget from '../components/TurnstileWidget';
import Select from 'react-select';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../store';
import { fetchProductsAsync } from '../store/productsSlice';

// Icons
import { 
  FaUser, 
  FaMapMarkerAlt, 
  FaPhone, 
  FaEnvelope, 
  FaFacebook, 
  FaCar, 
  FaCalendarAlt, 
  FaClock, 
  FaWrench,
  FaIdBadge,
  FaBell
} from 'react-icons/fa';
import { Loader2, ArrowRight, CheckCircle } from 'lucide-react';

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

function buildDateList(shopHours: ShopDayHours[], closedDatesSet: Set<string>): Date[] {
  const openDays = shopHours.length
    ? new Set(shopHours.filter((hour) => hour.isOpen).map((hour) => hour.dayOfWeek))
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
  appointmentDate: '', // Will store as YYYY-MM-DD
  appointmentTime: '', // Will store as h:mm aa (e.g. 2:30 PM)
  productToPurchase: '',
  productId: '',
  additionalInfo: ''
};

const inputClass = "w-full bg-black/20 border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange transition-all rounded-sm text-sm";

export default function CustomerFormPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [step, setStep] = useState(1);
  const [submittedData, setSubmittedData] = useState<typeof formData | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
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
  const [turnstileKey,   setTurnstileKey]   = useState(0);
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch<AppDispatch>();
  const { items: products, status: productsStatus } = useSelector((s: RootState) => s.products);

  useEffect(() => {
    if (productsStatus === 'idle') {
      dispatch(fetchProductsAsync(null));
    }
  }, [productsStatus, dispatch]);

  const activeProducts = products.filter(p => p.isActive);
  const productOptions = activeProducts.map(p => {
    const isOutOfStock = p.trackStock && (p.stockQty ?? 0) <= 0;
    return {
      value: String(p.id),
      label: isOutOfStock ? `${p.name} (Out of Stock)` : p.name,
      isDisabled: isOutOfStock
    };
  });

  const availableDates = buildDateList(shopHoursLoaded ? shopHours : [], closedDatesSet);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

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

    Promise.all([fetchShopHoursApi(), fetchShopClosedDatesApi()])
      .then(([{ hours }, closedDatesData]) => {
        setShopHours(hours);
        const dates = (closedDatesData as { closedDates: { date: string }[] }).closedDates ?? [];
        setClosedDatesSet(new Set(dates.map((date) => date.date)));
      })
      .catch(() => {})
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

    if (!formData.appointmentDate || !formData.appointmentTime) {
      showToast('Please choose a date and time for your appointment.', 'error');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Fire Google Sheets Webhook (Isolated so a failure here doesn't block the DB)
      try {
        const scriptURL = 'https://script.google.com/macros/s/AKfycbxm860_AqLacRru8vXJ0NDfjl7gZgYcEB9rjqYXrvPEMph31vQ8kZQIHgbfeYWLHiTONw/exec';
        const googleData = new URLSearchParams({
          'Timestamp': new Date().toLocaleString(),
          'Full Name': formData.fullName,
          'Address': formData.address,
          'Contact Number': formData.contactNumber,
          'Email address': formData.emailAddress,
          'Facebook Name': formData.facebookName,
          'Plate Number': formData.plateNumber,
          'Car Make': formData.make,
          'Car Model': formData.model,
          'Year Model': formData.yearModel,
          'Appointment Date': formData.appointmentDate,
          'Appointment Time': formData.appointmentTime,
          'Product to Purchase': formData.productToPurchase || formData.productId,
          'Additional Info': formData.additionalInfo
        });

        await fetch(scriptURL, { method: 'POST', body: googleData, mode: 'no-cors' });
      } catch (googleErr) {
        console.warn('Google Sheets sync failed, but proceeding with API.', googleErr);
      }

      // 2. Main Backend API Push
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      // Include auth token when available so the backend links the inquiry
      // directly to the logged-in user's account on creation.
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(`${BACKEND_URL}/api/inquiries`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...formData, 'cf-turnstile-response': turnstileToken }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.detail ?? 'Unable to submit inquiry to the database.');
      }

      showToast('Form submitted successfully! A confirmation notification and a 3-hour prior appointment reminder have been scheduled.', 'success');
      
      setSubmittedData({ ...formData });
      setSubmittedId(result?.inquiry?.id ?? null);
      
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

  return (
    <div className="pt-32 pb-24 min-h-screen bg-brand-darker">
      <PageSEO
        title="1625 Autolab Schedule Request"
        description="Fill out this form to order products or schedule a service with 1625 Autolab."
        image="https://cdn.1625autolab.com/1625autolab/logos/order.png"
        appendSiteName={true}
      />

      <div className="container mx-auto px-4 md:px-6 max-w-7xl">
        {step === 1 && (
          <div className="text-center mb-12">
            <span className="text-brand-orange font-bold uppercase tracking-widest text-sm block mb-3">Service Request</span>
            <h1 className="text-4xl md:text-5xl font-display font-black text-white uppercase tracking-tighter mb-4">
              Request <span className="text-brand-orange">Schedule</span>
            </h1>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Lock in your spot on the floor. Drop your details below and our team will confirm your schedule.
            </p>
          </div>
        )}

        {step === 1 && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column (8 columns) */}
          <div className="lg:col-span-8 space-y-8">
            <div className="bg-brand-dark border border-gray-800 p-6 md:p-8 rounded-sm shadow-2xl space-y-10">
              
              {/* Personal Information */}
              <div className="space-y-6">
                <h3 className="text-xl font-display font-bold uppercase tracking-widest text-white mb-2 flex items-center gap-2 border-b border-gray-800 pb-4">
                  <span className="w-8 h-8 rounded-full bg-brand-orange/10 flex items-center justify-center text-brand-orange text-sm"><FaUser /></span>
                  Client Details
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label htmlFor="fullName" className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                      <FaUser className="text-gray-500"/> Full Name *
                    </label>
                    <input
                      type="text" id="fullName" name="fullName" required
                      value={formData.fullName} onChange={handleChange}
                      className={inputClass}
                      placeholder="Juan Dela Cruz"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="contactNumber" className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                      <FaPhone className="text-gray-500"/> Contact Number *
                    </label>
                    <input
                      type="tel" id="contactNumber" name="contactNumber" required
                      value={formData.contactNumber} onChange={handleChange}
                      className={inputClass}
                      placeholder="0912 345 6789"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="address" className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <FaMapMarkerAlt className="text-gray-500"/> Complete Address *
                  </label>
                  <input
                    type="text" id="address" name="address" required
                    value={formData.address} onChange={handleChange}
                    className={inputClass}
                    placeholder="Block, Lot, Street, City"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label htmlFor="emailAddress" className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                      <FaEnvelope className="text-gray-500"/> Email Address *
                    </label>
                    <input
                      type="email" id="emailAddress" name="emailAddress" required
                      value={formData.emailAddress} onChange={handleChange}
                      className={inputClass}
                      placeholder="juan@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="facebookName" className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                      <FaFacebook className="text-gray-500"/> Facebook Profile *
                    </label>
                    <input
                      type="text" id="facebookName" name="facebookName" required
                      value={formData.facebookName} onChange={handleChange}
                      className={inputClass}
                      placeholder="Profile Name or URL link"
                    />
                  </div>
                </div>
              </div>

              {/* Vehicle Information */}
              <div className="space-y-6">
                <h3 className="text-xl font-display font-bold uppercase tracking-widest text-white mb-2 flex items-center gap-2 border-b border-gray-800 pb-4">
                  <span className="w-8 h-8 rounded-full bg-brand-orange/10 flex items-center justify-center text-brand-orange text-sm"><FaCar /></span>
                  Vehicle Specs
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label htmlFor="plateNumber" className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                      <FaIdBadge className="text-gray-500"/> Plate Number
                    </label>
                    <input
                      type="text" id="plateNumber" name="plateNumber"
                      value={formData.plateNumber} onChange={handleChange}
                      className={inputClass}
                      placeholder="ABC-1234"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="yearModel" className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                      Year *
                    </label>
                    <select
                      id="yearModel" name="yearModel" required
                      value={formData.yearModel} onChange={handleChange}
                      className={`${inputClass} appearance-none cursor-pointer`}
                    >
                      <option value="" disabled>Select Year</option>
                      {YEARS.map(year => (
                        <option key={year} value={year}>{year}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="make" className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">Make *</label>
                    <input
                      type="text" id="make" name="make" required
                      value={formData.make} onChange={handleChange}
                      className={inputClass}
                      placeholder="e.g. Honda"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="model" className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">Model *</label>
                    <input
                      type="text" id="model" name="model" required
                      value={formData.model} onChange={handleChange}
                      className={inputClass}
                      placeholder="e.g. Civic RS"
                    />
                  </div>
                </div>
              </div>

              {/* Appointment Details */}
              <div className="space-y-6">
                <h3 className="text-xl font-display font-bold uppercase tracking-widest text-white mb-2 flex items-center gap-2 border-b border-gray-800 pb-4">
                  <span className="w-8 h-8 rounded-full bg-brand-orange/10 flex items-center justify-center text-brand-orange text-sm"><FaCalendarAlt /></span>
                  Scheduling & Request
                </h3>

                <div className="space-y-2">
                  <label htmlFor="productId" className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <FaWrench className="text-gray-500"/> Required Services or Products *
                  </label>
                  {/* @ts-ignore - React-Select types can be problematic without explicit prop interfaces */}
                  <Select
                    id="productId"
                    name="productId"
                    options={productOptions}
                    placeholder="Search and select..."
                    isClearable
                    value={productOptions.find(o => o.value === formData.productId) || null}
                    onChange={(selected: any) => {
                      setFormData(prev => ({
                        ...prev,
                        productId: selected?.value || '',
                        productToPurchase: selected?.label || ''
                      }));
                    }}
                    styles={{
                      control: (base: any, state: any) => ({
                        ...base,
                        background: 'rgba(0,0,0,0.2)',
                        borderColor: state.isFocused ? '#f97316' : '#374151',
                        borderRadius: '0.125rem',
                        minHeight: '46px',
                        boxShadow: state.isFocused ? '0 0 0 1px #f97316' : 'none',
                        '&:hover': {
                          borderColor: '#f97316'
                        }
                      }),
                      menu: (base: any) => ({
                        ...base,
                        background: '#111827',
                        border: '1px solid #374151',
                      }),
                      option: (base: any, state: any) => ({
                        ...base,
                        background: state.isSelected ? '#f97316' : state.isFocused ? 'rgba(255,255,255,0.05)' : 'transparent',
                        color: state.isSelected ? '#fff' : '#d1d5db',
                        cursor: 'pointer',
                        '&:active': {
                          background: '#ea580c'
                        }
                      }),
                      singleValue: (base: any) => ({
                        ...base,
                        color: '#fff',
                        fontSize: '0.875rem'
                      }),
                      input: (base: any) => ({
                        ...base,
                        color: '#fff',
                        fontSize: '0.875rem'
                      }),
                      placeholder: (base: any) => ({
                        ...base,
                        color: '#9ca3af',
                        fontSize: '0.875rem'
                      })
                    }}
                  />
                </div>

                <div className="space-y-2 mt-4">
                  <label htmlFor="additionalInfo" className="text-xs font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    Additional Information
                  </label>
                  <textarea
                    id="additionalInfo" name="additionalInfo" rows={3}
                    value={formData.additionalInfo} onChange={handleChange}
                    className={`${inputClass} resize-none`}
                    placeholder="Tell us what needs doing or any extra requests..."
                  />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-stretch pt-2">
                  <div className="xl:col-span-7 h-full flex flex-col bg-black/20 border border-gray-800 p-4 md:p-6 rounded-sm">
                    <p className="text-xs font-bold flex items-center gap-2 uppercase tracking-widest text-brand-orange mb-6">
                      <FaCalendarAlt className="w-4 h-4" /> Available Dates
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

                  <div className="xl:col-span-5 h-full flex flex-col bg-black/20 border border-gray-800 p-4 md:p-6 rounded-sm">
                    <div className="flex items-center justify-between mb-6">
                      <label className="text-xs font-bold uppercase tracking-widest text-brand-orange flex items-center gap-2">
                        <FaClock className="w-4 h-4" /> Appointment Time *
                      </label>
                      {availabilityLoading && (
                        <span className="text-gray-500 text-xs flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin" /> Checking…
                        </span>
                      )}
                    </div>

                    {!selectedDate ? (
                      <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-800 rounded-sm p-8 text-center bg-black/10">
                        <FaCalendarAlt className="mb-3 text-4xl text-gray-700" />
                        <p className="text-gray-500 text-sm">Select a date to view available time slots.</p>
                      </div>
                    ) : (
                      <div className="flex-1">
                        {!availabilityLoading && !shopDayIsOpen && (
                          <div className="bg-amber-500/10 border border-amber-500/20 px-4 py-3 rounded-sm text-center">
                            <p className="text-sm text-amber-300">
                              {closureReason
                                ? `Currently not accepting appointments – ${closureReason}.`
                                : 'Currently not accepting appointments for this date.'}
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
                              <p className="text-xs text-gray-500 mb-4 pb-4 border-b border-gray-800">
                                {shopDayIsOpen
                                  ? `Accepting appointments from 6:00 AM to ${formatCloseTimeString(shopCloseTime)}.`
                                  : 'Not accepting appointments for this date.'}
                              </p>
                              <div className="w-full">
                                {visibleSlots.length === 0 && !isTodaySelected && (
                                  <div className="space-y-3 rounded-sm border border-brand-orange/10 bg-brand-orange/5 px-4 py-6 text-center">
                                    <p className="text-sm text-brand-orange/80">No available slots for this date.</p>
                                    {(() => {
                                      const slotKey = `${selectedDate ? formatDateYMD(selectedDate) : ''}|all`;
                                      if (waitlistJoined === slotKey) {
                                        return <p className="text-xs font-semibold text-green-400">✓ On waitlist.</p>;
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
                                          className="inline-flex items-center gap-2 rounded-sm bg-brand-orange px-4 py-2 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
                                        >
                                          <FaBell className="w-3.5 h-3.5" />
                                          {waitlistJoining ? 'Joining…' : 'Join Waitlist'}
                                        </button>
                                      );
                                    })()}
                                  </div>
                                )}
                                {visibleSlots.length === 0 && isTodaySelected && (
                                  <p className="rounded-sm border border-brand-orange/10 bg-brand-orange/5 px-4 py-6 text-center text-sm text-brand-orange/80">
                                    No slots left for today.
                                  </p>
                                )}
                                {visibleSlots.length > 0 && (
                                  <>
                                    <div className="mb-2 flex items-center gap-2 rounded-sm border border-gray-800 bg-gray-900/70 px-3 py-2 text-xs text-gray-400 xl:hidden">
                                      <span className="font-semibold text-brand-orange">Scroll</span> to see more available times.
                                    </div>
                                    <div className="max-h-72 overflow-y-auto pr-2 scroll-smooth [scrollbar-width:thin] [scrollbar-color:rgba(249,115,22,0.7)_rgba(17,24,39,0.8)] [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-800/80 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gradient-to-b [&::-webkit-scrollbar-thumb]:from-orange-500/80 [&::-webkit-scrollbar-thumb]:to-amber-500/70 hover:[&::-webkit-scrollbar-thumb]:from-orange-400 hover:[&::-webkit-scrollbar-thumb]:to-amber-400">
                                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-2 gap-3">
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
                                              className={`flex min-h-[84px] w-full flex-col items-center justify-center rounded-sm border p-3 text-center transition-all duration-200 focus:outline-none ${
                                                isSelected
                                                  ? 'border-brand-orange bg-brand-orange text-white shadow-[0_0_10px_rgba(255,102,0,0.3)]'
                                                  : 'border-gray-700 bg-black/20 text-gray-300 hover:border-brand-orange/70 hover:bg-black/40 hover:text-white'
                                              }`}
                                            >
                                              <span className="text-sm font-bold tracking-wide">{time}</span>
                                              {spotsLeft > 0 && (
                                                <span className={`mt-1 text-[10px] font-semibold ${isSelected ? 'text-white' : almostFull ? 'text-brand-orange' : 'text-gray-500'}`}>
                                                  {almostFull ? 'Last spot!' : `${spotsLeft} spots left`}
                                                </span>
                                              )}
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
              </div>

            </div>
          </div>

          {/* Right Column (4 columns) - Inquiry Summary */}
          <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-6">
            <div className="bg-brand-dark border border-brand-orange/30 p-6 md:p-8 rounded-sm shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-orange/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
              
              <h3 className="text-lg font-display font-bold uppercase tracking-widest text-white mb-6 flex items-center gap-2 border-b border-gray-800 pb-4">
                Inquiry Summary
              </h3>

              <div className="space-y-4 mb-8">
                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-widest text-gray-500 font-bold">Client</span>
                  <span className="text-white text-sm font-medium">{formData.fullName || <span className="text-gray-600 italic">Not provided</span>}</span>
                  {formData.contactNumber && <span className="text-gray-400 text-xs">{formData.contactNumber}</span>}
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-widest text-gray-500 font-bold">Vehicle</span>
                  <span className="text-white text-sm font-medium">
                    {formData.yearModel || formData.make || formData.model 
                      ? `${formData.yearModel} ${formData.make} ${formData.model}`.trim()
                      : <span className="text-gray-600 italic">Not provided</span>}
                  </span>
                  {formData.plateNumber && <span className="text-gray-400 text-xs uppercase">{formData.plateNumber}</span>}
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-widest text-gray-500 font-bold">Services Requested</span>
                  <span className="text-white text-sm font-medium">
                    {formData.productToPurchase || <span className="text-gray-600 italic">Not provided</span>}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs uppercase tracking-widest text-gray-500 font-bold">Schedule</span>
                  <span className="text-white text-sm font-medium">
                    {formData.appointmentDate 
                      ? format(new Date(`${formData.appointmentDate}T00:00:00`), 'EEE, MMM d, yyyy') 
                      : <span className="text-gray-600 italic">Date not selected</span>}
                  </span>
                  <span className="text-brand-orange text-sm font-bold">
                    {formData.appointmentTime || <span className="text-gray-600 font-medium italic">Time not selected</span>}
                  </span>
                </div>
              </div>

              <div className="mb-6 flex justify-center relative z-10">
                <TurnstileWidget
                  onVerify={setTurnstileToken}
                  onExpire={() => setTurnstileToken('')}
                  resetKey={turnstileKey}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !turnstileToken}
                title={!turnstileToken ? 'Please complete the CAPTCHA' : undefined}
                className="w-full relative z-10 bg-brand-orange text-white px-8 py-4 font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-orange-600 transition-colors flex items-center justify-center gap-3 rounded-sm shadow-[0_0_15px_rgba(255,102,0,0.2)] hover:shadow-[0_0_20px_rgba(255,102,0,0.4)]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    Submit Inquiry <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
        )}

        {step === 2 && submittedData && (
          <div className="text-center py-16 animate-in zoom-in-95 duration-500">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-brand-orange/10 mb-8 shadow-[0_0_30px_rgba(255,102,0,0.2)]">
              <CheckCircle className="w-12 h-12 text-brand-orange" />
            </div>
            
            <h2 className="text-3xl md:text-5xl font-display font-black text-white uppercase tracking-tight mb-4">
              You're All Set!
            </h2>
            
            <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-12">
              Your inquiry has been successfully submitted. We've sent a confirmation to <strong className="text-white">{submittedData.emailAddress}</strong>. Our team will review your request and confirm your schedule shortly.
            </p>

            <div className="bg-brand-dark/50 border border-gray-800 rounded-sm p-6 md:p-8 max-w-2xl mx-auto mb-12 text-left space-y-4">
              <h3 className="text-xl font-display font-bold uppercase tracking-widest text-white mb-6 border-b border-gray-800 pb-4">
                Inquiry Details
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="block text-xs uppercase tracking-widest text-gray-500 font-bold mb-1">Name</span>
                  <span className="text-white">{submittedData.fullName}</span>
                </div>
                <div>
                  <span className="block text-xs uppercase tracking-widest text-gray-500 font-bold mb-1">Vehicle</span>
                  <span className="text-white">{submittedData.yearModel} {submittedData.make} {submittedData.model}</span>
                </div>
                <div>
                  <span className="block text-xs uppercase tracking-widest text-gray-500 font-bold mb-1">Schedule</span>
                  <span className="text-white">
                    {submittedData.appointmentDate ? format(new Date(`${submittedData.appointmentDate}T00:00:00`), 'MMM d, yyyy') : 'N/A'} at {submittedData.appointmentTime || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="block text-xs uppercase tracking-widest text-gray-500 font-bold mb-1">Service Requested</span>
                  <span className="text-white">{submittedData.productToPurchase}</span>
                </div>
                {submittedId && (
                  <div className="col-span-2 pt-2 border-t border-gray-800/60">
                    <span className="block text-xs uppercase tracking-widest text-gray-500 font-bold mb-1">Reference ID</span>
                    <span className="text-gray-400 font-mono text-xs">{submittedId}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Guest: explain email-match linking before CTA */}
            {!user && (
              <div className="max-w-2xl mx-auto mb-8 rounded-xl border border-brand-orange/30 bg-brand-orange/5 px-6 py-5 text-left">
                <p className="text-xs font-bold uppercase tracking-widest text-brand-orange mb-2">💡 Track your inquiry</p>
                <p className="text-sm text-gray-300 leading-relaxed">
                  Create a free account using <strong className="text-white">{submittedData.emailAddress}</strong> — the same email you used for this inquiry — and it will <strong className="text-white">automatically appear on your dashboard</strong> so you can follow the status in real time.
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {user ? (
                <Link
                  to="/client/inquiries"
                  className="w-full sm:w-auto bg-brand-orange text-white px-8 py-4 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 rounded-sm shadow-[0_0_15px_rgba(255,102,0,0.2)] hover:shadow-[0_0_20px_rgba(255,102,0,0.4)]"
                >
                  View My Inquiries
                </Link>
              ) : (
                <Link
                  to={`/register?redirect=/client/inquiries&source=inquiry&name=${encodeURIComponent(submittedData.fullName)}&email=${encodeURIComponent(submittedData.emailAddress)}`}
                  className="w-full sm:w-auto bg-brand-orange text-white px-8 py-4 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 rounded-sm shadow-[0_0_15px_rgba(255,102,0,0.2)] hover:shadow-[0_0_20px_rgba(255,102,0,0.4)]"
                >
                  Create Account to Track Inquiry
                </Link>
              )}

              <button
                onClick={() => setStep(1)}
                className="w-full sm:w-auto bg-transparent border-2 border-gray-700 text-white px-8 py-4 font-bold uppercase tracking-widest hover:border-gray-500 hover:bg-gray-800/50 transition-all flex items-center justify-center gap-2 rounded-sm"
              >
                Submit Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}