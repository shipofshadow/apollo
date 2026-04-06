import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, ChevronDown, LayoutDashboard, Calendar, User, LogOut, ShoppingCart, Package } from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import { cartCount, readCart } from '../utils/cart';

const LOGO_URL = 'https://cdn.1625autolab.com/1625autolab/logos/logo.png';


export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [cartItemsCount, setCartItemsCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);



  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    const syncCart = () => setCartItemsCount(cartCount(readCart()));
    syncCart();
    window.addEventListener('apollo:cart-updated', syncCart as EventListener);
    return () => window.removeEventListener('apollo:cart-updated', syncCart as EventListener);
  }, []);

  const handleLogout = async () => {
    setIsMobileMenuOpen(false);
    setIsDropdownOpen(false);
    await logout();
    navigate('/', { replace: true });
  };

  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'Services', href: '/services' },
    { name: 'Products', href: '/products' },
    { name: 'Portfolio', href: '/portfolio' },
    { name: 'Blog', href: '/blog' },
    { name: 'About', href: '/about' },
    { name: 'Contact', href: '/contact' },
  ];

  const clientMenu = [
    { label: 'Dashboard', href: '/client/dashboard', icon: LayoutDashboard },
    { label: 'My Bookings', href: '/client/bookings', icon: Calendar },
    { label: 'My Orders', href: '/client/orders', icon: Package },
    { label: 'Profile', href: '/client/profile', icon: User },
  ];

  const renderUserAvatar = (sizeClass = 'w-7 h-7') => {
    const initials = user?.name?.[0] ?? 'A';

    return (
      <div className={`${sizeClass} rounded-full bg-brand-orange/20 border border-brand-orange/40 flex items-center justify-center overflow-hidden shrink-0`}>
        {user?.avatar_url ? (
          <img
            src={user.avatar_url}
            alt="User avatar"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            onError={e => {
              const img = e.currentTarget;
              img.style.display = 'none';
              const fallback = img.nextElementSibling as HTMLElement | null;
              if (fallback) fallback.style.display = 'inline';
            }}
          />
        ) : null}
        <span className={`text-brand-orange text-xs font-bold uppercase ${user?.avatar_url ? 'hidden' : ''}`}>{initials}</span>
      </div>
    );
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled || isMobileMenuOpen 
        ? 'bg-brand-darker/95 backdrop-blur-md py-3 shadow-lg border-b border-gray-800' 
        : 'bg-transparent py-5'
    }`}>
      <div className="container mx-auto px-4 md:px-6 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center hover:opacity-80 transition-opacity z-50">
          <img src={LOGO_URL} alt="1625 Autolab Logo"
            className="h-10 md:h-12 w-auto object-contain transition-all duration-300"
            referrerPolicy="no-referrer" />
        </Link>

        {/* Language Toggle */}
        {/* <div className="hidden lg:block mr-6">
          <select value={lang} onChange={handleLangChange} className="bg-brand-dark border border-gray-700 text-white px-2 py-1 rounded-sm text-xs uppercase">
            {Object.entries(LANG_LABELS).map(([code, label]) => (
              <option key={code} value={code}>{label}</option>
            ))}
          </select>
        </div> */}

        {/* Desktop Nav - Shifted to lg breakpoint */}
        <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
          {navLinks.map(link => (
            <Link key={link.name} to={link.href}
              className={`text-sm font-bold uppercase tracking-widest transition-colors ${
                location.pathname === link.href ? 'text-brand-orange' : 'text-gray-300 hover:text-brand-orange'
              }`}>
              {link.name}
            </Link>
          ))}
        </nav>

        {/* Desktop Auth/Actions - Shifted to lg breakpoint */}
        <div className="hidden lg:flex items-center gap-4">
          <Link
            to="/cart"
            className={`relative inline-flex items-center justify-center w-10 h-10 rounded-sm border transition-colors ${
              location.pathname === '/cart' ? 'border-brand-orange text-brand-orange bg-brand-orange/10' : 'border-gray-700 text-gray-300 hover:text-white hover:border-brand-orange'
            }`}
            aria-label="Open cart"
          >
            <ShoppingCart className="w-4 h-4" />
            {cartItemsCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-brand-orange text-white text-[10px] font-bold flex items-center justify-center">
                {cartItemsCount}
              </span>
            )}
          </Link>
          {!user ? (
            <>
              <Link to="/login"
                className="text-sm font-bold uppercase tracking-widest text-gray-300 hover:text-brand-orange transition-colors">
                Login
              </Link>
              <Link to="/booking"
                className="bg-brand-orange hover:bg-orange-600 text-white font-display uppercase tracking-wider px-6 py-2.5 rounded-sm transition-all transform hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(243,111,33,0.3)]">
                Book Appointment
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <NotificationBell />
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(v => !v)}
                  className="flex items-center gap-2 bg-brand-dark border border-gray-700 hover:border-brand-orange px-3 py-2 rounded-sm transition-colors"
                >
                  {renderUserAvatar('w-7 h-7')}
                  <span className="text-white text-sm font-bold max-w-[120px] truncate">{user.name.split(' ')[0]}</span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-brand-dark border border-gray-700 rounded-sm shadow-2xl py-1 z-50">
                    <div className="px-4 py-3 border-b border-gray-800">
                      <p className="text-white font-bold text-sm truncate">{user.name}</p>
                      <p className="text-gray-500 text-xs truncate">{user.email}</p>
                    </div>
                    {user.role !== 'client' ? (
                      <Link to="/admin" className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors">
                        <LayoutDashboard className="w-4 h-4 text-brand-orange" /> Admin Panel
                      </Link>
                    ) : (
                      clientMenu.map(({ label, href, icon: Icon }) => (
                        <Link key={href} to={href} className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-colors">
                          <Icon className="w-4 h-4 text-brand-orange" /> {label}
                        </Link>
                      ))
                    )}
                    <div className="border-t border-gray-800 mt-1">
                      <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-400 hover:text-red-400 transition-colors">
                        <LogOut className="w-4 h-4" /> Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Mobile Toggle Button */}
        <div className="lg:hidden flex items-center gap-4 z-50">
          <Link to="/cart" className="relative text-white p-1" aria-label="Open cart">
            <ShoppingCart className="w-6 h-6" />
            {cartItemsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-brand-orange text-white text-[9px] font-bold flex items-center justify-center">
                {cartItemsCount}
              </span>
            )}
          </Link>
          {user && <NotificationBell />}
          <button className="text-white p-1" onClick={() => setIsMobileMenuOpen(v => !v)} aria-label="Toggle menu" aria-expanded={isMobileMenuOpen}>
            {isMobileMenuOpen ? <X className="w-7 h-7" /> : <Menu className="w-7 h-7" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay - Positioned securely below the header */}
      <div className={`lg:hidden absolute top-full left-0 w-full bg-brand-darker border-b border-gray-800 shadow-2xl transition-all duration-300 overflow-hidden ${
        isMobileMenuOpen ? 'max-h-[calc(100vh-60px)] opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className="px-4 py-6 flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-60px)]">
          {navLinks.map(link => (
            <Link key={link.name} to={link.href}
              className={`text-base font-bold uppercase tracking-widest transition-colors py-3 px-2 border-b border-gray-800/50 ${
                location.pathname === link.href ? 'text-brand-orange' : 'text-gray-300 hover:text-brand-orange'
              }`}>
              {link.name}
            </Link>
          ))}

    
          {!user ? (
            <div className="flex flex-col gap-3 mt-6">
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
              <div className="flex items-center gap-2 px-2 mb-3">
                {renderUserAvatar('w-8 h-8')}
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500">{user.name}</p>
              </div>
              {user.role !== 'client' ? (
                <Link to="/admin" className="flex items-center gap-3 px-2 py-3 text-sm text-gray-300 hover:text-brand-orange transition-colors font-bold uppercase tracking-widest">
                  <LayoutDashboard className="w-5 h-5" /> Admin Panel
                </Link>
              ) : (
                clientMenu.map(({ label, href, icon: Icon }) => (
                  <Link key={href} to={href}
                    className="flex items-center gap-3 px-2 py-3 text-sm text-gray-300 hover:text-brand-orange transition-colors font-bold uppercase tracking-widest">
                    <Icon className="w-5 h-5" /> {label}
                  </Link>
                ))
              )}
              <button onClick={handleLogout}
                className="w-full flex items-center gap-3 px-2 py-3 mt-2 text-sm text-gray-400 hover:text-red-400 transition-colors font-bold uppercase tracking-widest">
                <LogOut className="w-5 h-5" /> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}