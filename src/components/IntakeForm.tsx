import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { submitBookingAsync, resetBookingState } from '../store/bookingSlice';
import type { RootState, AppDispatch } from '../store';
import { MapPin, Phone, Mail, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { VEHICLE_MAKES, VEHICLE_MODELS, VEHICLE_YEARS, type VehicleMake } from '../data/vehicles';

const AVAILABLE_TIMES = ['09:00 AM', '11:00 AM', '01:00 PM', '03:00 PM', '05:00 PM'];

// Generate valid booking dates (tomorrow onward, skip Sundays) for the next 30 days
function getAvailableDates(): string[] {
  const dates: string[] = [];
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (dates.length < 30) {
    if (d.getDay() !== 0) {
      dates.push(d.toISOString().split('T')[0]);
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

const AVAILABLE_DATES = getAvailableDates();

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
                    <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Vehicle *</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <select required value={vehicleMake}
                        onChange={e => { setVehicleMake(e.target.value); setVehicleModel(''); }}
                        className="w-full bg-brand-gray/50 border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors appearance-none">
                        <option value="">Make…</option>
                        {VEHICLE_MAKES.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <select required value={vehicleModel} onChange={e => setVehicleModel(e.target.value)} disabled={!vehicleMake}
                        className="w-full bg-brand-gray/50 border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors appearance-none disabled:opacity-40">
                        <option value="">Model…</option>
                        {vehicleMake ? (VEHICLE_MODELS[vehicleMake as VehicleMake] ?? []).map(m => <option key={m} value={m}>{m}</option>) : null}
                      </select>
                      <select required value={vehicleYear} onChange={e => setVehicleYear(e.target.value)}
                        className="w-full bg-brand-gray/50 border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors appearance-none">
                        <option value="">Year…</option>
                        {VEHICLE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
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
                        {AVAILABLE_DATES.map(d => {
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
                      <label className="text-xs font-bold uppercase tracking-widest text-gray-500">Preferred Time *</label>
                      <select name="preferredTime" required value={formData.preferredTime} onChange={handleChange}
                        className="w-full bg-brand-gray/50 border border-gray-700 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors appearance-none">
                        <option value="">Select a time…</option>
                        {AVAILABLE_TIMES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
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
