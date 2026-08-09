import { useState, useEffect } from 'react';
import {
  Activity, TrendingUp, Calendar, CheckCircle2,
  AlertCircle, Sun, Star, Wrench, PieChart, Download, Info, Clock
} from 'lucide-react';
import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { fetchAdminStatsApi, fetchAdminActivityApi, type AdminStats, type AdminActivityLog } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const STATUS_STYLES: Record<string, string> = {
  'pending': 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
  'confirmed': 'bg-green-500/10 text-green-400 border border-green-500/30',
  'in_progress': 'bg-sky-500/10 text-sky-400 border border-sky-500/30',
  'completed': 'bg-blue-500/10 text-blue-400 border border-blue-500/30',
  'cancelled': 'bg-red-500/10 text-red-400 border border-red-500/30',
};

/* ── Analytics Skeleton Loader ─────────────────────────────────── */
function AnalyticsSkeleton() {
  return (
    <div className="w-full space-y-6 animate-pulse">
      <div className="h-20 bg-brand-dark border border-gray-800 rounded-xl" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="h-28 bg-brand-dark border border-gray-800 rounded-xl" />
        <div className="h-28 bg-brand-dark border border-gray-800 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="h-28 bg-brand-dark border border-gray-800 rounded-xl" />
        <div className="h-28 bg-brand-dark border border-gray-800 rounded-xl" />
        <div className="h-28 bg-brand-dark border border-gray-800 rounded-xl" />
        <div className="h-28 bg-brand-dark border border-gray-800 rounded-xl" />
      </div>
    </div>
  );
}

