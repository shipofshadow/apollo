import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import PageSEO from '../components/PageSEO';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { BACKEND_URL } from '../config';
import { fetchInquiryAvailabilityApi, fetchShopClosedDatesApi, fetchShopHoursApi, joinWaitlistApi } from '../services/api';
import type { ShopDayHours } from '../types';
import CustomCalendar from '../components/CustomCalendar';

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
  FaPaperPlane,
  FaIdBadge,
  FaBell
} from 'react-icons/fa';
import { Loader2 } from 'lucide-react';

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
  productToPurchase: ''
};

export default function CustomerFormPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
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
  const [searchParams] = useSearchParams();

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
        const scriptURL = 'https://script.google.com/macros/s/AKfycbw4NEjTuEpdTxsZ5DrYuw0L4x7r91ToXcfeQoYbF2mmoUPjrhQsfMaPEL3rKaF4WfUP_A/exec';
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
          'Product to Purchase': formData.productToPurchase
        });

        await fetch(scriptURL, { method: 'POST', body: googleData, mode: 'no-cors' });
      } catch (googleErr) {
        console.warn('Google Sheets sync failed, but proceeding with API.', googleErr);
      }

      // 2. Main Backend API Push
      const response = await fetch(`${BACKEND_URL}/api/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.detail ?? 'Unable to submit inquiry to the database.');
      }

      showToast('Form submitted successfully! We will contact you soon.', 'success');
      setFormData(INITIAL_FORM_STATE);

    } catch (error) {
      console.error('Error submitting form:', error);
      showToast(error instanceof Error ? error.message : 'An error occurred. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <PageSEO
        title="1625 Autolab Schedule Request"
        description="Fill out this form to order products or schedule a service with 1625 Autolab."
        image="https://cdn.1625autolab.com/1625autolab/logos/order.png"
        appendSiteName={true}
      />

      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-white mb-4">
            Service <span className="text-brand-orange">Request</span>
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto font-medium">
            Lock in your spot on the floor. Drop your details below and our team will confirm your schedule.
          </p>
        </div>

        <div className="bg-gray-900/80 border border-gray-800 rounded-2xl shadow-2xl p-6 md:p-10 relative overflow-hidden backdrop-blur-sm">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-orange/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-sky-500/5 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

          <form onSubmit={handleSubmit} className="relative z-10 space-y-8">

            {/* Personal Information */}
            <div className="space-y-5">
              <h3 className="text-lg font-black uppercase tracking-widest text-brand-orange border-b border-gray-800/80 pb-2">Client Details</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label htmlFor="fullName" className="flex items-center gap-2 text-sm font-bold text-gray-400">
                    <FaUser /> Full Name *
                  </label>
                  <input
                    type="text" id="fullName" name="fullName" required
                    value={formData.fullName} onChange={handleChange}
                    className="w-full bg-gray-950/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-brand-orange focus:border-brand-orange transition-all placeholder-gray-600 outline-none"
                    placeholder="Juan Dela Cruz"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="contactNumber" className="flex items-center gap-2 text-sm font-bold text-gray-400">
                    <FaPhone /> Contact Number *
                  </label>
                  <input
                    type="tel" id="contactNumber" name="contactNumber" required
                    value={formData.contactNumber} onChange={handleChange}
                    className="w-full bg-gray-950/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-brand-orange focus:border-brand-orange transition-all placeholder-gray-600 outline-none"
                    placeholder="0912 345 6789"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="address" className="flex items-center gap-2 text-sm font-bold text-gray-400">
                  <FaMapMarkerAlt /> Complete Address *
                </label>
                <input
                  type="text" id="address" name="address" required
                  value={formData.address} onChange={handleChange}
                  className="w-full bg-gray-950/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-brand-orange focus:border-brand-orange transition-all placeholder-gray-600 outline-none"
                  placeholder="Block, Lot, Street, City"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label htmlFor="emailAddress" className="flex items-center gap-2 text-sm font-bold text-gray-400">
                    <FaEnvelope /> Email Address *
                  </label>
                  <input
                    type="email" id="emailAddress" name="emailAddress" required
                    value={formData.emailAddress} onChange={handleChange}
                    className="w-full bg-gray-950/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-brand-orange focus:border-brand-orange transition-all placeholder-gray-600 outline-none"
                    placeholder="juan@example.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="plateNumber" className="flex items-center gap-2 text-sm font-bold text-gray-400">
                    <FaIdBadge /> Plate Number
                  </label>
                  <input
                    type="text" id="plateNumber" name="plateNumber"
                    value={formData.plateNumber} onChange={handleChange}
                    className="w-full bg-gray-950/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-brand-orange focus:border-brand-orange transition-all placeholder-gray-600 outline-none"
                    placeholder="ABC-1234"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="facebookName" className="flex items-center gap-2 text-sm font-bold text-gray-400">
                    <FaFacebook /> Facebook Profile *
                  </label>
                  <input
                    type="text" id="facebookName" name="facebookName" required
                    value={formData.facebookName} onChange={handleChange}
                    className="w-full bg-gray-950/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-brand-orange focus:border-brand-orange transition-all placeholder-gray-600 outline-none"
                    placeholder="Profile Name or URL link"
                  />
                </div>
              </div>
            </div>

            {/* Vehicle Information */}
            <div className="space-y-5 pt-2">
              <h3 className="text-lg font-black uppercase tracking-widest text-brand-orange border-b border-gray-800/80 pb-2 flex items-center gap-2">
                <FaCar /> Vehicle Specs
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <label htmlFor="make" className="block text-sm font-bold text-gray-400">Make *</label>
                  <input
                    type="text" id="make" name="make" required
                    value={formData.make} onChange={handleChange}
                    className="w-full bg-gray-950/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-brand-orange focus:border-brand-orange transition-all placeholder-gray-600 outline-none"
                    placeholder="e.g. Honda"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="model" className="block text-sm font-bold text-gray-400">Model *</label>
                  <input
                    type="text" id="model" name="model" required
                    value={formData.model} onChange={handleChange}
                    className="w-full bg-gray-950/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-brand-orange focus:border-brand-orange transition-all placeholder-gray-600 outline-none"
                    placeholder="e.g. Civic RS"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="yearModel" className="block text-sm font-bold text-gray-400">Year *</label>
                  <select
                    id="yearModel" name="yearModel" required
                    value={formData.yearModel} onChange={handleChange}
                    className="w-full bg-gray-950/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-brand-orange focus:border-brand-orange transition-all appearance-none cursor-pointer outline-none"
                  >
                    <option value="" disabled>Select Year</option>
                    {YEARS.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Appointment Details */}
            <div className="space-y-5 pt-2">
              <h3 className="text-lg font-black uppercase tracking-widest text-brand-orange border-b border-gray-800/80 pb-2">Scheduling & Request</h3>

              <div className="space-y-4">
                <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-4 text-sm text-gray-400">
                  <p className="font-semibold text-gray-300">
                    Selected appointment: {formData.appointmentDate ? format(new Date(`${formData.appointmentDate}T00:00:00`), 'EEE, MMM d, yyyy') : 'Choose a date'}
                    {formData.appointmentTime ? ` at ${formData.appointmentTime}` : ''}
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 lg:items-stretch">
                  <div className="lg:col-span-7 self-stretch">
                    <div className="h-full flex flex-col rounded-xl border border-gray-800 bg-black/20 p-4 md:p-6">
                      <p className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-orange">
                        <FaCalendarAlt /> Available Dates
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
                  </div>

                  <div className="lg:col-span-5">
                    <div className="flex h-full flex-col rounded-xl border border-gray-800 bg-black/20 p-4 md:p-6">
                      <div className="mb-4 flex items-center justify-between">
                        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-brand-orange">
                          <FaClock /> Appointment Time *
                        </label>
                        {availabilityLoading && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Loader2 className="h-3 w-3 animate-spin" /> Checking…
                          </span>
                        )}
                      </div>

                      {!selectedDate ? (
                        <div className="flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-800 bg-black/10 p-8 text-center">
                          <FaCalendarAlt className="mb-3 text-4xl text-gray-700" />
                          <p className="text-sm text-gray-500">Select a date from the calendar to view the available time slots.</p>
                        </div>
                      ) : (
                        <div className="flex-1">
                          {!availabilityLoading && !shopDayIsOpen && (
                            <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-300">
                              {closureReason
                                ? `Currently not accepting appointments – ${closureReason}.`
                                : 'Currently not accepting appointments for this date.'}
                            </div>
                          )}

                          {!availabilityLoading && shopDayIsOpen && (() => {
                            // determine shop open minutes for the selectedDate (fallback to 6:00 AM)
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
                                <p className="mb-4 border-b border-gray-800 pb-4 text-xs text-gray-500">
                                  {shopDayIsOpen
                                    ? `We are currently accepting appointments from 6:00 AM to ${formatCloseTimeString(shopCloseTime)}.`
                                    : 'We are currently not accepting appointments for this date.'}
                                </p>
                                <div className="w-full">
                                  {visibleSlots.length === 0 && !isTodaySelected && (
                                    <div className="space-y-3 rounded-lg border border-brand-orange/10 bg-brand-orange/5 px-4 py-6 text-center">
                                      <p className="text-sm text-brand-orange/80">No available slots for this date.</p>
                                      {(() => {
                                        const slotKey = `${selectedDate ? formatDateYMD(selectedDate) : ''}|all`;
                                        if (waitlistJoined === slotKey) {
                                          return <p className="text-xs font-semibold text-green-400">✓ You&apos;re on the waitlist. We&apos;ll notify you if a slot opens.</p>;
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
                                            <FaBell className="h-3.5 w-3.5" />
                                            {waitlistJoining ? 'Joining…' : 'Join Waitlist'}
                                          </button>
                                        );
                                      })()}
                                    </div>
                                  )}
                                  {visibleSlots.length === 0 && isTodaySelected && (
                                    <p className="rounded-lg border border-brand-orange/10 bg-brand-orange/5 px-4 py-6 text-center text-sm text-brand-orange/80">
                                      No available slots left for today.
                                    </p>
                                  )}
                                  {visibleSlots.length > 0 && (
                                    <>
                                      <div className="mb-2 flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-950/70 px-3 py-2 text-xs text-gray-400 sm:hidden">
                                        <span className="font-semibold text-brand-orange">Scroll</span> to see more appointment times.
                                      </div>
                                      <div className="mt-2 max-h-72 overflow-y-auto pr-2 scroll-smooth [scrollbar-width:thin] [scrollbar-color:rgba(249,115,22,0.7)_rgba(17,24,39,0.8)] [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-800/80 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gradient-to-b [&::-webkit-scrollbar-thumb]:from-orange-500/80 [&::-webkit-scrollbar-thumb]:to-amber-500/70 [&::-webkit-scrollbar-thumb]:shadow-[0_0_10px_rgba(249,115,22,0.3)] hover:[&::-webkit-scrollbar-thumb]:from-orange-400 hover:[&::-webkit-scrollbar-thumb]:to-amber-400">
                                        <div className="grid grid-cols-3 gap-3">
                                          {visibleSlots.map((time) => {
                                            const isSelected = selectedTime === time;
                                            const takenCount = slotCounts[time] ?? 0;
                                            const spotsLeft = slotCapacity - takenCount;
                                            const almostFull = spotsLeft === 1;
                                            const displayTime = time;

                                            return (
                                              <button
                                                key={time}
                                                type="button"
                                                onClick={() => handleTimeSelect(time)}
                                                className={`flex min-h-[84px] w-full flex-col items-center justify-center rounded-lg border p-3 text-center transition-all duration-200 focus:outline-none ${
                                                  isSelected
                                                    ? 'border-brand-orange bg-brand-orange text-white shadow-[0_0_10px_rgba(255,102,0,0.3)]'
                                                    : 'border-gray-700 bg-black/20 text-gray-300 hover:border-brand-orange/70 hover:bg-black/40 hover:text-white'
                                                }`}
                                              >
                                                <span className="text-sm font-bold tracking-wide">{displayTime}</span>
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

              <div className="space-y-1.5 pt-2">
                <label htmlFor="productToPurchase" className="flex items-center gap-2 text-sm font-bold text-gray-400">
                  <FaWrench /> Required Services or Products *
                </label>
                <textarea
                  id="productToPurchase" name="productToPurchase" required rows={3}
                  value={formData.productToPurchase} onChange={handleChange}
                  className="w-full bg-gray-950/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-brand-orange focus:border-brand-orange transition-all resize-none placeholder-gray-600 outline-none"
                  placeholder="Tell us what needs doing..."
                />
              </div>
            </div>

            {/* Submit Section */}
            <div className="pt-6">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-brand-orange hover:bg-orange-600 text-white font-black uppercase tracking-wider text-lg py-4 px-8 rounded-xl transition-all transform hover:-translate-y-1 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-3 shadow-lg hover:shadow-brand-orange/20"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <FaPaperPlane /> Request Booking
                  </>
                )}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
}