import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Calendar } from 'lucide-react';
import { fetchBlogPostByIdApi } from '../services/api';
import type { BlogPost } from '../types';
import PageSEO from '../components/PageSEO';

function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent ?? tmp.innerText ?? '';
}

export default function BlogPostDetail() {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    if (!id) return;
    setStatus('loading');
    fetchBlogPostByIdApi(Number(id))
      .then(({ post: p }) => {
        setPost(p);
        setStatus('success');
      })
      .catch(() => setStatus('error'));
  }, [id]);

  if (status === 'loading') {
    return (
      <div className="pt-32 pb-24 min-h-screen bg-brand-darker flex items-start justify-center">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl animate-pulse">
          <div className="h-8 bg-gray-800 rounded mb-6 w-3/4" />
          <div className="h-4 bg-gray-800 rounded mb-3 w-1/3" />
          <div className="h-64 bg-gray-800 rounded mb-6" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-4 bg-gray-800 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (status === 'error' || !post) {
    return (
      <div className="pt-32 pb-24 min-h-screen bg-brand-darker flex flex-col items-center justify-start text-center">
        <p className="text-gray-400 text-lg mb-4">Post not found.</p>
        <Link to="/blog" className="text-brand-orange hover:text-orange-400 underline text-sm">
          ← Back to Blog
        </Link>
      </div>
    );
  }

  const excerpt = stripHtml(post.content).slice(0, 160);

  return (
    <div className="pt-32 pb-24 min-h-screen bg-brand-darker">
      <PageSEO
        title={post.title}
        description={excerpt}
      />

      <article className="container mx-auto px-4 md:px-6 max-w-3xl">
        {/* Back link */}
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-orange transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Blog
        </Link>

        {/* Cover image */}
        {post.coverImage && (
          <div className="w-full h-72 md:h-96 overflow-hidden rounded-sm mb-8">
            <img
              src={post.coverImage}
              alt={post.title}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
        )}

        {/* Meta */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-4 font-bold uppercase tracking-widest">
          <Calendar className="w-3.5 h-3.5" />
          <time dateTime={post.createdAt}>
            {new Date(post.createdAt).toLocaleDateString('en-US', {
              year: 'numeric', month: 'long', day: 'numeric',
            })}
          </time>
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-display font-black text-white uppercase tracking-tight mb-8 leading-tight">
          {post.title}
        </h1>

        {/* Content */}
        <div
          className="blog-prose"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* Footer CTA */}
        <div className="mt-16 border-t border-gray-800 pt-10 text-center">
          <p className="text-gray-400 mb-4 text-sm">Ready to upgrade your ride?</p>
          <Link
            to="/booking"
            className="inline-flex items-center gap-2 bg-brand-orange hover:bg-orange-600 text-white font-display uppercase tracking-wider px-8 py-4 rounded-sm transition-all hover:-translate-y-1 hover:shadow-[0_10px_20px_rgba(243,111,33,0.3)]"
          >
            Book an Appointment
          </Link>
        </div>
      </article>
    </div>
  );
}
