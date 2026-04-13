import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, Clock, ExternalLink, Calendar, Send, CheckCircle, AlertCircle } from 'lucide-react';
import { fetchSiteSettingsAsync } from '../store/siteSettingsSlice';
import type { AppDispatch, RootState } from '../store';
import { sendContactMessageApi } from '../services/api';
import PageSEO from '../components/PageSEO';
import TurnstileWidget from '../components/TurnstileWidget';

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

  // ── Contact form state ─────────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
  });
  const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [formError, setFormError] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileKey,   setTurnstileKey]   = useState(0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormStatus('sending');
    setFormError('');
    try {
      await sendContactMessageApi({
        name: formData.name,
        email: formData.email,
        phone: formData.phone || undefined,
        subject: formData.subject,
        message: formData.message,
        'cf-turnstile-response': turnstileToken,
      });
      setFormStatus('success');
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' });
      setTurnstileToken('');
      setTurnstileKey(k => k + 1);
    } catch (err: unknown) {
      setFormStatus('error');
      setFormError((err as Error).message || 'Failed to send message. Please try again.');
      setTurnstileKey(k => k + 1);
    }
  };

  const heading = settings.contact_heading || 'Contact The Lab';
  const tagline = settings.contact_tagline || "Ready to upgrade your ride? Reach out and we'll get back to you within 24 hours.";
  const address = settings.contact_address || settings.footer_address || '';
  const phone   = settings.contact_phone   || settings.footer_phone   || '';
  const email   = settings.contact_email   || settings.footer_email   || '';
  const hours   = settings.contact_hours   || "Mon–Fri: 9:00 AM – 6:00 PM\nSat: By Appointment Only\nSun: Closed";

  const parseList = (...values: Array<string | undefined>): string[] => {
    const entries = values
      .flatMap(value => (value ?? '').split(/[\n,]/g))
      .map(value => value.trim())
      .filter(Boolean);
    return Array.from(new Set(entries));
  };

  const phoneList = parseList(
    settings.company_phones,
    settings.contact_phones,
    phone,
    settings.footer_phones,
    settings.footer_phone
  );
  const emailList = parseList(
    settings.company_emails,
    settings.contact_emails,
    email,
    settings.footer_emails,
    settings.footer_email
  );

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
      icon: Clock,
      label: 'Hours',
      content: null,
      lines: hoursLines,
    },
  ].filter(i => i.content || (i.lines && i.lines.length > 0));

  return (
    <div className="bg-brand-dark min-h-screen">
      <PageSEO
        title="Contact Us"
        description="Get in touch with 1625 Auto Lab. Contact us for inquiries about automotive retrofitting, custom builds, or to schedule a consultation."
      />
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

            {/* Left column: Contact info + Map */}
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

                {phoneList.length > 0 && (
                  <div className="flex items-start gap-5">
                    <div className="w-12 h-12 bg-brand-darker border border-gray-800 flex items-center justify-center shrink-0 rounded-sm">
                      <Phone className="w-5 h-5 text-brand-orange" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Phone</p>
                      <ul className="space-y-1">
                        {phoneList.map(phoneEntry => (
                          <li key={`contact-phone-${phoneEntry}`}>
                            <a href={`tel:${phoneEntry.replace(/\s/g, '')}`} className="text-gray-300 text-sm hover:text-brand-orange transition-colors">
                              {phoneEntry}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {emailList.length > 0 && (
                  <div className="flex items-start gap-5">
                    <div className="w-12 h-12 bg-brand-darker border border-gray-800 flex items-center justify-center shrink-0 rounded-sm">
                      <Mail className="w-5 h-5 text-brand-orange" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">Email</p>
                      <ul className="space-y-1">
                        {emailList.map(emailEntry => (
                          <li key={`contact-email-${emailEntry}`}>
                            <a href={`mailto:${emailEntry}`} className="text-gray-300 text-sm hover:text-brand-orange transition-colors break-all">
                              {emailEntry}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Map */}
              <div className="space-y-3">
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

              {/* Book CTA */}
              <div className="bg-brand-darker border border-gray-800 rounded-sm p-6">
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

            {/* Right column: Send a Message form */}
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide mb-2">
                  Send a <span className="text-brand-orange">Message</span>
                </h2>
                <p className="text-gray-400 text-sm">Fill out the form below and we'll get back to you as soon as possible.</p>
              </div>

              {formStatus === 'success' ? (
                <div className="flex items-start gap-4 bg-green-900/30 border border-green-700 rounded-sm p-6">
                  <CheckCircle className="w-6 h-6 text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white font-bold mb-1">Message Sent!</p>
                    <p className="text-gray-400 text-sm">Thank you for reaching out. We'll get back to you within 24 hours.</p>
                    <button
                      onClick={() => setFormStatus('idle')}
                      className="mt-4 text-xs font-bold uppercase tracking-widest text-brand-orange hover:text-orange-400 transition-colors"
                    >
                      Send another message
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                        Name <span className="text-brand-orange">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        required
                        value={formData.name}
                        onChange={handleChange}
                        placeholder="Juan dela Cruz"
                        className="w-full bg-brand-darker border border-gray-700 rounded-sm px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-brand-orange transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                        Email <span className="text-brand-orange">*</span>
                      </label>
                      <input
                        type="email"
                        name="email"
                        required
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="juan@example.com"
                        className="w-full bg-brand-darker border border-gray-700 rounded-sm px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-brand-orange transition-colors"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                        Phone <span className="text-gray-600">(optional)</span>
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="0912 345 6789"
                        className="w-full bg-brand-darker border border-gray-700 rounded-sm px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-brand-orange transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                        Subject <span className="text-brand-orange">*</span>
                      </label>
                      <input
                        type="text"
                        name="subject"
                        required
                        value={formData.subject}
                        onChange={handleChange}
                        placeholder="General Inquiry"
                        className="w-full bg-brand-darker border border-gray-700 rounded-sm px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-brand-orange transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                      Message <span className="text-brand-orange">*</span>
                    </label>
                    <textarea
                      name="message"
                      required
                      rows={5}
                      value={formData.message}
                      onChange={handleChange}
                      placeholder="Tell us about your vehicle and what you need..."
                      className="w-full bg-brand-darker border border-gray-700 rounded-sm px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-brand-orange transition-colors resize-none"
                    />
                  </div>

                  {formStatus === 'error' && (
                    <div className="flex items-start gap-3 bg-red-900/30 border border-red-700 rounded-sm p-4">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <p className="text-red-300 text-sm">{formError}</p>
                    </div>
                  )}

                  <TurnstileWidget
                    onVerify={setTurnstileToken}
                    onExpire={() => setTurnstileToken('')}
                    resetKey={turnstileKey}
                  />

                  <button
                    type="submit"
                    disabled={formStatus === 'sending' || !turnstileToken}
                    className="inline-flex items-center gap-2 bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {formStatus === 'sending' ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending…
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" /> Send Message
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}