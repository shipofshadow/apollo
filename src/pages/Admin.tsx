import React, { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import {
  BarChart3, Package, FileText, Calendar, LogOut, Wrench,
  Clock, Eye, EyeOff, AlertCircle, ArrowLeft, UserCog, SlidersHorizontal, HelpCircle, Images,
} from 'lucide-react';
import logo from '../assets/logo.png';
import { useAuth } from '../context/AuthContext';
import AnalyticsPanel      from './admin/AnalyticsPanel';
import BookingsPanel       from './admin/BookingsPanel';
import ServicesPanel       from './admin/ServicesPanel';
import ContentPanel        from './admin/ContentPanel';
import ProductsPanel       from './admin/ProductsPanel';
import AccountSettingsPanel from './admin/AccountSettingsPanel';
import ShopHoursPanel      from './admin/ShopHoursPanel';
import SiteSettingsPanel   from './admin/SiteSettingsPanel';
import FaqPanel            from './admin/FaqPanel';
import PortfolioPanel      from './admin/PortfolioPanel';

// ── Admin login screen ────────────────────────────────────────────────────────
function AdminLogin() {
  const { status, error, login, clearError } = useAuth();
  const [email, setEmail] = useState('');
  const [pw,    setPw]    = useState('');
  const [show,  setShow]  = useState(false);

  useEffect(() => () => { clearError(); }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login(email, pw).catch(() => {});
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

// ── Main Admin page ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, isAdmin, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('analytics');

  if (!user)    return <AdminLogin />;
  if (!isAdmin) return <Navigate to="/" replace />;

  const tabs = [
    { key: 'analytics',    label: 'Analytics',      icon: BarChart3          },
    { key: 'services',     label: 'Services',       icon: Wrench             },
    { key: 'portfolio',    label: 'Portfolio',      icon: Images             },
    { key: 'content',      label: 'Content',        icon: FileText           },
    { key: 'appointments', label: 'Bookings',       icon: Calendar           },
    { key: 'products',     label: 'Products',       icon: Package            },
    { key: 'faq',          label: 'FAQ',            icon: HelpCircle         },
    { key: 'shop-hours',   label: 'Shop Hours',     icon: Clock              },
    { key: 'site-settings', label: 'Site Settings', icon: SlidersHorizontal  },
    { key: 'settings',     label: 'Settings',       icon: UserCog            },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'analytics':     return <AnalyticsPanel />;
      case 'services':      return <ServicesPanel />;
      case 'portfolio':     return <PortfolioPanel />;
      case 'content':       return <ContentPanel />;
      case 'appointments':  return <BookingsPanel />;
      case 'products':      return <ProductsPanel />;
      case 'faq':           return <FaqPanel />;
      case 'shop-hours':    return <ShopHoursPanel />;
      case 'site-settings': return <SiteSettingsPanel />;
      case 'settings':      return <AccountSettingsPanel />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-brand-darker flex flex-col">
      {/* Top bar */}
      <header className="h-16 bg-brand-dark border-b border-gray-800 flex items-center justify-between px-4 md:px-6 shrink-0 z-30">
        <div className="flex items-center gap-4">
          <img src={logo} alt="1625 Autolab" className="h-8 w-auto object-contain" referrerPolicy="no-referrer" />
          <span className="hidden sm:block text-gray-600 text-lg select-none">/</span>
          <span className="hidden sm:block text-xs font-bold uppercase tracking-widest text-brand-orange">Admin Panel</span>
        </div>
        <div className="flex items-center gap-3">
          <a href="/"
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-brand-orange transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Site
          </a>
          <div className="w-px h-5 bg-gray-700" />
          <button onClick={() => logout()}
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-red-400 transition-colors">
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-16 md:w-60 bg-brand-dark border-r border-gray-800 flex-shrink-0 flex flex-col">
          {/* User card */}
          <div className="p-4 md:p-5 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-brand-orange/20 border-2 border-brand-orange/40 flex items-center justify-center shrink-0">
                <span className="text-brand-orange font-black text-sm uppercase">
                  {user.name?.[0] ?? 'A'}
                </span>
              </div>
              <div className="hidden md:block min-w-0">
                <p className="text-white font-bold text-sm truncate leading-tight">{user.name}</p>
                <p className="text-gray-500 text-xs truncate">{user.email}</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="p-2 md:p-3 space-y-0.5 flex-grow">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setActiveTab(key)}
                title={label}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold uppercase tracking-widest transition-all duration-150 rounded-sm relative ${
                  activeTab === key
                    ? 'text-brand-orange bg-brand-orange/10'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                }`}>
                <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-brand-orange rounded-r-full transition-opacity ${activeTab === key ? 'opacity-100' : 'opacity-0'}`} />
                <Icon className="w-4 h-4 shrink-0" />
                <span className="hidden md:inline">{label}</span>
              </button>
            ))}
          </nav>

          {/* Logout (mobile only) */}
          <div className="md:hidden p-2 border-t border-gray-800">
            <button onClick={() => logout()}
              title="Sign Out"
              className="w-full flex items-center justify-center px-3 py-2.5 rounded-sm text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-red-400 transition-colors">
              <LogOut className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-5 md:p-8 lg:p-10">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
