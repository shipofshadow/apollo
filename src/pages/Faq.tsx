import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ChevronDown, HelpCircle, Loader2, AlertCircle } from 'lucide-react';
import { fetchFaqsAsync } from '../store/faqSlice';
import type { AppDispatch, RootState } from '../store';

export default function FaqPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { items, status, error } = useSelector((s: RootState) => s.faq);

  const [openId, setOpenId] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('All');

  useEffect(() => {
    dispatch(fetchFaqsAsync(null));
  }, [dispatch]);

  // Derive unique categories from active items
  const categories = ['All', ...Array.from(new Set(items.map(f => f.category))).sort()];

  const filtered = activeCategory === 'All'
    ? items
    : items.filter(f => f.category === activeCategory);

  return (
    <div className="min-h-screen bg-brand-dark">
      {/* Hero */}
      <section className="bg-brand-darker border-b border-gray-800 pt-32 pb-16">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <p className="text-brand-orange text-sm font-bold uppercase tracking-widest mb-4">
            Got Questions?
          </p>
          <h1 className="text-4xl md:text-6xl font-display font-black text-white uppercase tracking-tighter leading-none mb-6">
            Frequently Asked <span className="text-brand-orange">Questions</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Find answers to the most common questions about our services, booking, and pricing.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16">
        <div className="container mx-auto px-4 md:px-6 max-w-4xl">

          {/* Category tabs */}
          {categories.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-10">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-sm transition-colors ${
                    activeCategory === cat
                      ? 'bg-brand-orange text-white'
                      : 'bg-brand-darker border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Loading */}
          {status === 'loading' && (
            <div className="flex justify-center py-20">
              <Loader2 className="w-10 h-10 text-brand-orange animate-spin" />
            </div>
          )}

          {/* Error */}
          {status === 'error' && error && (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-400 px-5 py-4 rounded-sm mb-8">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* FAQ accordion */}
          {status !== 'loading' && filtered.length > 0 && (
            <div className="space-y-3">
              {filtered.map(faq => (
                <div key={faq.id} className="bg-brand-darker border border-gray-800 rounded-sm overflow-hidden">
                  <button
                    className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
                    onClick={() => setOpenId(openId === faq.id ? null : faq.id)}
                  >
                    <span className="text-white font-bold leading-snug">{faq.question}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-brand-orange shrink-0 transition-transform duration-200 ${
                        openId === faq.id ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {openId === faq.id && (
                    <div className="px-6 pb-5 border-t border-gray-800">
                      <p className="text-gray-400 leading-relaxed pt-4">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Empty */}
          {status !== 'loading' && filtered.length === 0 && !error && (
            <div className="text-center py-20">
              <HelpCircle className="w-16 h-16 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500">No FAQs found.</p>
            </div>
          )}

          {/* CTA */}
          <div className="mt-16 bg-brand-darker border border-gray-800 rounded-sm p-8 text-center">
            <h3 className="text-xl font-display font-bold text-white uppercase tracking-wide mb-3">
              Still have questions?
            </h3>
            <p className="text-gray-400 mb-6">
              Can't find the answer you're looking for? Reach out to our team.
            </p>
            <a
              href="/booking"
              className="inline-flex items-center gap-2 bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm"
            >
              Book a Consultation
            </a>
          </div>

        </div>
      </section>
    </div>
  );
}
