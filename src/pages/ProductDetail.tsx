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
  const quickInfoSpecs = hasVariations ? product.variations[0].specs : [];

  return (
    <div className="pt-32 pb-24 min-h-screen bg-brand-darker">
      <div className="container mx-auto px-4 md:px-6">
        <Link
          to="/products"
          className="inline-flex items-center gap-2 text-gray-400 hover:text-brand-orange transition-colors mb-8 font-bold uppercase tracking-widest text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Products
        </Link>

        {/* ── Overview: description + features | pricing sidebar ─────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-16">
          {/* Left: overview content (2/3 width) */}
          <div className="lg:col-span-2 space-y-8">
            <div>
              <span className="text-brand-orange font-bold uppercase tracking-widest text-sm block mb-2">
                {product.category}
              </span>
              <h1 className="text-4xl md:text-5xl font-display font-black text-white uppercase tracking-tighter mb-4">
                {product.name}
              </h1>
              <div className="w-20 h-1 bg-brand-orange mb-8" />
              <p className="text-gray-300 text-lg leading-relaxed">
                {product.description}
              </p>
            </div>

            {product.features && product.features.length > 0 && (
              <div className="bg-brand-gray/30 border border-gray-800 p-8 rounded-sm">
                <h3 className="text-xl font-display font-bold text-white uppercase tracking-wider mb-6">
                  Key Features
                </h3>
                <ul className="space-y-4">
                  {product.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-brand-orange shrink-0 mt-0.5" />
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
              <div>
                <div className="text-4xl font-display font-black text-white leading-none">
                  ₱{product.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-gray-400 text-sm uppercase tracking-widest mt-1">
                  Price
                </div>
              </div>
              <Link
                to="/booking"
                className="block text-center bg-brand-orange hover:bg-orange-600 text-white font-display uppercase tracking-wider px-6 py-3 rounded-sm transition-all transform hover:-translate-y-0.5 hover:shadow-[0_8px_16px_rgba(243,111,33,0.3)]"
              >
                Inquire Now
              </Link>
              <p className="text-gray-500 text-xs text-center">
                Free consultation · No hidden fees
              </p>
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
              Available Options
            </h2>
            <VariationGallery variations={product.variations} />
          </div>
        )}
      </div>
    </div>
  );
}

