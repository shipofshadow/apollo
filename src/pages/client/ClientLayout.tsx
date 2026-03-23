import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Calendar, User, LogOut, ChevronRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  { label: 'Dashboard',   href: '/client/dashboard', icon: LayoutDashboard },
  { label: 'My Bookings', href: '/client/bookings',  icon: Calendar },
  { label: 'Profile',     href: '/client/profile',   icon: User },
];

export default function ClientLayout() {
  const navigate     = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  return (
    <div className="pt-24 min-h-screen bg-brand-darker flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-brand-dark border-r border-gray-800 flex-shrink-0 flex flex-col md:min-h-[calc(100vh-6rem)]">
        {/* User info */}
        <div className="p-6 border-b border-gray-800">
          <div className="w-12 h-12 rounded-full bg-brand-orange/20 border border-brand-orange/40 flex items-center justify-center mb-3">
            <span className="text-brand-orange font-bold text-lg uppercase">
              {user?.name?.[0] ?? '?'}
            </span>
          </div>
          <p className="text-white font-bold truncate">{user?.name}</p>
          <p className="text-gray-500 text-xs truncate">{user?.email}</p>
        </div>

        {/* Nav */}
        <nav className="p-4 space-y-1 flex-grow">
          {navItems.map(({ label, href, icon: Icon }) => (
            <NavLink
              key={href}
              to={href}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-sm text-sm font-bold uppercase tracking-widest transition-colors ${
                  isActive
                    ? 'bg-brand-orange text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
              <ChevronRight className="w-3 h-3 ml-auto opacity-50" />
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-sm text-sm font-bold uppercase tracking-widest text-gray-400 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto pb-24 md:pb-10">
        <Outlet />
      </main>
    </div>
  );
}
