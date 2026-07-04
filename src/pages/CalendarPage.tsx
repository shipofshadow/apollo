import { useEffect, useMemo, useState } from 'react';
import PageSEO from '../components/PageSEO';
import CustomCalendar from '../components/CustomCalendar';
import { useAuth } from '../context/AuthContext';
import { BACKEND_URL } from '../config';

// FontAwesome Icons
import { 
  FaCalendarAlt, 
  FaClock, 
  FaCar, 
  FaUser, 
  FaPhone, 
  FaEnvelope, 
  FaWrench, 
  FaCheckCircle, 
  FaSpinner 
} from 'react-icons/fa';

interface InquiryEvent {
  id: string;
  fullName: string;
  appointmentDate: string;
  appointmentTime: string;
  make: string;
  model: string;
  year?: string | number; // Added Year
  productToPurchase: string;
  status: string;
  contactNumber?: string;
  emailAddress?: string;
  facebookName?: string;
}

interface CalendarEvent extends InquiryEvent {
  title: string;
  orderLabel: string;
}

// Machine-readable format for logical operations
const formatDateYMD = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Human-readable format for the UI
const formatHumanDate = (date: Date | null) => {
  if (!date) return 'None';
  return new Intl.DateTimeFormat('en-US', { 
    weekday: 'long', 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  }).format(date);
};

const formatAppointmentTime = (value?: string | null) => {
  if (!value) {
    return { time: '--:--', suffix: '' };
  }

  const normalized = String(value).trim();
  const match = normalized.match(/^(\d{1,2}:\d{2})(?:\s*([ap]\.?m\.?))?$/i);

  if (!match) {
    return { time: normalized, suffix: '' };
  }

  const [, time, meridiem] = match;
  const suffix = meridiem ? meridiem.replace(/\./g, '').toUpperCase() : '';

  return { time, suffix };
};

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case 'pending': return 'text-brand-orange bg-brand-orange/10 border-brand-orange/20';
    case 'confirmed': return 'text-sky-400 bg-sky-400/10 border-sky-400/20';
    case 'completed': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    case 'cancelled': return 'text-red-400 bg-red-400/10 border-red-400/20';
    default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
  }
};

