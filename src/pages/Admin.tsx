import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import {
  BarChart3, Package, FileText, Calendar, LogOut,
  TrendingUp, Activity, Eye, EyeOff, AlertCircle, Loader2,
  CheckCircle2, XCircle, Clock,
} from 'lucide-react';
import { loginAsync, logoutAsync, clearAuthError } from '../store/authSlice';
import { fetchAllBookingsAsync, updateBookingStatusAsync } from '../store/bookingSlice';
import type { AppDispatch, RootState } from '../store';
import type { Booking } from '../types';

const STATUS_STYLES: Record<Booking['status'], string> = {
  pending:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  confirmed: 'bg-green-500/10  text-green-400  border-green-500/30',
  completed: 'bg-blue-500/10   text-blue-400   border-blue-500/30',
  cancelled: 'bg-gray-700      text-gray-400   border-gray-600',
};

// ── Login screen ──────────────────────────────────────────────────────────────
function AdminLogin() {
  const dispatch = useDispatch<AppDispatch>();
  const { status, error } = useSelector((s: RootState) => s.auth);
  const [email, setEmail]   = useState('');
  const [pw,    setPw]      = useState('');
  const [show,  setShow]    = useState(false);

  useEffect(() => () => { dispatch(clearAuthError()); }, [dispatch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(loginAsync({ email, password: pw }));
  };

  return (
    <div className="pt-32 pb-24 min-h-screen bg-brand-darker flex items-center justify-center">
      <div className="bg-brand-dark p-8 rounded-sm border border-gray-800 w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-black text-white uppercase tracking-tighter">
            Admin <span className="text-brand-orange">Login</span>
          </h1>
          <p className="text-gray-400 mt-2">Enter your admin credentials</p>
        </div>

        {error && (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-sm mb-6 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
              className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors rounded-sm"
              placeholder="admin@example.com" />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Password</label>
            <div className="relative">
              <input type={show ? 'text' : 'password'} required value={pw} onChange={e => setPw(e.target.value)}
                className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 pr-12 focus:outline-none focus:border-brand-orange transition-colors rounded-sm"
                placeholder="••••••••" />
              <button type="button" onClick={() => setShow(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <button type="submit" disabled={status === 'loading'}
            className="w-full bg-brand-orange text-white font-bold uppercase tracking-widest py-4 hover:bg-orange-600 transition-colors disabled:opacity-60 flex items-center justify-center gap-2 rounded-sm">
            {status === 'loading'
              ? <span className="animate-spin border-2 border-white border-t-transparent rounded-full w-5 h-5" />
              : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Bookings panel ────────────────────────────────────────────────────────────
function BookingsPanel() {
  const dispatch = useDispatch<AppDispatch>();
  const { token } = useSelector((s: RootState) => s.auth);
  const { appointments, status } = useSelector((s: RootState) => s.booking);
  const [statusFilter, setStatusFilter] = useState<'all' | Booking['status']>('all');

  useEffect(() => {
    if (token) dispatch(fetchAllBookingsAsync(token));
  }, [token, dispatch]);

  const handleStatus = (id: string, newStatus: Booking['status']) => {
    if (!token) return;
    dispatch(updateBookingStatusAsync({ token, id, status: newStatus }));
  };

  const filtered = statusFilter === 'all'
    ? appointments
    : appointments.filter(b => b.status === statusFilter);

  const filters: Array<{ key: 'all' | Booking['status']; label: string }> = [
    { key: 'all',       label: 'All' },
    { key: 'pending',   label: 'Pending' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div>
      <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide mb-6">Client Bookings</h2>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {filters.map(({ key, label }) => (
          <button key={key} onClick={() => setStatusFilter(key)}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-sm border transition-colors ${
              statusFilter === key
                ? 'bg-brand-orange border-brand-orange text-white'
                : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
            }`}>
            {label}
            <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${statusFilter === key ? 'bg-white/20' : 'bg-gray-800'}`}>
              {key === 'all' ? appointments.length : appointments.filter(b => b.status === key).length}
            </span>
          </button>
        ))}
      </div>

      {status === 'loading' && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
        </div>
      )}

      {filtered.length === 0 && status !== 'loading' && (
        <div className="bg-brand-dark border border-gray-800 rounded-sm p-8 text-center text-gray-500">
          <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No {statusFilter !== 'all' ? statusFilter : ''} bookings found.</p>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-x-auto">
          <table className="w-full text-left min-w-[800px]">
            <thead>
              <tr className="border-b border-gray-800 bg-brand-darker/50">
                {['Client', 'Vehicle', 'Service', 'Date & Time', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-5 py-3 text-xs font-bold uppercase tracking-widest text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => (
                <tr key={b.id} className="border-b border-gray-800 hover:bg-brand-darker/40 transition-colors">
                  <td className="px-5 py-4">
                    <p className="text-white font-semibold">{b.name}</p>
                    <p className="text-gray-500 text-xs">{b.phone}</p>
                  </td>
                  <td className="px-5 py-4 text-gray-300 text-sm">{b.vehicleInfo}</td>
                  <td className="px-5 py-4 text-gray-300 text-sm">{b.serviceName}</td>
                  <td className="px-5 py-4 text-gray-300 text-sm">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-500" /> {b.appointmentDate}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-gray-500" /> {b.appointmentTime}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 text-xs font-bold uppercase tracking-widest rounded-sm border ${STATUS_STYLES[b.status]}`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      {b.status === 'pending' && (
                        <button onClick={() => handleStatus(b.id, 'confirmed')}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 text-xs font-bold uppercase rounded-sm transition-colors">
                          <CheckCircle2 className="w-3 h-3" /> Confirm
                        </button>
                      )}
                      {(b.status === 'pending' || b.status === 'confirmed') && (
                        <button onClick={() => handleStatus(b.id, 'cancelled')}
                          className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-bold uppercase rounded-sm transition-colors">
                          <XCircle className="w-3 h-3" /> Cancel
                        </button>
                      )}
                      {b.status === 'confirmed' && (
                        <button onClick={() => handleStatus(b.id, 'completed')}
                          className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 text-xs font-bold uppercase rounded-sm transition-colors">
                          <CheckCircle2 className="w-3 h-3" /> Complete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Content panel (unchanged mock) ────────────────────────────────────────────
function ContentPanel() {
  const [posts, setPosts] = useState([
    { id: 1, title: 'Honda BR-V 2017 Full Setup', type: 'Portfolio', content: 'Equipped with X1 Bi-LED Projector Headlights…', status: 'Published' },
    { id: 2, title: 'Why Upgrade Your Headlights?', type: 'Blog', content: 'Upgrading your headlights is one of the best safety improvements…', status: 'Draft' },
  ]);
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState<{ id: number | null; title: string; type: string; content: string; status: string }>({ id: null, title: '', type: 'Blog', content: '', status: 'Draft' });

  if (editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">{current.id ? 'Edit Content' : 'New Content'}</h2>
          <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-white text-sm font-bold uppercase tracking-widest">Cancel</button>
        </div>
        <form onSubmit={e => {
          e.preventDefault();
          if (current.id) setPosts(posts.map(p => p.id === current.id ? { ...current, id: current.id as number } : p));
          else setPosts([...posts, { ...current, id: Date.now() } as typeof posts[0]]);
          setEditing(false);
        }} className="bg-brand-dark border border-gray-800 rounded-sm p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Title</label>
              <input type="text" required value={current.title} onChange={e => setCurrent({ ...current, title: e.target.value })}
                className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors rounded-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Type</label>
                <select value={current.type} onChange={e => setCurrent({ ...current, type: e.target.value })}
                  className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm appearance-none">
                  <option>Blog</option><option>Portfolio</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Status</label>
                <select value={current.status} onChange={e => setCurrent({ ...current, status: e.target.value })}
                  className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 focus:outline-none focus:border-brand-orange rounded-sm appearance-none">
                  <option>Draft</option><option>Published</option>
                </select>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Content</label>
            <textarea required rows={10} value={current.content} onChange={e => setCurrent({ ...current, content: e.target.value })}
              className="w-full bg-brand-darker border border-gray-800 text-white p-4 focus:outline-none focus:border-brand-orange rounded-sm resize-none" />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm">Save</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">Manage Content</h2>
        <button onClick={() => { setCurrent({ id: null, title: '', type: 'Blog', content: '', status: 'Draft' }); setEditing(true); }}
          className="bg-brand-orange text-white px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-white hover:text-brand-dark transition-colors rounded-sm">
          New Post
        </button>
      </div>
      <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-x-auto">
        <table className="w-full text-left min-w-[500px]">
          <thead>
            <tr className="border-b border-gray-800 bg-brand-darker">
              {['Title', 'Type', 'Status', 'Actions'].map(h => (
                <th key={h} className="p-4 text-xs font-bold uppercase tracking-widest text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {posts.map(post => (
              <tr key={post.id} className="border-b border-gray-800 hover:bg-brand-darker/50 transition-colors">
                <td className="p-4 text-white font-bold">{post.title}</td>
                <td className="p-4 text-gray-400">{post.type}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 text-xs font-bold uppercase tracking-widest rounded-sm ${post.status === 'Published' ? 'bg-green-500/10 text-green-500' : 'bg-gray-800 text-gray-400'}`}>
                    {post.status}
                  </span>
                </td>
                <td className="p-4 text-right">
                  <button onClick={() => { setCurrent(post); setEditing(true); }}
                    className="text-brand-orange hover:text-white transition-colors text-sm font-bold uppercase tracking-widest">
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main Admin page ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { user, token } = useSelector((s: RootState) => s.auth);
  const [activeTab, setActiveTab] = useState('analytics');

  // Not logged in → show admin login form
  if (!user) return <AdminLogin />;

  // Logged in but not admin → redirect
  if (user.role !== 'admin') return <Navigate to="/" replace />;

  const handleLogout = () => {
    dispatch(logoutAsync(token ?? ''));
  };

  const tabs = [
    { key: 'analytics',   label: 'Analytics',  icon: BarChart3  },
    { key: 'products',    label: 'Products',   icon: Package    },
    { key: 'content',     label: 'Content',    icon: FileText   },
    { key: 'appointments', label: 'Bookings',  icon: Calendar   },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'analytics':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide mb-6">Dashboard Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {[
                { label: 'Total Revenue',   value: '₱1,347,500', icon: Activity,   sub: '+12% from last month',  subColor: 'text-green-500' },
                { label: 'Active Bookings', value: '42',         icon: Calendar,   sub: '+5 new this week',      subColor: 'text-green-500' },
                { label: 'Website Visits',  value: '1,204',      icon: TrendingUp, sub: 'Last 30 days',          subColor: 'text-gray-500'  },
              ].map(({ label, value, icon: Icon, sub, subColor }) => (
                <div key={label} className="bg-brand-dark p-6 border border-gray-800 rounded-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-gray-400 font-bold uppercase tracking-widest text-xs">{label}</h3>
                    <Icon className="w-5 h-5 text-brand-orange" />
                  </div>
                  <p className="text-3xl font-display font-bold text-white">{value}</p>
                  <p className={`text-sm mt-2 flex items-center gap-1 ${subColor}`}>{sub}</p>
                </div>
              ))}
            </div>
            <div className="bg-brand-dark p-6 border border-gray-800 rounded-sm h-80 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Revenue Chart (coming soon)</p>
              </div>
            </div>
          </div>
        );

      case 'products':
        return (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">Manage Products</h2>
              <button className="bg-brand-orange text-white px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-white hover:text-brand-dark transition-colors rounded-sm">
                Add Product
              </button>
            </div>
            <div className="bg-brand-dark border border-gray-800 rounded-sm p-8 text-center text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Full product CRUD management coming soon.</p>
            </div>
          </div>
        );

      case 'content':    return <ContentPanel />;
      case 'appointments': return <BookingsPanel />;
      default: return null;
    }
  };

  return (
    <div className="pt-24 min-h-screen bg-brand-darker flex flex-col md:flex-row">
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-brand-dark border-r border-gray-800 flex-shrink-0 flex flex-col md:min-h-[calc(100vh-6rem)]">
        <div className="p-6 border-b border-gray-800">
          <p className="text-white font-display font-bold uppercase tracking-widest text-sm">Admin Panel</p>
          <p className="text-gray-500 text-xs truncate mt-1">{user.email}</p>
        </div>
        <nav className="p-4 space-y-2 flex-grow">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold uppercase tracking-widest transition-colors rounded-sm ${
                activeTab === key ? 'bg-brand-orange text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-800 mt-auto">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold uppercase tracking-widest text-gray-400 hover:text-red-500 transition-colors rounded-sm">
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 p-6 md:p-10 overflow-y-auto pb-24 md:pb-10">
        {renderContent()}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('analytics');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Mock Content State
  const [posts, setPosts] = useState([
    { id: 1, title: 'Honda BR-V 2017 Full Setup', type: 'Portfolio', content: 'Equipped with X1 Bi-LED Projector Headlights and Tri-Color Foglights. Both with 6-8 years lifespan & 3 Years Warranty.', status: 'Published' },
    { id: 2, title: 'Why Upgrade Your Headlights?', type: 'Blog', content: 'Upgrading your headlights is one of the best safety improvements you can make to your vehicle.', status: 'Draft' }
  ]);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [currentPost, setCurrentPost] = useState<{id: number | null, title: string, type: string, content: string, status: string}>({ id: null, title: '', type: 'Blog', content: '', status: 'Draft' });

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock authentication
    if (username === 'admin' && password === 'password') {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Invalid credentials. Try admin / password');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="pt-32 pb-24 min-h-screen bg-brand-darker flex items-center justify-center">
        <div className="bg-brand-dark p-8 rounded-sm border border-gray-800 w-full max-w-md shadow-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-display font-black text-white uppercase tracking-tighter">
              Admin <span className="text-brand-orange">Login</span>
            </h1>
            <p className="text-gray-400 mt-2">Enter your credentials to access the dashboard</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors mb-4"
                placeholder="admin"
              />
              <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors"
                placeholder="••••••••"
              />
              {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
            </div>
            
            <button
              type="submit"
              className="w-full bg-brand-orange text-white font-bold uppercase tracking-widest py-4 hover:bg-white hover:text-brand-dark transition-colors"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'analytics':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide mb-6">Dashboard Overview</h2>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-brand-dark p-6 border border-gray-800 rounded-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-gray-400 font-bold uppercase tracking-widest text-xs">Total Revenue</h3>
                  <DollarSign className="w-5 h-5 text-brand-orange" />
                </div>
                <p className="text-3xl font-display font-bold text-white">$24,500</p>
                <p className="text-green-500 text-sm mt-2 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" /> +12% from last month
                </p>
              </div>
              
              <div className="bg-brand-dark p-6 border border-gray-800 rounded-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-gray-400 font-bold uppercase tracking-widest text-xs">Active Bookings</h3>
                  <Calendar className="w-5 h-5 text-brand-orange" />
                </div>
                <p className="text-3xl font-display font-bold text-white">42</p>
                <p className="text-green-500 text-sm mt-2 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" /> +5 new this week
                </p>
              </div>
              
              <div className="bg-brand-dark p-6 border border-gray-800 rounded-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-gray-400 font-bold uppercase tracking-widest text-xs">Website Visits</h3>
                  <Activity className="w-5 h-5 text-brand-orange" />
                </div>
                <p className="text-3xl font-display font-bold text-white">1,204</p>
                <p className="text-gray-500 text-sm mt-2">Last 30 days</p>
              </div>
            </div>

            {/* Mock Chart Area */}
            <div className="bg-brand-dark p-6 border border-gray-800 rounded-sm h-80 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Revenue Chart Visualization (Mock)</p>
              </div>
            </div>
          </div>
        );
      case 'products':
        return (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">Manage Products</h2>
              <button className="bg-brand-orange text-white px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-white hover:text-brand-dark transition-colors">
                Add Product
              </button>
            </div>
            <div className="bg-brand-dark border border-gray-800 rounded-sm p-8 text-center text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Product management interface will be implemented here.</p>
            </div>
          </div>
        );
      case 'content':
        if (isEditingContent) {
          return (
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">
                  {currentPost.id ? 'Edit Content' : 'New Content'}
                </h2>
                <button 
                  onClick={() => setIsEditingContent(false)}
                  className="text-gray-400 hover:text-white transition-colors uppercase tracking-widest text-sm font-bold"
                >
                  Cancel
                </button>
              </div>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (currentPost.id) {
                    setPosts(posts.map(p => p.id === currentPost.id ? currentPost as any : p));
                  } else {
                    setPosts([...posts, { ...currentPost, id: Date.now() } as any]);
                  }
                  setIsEditingContent(false);
                }} 
                className="bg-brand-dark border border-gray-800 rounded-sm p-6 space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Title</label>
                    <input 
                      type="text" 
                      required
                      value={currentPost.title}
                      onChange={e => setCurrentPost({...currentPost, title: e.target.value})}
                      className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Type</label>
                      <select 
                        value={currentPost.type}
                        onChange={e => setCurrentPost({...currentPost, type: e.target.value})}
                        className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors appearance-none"
                      >
                        <option value="Blog">Blog</option>
                        <option value="Portfolio">Portfolio</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Status</label>
                      <select 
                        value={currentPost.status}
                        onChange={e => setCurrentPost({...currentPost, status: e.target.value})}
                        className="w-full bg-brand-darker border border-gray-800 text-white px-4 py-3 focus:outline-none focus:border-brand-orange transition-colors appearance-none"
                      >
                        <option value="Draft">Draft</option>
                        <option value="Published">Published</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Content (Rich Text)</label>
                  <div className="border border-gray-800 rounded-sm overflow-hidden">
                    <div className="bg-brand-darker border-b border-gray-800 p-2 flex gap-2">
                      <button type="button" className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded"><b>B</b></button>
                      <button type="button" className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded"><i>I</i></button>
                      <button type="button" className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded"><u>U</u></button>
                      <div className="w-px bg-gray-800 mx-1"></div>
                      <button type="button" className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded">H1</button>
                      <button type="button" className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded">H2</button>
                    </div>
                    <textarea 
                      required
                      rows={12}
                      value={currentPost.content}
                      onChange={e => setCurrentPost({...currentPost, content: e.target.value})}
                      className="w-full bg-brand-darker text-white p-4 focus:outline-none resize-none"
                      placeholder="Write your content here..."
                    ></textarea>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors">
                    Save Content
                  </button>
                </div>
              </form>
            </div>
          );
        }

        return (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">Manage Content</h2>
              <button 
                onClick={() => {
                  setCurrentPost({ id: null, title: '', type: 'Blog', content: '', status: 'Draft' });
                  setIsEditingContent(true);
                }}
                className="bg-brand-orange text-white px-4 py-2 text-sm font-bold uppercase tracking-widest hover:bg-white hover:text-brand-dark transition-colors"
              >
                New Post
              </button>
            </div>
            <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[600px]">
                <thead>
                  <tr className="border-b border-gray-800 bg-brand-darker">
                    <th className="p-4 text-xs font-bold uppercase tracking-widest text-gray-500">Title</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-widest text-gray-500">Type</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-widest text-gray-500">Status</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-widest text-gray-500 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map(post => (
                    <tr key={post.id} className="border-b border-gray-800 hover:bg-brand-darker/50 transition-colors">
                      <td className="p-4 text-white font-bold">{post.title}</td>
                      <td className="p-4 text-gray-400">{post.type}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 text-xs font-bold uppercase tracking-widest rounded-sm ${post.status === 'Published' ? 'bg-green-500/10 text-green-500' : 'bg-gray-800 text-gray-400'}`}>
                          {post.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button 
                          onClick={() => {
                            setCurrentPost(post);
                            setIsEditingContent(true);
                          }}
                          className="text-brand-orange hover:text-white transition-colors text-sm font-bold uppercase tracking-widest"
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                  {posts.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-500">No content found. Create your first post!</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 'appointments':
        return (
          <div>
            <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide mb-6">Client Bookings</h2>
            <div className="bg-brand-dark border border-gray-800 rounded-sm p-8 text-center text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Advanced appointment scheduling and calendar view will be implemented here.</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="pt-24 min-h-screen bg-brand-darker flex flex-col md:flex-row">
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-brand-dark border-r border-gray-800 flex-shrink-0 flex flex-col md:min-h-[calc(100vh-6rem)]">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-white font-display font-bold uppercase tracking-widest">Admin Panel</h2>
        </div>
        <nav className="p-4 space-y-2 flex-grow">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold uppercase tracking-widest transition-colors rounded-sm ${
              activeTab === 'analytics' ? 'bg-brand-orange text-white' : 'text-gray-400 hover:text-white hover:bg-brand-gray'
            }`}
          >
            <BarChart3 className="w-4 h-4" /> Analytics
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold uppercase tracking-widest transition-colors rounded-sm ${
              activeTab === 'products' ? 'bg-brand-orange text-white' : 'text-gray-400 hover:text-white hover:bg-brand-gray'
            }`}
          >
            <Package className="w-4 h-4" /> Products
          </button>
          <button
            onClick={() => setActiveTab('content')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold uppercase tracking-widest transition-colors rounded-sm ${
              activeTab === 'content' ? 'bg-brand-orange text-white' : 'text-gray-400 hover:text-white hover:bg-brand-gray'
            }`}
          >
            <FileText className="w-4 h-4" /> Content
          </button>
          <button
            onClick={() => setActiveTab('appointments')}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold uppercase tracking-widest transition-colors rounded-sm ${
              activeTab === 'appointments' ? 'bg-brand-orange text-white' : 'text-gray-400 hover:text-white hover:bg-brand-gray'
            }`}
          >
            <Calendar className="w-4 h-4" /> Bookings
          </button>
        </nav>
        <div className="p-4 border-t border-gray-800 mt-auto">
          <button
            onClick={() => setIsAuthenticated(false)}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold uppercase tracking-widest text-gray-400 hover:text-red-500 transition-colors rounded-sm"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 md:p-10 overflow-y-auto pb-32 md:pb-10">
        {renderContent()}
      </div>
    </div>
  );
}
