/**
 * FacebookFeed
 *
 * Fetches posts from the Facebook Page via the /api/posts endpoint
 * (backed by the Facebook Graph API) and renders them as interactive
 * cards matching the site's dark-theme design.
 *
 * Posts whose message contains "#portfolio" (case-insensitive) receive
 * a visual "Portfolio" badge to distinguish build showcases.
 *
 * Clicking any card opens the original Facebook post in a new tab.
 */
import { useEffect, useState } from 'react';
import { Facebook, Heart, MessageCircle, Share2, ImageIcon, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import { fetchFacebookPosts } from '../services/api';
import type { FacebookPost } from '../types';

const FB_PAGE_URL = 'https://www.facebook.com/1625autolab';

/** Build a direct Facebook post permalink from a Graph API post id. */
function buildPostUrl(postId: string): string {
  // Graph API post IDs are in the format "{pageId}_{objectId}"
  const parts = postId.split('_');
  if (parts.length === 2) {
    return `https://www.facebook.com/${parts[0]}/posts/${parts[1]}`;
  }
  return `${FB_PAGE_URL}/posts/${postId}`;
}

/** Return a short, human-readable relative date string. */
function formatDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) === 1 ? '' : 's'} ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Pick the best available image from a post (full_picture or first attachment). */
function getPostImage(post: FacebookPost): string | null {
  if (post.full_picture) return post.full_picture;
  const firstAttachment = post.attachments?.data?.[0];
  return firstAttachment?.media?.image?.src ?? null;
}

/** Return true if the post message contains the #portfolio hashtag. */
function isPortfolioPost(post: FacebookPost): boolean {
  return /#portfolio/i.test(post.message ?? '');
}

/** Truncate text to at most maxLen characters, appending ellipsis if needed. */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + '…';
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface PostCardProps {
  post: FacebookPost;
}

function PostCard({ post }: PostCardProps) {
  const image   = getPostImage(post);
  const url     = buildPostUrl(post.id);
  const message = post.message ?? '';
  const isPortfolio = isPortfolioPost(post);

  const likes    = post.likes?.summary?.total_count    ?? 0;
  const comments = post.comments?.summary?.total_count ?? 0;
  const shares   = post.shares?.count                  ?? 0;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col bg-brand-dark border border-gray-800 rounded-sm overflow-hidden
                 transition-all duration-300 hover:border-brand-orange hover:scale-[1.02]
                 hover:shadow-[0_0_20px_rgba(243,111,33,0.25)] cursor-pointer"
    >
      {/* Image area */}
      <div className="relative w-full aspect-[4/3] overflow-hidden bg-brand-gray flex-shrink-0">
        {image ? (
          <img
            src={image}
            alt={message ? truncate(message, 80) : 'Image from 1625 Auto Lab Facebook post'}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-12 h-12 text-gray-700" />
          </div>
        )}

        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-brand-darker/80 to-transparent
                        opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

        {/* Portfolio badge */}
        {isPortfolio && (
          <div className="absolute top-3 left-3 px-3 py-1 bg-brand-orange text-white
                          text-xs font-bold uppercase tracking-widest rounded-sm shadow-lg">
            Portfolio
          </div>
        )}

        {/* External link hint */}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <ExternalLink className="w-4 h-4 text-white drop-shadow" />
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-5 gap-3">
        {/* Date */}
        <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
          {formatDate(post.created_time)}
        </span>

        {/* Message */}
        {message && (
          <p className="text-sm text-gray-300 leading-relaxed flex-1">
            {truncate(message, 160)}
          </p>
        )}

        {/* Engagement counts */}
        <div className="flex items-center gap-5 pt-3 border-t border-gray-800 mt-auto">
          <span className="flex items-center gap-1.5 text-xs text-gray-500 group-hover:text-gray-400 transition-colors">
            <Heart className="w-3.5 h-3.5" />
            {likes.toLocaleString()}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-500 group-hover:text-gray-400 transition-colors">
            <MessageCircle className="w-3.5 h-3.5" />
            {comments.toLocaleString()}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-500 group-hover:text-gray-400 transition-colors">
            <Share2 className="w-3.5 h-3.5" />
            {shares.toLocaleString()}
          </span>
        </div>
      </div>
    </a>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FacebookFeed() {
  const [posts, setPosts]     = useState<FacebookPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { posts: fetched } = await fetchFacebookPosts();
        if (!cancelled) {
          setPosts(fetched);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load posts.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

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

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-10 h-10 text-brand-orange animate-spin" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <AlertCircle className="w-10 h-10 text-brand-orange" />
            <p className="text-gray-400 max-w-md">{error}</p>
            <a
              href={FB_PAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-gray-700 text-gray-300
                         hover:border-brand-orange hover:text-brand-orange px-6 py-2.5
                         font-bold uppercase tracking-widest text-sm transition-colors rounded-sm"
            >
              <Facebook className="w-4 h-4" />
              View on Facebook
            </a>
          </div>
        )}

        {/* Posts grid */}
        {!loading && !error && posts.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>

            {/* Footer CTA */}
            <div className="flex justify-center mt-12">
              <a
                href={FB_PAGE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 border border-gray-700 text-gray-300
                           hover:border-brand-orange hover:text-brand-orange px-8 py-3
                           font-bold uppercase tracking-widest text-sm transition-colors rounded-sm"
              >
                <Facebook className="w-5 h-5" />
                View All Posts on Facebook
              </a>
            </div>
          </>
        )}

        {/* Empty state */}
        {!loading && !error && posts.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <Facebook className="w-10 h-10 text-gray-700" />
            <p className="text-gray-500">No posts available right now — check back soon!</p>
            <a
              href={FB_PAGE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 border border-gray-700 text-gray-300
                         hover:border-brand-orange hover:text-brand-orange px-6 py-2.5
                         font-bold uppercase tracking-widest text-sm transition-colors rounded-sm"
            >
              <Facebook className="w-4 h-4" />
              Visit Our Facebook Page
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

