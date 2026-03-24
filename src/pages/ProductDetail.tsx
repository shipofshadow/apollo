import { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowLeft, Check } from 'lucide-react';
import type { AppDispatch, RootState } from '../store';
import { fetchProductsAsync } from '../store/productsSlice';

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

  return (
    <div className="pt-32 pb-24 min-h-screen bg-brand-darker">
      <div className="container mx-auto px-4 md:px-6">
        <Link 
          to="/products" 
          className="inline-flex items-center gap-2 text-gray-400 hover:text-brand-orange transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Products
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Product Image */}
          <div className="relative aspect-square rounded-sm overflow-hidden border border-gray-800 group">
            <div className="absolute inset-0 bg-brand-orange/20 mix-blend-overlay z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <img 
              src={product.imageUrl} 
              alt={product.name}
              className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Product Info */}
          <div className="flex flex-col">
            <div className="mb-6">
              <span className="text-brand-orange font-bold uppercase tracking-widest text-sm block mb-2">
                {product.category}
              </span>
              <h1 className="text-4xl md:text-5xl font-display font-black text-white uppercase tracking-tighter mb-4">
                {product.name}
              </h1>
              <div className="text-3xl font-display font-bold text-white">
                ${product.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="prose prose-invert prose-orange max-w-none mb-8">
              <p className="text-gray-400 text-lg leading-relaxed">
                {product.description}
              </p>
            </div>

            {product.features && product.features.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xl font-display font-bold text-white uppercase tracking-wider mb-4">
                  Key Features
                </h3>
                <ul className="space-y-3">
                  {product.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3 text-gray-400">
                      <Check className="w-5 h-5 text-brand-orange shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
