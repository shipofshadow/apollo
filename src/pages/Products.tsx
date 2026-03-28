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
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="pt-32 pb-24 min-h-screen bg-brand-darker">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
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
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12">
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <Filter className="w-5 h-5 text-brand-orange mr-2" />
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-4 py-2 text-sm font-bold uppercase tracking-widest transition-colors border ${
                  activeCategory === category 
                    ? 'bg-brand-orange text-white border-brand-orange' 
                    : 'bg-transparent text-gray-400 border-gray-800 hover:border-brand-orange hover:text-white'
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
              className="w-full bg-brand-dark border border-gray-800 text-white px-4 py-3 pl-10 focus:outline-none focus:border-brand-orange transition-colors"
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
              to={`/products/${product.id}`}
              key={product.id} 
              className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden group hover:border-brand-orange/50 transition-colors duration-300 flex flex-col"
            >
              <div className="aspect-square bg-asphalt overflow-hidden relative">
                <div className="absolute top-4 left-4 bg-brand-orange text-white text-xs font-bold uppercase tracking-widest px-3 py-1 z-10">
                  {product.category}
                </div>
                <img 
                  src={product.imageUrl} 
                  alt={product.name} 
                  className="w-full h-full object-cover mix-blend-luminosity group-hover:mix-blend-normal transition-all duration-500 group-hover:scale-110"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="p-6 flex flex-col flex-grow">
                <h3 className="text-white font-bold uppercase tracking-wider mb-2 text-lg line-clamp-2">{product.name}</h3>
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
