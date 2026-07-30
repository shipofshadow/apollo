import { useEffect, useState } from 'react';
import {
  ArrowLeft, CheckCircle2, Clock, 
  Trash2, AlertTriangle, User, Car, Activity,
  ChevronLeft, ChevronRight, ChevronDown, Calendar
} from 'lucide-react';
import {
  fetchInquiryByIdApi,
  deleteInquiryApi,
  updateInquiryStatusApi,
  rescheduleInquiryApi,
  fetchInquiryActivityApi,
  fetchInquiryAvailabilityApi
} from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { formatStatus } from '../../utils/formatStatus';

const STATUS_STYLES: Record<string, string> = {
  'pending': 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20',
  'confirmed': 'bg-green-500/10 text-green-500 border border-green-500/20',
  'in_progress': 'bg-blue-500/10 text-blue-500 border border-blue-500/20',
  'completed': 'bg-purple-500/10 text-purple-500 border border-purple-500/20',
  'cancelled': 'bg-red-500/10 text-red-500 border border-red-500/20',
};

const STATUS_DOT: Record<string, string> = {
  'pending': 'bg-yellow-500',
  'confirmed': 'bg-green-500',
  'in_progress': 'bg-blue-500',
  'completed': 'bg-purple-500',
  'cancelled': 'bg-red-500',
};

