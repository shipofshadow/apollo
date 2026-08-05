import { useState, useEffect } from 'react';
import {
  Activity, TrendingUp, Calendar, CheckCircle2,
  AlertCircle, Loader2, Sun, Star, Wrench, PieChart, Download, Info
} from 'lucide-react';
import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { fetchAdminStatsApi, fetchAdminActivityApi, type AdminStats, type AdminActivityLog } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const STATUS_STYLES: Record<string, string> = {
  'pending': 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20',
  'confirmed': 'bg-green-500/10 text-green-500 border border-green-500/20',
  'in_progress': 'bg-blue-500/10 text-blue-500 border border-blue-500/20',
  'completed': 'bg-purple-500/10 text-purple-500 border border-purple-500/20',
  'cancelled': 'bg-red-500/10 text-red-500 border border-red-500/20',
};

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

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-sm text-sm">
      <AlertCircle className="w-4 h-4 shrink-0" /> {error}
    </div>
  );

  const topCards = [
    { label: 'Total Appointments', value: stats?.totalAppointments ?? 0, icon: Calendar, color: 'text-gray-400' },
    { label: 'Active Appointments', value: stats?.activeAppointments ?? 0, icon: Activity, color: 'text-green-400' },
    { label: 'Completed', value: (stats?.completedBookings ?? 0) + (stats?.completedInquiries ?? 0), icon: CheckCircle2, color: 'text-blue-400' },
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
    fontSize: '12px',
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
    colors: ['#fbbf24', '#22c55e', '#a855f7', '#3b82f6', '#6b7280'],
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
          size: '62%',
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">Dashboard Overview</h2>

        <div className="flex items-center gap-4 bg-brand-dark border border-gray-800 px-4 py-2 rounded-sm">
          {timeframe === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="bg-transparent border border-gray-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-brand-orange"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
              />
              <span className="text-gray-500 text-xs">to</span>
              <input
                type="date"
                className="bg-transparent border border-gray-700 rounded px-2 py-1 text-xs text-white outline-none focus:border-brand-orange"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
              />
            </div>
          )}
          <select
            className="bg-transparent text-[10px] font-semibold uppercase tracking-widest text-gray-400 focus:outline-none cursor-pointer border-none p-0 focus:ring-0"
            value={timeframe}
            onChange={e => setTimeframe(e.target.value)}
          >
            <option value="all_time">All Time</option>
            <option value="this_week">This Week</option>
            <option value="this_month">This Month</option>
            <option value="custom">Custom Date</option>
          </select>
        </div>
      </div>

      {/* Today's quick-glance row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="relative bg-brand-dark border border-gray-800 rounded-sm overflow-hidden px-5 py-4">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-orange" />
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-brand-orange" /> Today's Appointments
            </span>
          </div>
          <p className="text-4xl font-display font-bold text-brand-orange">
            {stats?.todayAppointments ?? 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {stats?.todayActiveAppointments ?? 0} active (pending/confirmed/in-progress)
          </p>
        </div>

        <div className="bg-brand-dark border border-gray-800 rounded-sm px-5 py-4 flex items-center gap-4">
          <div className="shrink-0">
            <div className="flex items-center gap-1 mb-1">
              {[1, 2, 3, 4, 5].map(n => (
                <Star
                  key={n}
                  className={`w-4 h-4 ${n <= Math.round(avgRating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-700'}`}
                />
              ))}
            </div>
            <p className="text-3xl font-display font-bold text-white">
              {reviewCount > 0 ? avgRating.toFixed(1) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Avg. Rating</p>
            <p className="text-xs text-gray-600 mt-0.5">{reviewCount} approved review{reviewCount !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Main stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {topCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-brand-dark p-6 border border-gray-800 rounded-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-400 font-bold uppercase tracking-widest text-xs">{label}</h3>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <p className="text-3xl font-display font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Peak Booking Hours</h3>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">Top time slots</span>
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
              <div className="h-[280px] grid place-items-center text-sm text-gray-500">
                Not enough booking data to plot peak hours yet.
              </div>
            )}
          </div>
        </div>

        <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
              <Wrench className="w-3.5 h-3.5" /> Popular Services
            </h3>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">By booking count</span>
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
              <div className="h-[280px] grid place-items-center text-sm text-gray-500">
                Popular services will appear after bookings are recorded.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6">
        {/* Appointments by Status */}
        <div className="lg:col-span-8 bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
                <PieChart className="w-3.5 h-3.5" /> Appointments by Status
              </h3>
              <div className="group relative flex items-center">
                <Info className="w-3.5 h-3.5 text-gray-600 cursor-help" />
                <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-gray-900 border border-gray-700 text-[10px] text-gray-300 rounded shadow-xl z-10 text-center">
                  Includes all bookings and inquiries combined.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-brand-orange bg-brand-orange/10 px-2 py-0.5 rounded-full">
                Total: {stats?.totalAppointments ?? 0}
              </span>
              <button className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 hover:text-white transition-colors flex items-center gap-1" onClick={handleExport}>
                <Download className="w-3 h-3" /> Export
              </button>
            </div>
          </div>
          <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-5 items-center">
            <div className="lg:col-span-2">
              <ReactApexChart
                type="donut"
                height={310}
                series={statusDonutSeries}
                options={statusDonutOptions}
              />
            </div>

            <div className="space-y-2">
              {statusRows.map(row => (
                <div
                  key={row.label}
                  className="flex items-center justify-between border border-gray-800 bg-black/20 rounded-sm px-3 py-2"
                >
                  <span className="text-xs font-bold uppercase tracking-widest text-gray-500">{row.label}</span>
                  <span className="text-lg font-display font-bold text-white">{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity Feed */}
        <div className="lg:col-span-4 bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Recent Activity</h3>
          </div>
          <div className="divide-y divide-gray-800/50 max-h-[400px] overflow-y-auto font-mono">
            {activities.length > 0 ? activities.map(log => (
              <div key={`${log.source}-${log.id}`} className="px-5 py-4 hover:bg-gray-800/20 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[12px] text-brand-orange">
                    {new Date(log.created_at).toISOString().replace('T', ' ').substring(0, 19)}Z
                  </p>
                  <span className={`px-1.5 py-0.5 rounded-sm text-[10px] uppercase font-bold tracking-widest ${log.source === 'booking' ? 'bg-brand-orange/10 text-brand-orange' : 'bg-blue-500/10 text-blue-400'}`}>
                    {log.source}
                  </span>
                </div>

                <div className="text-[11px] text-gray-300 uppercase font-bold flex flex-wrap items-center gap-1.5 leading-relaxed">
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
                          <span className={`px-2 py-0.5 rounded-full ${STATUS_STYLES[extractedStatus]} font-bold tracking-widest text-[9px]`}>
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
                        <div className="mt-2 pl-3 border-l border-gray-700 flex items-center gap-2 text-[10px]">
                          <span className="text-gray-500 uppercase">{prefixText}</span>
                          <span className={`px-2 py-0.5 rounded-full ${STATUS_STYLES[extractedStatus]} font-bold tracking-widest text-[9px]`}>
                            {extractedStatus.replace('_', ' ')}
                          </span>
                        </div>
                      );
                    }

                    return <p className="text-[10px] text-gray-500 mt-2 pl-3 border-l border-gray-700">{log.detail}</p>;
                  })()
                )}
              </div>
            )) : (
              <div className="py-8 text-center font-mono text-xs text-gray-500">Log empty.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
