import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Calendar, Loader2, AlertCircle, ImageIcon } from 'lucide-react';
import { fetchPortfolioAsync } from '../store/portfolioSlice';
import type { AppDispatch, RootState } from '../store';

export default function Portfolio() {
  const dispatch = useDispatch<AppDispatch>();
  const { items, status, error } = useSelector((s: RootState) => s.portfolio);

  useEffect(() => {
    dispatch(fetchPortfolioAsync(null));
  }, [dispatch]);

  const activeItems = items.filter(p => p.isActive);

  return (
    <div className="pt-32 pb-24 min-h-screen bg-brand-darker">
      <div className="container mx-auto px-4 md:px-6">
        {/* Page header */}
        <div className="mb-16 text-center max-w-3xl mx-auto">
          <span className="text-brand-orange font-bold uppercase tracking-widest text-sm block mb-2">
            Recent Builds
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-black text-white uppercase tracking-tighter mb-6">
            Our <span className="text-brand-orange">Portfolio</span>
          </h1>
          <p className="text-gray-400 text-lg leading-relaxed">
            Check out some of our recent installations and upgrades. Does your car also need a Full Setup?
          </p>
        </div>

        {/* Loading */}
        {status === 'loading' && (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="w-10 h-10 text-brand-orange animate-spin" />
          </div>
        )}

        {/* Error */}
        {status === 'error' && error && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertCircle className="w-10 h-10 text-red-500" />
            <p className="text-gray-400">{error}</p>
          </div>
        )}

        {/* Empty */}
        {status !== 'loading' && !error && activeItems.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <ImageIcon className="w-12 h-12 text-gray-700" />
            <p className="text-gray-400">No portfolio posts available yet. Check back soon!</p>
          </div>
        )}

        {/* Items – alternating left-right layout */}
        {activeItems.length > 0 && (
          <div className="space-y-16">
            {activeItems.map((item, index) => (
              <div
                key={item.id}
                className={`flex flex-col lg:flex-row gap-8 lg:gap-12 items-center ${index % 2 !== 0 ? 'lg:flex-row-reverse' : ''}`}
              >
                {/* Image */}
                {item.imageUrl && (
                  <div className="w-full lg:w-1/2">
                    <div className="relative aspect-[4/3] rounded-sm overflow-hidden border border-gray-800 group">
                      <div className="absolute inset-0 bg-brand-orange/20 mix-blend-overlay z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>
                )}

                {/* Content */}
                <div className={`flex flex-col ${item.imageUrl ? 'w-full lg:w-1/2' : 'w-full'}`}>
                  {item.category && (
                    <span className="text-brand-orange font-bold uppercase tracking-widest text-xs mb-2">
                      {item.category}
                    </span>
                  )}
                  <h2 className="text-2xl md:text-3xl font-display font-bold text-white uppercase tracking-wide mb-4">
                    {item.title}
                  </h2>
                  {item.description && (
                    <p className="text-gray-300 text-base leading-relaxed mb-6 whitespace-pre-wrap">
                      {item.description}
                    </p>
                  )}

                  {/* CTA */}
                  <div className="mt-auto p-6 bg-brand-dark border border-gray-800 rounded-sm">
                    <h4 className="text-white font-bold mb-2">Planning to upgrade your vehicle?</h4>
                    <p className="text-gray-400 text-sm mb-4">Message us today to schedule your installation.</p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Link
                        to="/booking"
                        className="inline-flex items-center justify-center gap-2 bg-brand-orange text-white px-6 py-3 font-bold uppercase tracking-widest hover:bg-white hover:text-brand-dark transition-colors"
                      >
                        <Calendar className="w-4 h-4" />
                        Book This Setup
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
