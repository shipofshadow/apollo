import { useEffect, useMemo, useState } from 'react';
import { Loader2, PlayCircle, FlaskConical, Megaphone, Plus, TimerReset, Clock3 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  fetchCampaignsApi,
  createCampaignApi,
  runCampaignApi,
  dryRunCampaignApi,
  runScheduledCampaignsApi,
  fetchCampaignAudienceApi,
  fetchCampaignAnalyticsApi,
} from '../../services/api';
import type { MarketingCampaign, CampaignAudienceRecipient, CampaignAnalyticsData } from '../../types';
import { Breadcrumbs } from './_sharedComponents';

const CAMPAIGN_TYPES: Array<{ value: MarketingCampaign['type']; label: string }> = [
  { value: 'abandoned_cart', label: 'Abandoned Cart' },
  { value: 'no_booking_90d', label: 'No Booking in 90 Days' },
  { value: 'win_back', label: 'Win-back Offer' },
];

export default function MarketingCampaignsPanel() {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [selected, setSelected] = useState<MarketingCampaign | null>(null);
  const [audiencePreview, setAudiencePreview] = useState<CampaignAudienceRecipient[]>([]);
  const [analytics, setAnalytics] = useState<CampaignAnalyticsData | null>(null);

  const [form, setForm] = useState({
    name: '',
    type: 'abandoned_cart' as MarketingCampaign['type'],
    title: 'Special Offer',
    message: '',
    status: 'draft' as MarketingCampaign['status'],
    channels: ['inapp'] as Array<'inapp' | 'email' | 'sms'>,
    ctaUrl: '',
    scheduleEnabled: false,
    scheduleType: 'daily' as 'daily' | 'weekly' | 'monthly',
    scheduleTime: '09:00',
    scheduleWeekday: 1,
    scheduleDay: 1,
    scheduleTimezone: 'Asia/Manila',
  });

  const selectedId = selected?.id ?? null;

  const loadCampaigns = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetchCampaignsApi(token);
      setCampaigns(res.campaigns ?? []);
      if (!selectedId && res.campaigns?.length) {
        setSelected(res.campaigns[0]);
      }
    } catch (e) {
      showToast((e as Error).message || 'Failed to load campaigns.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadAudience = async (type: MarketingCampaign['type']) => {
    if (!token) return;
    try {
      const res = await fetchCampaignAudienceApi(token, type);
      setAudiencePreview(res.audience ?? []);
    } catch (e) {
      showToast((e as Error).message || 'Failed to load audience preview.', 'error');
    }
  };

  const loadAnalytics = async (id: number) => {
    if (!token) return;
    try {
      const res = await fetchCampaignAnalyticsApi(token, id);
      setAnalytics(res);
    } catch {
      setAnalytics(null);
    }
  };

  useEffect(() => { void loadCampaigns(); }, [token]);
  useEffect(() => { void loadAudience(form.type); }, [form.type, token]);
  useEffect(() => {
    if (selectedId) {
      void loadAnalytics(selectedId);
    }
  }, [selectedId, token]);

  const selectedChannelsLabel = useMemo(() => form.channels.join(', '), [form.channels]);

  const toggleChannel = (channel: 'inapp' | 'email' | 'sms') => {
    setForm(prev => {
      const has = prev.channels.includes(channel);
      const next = has ? prev.channels.filter(c => c !== channel) : [...prev.channels, channel];
      return { ...prev, channels: next.length ? next : ['inapp'] };
    });
  };

  const handleCreate = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      await createCampaignApi(token, {
        name: form.name,
        type: form.type,
        title: form.title,
        message: form.message,
        status: form.status,
        channels: form.channels,
        ctaUrl: form.ctaUrl || null,
        scheduleEnabled: form.scheduleEnabled,
        scheduleType: form.scheduleEnabled ? form.scheduleType : 'manual',
        scheduleTime: form.scheduleTime,
        scheduleWeekday: form.scheduleType === 'weekly' ? form.scheduleWeekday : null,
        scheduleDay: form.scheduleType === 'monthly' ? form.scheduleDay : null,
        scheduleTimezone: form.scheduleTimezone,
      });
      showToast('Campaign created.', 'success');
      setForm({ ...form, name: '', message: '' });
      await loadCampaigns();
    } catch (e) {
      showToast((e as Error).message || 'Failed to create campaign.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRunScheduled = async () => {
    if (!token) return;
    setSubmitting(true);
    try {
      const { result } = await runScheduledCampaignsApi(token, 50);
      showToast(`Scheduled run complete: ${result.processed} campaign(s), ${result.queuedDeliveries} queued deliveries.`, 'success');
      await loadCampaigns();
      if (selectedId) await loadAnalytics(selectedId);
    } catch (e) {
      showToast((e as Error).message || 'Failed to run scheduled campaigns.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRun = async (campaignId: number, dryRun: boolean) => {
    if (!token) return;
    setSubmitting(true);
    try {
      const res = dryRun ? await dryRunCampaignApi(token, campaignId) : await runCampaignApi(token, campaignId);
      const result = res.result;
      showToast(dryRun
        ? `Dry-run complete. ${result.targetCount} matched recipients.`
        : `Campaign queued to ${result.queuedCount} channel deliveries.`, 'success');
      if (selectedId) await loadAnalytics(selectedId);
    } catch (e) {
      showToast((e as Error).message || 'Failed to run campaign.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: 'Admin' }, { label: 'Marketing Campaigns' }]} />

      <section className="rounded-xl border border-gray-800 bg-brand-dark p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-orange">Automation</p>
        <h2 className="text-2xl font-display font-bold uppercase tracking-wide text-white">Marketing Campaigns</h2>
        <p className="text-sm text-gray-300 mt-1">Trigger campaigns using existing notification channels: abandoned cart, no booking 90 days, win-back offers.</p>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <section className="xl:col-span-5 rounded-xl border border-gray-800 bg-brand-dark p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold uppercase tracking-widest text-gray-300 inline-flex items-center gap-1.5"><Plus className="w-4 h-4" />Create Campaign</h3>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void handleRunScheduled()}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-sm border border-gray-700 text-xs text-gray-300 hover:border-brand-orange hover:text-white"
            >
              <TimerReset className="w-3.5 h-3.5" /> Run Due
            </button>
          </div>

          <input
            value={form.name}
            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Campaign name"
            className="w-full bg-brand-darker border border-gray-700 px-3 py-2 rounded-sm text-sm text-white focus:outline-none focus:border-brand-orange"
          />

          <select
            value={form.type}
            onChange={e => setForm(prev => ({ ...prev, type: e.target.value as MarketingCampaign['type'] }))}
            className="w-full bg-brand-darker border border-gray-700 px-3 py-2 rounded-sm text-sm text-white focus:outline-none focus:border-brand-orange"
          >
            {CAMPAIGN_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>

          <input
            value={form.title}
            onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
            placeholder="Campaign title"
            className="w-full bg-brand-darker border border-gray-700 px-3 py-2 rounded-sm text-sm text-white focus:outline-none focus:border-brand-orange"
          />

          <textarea
            value={form.message}
            onChange={e => setForm(prev => ({ ...prev, message: e.target.value }))}
            rows={4}
            placeholder="Campaign message"
            className="w-full bg-brand-darker border border-gray-700 px-3 py-2 rounded-sm text-sm text-white focus:outline-none focus:border-brand-orange"
          />

          <input
            value={form.ctaUrl}
            onChange={e => setForm(prev => ({ ...prev, ctaUrl: e.target.value }))}
            placeholder="CTA URL (optional)"
            className="w-full bg-brand-darker border border-gray-700 px-3 py-2 rounded-sm text-sm text-white focus:outline-none focus:border-brand-orange"
          />

          <select
            value={form.status}
            onChange={e => setForm(prev => ({ ...prev, status: e.target.value as MarketingCampaign['status'] }))}
            className="w-full bg-brand-darker border border-gray-700 px-3 py-2 rounded-sm text-sm text-white focus:outline-none focus:border-brand-orange"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
          </select>

          <div className="rounded-sm border border-gray-800 bg-brand-darker/50 p-3 space-y-2">
            <label className="flex items-center justify-between text-xs text-gray-300">
              <span className="inline-flex items-center gap-1"><Clock3 className="w-3.5 h-3.5" /> Enable Schedule</span>
              <input
                type="checkbox"
                checked={form.scheduleEnabled}
                onChange={e => setForm(prev => ({ ...prev, scheduleEnabled: e.target.checked }))}
                className="accent-brand-orange"
              />
            </label>

            {form.scheduleEnabled && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={form.scheduleType}
                    onChange={e => setForm(prev => ({ ...prev, scheduleType: e.target.value as 'daily' | 'weekly' | 'monthly' }))}
                    className="w-full bg-brand-darker border border-gray-700 px-3 py-2 rounded-sm text-sm text-white"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  <input
                    type="time"
                    value={form.scheduleTime}
                    onChange={e => setForm(prev => ({ ...prev, scheduleTime: e.target.value }))}
                    className="w-full bg-brand-darker border border-gray-700 px-3 py-2 rounded-sm text-sm text-white"
                  />
                </div>

                {form.scheduleType === 'weekly' && (
                  <select
                    value={form.scheduleWeekday}
                    onChange={e => setForm(prev => ({ ...prev, scheduleWeekday: Number(e.target.value) }))}
                    className="w-full bg-brand-darker border border-gray-700 px-3 py-2 rounded-sm text-sm text-white"
                  >
                    <option value={0}>Sunday</option>
                    <option value={1}>Monday</option>
                    <option value={2}>Tuesday</option>
                    <option value={3}>Wednesday</option>
                    <option value={4}>Thursday</option>
                    <option value={5}>Friday</option>
                    <option value={6}>Saturday</option>
                  </select>
                )}

                {form.scheduleType === 'monthly' && (
                  <input
                    type="number"
                    min={1}
                    max={28}
                    value={form.scheduleDay}
                    onChange={e => setForm(prev => ({ ...prev, scheduleDay: Number(e.target.value) }))}
                    className="w-full bg-brand-darker border border-gray-700 px-3 py-2 rounded-sm text-sm text-white"
                    placeholder="Day of month (1-28)"
                  />
                )}

                <input
                  value={form.scheduleTimezone}
                  onChange={e => setForm(prev => ({ ...prev, scheduleTimezone: e.target.value }))}
                  placeholder="Timezone e.g. Asia/Manila"
                  className="w-full bg-brand-darker border border-gray-700 px-3 py-2 rounded-sm text-sm text-white"
                />
              </>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-widest text-gray-500">Channels: {selectedChannelsLabel}</p>
            <div className="flex gap-2">
              {(['inapp', 'email', 'sms'] as const).map(ch => (
                <button
                  key={ch}
                  type="button"
                  onClick={() => toggleChannel(ch)}
                  className={`px-2 py-1 rounded-sm border text-xs uppercase tracking-widest ${form.channels.includes(ch) ? 'border-brand-orange text-white bg-brand-orange/15' : 'border-gray-700 text-gray-400'}`}
                >
                  {ch}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={submitting || !form.name.trim() || !form.message.trim()}
            onClick={() => void handleCreate()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-sm bg-brand-orange text-white text-xs font-bold uppercase tracking-widest disabled:opacity-60"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />} Create Campaign
          </button>
        </section>

        <section className="xl:col-span-7 rounded-xl border border-gray-800 bg-brand-dark p-4 space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-widest text-gray-300">Campaigns</h3>

          {loading ? (
            <div className="py-8 text-gray-400 flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin mr-2" />Loading campaigns...</div>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-gray-500">No campaigns yet.</p>
          ) : (
            <div className="space-y-2">
              {campaigns.map(c => (
                <div key={c.id} className={`rounded-sm border p-3 ${selectedId === c.id ? 'border-brand-orange bg-brand-orange/10' : 'border-gray-800 bg-brand-darker/40'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <button type="button" onClick={() => setSelected(c)} className="text-left">
                      <p className="text-white font-semibold text-sm">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.type} • {c.status} • channels: {c.channels.join(', ')}</p>
                      <p className="text-[11px] text-gray-500">
                        {c.scheduleEnabled ? `Scheduled ${c.scheduleType} @ ${c.scheduleTime} (${c.scheduleTimezone})` : 'Manual'}
                        {c.nextRunAt ? ` • next: ${new Date(c.nextRunAt).toLocaleString()}` : ''}
                      </p>
                    </button>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => void handleRun(c.id, true)}
                        className="px-2 py-1 rounded-sm border border-gray-700 text-xs text-gray-300 hover:border-brand-orange"
                      >
                        <span className="inline-flex items-center gap-1"><FlaskConical className="w-3.5 h-3.5" />Dry Run</span>
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => void handleRun(c.id, false)}
                        className="px-2 py-1 rounded-sm bg-brand-orange text-white text-xs"
                      >
                        <span className="inline-flex items-center gap-1"><PlayCircle className="w-3.5 h-3.5" />Run</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-sm border border-gray-800 bg-brand-darker/50 p-3">
              <p className="text-[11px] uppercase tracking-widest text-gray-500">Audience Preview ({form.type})</p>
              <div className="mt-2 space-y-1 max-h-40 overflow-auto">
                {audiencePreview.length === 0 ? <p className="text-sm text-gray-500">No recipients matched.</p> : audiencePreview.slice(0, 12).map((r, i) => (
                  <p key={`${r.userId}-${i}`} className="text-xs text-gray-300">{r.name} • {r.email || r.phone || 'No contact'}</p>
                ))}
              </div>
            </div>
            <div className="rounded-sm border border-gray-800 bg-brand-darker/50 p-3">
              <p className="text-[11px] uppercase tracking-widest text-gray-500">Analytics</p>
              {!analytics ? <p className="text-sm text-gray-500 mt-2">Select a campaign to view analytics.</p> : (
                <div className="mt-2 space-y-1 text-sm text-gray-300">
                  <p>Total: {analytics.totals.total}</p>
                  <p>Queued: {analytics.totals.queued}</p>
                  <p>Sent: {analytics.totals.sent}</p>
                  <p>Failed: {analytics.totals.failed}</p>
                  {analytics.byChannel.map(c => (
                    <p key={c.channel} className="text-xs text-gray-400">{c.channel}: {c.total}</p>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-sm border border-gray-800 bg-brand-darker/50 p-3">
            <p className="text-[11px] uppercase tracking-widest text-gray-500">Failure Analytics</p>
            {!analytics || analytics.failureSummary.length === 0 ? (
              <p className="text-sm text-gray-500 mt-2">No failure records yet.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {analytics.failureSummary.slice(0, 8).map((f, idx) => (
                  <div key={`${f.channel}-${idx}`} className="text-xs text-gray-300 border border-gray-800 rounded-sm p-2">
                    <p className="text-red-300">{f.channel} • {f.total} failure(s)</p>
                    <p className="text-gray-400 mt-1">{f.error}</p>
                  </div>
                ))}
              </div>
            )}

            {analytics && analytics.recentFailures.length > 0 && (
              <div className="mt-3 border-t border-gray-800 pt-3 space-y-1 max-h-44 overflow-auto">
                {analytics.recentFailures.slice(0, 10).map((f, idx) => (
                  <p key={`${f.runId}-${idx}`} className="text-xs text-gray-400">
                    {f.channel} • {f.recipient} • {f.error}
                  </p>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
