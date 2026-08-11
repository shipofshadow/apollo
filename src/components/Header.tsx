import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, ChevronDown, LayoutDashboard, Calendar, User, LogOut, ShoppingCart, Package } from 'lucide-react';
import { useSelector } from 'react-redux';

import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import { cartCount, readCart } from '../utils/cart';
import { getDicebearAvatarDataUri } from '../utils/avatar';
import type { RootState } from '../store';

const LOGO_URL = 'https://cdn.1625autolab.com/1625autolab/logos/logo.png';

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  // Site settings — shop feature toggle
  const siteSettings = useSelector((s: RootState) => s.siteSettings.settings);
  const shopEnabled = siteSettings.shop_enabled === undefined || siteSettings.shop_enabled === '1';

  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [cartItemsCount, setCartItemsCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsDropdownOpen(false);
  }, [location.pathname, location.search]);

  // Close mobile menu when clicking outside the header
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isMobileMenuOpen]);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isDropdownOpen]);

  const handleLogout = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setIsMobileMenuOpen(false);
    setIsDropdownOpen(false);
    await logout();
    navigate('/', { replace: true });
  };

  const baseNavLinks = [
    { name: 'Home', href: '/' },
    { name: 'Services', href: '/services' },
    { name: 'Products', href: '/products', shopOnly: true },
    { name: 'Portfolio', href: '/portfolio' },
    { name: 'About', href: '/about' },
    { name: 'Contact', href: '/contact' },
  ];

  const navLinks = baseNavLinks.filter(l => !l.shopOnly || shopEnabled);

  const baseClientMenu = [
    { label: 'Dashboard', href: '/client/dashboard', icon: LayoutDashboard, shopOnly: false },
    { label: 'My Bookings', href: '/client/bookings', icon: Calendar, shopOnly: false },
    { label: 'My Orders', href: '/client/orders', icon: Package, shopOnly: true },
    { label: 'Profile', href: '/client/profile', icon: User, shopOnly: false },
  ];

  const clientMenu = baseClientMenu.filter(m => !m.shopOnly || shopEnabled);

  const renderUserAvatar = (sizeClass = 'w-7 h-7') => {
    const fallbackAvatar = getDicebearAvatarDataUri({
      id: user?.id,
      name: user?.name,
      email: user?.email,
    });

    return (
      <div className={`${sizeClass} rounded-full bg-brand-orange/20 border border-brand-orange/40 flex items-center justify-center overflow-hidden shrink-0`}>
        <img
          src={user?.avatar_url || fallbackAvatar}
          alt="User avatar"
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
          onError={e => {
            const img = e.currentTarget;
            if (img.src !== fallbackAvatar) img.src = fallbackAvatar;
          }}
        />
      </div>
    );
  };

  const isActive = (href: string) =>
    href === '/' ? location.pathname === '/' : location.pathname.startsWith(href);

  return (
    <header
      ref={mobileMenuRef}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled || isMobileMenuOpen
          ? 'bg-[#0a0a0a]/96 backdrop-blur-xl py-3 shadow-2xl border-b border-white/5'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="container mx-auto px-4 md:px-6 flex items-center justify-between gap-6">

        {/* Logo */}
        <Link to="/" className="flex items-center justify-center hover:opacity-80 transition-opacity z-50 shrink-0">
          <img
            src={LOGO_URL}
            alt="1625 Autolab Logo"
            className="h-8 md:h-10 w-auto object-contain transition-all duration-300"
            referrerPolicy="no-referrer"
          />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {navLinks.map(link => (
            <Link
              key={link.name}
              to={link.href}
              className={`relative text-[11px] font-bold uppercase tracking-widest px-3 py-2 rounded-md transition-all duration-200 ${
                isActive(link.href)
                  ? 'text-brand-orange'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {link.name}
              {isActive(link.href) && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-brand-orange rounded-full" />
              )}
            </Link>
          ))}
        </nav>

        {/* Desktop Actions */}
        <div className="hidden lg:flex items-center gap-3">
          {/* Cart — only when shop is enabled */}
          {shopEnabled && (
            <Link
              to="/cart"
              className={`relative inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-all duration-200 ${
                location.pathname === '/cart'
                  ? 'border-brand-orange text-brand-orange bg-brand-orange/10'
                  : 'border-white/10 text-gray-400 hover:text-white hover:border-white/25 hover:bg-white/5'
              }`}
              aria-label="Open cart"
            >
              <ShoppingCart className="w-4 h-4" />
              {cartItemsCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-brand-orange text-white text-[10px] font-bold flex items-center justify-center shadow-lg">
                  {cartItemsCount}
                </span>
              )}
            </Link>
          )}

          {!user ? (
            <Link
              to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}
              className="text-[11px] font-bold uppercase tracking-widest text-white bg-brand-orange hover:bg-orange-600 px-4 py-2 rounded-lg transition-all duration-200 shadow-lg shadow-brand-orange/20"
            >
              Login
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <NotificationBell />

              {/* User Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(v => !v)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-200 ${
                    isDropdownOpen
                      ? 'border-brand-orange/50 bg-brand-orange/10 text-white'
                      : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8 text-gray-300 hover:text-white'
                  }`}
                >
                  {renderUserAvatar('w-6 h-6')}
                  <span className="text-sm font-semibold max-w-[100px] truncate">{user.name.split(' ')[0]}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-[#111] border border-white/10 rounded-xl shadow-2xl shadow-black/60 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* User Info */}
                    <div className="px-4 py-3.5 border-b border-white/8 flex items-center gap-3">
                      {renderUserAvatar('w-9 h-9')}
                      <div className="min-w-0">
                        <p className="text-white font-bold text-sm truncate">{user.name}</p>
                        <p className="text-gray-500 text-xs truncate">{user.email}</p>
                      </div>
                    </div>

                    {/* Menu Items */}
                    <div className="py-1">
                      {user.role !== 'client' ? (
                        <Link
                          to="/admin"
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <LayoutDashboard className="w-4 h-4 text-brand-orange" />
                          Admin Panel
                        </Link>
                      ) : (
                        clientMenu.map(({ label, href, icon: Icon }) => (
                          <Link
                            key={href}
                            to={href}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <Icon className="w-4 h-4 text-brand-orange" />
                            {label}
                          </Link>
                        ))
                      )}
                    </div>

                    {/* Sign Out */}
                    <div className="border-t border-white/8 py-1">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/5 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Mobile: Cart + Notification + Hamburger */}
        <div className="lg:hidden flex items-center gap-3 z-50">
          {shopEnabled && (
            <Link to="/cart" className="relative text-gray-300 hover:text-white p-1 transition-colors" aria-label="Open cart">
              <ShoppingCart className="w-5 h-5" />
              {cartItemsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-brand-orange text-white text-[9px] font-bold flex items-center justify-center">
                  {cartItemsCount}
                </span>
              )}
            </Link>
          )}

          {user && <NotificationBell />}

          <button
            className="text-gray-300 hover:text-white p-1 transition-colors"
            onClick={() => setIsMobileMenuOpen(v => !v)}
            aria-label="Toggle menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`lg:hidden absolute top-full left-0 w-full bg-[#0a0a0a]/98 backdrop-blur-xl border-b border-white/8 shadow-2xl transition-all duration-300 overflow-hidden ${
          isMobileMenuOpen ? 'max-h-[calc(100vh-64px)] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
        }`}
      >
        <div className="px-4 py-5 flex flex-col overflow-y-auto max-h-[calc(100vh-64px)]">

          {/* Nav Links */}
          <nav className="flex flex-col gap-0.5 mb-4">
            {navLinks.map(link => (
              <Link
                key={link.name}
                to={link.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-bold uppercase tracking-widest transition-colors ${
                  isActive(link.href)
                    ? 'text-brand-orange bg-brand-orange/8'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {isActive(link.href) && <span className="w-1 h-4 rounded-full bg-brand-orange shrink-0" />}
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Auth Section */}
          <div className="border-t border-white/8 pt-4">
            {!user ? (
              <Link
                to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}
                onClick={() => setIsMobileMenuOpen(false)}
                className="block text-center bg-brand-orange hover:bg-orange-600 text-white font-bold uppercase tracking-widest px-6 py-3 rounded-xl transition-colors shadow-lg shadow-brand-orange/20"
              >
                Login
              </Link>
            ) : (
              <div className="space-y-1">
                {/* User Identity */}
                <div className="flex items-center gap-3 px-3 py-3 mb-2">
                  {renderUserAvatar('w-9 h-9')}
                  <div className="min-w-0">
                    <p className="text-white font-bold text-sm truncate">{user.name}</p>
                    <p className="text-gray-500 text-xs truncate">{user.email}</p>
                  </div>
                </div>

                {user.role !== 'client' ? (
                  <Link
                    to="/admin"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors font-bold uppercase tracking-widest"
                  >
                    <LayoutDashboard className="w-4 h-4 text-brand-orange" />
                    Admin Panel
                  </Link>
                ) : (
                  clientMenu.map(({ label, href, icon: Icon }) => (
                    <Link
                      key={href}
                      to={href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors font-bold uppercase tracking-widest"
                    >
                      <Icon className="w-4 h-4 text-brand-orange" />
                      {label}
                    </Link>
                  ))
                )}

                <button
                  type="button"
                  onClick={e => { e.preventDefault(); handleLogout(); }}
                  className="w-full flex items-center gap-3 px-3 py-3 mt-2 rounded-xl text-sm font-bold uppercase tracking-widest text-gray-400 hover:text-red-400 hover:bg-red-500/8 transition-colors border border-white/5"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
