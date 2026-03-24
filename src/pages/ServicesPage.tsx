import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../store';
import { fetchProductsAsync } from '../store/productsSlice';
import ServicesGrid from '../components/ServicesGrid';

export default function ServicesPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { items: products } = useSelector((s: RootState) => s.products);

  useEffect(() => {
    dispatch(fetchProductsAsync(null));
  }, [dispatch]);

  const featuredProducts = useMemo(
    () => products.filter(p => p.isActive).slice(0, 4),
    [products]
  );

  return (
    <div className="pt-32 pb-24 min-h-screen bg-brand-darker">
      <div className="container mx-auto px-4 md:px-6 mb-16 text-center">
        <span className="text-brand-orange font-bold uppercase tracking-widest text-sm block mb-4">
          Our Offerings
        </span>
        <h1 className="text-5xl md:text-7xl font-display font-black text-white uppercase tracking-tighter mb-8">
          Products & <span className="text-brand-orange">Services</span>
        </h1>
        <p className="text-gray-400 max-w-3xl mx-auto text-lg leading-relaxed">
          From custom lighting to advanced security systems, we provide top-tier automotive upgrades. Explore our full range of services below.
        </p>
      </div>

      <ServicesGrid />

      {/* Products Section */}
      {featuredProducts.length > 0 && (
        <div className="container mx-auto px-4 md:px-6 mt-32">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <span className="text-brand-orange font-bold uppercase tracking-widest text-sm">
              Shop Parts
            </span>
            <h2 className="text-4xl md:text-5xl font-display font-black text-white uppercase tracking-tighter">
              Featured <span className="text-brand-orange">Products</span>
            </h2>
            <div className="w-24 h-1 bg-brand-orange mx-auto mt-6"></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredProducts.map((product) => (
              <Link
                key={product.id}
                to={`/products/${product.id}`}
                className="bg-brand-dark border border-gray-800 rounded-sm overflow-hidden group hover:border-brand-orange/50 transition-colors duration-300"
              >
                <div className="aspect-square bg-asphalt overflow-hidden">
                  <img 
                    src={product.imageUrl} 
                    alt={product.name} 
                    className="w-full h-full object-cover mix-blend-luminosity group-hover:mix-blend-normal transition-all duration-500 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="p-6">
                  <h3 className="text-white font-bold uppercase tracking-wider mb-2">{product.name}</h3>
                  <p className="text-brand-orange font-display text-xl font-bold">
                    ${product.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
