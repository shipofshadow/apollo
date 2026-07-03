import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import type { SingleValue } from 'react-select';
import PageSEO from '../components/PageSEO';
import { useToast } from '../context/ToastContext';
import { BACKEND_URL } from '../config';
import { fetchVehicleMakesApi, fetchVehicleModelsApi } from '../services/api';

const YEARS = Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i);

export default function CustomerFormPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    address: '',
    contactNumber: '',
    emailAddress: '',
    facebookName: '',
    make: '',
    model: '',
    otherModel: '',
    yearModel: '',
    productToPurchase: ''
  });

  const [dynamicMakes, setDynamicMakes] = useState<string[]>([]);
  const [dynamicModels, setDynamicModels] = useState<string[]>([]);
  const { showToast } = useToast();

  const makes = dynamicMakes;
  const models = dynamicModels;

  const makeOptions = makes.map(m => ({ value: m, label: m }));
  const modelOptions = models.map(m => ({ value: m, label: m }));

  const selectStyles = {
    control: (provided: any, state: any) => ({
      ...provided,
      backgroundColor: 'transparent',
      borderColor: state.isFocused ? '#FB923C' : '#374151',
      boxShadow: 'none',
      minHeight: '44px',
      borderRadius: '0.5rem',
      '&:hover': { borderColor: '#FB923C' }
    }),
    menu: (provided: any) => ({ ...provided, zIndex: 9999, backgroundColor: '#0f1724', color: '#fff' }),
    option: (provided: any, state: any) => ({
      ...provided,
      backgroundColor: state.isFocused ? '#FB923C' : 'transparent',
      color: state.isFocused ? '#000' : '#fff',
    }),
    singleValue: (provided: any) => ({ ...provided, color: '#fff' }),
    placeholder: (provided: any) => ({ ...provided, color: '#9CA3AF' }),
    input: (provided: any) => ({ ...provided, color: '#fff' }),
    dropdownIndicator: (provided: any) => ({ ...provided, color: '#9CA3AF' }),
    indicatorSeparator: () => ({ display: 'none' }),
    menuPortal: (provided: any) => ({ ...provided, zIndex: 9999 })
  };

  useEffect(() => {
    fetchVehicleMakesApi()
      .then(res => setDynamicMakes(res.makes || []))
      .catch(err => {
        console.error('Failed to load vehicle makes', err);
        setDynamicMakes([]);
      });
  }, []);

  useEffect(() => {
    if (!formData.make) {
      setDynamicModels([]);
      return;
    }

    fetchVehicleModelsApi(formData.make)
      .then(res => {
        const backendModels = res.models || [];
        if (!backendModels.includes('Other Model')) {
          setDynamicModels([...backendModels, 'Other Model']);
        } else {
          setDynamicModels(backendModels);
        }
      })
      .catch(err => {
        console.error('Failed to load vehicle models', err);
        setDynamicModels([]);
      });
  }, [formData.make]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'make' ? { model: '', otherModel: '' } : {}) // Reset model when make changes
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const actualModel = formData.model === 'Other Model' || formData.make === 'Other' ? formData.otherModel : formData.model;

      const scriptURL = 'https://script.google.com/macros/s/AKfycbzhS1M8GX-4A-N6oEDR0ZVIkBARF2krKoDthjC1o54cHHPJUBs1YGSW0ZZLEp1LuzRh/exec';
      const googleData = new URLSearchParams();
      googleData.append('Timestamp', new Date().toLocaleString());
      googleData.append('Full Name', formData.fullName);
      googleData.append('Address', formData.address);
      googleData.append('Contact Number', formData.contactNumber);
      googleData.append('Email address', formData.emailAddress);
      googleData.append('Facebook Name', formData.facebookName);
      googleData.append('Car Make', formData.make);
      googleData.append('Car Model', actualModel);
      googleData.append('Year Model', formData.yearModel);
      googleData.append('Product to Purchase', formData.productToPurchase);

      await fetch(scriptURL, {
        method: 'POST',
        body: googleData,
        mode: 'no-cors'
      });

      const response = await fetch(`${BACKEND_URL}/api/inquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formData.fullName,
          address: formData.address,
          contactNumber: formData.contactNumber,
          emailAddress: formData.emailAddress,
          facebookName: formData.facebookName,
          make: formData.make,
          model: actualModel,
          otherModel: formData.otherModel,
          yearModel: formData.yearModel,
          productToPurchase: formData.productToPurchase,
        }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error((result as { detail?: string } | null)?.detail ?? 'Unable to submit inquiry.');
      }

      showToast('Form submitted successfully! We will contact you soon.', 'success');

      // Reset form
      setFormData({
        fullName: '',
        address: '',
        contactNumber: '',
        emailAddress: '',
        facebookName: '',
        make: '',
        model: '',
        otherModel: '',
        yearModel: '',
        productToPurchase: ''
      });
    } catch (error) {
      console.error('Error submitting form:', error);
      showToast('An error occurred. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <PageSEO
        title="Inquiry Form | 1625 Auto Lab"
        description="Fill out this form to order products or schedule a service with 1625 Auto Lab."
      />

      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-white mb-4">
            Order <span className="text-brand-orange">Form</span>
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Please fill out the details below to submit your inquiry. Our team will get back to you shortly.
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-xl p-6 md:p-10 relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-orange/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

          <form onSubmit={handleSubmit} className="relative z-10 space-y-6">

            {/* Personal Information */}
            <div className="space-y-6">
              <h3 className="text-xl font-bold text-white border-b border-gray-800 pb-2">Personal Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="fullName" className="block text-sm font-medium text-gray-300">Full Name *</label>
                  <input
                    type="text"
                    id="fullName"
                    name="fullName"
                    required
                    value={formData.fullName}
                    onChange={handleChange}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent transition-colors"
                    placeholder="Juan Dela Cruz"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="contactNumber" className="block text-sm font-medium text-gray-300">Contact Number *</label>
                  <input
                    type="tel"
                    id="contactNumber"
                    name="contactNumber"
                    required
                    value={formData.contactNumber}
                    onChange={handleChange}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent transition-colors"
                    placeholder="0912 345 6789"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="address" className="block text-sm font-medium text-gray-300">Address *</label>
                <input
                  type="text"
                  id="address"
                  name="address"
                  required
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent transition-colors"
                  placeholder="Complete Delivery Address"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="emailAddress" className="block text-sm font-medium text-gray-300">Email Address *</label>
                  <input
                    type="email"
                    id="emailAddress"
                    name="emailAddress"
                    required
                    value={formData.emailAddress}
                    onChange={handleChange}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent transition-colors"
                    placeholder="juan@example.com"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="facebookName" className="block text-sm font-medium text-gray-300">Facebook Name / Profile *</label>
                  <input
                    type="text"
                    id="facebookName"
                    name="facebookName"
                    required
                    value={formData.facebookName}
                    onChange={handleChange}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent transition-colors"
                    placeholder="Juan Dela Cruz (Link or Name)"
                  />
                </div>
              </div>
            </div>

            {/* Vehicle Information */}
            <div className="space-y-6 pt-4">
              <h3 className="text-xl font-bold text-white border-b border-gray-800 pb-2">Vehicle Information</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label htmlFor="make" className="block text-sm font-medium text-gray-300">Car Make *</label>
                  <Select
                    inputId="make"
                    name="make"
                    isClearable
                    options={makeOptions}
                    value={formData.make ? { value: formData.make, label: formData.make } : null}
                    onChange={(opt: SingleValue<{ value: string; label: string }>) => {
                      const val = opt ? opt.value : '';
                      setFormData(prev => ({ ...prev, make: val, model: '', otherModel: '' }));
                    }}
                    classNamePrefix="rs"
                    placeholder="Select Make"
                    styles={selectStyles}
                    menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
                    menuPosition="fixed"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="model" className="block text-sm font-medium text-gray-300">Car Model *</label>
                  <Select
                    inputId="model"
                    name="model"
                    isClearable
                    options={modelOptions}
                    value={formData.model ? { value: formData.model, label: formData.model } : null}
                    onChange={(opt: SingleValue<{ value: string; label: string }>) => {
                      const val = opt ? opt.value : '';
                      setFormData(prev => ({ ...prev, model: val }));
                    }}
                    isDisabled={!formData.make}
                    classNamePrefix="rs"
                    placeholder={formData.make ? 'Select Model' : 'Choose Make first'}
                    styles={selectStyles}
                    menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
                    menuPosition="fixed"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="yearModel" className="block text-sm font-medium text-gray-300">Year Model *</label>
                  <select
                    id="yearModel"
                    name="yearModel"
                    required
                    value={formData.yearModel}
                    onChange={handleChange}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent transition-colors appearance-none"
                  >
                    <option value="" disabled>Select Year</option>
                    {YEARS.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              </div>

              {(formData.make === 'Other' || formData.model === 'Other Model') && (
                <div className="space-y-2">
                  <label htmlFor="otherModel" className="block text-sm font-medium text-gray-300">Specify Car Make/Model *</label>
                  <input
                    type="text"
                    id="otherModel"
                    name="otherModel"
                    required
                    value={formData.otherModel}
                    onChange={handleChange}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent transition-colors"
                    placeholder="e.g. Mazda 3"
                  />
                </div>
              )}
            </div>

            {/* Order Details */}
            <div className="space-y-6 pt-4">
              <h3 className="text-xl font-bold text-white border-b border-gray-800 pb-2">Order Details</h3>

              <div className="space-y-2">
                <label htmlFor="productToPurchase" className="block text-sm font-medium text-gray-300">Product / Service to Purchase *</label>
                <textarea
                  id="productToPurchase"
                  name="productToPurchase"
                  required
                  rows={4}
                  value={formData.productToPurchase}
                  onChange={handleChange}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent transition-colors resize-none"
                  placeholder="Describe the product or service you want to order..."
                />
              </div>
            </div>

            <div className="pt-6">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-brand-orange hover:bg-brand-orange/90 text-white font-bold text-lg py-4 px-8 rounded-lg transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  'Submit Order Request'
                )}
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center mt-4">
              By submitting this form, you agree to our terms and conditions. Your data is protected and will not be shared.
            </p>

          </form>
        </div>
      </div>
    </div>
  );
}
