import { useState, useEffect } from 'react';
import { Clock, Save, Loader2, AlertCircle, CheckCircle, Users } from 'lucide-react';
import { fetchShopHoursApi, updateShopHoursApi, fetchSiteSettingsApi, updateSiteSettingsApi } from '../../services/api';
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

  const [hours,        setHours]        = useState<ShopDayHours[]>([]);
  const [slotCapacity, setSlotCapacity] = useState(3);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [saved,        setSaved]        = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      fetchShopHoursApi(),
      fetchSiteSettingsApi(),
    ])
      .then(([{ hours: h }, { settings }]) => {
        setHours(buildDefaults(h));
        setSlotCapacity(Math.max(1, parseInt(settings.slot_capacity ?? '3', 10) || 3));
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
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const { hours: updated } = await updateShopHoursApi(token, hours);
      setHours(buildDefaults(updated));
      setSaved(true);
    } catch (err: unknown) {
      setError((err as Error)?.message ?? 'Failed to save shop hours.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide flex items-center gap-3">
        <Clock className="w-6 h-6 text-brand-orange" />
        Shop Hours
      </h2>
      <p className="text-gray-400 text-sm">
        Set which days the shop is open and the available appointment window. These hours control which dates clients can book on the booking page.
      </p>

      {/* Feedback banners */}
      {saved && !error && (
        <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-sm text-sm">
          <CheckCircle className="w-4 h-4 shrink-0" /> Shop hours saved successfully.
        </div>
      )}
      {error && (
        <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-sm text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <form onSubmit={handleSave}>
        <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">
          {/* Table header */}
          <div className="hidden md:grid grid-cols-[160px_80px_1fr_1fr_160px] gap-4 px-5 py-3 border-b border-gray-800 bg-brand-darker/50">
            {['Day', 'Open', 'Opens At', 'Closes At', 'Slot Interval'].map(h => (
              <span key={h} className="text-xs font-bold uppercase tracking-widest text-gray-500">{h}</span>
            ))}
          </div>

          {hours.map((day, idx) => (
            <div
              key={day.dayOfWeek}
              className={`px-5 py-4 ${idx < hours.length - 1 ? 'border-b border-gray-800' : ''} ${
                day.isOpen ? '' : 'opacity-60'
              }`}
            >
              {/* Mobile label */}
              <p className="md:hidden text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
                {DAY_NAMES[day.dayOfWeek]}
              </p>

              <div className="grid grid-cols-2 md:grid-cols-[160px_80px_1fr_1fr_160px] gap-4 items-center">
                {/* Day name (desktop) */}
                <span className="hidden md:block text-white font-semibold text-sm">
                  {DAY_NAMES[day.dayOfWeek]}
                </span>

                {/* Toggle */}
                <label className="flex items-center gap-2 cursor-pointer col-span-2 md:col-span-1">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={day.isOpen}
                    onClick={() => updateDay(day.dayOfWeek, { isOpen: !day.isOpen })}
                    className={`relative inline-flex w-10 h-5 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange ${
                      day.isOpen ? 'bg-brand-orange' : 'bg-gray-700'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        day.isOpen ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className={`text-xs font-bold uppercase tracking-widest md:hidden ${day.isOpen ? 'text-brand-orange' : 'text-gray-600'}`}>
                    {day.isOpen ? 'Open' : 'Closed'}
                  </span>
                </label>

                {/* Opens At */}
                <div className="space-y-1">
                  <label className="md:hidden text-[10px] font-bold uppercase tracking-widest text-gray-500">Opens At</label>
                  <input
                    type="time"
                    value={day.openTime}
                    disabled={!day.isOpen}
                    onChange={e => updateDay(day.dayOfWeek, { openTime: e.target.value })}
                    className="w-full bg-brand-darker border border-gray-700 text-white px-3 py-2 focus:outline-none focus:border-brand-orange transition-colors rounded-sm text-sm disabled:opacity-40 disabled:cursor-not-allowed"
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
                    className="w-full bg-brand-darker border border-gray-700 text-white px-3 py-2 focus:outline-none focus:border-brand-orange transition-colors rounded-sm text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Slot interval */}
                <div className="space-y-1 col-span-2 md:col-span-1">
                  <label className="md:hidden text-[10px] font-bold uppercase tracking-widest text-gray-500">Slot Interval</label>
                  <select
                    value={day.slotIntervalH}
                    disabled={!day.isOpen}
                    onChange={e => updateDay(day.dayOfWeek, { slotIntervalH: parseFloat(e.target.value) })}
                    className="w-full bg-brand-darker border border-gray-700 text-white px-3 py-2 focus:outline-none focus:border-brand-orange transition-colors rounded-sm text-sm appearance-none disabled:opacity-40 disabled:cursor-not-allowed"
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
        </div>

        <div className="flex justify-end mt-5">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60 rounded-sm"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save Hours'}
          </button>
        </div>
      </form>

      {/* Booking capacity setting */}
      <div className="bg-brand-dark border border-gray-800 rounded-sm p-6 space-y-4">
        <h3 className="text-base font-display font-bold text-white uppercase tracking-wide flex items-center gap-2">
          <Users className="w-5 h-5 text-brand-orange" />
          Booking Capacity
        </h3>
        <p className="text-gray-400 text-sm">
          Set the maximum number of customers that can book the same time slot. When a slot reaches this limit it is hidden from the booking page.
        </p>
        <div className="flex items-center gap-4">
          <label htmlFor="slot-capacity" className="text-xs font-bold uppercase tracking-widest text-gray-500 shrink-0">
            Max per slot
          </label>
          <input
            id="slot-capacity"
            type="number"
            min={1}
            max={20}
            value={slotCapacity}
            onChange={e => { setSaved(false); setSlotCapacity(Math.max(1, parseInt(e.target.value, 10) || 1)); }}
            className="w-24 bg-brand-darker border border-gray-700 text-white px-3 py-2 focus:outline-none focus:border-brand-orange transition-colors rounded-sm text-sm"
          />
          <span className="text-xs text-gray-600">customers</span>
        </div>
        <p className="text-xs text-gray-600">
          Currently set to <span className="text-white font-semibold">{slotCapacity}</span>. Changes take effect after saving.
        </p>
      </div>

      {/* Combined save button for capacity section */}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            if (!token) return;
            setSaving(true);
            setError(null);
            setSaved(false);
            try {
              await updateSiteSettingsApi(token, { slot_capacity: String(slotCapacity) });
              setSaved(true);
            } catch (err: unknown) {
              setError((err as Error)?.message ?? 'Failed to save capacity.');
            } finally {
              setSaving(false);
            }
          }}
          className="flex items-center gap-2 bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors disabled:opacity-60 rounded-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save Capacity'}
        </button>
      </div>
    </div>
  );
}
