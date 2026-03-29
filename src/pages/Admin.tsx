import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  BarChart3, Package, FileText, Calendar, LogOut, Wrench,
  Clock, Eye, EyeOff, AlertCircle, ArrowLeft, UserCog, SlidersHorizontal, HelpCircle, Tag,
  Menu, X, ChevronLeft, ChevronRight, ChevronDown, Star, CalendarDays, ShieldCheck,
} from 'lucide-react';
import logo from '../assets/logo.png';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';
import AnalyticsPanel       from './admin/AnalyticsPanel';
import BookingsPanel        from './admin/BookingsPanel';
import AdminBookingDetail   from './admin/AdminBookingDetail';
import ServicesPanel        from './admin/ServicesPanel';
import ContentPanel         from './admin/ContentPanel';
import ProductsPanel        from './admin/ProductsPanel';
import AccountSettingsPanel from './admin/AccountSettingsPanel';
import ShopHoursPanel       from './admin/ShopHoursPanel';
import SiteSettingsPanel    from './admin/SiteSettingsPanel';
import FaqPanel             from './admin/FaqPanel';
import OffersPanel          from './admin/OffersPanel';
import ReviewsPanel         from './admin/ReviewsPanel';
import CalendarPanel        from './admin/CalendarPanel';
import UserAccessPanel      from './admin/UserAccessPanel';
import SecurityAuditPanel   from './admin/SecurityAuditPanel';

