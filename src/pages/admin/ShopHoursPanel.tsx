import { useState, useEffect } from 'react';
import { Clock, Save, Loader2, AlertCircle, CheckCircle, Users, CalendarX, Trash2, PlusCircle } from 'lucide-react';
import { fetchShopHoursApi, updateShopHoursApi, fetchSiteSettingsApi, updateSiteSettingsApi, fetchShopClosedDatesApi, addShopClosedDateApi, removeShopClosedDateApi } from '../../services/api';
import type { ShopDayHours } from '../../types';
import { useAuth } from '../../context/AuthContext';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const SLOT_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3, 4];

/** Build a full 7-day schedule. Days missing from the API response get defaults. */
function buildDefaults(existing: ShopDayHours[]): ShopDayHours[] {
  const map = new Map(existing.map(h => [h.dayOfWeek, h]));
  return Array.from({ length: 7 }, (_, day) =>
    map.get(day) ?? {
      dayOfWeek:     day,
      isOpen:        day >= 1 && day <= 5, // Mon–Fri open by default; Sat/Sun closed
      openTime:      '09:00',
      closeTime:     day === 6 ? '15:00' : '18:00', // Saturday closes at 15:00; all other days at 18:00
      slotIntervalH: 2,
    }
  );
}

export default function ShopHoursPanel() {
  const { token } = useAuth();

  const [hours,           setHours]           = useState<ShopDayHours[]>([]);
  const [slotCapacity,    setSlotCapacity]    = useState(3);
  const [loading,         setLoading]         = useState(true);
  const [savingHours,     setSavingHours]     = useState(false);
  const [savingCapacity,  setSavingCapacity]  = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [saved,           setSaved]           = useState(false);

  // Holidays / special closures
  const [closedDates,     setClosedDates]     = useState<{ date: string; reason: string | null; isYearly: boolean }[]>([]);
  const [newClosureDate,  setNewClosureDate]  = useState('');
  const [newClosureReason, setNewClosureReason] = useState('');
  const [newClosureIsYearly, setNewClosureIsYearly] = useState(false);
  const [addingClosure,   setAddingClosure]   = useState(false);
  const [closureError,    setClosureError]    = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchShopHoursApi(),
      fetchSiteSettingsApi(),
      fetchShopClosedDatesApi(),
    ])
      .then(([{ hours: h }, { settings }, closureData]) => {
        setHours(buildDefaults(h));
        setSlotCapacity(Math.max(1, parseInt(settings.slot_capacity ?? '3', 10) || 3));
        setClosedDates((closureData as { closedDates: { date: string; reason: string | null; isYearly: boolean }[] }).closedDates ?? []);
      })
      .catch(e => {
        // If backend has no hours yet, use all-defaults gracefully
        setHours(buildDefaults([]));
        setError((e as Error).message);
      })
      .finally(() => setLoading(false));
  }, []);

  const updateDay = (day: number, patch: Partial<ShopDayHours>) => {
    setSaved(false);
    setHours(prev =>
      prev.map(h => h.dayOfWeek === day ? { ...h, ...patch } : h)
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSavingHours(true);
    setError(null);
    setSaved(false);
    try {
      const { hours: updated } = await updateShopHoursApi(token, hours);
      setHours(buildDefaults(updated));
      setSaved(true);
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Failed to save shop hours.');
    } finally {
      setSavingHours(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
    </div>
  );

  const openDayCount = hours.filter(h => h.isOpen).length;

  return (
    <div className="w-full max-w-7xl space-y-6 sm:space-y-8 px-3 sm:px-0">

      {/* ── Hero Header ───────────────────────────────────────────── */}
      <div className="relative">
        <div className="absolute -inset-x-6 -top-4 h-20 bg-brand-orange/5 blur-2xl rounded-sm pointer-events-none" />
        <div className="relative space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-orange">Admin Controls</span>
          <h2 className="text-xl sm:text-2xl font-display font-black text-white uppercase tracking-wide flex items-center gap-2 sm:gap-3">
            <Clock className="w-5 sm:w-6 h-5 sm:h-6 text-brand-orange" />
            Shop Hours &amp; Availability
          </h2>
          <p className="text-gray-400 text-xs sm:text-sm max-w-xl pt-1">
            Configure operating hours, booking slot capacity, and special closure dates. Changes take effect immediately on the booking calendar.
          </p>
        </div>
      </div>

      {/* ── Feedback banners ──────────────────────────────────────── */}
      {saved && !error && (
        <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 text-green-400 px-3 sm:px-4 py-3 rounded-sm text-xs sm:text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" /> Settings saved successfully.
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 px-3 sm:px-4 py-3 rounded-sm text-xs sm:text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* ── Two-Column Layout ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">

        {/* ── Left Column (Operating Hours) ────────────────────────── */}
        <div className="md:col-span-2 space-y-6 md:space-y-8">

      {/* ── Operating Hours ───────────────────────────────────────── */}
      <form onSubmit={handleSave}>
        <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">

          {/* Card header */}
          <div className="px-5 py-4 border-b border-gray-800 bg-brand-darker/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-orange shrink-0" />
              <h3 className="text-sm font-bold uppercase tracking-widest text-white">Operating Hours</h3>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-brand-darker border border-gray-700 text-gray-400 shrink-0">
              {openDayCount} / 7 days open
            </span>
          </div>

          {/* Column headers (desktop) */}
          <div className="hidden md:grid grid-cols-[120px_90px_1fr_1fr_120px] lg:grid-cols-[180px_110px_1fr_1fr_160px] gap-3 md:gap-4 px-3 md:px-5 py-2.5 border-b border-gray-800/60 bg-brand-darker/20 text-[9px] md:text-[10px]">
            {['Day', 'Status', 'Opens At', 'Closes At', 'Slot Interval'].map(col => (
              <span key={col} className="text-[10px] font-bold uppercase tracking-widest text-gray-600">{col}</span>
            ))}
          </div>

          {hours.map((day, idx) => (
            <div
              key={day.dayOfWeek}
              className={`px-3 md:px-5 py-3 md:py-4 transition-colors ${idx < hours.length - 1 ? 'border-b border-gray-800/60' : ''} ${
                day.isOpen ? '' : 'bg-brand-darker/10'
              }`}
            >
              {/* Mobile day label row */}
              <div className="md:hidden flex items-center justify-between mb-2 md:mb-3">
                <span className={`font-bold text-sm md:text-base ${day.isOpen ? 'text-white' : 'text-gray-500'}`}>
                  {DAY_NAMES[day.dayOfWeek]}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-widest ${
                  day.isOpen ? 'bg-brand-orange/15 text-brand-orange border border-brand-orange/30' : 'bg-gray-800 text-gray-600 border border-gray-700'
                }`}>
                  {day.isOpen ? 'Open' : 'Closed'}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-[120px_90px_1fr_1fr_120px] lg:grid-cols-[180px_110px_1fr_1fr_160px] gap-2 md:gap-3 lg:gap-4 items-center">

                {/* Day name (desktop) */}
                <span className={`hidden md:block font-semibold text-sm ${day.isOpen ? 'text-white' : 'text-gray-500'}`}>
                  {DAY_NAMES[day.dayOfWeek]}
                </span>

                {/* Toggle + status badge */}
                <div className="flex items-center gap-2.5 col-span-2 md:col-span-1">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={day.isOpen}
                    onClick={() => updateDay(day.dayOfWeek, { isOpen: !day.isOpen })}
                    className={`relative inline-flex w-10 h-5 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange ${
                      day.isOpen ? 'bg-brand-orange' : 'bg-gray-700'
                    }`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      day.isOpen ? 'translate-x-5' : 'translate-x-0'
                    }`} />
                  </button>
                  <span className={`text-[10px] font-bold uppercase tracking-widest hidden md:block ${
                    day.isOpen ? 'text-brand-orange' : 'text-gray-600'
                  }`}>
                    {day.isOpen ? 'Open' : 'Closed'}
                  </span>
                </div>

                {/* Opens At */}
                <div className="space-y-1">
                  <label className="md:hidden text-[10px] font-bold uppercase tracking-widest text-gray-500">Opens At</label>
                  <input
                    type="time"
                    value={day.openTime}
                    disabled={!day.isOpen}
                    onChange={e => updateDay(day.dayOfWeek, { openTime: e.target.value })}
                    className="w-full bg-brand-darker border border-gray-700 text-white px-2 md:px-3 py-2 focus:outline-none focus:border-brand-orange transition-colors rounded-sm text-xs md:text-sm disabled:opacity-30 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Closes At */}
                <div className="space-y-1">
                  <label className="md:hidden text-[10px] font-bold uppercase tracking-widest text-gray-500">Closes At</label>
                  <input
                    type="time"
                    value={day.closeTime}
                    disabled={!day.isOpen}
                    onChange={e => updateDay(day.dayOfWeek, { closeTime: e.target.value })}
                    className="w-full bg-brand-darker border border-gray-700 text-white px-2 md:px-3 py-2 focus:outline-none focus:border-brand-orange transition-colors rounded-sm text-xs md:text-sm disabled:opacity-30 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Slot Interval */}
                <div className="space-y-1 col-span-2 md:col-span-1">
                  <label className="md:hidden text-[10px] font-bold uppercase tracking-widest text-gray-500">Slot Interval</label>
                  <select
                    value={day.slotIntervalH}
                    disabled={!day.isOpen}
                    onChange={e => updateDay(day.dayOfWeek, { slotIntervalH: parseFloat(e.target.value) })}
                    className="w-full bg-brand-darker border border-gray-700 text-white px-2 md:px-3 py-2 focus:outline-none focus:border-brand-orange transition-colors rounded-sm text-xs md:text-sm appearance-none disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    {SLOT_OPTIONS.map(v => (
                      <option key={v} value={v}>
                        {v === 0.5 ? '30 min' : v === 1 ? '1 hr' : `${v} hrs`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}

          {/* Card footer save */}
          <div className="px-5 py-4 border-t border-gray-800 bg-brand-darker/20 flex justify-end">
            <button
              type="submit"
              disabled={savingHours}
            className="flex items-center gap-2 bg-brand-orange text-white px-5 md:px-7 py-2.5 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60 rounded-sm text-xs md:text-sm"
            >
              {savingHours ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {savingHours ? 'Saving…' : 'Save Hours'}
            </button>
          </div>
        </div>
      </form>
        </div>

        {/* ── Right Column (Capacity + Holidays) ───────────────────── */}
        <div className="lg:col-span-1 space-y-8">

      {/* ── Booking Capacity ──────────────────────────────────────── */}
      <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">

        {/* Card header */}
        <div className="px-3 md:px-5 py-3 md:py-4 border-b border-gray-800 bg-brand-darker/40 flex items-center gap-2">
          <Users className="w-4 h-4 text-brand-orange shrink-0" />
          <h3 className="text-xs md:text-sm font-bold uppercase tracking-widest text-white">Booking Capacity</h3>
        </div>

        <div className="p-3 md:p-5 space-y-4 md:space-y-5">
          <p className="text-gray-400 text-xs md:text-sm">
            Maximum number of customers that can book the same time slot. When a slot reaches this limit it is hidden from the booking page.
          </p>

          <div className="flex flex-wrap items-center gap-2 md:gap-4">
            {/* Grouped control */}
            <div className="flex items-center gap-2 md:gap-3 bg-brand-darker border border-gray-700 px-2 md:px-4 py-2 md:py-3 rounded-sm">
              <label htmlFor="slot-capacity" className="text-[9px] md:text-xs font-bold uppercase tracking-widest text-gray-500 shrink-0 whitespace-nowrap">
                Max per slot
              </label>
              <input
                id="slot-capacity"
                type="number"
                min={1}
                max={20}
                value={slotCapacity}
                onChange={e => { setSaved(false); setSlotCapacity(Math.max(1, parseInt(e.target.value, 10) || 1)); }}
                className="w-12 md:w-16 bg-transparent border-0 text-white text-center font-bold text-lg focus:outline-none"
              />
              <span className="text-[9px] md:text-xs text-gray-600 shrink-0">customers</span>
            </div>

            <button
              type="button"
              disabled={savingCapacity}
              onClick={async () => {
                if (!token) return;
                setSavingCapacity(true);
                setError(null);
                setSaved(false);
                try {
                  await updateSiteSettingsApi(token, { slot_capacity: String(slotCapacity) });
                  setSaved(true);
                } catch (err: unknown) {
                  setError((err as Error)?.message ?? 'Failed to save capacity.');
                } finally {
                  setSavingCapacity(false);
                }
              }}
              className="flex items-center gap-2 bg-brand-orange text-white px-7 py-2.5 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60 rounded-sm text-sm"
            >
              {savingCapacity ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {savingCapacity ? 'Saving…' : 'Save Capacity'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Holidays & Special Closures ───────────────────────────── */}
      <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">

        {/* Card header */}
        <div className="px-3 md:px-5 py-3 md:py-4 border-b border-gray-800 bg-brand-darker/40 flex items-center justify-between gap-2 md:gap-3">
          <div className="flex items-center gap-2">
            <CalendarX className="w-4 h-4 text-brand-orange shrink-0" />
            <h3 className="text-xs md:text-sm font-bold uppercase tracking-widest text-white">Holidays &amp; Special Closures</h3>
          </div>
          {closedDates.length > 0 && (
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-brand-darker border border-gray-700 text-gray-400 shrink-0">
              {closedDates.length}
            </span>
          )}
        </div>

        <div className="p-3 md:p-5 space-y-4 md:space-y-5">
          <p className="text-gray-400 text-xs md:text-sm">
            Mark specific dates as closed — public holidays, special events, or any day the shop won't be taking bookings. These dates are hidden from the booking calendar automatically.
          </p>

          {closureError && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 px-3 py-2 rounded-sm text-xs md:text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />{closureError}
            </div>
          )}

          {/* Add form */}
          <div className="bg-brand-darker/40 border border-gray-800 rounded-sm p-3 md:p-4 space-y-2 md:space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-500">Add a Closure Date</p>
            <div className="flex flex-col md:flex-row md:flex-wrap items-stretch md:items-end gap-2 md:gap-3">
              <div className="flex flex-col gap-1.5 flex-shrink-0 md:w-auto">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Date</label>
                <input
                  type="date"
                  value={newClosureDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={e => setNewClosureDate(e.target.value)}
                  className="bg-brand-darker border border-gray-700 text-white px-2 md:px-3 py-2 focus:outline-none focus:border-brand-orange transition-colors rounded-sm text-xs md:text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5 flex-1 min-w-0 md:flex-1 md:min-w-40">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  Reason <span className="text-gray-700 normal-case font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={newClosureReason}
                  placeholder="e.g. Christmas Day"
                  maxLength={120}
                  onChange={e => setNewClosureReason(e.target.value)}
                  className="bg-brand-darker border border-gray-700 text-white px-2 md:px-3 py-2 focus:outline-none focus:border-brand-orange transition-colors rounded-sm text-xs md:text-sm placeholder-gray-700"
                />
              </div>
            </div>

            {/* Yearly toggle */}
            <div className="border-t border-gray-700/50 pt-2 md:pt-3 flex items-center gap-2 md:gap-4">
              <div className="flex items-center gap-1 md:gap-2">
                <button
                  type="button"
                  role="radio"
                  aria-checked={!newClosureIsYearly}
                  onClick={() => setNewClosureIsYearly(false)}
                  className={`px-2 md:px-3 py-1 md:py-1.5 text-[10px] md:text-xs font-bold uppercase tracking-widest rounded-sm transition-colors ${
                    !newClosureIsYearly
                      ? 'bg-brand-orange text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  One-Time
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={newClosureIsYearly}
                  onClick={() => setNewClosureIsYearly(true)}
                  className={`px-2 md:px-3 py-1 md:py-1.5 text-[10px] md:text-xs font-bold uppercase tracking-widest rounded-sm transition-colors ${
                    newClosureIsYearly
                      ? 'bg-brand-orange text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  Yearly
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2 md:pt-2">
              <button
                type="button"
                disabled={!newClosureDate || addingClosure}
                onClick={async () => {
                  if (!token || !newClosureDate) return;
                  setAddingClosure(true);
                  setClosureError(null);
                  try {
                    await addShopClosedDateApi(token, newClosureDate, newClosureReason.trim() || undefined, newClosureIsYearly);
                    const data = await fetchShopClosedDatesApi() as { closedDates: { date: string; reason: string | null; isYearly: boolean }[] };
                    setClosedDates(data.closedDates ?? []);
                    setNewClosureDate('');
                    setNewClosureReason('');
                    setNewClosureIsYearly(false);
                  } catch (e) {
                    setClosureError((e as Error).message ?? 'Failed to add closure.');
                  } finally {
                    setAddingClosure(false);
                  }
                }}
                className="flex items-center gap-2 bg-brand-orange text-white px-4 md:px-5 py-2 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-50 rounded-sm text-xs md:text-sm shrink-0"
              >
                {addingClosure ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                Add
              </button>
            </div>
          </div>

          {/* Closed dates list */}
          {closedDates.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 md:py-8 text-gray-700">
              <CalendarX className="w-6 md:w-8 h-6 md:h-8 opacity-40" />
              <p className="text-xs md:text-sm">No closures scheduled.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-800/60">
              {closedDates.map(cd => {
                const d = new Date(cd.date + 'T12:00:00');
                const weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
                const full = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                return (
                  <li key={cd.date} className="flex items-center justify-between gap-2 md:gap-4 py-2.5 md:py-3.5">
                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                      <div className="shrink-0 w-8 h-8 md:w-10 md:h-10 rounded bg-brand-orange/10 border border-brand-orange/25 flex flex-col items-center justify-center">
                        <span className="text-[8px] md:text-[9px] font-bold uppercase text-brand-orange leading-none">{weekday}</span>
                        <span className="text-sm md:text-base font-black text-brand-orange leading-tight">{d.getDate()}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-semibold text-xs md:text-sm leading-tight">{full}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {cd.reason
                            ? <p className="text-[10px] md:text-xs text-gray-400 truncate">{cd.reason}</p>
                            : <p className="text-[10px] md:text-xs text-gray-700">No reason specified</p>
                          }
                          {cd.isYearly && (
                            <span className="text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded bg-brand-orange/15 border border-brand-orange/30 text-brand-orange shrink-0">Yearly</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!token) return;
                        setClosureError(null);
                        try {
                          await removeShopClosedDateApi(token, cd.date);
                          setClosedDates(prev => prev.filter(d => d.date !== cd.date));
                        } catch (e) {
                          setClosureError((e as Error).message ?? 'Failed to remove closure.');
                        }
                      }}
                      className="shrink-0 p-1.5 md:p-2 text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors rounded-sm"
                      title="Remove closure"
                    >
                      <Trash2 className="w-4 h-4 md:w-4 md:h-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      </div>

      {/* ── End: Right Column ──────────────────────────────────────── */}
      </div>
      {/* ── End: Two-Column Layout ────────────────────────────────── */}
    </div>
  );
}
