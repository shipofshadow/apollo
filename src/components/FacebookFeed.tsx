import { useEffect, useRef, useState } from 'react';
import { ThumbsUp, MessageCircle, Share2, MoreHorizontal, Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import type { FacebookPost } from '../types';
import { fetchFacebookPosts } from '../services/api';
import { getPostImages, getPostUrl } from '../utils/facebookPostHelpers';

const POSTS_PER_PAGE = 6;
const FETCH_BATCH = POSTS_PER_PAGE * 2; // pre-fetch two pages to minimise API round-trips

function formatDate(isoString: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(isoString));
  } catch {
    return '';
  }
}

export default function FacebookFeed() {
  const [posts, setPosts] = useState<FacebookPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    setLoading(true);
    setError(null);
    fetchFacebookPosts(undefined, FETCH_BATCH)
      .then(({ posts: fetched, nextCursor: cursor }) => {
        if (!cancelledRef.current) {
          setPosts(fetched);
          setNextCursor(cursor);
        }
      })
      .catch((err: unknown) => {
        if (!cancelledRef.current) setError(err instanceof Error ? err.message : 'Failed to load posts.');
      })
      .finally(() => {
        if (!cancelledRef.current) setLoading(false);
      });
    return () => { cancelledRef.current = true; };
  }, []);

  const totalLoadedPages = Math.max(1, Math.ceil(posts.length / POSTS_PER_PAGE));
  const hasNextPage = currentPage < totalLoadedPages || Boolean(nextCursor);
  const hasPrevPage = currentPage > 1;

  const pagePosts = posts.slice((currentPage - 1) * POSTS_PER_PAGE, currentPage * POSTS_PER_PAGE);

  function handlePrev() {
    if (!hasPrevPage) return;
    setCurrentPage((p) => p - 1);
  }

  function handleNext() {
    if (!hasNextPage) return;
    const nextPage = currentPage + 1;
    const needed = nextPage * POSTS_PER_PAGE;
    if (needed > posts.length && nextCursor) {
      setLoadingMore(true);
      fetchFacebookPosts(nextCursor, FETCH_BATCH)
        .then(({ posts: fetched, nextCursor: cursor }) => {
          setPosts((prev) => [...prev, ...fetched]);
          setNextCursor(cursor);
          setCurrentPage(nextPage);
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Failed to load more posts.');
        })
        .finally(() => {
          setLoadingMore(false);
        });
    } else {
      setCurrentPage(nextPage);
    }
  }

  return (
    <section className="py-24 bg-brand-darker border-t border-gray-800">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <span className="text-brand-orange font-bold uppercase tracking-widest text-sm">
            Social Updates
          </span>
          <h2 className="text-4xl md:text-5xl font-display font-black text-white uppercase tracking-tighter">
            Latest from <span className="text-brand-orange">The Lab</span>
          </h2>
          <div className="w-24 h-1 bg-brand-orange mx-auto mt-6" />
        </div>

        {loading && (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center justify-center gap-3 py-16 text-red-400">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {!loading && !error && posts.length === 0 && (
          <p className="text-center text-gray-500 py-16">No posts available at this time.</p>
        )}

        {!loading && !error && posts.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {pagePosts.map((post) => {
                const images = getPostImages(post);
                const postUrl = getPostUrl(post.id);
                return (
                  <a
                    key={post.id}
                    href={postUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group bg-brand-dark border border-gray-800 rounded-sm overflow-hidden hover:border-brand-orange/50 transition-colors flex flex-col"
                  >
                    {/* Image */}
                    {images.length > 0 && (
                      <div className="relative overflow-hidden aspect-video bg-gray-900">
                        <img
                          src={images[0]}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                        {images.length > 1 && (
                          <span className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-sm flex items-center gap-1">
                            <MoreHorizontal className="w-3 h-3" />
                            {images.length}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Body */}
                    <div className="p-4 flex flex-col gap-3 flex-1">
                      {post.message && (
                        <p className="text-gray-300 text-sm leading-relaxed line-clamp-4">
                          {post.message}
                        </p>
                      )}
                      <p className="text-gray-600 text-xs mt-auto">{formatDate(post.created_time)}</p>
                    </div>

                    {/* Footer */}
                    <div className="px-4 pb-4 flex items-center gap-4 text-gray-500 text-xs border-t border-gray-800 pt-3">
                      <span className="flex items-center gap-1">
                        <ThumbsUp className="w-3.5 h-3.5" />
                        {post.likes?.summary?.total_count ?? 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5" />
                        {post.comments?.summary?.total_count ?? 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Share2 className="w-3.5 h-3.5" />
                        {post.shares?.count ?? 0}
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>

            {/* Pagination controls */}
            {(hasPrevPage || hasNextPage) && (
              <div className="flex justify-center items-center gap-4 mt-12">
                <button
                  onClick={handlePrev}
                  disabled={!hasPrevPage || loadingMore}
                  aria-label="Previous page"
                  className="inline-flex items-center gap-2 bg-transparent border border-brand-orange text-brand-orange px-5 py-3 font-bold uppercase tracking-widest hover:bg-brand-orange hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Prev
                </button>

                <span className="text-gray-400 text-sm font-semibold tracking-widest uppercase">
                  Page {currentPage}
                </span>

                <button
                  onClick={handleNext}
                  disabled={!hasNextPage || loadingMore}
                  aria-label="Next page"
                  className="inline-flex items-center gap-2 bg-transparent border border-brand-orange text-brand-orange px-5 py-3 font-bold uppercase tracking-widest hover:bg-brand-orange hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