// ── Admin login screen (Unchanged) ────────────────────────────────────────────
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
  const { user, logout } = useAuth();
  const location = useLocation();
  const [activeTab,       setActiveTab]       = useState('analytics');
  const [collapsed,       setCollapsed]       = useState(false);
  const [mobileOpen,      setMobileOpen]      = useState(false);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  
  // Track which dropdown groups are open
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    shop: true,
    content: true,
    settings: false,
  });

  // When navigated here from a notification click, auto-open the booking
  useEffect(() => {
    const state = location.state as { openBookingId?: string } | null;
    if (state?.openBookingId) {
      setActiveTab('appointments');
      setActiveBookingId(state.openBookingId);
      // Clear the state so a back-navigation doesn't re-trigger it
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    setActiveBookingId(null);
    setMobileOpen(false);
  };

  const toggleGroup = (groupKey: string) => {
    setOpenGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));
    // If user clicks a group while sidebar is collapsed, expand the sidebar automatically
    if (collapsed) setCollapsed(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    // Prevent stale mobile overlay state from persisting across logout/login transitions.
    setMobileOpen(false);
  }, [user?.id]);

  const MD_BREAKPOINT = 768;
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${MD_BREAKPOINT}px)`);
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setMobileOpen(false); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const role = user?.role ?? '';
  const isAdmin = role === 'admin';

  const canAccessTab = (key: string) => {
    if (isAdmin) return true;

    if (role === 'manager') {
      return ['analytics', 'appointments', 'calendar', 'user-access', 'security-audit', 'settings'].includes(key);
    }

    if (role === 'staff') {
      return ['appointments', 'calendar', 'user-access', 'settings'].includes(key);
    }

    // Unknown non-client roles get the safest minimum surface.
    return ['user-access', 'settings'].includes(key);
  };

  // Grouped Navigation Structure
  const navItems = [
    { key: 'analytics',    label: 'Analytics',  icon: BarChart3 },
    { key: 'appointments', label: 'Bookings',   icon: Calendar },
    { key: 'calendar',     label: 'Calendar',   icon: CalendarDays },
    { key: 'reviews',      label: 'Reviews',    icon: Star },
    {
      isGroup: true, key: 'shop', label: 'Manage Shop', icon: Wrench,
      children: [
        { key: 'services',   label: 'Services',   icon: Wrench },
        { key: 'products',   label: 'Products',   icon: Package },
        { key: 'shop-hours', label: 'Shop Hours', icon: Clock },
      ]
    },
    {
      isGroup: true, key: 'content', label: 'Site Content', icon: FileText,
      children: [
        { key: 'offers',    label: 'Offers',    icon: Tag },
        { key: 'content',   label: 'Content',   icon: FileText },
        { key: 'faq',       label: 'FAQ',       icon: HelpCircle },
      ]
    },
    {
      isGroup: true, key: 'settings', label: 'Settings', icon: SlidersHorizontal,
      children: [
        { key: 'site-settings', label: 'Site Config', icon: SlidersHorizontal },
        { key: 'user-access',   label: 'User Access', icon: ShieldCheck },
        { key: 'security-audit', label: 'Security Audit', icon: ShieldCheck },
        { key: 'settings',      label: 'Account',     icon: UserCog },
      ]
    }
  ];

  useEffect(() => {
    if (!user) return;
    if (canAccessTab(activeTab)) return;
    const fallback = role === 'staff' ? 'appointments' : (role === 'manager' ? 'analytics' : 'user-access');
    setActiveTab(fallback);
    setActiveBookingId(null);
  }, [activeTab, role, user]);

  if (!user) return <AdminLogin />;
  if (user.role === 'client') return <Navigate to="/" replace />;

  const renderContent = () => {
    switch (activeTab) {
      case 'analytics':     return <AnalyticsPanel />;
      case 'services':      return <ServicesPanel />;
      case 'offers':        return <OffersPanel />;
      case 'content':       return <ContentPanel />;
      case 'calendar':      return <CalendarPanel onView={id => { setActiveBookingId(id); setActiveTab('appointments'); }} />;
      case 'reviews':       return <ReviewsPanel />;
      case 'appointments':
        if (activeBookingId) {
          return (
            <AdminBookingDetail
              bookingId={activeBookingId}
              onBack={() => setActiveBookingId(null)}
            />
          );
        }
        return <BookingsPanel onView={id => setActiveBookingId(id)} />;
      case 'products':      return <ProductsPanel />;
      case 'faq':           return <FaqPanel />;
      case 'shop-hours':    return <ShopHoursPanel />;
      case 'site-settings': return <SiteSettingsPanel />;
      case 'user-access':   return <UserAccessPanel />;
      case 'security-audit': return <SecurityAuditPanel />;
      case 'settings':      return <AccountSettingsPanel />;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-brand-darker flex flex-col">
      {/* Top bar */}
      <header className="h-14 md:h-16 bg-brand-dark border-b border-gray-800 flex items-center justify-between px-3 md:px-6 shrink-0 z-30">
        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={() => setMobileOpen(v => !v)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            className="md:hidden p-1.5 rounded-sm text-gray-400 hover:text-white hover:bg-gray-800/60 transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <img src={logo} alt="1625 Autolab" className="h-7 md:h-8 w-auto object-contain" referrerPolicy="no-referrer" />
          <span className="hidden sm:block text-gray-600 text-lg select-none">/</span>
          <span className="hidden sm:block text-xs font-bold uppercase tracking-widest text-brand-orange">Admin Panel</span>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <a href="/"
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-brand-orange transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back to Site</span>
          </a>
          <div className="w-px h-5 bg-gray-700" />
          <NotificationBell />
          <button
            type="button"
            onClick={() => handleTabChange('settings')}
            title="Open account settings"
            className="w-8 h-8 rounded-full bg-brand-orange/20 border border-brand-orange/40 hover:border-brand-orange flex items-center justify-center overflow-hidden shrink-0 transition-colors"
          >
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt="Open account settings"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <span className="text-brand-orange font-black text-xs uppercase">
                {user.name?.[0] ?? 'A'}
              </span>
            )}
          </button>
          <div className="w-px h-5 bg-gray-700" />
          <button onClick={() => logout()}
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-red-400 transition-colors">
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      <div className="flex relative">
        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-20 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`
          absolute md:relative top-0 bottom-0 md:top-auto md:bottom-auto left-0 z-30 md:z-auto
          flex flex-col bg-brand-dark border-r border-gray-800 flex-shrink-0
          transition-all duration-300 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${collapsed ? 'md:w-16' : 'md:w-60'}
          w-64 h-full md:h-auto
        `}>
          {/* User card */}
          <div className={`border-b border-gray-800 ${collapsed ? 'p-3' : 'p-4 md:p-5'}`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-brand-orange/20 border-2 border-brand-orange/40 flex items-center justify-center shrink-0 overflow-hidden">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt="User avatar"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <span className="text-brand-orange font-black text-sm uppercase">
                    {user.name?.[0] ?? 'A'}
                  </span>
                )}
              </div>
              {!collapsed && (
                <div className="min-w-0">
                  <p className="text-white font-bold text-sm truncate leading-tight">{user.name}</p>
                  <p className="text-gray-500 text-xs truncate">{user.email}</p>
                </div>
              )}
            </div>
          </div>

          {/* Nav */}
          <nav className={`${collapsed ? 'p-2' : 'p-2 md:p-3'} space-y-1 flex-grow`}>
            {navItems.map((item) => {
              if (item.isGroup && item.children) {
                const visibleChildren = item.children.filter(child => canAccessTab(child.key));
                if (visibleChildren.length === 0) return null;

                const isOpen = openGroups[item.key];
                const GroupIcon = item.icon;
                
                return (
                  <div key={item.key} className="mb-2">
                    {/* Group Header */}
                    <button
                      onClick={() => toggleGroup(item.key)}
                      title={collapsed ? item.label : undefined}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold uppercase tracking-widest transition-all duration-150 rounded-sm text-gray-500 hover:text-white hover:bg-gray-800/60 ${collapsed ? 'justify-center' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <GroupIcon className="w-4 h-4 shrink-0" />
                        {!collapsed && <span>{item.label}</span>}
                      </div>
                      {!collapsed && (
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                      )}
                    </button>

                    {/* Group Children */}
                    {isOpen && (
                      <div className={`mt-0.5 space-y-0.5 ${collapsed ? '' : 'pl-3 border-l border-gray-800/50 ml-3'}`}>
                        {visibleChildren.map(child => {
                          const ChildIcon = child.icon;
                          const isActive = activeTab === child.key;
                          return (
                            <button
                              key={child.key}
                              onClick={() => handleTabChange(child.key)}
                              title={collapsed ? child.label : undefined}
                              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold uppercase tracking-widest transition-all duration-150 rounded-sm relative ${
                                isActive
                                  ? 'text-brand-orange bg-brand-orange/10'
                                  : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                              } ${collapsed ? 'justify-center' : ''}`}
                            >
                              <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-brand-orange rounded-r-full transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                              <ChildIcon className="w-3.5 h-3.5 shrink-0" />
                              {!collapsed && <span>{child.label}</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              // Flat Items
              const FlatIcon = item.icon as React.ElementType;
              const isActive = activeTab === item.key;
              if (!canAccessTab(item.key)) return null;
              return (
                <div key={item.key} className="mb-1">
                  <button
                    onClick={() => handleTabChange(item.key)}
                    title={collapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold uppercase tracking-widest transition-all duration-150 rounded-sm relative ${
                      isActive
                        ? 'text-brand-orange bg-brand-orange/10'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                    } ${collapsed ? 'justify-center' : ''}`}
                  >
                    <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-brand-orange rounded-r-full transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                    <FlatIcon className="w-4 h-4 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </button>
                </div>
              );
            })}
          </nav>

          {/* Collapse toggle (desktop) + Logout (mobile) */}
          <div className="border-t border-gray-800 p-2 flex items-center gap-2 bg-brand-dark mt-auto shrink-0">
            {/* Desktop collapse button */}
            <button
              onClick={() => setCollapsed(v => !v)}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="hidden md:flex items-center justify-center w-full px-3 py-2 rounded-sm text-gray-500 hover:text-white hover:bg-gray-800/60 transition-colors"
            >
              {collapsed
                ? <ChevronRight className="w-4 h-4" />
                : <><ChevronLeft className="w-4 h-4 mr-2" /><span className="text-xs font-bold uppercase tracking-widest">Collapse</span></>
              }
            </button>

            {/* Mobile logout */}
            <button onClick={() => logout()}
              title="Sign Out"
              className="md:hidden w-full flex items-center gap-2 px-3 py-2.5 rounded-sm text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-red-400 transition-colors">
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 min-w-0">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}