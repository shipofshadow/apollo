import { useState, useEffect } from 'react';
import {
  Activity, TrendingUp, Calendar, CheckCircle2,
  AlertCircle, Loader2, Sun, Star, Wrench,
} from 'lucide-react';
import ReactApexChart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { fetchAdminStatsApi, type AdminStats } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function AnalyticsPanel() {
  const { token } = useAuth();
  const [stats,   setStats]   = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetchAdminStatsApi(token)
      .then(setStats)
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
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
    { label: 'Total Bookings',  value: stats?.totalBookings     ?? 0, icon: Calendar,     color: 'text-gray-400'      },
    { label: 'Active Bookings', value: stats?.activeBookings    ?? 0, icon: Activity,     color: 'text-green-400'     },
    { label: 'Completed',       value: stats?.completedBookings ?? 0, icon: CheckCircle2, color: 'text-blue-400'      },
    { label: 'New This Month',  value: stats?.bookingsThisMonth ?? 0, icon: TrendingUp,   color: 'text-brand-orange'  },
  ];

  const topServices  = stats?.topServices  ?? [];
  const peakHours    = stats?.peakHours    ?? [];
  const avgRating    = stats?.avgRating ?? 0;
  const reviewCount  = stats?.reviewCount ?? 0;

  const statusRows = [
    { label: 'Pending',   value: stats?.pendingBookings   ?? 0 },
    { label: 'Confirmed', value: stats?.confirmedBookings ?? 0 },
    { label: 'Completed', value: stats?.completedBookings ?? 0 },
    { label: 'Cancelled', value: stats?.cancelledBookings ?? 0 },
  ];

  const commonAxisLabelStyle = {
    colors: '#9ca3af',
    fontSize: '12px',
    fontFamily: 'inherit',
  };

  const peakHourOptions: ApexOptions = {
    chart: {
      type: 'area',
      toolbar: { show: false },
      zoom: { enabled: false },
      foreColor: '#9ca3af',
    },
    colors: ['#f97316'],
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

  const peakHourSeries = [
    {
      name: 'Bookings',
      data: peakHours.map(hour => hour.count),
    },
  ];

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
    colors: ['#fbbf24', '#22c55e', '#3b82f6', '#6b7280'],
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
              formatter: () => String(stats?.totalBookings ?? 0),
            },
          },
        },
      },
    },
  };

  const statusDonutSeries = statusRows.map(row => row.value);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">Dashboard Overview</h2>

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
            {stats?.todayBookings ?? 0}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {stats?.todayPending ?? 0} active (pending/confirmed)
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

      <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500">Bookings by Status</h3>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">Distribution</span>
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
    </div>
  );
}
