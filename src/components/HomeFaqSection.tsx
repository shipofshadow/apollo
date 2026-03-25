import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { ChevronDown, HelpCircle, ArrowRight, Loader2 } from 'lucide-react';
import { fetchFaqsAsync } from '../store/faqSlice';
import type { AppDispatch, RootState } from '../store';

/** Number of FAQs to show on the home page */
const HOME_FAQ_LIMIT = 5;

export default function HomeFaqSection() {
  const dispatch = useDispatch<AppDispatch>();
  const { items, status } = useSelector((s: RootState) => s.faq);

  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    if (status === 'idle') {
      dispatch(fetchFaqsAsync(null));
    }
  }, [dispatch, status]);

  if (status === 'loading' && items.length === 0) {
    return (
      <section className="py-24 bg-brand-dark">
        <div className="flex justify-center">
          <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
        </div>
      </section>
    );
  }

  if (items.length === 0) return null;

  const preview = items.slice(0, HOME_FAQ_LIMIT);

  return (
    <section className="py-24 bg-brand-dark relative overflow-hidden">
      {/* Subtle background accents */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-5%] left-[-5%] w-96 h-96 bg-brand-orange/5 rounded-full blur-3xl" />
        <div className="absolute bottom-[-5%] right-[-5%] w-96 h-96 bg-brand-orange/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 md:px-6 relative z-10">

        {/* Section header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <span className="text-brand-orange font-bold uppercase tracking-widest text-sm">
            Got Questions?
          </span>
          <h2 className="text-4xl md:text-5xl font-display font-black text-white uppercase tracking-tighter">
            Frequently Asked <span className="text-brand-orange">Questions</span>
          </h2>
          <div className="w-24 h-1 bg-brand-orange mx-auto mt-6" />
        </div>

        {/* Accordion */}
        <div className="max-w-3xl mx-auto space-y-3 mb-12">
          {preview.map(faq => (
            <div
              key={faq.id}
              className="bg-brand-darker border border-gray-800 rounded-sm overflow-hidden hover:border-gray-700 transition-colors"
            >
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

        {/* CTA */}
        <div className="text-center space-y-4">
          {items.length > HOME_FAQ_LIMIT && (
            <p className="text-gray-500 text-sm">
              Showing {HOME_FAQ_LIMIT} of {items.length} questions
            </p>
          )}
          <Link
            to="/faq"
            className="inline-flex items-center gap-2 bg-brand-orange text-white px-8 py-3 font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm"
          >
            <HelpCircle className="w-4 h-4" />
            View All FAQs
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

      </div>
    </section>
  );
}
