import React, { useState, useEffect, useCallback } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3, Package, FileText, Calendar, LogOut, Wrench,
  Clock, ArrowLeft, UserCog, SlidersHorizontal, HelpCircle, Tag,
  Menu, X, ChevronLeft, ChevronRight, ChevronDown, Star, CalendarDays, ShieldCheck,
  Camera, MessageSquare, GitBranch, Users, Workflow, Megaphone, Boxes, Activity,
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
import OrdersPanel          from './admin/OrdersPanel';
import AccountSettingsPanel from './admin/AccountSettingsPanel';
import SemaphorePanel       from './admin/SemaphorePanel';
import ShopHoursPanel       from './admin/ShopHoursPanel';
import SiteSettingsPanel    from './admin/SiteSettingsPanel';
import FaqPanel             from './admin/FaqPanel';
import OffersPanel          from './admin/OffersPanel';
import BeforeAfterPanel     from './admin/BeforeAfterPanel';
import ReviewsPanel         from './admin/ReviewsPanel';
import CalendarPanel        from './admin/CalendarPanel';
import ManageUsersPanel     from './admin/ManageUsersPanel';
import ManageClientsPanel   from './admin/ManageClientsPanel';
import ManageRolesPanel     from './admin/ManageRolesPanel';
import ClientDetailPanel    from './admin/ClientDetailPanel';
import SecurityAuditPanel   from './admin/SecurityAuditPanel';
import ActivityLogsPanel    from './admin/ActivityLogsPanel';
import NotificationQueuePanel from './admin/NotificationQueuePanel';
import MarketingCampaignsPanel from './admin/MarketingCampaignsPanel';
import InventoryPanel from './admin/InventoryPanel';
import ConversationsPage    from './chatbot/ConversationsPage';
import FlowEditorPage       from './chatbot/FlowEditorPage';
import type { ClientAdminSummary } from '../types';
import { getDicebearAvatarDataUri } from '../utils/avatar';

const TAB_PATHS: Record<string, string> = {
  analytics: '/admin/dashboard',
  appointments: '/admin/bookings',
  calendar: '/admin/calendar',
  reviews: '/admin/reviews',
  'chatbot-conversations': '/chatbot/conversations',
  'chatbot-flow': '/chatbot/flow-editor',
  services: '/admin/services',
  products: '/admin/products',
  orders: '/admin/orders',
  'shop-hours': '/admin/shop-hours',
  offers: '/admin/offers',
  'before-after': '/admin/before-after',
  content: '/admin/content',
  faq: '/admin/faq',
  'site-settings': '/admin/site-settings',
  'manage-users': '/admin/manage-users',
  'manage-clients': '/admin/manage-clients',
  'manage-roles': '/admin/manage-roles',
  'marketing-campaigns': '/admin/marketing-campaigns',
  inventory: '/admin/inventory',
  'security-audit': '/admin/security-audit',
  'activity-logs': '/admin/activity-logs',
  'notification-queue': '/admin/notification-queue',
  'semaphore': '/admin/semaphore',
  settings: '/admin/account',
};

