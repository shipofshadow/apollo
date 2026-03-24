import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { submitBookingAsync, resetBookingState } from '../store/bookingSlice';
import type { RootState, AppDispatch } from '../store';
import { MapPin, Phone, Mail, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { VEHICLE_MAKES as STATIC_MAKES, VEHICLE_MODELS as STATIC_MODELS, VEHICLE_YEARS, type VehicleMake } from '../data/vehicles';
import { fetchVehicleMakesApi, fetchVehicleModelsApi, fetchAvailabilityApi } from '../services/api';
import { BACKEND_URL } from '../config';

/** Fallback: generate next 30 open dates skipping Sundays */
function getDefaultDates(): string[] {
  const dates: string[] = [];
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (dates.length < 30) {
    if (d.getDay() !== 0) dates.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

export default function IntakeForm() {
  const dispatch = useDispatch<AppDispatch>();
  const { status, error } = useSelector((state: RootState) => state.booking);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    serviceRequired: '',
    locationPreference: 'in-shop',
    specificRequests: '',
    preferredDate: '',
    preferredTime: '',
  });
  const [vehicleMake,  setVehicleMake]  = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear,  setVehicleYear]  = useState('');

  // Dynamic vehicle data (CarAPI proxy), fall back to static dataset
  const [dynamicMakes,  setDynamicMakes]  = useState<string[]>([]);
  const [dynamicModels, setDynamicModels] = useState<string[]>([]);
  const [makesLoading,  setMakesLoading]  = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);

  const makesList  = dynamicMakes.length  ? dynamicMakes  : [...STATIC_MAKES];
  const modelsList = dynamicModels.length ? dynamicModels
    : vehicleMake ? (STATIC_MODELS[vehicleMake as VehicleMake] ?? []) : [];

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

  // Load time slots when date changes
  const [availableSlots,   setAvailableSlots]   = useState<string[]>([]);
  const [slotsLoading,     setSlotsLoading]     = useState(false);
  const [shopDayIsOpen,    setShopDayIsOpen]    = useState(true);
  const availableDates = getDefaultDates();

  useEffect(() => {
    const date = formData.preferredDate;
    if (!date) { setAvailableSlots([]); return; }
    setFormData(p => ({ ...p, preferredTime: '' }));
    setAvailableSlots([]);
    if (!BACKEND_URL) return;
    setSlotsLoading(true);
    fetchAvailabilityApi(date)
      .then(res => {
        setShopDayIsOpen(res.isOpen);
        setAvailableSlots(res.isOpen ? res.availableSlots.filter(s => !res.bookedSlots.includes(s)) : []);
      })
      .catch(() => { /* silently ignore */ })
      .finally(() => setSlotsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.preferredDate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const serviceMap: Record<string, { id: number; name: string }> = {
      headlights: { id: 1, name: 'Headlight Retrofit' },
      headunit:   { id: 2, name: 'Android Headunit Installation' },
      security:   { id: 3, name: 'Security System' },
      aesthetics: { id: 4, name: 'Aesthetic Upgrades' },
      other:      { id: 0, name: 'Other / Multiple' },
    };
    const svc = serviceMap[formData.serviceRequired] ?? { id: 0, name: formData.serviceRequired };

    const vehicleInfo = [vehicleYear, vehicleMake, vehicleModel].filter(Boolean).join(' ');

    dispatch(submitBookingAsync({
      payload: {
        name:            formData.name,
        email:           formData.email,
        phone:           formData.phone,
        vehicleInfo,
        vehicleMake,
        vehicleModel,
        vehicleYear,
        serviceIds:      [svc.id],
        appointmentDate: formData.preferredDate,
        appointmentTime: formData.preferredTime,
        notes:           [
          formData.locationPreference && `Location: ${formData.locationPreference}`,
          formData.specificRequests,
        ].filter(Boolean).join(' | '),
      },
    }));
  };

  const handleReset = () => {
    dispatch(resetBookingState());
    setFormData({
      name: '',
      email: '',
      phone: '',
      serviceRequired: '',
      locationPreference: 'in-shop',
      specificRequests: '',
      preferredDate: '',
      preferredTime: '',
    });
    setVehicleMake('');
    setVehicleModel('');
    setVehicleYear('');
    setDynamicModels([]);
  };

  return (
    <section id="contact" className="py-24 bg-brand-darker relative">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-0">
          
          {/* Left Side: Contact Info */}
          <div className="bg-brand-gray p-6 md:p-10 lg:p-16 border-l-4 border-brand-orange">
            <span className="text-brand-orange font-bold uppercase tracking-widest text-sm block mb-4">
              Get In Touch
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-display font-bold text-white uppercase mb-8">
              Contact <span className="text-brand-orange">The Lab</span>
            </h2>
            
            <p className="text-gray-400 mb-12 leading-relaxed">
              Ready to upgrade your ride? Fill out the intake form to schedule a consultation. We specialize in custom builds and require appointments for all major retrofits.
            </p>

            <div className="space-y-8">
              <div className="flex items-start gap-6">
                <div className="w-12 h-12 bg-brand-darker border border-gray-700 flex items-center justify-center shrink-0">
                  <MapPin className="w-6 h-6 text-brand-orange" />
                </div>
                <div>
                  <h4 className="text-white font-display uppercase tracking-wider text-xl mb-2">Location</h4>
                  <p className="text-gray-400">NKKS Arcade, Krystal Homes, Brgy. Alasas<br />Pampanga, San Fernando, Philippines, 2000</p>
                </div>
              </div>

              <div className="flex items-start gap-6">
                <div className="w-12 h-12 bg-brand-darker border border-gray-700 flex items-center justify-center shrink-0">
                  <Phone className="w-6 h-6 text-brand-orange" />
                </div>
                <div>
                  <h4 className="text-white font-display uppercase tracking-wider text-xl mb-2">Phone</h4>
                  <p className="text-gray-400">0939 330 8263</p>
                </div>
              </div>

              <div className="flex items-start gap-6">
                <div className="w-12 h-12 bg-brand-darker border border-gray-700 flex items-center justify-center shrink-0">
                  <Mail className="w-6 h-6 text-brand-orange" />
                </div>
                <div>
                  <h4 className="text-white font-display uppercase tracking-wider text-xl mb-2">Email</h4>
                  <p className="text-gray-400">1625autolab@gmail.com</p>
                </div>
              </div>

              <div className="flex items-start gap-6">
                <div className="w-12 h-12 bg-brand-darker border border-gray-700 flex items-center justify-center shrink-0">
                  <Clock className="w-6 h-6 text-brand-orange" />
                </div>
                <div>
                  <h4 className="text-white font-display uppercase tracking-wider text-xl mb-2">Hours</h4>
                  <p className="text-gray-400">Mon-Fri: 9:00 AM - 6:00 PM<br />Sat: By Appointment Only</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Booking Form */}
          <div className="bg-brand-dark p-6 md:p-10 lg:p-16 border border-gray-800 relative">
            {status === 'success' ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-brand-dark/95 backdrop-blur-sm p-8 text-center z-10">
                <CheckCircle className="w-20 h-20 text-green-500 mb-6" />
                <h3 className="text-3xl font-display font-bold text-white uppercase mb-4">Request Received</h3>
                <p className="text-gray-400 mb-8 max-w-md">
                  We've received your build request. A technician will contact you within 24 hours to discuss details and scheduling.
                </p>
                <button
                  onClick={handleReset}
                  className="bg-brand-orange text-white font-display uppercase tracking-wider px-8 py-4 rounded-sm hover:bg-orange-600 transition-colors"
                >
                  Submit Another Request
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-2xl font-display font-bold text-white uppercase mb-8 border-b border-gray-800 pb-4">
                  Intake Form
                </h3>
                
                {status === 'error' && (
                  <div className="mb-8 p-4 bg-red-500/10 border border-red-500/50 flex items-start gap-3 text-red-400">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <p>{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Full Name *</label>
                      <input
                        type="text"
                        name="name"
                        required
                        value={formData.name}
                        onChange={handleChange}
                        className="w-full bg-brand-gray/50 border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors"
                        placeholder="John Doe"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Phone Number *</label>
                      <input
                        type="tel"
                        name="phone"
                        required
                        value={formData.phone}
                        onChange={handleChange}
                        className="w-full bg-brand-gray/50 border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors"
                        placeholder="(555) 123-4567"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Email Address *</label>
                    <input
                      type="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full bg-brand-gray/50 border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors"
                      placeholder="john@example.com"
                    />
                  </div>

                  {/* Vehicle cascading dropdowns */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">
                      Vehicle *
                      {makesLoading && <span className="ml-2 text-gray-600 normal-case font-normal">Loading…</span>}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <select required value={vehicleYear} onChange={e => setVehicleYear(e.target.value)}
                        className="w-full bg-brand-gray/50 border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors appearance-none">
                        <option value="">Year…</option>
                        {VEHICLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <select required value={vehicleMake}
                        onChange={e => { setVehicleMake(e.target.value); setVehicleModel(''); }}
                        disabled={makesLoading}
                        className="w-full bg-brand-gray/50 border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors appearance-none disabled:opacity-60">
                        <option value="">{makesLoading ? 'Loading…' : 'Make…'}</option>
                        {makesList.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <select required value={vehicleModel} onChange={e => setVehicleModel(e.target.value)}
                        disabled={!vehicleMake || modelsLoading}
                        className="w-full bg-brand-gray/50 border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors appearance-none disabled:opacity-40">
                        <option value="">{modelsLoading ? 'Loading…' : 'Model…'}</option>
                        {modelsList.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Service Required *</label>
                      <select
                        name="serviceRequired"
                        required
                        value={formData.serviceRequired}
                        onChange={handleChange}
                        className="w-full bg-brand-gray/50 border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors appearance-none"
                      >
                        <option value="" disabled>Select a service</option>
                        <option value="headlights">Headlight Retrofit</option>
                        <option value="headunit">Android Headunit</option>
                        <option value="security">Security System</option>
                        <option value="aesthetics">Aesthetic Upgrades</option>
                        <option value="other">Other / Multiple</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Location Preference</label>
                      <select
                        name="locationPreference"
                        value={formData.locationPreference}
                        onChange={handleChange}
                        className="w-full bg-brand-gray/50 border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors appearance-none"
                      >
                        <option value="in-shop">In-Shop (San Fernando)</option>
                        <option value="mail-in">Mail-In Service</option>
                      </select>
                    </div>
                  </div>

                  {/* Preferred date & time */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Preferred Date *</label>
                      <select name="preferredDate" required value={formData.preferredDate} onChange={handleChange}
                        className="w-full bg-brand-gray/50 border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors appearance-none">
                        <option value="">Select a date…</option>
                        {availableDates.map(d => {
                          const dt = new Date(d + 'T00:00:00');
                          return (
                            <option key={d} value={d}>
                              {dt.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-500">
                        Preferred Time *
                        {slotsLoading && <span className="ml-2 text-gray-600 normal-case font-normal">Loading…</span>}
                      </label>
                      {formData.preferredDate && !shopDayIsOpen ? (
                        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-sm">
                          Shop is closed on this date.
                        </p>
                      ) : (
                        <select name="preferredTime" required value={formData.preferredTime} onChange={handleChange}
                          disabled={!formData.preferredDate || slotsLoading}
                          className="w-full bg-brand-gray/50 border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors appearance-none disabled:opacity-50">
                          <option value="">{slotsLoading ? 'Loading…' : 'Select a time…'}</option>
                          {(availableSlots.length ? availableSlots : []).map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Specific Requests / Details</label>
                    <textarea
                      name="specificRequests"
                      rows={4}
                      value={formData.specificRequests}
                      onChange={handleChange}
                      className="w-full bg-brand-gray/50 border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors resize-none"
                      placeholder="Describe your vision or specific parts you want used..."
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    disabled={status === 'loading'}
                    className="w-full bg-brand-orange text-white font-display uppercase tracking-wider px-8 py-4 rounded-sm hover:bg-orange-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {status === 'loading' ? (
                      <>
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        Processing...
                      </>
                    ) : (
                      'Submit Request'
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
