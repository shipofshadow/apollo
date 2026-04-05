import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Lightbulb, MonitorPlay, Wrench, ShieldAlert, Zap, CarFront, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { fetchServicesAsync } from '../store/servicesSlice';
import type { AppDispatch, RootState } from '../store';
import { formatPrice } from '../utils/formatPrice';

const IconMap: Record<string, React.ElementType> = {
  Lightbulb,
  MonitorPlay,
  Zap,
  Wrench,
  ShieldAlert,
  CarFront,
};

export default function ServicesGrid() {
  const dispatch = useDispatch<AppDispatch>();
  const { items: services, status, error } = useSelector((s: RootState) => s.services);

  useEffect(() => {
    // Optimization: Only fetch if we haven't already, or handle it based on your slice logic
    if (status === 'idle') {
      dispatch(fetchServicesAsync(null));
    }
  }, [dispatch, status]);

  const visible = services.filter(s => s.isActive);

  return (
    <section id="services" className="py-24 bg-asphalt relative overflow-hidden border-t border-gray-800">
      <div className="container mx-auto px-4 md:px-6 relative z-10">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <span className="text-brand-orange font-bold uppercase tracking-widest text-sm">
            What We Do
          </span>
          <h2 className="text-4xl md:text-5xl font-display font-black text-white uppercase tracking-tighter">
            The <span className="text-brand-orange">Lab</span> Services
          </h2>
          <div className="w-24 h-1 bg-brand-orange mx-auto mt-6 rounded-full" />
        </div>

        {/* Loading State */}
        {status === 'loading' && (
          <div className="flex justify-center py-16 animate-in fade-in duration-500">
            <Loader2 className="w-10 h-10 text-brand-orange animate-spin" />
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="text-center py-16 bg-brand-darker/50 border border-red-900/30 rounded-sm space-y-3">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
            <p className="text-gray-400">{error ?? 'Failed to load services.'}</p>
            <button
              onClick={() => dispatch(fetchServicesAsync(null))}
              className="inline-flex items-center gap-2 mt-2 px-6 py-2.5 bg-brand-dark border border-gray-700 hover:border-brand-orange text-gray-300 hover:text-white text-sm font-bold uppercase tracking-widest rounded-sm transition-colors"
            >
              <RefreshCw className="w-4 h-4" /> Try Again
            </button>
          </div>
        )}

        {/* Empty State */}
        {status !== 'loading' && status !== 'error' && visible.length === 0 && (
          <div className="text-center py-16 bg-brand-darker/50 border border-gray-800 rounded-sm">
            <Wrench className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-400 uppercase tracking-widest">No Services Found</h3>
            <p className="text-gray-500 mt-2">Check back later or yell at the database admin.</p>
          </div>
        )}

        {/* Grid */}
        {status !== 'loading' && status !== 'error' && visible.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {visible.map((service) => {
              const Icon = IconMap[service.icon] ?? Wrench;
              
              return (
                <Link
                  to={`/services/${service.slug}`}
                  key={service.id}
                  className="group relative flex flex-col h-full bg-brand-darker/80 backdrop-blur-sm border border-gray-800 p-8 transition-all duration-300 hover:-translate-y-1 hover:border-brand-orange hover:bg-brand-dark hover:shadow-[0_8px_30px_rgba(243,111,33,0.15)]"
                >
                  {/* Decorative Corner */}
                  <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-transparent group-hover:border-brand-orange transition-colors duration-300 rounded-tr-sm" />

                  {/* Icon */}
                  <div className="mb-6 inline-flex items-center justify-center w-16 h-16 bg-brand-dark border border-gray-700 rounded-sm group-hover:bg-brand-orange group-hover:border-brand-orange transition-all duration-300 group-hover:shadow-[0_0_15px_rgba(243,111,33,0.6)] group-hover:scale-110 shrink-0">
                    <Icon className="w-8 h-8 text-brand-orange group-hover:text-white transition-colors duration-300" />
                  </div>

                  {/* Text Content */}
                  <h3 className="text-2xl font-display font-bold text-white mb-3 uppercase tracking-wide group-hover:text-brand-orange transition-colors duration-300">
                    {service.title}
                  </h3>

                  <p className="text-gray-400 leading-relaxed mb-4 line-clamp-3">
                    {service.description}
                  </p>

                  {/* Price & Duration Spacer */}
                  <div className="flex-grow flex flex-col justify-end">
                    {service.startingPrice && (
                      <p className="text-brand-orange font-bold text-sm bg-brand-orange/10 self-start px-3 py-1.5 rounded-sm">
                        {formatPrice(service.startingPrice)}
                        {service.duration && (
                          <span className="text-gray-400 font-normal ml-1">· {service.duration}</span>
                        )}
                      </p>
                    )}
                  </div>

                  {/* Action Link */}
                  <div className="mt-8 pt-6 border-t border-gray-800 flex items-center gap-3 text-sm font-bold uppercase tracking-widest text-gray-500 group-hover:text-brand-orange transition-colors duration-300 w-full">
                    <span>Learn More</span>
                    <div className="h-[1px] bg-gray-500 group-hover:bg-brand-orange flex-grow transition-all duration-300" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}