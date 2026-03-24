import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { BookOpen, Calendar, Search } from 'lucide-react';
import { fetchBlogPostsAsync } from '../store/contentSlice';
import type { AppDispatch, RootState } from '../store';
import { SkeletonBlogCard } from '../components/Skeleton';

export default function Blog() {
  const dispatch = useDispatch<AppDispatch>();
  const { posts, status } = useSelector((s: RootState) => s.content);

  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    dispatch(fetchBlogPostsAsync(null));
  }, [dispatch]);

  const publishedPosts = useMemo(
    () => posts.filter(p => p.status === 'Published'),
    [posts]
  );

  const filteredPosts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return publishedPosts;
    return publishedPosts.filter(
      p =>
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q)
    );
  }, [publishedPosts, searchQuery]);

  return (
    <div className="pt-32 pb-24 min-h-screen bg-brand-darker">
      <div className="container mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="mb-12 text-center">
          <p className="text-brand-orange font-bold uppercase tracking-widest text-sm mb-3">Latest Updates</p>
          <h1 className="text-4xl md:text-5xl font-display font-black text-white uppercase tracking-tighter">
            Our <span className="text-brand-orange">Blog</span>
          </h1>
          <p className="text-gray-400 mt-4 max-w-xl mx-auto">
            Tips, updates, and insights from the 1625 Autolab team.
          </p>
        </div>

        {/* Search bar */}
        {(status !== 'loading' && publishedPosts.length > 0) && (
          <div className="max-w-md mx-auto mb-10">
            <div className="relative">
              <input
                type="text"
                placeholder="Search posts…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-brand-dark border border-gray-800 text-white px-4 py-3 pl-10 focus:outline-none focus:border-brand-orange transition-colors rounded-sm"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            </div>
          </div>
        )}

        {/* Loading skeletons */}
        {status === 'loading' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonBlogCard key={i} />
            ))}
          </div>
        )}

        {/* Posts grid */}
        {status !== 'loading' && filteredPosts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPosts.map(post => (
              <article key={post.id}
                className="bg-brand-dark border border-gray-800 rounded-sm flex flex-col hover:border-brand-orange/50 transition-colors group">
                {post.coverImage && (
                  <div className="h-48 w-full overflow-hidden rounded-t-sm">
                    <img
                      src={post.coverImage}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
                <div className="p-6 flex flex-col flex-grow">
                  <div className="flex items-center gap-2 text-xs text-gray-500 mb-3 font-bold uppercase tracking-widest">
                    <Calendar className="w-3.5 h-3.5" />
                    <time dateTime={post.createdAt}>
                      {new Date(post.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'long', day: 'numeric',
                      })}
                    </time>
                  </div>
                  <h2 className="text-white font-display font-bold text-xl mb-3 group-hover:text-brand-orange transition-colors leading-snug">
                    {post.title}
                  </h2>
                  <p className="text-gray-400 text-sm leading-relaxed flex-grow line-clamp-4">
                    {post.content}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* No results from search */}
        {status !== 'loading' && publishedPosts.length > 0 && filteredPosts.length === 0 && (
          <div className="text-center py-20">
            <Search className="w-10 h-10 mx-auto mb-4 text-gray-700" />
            <p className="text-gray-500 text-lg">No posts match "{searchQuery}".</p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-3 text-brand-orange hover:text-white transition-colors underline text-sm"
            >
              Clear search
            </button>
          </div>
        )}

        {/* Empty state */}
        {status !== 'loading' && publishedPosts.length === 0 && (
          <div className="text-center py-20">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-700" />
            <p className="text-gray-500 text-lg">No posts yet. Check back soon!</p>
          </div>
        )}

        {/* CTA */}
        <div className="mt-20 text-center">
          <Link to="/booking"
            className="inline-flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white font-display uppercase tracking-wider px-8 py-4 rounded-sm transition-all transform hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(243,111,33,0.3)]">
            Book an Appointment
          </Link>
        </div>
      </div>
    </div>
  );
}
