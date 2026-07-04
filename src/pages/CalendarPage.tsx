import { useEffect, useMemo, useState } from 'react';
import PageSEO from '../components/PageSEO';
import CustomCalendar from '../components/CustomCalendar';
import { useAuth } from '../context/AuthContext';
import { BACKEND_URL } from '../config';

interface InquiryEvent {
  id: string;
  fullName: string;
  appointmentDate: string;
  appointmentTime: string;
  make: string;
  model: string;
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

const formatDateYMD = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
          title: `${event.make} ${event.model} @ ${event.appointmentTime}`,
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
    <div className="min-h-screen bg-brand-dark pt-24 pb-12 px-4 sm:px-6 lg:px-8">
      <PageSEO title="Calendar | 1625 Autolab" description="View scheduled inquiry appointments in a calendar layout." />

      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-white mb-4">
            Appointment <span className="text-brand-orange">Calendar</span>
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Browse upcoming inquiries and scheduled appointment slots.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl shadow-xl p-6">
            <h2 className="text-lg font-bold text-white mb-4">Booking Calendar</h2>
            {loading ? (
              <p className="text-gray-400">Loading calendar…</p>
            ) : error ? (
              <p className="text-red-400">{error}</p>
            ) : availableDates.length === 0 ? (
              <p className="text-gray-400">No appointments scheduled yet.</p>
            ) : (
              <CustomCalendar
                value={selectedDate}
                onChange={setSelectedDate}
                availableDates={availableDates}
                closedDatesSet={closedDatesSet}
                slotCounts={slotCounts}
                showAvailabilityIndicators={false}
              />
            )}
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-3xl shadow-xl p-6">
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-lg font-bold text-white">Appointments</h2>
                <p className="text-sm text-gray-400 mt-1">
                  {selectedDate
                    ? `Showing appointments for ${selectedDate.toLocaleDateString()}`
                    : 'Select a date from the calendar to view scheduled appointments.'}
                </p>
              </div>

              {loading ? (
                <p className="text-gray-400">Loading events…</p>
              ) : error ? (
                <p className="text-red-400">{error}</p>
              ) : selectedDate === null ? (
                <p className="text-gray-400">Select a date from the calendar above.</p>
              ) : eventsForSelectedDate.length === 0 ? (
                <p className="text-gray-400">No appointments booked for this date.</p>
              ) : (
                <div className="space-y-4">
                  {eventsForSelectedDate.map((event) => (
                    <article key={event.id} className="rounded-3xl border border-gray-800 bg-gray-950 p-5">
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="text-sm uppercase tracking-[0.22em] text-brand-orange">{event.status}</span>
                          <span className="text-sm text-gray-400">{event.appointmentTime}</span>
                        </div>
                        <h3 className="text-xl font-semibold text-white">{event.make} {event.model}</h3>
                        <p className="text-gray-300">Order: {event.orderLabel}</p>
                        <div className="grid grid-cols-1 gap-3 text-sm text-gray-400 pt-3 sm:grid-cols-2">
                          <div>
                            <span className="block font-semibold text-white">Customer</span>
                            <span>{event.fullName}</span>
                          </div>
                          <div>
                            <span className="block font-semibold text-white">Contact</span>
                            <span>{event.contactNumber || 'No phone provided'}</span>
                          </div>
                          <div>
                            <span className="block font-semibold text-white">Email</span>
                            <span>{event.emailAddress || 'No email provided'}</span>
                          </div>
                          <div>
                            <span className="block font-semibold text-white">Date</span>
                            <span>{new Date(event.appointmentDate).toLocaleDateString()}</span>
                          </div>
                        </div>
                        {canManage ? (
                          <div className="pt-3">
                            <label htmlFor={`status-${event.id}`} className="block text-sm font-medium text-gray-300">Update Status</label>
                            <select
                              id={`status-${event.id}`}
                              value={event.status}
                              onChange={(e) => changeStatus(event.id, e.target.value)}
                              className="mt-2 w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-brand-orange focus:border-transparent transition-colors"
                            >
                              <option value="pending">Pending</option>
                              <option value="confirmed">Confirmed</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
