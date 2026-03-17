import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'Services', href: '/services' },
    { name: 'Products', href: '/products' },
    { name: 'Portfolio', href: '/portfolio' },
    { name: 'About', href: '/about' },
    { name: 'Admin', href: '/admin' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        isScrolled ? 'bg-brand-darker/95 backdrop-blur-md py-4 shadow-lg border-b border-gray-800' : 'bg-transparent py-6'
      }`}
    >
      <div className="container mx-auto px-4 md:px-6 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center hover:opacity-80 transition-opacity">
          <img 
            src="https://storage.googleapis.com/aida-uploads/default/2026-03-17/1625.png" 
            alt="1625 Autolab Logo" 
            className="h-10 sm:h-12 md:h-16 w-auto max-w-[180px] sm:max-w-[220px] md:max-w-[300px] object-contain"
            referrerPolicy="no-referrer"
          />
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.href}
              className={`text-sm font-bold uppercase tracking-widest transition-colors ${
                location.pathname === link.href ? 'text-brand-orange' : 'text-gray-300 hover:text-brand-orange'
              }`}
            >
              {link.name}
            </Link>
          ))}
        </nav>

        {/* CTA Button */}
        <div className="hidden md:flex items-center gap-6">
          <Link
            to="/booking"
            className="bg-brand-orange hover:bg-orange-600 text-white font-display uppercase tracking-wider px-6 py-3 rounded-sm transition-all transform hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(243,111,33,0.3)]"
          >
            Book Appointment
          </Link>
        </div>

        {/* Mobile Menu Toggle */}
        <div className="md:hidden flex items-center gap-4">
          <button
            className="text-white"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-brand-darker border-t border-gray-800 p-4 flex flex-col gap-4 shadow-xl">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.href}
              className={`text-base font-bold uppercase tracking-widest transition-colors py-2 border-b border-gray-800 ${
                location.pathname === link.href ? 'text-brand-orange' : 'text-gray-300 hover:text-brand-orange'
              }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {link.name}
            </Link>
          ))}
          <Link
            to="/booking"
            className="bg-brand-orange text-center text-white font-display uppercase tracking-wider px-6 py-3 mt-4 rounded-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            Book Appointment
          </Link>
        </div>
      )}
    </header>
  );
}
