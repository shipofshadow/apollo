import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { BookOpen, Calendar } from 'lucide-react';
import { fetchBlogPostsAsync } from '../store/contentSlice';
import type { AppDispatch, RootState } from '../store';

export default function Blog() {
  const dispatch = useDispatch<AppDispatch>();
  const { posts, status } = useSelector((s: RootState) => s.content);

  useEffect(() => {
    dispatch(fetchBlogPostsAsync(null));
  }, [dispatch]);

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

        {/* Loading */}
        {status === 'loading' && (
          <div className="flex justify-center py-20">
            <div className="w-10 h-10 border-2 border-brand-orange border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Posts grid */}
        {posts.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map(post => (
              <article key={post.id}
                className="bg-brand-dark border border-gray-800 rounded-sm flex flex-col hover:border-brand-orange/50 transition-colors group">
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

        {/* Empty state */}
        {posts.length === 0 && status !== 'loading' && (
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
