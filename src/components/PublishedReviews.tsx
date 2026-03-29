import { useEffect, useState } from 'react';
import { Star, MessageSquare, Loader2 } from 'lucide-react';
import { fetchPublishedReviewsApi } from '../services/api';
import type { BookingReview } from '../types';

interface Props {
  serviceId?: number;
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          className={`w-4 h-4 ${n <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-700'}`}
        />
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: BookingReview }) {
  const date = new Date(review.createdAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="bg-brand-dark border border-white/[0.07] rounded-sm p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-brand-orange/20 border border-brand-orange/30 flex items-center justify-center shrink-0">
            <span className="text-brand-orange font-black text-sm uppercase">
              {review.reviewerName?.[0] ?? '?'}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm truncate">{review.reviewerName}</p>
            {review.vehicleInfo && (
              <p className="text-gray-600 text-[11px] truncate">{review.vehicleInfo}</p>
            )}
          </div>
        </div>
        <span className="text-gray-600 text-[11px] shrink-0">{date}</span>
      </div>

      <StarDisplay rating={review.rating} />

      {review.review && (
        <p className="text-gray-300 text-sm leading-relaxed">{review.review}</p>
      )}
    </div>
  );
}

export default function PublishedReviews({ serviceId }: Props) {
  const [reviews, setReviews] = useState<BookingReview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchPublishedReviewsApi(serviceId)
      .then(r => setReviews(r.reviews ?? []))
      .catch(() => setReviews([]))
      .finally(() => setLoading(false));
  }, [serviceId]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 text-brand-orange animate-spin" />
      </div>
    );
  }

  if (reviews.length === 0) return null;

  const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  return (
    <section className="container mx-auto px-4 md:px-8 py-14">
      {/* Section header */}
      <div className="flex items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="block w-5 h-px bg-brand-orange" />
            <span className="text-brand-orange font-bold uppercase tracking-[0.18em] text-[0.65rem]">
              Customer Reviews
            </span>
          </div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-display font-black text-white uppercase tracking-tight">
              What Clients Say
            </h2>
            <div className="flex items-center gap-1.5 bg-brand-orange/10 border border-brand-orange/20 rounded-sm px-3 py-1">
              <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
              <span className="text-brand-orange font-black text-sm">{avg.toFixed(1)}</span>
              <span className="text-gray-500 text-xs">({reviews.length})</span>
            </div>
          </div>
        </div>
        <div className="flex-1 h-px bg-white/[0.07] hidden sm:block" />
        <MessageSquare className="w-5 h-5 text-gray-700 hidden sm:block" />
      </div>

      {/* Reviews grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reviews.map(review => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>
    </section>
  );
}
