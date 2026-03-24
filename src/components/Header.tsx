import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, ChevronDown, LayoutDashboard, Calendar, User, LogOut } from 'lucide-react';
import logo from '../assets/logo.png';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { user, logout } = useAuth();

  const [isScrolled,      setIsScrolled]      = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDropdownOpen,   setIsDropdownOpen]   = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setIsMobileMenuOpen(false); setIsDropdownOpen(false); }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const navLinks = [
    { name: 'Home',      href: '/' },
    { name: 'Services',  href: '/services' },
    { name: 'Products',  href: '/products' },
    { name: 'Portfolio', href: '/portfolio' },
    { name: 'Blog',      href: '/blog' },
    { name: 'About',     href: '/about' },
  ];

  const clientMenu = [
    { label: 'Dashboard',   href: '/client/dashboard', icon: LayoutDashboard },
    { label: 'My Bookings', href: '/client/bookings',  icon: Calendar },
    { label: 'Profile',     href: '/client/profile',   icon: User },
  ];

  return (
    <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
      isScrolled ? 'bg-brand-darker/95 backdrop-blur-md py-4 shadow-lg border-b border-gray-800' : 'bg-transparent py-6'
    }`}>
      <div className="container mx-auto px-4 md:px-6 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center hover:opacity-80 transition-opacity">
          <img src={logo} alt="1625 Autolab Logo"
            className="h-10 sm:h-12 md:h-16 w-auto max-w-[180px] sm:max-w-[220px] md:max-w-[300px] object-contain"
            referrerPolicy="no-referrer" />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map(link => (
            <Link key={link.name} to={link.href}
              className={`text-sm font-bold uppercase tracking-widest transition-colors ${
                location.pathname === link.href ? 'text-brand-orange' : 'text-gray-300 hover:text-brand-orange'
              }`}>
              {link.name}
            </Link>
          ))}
        </nav>

        {/* Desktop right side */}
        <div className="hidden md:flex items-center gap-4">
          {!user ? (
            <>
              <Link to="/login"
                className="text-sm font-bold uppercase tracking-widest text-gray-300 hover:text-brand-orange transition-colors">
                Login
              </Link>
              <Link to="/booking"
                className="bg-brand-orange hover:bg-orange-600 text-white font-display uppercase tracking-wider px-6 py-3 rounded-sm transition-all transform hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(243,111,33,0.3)]">
                Book Appointment
              </Link>
            </>
          ) : (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(v => !v)}
                className="flex items-center gap-2 bg-brand-dark border border-gray-700 hover:border-brand-orange px-4 py-2.5 rounded-sm transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-brand-orange/20 flex items-center justify-center">
                  <span className="text-brand-orange text-xs font-bold uppercase">{user.name[0]}</span>
                </div>
                <span className="text-white text-sm font-bold max-w-[120px] truncate">{user.name.split(' ')[0]}</span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-brand-dark border border-gray-700 rounded-sm shadow-2xl py-1 z-50">
                  <div className="px-4 py-3 border-b border-gray-800">
                    <p className="text-white font-bold text-sm truncate">{user.name}</p>
                    <p className="text-gray-500 text-xs truncate">{user.email}</p>
                  </div>
                  {user.role === 'admin' ? (
                    <Link to="/admin"
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors">
                      <LayoutDashboard className="w-4 h-4 text-brand-orange" /> Admin Panel
                    </Link>
                  ) : (
                    clientMenu.map(({ label, href, icon: Icon }) => (
                      <Link key={href} to={href}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors">
                        <Icon className="w-4 h-4 text-brand-orange" /> {label}
                      </Link>
                    ))
                  )}
                  <div className="border-t border-gray-800 mt-1">
                    <button onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-400 hover:text-red-400 transition-colors">
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile toggle */}
        <div className="md:hidden">
          <button className="text-white" onClick={() => setIsMobileMenuOpen(v => !v)}>
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-brand-darker border-t border-gray-800 p-4 flex flex-col gap-1 shadow-xl">
          {navLinks.map(link => (
            <Link key={link.name} to={link.href}
              className={`text-base font-bold uppercase tracking-widest transition-colors py-2 px-2 border-b border-gray-800 ${
                location.pathname === link.href ? 'text-brand-orange' : 'text-gray-300 hover:text-brand-orange'
              }`}>
              {link.name}
            </Link>
          ))}

          {!user ? (
            <div className="flex flex-col gap-3 mt-4">
              <Link to="/login"
                className="text-center border border-gray-700 text-white font-bold uppercase tracking-widest px-6 py-3 rounded-sm hover:border-brand-orange transition-colors">
                Login
              </Link>
              <Link to="/booking"
                className="bg-brand-orange text-center text-white font-display uppercase tracking-wider px-6 py-3 rounded-sm">
                Book Appointment
              </Link>
            </div>
          ) : (
            <div className="mt-4 border-t border-gray-800 pt-4 space-y-1">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 px-2 mb-2">{user.name}</p>
              {user.role === 'admin' ? (
                <Link to="/admin" className="flex items-center gap-3 px-2 py-2.5 text-sm text-gray-300 hover:text-brand-orange transition-colors font-bold uppercase tracking-widest">
                  <LayoutDashboard className="w-4 h-4" /> Admin Panel
                </Link>
              ) : (
                clientMenu.map(({ label, href, icon: Icon }) => (
                  <Link key={href} to={href}
                    className="flex items-center gap-3 px-2 py-2.5 text-sm text-gray-300 hover:text-brand-orange transition-colors font-bold uppercase tracking-widest">
                    <Icon className="w-4 h-4" /> {label}
                  </Link>
                ))
              )}
              <button onClick={handleLogout}
                className="w-full flex items-center gap-3 px-2 py-2.5 text-sm text-gray-400 hover:text-red-400 transition-colors font-bold uppercase tracking-widest">
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