export default function CalendarPage() {
  const { token, hasPermission } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEvents() {
      if (!BACKEND_URL) {
        setError('Backend URL is not configured.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${BACKEND_URL}/api/inquiries/calendar`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || 'Unable to load calendar events.');
        }

        const normalized = (data.events ?? []) as InquiryEvent[];
        const mapped = normalized.map((event) => ({
          ...event,
          title: `${event.year ? event.year + ' ' : ''}${event.make} ${event.model} @ ${event.appointmentTime}`,
          orderLabel: event.productToPurchase || 'Service order',
        }));

        setEvents(mapped);
        if (mapped.length > 0) {
          setSelectedDate(new Date(mapped[0].appointmentDate));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load calendar events.');
      } finally {
        setLoading(false);
      }
    }

    loadEvents();
  }, []);

  const availableDates = useMemo(() => {
    const unique = Array.from(new Set(events.map((event) => event.appointmentDate)));
    unique.sort();
    return unique.map((date) => new Date(date));
  }, [events]);

  const closedDatesSet = useMemo(() => new Set<string>(), []);

  const slotCounts = useMemo(() => {
    return events.reduce<Record<string, number>>((acc, event) => {
      const key = event.appointmentDate;
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  }, [events]);

  const statusCounts = useMemo(() => {
    const counts = { pending: 0, confirmed: 0, completed: 0, cancelled: 0 } as Record<string, number>;
    events.forEach((event) => {
      const key = event.status.toLowerCase();
      if (counts[key] !== undefined) counts[key] += 1;
    });
    return counts;
  }, [events]);

  const totalEvents = events.length;
  const selectedDateKey = selectedDate ? formatDateYMD(selectedDate) : '';

  const eventsForSelectedDate = useMemo(
    () => (selectedDateKey ? events.filter((event) => event.appointmentDate === selectedDateKey) : []),
    [events, selectedDateKey]
  );

  const canManage = hasPermission('bookings:manage');

  const changeStatus = async (id: string, status: string) => {
    if (!token) return;

    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/inquiries/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error((result as { detail?: string } | null)?.detail || 'Unable to update status.');
      }

      setEvents((prev) => prev.map((event) => (event.id === id ? { ...event, status } : event)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update status.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-dark pt-24 pb-12 px-4 sm:px-6 lg:px-8 font-sans text-gray-200">
      <PageSEO title="Calendar | 1625 Autolab" description="View scheduled inquiry appointments in a calendar layout." />

      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-white flex items-center gap-3">
              <FaCalendarAlt className="text-brand-orange text-3xl" />
              Schedule Dashboard
            </h1>
            <p className="text-sm text-gray-400 mt-2 font-medium">Manage incoming inquiries and service appointments.</p>
          </div>
        </div>

        {/* Quick Stats - Enhanced with Icons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800/40 rounded-2xl border border-gray-700/50 p-5 flex flex-col justify-between shadow-sm">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <FaCar /> Total
              </span>
              <span className="text-3xl font-black text-white mt-3">{totalEvents}</span>
            </div>
            <div className="bg-gray-800/40 rounded-2xl border border-gray-700/50 p-5 flex flex-col justify-between shadow-sm">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <FaSpinner className="text-brand-orange" /> Pending
              </span>
              <span className="text-3xl font-black text-brand-orange mt-3">{statusCounts.pending}</span>
            </div>
            <div className="bg-gray-800/40 rounded-2xl border border-gray-700/50 p-5 flex flex-col justify-between shadow-sm">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <FaCheckCircle className="text-sky-400" /> Confirmed
              </span>
              <span className="text-3xl font-black text-sky-400 mt-3">{statusCounts.confirmed}</span>
            </div>
            <div className="bg-gray-800/40 rounded-2xl border border-gray-700/50 p-5 flex flex-col justify-between shadow-sm">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <FaCalendarAlt /> Selected Date
              </span>
              <span className="text-lg font-bold text-white mt-3 leading-tight">
                {formatHumanDate(selectedDate)}
              </span>
            </div>
        </div>

        {/* Main Grid: Calendar & Schedule */}
        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-8">
          
          {/* Calendar Sidebar */}
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-3xl p-6 h-fit shadow-xl">
            <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
              <FaCalendarAlt /> Pick a Date
            </h2>
            {loading ? (
              <div className="animate-pulse h-64 bg-gray-800 rounded-xl"></div>
            ) : error ? (
              <p className="text-sm text-red-400 bg-red-400/10 p-3 rounded-lg border border-red-400/20">{error}</p>
            ) : availableDates.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No appointments scheduled.</p>
            ) : (
              <div className="calendar-wrapper">
                <CustomCalendar
                  value={selectedDate}
                  onChange={setSelectedDate}
                  availableDates={availableDates}
                  closedDatesSet={closedDatesSet}
                  slotCounts={slotCounts}
                  showAvailabilityIndicators={false}
                />
              </div>
            )}
          </div>

          {/* Daily Schedule List */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-gray-800">
              <h2 className="text-2xl font-black text-white tracking-tight">
                {selectedDate ? formatHumanDate(selectedDate) : 'Appointments'}
              </h2>
              <span className="text-sm font-bold px-4 py-1.5 bg-gray-800 rounded-lg text-gray-300 shadow-sm border border-gray-700">
                {eventsForSelectedDate.length} {eventsForSelectedDate.length === 1 ? 'Slot' : 'Slots'}
              </span>
            </div>

            {loading ? (
              <div className="space-y-4">
                {[1, 2].map(i => <div key={i} className="animate-pulse h-32 bg-gray-800/40 rounded-2xl border border-gray-700/50"></div>)}
              </div>
            ) : !selectedDate ? (
              <div className="text-center py-16 border-2 border-dashed border-gray-700 rounded-3xl bg-gray-800/20">
                <FaCalendarAlt className="mx-auto text-4xl text-gray-600 mb-4" />
                <p className="text-gray-400 font-medium">Pick a date from the calendar to view the schedule.</p>
              </div>
            ) : eventsForSelectedDate.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-gray-700 rounded-3xl bg-gray-800/20">
                <FaCar className="mx-auto text-4xl text-gray-600 mb-4" />
                <p className="text-gray-400 font-medium">The shop floor is clear. No bookings for this date.</p>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                {eventsForSelectedDate.map((event) => (
                  <div key={event.id} className="group flex flex-col sm:flex-row gap-5 bg-gray-800/40 border border-gray-700/50 hover:border-brand-orange/50 rounded-2xl p-5 transition-all shadow-md">
                    
                    {/* Time Block - Highly Visible */}
                    <div className="flex sm:flex-col items-center justify-center gap-2 sm:gap-0 min-w-[120px] bg-gray-900 rounded-xl p-4 border border-gray-700 shrink-0">
                      <FaClock className="text-brand-orange mb-1 text-xl hidden sm:block" />
                      <span className="text-2xl font-black text-white">
                        {formatAppointmentTime(event.appointmentTime).time}
                      </span>
                      {formatAppointmentTime(event.appointmentTime).suffix && (
                        <span className="text-sm font-bold text-brand-orange uppercase">
                          {formatAppointmentTime(event.appointmentTime).suffix}
                        </span>
                      )}
                    </div>

                    {/* Details Block */}
                    <div className="flex-1 flex flex-col justify-center">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                        <div>
                          {/* Emphasize the Car */}
                          <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                            {event.year && <span className="text-brand-orange">{event.year}</span>}
                            {event.make} {event.model}
                          </h3>
                          {/* Service Type */}
                          <p className="text-sm text-gray-400 font-bold mt-1 flex items-center gap-2">
                            <FaWrench className="text-gray-500" />
                            {event.orderLabel}
                          </p>
                        </div>
                        
                        {/* Mobile-friendly Status/Actions */}
                        <div className="shrink-0 mt-2 sm:mt-0">
                          {canManage ? (
                            <select
                              value={event.status}
                              onChange={(e) => changeStatus(event.id, e.target.value)}
                              className={`w-full sm:w-auto border rounded-lg px-3 py-1.5 text-sm font-bold uppercase tracking-wider focus:ring-2 focus:ring-brand-orange outline-none cursor-pointer appearance-none ${getStatusColor(event.status)}`}
                            >
                              <option value="pending">Pending</option>
                              <option value="confirmed">Confirmed</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          ) : (
                            <span className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border ${getStatusColor(event.status)}`}>
                              {event.status}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Contact Info Footer - Clear and Icon-driven */}
                      <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm mt-3 pt-3 border-t border-gray-700/50">
                        <div className="flex items-center gap-2">
                          <FaUser className="text-gray-500" />
                          <span className="text-gray-300 font-medium">{event.fullName}</span>
                        </div>
                        {event.contactNumber && (
                          <div className="flex items-center gap-2">
                            <FaPhone className="text-gray-500" />
                            <span className="text-gray-300">{event.contactNumber}</span>
                          </div>
                        )}
                        {event.emailAddress && (
                          <div className="flex items-center gap-2">
                            <FaEnvelope className="text-gray-500" />
                            <span className="text-gray-300 truncate max-w-[200px]">{event.emailAddress}</span>
                          </div>
                        )}
                      </div>
                    </div>
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