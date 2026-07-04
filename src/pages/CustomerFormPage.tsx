import React, { useState } from 'react';
import PageSEO from '../components/PageSEO';
import { useToast } from '../context/ToastContext';
import { BACKEND_URL } from '../config';

// Date Picker Imports
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { format, parse } from 'date-fns';

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
  FaPaperPlane 
} from 'react-icons/fa';

const YEARS = Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i);
const TODAY = new Date();

const INITIAL_FORM_STATE = {
  fullName: '',
  address: '',
  contactNumber: '',
  emailAddress: '',
  facebookName: '',
  make: '',
  model: '',
  yearModel: '',
  appointmentDate: '', // Will store as YYYY-MM-DD
  appointmentTime: '', // Will store as h:mm aa (e.g. 2:30 PM)
  productToPurchase: ''
};

export default function CustomerFormPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const { showToast } = useToast();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Helper for DatePicker
  const handleDateChange = (date: Date | null) => {
    if (!date) return;
    setFormData(prev => ({ 
      ...prev, 
      appointmentDate: format(date, 'yyyy-MM-dd') 
    }));
  };

  // Helper for TimePicker
  const handleTimeChange = (time: Date | null) => {
    if (!time) return;
    setFormData(prev => ({ 
      ...prev, 
      appointmentTime: format(time, 'h:mm aa') 
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // 1. Fire Google Sheets Webhook (Isolated so a failure here doesn't block the DB)
      try {
        const scriptURL = 'https://script.google.com/macros/s/AKfycbzhS1M8GX-4A-N6oEDR0ZVIkBARF2krKoDthjC1o54cHHPJUBs1YGSW0ZZLEp1LuzRh/exec';
        const googleData = new URLSearchParams({
          'Timestamp': new Date().toLocaleString(),
          'Full Name': formData.fullName,
          'Address': formData.address,
          'Contact Number': formData.contactNumber,
          'Email address': formData.emailAddress,
          'Facebook Name': formData.facebookName,
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

  // Parse strings back to Date objects for the pickers
  const selectedDateObj = formData.appointmentDate 
    ? parse(formData.appointmentDate, 'yyyy-MM-dd', new Date()) 
    : null;
    
  const selectedTimeObj = formData.appointmentTime 
    ? parse(formData.appointmentTime, 'h:mm aa', new Date()) 
    : null;

  return (
    <div className="min-h-screen bg-brand-dark pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <PageSEO
        title="Inquiry Form | 1625 Autolab"
        description="Fill out this form to order products or schedule a service with 1625 Autolab."
      />

      <div className="max-w-3xl mx-auto">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Custom Date Picker */}
                <div className="space-y-1.5 flex flex-col">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-400">
                    <FaCalendarAlt /> Preferred Date *
                  </label>
                  <DatePicker
                    selected={selectedDateObj}
                    onChange={handleDateChange}
                    minDate={TODAY}
                    dateFormat="MMMM d, yyyy"
                    placeholderText="Select a date"
                    required
                    className="w-full bg-gray-950/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-brand-orange focus:border-brand-orange transition-all cursor-pointer outline-none placeholder-gray-600"
                    wrapperClassName="w-full"
                  />
                </div>

                {/* Custom Time Picker */}
                <div className="space-y-1.5 flex flex-col">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-400">
                    <FaClock /> Time Drop-off *
                  </label>
                  <DatePicker
                    selected={selectedTimeObj}
                    onChange={handleTimeChange}
                    showTimeSelect
                    showTimeSelectOnly
                    timeIntervals={30}
                    timeCaption="Time"
                    dateFormat="h:mm aa"
                    placeholderText="Select a time"
                    required
                    className="w-full bg-gray-950/50 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-brand-orange focus:border-brand-orange transition-all cursor-pointer outline-none placeholder-gray-600"
                    wrapperClassName="w-full"
                  />
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