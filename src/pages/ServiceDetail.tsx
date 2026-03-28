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

  return (
    <div className="pt-28 pb-16 min-h-screen bg-brand-darker">
      <div className="container mx-auto px-4 md:px-6">

        {/* ── Back link ───────────────────────────────────────────────────── */}
        <Link
          to="/services"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-brand-orange transition-colors mb-6 font-bold uppercase tracking-widest text-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Services
        </Link>

        {/* ── Compact header: title + price + CTA in one row ──────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
          <div>
            <span className="text-brand-orange font-bold uppercase tracking-widest text-xs block mb-1">
              Service Details
            </span>
            <h1 className="text-3xl md:text-5xl font-display font-black text-white uppercase tracking-tighter leading-none">
              {service.title}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {service.startingPrice && (
              <div className="text-right">
                <div className="text-2xl md:text-3xl font-display font-black text-white leading-none">
                  {service.startingPrice}
                </div>
                <div className="text-gray-500 text-xs uppercase tracking-widest">Starting Price</div>
              </div>
            )}
            {service.duration && (
              <span className="bg-gray-800 border border-gray-700 text-gray-300 font-bold px-3 py-1.5 rounded-sm text-xs uppercase tracking-widest">
                {service.duration}
              </span>
            )}
            <Link
              to="/booking"
              state={{ serviceId: service.id }}
              className="bg-brand-orange hover:bg-orange-600 text-white font-display uppercase tracking-wider px-5 py-2.5 rounded-sm transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_16px_rgba(243,111,33,0.3)] text-sm"
            >
              Book This Service
            </Link>
          </div>
        </div>

        <div className="h-px bg-gray-800 mb-8" />

        {/* ── Main grid: gallery (primary) + sticky sidebar ───────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left 2/3 – variation gallery (visible immediately) */}
          <div className="lg:col-span-2">
            {hasVariations ? (
              <VariationGallery variations={service.variations} />
            ) : service.imageUrl ? (
              <div className="aspect-video rounded-sm overflow-hidden border border-gray-800 bg-brand-dark">
                <img
                  src={service.imageUrl}
                  alt={service.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : null}
          </div>

          {/* Right 1/3 – sticky: description + features */}
          <div className="lg:sticky lg:top-28 lg:self-start space-y-5">

            <p className="text-gray-300 text-sm leading-relaxed">
              {service.fullDescription || service.description}
            </p>

            {service.features.length > 0 && (
              <div className="bg-brand-dark border border-gray-800 rounded-sm p-5">
                <h3 className="text-sm font-display font-bold text-white uppercase tracking-wide mb-4">
                  Key Features &amp; Benefits
                </h3>
                <ul className="space-y-3">
                  {service.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-gray-600 text-xs text-center">
              Free consultation · No hidden fees
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

