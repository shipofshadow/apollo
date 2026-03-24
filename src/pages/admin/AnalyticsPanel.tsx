import { useState, useEffect } from 'react';
import { BarChart3, Activity, TrendingUp, Calendar, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
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
    { label: 'Total Bookings',  value: stats?.totalBookings    ?? 0, icon: Calendar,    color: 'text-gray-400'      },
    { label: 'Active Bookings', value: stats?.activeBookings   ?? 0, icon: Activity,    color: 'text-green-400'     },
    { label: 'Completed',       value: stats?.completedBookings ?? 0, icon: CheckCircle2, color: 'text-blue-400'    },
    { label: 'New This Month',  value: stats?.bookingsThisMonth ?? 0, icon: TrendingUp,  color: 'text-brand-orange' },
  ];

  const statusRows = [
    { label: 'Pending',   value: stats?.pendingBookings   ?? 0, color: 'text-yellow-400' },
    { label: 'Confirmed', value: stats?.confirmedBookings ?? 0, color: 'text-green-400'  },
    { label: 'Completed', value: stats?.completedBookings ?? 0, color: 'text-blue-400'   },
    { label: 'Cancelled', value: stats?.cancelledBookings ?? 0, color: 'text-gray-400'   },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">Dashboard Overview</h2>

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
    </div>
  );
}