export default function AnalyticsPanel() {
  const { token } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [timeframe, setTimeframe] = useState<string>('all_time');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const [activities, setActivities] = useState<AdminActivityLog[]>([]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetchAdminStatsApi(token, { timeframe, from: fromDate, to: toDate })
      .then(setStats)
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [token, timeframe, fromDate, toDate]);

  useEffect(() => {
    if (!token) return;
    fetchAdminActivityApi(token)
      .then(data => setActivities(data.logs))
      .catch(console.error);
  }, [token]);

  if (loading) return <AnalyticsSkeleton />;

  if (error) return (
    <div className="flex items-center gap-3 bg-red-950/40 border border-red-500/30 text-red-300 p-4 rounded-xl text-xs font-semibold shadow-md">
      <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
      <div>
        <p className="font-bold text-red-200 uppercase tracking-wide">Unable to load analytics</p>
        <p className="text-xs text-red-300/80 mt-0.5">{error}</p>
      </div>
    </div>
  );

  const topCards = [
    { label: 'Total Appointments', value: stats?.totalAppointments ?? 0, icon: Calendar, color: 'text-gray-300' },
    { label: 'Active Schedule', value: stats?.activeAppointments ?? 0, icon: Activity, color: 'text-green-400' },
    { label: 'Completed Jobs', value: (stats?.completedBookings ?? 0) + (stats?.completedInquiries ?? 0), icon: CheckCircle2, color: 'text-blue-400' },
    { label: 'New This Month', value: (stats?.bookingsThisMonth ?? 0) + (stats?.inquiriesThisMonth ?? 0), icon: TrendingUp, color: 'text-brand-orange' },
  ];

  const topServices = stats?.topServices ?? [];
  const peakHours = stats?.peakHours ?? [];
  const avgRating = stats?.avgRating ?? 0;
  const reviewCount = stats?.reviewCount ?? 0;

  const statusRows = [
    { label: 'Pending', value: (stats?.pendingBookings ?? 0) + (stats?.pendingInquiries ?? 0) },
    { label: 'Confirmed', value: (stats?.confirmedBookings ?? 0) + (stats?.confirmedInquiries ?? 0) },
    { label: 'In Progress', value: stats?.inProgressInquiries ?? 0 },
    { label: 'Completed', value: (stats?.completedBookings ?? 0) + (stats?.completedInquiries ?? 0) },
    { label: 'Cancelled', value: (stats?.cancelledBookings ?? 0) + (stats?.cancelledInquiries ?? 0) },
  ];

  const commonAxisLabelStyle = {
    colors: '#9ca3af',
    fontSize: '11px',
    fontFamily: 'inherit',
  };

  const basePeakHourSeries = [
    {
      name: 'Bookings',
      data: peakHours.map(hour => hour.bookingsCount ?? 0),
    },
    {
      name: 'Inquiries',
      data: peakHours.map(hour => hour.inquiriesCount ?? 0),
    }
  ];

  const peakHourSeries = basePeakHourSeries.filter(series => series.data.some(val => val > 0));

  const peakHourOptions: ApexOptions = {
    chart: {
      type: 'area',
      toolbar: { show: false },
      zoom: { enabled: false },
      foreColor: '#9ca3af',
    },
    colors: peakHourSeries.map(s => s.name === 'Bookings' ? '#f97316' : '#3b82f6'),
    stroke: { curve: 'smooth', width: 3 },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 0.2,
        opacityFrom: 0.45,
        opacityTo: 0.05,
        stops: [0, 95, 100],
      },
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: peakHours.map(hour => hour.time),
      labels: { style: commonAxisLabelStyle },
    },
    yaxis: {
      min: 0,
      forceNiceScale: true,
      labels: { style: commonAxisLabelStyle },
    },
    grid: {
      borderColor: '#1f2937',
      strokeDashArray: 4,
    },
    tooltip: { theme: 'dark' },
    markers: { size: 4, strokeWidth: 0 },
  };

  const serviceOptions: ApexOptions = {
    chart: {
      type: 'bar',
      toolbar: { show: false },
      foreColor: '#9ca3af',
    },
    colors: ['#f97316'],
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 4,
        barHeight: '60%',
      },
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: topServices.map(service => service.name),
      labels: { style: commonAxisLabelStyle },
    },
    yaxis: {
      labels: {
        style: commonAxisLabelStyle,
        maxWidth: 260,
      },
    },
    grid: {
      borderColor: '#1f2937',
      strokeDashArray: 4,
    },
    tooltip: { theme: 'dark' },
  };

  const serviceSeries = [
    {
      name: 'Bookings',
      data: topServices.map(service => service.count),
    },
  ];

  const statusDonutOptions: ApexOptions = {
    chart: {
      type: 'donut',
      foreColor: '#d1d5db',
    },
    labels: statusRows.map(row => row.label),
    colors: ['#fbbf24', '#22c55e', '#f97316', '#3b82f6', '#6b7280'],
    legend: {
      position: 'bottom',
      labels: { colors: '#9ca3af' },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: { width: 0 },
    tooltip: { theme: 'dark' },
    plotOptions: {
      pie: {
        donut: {
          size: '64%',
          labels: {
            show: true,
            value: { color: '#ffffff', fontSize: '20px', fontWeight: 700 },
            total: {
              show: true,
              label: 'Total',
              color: '#9ca3af',
              formatter: () => String(stats?.totalAppointments ?? 0),
            },
          },
        },
      },
    },
  };

  const statusDonutSeries = statusRows.map(row => row.value);

  const handleExport = () => {
    if (!stats) return;
    const csvContent = "data:text/csv;charset=utf-8," +
      "Status,Count\n" +
      statusRows.map(row => `${row.label},${row.value}`).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `appointments_by_status_${timeframe}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full space-y-6 font-sans">
      
      {/* ── 1. Dashboard Header ───────────────────────────────────── */}
      <header className="relative overflow-hidden rounded-xl border border-gray-800 bg-brand-dark p-5 sm:p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-brand-orange/10 border border-brand-orange/20 text-brand-orange shrink-0 mt-0.5">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-orange">Analytics &amp; Metrics</span>
                <span className="text-gray-600 text-xs">•</span>
                <span className="text-xs text-gray-400">Shop Operations</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-display font-bold uppercase tracking-wide text-white mt-0.5">
                Dashboard Overview
              </h1>
              <p className="text-xs sm:text-sm text-gray-400 mt-1 max-w-xl">
                Real-time appointment volume, peak booking hours, popular services, and activity timeline.
              </p>
            </div>
          </div>

          {/* Timeframe Control */}
          <div className="flex items-center gap-3 bg-brand-darker border border-gray-800 px-3.5 py-2 rounded-lg shrink-0 self-start sm:self-auto">
            {timeframe === 'custom' && (
              <div className="flex items-center gap-2 font-mono text-xs">
                <input
                  type="date"
                  className="bg-brand-dark border border-gray-800 rounded px-2 py-1 text-xs text-white outline-none focus:border-brand-orange [color-scheme:dark]"
                  value={fromDate}
                  onChange={e => setFromDate(e.target.value)}
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  className="bg-brand-dark border border-gray-800 rounded px-2 py-1 text-xs text-white outline-none focus:border-brand-orange [color-scheme:dark]"
                  value={toDate}
                  onChange={e => setToDate(e.target.value)}
                />
              </div>
            )}
            <select
              className="bg-transparent text-xs font-bold uppercase tracking-wider text-gray-300 focus:outline-none cursor-pointer border-none p-0 focus:ring-0 font-mono"
              value={timeframe}
              onChange={e => setTimeframe(e.target.value)}
            >
              <option value="all_time" className="bg-brand-dark text-white">All Time</option>
              <option value="this_week" className="bg-brand-dark text-white">This Week</option>
              <option value="this_month" className="bg-brand-dark text-white">This Month</option>
              <option value="custom" className="bg-brand-dark text-white">Custom Range</option>
            </select>
          </div>
        </div>
      </header>

      {/* ── 2. Today's Quick-Glance & Rating Row ──────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Today's Appointments Card */}
        <div className="relative bg-brand-dark border border-gray-800 rounded-xl overflow-hidden p-5 shadow-lg space-y-2">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-orange" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-orange flex items-center gap-1.5">
              <Sun className="w-4 h-4" /> Today's Floor Schedule
            </span>
            <span className="text-[10px] font-mono font-bold uppercase bg-brand-orange/15 text-brand-orange px-2 py-0.5 rounded">
              {stats?.todayActiveAppointments ?? 0} Active
            </span>
          </div>
          <p className="text-4xl font-display font-bold text-white font-mono">
            {stats?.todayAppointments ?? 0}
          </p>
          <p className="text-xs text-gray-400">
            Appointments scheduled for today ({stats?.todayActiveAppointments ?? 0} pending/confirmed/in-progress).
          </p>
        </div>

        {/* Customer Rating Card */}
        <div className="bg-brand-dark border border-gray-800 rounded-xl p-5 shadow-lg flex items-center gap-5">
          <div className="shrink-0">
            <div className="flex items-center gap-1 mb-1">
              {[1, 2, 3, 4, 5].map(n => (
                <Star
                  key={n}
                  className={`w-4 h-4 ${n <= Math.round(avgRating) ? 'text-amber-400 fill-amber-400' : 'text-gray-700'}`}
                />
              ))}
            </div>
            <p className="text-3xl font-display font-bold text-white font-mono">
              {reviewCount > 0 ? avgRating.toFixed(1) : '—'}
            </p>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 block">Average Rating</span>
            <p className="text-xs text-gray-400 mt-1">
              Based on {reviewCount} approved customer review{reviewCount !== 1 ? 's' : ''}.
            </p>
          </div>
        </div>
      </div>

      {/* ── 3. Main Metric Stat Cards ─────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {topCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-brand-dark p-5 border border-gray-800 rounded-xl shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</span>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className="text-3xl font-mono font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* ── 4. Charts: Peak Hours & Popular Services ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Peak Booking Hours */}
        <div className="bg-brand-dark border border-gray-800 rounded-xl overflow-hidden shadow-xl">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-orange" /> Peak Booking Hours
            </h3>
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">Top time slots</span>
          </div>
          <div className="px-3 pt-4 pb-2 min-h-[300px]">
            {peakHours.length > 0 ? (
              <ReactApexChart
                type="area"
                height={280}
                series={peakHourSeries}
                options={peakHourOptions}
              />
            ) : (
              <div className="h-[280px] grid place-items-center text-xs text-gray-500 font-mono">
                Not enough booking data to plot peak hours yet.
              </div>
            )}
          </div>
        </div>

        {/* Popular Services */}
        <div className="bg-brand-dark border border-gray-800 rounded-xl overflow-hidden shadow-xl">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2">
              <Wrench className="w-4 h-4 text-brand-orange" /> Popular Services
            </h3>
            <span className="text-[10px] font-mono uppercase tracking-wider text-gray-500">By booking count</span>
          </div>
          <div className="px-3 pt-4 pb-2 min-h-[300px]">
            {topServices.length > 0 ? (
              <ReactApexChart
                type="bar"
                height={280}
                series={serviceSeries}
                options={serviceOptions}
              />
            ) : (
              <div className="h-[280px] grid place-items-center text-xs text-gray-500 font-mono">
                Popular services will appear after bookings are recorded.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── 5. Status Distribution & Recent Activity ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Appointments by Status */}
        <div className="lg:col-span-7 bg-brand-dark border border-gray-800 rounded-xl overflow-hidden shadow-xl">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieChart className="w-4 h-4 text-brand-orange shrink-0" />
              <h3 className="text-xs font-bold uppercase tracking-widest text-white">Status Breakdown</h3>
              <div className="group relative flex items-center">
                <Info className="w-3.5 h-3.5 text-gray-500 cursor-help" />
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-brand-darker border border-gray-700 text-[10px] text-gray-300 rounded-lg shadow-xl z-10 text-center">
                  Includes all bookings and inquiries combined.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono font-bold uppercase bg-brand-orange/15 border border-brand-orange/30 text-brand-orange px-2.5 py-1 rounded-full">
                Total: {stats?.totalAppointments ?? 0}
              </span>
              <button
                type="button"
                className="text-[10px] font-bold uppercase tracking-wider text-gray-400 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                onClick={handleExport}
              >
                <Download className="w-3 h-3" /> Export
              </button>
            </div>
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
            <div className="md:col-span-7">
              <ReactApexChart
                type="donut"
                height={310}
                series={statusDonutSeries}
                options={statusDonutOptions}
              />
            </div>

            <div className="md:col-span-5 space-y-2">
              {statusRows.map(row => (
                <div
                  key={row.label}
                  className="flex items-center justify-between border border-gray-800 bg-brand-darker rounded-lg px-3.5 py-2"
                >
                  <span className="text-xs font-semibold text-gray-300">{row.label}</span>
                  <span className="text-base font-mono font-bold text-white">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="lg:col-span-5 bg-brand-dark border border-gray-800 rounded-xl overflow-hidden shadow-xl flex flex-col">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-brand-orange" /> Recent System Activity
            </h3>
          </div>

          <div className="divide-y divide-gray-800/80 max-h-[380px] overflow-y-auto font-mono flex-1 [scrollbar-width:thin]">
            {activities.length > 0 ? activities.map(log => (
              <div key={`${log.source}-${log.id}`} className="p-4 hover:bg-brand-darker/60 transition-colors space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-brand-orange">
                    {new Date(log.created_at).toISOString().replace('T', ' ').substring(0, 16)}Z
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                    log.source === 'booking' ? 'bg-sky-500/10 text-sky-400 border border-sky-500/30' : 'bg-brand-orange/10 text-brand-orange border border-brand-orange/30'
                  }`}>
                    {log.source}
                  </span>
                </div>

                <div className="text-[11px] text-gray-300 uppercase font-bold flex flex-wrap items-center gap-1.5 leading-snug">
                  <span className="text-white">{log.actor_name || 'SYSTEM'}</span>
                  <span className="text-gray-600">::</span>

                  {(() => {
                    let extractedStatus: string | null = null;
                    let displayAction = log.action;

                    if (log.action.toLowerCase().includes('status changed to')) {
                      extractedStatus = log.action.toLowerCase().split('status changed to')[1].trim().replace(' ', '_');
                      displayAction = 'STATUS UPDATED TO:';
                    }

                    if (extractedStatus && STATUS_STYLES[extractedStatus]) {
                      return (
                        <span className="flex items-center gap-1.5">
                          <span className="text-gray-400">{displayAction}</span>
                          <span className={`px-2 py-0.5 rounded-full ${STATUS_STYLES[extractedStatus]} font-bold text-[9px]`}>
                            {extractedStatus.replace('_', ' ')}
                          </span>
                        </span>
                      );
                    }
                    return <span className="text-gray-400">{log.action}</span>;
                  })()}

                  <span className="text-gray-600">::</span>
                  <span className="text-gray-500">
                    REF: {log.source === 'booking' ? `${log.first_name} ${log.last_name}` : `${log.client_name}`}
                  </span>
                </div>

                {log.detail && (
                  (() => {
                    let extractedStatus: string | null = null;
                    let prefixText = '';

                    if (log.detail.includes('->')) {
                      const parts = log.detail.split('->');
                      prefixText = parts[0].trim() + ' ->';
                      extractedStatus = parts[1].trim().toLowerCase().replace(' ', '_');
                    } else if (log.detail.toLowerCase().startsWith('status:')) {
                      prefixText = 'STATUS:';
                      extractedStatus = log.detail.toLowerCase().split('status:')[1].trim().replace(' ', '_');
                    }

                    if (extractedStatus && STATUS_STYLES[extractedStatus]) {
                      return (
                        <div className="mt-1.5 pl-2.5 border-l-2 border-gray-700 flex items-center gap-2 text-[10px]">
                          <span className="text-gray-500 uppercase">{prefixText}</span>
                          <span className={`px-2 py-0.5 rounded-full ${STATUS_STYLES[extractedStatus]} font-bold text-[9px]`}>
                            {extractedStatus.replace('_', ' ')}
                          </span>
                        </div>
                      );
                    }

                    return <p className="text-[10px] text-gray-500 mt-1 pl-2.5 border-l-2 border-gray-700">{log.detail}</p>;
                  })()
                )}
              </div>
            )) : (
              <div className="py-12 text-center font-mono text-xs text-gray-500">No recent activity logged.</div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