function getAdminTabFromPath(pathname: string): string {
  for (const [tab, path] of Object.entries(TAB_PATHS)) {
    if (pathname === path || pathname.startsWith(`${path}/`)) {
      return tab;
    }
  }
  if (pathname === '/admin' || pathname === '/admin/') {
    return 'analytics';
  }
  return 'analytics';
}
// ── Main Admin page ───────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, logout, hasPermission } = useAuth();
  const fallbackAvatar = getDicebearAvatarDataUri({ id: user?.id, name: user?.name, email: user?.email });
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = getAdminTabFromPath(location.pathname);
  const [collapsed,       setCollapsed]       = useState(false);
  const [mobileOpen,      setMobileOpen]      = useState(false);
  const [activeBookingId, setActiveBookingId] = useState<string | null>(null);
  const [activeClient,    setActiveClient]    = useState<ClientAdminSummary | null>(null);
  const routeState = location.state as { openBookingId?: string } | null;
  const routeBookingId = routeState?.openBookingId ?? null;
  const selectedBookingId = activeBookingId ?? routeBookingId;
  
  // Track which dropdown groups are open
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    chatbot: true,
    shop: true,
    content: true,
    people: true,
    settings: false,
  });

  // When navigated here from a notification click, auto-open the booking
  useEffect(() => {
    if (routeBookingId) {
      if (!location.pathname.startsWith(TAB_PATHS.appointments)) {
        navigate(TAB_PATHS.appointments, { replace: true });
      }
      // Clear the state so a back-navigation doesn't re-trigger it
      window.history.replaceState({}, '');
    }
  }, [routeBookingId, location.pathname, navigate]);

  useEffect(() => {
    if ((location.pathname === '/admin' || location.pathname === '/admin/') && !routeBookingId) {
      navigate(TAB_PATHS.analytics, { replace: true });
    }
  }, [location.pathname, routeBookingId, navigate]);

  const handleTabChange = (key: string) => {
    const nextPath = TAB_PATHS[key] || TAB_PATHS.analytics;
    setActiveBookingId(null);
    setActiveClient(null);
    setMobileOpen(false);
    navigate(nextPath);
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

  const MD_BREAKPOINT = 768;
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${MD_BREAKPOINT}px)`);
    const handler = (e: MediaQueryListEvent) => { if (e.matches) setMobileOpen(false); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const role = (user?.role) ?? '';
  const isAdmin = role === 'admin' || role === 'owner';

  const canAccessTab = useCallback((key: string) => {
    if (['products', 'orders'].includes(key)) {
      return hasPermission('products:manage');
    }

    if (key === 'inventory') {
      return hasPermission('products:manage');
    }

    if (key === 'marketing-campaigns') {
      return hasPermission('settings:manage');
    }

    if (['chatbot', 'chatbot-conversations', 'chatbot-flow'].includes(key)) {
      return hasPermission('chatbot:manage');
    }

    if (key === 'semaphore') {
      return hasPermission('settings:manage');
    }

    if (key === 'notification-queue') {
      return hasPermission('settings:manage');
    }

    if (key === 'activity-logs') {
      return role === 'owner';
    }

    if (isAdmin) return true;

    if (role === 'manager') {
      return ['analytics', 'appointments', 'calendar', 'manage-clients', 'manage-roles', 'security-audit', 'settings'].includes(key);
    }

    if (role === 'staff') {
      return ['appointments', 'calendar', 'manage-clients', 'settings'].includes(key);
    }

    // Unknown non-client roles get the safest minimum surface.
    return ['manage-clients', 'settings'].includes(key);
  }, [hasPermission, isAdmin, role]);

  // Grouped Navigation Structure
  const navItems = [
    { key: 'analytics',    label: 'Analytics',  icon: BarChart3 },
    { key: 'appointments', label: 'Bookings',   icon: Calendar },
    { key: 'calendar',     label: 'Calendar',   icon: CalendarDays },
    { key: 'reviews',      label: 'Reviews',    icon: Star },
    {
      isGroup: true, key: 'chatbot', label: 'Chatbot', icon: MessageSquare,
      children: [
        { key: 'chatbot-conversations', label: 'Conversations', icon: MessageSquare },
        { key: 'chatbot-flow',          label: 'Flow Editor',  icon: GitBranch },
      ]
    },
    {
      isGroup: true, key: 'shop', label: 'Manage Shop', icon: Wrench,
      children: [
        { key: 'services',   label: 'Services',   icon: Wrench },
        { key: 'products',   label: 'Products',   icon: Package },
        { key: 'orders',     label: 'Orders',     icon: Package },
        { key: 'inventory',  label: 'Inventory',  icon: Boxes },
        { key: 'shop-hours', label: 'Shop Hours', icon: Clock },
      ]
    },
    {
      isGroup: true, key: 'content', label: 'Site Content', icon: FileText,
      children: [
        { key: 'offers',    label: 'Offers',    icon: Tag },
        { key: 'before-after', label: 'Before/After', icon: Camera },
        { key: 'content',   label: 'Content',   icon: FileText },
        { key: 'faq',       label: 'FAQ',       icon: HelpCircle },
      ]
    },
    {
      isGroup: true, key: 'people', label: 'People', icon: Users,
      children: [
        { key: 'manage-clients', label: 'Manage Clients', icon: Users },
        { key: 'manage-users',   label: 'Manage Users',   icon: UserCog },
        { key: 'manage-roles',   label: 'Manage Roles',   icon: ShieldCheck },
      ]
    },
    {
      isGroup: true, key: 'settings', label: 'Settings', icon: SlidersHorizontal,
      children: [
        { key: 'marketing-campaigns', label: 'Campaigns', icon: Megaphone },
        { key: 'site-settings', label: 'Site Config',     icon: SlidersHorizontal },
        { key: 'security-audit', label: 'Security Audit', icon: ShieldCheck },
        { key: 'activity-logs', label: 'Activity Logs', icon: Activity },
        { key: 'notification-queue', label: 'Queue Monitor', icon: Workflow },
        { key: 'semaphore',     label: 'Semaphore SMS',   icon: MessageSquare },
        { key: 'settings',      label: 'Account',         icon: UserCog },
      ]
    }
  ];

  useEffect(() => {
    if (!user) return;
    if (canAccessTab(activeTab)) return;
    const fallback = role === 'staff' ? 'appointments' : (role === 'manager' ? 'analytics' : 'manage-clients');
    navigate(TAB_PATHS[fallback] || TAB_PATHS.analytics, { replace: true });
  }, [activeTab, role, user, navigate, canAccessTab]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'client') return <Navigate to="/" replace />;

  const renderContent = () => {
    switch (activeTab) {
      case 'analytics':     return <AnalyticsPanel />;
      case 'services':      return <ServicesPanel />;
      case 'offers':        return <OffersPanel />;
      case 'before-after':  return <BeforeAfterPanel />;
      case 'content':       return <ContentPanel />;
      case 'calendar':      return <CalendarPanel onView={id => { setActiveBookingId(id); navigate(TAB_PATHS.appointments); }} />;
      case 'reviews':       return <ReviewsPanel />;
      case 'chatbot-conversations': return <ConversationsPage />;
      case 'chatbot-flow':  return <FlowEditorPage />;
      case 'appointments':
        if (selectedBookingId) {
          return (
            <AdminBookingDetail
              bookingId={selectedBookingId}
              onBack={() => { setActiveBookingId(null); navigate(TAB_PATHS.appointments); }}
            />
          );
        }
        return <BookingsPanel onView={id => { setActiveBookingId(id); navigate(TAB_PATHS.appointments); }} />;
      case 'products':      return <ProductsPanel />;
      case 'orders':        return <OrdersPanel />;
      case 'inventory':     return <InventoryPanel />;
      case 'faq':           return <FaqPanel />;
      case 'shop-hours':    return <ShopHoursPanel />;
      case 'site-settings': return <SiteSettingsPanel />;
      case 'manage-users':  return <ManageUsersPanel />;
      case 'manage-roles':  return <ManageRolesPanel />;
      case 'marketing-campaigns': return <MarketingCampaignsPanel />;
      case 'manage-clients':
        if (activeClient) {
          return (
            <ClientDetailPanel
              client={activeClient}
              onBack={() => { setActiveClient(null); navigate(TAB_PATHS['manage-clients']); }}
              onViewBooking={(id) => {
                setActiveBookingId(id);
                setActiveClient(null);
                navigate(TAB_PATHS.appointments, { state: { openBookingId: id } });
              }}
            />
          );
        }
        return (
          <ManageClientsPanel
            onView={client => {
              setActiveClient(client);
              navigate(TAB_PATHS['manage-clients']);
            }}
          />
        );
      case 'security-audit': return <SecurityAuditPanel />;
      case 'activity-logs': return <ActivityLogsPanel />;
      case 'notification-queue': return <NotificationQueuePanel />;
      case 'semaphore':     return <SemaphorePanel />;
      case 'settings':      return <AccountSettingsPanel />;
      default: return null;
    }
  };

  const isChatbotTab = activeTab === 'chatbot-conversations' || activeTab === 'chatbot-flow';

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
            <img
              src={user.avatar_url || fallbackAvatar}
              alt="Open account settings"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={e => {
                const img = e.currentTarget;
                if (img.src !== fallbackAvatar) {
                  img.src = fallbackAvatar;
                }
              }}
            />
          </button>
          <div className="w-px h-5 bg-gray-700" />
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-red-400 transition-colors">
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      <div className="relative flex flex-1 min-h-0 overflow-hidden">
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
          flex flex-col bg-gradient-to-b from-[#111111] to-[#0b0b0b] border-r border-gray-800/80 flex-shrink-0
          transition-all duration-300 ease-in-out
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          ${collapsed ? 'md:w-16' : 'md:w-60'}
          w-64 h-full md:h-auto
        `}>
          {/* User card */}
          <div className={`border-b border-gray-800/80 ${collapsed ? 'p-3' : 'p-4 md:p-5'}`}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-brand-orange/20 border-2 border-brand-orange/40 flex items-center justify-center shrink-0 overflow-hidden">
                <img
                  src={user.avatar_url || fallbackAvatar}
                  alt="User avatar"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={e => {
                    const img = e.currentTarget;
                    if (img.src !== fallbackAvatar) {
                      img.src = fallbackAvatar;
                    }
                  }}
                />
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
          <nav className={`${collapsed ? 'p-2' : 'p-2 md:p-3'} space-y-1 flex-grow overflow-y-auto`}>
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
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold uppercase tracking-widest transition-all duration-150 rounded-sm border border-transparent text-gray-500 hover:text-white hover:bg-gray-800/60 hover:border-gray-700/70 ${collapsed ? 'justify-center' : ''}`}
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
                    {!collapsed && isOpen && (
                      <div className={`mt-0.5 space-y-0.5 ${collapsed ? '' : 'pl-3 border-l border-gray-800/50 ml-3'}`}>
                        {visibleChildren.map(child => {
                          const ChildIcon = child.icon;
                          const isActive = 'externalPath' in child
                            ? location.pathname.startsWith((child as { externalPath: string }).externalPath)
                            : activeTab === child.key;
                          return (
                            <button
                              key={child.key}
                              onClick={() => 'externalPath' in child ? navigate((child as { externalPath: string }).externalPath) : handleTabChange(child.key)}
                              title={collapsed ? child.label : undefined}
                              className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-bold uppercase tracking-widest transition-all duration-150 rounded-sm relative ${
                                isActive
                                  ? 'text-brand-orange bg-brand-orange/10 border border-brand-orange/30'
                                  : 'text-gray-400 hover:text-white hover:bg-gray-800/60 border border-transparent hover:border-gray-700/70'
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
                    onClick={() => {
                      handleTabChange(item.key);
                    }}
                    title={collapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold uppercase tracking-widest transition-all duration-150 rounded-sm relative ${
                      isActive
                        ? 'text-brand-orange bg-brand-orange/10 border border-brand-orange/30'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800/60 border border-transparent hover:border-gray-700/70'
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
            <button onClick={handleLogout}
              title="Sign Out"
              className="md:hidden w-full flex items-center gap-2 px-3 py-2.5 rounded-sm text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-red-400 transition-colors">
              <LogOut className="w-4 h-4 shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className={`flex-1 min-w-0 min-h-0 ${isChatbotTab ? 'p-0 overflow-hidden' : 'p-4 md:p-6 lg:p-8'}`}>
          {renderContent()}
        </main>
      </div>
    </div>
  );
}