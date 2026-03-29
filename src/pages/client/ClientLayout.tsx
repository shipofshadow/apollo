import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, User, LogOut, ArrowLeft, Car,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import logo from '../../assets/logo.png';
import NotificationBell from '../../components/NotificationBell';

const navItems = [
  { label: 'Dashboard',   href: '/client/dashboard', icon: LayoutDashboard },
  { label: 'My Bookings', href: '/client/bookings',  icon: Calendar },
  { label: 'My Garage',   href: '/client/garage',    icon: Car },
  { label: 'Profile',     href: '/client/profile',   icon: User },
];

export default function ClientLayout() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const pageTitle = navItems.find(n => location.pathname.startsWith(n.href))?.label ?? 'Portal';

  return (
    <div className="min-h-screen bg-brand-darker flex flex-col">
      {/* Top bar */}
      <header className="h-16 bg-brand-dark border-b border-gray-800 flex items-center justify-between px-4 md:px-6 shrink-0 z-30">
        <div className="flex items-center gap-4">
          <img src={logo} alt="1625 Autolab" className="h-8 w-auto object-contain" referrerPolicy="no-referrer" />
          <span className="hidden sm:block text-gray-600 text-lg select-none">/</span>
          <span className="hidden sm:block text-white font-bold uppercase tracking-widest text-sm">{pageTitle}</span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-brand-orange transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back to Site</span>
          </a>
          <div className="w-px h-5 bg-gray-700" />
          <NotificationBell />
          <div className="w-px h-5 bg-gray-700" />
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-red-400 transition-colors"
          >
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
                  {user?.name?.[0] ?? '?'}
                </span>
              </div>
              <div className="hidden md:block min-w-0">
                <p className="text-white font-bold text-sm truncate leading-tight">{user?.name}</p>
                <p className="text-gray-500 text-xs truncate">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="p-2 md:p-3 space-y-0.5 flex-grow">
            {navItems.map(({ label, href, icon: Icon }) => (
              <NavLink
                key={href}
                to={href}
                title={label}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-sm text-xs font-bold uppercase tracking-widest transition-all duration-150 group relative ${
                    isActive
                      ? 'text-brand-orange bg-brand-orange/10'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Active indicator */}
                    <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 bg-brand-orange rounded-r-full transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="hidden md:inline">{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Logout (mobile only — desktop uses topbar) */}
          <div className="md:hidden p-2 border-t border-gray-800">
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="w-full flex items-center justify-center gap-3 px-3 py-2.5 rounded-sm text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </aside>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-5 md:p-8 lg:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
