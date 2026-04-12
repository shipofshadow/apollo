import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Eye, Loader2 } from 'lucide-react';
import { fetchAllFacebookPosts } from '../services/api';
import type { FacebookPost } from '../types';
import { getPostImages, getPostTitle, getPostUrl, isPortfolioPost } from '../utils/facebookPostHelpers';

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export default function RecentBuilds() {
  const location = useLocation();
  const [posts, setPosts] = useState<FacebookPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoPaused, setAutoPaused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [zoomActive, setZoomActive] = useState(false);
  const autoTimerRef = useRef<number | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);

  const buildSearch = new URLSearchParams(location.search).get('buildSearch')?.trim()
    ?? new URLSearchParams(location.search).get('portfolioSearch')?.trim()
    ?? '';

  useEffect(() => {
    let cancelled = false;
    fetchAllFacebookPosts()
      .then((fetched) => {
        if (!cancelled) {
          setPosts(fetched.filter(isPortfolioPost));
        }
      })
      .catch((err: unknown) => { console.error('[RecentBuilds] Failed to load Facebook posts:', err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const visiblePosts = posts.filter((post) => {
    if (buildSearch === '') return true;
    const haystack = normalizeSearchText(`${post.message ?? ''} ${getPostTitle(post, 160)}`);
    const needle = normalizeSearchText(buildSearch);
    return haystack.includes(needle);
  });

  useEffect(() => {
    if (visiblePosts.length === 0) {
      setActiveIndex(0);
      return;
    }
    if (activeIndex >= visiblePosts.length) {
      setActiveIndex(0);
    }
  }, [visiblePosts.length, activeIndex]);

  useEffect(() => {
    if (loading || visiblePosts.length <= 1 || autoPaused) return;

    autoTimerRef.current = window.setInterval(() => {
      setActiveIndex(prev => (prev + 1) % visiblePosts.length);
    }, 4200);

    return () => {
      if (autoTimerRef.current !== null) {
        window.clearInterval(autoTimerRef.current);
        autoTimerRef.current = null;
      }
    };
  }, [loading, visiblePosts.length, autoPaused]);

  useEffect(() => {
    if (buildSearch === '' || visiblePosts.length === 0) {
      setZoomActive(false);
      return;
    }

    setActiveIndex(0);

    // Small delay so the page finishes rendering/navigating before we scroll
    const scrollTimer = window.setTimeout(() => {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);

    setZoomActive(true);

    const zoomTimer = window.setTimeout(() => {
      setZoomActive(false);
    }, 1400);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(zoomTimer);
    };
  }, [buildSearch, visiblePosts.length]);

  const goPrev = () => {
    if (visiblePosts.length === 0) return;
    setActiveIndex(prev => (prev - 1 + visiblePosts.length) % visiblePosts.length);
  };

  const goNext = () => {
    if (visiblePosts.length === 0) return;
    setActiveIndex(prev => (prev + 1) % visiblePosts.length);
  };

  return (
    <section id="builds" ref={sectionRef} className="py-24 bg-brand-dark">
      <style>{`
        .recent-builds-track::-webkit-scrollbar {
          display: none;
        }
        @keyframes rb-popout {
          0%   { box-shadow: 0 0 0 0 rgba(249,115,22,0);   transform: scale(1);     }
          25%  { box-shadow: 0 0 0 8px rgba(249,115,22,0.55); transform: scale(1.018); }
          60%  { box-shadow: 0 0 0 4px rgba(249,115,22,0.25); transform: scale(1.012); }
          100% { box-shadow: 0 0 0 0 rgba(249,115,22,0);   transform: scale(1);     }
        }
        .rb-popout-active {
          animation: rb-popout 1.4s cubic-bezier(0.22,1,0.36,1) forwards;
        }
      `}</style>
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

        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-10 h-10 text-brand-orange animate-spin" />
          </div>
        )}

        {!loading && posts.length === 0 && (
          <p className="text-gray-500 text-center py-16">No portfolio items yet — check back soon!</p>
        )}

        {!loading && posts.length > 0 && buildSearch !== '' && visiblePosts.length === 0 && (
          <p className="text-gray-500 text-center py-16">No matching recent builds for "{buildSearch}".</p>
        )}

        {visiblePosts.length > 0 && (
          <div
            className="relative"
            onMouseEnter={() => setAutoPaused(true)}
            onMouseLeave={() => setAutoPaused(false)}
            onTouchStart={() => setAutoPaused(true)}
            onTouchEnd={() => setAutoPaused(false)}
          >
            <div className={`relative h-[420px] md:h-[520px] overflow-hidden rounded-sm border bg-brand-gray transition-colors duration-300 ${zoomActive ? 'border-brand-orange rb-popout-active' : 'border-gray-800'}`}>
              {visiblePosts.map((post, index) => {
                const images = getPostImages(post);
                const title = getPostTitle(post, 90);
                const postUrl = getPostUrl(post.id);
                const active = index === activeIndex;

                return (
                  <a
                    key={post.id}
                    href={postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`absolute inset-0 block transition-opacity duration-700 ${active ? 'opacity-100 z-20' : 'opacity-0 z-10 pointer-events-none'}`}
                  >
                    <img
                      src={images[0]}
                      alt={title}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      loading={active ? 'eager' : 'lazy'}
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10" />

                    <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
                      <div className="inline-flex items-center gap-2 bg-brand-orange/90 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-sm mb-4">
                        <Eye className="w-3.5 h-3.5" /> Featured Build
                      </div>

                      <h3 className="text-2xl md:text-4xl font-display font-bold text-white uppercase tracking-wide max-w-4xl leading-tight">
                        {title}
                      </h3>
                    </div>
                  </a>
                );
              })}

              {visiblePosts.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goPrev}
                    className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-black/45 border border-white/25 text-white hover:border-brand-orange hover:text-brand-orange transition-colors inline-flex items-center justify-center"
                    aria-label="Previous slide"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <button
                    type="button"
                    onClick={goNext}
                    className="absolute right-4 md:right-6 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-black/45 border border-white/25 text-white hover:border-brand-orange hover:text-brand-orange transition-colors inline-flex items-center justify-center"
                    aria-label="Next slide"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            {visiblePosts.length > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                {visiblePosts.map((post, index) => (
                  <button
                    key={`${post.id}-dot`}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    className={`h-2.5 rounded-full transition-all ${index === activeIndex ? 'w-8 bg-brand-orange' : 'w-2.5 bg-gray-600 hover:bg-gray-400'}`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
