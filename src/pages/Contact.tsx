import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, Clock, ExternalLink, Calendar } from 'lucide-react';
import { fetchSiteSettingsAsync } from '../store/siteSettingsSlice';
import type { AppDispatch, RootState } from '../store';

// Define the shape so TypeScript stops panicking
type InfoItem = {
  icon: React.ElementType;
  label: string;
  content?: string | null;
  multiline?: boolean;
  href?: string;
  lines?: string[];
};

export default function ContactPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { settings } = useSelector((s: RootState) => s.siteSettings);

  useEffect(() => {
    dispatch(fetchSiteSettingsAsync());
  }, [dispatch]);

  const heading = settings.contact_heading || 'Contact The Lab';
  const tagline = settings.contact_tagline || "Ready to upgrade your ride? Reach out and we'll get back to you within 24 hours.";
  const address = settings.contact_address || settings.footer_address || '';
  const phone   = settings.contact_phone   || settings.footer_phone   || '';
  const email   = settings.contact_email   || settings.footer_email   || '';
  const hours   = settings.contact_hours   || "Mon–Fri: 9:00 AM – 6:00 PM\nSat: By Appointment Only\nSun: Closed";

  const DEFAULT_MAP_EMBED = 'https://www.openstreetmap.org/export/embed.html?bbox=120.6699%2C15.0086%2C120.7099%2C15.0486&layer=mapnik&marker=15.0286%2C120.6899';
  const DEFAULT_MAP_LINK  = 'https://www.openstreetmap.org/?mlat=15.0286&mlon=120.6899#map=15/15.0286/120.6899';
  const mapEmbed = settings.map_embed_url || DEFAULT_MAP_EMBED;
  const mapLink  = settings.map_link_url  || DEFAULT_MAP_LINK;

  const hoursLines = hours.split('\n').filter(Boolean);

  // Apply the type to the array
  const infoItems: InfoItem[] = [
    {
      icon: MapPin,
      label: 'Location',
      content: address,
      multiline: true,
    },
    {
      icon: Phone,
      label: 'Phone',
      content: phone,
      href: phone ? `tel:${phone.replace(/\s/g, '')}` : undefined,
    },
    {
      icon: Mail,
      label: 'Email',
      content: email,
      href: email ? `mailto:${email}` : undefined,
    },
    {
      icon: Clock,
      label: 'Hours',
      content: null,
      lines: hoursLines,
    },
  ].filter(i => i.content || (i.lines && i.lines.length > 0));

  return (
    <div className="bg-brand-dark min-h-screen">
      {/* Hero */}
      <section className="pt-32 pb-16 bg-brand-darker relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-brand-orange/5 via-transparent to-transparent pointer-events-none" />
        <div className="container mx-auto px-4 md:px-6 relative">
          <p className="text-brand-orange font-bold uppercase tracking-widest text-sm mb-4">Get In Touch</p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-black text-white uppercase tracking-tight mb-6">
            {heading}
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl leading-relaxed">{tagline}</p>
        </div>
      </section>

      {/* Main content */}
      <section className="py-16">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">

            {/* Contact info */}
            <div className="space-y-8">
              <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">
                Contact <span className="text-brand-orange">Info</span>
              </h2>

              <div className="space-y-6">
                {infoItems.map(({ icon: Icon, label, content, href, lines, multiline }) => (
                  <div key={label} className="flex items-start gap-5">
                    <div className="w-12 h-12 bg-brand-darker border border-gray-800 flex items-center justify-center shrink-0 rounded-sm">
                      <Icon className="w-5 h-5 text-brand-orange" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{label}</p>
                      {lines && lines.length > 0 ? (
                        <ul className="space-y-0.5">
                          {lines.map((line, i) => (
                            <li key={i} className="text-gray-300 text-sm">{line}</li>
                          ))}
                        </ul>
                      ) : href ? (
                        <a href={href} className="text-gray-300 text-sm hover:text-brand-orange transition-colors">
                          {multiline
                            ? content?.split('\n').map((ln: string, i: number) => <div key={i}>{ln}</div>)
                            : content}
                        </a>
                      ) : (
                        <p className="text-gray-300 text-sm">
                          {multiline
                            ? content?.split('\n').map((ln: string, i: number) => <div key={i}>{ln}</div>)
                            : content}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Book CTA */}
              <div className="bg-brand-darker border border-gray-800 rounded-sm p-6 mt-8">
                <p className="text-xs font-bold uppercase tracking-widest text-brand-orange mb-2">Ready to book?</p>
                <p className="text-gray-400 text-sm mb-4">Schedule your appointment online. Choose your service, pick a date and time, and we'll confirm within 24 hours.</p>
                <Link
                  to="/booking"
                  className="inline-flex items-center gap-2 bg-brand-orange text-white px-6 py-3 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm text-sm"
                >
                  <Calendar className="w-4 h-4" /> Book Appointment
                </Link>
              </div>
            </div>

            {/* Map */}
            <div className="space-y-4">
              <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">
                Find <span className="text-brand-orange">Us</span>
              </h2>
              <div className="w-full aspect-video rounded-sm overflow-hidden border border-gray-800 bg-brand-darker">
                <iframe
                  src={mapEmbed}
                  title="Shop location map"
                  className="w-full h-full"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              {mapLink && (
                <a
                  href={mapLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-brand-orange transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open in Maps
                </a>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}