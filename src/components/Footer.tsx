import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Instagram, Facebook, Youtube, MapPin, Phone, Mail } from 'lucide-react';
import { fetchSiteSettingsAsync } from '../store/siteSettingsSlice';
import type { AppDispatch, RootState } from '../store';

export default function Footer() {
  const dispatch = useDispatch<AppDispatch>();
  const { settings, status } = useSelector((s: RootState) => s.siteSettings);
  const services = useSelector((s: RootState) => s.services.items);

  useEffect(() => {
    if (status === 'idle') {
      dispatch(fetchSiteSettingsAsync());
    }
  }, [dispatch, status]);

  // Resolve dynamic values with hardcoded fallbacks
  const tagline   = settings.footer_tagline   ?? 'The premier automotive retrofitting shop. We turn ordinary vehicles into extraordinary machines.';
  const address   = settings.footer_address   ?? 'NKKS Arcade, Krystal Homes, Brgy. Alasas\nPampanga, San Fernando, Philippines, 2000';
  const phone     = settings.footer_phone     ?? '0939 330 8263';
  const email     = settings.footer_email     ?? '1625autolab@gmail.com';
  const instagram = settings.footer_instagram ?? 'https://www.instagram.com/1625autolab';
  const facebook  = settings.footer_facebook  ?? 'https://www.facebook.com/1625autolab/';
  const youtube   = settings.footer_youtube   ?? '';

  const parseList = (...values: Array<string | undefined>): string[] => {
    const entries = values
      .flatMap(value => (value ?? '').split(/[\n,]/g))
      .map(value => value.trim())
      .filter(Boolean);
    return Array.from(new Set(entries));
  };

  const phoneList = parseList(settings.footer_phones, phone);
  const emailList = parseList(settings.footer_emails, email);

  // Show up to 4 active services in the footer
  const footerServices = services.filter(s => s.isActive).slice(0, 4);

  return (
    <footer className="bg-brand-darker border-t border-gray-800 pt-20 pb-10">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">

          {/* Brand Column */}
          <div className="space-y-6">
            <div className="flex items-start">
              <img
                src="https://cdn.1625autolab.com/1625autolab/logos/logo.png"
                alt="1625 Autolab Logo"
                className="h-16 md:h-24 w-auto max-w-[240px] md:max-w-[360px] object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <p className="text-gray-400 leading-relaxed">{tagline}</p>
            <div className="flex items-center gap-4">
              {instagram && (
                <a href={instagram} target="_blank" rel="noopener noreferrer"
                  className="w-10 h-10 bg-brand-gray flex items-center justify-center rounded-sm hover:bg-brand-orange hover:text-white transition-colors text-gray-400">
                  <Instagram className="w-5 h-5" />
                </a>
              )}
              {facebook && (
                <a href={facebook} target="_blank" rel="noopener noreferrer"
                  className="w-10 h-10 bg-brand-gray flex items-center justify-center rounded-sm hover:bg-brand-orange hover:text-white transition-colors text-gray-400">
                  <Facebook className="w-5 h-5" />
                </a>
              )}
              {youtube && (
                <a href={youtube} target="_blank" rel="noopener noreferrer"
                  className="w-10 h-10 bg-brand-gray flex items-center justify-center rounded-sm hover:bg-brand-orange hover:text-white transition-colors text-gray-400">
                  <Youtube className="w-5 h-5" />
                </a>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-display uppercase tracking-wider text-xl mb-6 border-b border-gray-800 pb-4">
              Quick Links
            </h4>
            <ul className="space-y-4">
              {[
                { label: 'Home',             to: '/' },
                { label: 'Services',         to: '/services' },
                { label: 'Portfolio',        to: '/portfolio' },
                { label: 'Book Appointment', to: '/booking' },
                { label: 'FAQ',              to: '/faq' },
              ].map(({ label, to }) => (
                <li key={to}>
                  <Link to={to} className="text-gray-400 hover:text-brand-orange transition-colors flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-brand-orange rounded-full"></span>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-white font-display uppercase tracking-wider text-xl mb-6 border-b border-gray-800 pb-4">
              Our Services
            </h4>
            <ul className="space-y-4">
              {footerServices.length > 0
                ? footerServices.map(svc => (
                  <li key={svc.id}>
                    <Link to={`/services/${svc.slug}`} className="text-gray-400 hover:text-brand-orange transition-colors flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-brand-orange rounded-full"></span>
                      {svc.title}
                    </Link>
                  </li>
                ))
                : ['Headlight Retrofits', 'Android Headunits', 'Security Systems', 'Aesthetic Upgrades'].map(t => (
                  <li key={t}>
                    <Link to="/services" className="text-gray-400 hover:text-brand-orange transition-colors flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-brand-orange rounded-full"></span>
                      {t}
                    </Link>
                  </li>
                ))
              }
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="text-white font-display uppercase tracking-wider text-xl mb-6 border-b border-gray-800 pb-4">
              Contact Us
            </h4>
            <ul className="space-y-6">
              {address && (
                <li className="flex items-start gap-4">
                  <MapPin className="w-5 h-5 text-brand-orange shrink-0 mt-1" />
                  <span className="text-gray-400 whitespace-pre-line">{address}</span>
                </li>
              )}
              {phoneList.map((phoneEntry, idx) => (
                <li key={`footer-phone-${phoneEntry}`} className="flex items-center gap-4">
                  {idx === 0 ? (
                    <Phone className="w-5 h-5 text-brand-orange shrink-0" />
                  ) : (
                    <span className="w-5 h-5 shrink-0" aria-hidden="true" />
                  )}
                  <a href={`tel:${phoneEntry.replace(/\s/g, '')}`} className="text-gray-400 hover:text-brand-orange transition-colors">
                    {phoneEntry}
                  </a>
                </li>
              ))}
              {emailList.map((emailEntry, idx) => (
                <li key={`footer-email-${emailEntry}`} className="flex items-center gap-4">
                  {idx === 0 ? (
                    <Mail className="w-5 h-5 text-brand-orange shrink-0" />
                  ) : (
                    <span className="w-5 h-5 shrink-0" aria-hidden="true" />
                  )}
                  <a href={`mailto:${emailEntry}`} className="text-gray-400 hover:text-brand-orange transition-colors break-all">
                    {emailEntry}
                  </a>
                </li>
              ))}
            </ul>
          </div>

        </div>

        {/* Copyright */}
        <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} 1625 Autolab. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-brand-orange transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-brand-orange transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
