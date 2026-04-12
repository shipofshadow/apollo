import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Loader2 } from 'lucide-react';
import { fetchFacebookPosts } from '../services/api';
import type { FacebookPost } from '../types';
import { getPostImages, getPostTitle, getPostUrl, isPortfolioPost } from '../utils/facebookPostHelpers';

export default function RecentBuilds() {
  const [posts, setPosts] = useState<FacebookPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoPaused, setAutoPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchFacebookPosts()
      .then(({ posts: fetched }) => {
        if (!cancelled) {
          setPosts(fetched.filter(isPortfolioPost).slice(0, 6));
        }
      })
      .catch((err: unknown) => { console.error('[RecentBuilds] Failed to load Facebook posts:', err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const loopPosts = posts.length > 1 ? [...posts, ...posts] : posts;

  useEffect(() => {
    const track = trackRef.current;
    if (!track || loading || loopPosts.length <= 1 || autoPaused) return;

    let rafId = 0;
    let lastTs = 0;
    const pxPerSecond = 36;

    const animate = (ts: number) => {
      if (!trackRef.current) return;
      if (lastTs === 0) {
        lastTs = ts;
      }

      const dt = (ts - lastTs) / 1000;
      lastTs = ts;

      const el = trackRef.current;
      const half = el.scrollWidth / 2;
      el.scrollLeft += pxPerSecond * dt;

      // Seamless loop: once the first copy is traversed, jump back by half.
      if (el.scrollLeft >= half) {
        el.scrollLeft -= half;
      }

      rafId = window.requestAnimationFrame(animate);
    };

    rafId = window.requestAnimationFrame(animate);

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [loading, loopPosts.length, autoPaused]);

  return (
    <section id="builds" className="py-24 bg-brand-dark">
      <style>{`
        .recent-builds-track::-webkit-scrollbar {
          display: none;
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

        {posts.length > 0 && (
          <div className="relative">
            <div
              ref={trackRef}
              className="recent-builds-track flex gap-6 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none]"
              onMouseEnter={() => setAutoPaused(true)}
              onMouseLeave={() => setAutoPaused(false)}
              onTouchStart={() => setAutoPaused(true)}
              onTouchEnd={() => setAutoPaused(false)}
            >
            {loopPosts.map((post, index) => {
              const images = getPostImages(post);
              const title = getPostTitle(post, 60);
              const postUrl = getPostUrl(post.id);
              return (
                <a
                  key={`${post.id}-${index}`}
                  href={postUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative overflow-hidden rounded-sm bg-brand-gray aspect-[4/3] cursor-pointer block shrink-0 w-[72vw] sm:w-[38vw] lg:w-[24vw] xl:w-[20vw] min-w-[220px] max-w-[360px]"
                >
                  <img
                    src={images[0]}
                    alt={title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                  />

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-brand-darker via-brand-darker/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex flex-col justify-end p-8">

                    {/* View Icon */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-brand-orange rounded-full flex items-center justify-center opacity-0 scale-50 group-hover:opacity-100 group-hover:scale-100 transition-all duration-500 delay-100 shadow-[0_0_30px_rgba(255,106,0,0.5)]">
                      <Eye className="w-6 h-6 text-white" />
                    </div>

                    <div className="translate-y-8 group-hover:translate-y-0 transition-transform duration-500">
                      <h3 className="text-2xl font-display font-bold text-white uppercase tracking-wide">
                        {title}
                      </h3>
                    </div>
                  </div>
                </a>
              );
            })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
