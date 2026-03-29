import { useState, useEffect } from 'react';
import {
  BarChart3, Activity, TrendingUp, Calendar, CheckCircle2,
  AlertCircle, Loader2, Sun, Star, Wrench,
} from 'lucide-react';
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

  const statusRows = [
    { label: 'Pending',   value: stats?.pendingBookings   ?? 0, color: 'text-yellow-400' },
    { label: 'Confirmed', value: stats?.confirmedBookings ?? 0, color: 'text-green-400'  },
    { label: 'Completed', value: stats?.completedBookings ?? 0, color: 'text-blue-400'   },
    { label: 'Cancelled', value: stats?.cancelledBookings ?? 0, color: 'text-gray-400'   },
  ];

  const topServices  = stats?.topServices  ?? [];
  const maxSvcCount  = topServices[0]?.count ?? 1;
  const avgRating    = stats?.avgRating ?? 0;
  const reviewCount  = stats?.reviewCount ?? 0;

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
        {/* Bookings by status */}
        <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-800">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
              <BarChart3 className="w-3.5 h-3.5" /> Bookings by Status
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-gray-800">
            {statusRows.map(({ label, value, color }) => (
              <div key={label} className="p-5 text-center">
                <p className={`text-2xl font-display font-bold ${color}`}>{value}</p>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Top services */}
        {topServices.length > 0 && (
          <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-800">
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 flex items-center gap-2">
                <Wrench className="w-3.5 h-3.5" /> Top Services
              </h3>
            </div>
            <div className="p-4 space-y-3">
              {topServices.map(svc => (
                <div key={svc.name}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-300 font-medium truncate">{svc.name}</span>
                    <span className="text-gray-500 shrink-0 ml-2">{svc.count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand-orange rounded-full transition-all"
                      style={{ width: `${Math.round((svc.count / maxSvcCount) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
