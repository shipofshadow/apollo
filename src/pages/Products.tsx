import { Search, Filter } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../store';
import { fetchProductsAsync } from '../store/productsSlice';
import { SkeletonCard } from '../components/Skeleton';
import { formatPrice } from '../utils/formatPrice';

export default function Products() {
  const dispatch = useDispatch<AppDispatch>();
  const { items: products, status } = useSelector((s: RootState) => s.products);

  useEffect(() => {
    dispatch(fetchProductsAsync(null));
  }, [dispatch]);

  const activeProducts = useMemo(() => products.filter(p => p.isActive), [products]);

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(activeProducts.map(p => p.category)))],
    [activeProducts]
  );

  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProducts = activeProducts.filter(product => {
    const matchesCategory = activeCategory === 'All' || product.category === activeCategory;
    const lowerSearch = searchQuery.toLowerCase();
    const matchesSearch =
      product.name.toLowerCase().includes(lowerSearch) ||
      product.description.toLowerCase().includes(lowerSearch) ||
      product.features.some((feature) => feature.toLowerCase().includes(lowerSearch));
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="pt-32 pb-24 min-h-screen bg-brand-darker relative overflow-hidden">
      <div className="pointer-events-none absolute -top-20 -right-20 w-72 h-72 bg-brand-orange/10 blur-3xl" />
      <div className="pointer-events-none absolute top-[28rem] -left-24 w-72 h-72 bg-white/[0.04] blur-3xl" />
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4 relative z-10">
          <span className="text-brand-orange font-bold uppercase tracking-widest text-sm">
            Shop Parts
          </span>
          <h1 className="text-4xl md:text-6xl font-display font-black text-white uppercase tracking-tighter">
            Product <span className="text-brand-orange">Catalog</span>
          </h1>
          <div className="w-24 h-1 bg-brand-orange mx-auto mt-6"></div>
          <p className="text-gray-400 mt-6 text-lg">
            High-quality components and kits tested and approved by The Lab.
          </p>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12 rounded-sm border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-transparent p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <Filter className="w-5 h-5 text-brand-orange mr-2" />
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all border rounded-sm ${
                  activeCategory === category 
                    ? 'bg-brand-orange/90 text-white border-brand-orange shadow-[0_6px_16px_rgba(243,111,33,0.28)]' 
                    : 'bg-black/20 text-gray-400 border-gray-800 hover:border-brand-orange hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-brand-dark/70 border border-gray-800 text-white px-4 py-3 pl-10 focus:outline-none focus:border-brand-orange transition-colors rounded-sm"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          </div>
        </div>

        {status === 'loading' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {status !== 'loading' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProducts.map((product) => (
            <Link 
              to={`/products/${product.uuid ?? product.id}`}
              key={product.id} 
              className="bg-gradient-to-b from-brand-dark to-[#11171c] border border-gray-800 rounded-sm overflow-hidden group hover:border-brand-orange/50 transition-all duration-300 flex flex-col hover:-translate-y-1 hover:shadow-[0_16px_34px_rgba(0,0,0,0.35)]"
            >
              <div className="aspect-square bg-asphalt overflow-hidden relative">
                <div className="absolute top-4 left-4 bg-brand-orange text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 z-10 rounded-sm">
                  {product.category}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />
                <img 
                  src={product.imageUrl} 
                  alt={product.name} 
                  className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="p-6 flex flex-col flex-grow">
                <h3 className="text-white font-bold uppercase tracking-wider mb-2 text-lg line-clamp-2 group-hover:text-brand-orange transition-colors">{product.name}</h3>
                <p className="text-sm text-gray-400 leading-relaxed line-clamp-2 mb-3">
                  {product.description || 'High-quality component, tested and tuned by The Lab.'}
                </p>
                {product.features.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {product.features.slice(0, 3).map((feature) => (
                      <span
                        key={feature}
                        className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-sm border border-gray-700 text-gray-300 bg-black/20"
                      >
                        {feature}
                      </span>
                    ))}
                    {product.features.length > 3 && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded-sm border border-gray-700 text-gray-500 bg-black/20">
                        +{product.features.length - 3} more
                      </span>
                    )}
                  </div>
                )}
                <p className="text-gray-500 text-xs uppercase tracking-[0.12em] mb-3">Tap to view details</p>
                <p className="text-brand-orange font-display text-2xl font-bold mt-auto">
                  {formatPrice(product.price)}
                </p>
              </div>
            </Link>
          ))}
        </div>
        )}

        {status !== 'loading' && filteredProducts.length === 0 && (
          <div className="text-center py-24">
            <p className="text-gray-500 text-lg">No products found matching your criteria.</p>
            <button 
              onClick={() => {
                setActiveCategory('All');
                setSearchQuery('');
              }}
              className="mt-4 text-brand-orange hover:text-white transition-colors underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