type InquiryActivityLog = {
  id: number;
  action: string;
  detail: string | null;
  createdAt: string;
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
  const [activityLogs, setActivityLogs] = useState<InquiryActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());

  const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
  const daysInMo = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMo }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => {
    if (calendarMonth === 0) { setCalendarYear(y => y - 1); setCalendarMonth(11); }
    else setCalendarMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calendarMonth === 11) { setCalendarYear(y => y + 1); setCalendarMonth(0); }
    else setCalendarMonth(m => m + 1);
  };

  const [isDeleting, setIsDeleting] = useState(false);
  
  const id = inquiryId.replace('inq-', '');

  const fetchData = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [res, activitiesRes] = await Promise.all([
        fetchInquiryByIdApi(token, String(id)),
        fetchInquiryActivityApi(token, String(id))
      ]);
      setInquiry((res as { inquiry: Inquiry }).inquiry);
      setActivityLogs((activitiesRes as InquiryActivityLog[]) || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  const handleStatusChange = async (newStatus: string) => {
    if (!token || !inquiry) return;
    setStatusLoading(true);
    setShowStatusMenu(false);
    try {
      const res = await updateInquiryStatusApi(token, inquiry.id, newStatus);
      setInquiry({ ...inquiry, status: res.inquiry.status });
      showToast('Status updated.', 'success');
      // Refresh activities
      const activitiesRes = await fetchInquiryActivityApi(token, String(id));
      setActivityLogs(activitiesRes as InquiryActivityLog[]);
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleDateChange = async (newDate: string) => {
    setEditDate(newDate);
    setEditTime('');
    if (!newDate) {
      setAvailableSlots([]);
      return;
    }
    setSlotsLoading(true);
    try {
      const res = await fetchInquiryAvailabilityApi(newDate);
      const slots = res.availableSlots.filter((slot: string) => !res.bookedSlots.includes(slot));
      setAvailableSlots(slots);
    } catch (err) {
      console.error(err);
      showToast('Failed to load slots.', 'error');
    } finally {
      setSlotsLoading(false);
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
      // Refresh activities
      const activitiesRes = await fetchInquiryActivityApi(token, String(id));
      setActivityLogs(activitiesRes as InquiryActivityLog[]);
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
        <div className="flex flex-col items-center gap-3 text-red-400 bg-red-500/10 px-8 py-6 rounded-lg border border-red-500/20 text-center shadow-lg">
          <AlertTriangle className="w-10 h-10" />
          <p className="text-sm font-semibold">{error || 'Inquiry not found'}</p>
          <button onClick={onBack} className="mt-4 text-xs font-bold uppercase tracking-widest underline hover:text-white transition-colors">Go Back</button>
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
          <h1 className="text-2xl md:text-4xl font-display font-black text-white uppercase tracking-tight flex items-center gap-3">
            Inquiry <span className="text-gray-500/50">#{inquiry.id.substring(0, 8)}</span>
          </h1>
          <p className="text-gray-400 text-sm mt-2 flex items-center gap-2 font-medium">
            Submitted by <span className="text-white">{inquiry.fullName}</span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Status Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowStatusMenu(!showStatusMenu)}
              disabled={statusLoading}
              className={`w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-sm font-bold uppercase tracking-widest text-xs transition-colors shadow-sm ${STATUS_STYLES[inquiry.status] || 'bg-gray-800 text-gray-300'}`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{statusLoading ? 'Updating...' : formatStatus(inquiry.status as any)}</span>
              <ChevronDown className={`w-4 h-4 shrink-0 opacity-70 transition-transform ${showStatusMenu ? 'rotate-180' : ''}`} />
            </button>
            
            {showStatusMenu && (
              <div className="absolute right-0 sm:right-auto sm:left-0 mt-2 w-48 rounded-sm border border-gray-700 bg-[#121212] shadow-2xl z-50 overflow-hidden">
                {['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'].map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStatusChange(s)}
                    className={`w-full text-left px-4 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${s === inquiry.status ? 'bg-black/40 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'} flex items-center gap-2`}
                  >
                    <span className={`w-2 h-2 rounded-full shadow-sm ${STATUS_DOT[s] || 'bg-gray-500'}`} />
                    {formatStatus(s as any)}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-sm font-bold uppercase tracking-widest text-xs text-red-400 bg-red-500/5 border border-red-500/20 hover:bg-red-500/20 transition-colors shadow-sm"
          >
            <Trash2 className="w-4 h-4" />
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Details */}
        <div className="lg:col-span-8 space-y-8">
          {/* Customer & Vehicle Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-[#121212] border border-gray-800/80 p-8 rounded-lg relative overflow-hidden shadow-xl">
              <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
                <User className="w-32 h-32" />
              </div>
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-gray-800/80 pb-4">
                <User className="w-4 h-4 text-brand-orange" /> Client Details
              </h3>
              <div className="space-y-5 relative z-10">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Full Name</p>
                  <p className="text-white font-medium text-sm">{inquiry.fullName}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Email Address</p>
                  <p className="text-white font-medium text-sm">{inquiry.emailAddress || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Contact Number</p>
                  <p className="text-white font-medium text-sm">{inquiry.contactNumber || 'N/A'}</p>
                </div>
                {inquiry.facebookName && (
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Facebook Name</p>
                    <p className="text-white font-medium text-sm">{inquiry.facebookName}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[#121212] border border-gray-800/80 p-8 rounded-lg relative overflow-hidden shadow-xl">
              <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
                <Car className="w-32 h-32" />
              </div>
              <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-2 border-b border-gray-800/80 pb-4">
                <Car className="w-4 h-4 text-brand-orange" /> Vehicle Info
              </h3>
              <div className="space-y-5 relative z-10">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Make & Model</p>
                  <p className="text-white font-medium text-sm">{inquiry.make} {inquiry.model} {inquiry.year || ''}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono mb-1">Plate Number</p>
                  <p className="text-white font-medium text-sm uppercase">{inquiry.plateNumber || 'N/A'}</p>
                </div>
                <div className="bg-brand-orange/5 border border-brand-orange/20 rounded p-4 mt-2">
                  <p className="text-[10px] text-brand-orange/80 uppercase tracking-widest font-mono mb-1">Product / Service</p>
                  <p className="text-brand-orange font-bold text-sm leading-relaxed">{inquiry.productToPurchase || 'Service inquiry'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Schedule & Timeline */}
        <div className="lg:col-span-4 space-y-8">
          <div className="bg-black/40 border border-brand-orange/20 p-8 rounded-lg shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-orange/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
            
            <h3 className="text-[10px] font-bold text-brand-orange uppercase tracking-widest mb-6 flex items-center justify-between border-b border-gray-800/80 pb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" /> Schedule
              </div>
            </h3>
            
            {!isEditingSchedule ? (
              <div className="bg-[#121212] rounded-md border border-gray-800/80 p-6 text-center shadow-inner flex flex-col items-center">
                <p className="text-3xl font-display font-black text-white tracking-tight mb-2">
                  {inquiry.appointmentDate 
                    ? new Date(inquiry.appointmentDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                    : 'No Date'}
                </p>
                <p className="text-brand-orange font-bold uppercase tracking-widest text-sm mb-6">
                  {inquiry.appointmentTime 
                    ? inquiry.appointmentTime
                    : 'No Time'}
                </p>
                <button 
                  onClick={() => {
                    handleDateChange(inquiry.appointmentDate);
                    setEditTime(inquiry.appointmentTime);
                    setIsEditingSchedule(true);
                    if (inquiry.appointmentDate) {
                      const d = new Date(inquiry.appointmentDate + 'T00:00:00');
                      setCalendarYear(d.getFullYear());
                      setCalendarMonth(d.getMonth());
                    }
                  }}
                  className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-sm font-bold uppercase tracking-widest text-xs text-brand-orange border border-brand-orange/30 hover:bg-brand-orange hover:text-white transition-colors"
                >
                  <Calendar className="w-4 h-4" />
                  Reschedule
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-mono mb-2">Date</label>
                  <div className="bg-[#121212] border border-gray-700 rounded-sm overflow-hidden">
                    <div className="flex items-center justify-between p-3 border-b border-gray-700">
                      <button onClick={prevMonth} className="p-1 hover:text-brand-orange text-gray-400 transition-colors"><ChevronLeft className="w-4 h-4"/></button>
                      <span className="text-xs font-bold uppercase tracking-widest text-white">
                        {new Date(calendarYear, calendarMonth).toLocaleString('default', { month: 'long' })} {calendarYear}
                      </span>
                      <button onClick={nextMonth} className="p-1 hover:text-brand-orange text-gray-400 transition-colors"><ChevronRight className="w-4 h-4"/></button>
                    </div>
                    <div className="grid grid-cols-7 border-b border-gray-700 bg-black/20">
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                        <div key={d} className="py-2 text-center text-[10px] font-bold text-gray-500 uppercase">{d}</div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 p-2 gap-1">
                      {cells.map((day, i) => {
                        if (!day) return <div key={`empty-${i}`} />;
                        const dateIso = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const isSelected = dateIso === editDate;
                        const isPast = new Date(dateIso + 'T00:00:00') < new Date(new Date().setHours(0,0,0,0));
                        return (
                          <button
                            key={i}
                            disabled={isPast}
                            onClick={() => handleDateChange(dateIso)}
                            className={`h-8 w-full rounded flex items-center justify-center text-xs font-bold transition-colors ${
                              isSelected ? 'bg-brand-orange text-white shadow-md shadow-brand-orange/20' : 
                              isPast ? 'text-gray-700 cursor-not-allowed opacity-50' : 
                              'text-gray-300 hover:bg-gray-800'
                            }`}
                          >
                            {day}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-500 font-mono mb-2 flex justify-between">
                    <span>Time</span>
                    {slotsLoading && <span className="text-brand-orange animate-pulse">Loading slots...</span>}
                  </label>
                  <select
                    value={editTime}
                    onChange={e => setEditTime(e.target.value)}
                    disabled={!editDate || slotsLoading}
                    className="w-full bg-[#121212] border border-gray-700 rounded-sm px-4 py-3 text-sm text-white focus:border-brand-orange focus:ring-1 focus:ring-brand-orange outline-none transition-all disabled:opacity-50"
                  >
                    <option value="" disabled>Select a time</option>
                    {availableSlots.length === 0 && !slotsLoading && editDate && (
                      <option value="" disabled>No slots available</option>
                    )}
                    {availableSlots.map(slot => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setIsEditingSchedule(false)}
                    className="flex-1 px-4 py-3 rounded-sm text-xs font-bold uppercase tracking-widest border border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReschedule}
                    disabled={scheduleLoading || !editDate || !editTime}
                    className="flex-1 px-4 py-3 rounded-sm text-xs font-bold uppercase tracking-widest bg-brand-orange text-white hover:bg-orange-600 transition-colors shadow-lg shadow-brand-orange/20 disabled:opacity-50"
                  >
                    {scheduleLoading ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Activity Timeline */}
          <div className="bg-[#121212] border border-gray-800/80 rounded-lg p-8 shadow-xl">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-6 flex items-center gap-2 border-b border-gray-800/80 pb-4">
              <Activity className="w-4 h-4 text-brand-orange" /> Activity Log
            </p>
            {activityLogs.length === 0 ? (
              <p className="text-gray-600 text-xs font-mono text-center py-4">No activity recorded.</p>
            ) : (
              <div className="space-y-5 font-mono">
                {activityLogs.slice().reverse().map((entry) => (
                  <div key={entry.id} className="border-b border-gray-800/40 pb-4 last:border-0 last:pb-0">
                    <p className="text-[10px] text-brand-orange mb-1.5">
                      {new Date(entry.createdAt).toISOString().replace('T', ' ').substring(0, 19)}
                    </p>
                    <p className="text-xs text-gray-300 uppercase font-bold tracking-wide"> {entry.action}</p>
                    {entry.detail && (
                      <p className="text-[11px] text-gray-500 mt-2 pl-3 border-l-2 border-gray-700 leading-relaxed">{entry.detail}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
