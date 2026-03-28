import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowLeft, Check } from 'lucide-react';
import type { AppDispatch, RootState } from '../store';
import { fetchProductsAsync } from '../store/productsSlice';
import VariationGallery from '../components/VariationGallery';

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
    <div className="pt-28 pb-16 min-h-screen bg-brand-darker">
      <div className="container mx-auto px-4 md:px-6">

        {/* ── Back link ───────────────────────────────────────────────────── */}
        <Link
          to="/products"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-brand-orange transition-colors mb-6 font-bold uppercase tracking-widest text-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Products
        </Link>

        {/* ── Compact header: title + price + CTA in one row ──────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5">
          <div>
            <span className="text-brand-orange font-bold uppercase tracking-widest text-xs block mb-1">
              {product.category}
            </span>
            <h1 className="text-3xl md:text-5xl font-display font-black text-white uppercase tracking-tighter leading-none">
              {product.name}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-2xl md:text-3xl font-display font-black text-white leading-none">
                ₱{product.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-gray-500 text-xs uppercase tracking-widest">Price</div>
            </div>
            <Link
              to="/booking"
              className="bg-brand-orange hover:bg-orange-600 text-white font-display uppercase tracking-wider px-5 py-2.5 rounded-sm transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_16px_rgba(243,111,33,0.3)] text-sm"
            >
              Inquire Now
            </Link>
          </div>
        </div>

        <div className="h-px bg-gray-800 mb-8" />

        {/* ── Main grid: gallery (primary) + sticky sidebar ───────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left 2/3 – variation gallery (visible immediately) */}
          <div className="lg:col-span-2">
            {hasVariations ? (
              <VariationGallery variations={product.variations} />
            ) : product.imageUrl ? (
              <div className="relative aspect-square rounded-sm overflow-hidden border border-gray-800 group">
                <div className="absolute inset-0 bg-brand-orange/20 mix-blend-overlay z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : null}
          </div>

          {/* Right 1/3 – sticky: description + features */}
          <div className="lg:sticky lg:top-28 lg:self-start space-y-5">

            <p className="text-gray-300 text-sm leading-relaxed">
              {product.description}
            </p>

            {product.features && product.features.length > 0 && (
              <div className="bg-brand-dark border border-gray-800 rounded-sm p-5">
                <h3 className="text-sm font-display font-bold text-white uppercase tracking-wide mb-4">
                  Key Features
                </h3>
                <ul className="space-y-3">
                  {product.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-brand-orange shrink-0 mt-0.5" />
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

