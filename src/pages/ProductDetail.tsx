import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowLeft, Check } from 'lucide-react';
import type { AppDispatch, RootState } from '../store';
import { fetchProductsAsync } from '../store/productsSlice';
import VariationGallery from '../components/VariationGallery';
import { formatPrice } from '../utils/formatPrice';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const { items: products, status } = useSelector((s: RootState) => s.products);

  useEffect(() => {
    if (status === 'idle') {
      dispatch(fetchProductsAsync(null));
    }
  }, [dispatch, status]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-brand-darker pt-32 pb-24 flex items-center justify-center">
        <div className="text-center text-gray-400">Loading…</div>
      </div>
    );
  }

  const product = products.find(p => p.id === Number(id));

  if (!product) {
    return (
      <div className="min-h-screen bg-brand-darker pt-32 pb-24 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-display font-black text-white mb-4">Product Not Found</h1>
          <Link to="/products" className="text-brand-orange hover:text-white transition-colors">
            Return to Products
          </Link>
        </div>
      </div>
    );
  }

  const hasVariations = product.variations && product.variations.length > 0;

  return (
    <div className="min-h-screen bg-brand-darker pb-20">

      {/* ── Hero Strip ──────────────────────────────────────────────────────── */}
      <div className="relative h-[460px] md:h-[540px] overflow-hidden">
        {/* Hero image with slow-zoom entrance */}
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="absolute inset-0 w-full h-full object-cover animate-slowzoom"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="absolute inset-0 bg-brand-dark" />
        )}

        {/* Gradient: darken top (for nav), transparent mid, solid bottom */}
        <div className="absolute inset-0 bg-gradient-to-b from-brand-darker/60 via-brand-darker/10 to-brand-darker pointer-events-none" />

        {/* Back link — top-left, padded to clear the fixed nav */}
        <div className="absolute top-0 left-0 right-0 pt-24 md:pt-[6.5rem]">
          <div className="container mx-auto px-4 md:px-8">
            <Link
              to="/products"
              className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors font-bold uppercase tracking-widest text-[0.65rem]"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Products
            </Link>
          </div>
        </div>

        {/* Title + meta — bottom of hero */}
        <div className="absolute bottom-0 left-0 right-0">
          <div className="container mx-auto px-4 md:px-8 pb-10">
            {/* Eyebrow */}
            <div className="flex items-center gap-3 mb-3 animate-fadeInUp">
              <span className="block w-5 h-px bg-brand-orange" />
              <span className="text-brand-orange font-bold uppercase tracking-[0.18em] text-[0.65rem]">
                {product.category}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-5xl md:text-7xl font-display font-black text-white uppercase tracking-tight leading-none mb-4 animate-fadeInUp animate-delay-100">
              {product.name}
            </h1>

            {/* Price badge */}
            <div className="flex items-center gap-5 flex-wrap animate-fadeInUp animate-delay-200">
              <span className="text-brand-orange font-display font-black text-2xl leading-none">
                {formatPrice(product.price)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="container mx-auto px-4 md:px-8 pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

          {/* ── Left 2/3 — variation gallery ──────────────────────────────── */}
          <div className="lg:col-span-2">
            {hasVariations && (
              <>
                {/* Section label with horizontal rule */}
                <div className="flex items-center gap-4 mb-5">
                  <h2 className="text-xl font-display font-black text-white uppercase tracking-tight whitespace-nowrap">
                    Available Options
                  </h2>
                  <div className="flex-1 h-px bg-white/[0.07]" />
                </div>
                <VariationGallery variations={product.variations} />
              </>
            )}
            {!hasVariations && product.imageUrl && (
              <div className="relative aspect-[4/3] rounded-sm overflow-hidden border border-white/[0.07] group">
                <div className="absolute inset-0 bg-brand-orange/10 mix-blend-overlay z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
              </div>
            )}
          </div>

          {/* ── Right 1/3 — sticky sidebar ────────────────────────────────── */}
          <div className="lg:sticky lg:top-24 lg:self-start flex flex-col gap-4">

            {/* CTA card — gradient with orange border glow */}
            <div className="bg-gradient-to-br from-[#1a0d00] to-brand-darker border border-brand-orange/20 rounded-sm p-6 text-center animate-fadeInUp">
              <div className="text-4xl font-display font-black text-brand-orange leading-none">
                {formatPrice(product.price)}
              </div>
              <div className="text-gray-500 text-[0.65rem] font-bold uppercase tracking-[0.12em] mt-1 mb-5">
                Price
              </div>
              <Link
                to="/booking"
                className="block w-full bg-brand-orange hover:bg-orange-500 text-white font-display font-bold uppercase tracking-widest text-sm px-5 py-3 rounded-sm transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(243,111,33,0.4)] mb-3"
              >
                Inquire Now
              </Link>
              <p className="text-gray-600 text-[0.7rem]">Free consultation · No hidden fees</p>
            </div>

            {/* Description — left orange border */}
            <p className="text-gray-400 text-sm leading-[1.85] border-l-2 border-brand-orange pl-4 animate-fadeInUp animate-delay-100">
              {product.description}
            </p>

            {/* Features — row list with icon boxes */}
            {product.features && product.features.length > 0 && (
              <div className="border border-white/[0.07] rounded-sm overflow-hidden animate-fadeInUp animate-delay-200">
                {product.features.map((feature, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3 px-4 py-3 border-b border-white/[0.07] last:border-b-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <span className="w-6 h-6 bg-brand-orange/10 border border-brand-orange/20 rounded-sm flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3 h-3 text-brand-orange" />
                    </span>
                    <span className="text-gray-300 text-sm leading-snug">{feature}</span>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
