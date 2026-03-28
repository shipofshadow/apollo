import { useEffect, useState } from 'react';
import type { Offer } from '../types';
import { fetchOffersApi } from '../services/api';

export default function PromoBanner() {
  const [offer, setOffer] = useState<Offer | null>(null);

  useEffect(() => {
    // Backend returns only active offers sorted by sort_order; the first one is the highest priority.
    fetchOffersApi()
      .then(({ offers }) => {
        if (offers.length > 0) setOffer(offers[0]);
      })
      .catch(() => {/* silently ignore – banner just won't show */});
  }, []);

  if (!offer) return null;

  return (
    <section className="relative py-32 overflow-hidden bg-asphalt border-y-4 border-brand-orange">
      {/* Background Image with Parallax Effect */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1611016186353-9af58c69a533?q=80&w=2071&auto=format&fit=crop"
          alt="Car Headlights"
          className="w-full h-full object-cover object-center opacity-20 mix-blend-luminosity"
          style={{ transform: 'translateZ(-1px) scale(1.5)' }}
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-brand-darker/90 to-brand-darker/60"></div>
      </div>

      <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          {offer.badgeText && (
            <span className="inline-block px-4 py-1 bg-brand-orange text-white font-bold uppercase tracking-widest text-sm rounded-sm shadow-lg">
              {offer.badgeText}
            </span>
          )}

          <h2 className="text-3xl sm:text-5xl md:text-7xl font-display font-black text-brand-orange uppercase leading-tight drop-shadow-2xl tracking-tighter text-outline">
            {offer.title}
          </h2>

          {offer.subtitle && (
            <p className="text-base md:text-lg text-brand-orange/80 font-bold uppercase tracking-widest">
              {offer.subtitle}
            </p>
          )}

          {offer.description && (
            <p className="text-xl md:text-2xl text-gray-300 font-medium max-w-2xl mx-auto">
              {offer.description}
            </p>
          )}

          <div className="pt-8">
            <a
              href={offer.ctaUrl || '#contact'}
              className="inline-block bg-brand-orange text-white font-display uppercase tracking-wider px-10 py-5 rounded-sm text-lg hover:bg-orange-600 transition-colors shadow-[0_10px_30px_rgba(243,111,33,0.3)] hover:-translate-y-1 transform duration-300"
            >
              {offer.ctaText || 'Claim Your Offer'}
            </a>
          </div>
        </div>
      </div>

      {/* Decorative Diagonal Lines */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute top-[-50%] left-[-10%] w-[120%] h-[200%] border-[40px] border-black/20 rotate-12"></div>
        <div className="absolute top-[-50%] right-[-10%] w-[120%] h-[200%] border-[20px] border-brand-orange/10 -rotate-12"></div>
      </div>
    </section>
  );
}

