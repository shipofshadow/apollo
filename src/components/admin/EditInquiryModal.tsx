import { useState, useEffect } from 'react';
import { X, Save, User, Car, Wrench, Loader2, Store, Home } from 'lucide-react';
import { updateInquiryFullApi } from '../../services/api';
import type { Inquiry, Service } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface EditInquiryModalProps {
  isOpen: boolean;
  inquiry: Inquiry | null;
  services?: Service[];
  onClose: () => void;
  onSaveSuccess: (updatedInquiry: Inquiry) => void;
}

export default function EditInquiryModal({
  isOpen,
  inquiry,
  services = [],
  onClose,
  onSaveSuccess,
}: EditInquiryModalProps) {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    fullName: '',
    emailAddress: '',
    contactNumber: '',
    facebookName: '',
    address: '',
    make: '',
    model: '',
    yearModel: '',
    plateNumber: '',
    serviceType: 'shop_visit',
    productToPurchase: '',
    serviceId: '' as string | number,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (inquiry) {
      setFormData({
        fullName: inquiry.fullName || '',
        emailAddress: inquiry.emailAddress || '',
        contactNumber: inquiry.contactNumber || '',
        facebookName: inquiry.facebookName || '',
        address: inquiry.address || '',
        make: inquiry.make || '',
        model: inquiry.model || '',
        yearModel: inquiry.yearModel || inquiry.year || '',
        plateNumber: inquiry.plateNumber || '',
        serviceType: inquiry.serviceType === 'home_service' ? 'home_service' : 'shop_visit',
        productToPurchase: inquiry.productToPurchase || '',
        serviceId: inquiry.serviceId !== undefined && inquiry.serviceId !== null ? String(inquiry.serviceId) : '',
      });
      setError(null);
    }
  }, [inquiry, isOpen]);

  if (!isOpen || !inquiry) return null;

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !inquiry) return;

    if (!formData.fullName.trim()) {
      setError('Customer Full Name is required.');
      return;
    }
    if (!formData.emailAddress.trim()) {
      setError('Email Address is required.');
      return;
    }
    if (!formData.contactNumber.trim()) {
      setError('Contact Number is required.');
      return;
    }
    if (!formData.make.trim() || !formData.model.trim() || !formData.yearModel.trim()) {
      setError('Vehicle Make, Model, and Year are required.');
      return;
    }
    if (!formData.productToPurchase.trim()) {
      setError('Product or service package name is required.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: Record<string, any> = {
        fullName: formData.fullName.trim(),
        emailAddress: formData.emailAddress.trim(),
        contactNumber: formData.contactNumber.trim(),
        facebookName: formData.facebookName.trim(),
        address: formData.address.trim(),
        make: formData.make.trim(),
        model: formData.model.trim(),
        yearModel: formData.yearModel.trim(),
        plateNumber: formData.plateNumber.trim(),
        serviceType: formData.serviceType,
        productToPurchase: formData.productToPurchase.trim(),
        serviceId: formData.serviceId !== '' ? Number(formData.serviceId) : null,
      };

      const res = await updateInquiryFullApi(token, inquiry.id, payload);
      showToast('Customer inquiry details updated successfully.', 'success');
      onSaveSuccess(res.inquiry || { ...inquiry, ...payload });
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to update inquiry details.');
      showToast(err.message || 'Failed to update inquiry details.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in no-print">
      <div className="bg-[#121212] border border-gray-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-brand-darker">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-orange/15 border border-brand-orange/30 flex items-center justify-center text-brand-orange">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white uppercase tracking-wider font-mono">Edit Customer Inquiry</h2>
              <p className="text-xs text-gray-400 font-mono">
                REF: <span className="text-brand-orange">{inquiry.referenceNumber || inquiry.id}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-xs font-mono text-red-400">
              {error}
            </div>
          )}

          {/* Section 1: Customer Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-brand-orange text-xs font-mono font-bold uppercase tracking-wider border-b border-gray-800 pb-2">
              <User className="w-4 h-4" /> Customer Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono text-gray-400 mb-1 uppercase">Full Name *</label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => handleChange('fullName', e.target.value)}
                  className="w-full bg-brand-dark border border-gray-800 focus:border-brand-orange rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
                  placeholder="e.g. Juan Dela Cruz"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-gray-400 mb-1 uppercase">Email Address *</label>
                <input
                  type="email"
                  value={formData.emailAddress}
                  onChange={(e) => handleChange('emailAddress', e.target.value)}
                  className="w-full bg-brand-dark border border-gray-800 focus:border-brand-orange rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
                  placeholder="name@example.com"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-gray-400 mb-1 uppercase">Contact / Phone Number *</label>
                <input
                  type="text"
                  value={formData.contactNumber}
                  onChange={(e) => handleChange('contactNumber', e.target.value)}
                  className="w-full bg-brand-dark border border-gray-800 focus:border-brand-orange rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
                  placeholder="09171234567"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-gray-400 mb-1 uppercase">Facebook Name</label>
                <input
                  type="text"
                  value={formData.facebookName}
                  onChange={(e) => handleChange('facebookName', e.target.value)}
                  className="w-full bg-brand-dark border border-gray-800 focus:border-brand-orange rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
                  placeholder="FB Profile Name"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-mono text-gray-400 mb-1 uppercase">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleChange('address', e.target.value)}
                  className="w-full bg-brand-dark border border-gray-800 focus:border-brand-orange rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
                  placeholder="Street, City, Province"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Vehicle Details */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 text-brand-orange text-xs font-mono font-bold uppercase tracking-wider border-b border-gray-800 pb-2">
              <Car className="w-4 h-4" /> Vehicle Specification
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-mono text-gray-400 mb-1 uppercase">Make *</label>
                <input
                  type="text"
                  value={formData.make}
                  onChange={(e) => handleChange('make', e.target.value)}
                  className="w-full bg-brand-dark border border-gray-800 focus:border-brand-orange rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none transition-colors"
                  placeholder="Toyota"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-gray-400 mb-1 uppercase">Model *</label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => handleChange('model', e.target.value)}
                  className="w-full bg-brand-dark border border-gray-800 focus:border-brand-orange rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none transition-colors"
                  placeholder="Vios"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-gray-400 mb-1 uppercase">Year *</label>
                <input
                  type="text"
                  value={formData.yearModel}
                  onChange={(e) => handleChange('yearModel', e.target.value)}
                  className="w-full bg-brand-dark border border-gray-800 focus:border-brand-orange rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none transition-colors"
                  placeholder="2022"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-gray-400 mb-1 uppercase">Plate Number</label>
                <input
                  type="text"
                  value={formData.plateNumber}
                  onChange={(e) => handleChange('plateNumber', e.target.value)}
                  className="w-full bg-brand-dark border border-gray-800 focus:border-brand-orange rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none uppercase transition-colors"
                  placeholder="ABC 1234"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Service / Package Info */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 text-brand-orange text-xs font-mono font-bold uppercase tracking-wider border-b border-gray-800 pb-2">
              <Wrench className="w-4 h-4" /> Service &amp; Package Choice
            </div>

            {/* Service Location / Type Selector */}
            <div>
              <label className="block text-[11px] font-mono text-gray-400 mb-1.5 uppercase">Service Delivery Location / Type *</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleChange('serviceType', 'shop_visit')}
                  className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
                    formData.serviceType === 'shop_visit'
                      ? 'bg-brand-orange/15 border-brand-orange text-white ring-1 ring-brand-orange/40'
                      : 'bg-brand-dark border-gray-800 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <Store className={`w-4 h-4 ${formData.serviceType === 'shop_visit' ? 'text-brand-orange' : 'text-gray-500'}`} />
                  <div>
                    <div className="text-xs font-mono font-bold uppercase">Shop Visit</div>
                    <div className="text-[10px] text-gray-400">Main Facility, San Fernando</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleChange('serviceType', 'home_service')}
                  className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
                    formData.serviceType === 'home_service'
                      ? 'bg-brand-orange/15 border-brand-orange text-white ring-1 ring-brand-orange/40'
                      : 'bg-brand-dark border-gray-800 text-gray-400 hover:border-gray-700'
                  }`}
                >
                  <Home className={`w-4 h-4 ${formData.serviceType === 'home_service' ? 'text-brand-orange' : 'text-gray-500'}`} />
                  <div>
                    <div className="text-xs font-mono font-bold uppercase">Home Service</div>
                    <div className="text-[10px] text-gray-400">Mobile On-Site Dispatch</div>
                  </div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono text-gray-400 mb-1 uppercase">Requested Product / Package *</label>
                <input
                  type="text"
                  value={formData.productToPurchase}
                  onChange={(e) => handleChange('productToPurchase', e.target.value)}
                  className="w-full bg-brand-dark border border-gray-800 focus:border-brand-orange rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors"
                  placeholder="Headlight Retrofit Package"
                  required
                />
              </div>

              {services.length > 0 && (
                <div>
                  <label className="block text-[11px] font-mono text-gray-400 mb-1 uppercase">Link Catalog Service</label>
                  <select
                    value={formData.serviceId}
                    onChange={(e) => handleChange('serviceId', e.target.value)}
                    className="w-full bg-brand-dark border border-gray-800 focus:border-brand-orange rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none transition-colors cursor-pointer"
                  >
                    <option value="">-- Unlinked / Custom --</option>
                    {services.map((svc) => (
                      <option key={svc.id} value={svc.id}>
                        {svc.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2.5 border border-gray-800 hover:border-gray-700 text-gray-400 hover:text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-brand-orange hover:bg-orange-600 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving Changes...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save Inquiry Details
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
