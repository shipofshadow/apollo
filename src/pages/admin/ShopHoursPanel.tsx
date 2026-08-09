import React, { useState, useEffect } from 'react';
import {
  Clock, Save, Loader2, AlertCircle, CheckCircle2, Users,
  Calendar, CalendarX, Trash2, PlusCircle, Sparkles
} from 'lucide-react';
import {
  fetchShopHoursApi, updateShopHoursApi, fetchSiteSettingsApi,
  updateSiteSettingsApi, fetchShopClosedDatesApi, addShopClosedDateApi,
  removeShopClosedDateApi
} from '../../services/api';
import type { ShopDayHours } from '../../types';
import { useAuth } from '../../context/AuthContext';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const SLOT_OPTIONS = [0.5, 1, 1.5, 2, 2.5, 3, 4];

/** Build a full 7-day schedule. Days missing from the API response get defaults. */
function buildDefaults(existing: ShopDayHours[]): ShopDayHours[] {
  const map = new Map(existing.map(h => [h.dayOfWeek, h]));
  return Array.from({ length: 7 }, (_, day) =>
    map.get(day) ?? {
      dayOfWeek:     day,
      isOpen:        day >= 1 && day <= 5, // Mon–Fri open by default; Sat/Sun closed
      openTime:      '09:00',
      closeTime:     day === 6 ? '15:00' : '18:00',
      slotIntervalH: 2,
    }
  );
}

