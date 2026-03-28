import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { fetchServiceBySlugAsync } from '../store/servicesSlice';
import type { AppDispatch, RootState } from '../store';
import VariationGallery from '../components/VariationGallery';

export default function ServiceDetail() {
  const { slug }  = useParams<{ slug: string }>();
  const dispatch  = useDispatch<AppDispatch>();
  const { token } = useSelector((s: RootState) => s.auth);

  const service = useSelector((s: RootState) =>
    s.services.items.find(sv => sv.slug === slug)
  );
  const loadStatus = useSelector((s: RootState) => s.services.status);

  // Fetch this service if not yet in store
  useEffect(() => {
    if (slug && !service) {
      dispatch(fetchServiceBySlugAsync({ slug, token }));
    }
  }, [slug, service, token, dispatch]);

  if (loadStatus === 'loading' && !service) {
    return (
      <div className="pt-32 pb-24 min-h-screen bg-brand-darker flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-brand-orange animate-spin" />
      </div>
    );
  }

  if (!service) {
    return (
      <div className="pt-32 pb-24 min-h-screen bg-brand-darker flex flex-col items-center justify-center">
        <h1 className="text-4xl font-display font-bold text-white mb-4">Service Not Found</h1>
        <Link to="/services" className="text-brand-orange hover:text-white transition-colors">
          &larr; Back to Services
        </Link>
      </div>
    );
  }

  const hasVariations = service.variations && service.variations.length > 0;
  const quickInfoSpecs = hasVariations ? service.variations[0].specs : [];

  return (
    <div className="pt-32 pb-24 min-h-screen bg-brand-darker">
      <div className="container mx-auto px-4 md:px-6">
        <Link
          to="/services"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-brand-orange transition-colors mb-8 font-bold uppercase tracking-widest text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Services
        </Link>

        {/* ── Overview: description + features | pricing sidebar ─────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-16">
          {/* Left: overview content (2/3 width) */}
          <div className="lg:col-span-2 space-y-8">
            <div>
              <span className="text-brand-orange font-bold uppercase tracking-widest text-sm block mb-2">
                Service Details
              </span>
              <h1 className="text-4xl md:text-6xl font-display font-black text-white uppercase tracking-tighter mb-4">
                {service.title}
              </h1>
              <div className="w-20 h-1 bg-brand-orange mb-8" />
              <p className="text-gray-300 text-lg leading-relaxed">
                {service.fullDescription || service.description}
              </p>
            </div>

            {service.features.length > 0 && (
              <div className="bg-brand-gray/30 border border-gray-800 p-8 rounded-sm">
                <h3 className="text-2xl font-display font-bold text-white uppercase tracking-wide mb-6">
                  Key Features &amp; Benefits
                </h3>
                <ul className="space-y-4">
                  {service.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <CheckCircle2 className="w-6 h-6 text-brand-orange shrink-0 mt-0.5" />
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Right: pricing sidebar (1/3 width) */}
          <div className="space-y-6">
            {/* Price card */}
            <div className="bg-brand-dark border border-gray-800 rounded-sm p-6 space-y-4">
              {service.startingPrice && (
                <div>
                  <div className="text-4xl font-display font-black text-white leading-none">
                    {service.startingPrice}
                  </div>
                  <div className="text-gray-400 text-sm uppercase tracking-widest mt-1">
                    Starting Price
                  </div>
                </div>
              )}
              <Link
                to="/booking"
                state={{ serviceId: service.id }}
                className="block text-center bg-brand-orange hover:bg-orange-600 text-white font-display uppercase tracking-wider px-6 py-3 rounded-sm transition-all transform hover:-translate-y-0.5 hover:shadow-[0_8px_16px_rgba(243,111,33,0.3)]"
              >
                Book This Service
              </Link>
              <p className="text-gray-500 text-xs text-center">
                Free consultation · No hidden fees
              </p>
              {service.duration && (
                <div className="pt-2 border-t border-gray-800">
                  <span className="bg-gray-800 border border-gray-700 text-gray-300 font-bold px-3 py-1 rounded-sm text-xs uppercase tracking-widest">
                    {service.duration}
                  </span>
                </div>
              )}
            </div>

            {/* Quick info card – uses first variation's specs when available */}
            {quickInfoSpecs.length > 0 && (
              <div className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-800">
                  <h4 className="text-sm font-bold uppercase tracking-widest text-white">
                    Quick Info
                  </h4>
                </div>
                <ul className="divide-y divide-gray-800">
                  {quickInfoSpecs.map((spec, i) => (
                    <li key={i} className="flex items-start justify-between px-5 py-3 gap-4">
                      <span className="text-gray-400 text-sm font-bold shrink-0">{spec.label}</span>
                      <span className="text-white text-sm text-right">{spec.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* ── Variation gallery ───────────────────────────────────────────── */}
        {hasVariations && (
          <div>
            <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide mb-6">
              Available Packages
            </h2>
            <VariationGallery variations={service.variations} />
          </div>
        )}
      </div>
    </div>
  );
}

