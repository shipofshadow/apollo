import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Loader2, AlertCircle, ImageIcon } from 'lucide-react';
import { fetchFacebookPosts } from '../services/api';
import type { FacebookPost } from '../types';
import { getPostImages, getPostTitle, getPostUrl, isPortfolioPost } from '../utils/facebookPostHelpers';

export default function Portfolio() {
  const [posts, setPosts] = useState<FacebookPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchFacebookPosts()
      .then(({ posts: fetched }) => {
        if (!cancelled) {
          setPosts(fetched.filter(isPortfolioPost));
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load posts.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

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
        {loading && (
          <div className="flex justify-center items-center py-16">
            <Loader2 className="w-10 h-10 text-brand-orange animate-spin" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertCircle className="w-10 h-10 text-red-500" />
            <p className="text-gray-400">{error}</p>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && posts.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <ImageIcon className="w-12 h-12 text-gray-700" />
            <p className="text-gray-400">No portfolio posts available yet. Check back soon!</p>
          </div>
        )}

        {/* Items – alternating left-right layout */}
        {posts.length > 0 && (
          <div className="space-y-16">
            {posts.map((post, index) => {
              const images = getPostImages(post);
              const title = getPostTitle(post);
              const postUrl = getPostUrl(post.id);
              return (
                <div
                  key={post.id}
                  className={`flex flex-col lg:flex-row gap-8 lg:gap-12 items-center ${index % 2 !== 0 ? 'lg:flex-row-reverse' : ''}`}
                >
                  {/* Image */}
                  <div className="w-full lg:w-1/2">
                    <a href={postUrl} target="_blank" rel="noopener noreferrer"
                      className="block relative aspect-[4/3] rounded-sm overflow-hidden border border-gray-800 group">
                      <div className="absolute inset-0 bg-brand-orange/20 mix-blend-overlay z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      <img
                        src={images[0]}
                        alt={title}
                        className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                        referrerPolicy="no-referrer"
                        loading="lazy"
                      />
                    </a>
                  </div>

                  {/* Content */}
                  <div className="flex flex-col w-full lg:w-1/2">
                    <h2 className="text-2xl md:text-3xl font-display font-bold text-white uppercase tracking-wide mb-4">
                      {title}
                    </h2>
                    {post.message && (
                      <p className="text-gray-300 text-base leading-relaxed mb-6 whitespace-pre-wrap">
                        {post.message}
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