/* ── Skeleton Loading View ───────────────────────────────────────── */
function PanelSkeleton() {
  return (
    <div className="w-full space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="h-28 bg-brand-dark/80 border border-gray-800 rounded-xl p-6 flex flex-col justify-center space-y-3">
        <div className="h-4 w-32 bg-gray-800 rounded" />
        <div className="h-6 w-64 bg-gray-800 rounded" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Left Column Skeleton */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          <div className="h-14 bg-brand-dark border border-gray-800 rounded-xl" />
          <div className="bg-brand-dark border border-gray-800 rounded-xl p-4 space-y-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-16 bg-brand-darker/60 border border-gray-800/60 rounded-lg" />
            ))}
          </div>
        </div>

        {/* Right Column Skeleton */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          <div className="h-44 bg-brand-dark border border-gray-800 rounded-xl" />
          <div className="h-44 bg-brand-dark border border-gray-800 rounded-xl" />
          <div className="h-80 bg-brand-dark border border-gray-800 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export default function ShopHoursPanel() {
  const { token } = useAuth();

  const [hours,           setHours]           = useState<ShopDayHours[]>([]);
  const [slotCapacity,    setSlotCapacity]    = useState(3);
  const [horizonWeeks,    setHorizonWeeks]    = useState(2);
  const [loading,         setLoading]         = useState(true);
  const [savingHours,     setSavingHours]     = useState(false);
  const [savingCapacity,  setSavingCapacity]  = useState(false);
  const [savingHorizon,   setSavingHorizon]   = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [saved,           setSaved]           = useState(false);

  // Special closures state
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
        setHorizonWeeks(Math.max(1, parseInt(settings.booking_horizon_weeks ?? '2', 10) || 2));
        setClosedDates((closureData as { closedDates: { date: string; reason: string | null; isYearly: boolean }[] }).closedDates ?? []);
      })
      .catch(e => {
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

  const handleSaveHours = async (e: React.FormEvent) => {
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

  if (loading) {
    return <PanelSkeleton />;
  }

  const openDayCount = hours.filter(h => h.isOpen).length;
  const closedDayCount = 7 - openDayCount;

  return (
    <div className="w-full space-y-6">

      {/* ── 1. Page Header ────────────────────────────────────────── */}
      <header className="relative overflow-hidden rounded-xl border border-gray-800/80 bg-brand-dark p-5 sm:p-6 shadow-lg">
        {/* Subtle accent border top */}
        <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-brand-orange/60 to-transparent" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-brand-orange/10 border border-brand-orange/20 text-brand-orange shrink-0 mt-0.5">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-orange">Admin Controls</span>
                <span className="text-gray-600 text-xs">•</span>
                <span className="text-xs text-gray-400">Shop Schedule</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-display font-bold uppercase tracking-wide text-white mt-0.5">
                Shop Hours &amp; Availability
              </h1>
              <p className="text-xs sm:text-sm text-gray-400 mt-1 max-w-xl">
                Configure weekly operating hours, slot booking limits, scheduling horizons, and holiday closures.
              </p>
            </div>
          </div>

          {/* Quick Status Pill */}
          <div className="flex items-center gap-2 bg-brand-darker border border-gray-800 rounded-lg p-2 sm:p-2.5 shrink-0 self-start md:self-auto">
            <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              {openDayCount} Open Days
            </div>
            <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-gray-800/80 text-gray-400 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500" />
              {closedDayCount} Closed Days
            </div>
          </div>
        </div>
      </header>

      {/* ── Banners / Notifications ───────────────────────────────── */}
      {saved && !error && (
        <div className="flex items-center gap-3 bg-green-950/40 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg text-xs sm:text-sm shadow-md animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-green-400" />
          <span className="font-medium">Operating hours saved successfully. Changes are now live on calendars.</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 bg-red-950/40 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg text-xs sm:text-sm shadow-md animate-fadeIn">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* ── Layout Grid ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">

        {/* ── 2. Left Column: Operating Hours ──────────────────────── */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          <form onSubmit={handleSaveHours}>
            <div className="bg-brand-dark border border-gray-800 rounded-xl overflow-hidden shadow-xl">
              
              {/* Header */}
              <div className="px-5 py-4 border-b border-gray-800 bg-brand-darker/60 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-brand-orange shrink-0" />
                  <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-white">Weekly Schedule</h2>
                </div>
                <span className="text-[11px] font-mono font-medium text-gray-400">
                  {openDayCount} of 7 Days Active
                </span>
              </div>

              {/* Desktop Column Labels */}
              <div className="hidden md:grid grid-cols-12 gap-3 px-5 py-2.5 border-b border-gray-800/80 bg-brand-darker/40 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                <div className="col-span-4">Day &amp; Status</div>
                <div className="col-span-3">Opens At</div>
                <div className="col-span-3">Closes At</div>
                <div className="col-span-2 text-right">Slot Interval</div>
              </div>

              {/* Schedule Rows */}
              <div className="divide-y divide-gray-800/60">
                {hours.map((day) => {
                  const dayName = DAY_NAMES[day.dayOfWeek];
                  const dayShort = DAY_SHORT[day.dayOfWeek];

                  return (
                    <div
                      key={day.dayOfWeek}
                      className={`p-4 sm:p-5 transition-all duration-200 ${
                        day.isOpen 
                          ? 'bg-brand-dark hover:bg-brand-darker/30' 
                          : 'bg-brand-darker/50 opacity-70 hover:opacity-85'
                      }`}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                        
                        {/* Day Name + Toggle */}
                        <div className="md:col-span-4 flex items-center justify-between md:justify-start gap-3">
                          <div className="flex items-center gap-3">
                            <span className={`w-9 h-7 rounded flex items-center justify-center font-mono text-[10px] font-bold tracking-wider ${
                              day.isOpen 
                                ? 'bg-brand-orange/15 text-brand-orange border border-brand-orange/30' 
                                : 'bg-gray-800 text-gray-500 border border-gray-700/50'
                            }`}>
                              {dayShort}
                            </span>
                            <span className={`font-semibold text-xs sm:text-sm ${day.isOpen ? 'text-white' : 'text-gray-400'}`}>
                              {dayName}
                            </span>
                          </div>

                          {/* Toggle switch */}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              role="switch"
                              aria-checked={day.isOpen}
                              aria-label={`Toggle operating status for ${dayName}`}
                              onClick={() => updateDay(day.dayOfWeek, { isOpen: !day.isOpen })}
                              className={`relative inline-flex w-10 h-5.5 shrink-0 rounded-full transition-colors duration-200 ease-in-out cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange ${
                                day.isOpen ? 'bg-brand-orange' : 'bg-gray-700'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block w-4.5 h-4.5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out mt-0.5 ml-0.5 ${
                                  day.isOpen ? 'translate-x-4.5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                            <span className={`text-[10px] font-bold uppercase tracking-wider hidden sm:inline ${
                              day.isOpen ? 'text-brand-orange' : 'text-gray-500'
                            }`}>
                              {day.isOpen ? 'Open' : 'Closed'}
                            </span>
                          </div>
                        </div>

                        {/* Input controls (Mobile stacked, Desktop aligned) */}
                        <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-3 items-center">
                          
                          {/* Opens At */}
                          <div className="space-y-1">
                            <label className="block md:hidden text-[9px] font-bold uppercase tracking-widest text-gray-400">Opens At</label>
                            <input
                              type="time"
                              value={day.openTime}
                              disabled={!day.isOpen}
                              aria-label={`${dayName} Open Time`}
                              onChange={e => updateDay(day.dayOfWeek, { openTime: e.target.value })}
                              className="w-full h-9 bg-brand-darker border border-gray-700/80 rounded-lg px-3 text-xs font-mono text-white focus:outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            />
                          </div>

                          {/* Closes At */}
                          <div className="space-y-1">
                            <label className="block md:hidden text-[9px] font-bold uppercase tracking-widest text-gray-400">Closes At</label>
                            <input
                              type="time"
                              value={day.closeTime}
                              disabled={!day.isOpen}
                              aria-label={`${dayName} Close Time`}
                              onChange={e => updateDay(day.dayOfWeek, { closeTime: e.target.value })}
                              className="w-full h-9 bg-brand-darker border border-gray-700/80 rounded-lg px-3 text-xs font-mono text-white focus:outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange/40 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            />
                          </div>

                          {/* Interval */}
                          <div className="space-y-1 col-span-2 sm:col-span-1">
                            <label className="block md:hidden text-[9px] font-bold uppercase tracking-widest text-gray-400">Slot Interval</label>
                            <select
                              value={day.slotIntervalH}
                              disabled={!day.isOpen}
                              aria-label={`${dayName} Booking Slot Interval`}
                              onChange={e => updateDay(day.dayOfWeek, { slotIntervalH: parseFloat(e.target.value) })}
                              className="w-full h-9 bg-brand-darker border border-gray-700/80 rounded-lg px-3 text-xs font-mono text-white focus:outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange/40 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              {SLOT_OPTIONS.map(v => (
                                <option key={v} value={v}>
                                  {v === 0.5 ? '30 mins' : v === 1 ? '1 hour' : `${v} hours`}
                                </option>
                              ))}
                            </select>
                          </div>

                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Card Footer Save Action */}
              <div className="px-5 py-4 border-t border-gray-800 bg-brand-darker/60 flex items-center justify-between gap-4">
                <p className="text-xs text-gray-400 hidden sm:block">
                  Changes update booking availability immediately across customer forms.
                </p>
                <button
                  type="submit"
                  disabled={savingHours}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-brand-orange text-white px-6 py-2.5 rounded-lg font-bold text-xs uppercase tracking-widest hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-brand-orange/50 transition-all disabled:opacity-60 shadow-lg cursor-pointer"
                >
                  {savingHours ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {savingHours ? 'Saving Schedule…' : 'Save Operating Hours'}
                </button>
              </div>

            </div>
          </form>
        </div>

        {/* ── 3. Right Column: Settings & Closures ─────────────────── */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">

          {/* ── Slot Capacity Card ──────────────────────────────────── */}
          <div className="bg-brand-dark border border-gray-800 rounded-xl overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-gray-800 bg-brand-darker/60 flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-orange shrink-0" />
              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-white">Slot Capacity</h2>
            </div>
            
            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-400 leading-relaxed">
                Maximum concurrent bookings allowed per time slot before it becomes fully booked.
              </p>

              {/* Scannable Metric Layout */}
              <div className="flex items-center justify-between bg-brand-darker/80 border border-gray-800 p-4 rounded-lg">
                <div>
                  <span className="text-3xl font-mono font-bold text-white leading-none">{slotCapacity}</span>
                  <p className="text-[11px] font-medium text-gray-400 mt-1">customers per slot</p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="slot-capacity"
                    type="number"
                    min={1}
                    max={20}
                    value={slotCapacity}
                    aria-label="Slot capacity count"
                    onChange={e => { setSaved(false); setSlotCapacity(Math.max(1, parseInt(e.target.value, 10) || 1)); }}
                    className="w-14 h-9 bg-brand-dark border border-gray-700 text-white font-mono text-center font-bold text-sm rounded-lg focus:outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange/40"
                  />
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
                    className="h-9 px-3.5 bg-brand-orange text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {savingCapacity ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Schedule Horizon Card ───────────────────────────────── */}
          <div className="bg-brand-dark border border-gray-800 rounded-xl overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-gray-800 bg-brand-darker/60 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-orange shrink-0" />
              <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-white">Schedule Horizon</h2>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-400 leading-relaxed">
                Number of future weeks of available schedule dates plotted on the customer booking form.
              </p>

              {/* Scannable Metric Layout */}
              <div className="flex items-center justify-between bg-brand-darker/80 border border-gray-800 p-4 rounded-lg">
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-mono font-bold text-white leading-none">{horizonWeeks}</span>
                    <span className="text-xs font-medium text-brand-orange uppercase tracking-wider">({horizonWeeks * 7} days)</span>
                  </div>
                  <p className="text-[11px] font-medium text-gray-400 mt-1">weeks available</p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    id="horizon-weeks"
                    type="number"
                    min={1}
                    max={52}
                    value={horizonWeeks}
                    aria-label="Weeks horizon count"
                    onChange={e => { setSaved(false); setHorizonWeeks(Math.max(1, parseInt(e.target.value, 10) || 1)); }}
                    className="w-14 h-9 bg-brand-dark border border-gray-700 text-white font-mono text-center font-bold text-sm rounded-lg focus:outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange/40"
                  />
                  <button
                    type="button"
                    disabled={savingHorizon}
                    onClick={async () => {
                      if (!token) return;
                      setSavingHorizon(true);
                      setError(null);
                      setSaved(false);
                      try {
                        await updateSiteSettingsApi(token, { booking_horizon_weeks: String(horizonWeeks) });
                        setSaved(true);
                      } catch (err: unknown) {
                        setError((err as Error)?.message ?? 'Failed to save schedule horizon.');
                      } finally {
                        setSavingHorizon(false);
                      }
                    }}
                    className="h-9 px-3.5 bg-brand-orange text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {savingHorizon ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── 4. Special Closures Section ───────────────────────────── */}
          <div className="bg-brand-dark border border-gray-800 rounded-xl overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-gray-800 bg-brand-darker/60 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CalendarX className="w-4 h-4 text-brand-orange shrink-0" />
                <h2 className="text-xs sm:text-sm font-bold uppercase tracking-widest text-white">Special Closures</h2>
              </div>
              {closedDates.length > 0 && (
                <span className="text-[10px] font-mono bg-brand-orange/15 border border-brand-orange/30 text-brand-orange px-2 py-0.5 rounded-full font-bold">
                  {closedDates.length} Scheduled
                </span>
              )}
            </div>

            <div className="p-5 space-y-5">
              <p className="text-xs text-gray-400 leading-relaxed">
                Block specific dates for public holidays, maintenance, or special shop events.
              </p>

              {closureError && (
                <div className="flex items-center gap-2 bg-red-950/40 border border-red-500/30 text-red-400 px-3.5 py-2.5 rounded-lg text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{closureError}</span>
                </div>
              )}

              {/* Sub-Section 1: Add Closure Workflow */}
              <div className="bg-brand-darker/60 border border-gray-800 rounded-lg p-4 space-y-3.5">
                <div className="flex items-center gap-1.5 text-white font-semibold text-xs uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5 text-brand-orange" />
                  <span>Add Closure</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                      Date *
                    </label>
                    <input
                      type="date"
                      value={newClosureDate}
                      min={new Date().toISOString().slice(0, 10)}
                      onChange={e => setNewClosureDate(e.target.value)}
                      className="w-full h-9 bg-brand-dark border border-gray-700/80 text-white px-3 rounded-lg text-xs font-mono focus:outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange/40"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">
                      Reason <span className="text-gray-500 font-normal lowercase">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={newClosureReason}
                      placeholder="e.g. Christmas Day / Maintenance"
                      maxLength={120}
                      onChange={e => setNewClosureReason(e.target.value)}
                      className="w-full h-9 bg-brand-dark border border-gray-700/80 text-white px-3 rounded-lg text-xs focus:outline-none focus:border-brand-orange focus:ring-1 focus:ring-brand-orange/40 placeholder-gray-600"
                    />
                  </div>

                  {/* Recurrence Selector Pill */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Recurrence</span>
                    <div className="flex items-center bg-brand-dark border border-gray-800 p-0.5 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setNewClosureIsYearly(false)}
                        className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${
                          !newClosureIsYearly ? 'bg-brand-orange text-white shadow' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        One-Time
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewClosureIsYearly(true)}
                        className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${
                          newClosureIsYearly ? 'bg-brand-orange text-white shadow' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        Yearly
                      </button>
                    </div>
                  </div>

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
                    className="w-full h-9 bg-brand-orange text-white text-xs font-bold uppercase tracking-widest rounded-lg hover:bg-orange-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-md mt-2"
                  >
                    {addingClosure ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />}
                    {addingClosure ? 'Adding Closure…' : 'Add Closure'}
                  </button>
                </div>
              </div>

              {/* Sub-Section 2: Scheduled Closures List */}
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Scheduled Closures
                </h3>

                {closedDates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center p-6 border border-dashed border-gray-800 rounded-lg bg-brand-darker/30">
                    <CalendarX className="w-7 h-7 text-gray-600 mb-2" />
                    <p className="text-xs font-semibold text-gray-400">No closures scheduled</p>
                    <p className="text-[11px] text-gray-600 mt-0.5">Added closure dates will appear here.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-800/80 max-h-72 overflow-y-auto pr-1 [scrollbar-width:thin]">
                    {closedDates.map(cd => {
                      const d = new Date(cd.date + 'T12:00:00');
                      const weekday = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
                      const fullDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                      return (
                        <li key={cd.date} className="flex items-center justify-between gap-3 py-3 hover:bg-brand-darker/20 px-1 rounded transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Date Badge */}
                            <div className="shrink-0 w-10 h-10 rounded-lg bg-brand-orange/10 border border-brand-orange/25 flex flex-col items-center justify-center text-center">
                              <span className="text-[8px] font-mono font-bold text-brand-orange leading-none">{weekday}</span>
                              <span className="text-sm font-mono font-bold text-white leading-tight mt-0.5">{d.getDate()}</span>
                            </div>

                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-white leading-tight truncate">{fullDate}</p>
                              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                {cd.reason ? (
                                  <p className="text-[11px] text-gray-400 truncate max-w-[140px]">{cd.reason}</p>
                                ) : (
                                  <p className="text-[11px] text-gray-600 italic">No reason specified</p>
                                )}
                                {cd.isYearly && (
                                  <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-orange/15 border border-brand-orange/30 text-brand-orange shrink-0">
                                    Yearly
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            aria-label={`Remove closure for ${fullDate}`}
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
                            className="shrink-0 p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors rounded-lg cursor-pointer"
                            title="Remove closure"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
