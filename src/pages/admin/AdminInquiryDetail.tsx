import { useEffect, useState } from 'react';
import {
  ArrowLeft, CheckCircle2, Clock, 
  Trash2, AlertTriangle, User, Car
} from 'lucide-react';
import {
  fetchInquiryByIdApi,
  deleteInquiryApi,
  updateInquiryStatusApi,
  rescheduleInquiryApi
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatStatus } from '../../utils/formatStatus';

const STATUS_STYLES: Record<string, string> = {
  'pending': 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20',
  'confirmed': 'bg-green-500/10 text-green-500 border border-green-500/20',
  'in-progress': 'bg-blue-500/10 text-blue-500 border border-blue-500/20',
  'completed': 'bg-purple-500/10 text-purple-500 border border-purple-500/20',
  'cancelled': 'bg-red-500/10 text-red-500 border border-red-500/20',
};

const STATUS_DOT: Record<string, string> = {
  'pending': 'bg-yellow-500',
  'confirmed': 'bg-green-500',
  'in-progress': 'bg-blue-500',
  'completed': 'bg-purple-500',
  'cancelled': 'bg-red-500',
};

type Inquiry = {
  id: string;
  fullName: string;
  contactNumber: string;
  emailAddress: string;
  facebookName: string;
  plateNumber?: string;
  appointmentDate: string;
  appointmentTime: string;
  make: string;
  model: string;
  year?: string;
  productToPurchase: string;
  status: string;
};

interface Props {
  inquiryId: string;
  onBack: () => void;
}

