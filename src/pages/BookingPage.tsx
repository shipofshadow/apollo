import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Clock, CheckCircle, ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import { submitBookingAsync, resetBookingState } from '../store/bookingSlice';
import type { AppDispatch, RootState } from '../store';
import { useAuth } from '../context/AuthContext';

const SERVICES = [
  { id: 1, name: 'Headlight Retrofit',            duration: '4–6 Hours',  price: 'From ₱13,750' },
  { id: 2, name: 'Android Headunit Installation', duration: '2–3 Hours',  price: 'From ₱8,250'  },
  { id: 3, name: 'Security System',               duration: '2–4 Hours',  price: 'From ₱11,000' },
  { id: 4, name: 'Aesthetic Upgrades',            duration: 'Varies',     price: 'Consultation' },
];

const generateNextDays = (): Date[] =>
  Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d;
  }).filter(d => d.getDay() !== 0); // exclude Sundays

const AVAILABLE_TIMES = ['09:00 AM', '11:00 AM', '01:00 PM', '03:00 PM', '05:00 PM'];

const STEPS = ['Service', 'Date & Time', 'Your Details', 'Confirm'];

export default function BookingPage() {
  const dispatch  = useDispatch<AppDispatch>();
  const navigate  = useNavigate();
  const { user, token }        = useAuth();
  const { status: bookStatus } = useSelector((s: RootState) => s.booking);

  const [step,            setStep]            = useState(1);
  const [selectedService, setSelectedService] = useState<number | null>(null);
  const [selectedDate,    setSelectedDate]    = useState<Date | null>(null);
  const [selectedTime,    setSelectedTime]    = useState('');
  const [form,            setForm]            = useState({
    name:        user?.name  ?? '',
    email:       user?.email ?? '',
    phone:       user?.phone ?? '',
    vehicleInfo: '',
    notes:       '',
  });

  const availableDates = generateNextDays();

  const handleNext = () => setStep(s => s + 1);
  const handleBack = () => setStep(s => s - 1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const service = SERVICES.find(s => s.id === selectedService)!;
    const result = await dispatch(
      submitBookingAsync({
        payload: {
          name:            form.name,
          email:           form.email,
          phone:           form.phone,
          vehicleInfo:     form.vehicleInfo,
          serviceId:       service.id,
          appointmentDate: selectedDate!.toISOString().split('T')[0],
          appointmentTime: selectedTime,
          notes:           form.notes,
        },
        token,
      })
    );
    if (submitBookingAsync.fulfilled.match(result)) {
      setStep(4);
    }
  };

  const reset = () => {
    dispatch(resetBookingState());
    setStep(1);
    setSelectedService('');
    setSelectedDate(null);
    setSelectedTime('');
    setForm({ name: user?.name ?? '', email: user?.email ?? '', phone: user?.phone ?? '', vehicleInfo: '', notes: '' });
  };

  const selectedServiceObj = SERVICES.find(s => s.id === selectedService);

  return (
    <div className="pt-32 pb-24 min-h-screen bg-brand-darker">
      <div className="container mx-auto px-4 md:px-6 max-w-4xl">
        <div className="text-center mb-12">
          <span className="text-brand-orange font-bold uppercase tracking-widest text-sm block mb-3">
            Schedule Your Visit
          </span>
          <h1 className="text-4xl md:text-5xl font-display font-black text-white uppercase tracking-tighter mb-4">
            Book <span className="text-brand-orange">Appointment</span>
          </h1>
          <p className="text-gray-400 text-lg">
            Select a service, choose your preferred date and time, and provide your details.
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex justify-between items-center mb-12 relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-gray-800 z-0" />
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-brand-orange z-0 transition-all duration-500"
            style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
          />
          {STEPS.map((label, i) => {
            const n = i + 1;
            const active = step >= n;
            return (
              <div key={n} className="relative z-10 flex flex-col items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${active ? 'bg-brand-orange text-white' : 'bg-gray-800 text-gray-500'}`}>
                  {n === STEPS.length && step === STEPS.length ? <CheckCircle className="w-5 h-5" /> : n}
                </div>
                <span className={`hidden md:block text-xs font-bold uppercase tracking-widest ${active ? 'text-brand-orange' : 'text-gray-600'}`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="bg-brand-dark border border-gray-800 p-6 md:p-10 rounded-sm">

          {/* ── Step 1: Service ── */}
          {step === 1 && (
            <div>
              <h2 className="text-2xl font-display font-bold text-white uppercase mb-6">1. Select Service</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {SERVICES.map(svc => (
                  <button
                    key={svc.id}
                    onClick={() => setSelectedService(svc.id)}
                    className={`p-6 border text-left transition-all rounded-sm ${
                      selectedService === svc.id
                        ? 'border-brand-orange bg-brand-orange/10'
                        : 'border-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <h3 className="text-lg font-bold text-white mb-2">{svc.name}</h3>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {svc.duration}</span>
                      <span className="text-brand-orange font-bold">{svc.price}</span>
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-8 flex justify-end">
                <button onClick={handleNext} disabled={!selectedService}
                  className="w-full sm:w-auto bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 rounded-sm">
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Date & Time ── */}
          {step === 2 && (
            <div>
              <h2 className="text-2xl font-display font-bold text-white uppercase mb-6">2. Select Date & Time</h2>

              <div className="mb-8">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Available Dates</p>
                <div className="flex overflow-x-auto pb-3 gap-3 snap-x">
                  {availableDates.map((date, i) => (
                    <button key={i} onClick={() => setSelectedDate(date)}
                      className={`snap-start shrink-0 w-24 p-4 border text-center transition-all rounded-sm ${
                        selectedDate?.toDateString() === date.toDateString()
                          ? 'border-brand-orange bg-brand-orange/10'
                          : 'border-gray-800 hover:border-gray-600'
                      }`}
                    >
                      <div className="text-xs text-gray-400 uppercase mb-1">
                        {date.toLocaleDateString('en-PH', { weekday: 'short' })}
                      </div>
                      <div className="text-2xl font-display font-bold text-white">{date.getDate()}</div>
                      <div className="text-xs text-gray-500 uppercase mt-1">
                        {date.toLocaleDateString('en-PH', { month: 'short' })}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {selectedDate && (
                <div className="mb-8">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Available Times</p>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                    {AVAILABLE_TIMES.map(time => (
                      <button key={time} onClick={() => setSelectedTime(time)}
                        className={`p-3 border text-center transition-all font-bold text-sm rounded-sm ${
                          selectedTime === time
                            ? 'border-brand-orange bg-brand-orange text-white'
                            : 'border-gray-800 text-gray-300 hover:border-gray-600'
                        }`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-8 flex flex-col-reverse sm:flex-row justify-between gap-4">
                <button onClick={handleBack}
                  className="w-full sm:w-auto text-gray-400 hover:text-white px-6 py-3 font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 border border-gray-800 rounded-sm">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button onClick={handleNext} disabled={!selectedDate || !selectedTime}
                  className="w-full sm:w-auto bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest disabled:opacity-50 hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 rounded-sm">
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Details ── */}
          {step === 3 && (
            <div>
              <h2 className="text-2xl font-display font-bold text-white uppercase mb-6">3. Your Details</h2>
              {!user && (
                <div className="mb-6 flex items-center justify-between bg-brand-orange/10 border border-brand-orange/30 px-4 py-3 rounded-sm text-sm">
                  <span className="text-gray-300">Have an account? Sign in to pre-fill your details.</span>
                  <Link to={`/login?redirect=/booking`} className="text-brand-orange font-bold hover:text-orange-400 transition-colors ml-4 shrink-0">
                    Sign In
                  </Link>
                </div>
              )}

              <form id="booking-form" onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Full Name *</label>
                    <input type="text" required value={form.name}
                      onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                      className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors rounded-sm" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Phone Number *</label>
                    <input type="tel" required value={form.phone}
                      onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                      className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors rounded-sm"
                      placeholder="09XXXXXXXXX" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Email Address *</label>
                    <input type="email" required value={form.email}
                      onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                      className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors rounded-sm" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Vehicle (Year / Make / Model) *</label>
                    <input type="text" required value={form.vehicleInfo}
                      onChange={e => setForm(p => ({ ...p, vehicleInfo: e.target.value }))}
                      className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors rounded-sm"
                      placeholder="e.g. 2022 Honda Civic" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Additional Notes</label>
                  <textarea rows={4} value={form.notes}
                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    className="w-full bg-brand-darker border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors resize-none rounded-sm"
                    placeholder="Any specific requests or concerns…" />
                </div>

                {/* Summary */}
                <div className="bg-brand-darker border border-gray-700 rounded-sm p-4 space-y-2 text-sm">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">Booking Summary</p>
                  <div className="flex justify-between"><span className="text-gray-400">Service</span><span className="text-white font-semibold">{selectedServiceObj?.name}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Date</span><span className="text-white">{selectedDate?.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Time</span><span className="text-white">{selectedTime}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Starting Price</span><span className="text-brand-orange font-bold">{selectedServiceObj?.price}</span></div>
                </div>
              </form>

              <div className="mt-8 flex flex-col-reverse sm:flex-row justify-between gap-4 pt-6 border-t border-gray-800">
                <button onClick={handleBack}
                  className="w-full sm:w-auto text-gray-400 hover:text-white px-6 py-3 font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 border border-gray-800 rounded-sm">
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button type="submit" form="booking-form" disabled={bookStatus === 'loading'}
                  className="w-full sm:w-auto bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 rounded-sm disabled:opacity-60">
                  {bookStatus === 'loading'
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</>
                    : <><CheckCircle className="w-4 h-4" /> Confirm Booking</>}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Success ── */}
          {step === 4 && (
            <div className="text-center py-12">
              <CheckCircle className="w-24 h-24 text-brand-orange mx-auto mb-6" />
              <h2 className="text-3xl md:text-4xl font-display font-bold text-white uppercase mb-4">
                Booking Confirmed!
              </h2>
              <p className="text-gray-400 text-lg mb-8 max-w-md mx-auto">
                Thank you, <span className="text-white font-bold">{form.name}</span>. Your{' '}
                <span className="text-white">{selectedServiceObj?.name}</span> appointment is set for{' '}
                <span className="text-white">{selectedDate?.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' })}</span>{' '}
                at <span className="text-white">{selectedTime}</span>.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                {user ? (
                  <button onClick={() => navigate('/client/bookings')}
                    className="bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm">
                    View My Bookings
                  </button>
                ) : (
                  <Link
                    to={`/register?redirect=/client/bookings&name=${encodeURIComponent(form.name)}&email=${encodeURIComponent(form.email)}&phone=${encodeURIComponent(form.phone)}`}
                    className="bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm">
                    Create Account to Track Booking
                  </Link>
                )}
                <button onClick={reset}
                  className="border border-gray-600 text-white px-8 py-3 font-bold uppercase tracking-widest hover:border-brand-orange hover:text-brand-orange transition-colors rounded-sm">
                  Book Another
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
