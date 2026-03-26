import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { Eye, Loader2 } from 'lucide-react';
import { fetchPortfolioAsync } from '../store/portfolioSlice';
import type { AppDispatch, RootState } from '../store';

export default function RecentBuilds() {
  const dispatch = useDispatch<AppDispatch>();
  const { items, status } = useSelector((s: RootState) => s.portfolio);

  useEffect(() => {
    // Only fetch if we haven't loaded yet
    if (status === 'idle') {
      dispatch(fetchPortfolioAsync(null));
    }
  }, [dispatch, status]);

  // Show up to 6 active items on the homepage
  const visible = items.filter(b => b.isActive).slice(0, 6);

  return (
    <section id="builds" className="py-24 bg-brand-dark">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
          <div className="space-y-4 max-w-2xl">
            <span className="text-brand-orange font-bold uppercase tracking-widest text-sm">
              Our Portfolio
            </span>
            <h2 className="text-4xl md:text-5xl font-display font-bold text-white uppercase">
              Recent <span className="text-brand-orange">Builds</span>
            </h2>
            <div className="w-24 h-1 bg-brand-orange mt-6" />
          </div>

          <Link
            to="/portfolio"
            className="group inline-flex items-center gap-2 text-white font-display uppercase tracking-wider text-sm hover:text-brand-orange transition-colors"
          >
            View All Projects
            <div className="w-8 h-[1px] bg-white group-hover:bg-brand-orange transition-colors" />
          </Link>
        </div>

        {status === 'loading' && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-10 h-10 text-brand-orange animate-spin" />
          </div>
        )}

        {status !== 'loading' && visible.length === 0 && (
          <p className="text-gray-500 text-center py-16">No portfolio items yet — check back soon!</p>
        )}

        {visible.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {visible.map((build) => (
              <div
                key={build.id}
                className="group relative overflow-hidden rounded-sm bg-brand-gray aspect-[4/3] cursor-pointer"
              >
                {build.imageUrl ? (
                  <img
                    src={build.imageUrl}
                    alt={build.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full bg-brand-gray flex items-center justify-center">
                    <span className="text-gray-600 text-sm font-bold uppercase tracking-widest">No Image</span>
                  </div>
                )}

                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-brand-darker via-brand-darker/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-8">

                  {/* View Icon */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-brand-orange rounded-full flex items-center justify-center opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-500 delay-100 shadow-[0_0_30px_rgba(255,106,0,0.5)]">
                    <Eye className="w-6 h-6 text-white" />
                  </div>

                  <div className="translate-y-8 group-hover:translate-y-0 transition-transform duration-500">
                    {build.category && (
                      <span className="text-brand-orange font-bold uppercase tracking-widest text-xs mb-2 block">
                        {build.category}
                      </span>
                    )}
                    <h3 className="text-2xl font-display font-bold text-white uppercase tracking-wide">
                      {build.title}
                    </h3>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