export default function AdminInquiryDetail({ inquiryId, onBack }: Props) {
  const { token } = useAuth();
  const { showToast } = useToast();
  
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [scheduleLoading, setScheduleLoading] = useState(false);
  
  const [isDeleting, setIsDeleting] = useState(false);
  
  const id = inquiryId.replace('inq-', '');

  useEffect(() => {
    let active = true;
    const fetchInquiry = async () => {
      if (!token) return;
      try {
        setLoading(true);
        const res = await fetchInquiryByIdApi(token, String(id));
        if (active) setInquiry(res.inquiry);
      } catch (err) {
        if (active) setError((err as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchInquiry();
    return () => { active = false; };
  }, [token, id]);

  const handleStatusChange = async (newStatus: string) => {
    if (!token || !inquiry) return;
    setStatusLoading(true);
    setShowStatusMenu(false);
    try {
      const res = await updateInquiryStatusApi(token, inquiry.id, newStatus);
      setInquiry({ ...inquiry, status: res.inquiry.status });
      showToast('Status updated.', 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleReschedule = async () => {
    if (!token || !inquiry) return;
    if (!editDate || !editTime) {
      showToast('Date and time are required.', 'error');
      return;
    }
    setScheduleLoading(true);
    try {
      await rescheduleInquiryApi(token, inquiry.id, editDate, editTime);
      setInquiry({ ...inquiry, appointmentDate: editDate, appointmentTime: editTime });
      setIsEditingSchedule(false);
      showToast('Inquiry rescheduled.', 'success');
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!token || !inquiry) return;
    if (!window.confirm('Are you sure you want to delete this inquiry?')) return;
    setIsDeleting(true);
    try {
      await deleteInquiryApi(token, inquiry.id);
      showToast('Inquiry deleted.', 'success');
      onBack();
    } catch (err) {
      showToast((err as Error).message, 'error');
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-brand-orange">
          <Clock className="w-8 h-8 animate-spin" />
          <p className="text-sm font-semibold uppercase tracking-widest">Loading Inquiry Details...</p>
        </div>
      </div>
    );
  }

  if (error || !inquiry) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-red-400 bg-red-500/10 px-8 py-6 rounded border border-red-500/20 text-center">
          <AlertTriangle className="w-10 h-10" />
          <p className="text-sm font-semibold">{error || 'Inquiry not found'}</p>
          <button onClick={onBack} className="mt-4 text-xs underline hover:text-white">Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div>
          <button 
            onClick={onBack} 
            className="group flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" /> Back to Appointments
          </button>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-white uppercase tracking-wider flex items-center gap-3">
            Inquiry <span className="text-gray-500">#{inquiry.id.substring(0, 8)}</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1 flex items-center gap-2">
            Submitted by {inquiry.fullName}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Status Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              disabled={statusLoading}
              className={`flex items-center gap-2 px-4 py-2 rounded font-bold uppercase tracking-widest text-xs transition-colors ${STATUS_STYLES[inquiry.status] || 'bg-gray-800 text-gray-300'}`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {statusLoading ? 'Updating...' : formatStatus(inquiry.status as any)}
            </button>
            
            {showStatusMenu && (
              <div className="absolute right-0 mt-2 w-48 rounded border border-gray-700 bg-gray-800 shadow-xl z-50 overflow-hidden">
                {['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={`w-full text-left px-4 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${s === inquiry.status ? 'bg-black/40 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'} flex items-center gap-2`}
                  >
                    <span className={`w-2 h-2 rounded-full ${STATUS_DOT[s] || 'bg-gray-500'}`} />
                    {formatStatus(s as any)}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-2 px-4 py-2 rounded font-bold uppercase tracking-widest text-xs text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & Vehicle Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-black/20 border border-gray-800 p-6 rounded relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <User className="w-24 h-24" />
              </div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-brand-orange" /> Client Details
              </h3>
              <div className="space-y-3 relative z-10">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">Full Name</p>
                  <p className="text-white font-medium">{inquiry.fullName}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">Email Address</p>
                  <p className="text-white font-medium">{inquiry.emailAddress || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">Contact Number</p>
                  <p className="text-white font-medium">{inquiry.contactNumber || 'N/A'}</p>
                </div>
                {inquiry.facebookName && (
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">Facebook Name</p>
                    <p className="text-white font-medium">{inquiry.facebookName}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-black/20 border border-gray-800 p-6 rounded relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-5">
                <Car className="w-24 h-24" />
              </div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Car className="w-4 h-4 text-brand-orange" /> Vehicle Info
              </h3>
              <div className="space-y-3 relative z-10">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">Make & Model</p>
                  <p className="text-white font-medium">{inquiry.make} {inquiry.model} {inquiry.year || ''}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">Plate Number</p>
                  <p className="text-white font-medium">{inquiry.plateNumber || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">Product / Service</p>
                  <p className="text-brand-orange font-bold uppercase tracking-wider text-sm mt-1">{inquiry.productToPurchase || 'Service inquiry'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Schedule */}
        <div className="space-y-6">
          <div className="bg-black/20 border border-gray-800 p-6 rounded">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand-orange" /> Schedule
              </div>
              {!isEditingSchedule && (
                <button 
                  onClick={() => {
                    setEditDate(inquiry.appointmentDate);
                    setEditTime(inquiry.appointmentTime);
                    setIsEditingSchedule(true);
                  }}
                  className="text-brand-orange hover:text-white transition-colors"
                >
                  Edit
                </button>
              )}
            </h3>
            
            {!isEditingSchedule ? (
              <div className="bg-gray-900/50 rounded border border-gray-800 p-4 text-center">
                <p className="text-2xl font-display font-bold text-white mb-1">
                  {inquiry.appointmentDate}
                </p>
                <p className="text-brand-orange font-bold uppercase tracking-widest">
                  {inquiry.appointmentTime}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-mono mb-1">Date</label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                    className="w-full bg-black/40 border border-gray-700 rounded px-3 py-2 text-white focus:border-brand-orange focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-mono mb-1">Time</label>
                  <select
                    value={editTime}
                    onChange={e => setEditTime(e.target.value)}
                    className="w-full bg-black/40 border border-gray-700 rounded px-3 py-2 text-white focus:border-brand-orange focus:outline-none"
                  >
                    <option value="" disabled>Select a time</option>
                    <option value="09:00 AM">09:00 AM</option>
                    <option value="10:00 AM">10:00 AM</option>
                    <option value="11:00 AM">11:00 AM</option>
                    <option value="12:00 PM">12:00 PM</option>
                    <option value="01:00 PM">01:00 PM</option>
                    <option value="02:00 PM">02:00 PM</option>
                    <option value="03:00 PM">03:00 PM</option>
                    <option value="04:00 PM">04:00 PM</option>
                    <option value="05:00 PM">05:00 PM</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditingSchedule(false)}
                    className="flex-1 px-3 py-2 rounded text-xs font-bold uppercase tracking-widest border border-gray-700 text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReschedule}
                    disabled={scheduleLoading}
                    className="flex-1 px-3 py-2 rounded text-xs font-bold uppercase tracking-widest bg-brand-orange text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
                  >
                    {scheduleLoading ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
