import { useState, useEffect } from 'react';
import {
  Star, CheckCircle2, XCircle, Trash2, Loader2,
  ThumbsUp, AlertCircle,
} from 'lucide-react';
import {
  fetchAllReviewsApi,
  approveReviewApi,
  rejectReviewApi,
  deleteReviewApi,
} from '../../services/api';
import type { BookingReview } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          className={`w-3.5 h-3.5 ${n <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-700'}`}
        />
      ))}
    </div>
  );
}

export default function ReviewsPanel() {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [reviews, setReviews] = useState<BookingReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState<'all' | 'pending' | 'approved'>('all');

  const load = () => {
    if (!token) return;
    setLoading(true);
    fetchAllReviewsApi(token)
      .then(r => setReviews(r.reviews))
      .catch(e => showToast((e as Error).message, 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [token]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleApprove = async (id: number) => {
    if (!token) return;
    await approveReviewApi(token, id);
    setReviews(prev => prev.map(r => r.id === id ? { ...r, isApproved: true } : r));
    showToast('Review approved.', 'success');
  };

  const handleReject = async (id: number) => {
    if (!token) return;
    await rejectReviewApi(token, id);
    setReviews(prev => prev.map(r => r.id === id ? { ...r, isApproved: false } : r));
    showToast('Review unpublished.', 'success');
  };

  const handleDelete = async (id: number) => {
    if (!token || !confirm('Delete this review permanently?')) return;
    await deleteReviewApi(token, id);
    setReviews(prev => prev.filter(r => r.id !== id));
    showToast('Review deleted.', 'success');
  };

  const filtered = reviews.filter(r => {
    if (filter === 'pending')  return !r.isApproved;
    if (filter === 'approved') return r.isApproved;
    return true;
  });

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '—';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wide">
          Customer Reviews
        </h2>
        <div className="flex items-center gap-3 bg-brand-dark border border-gray-800 rounded-sm px-4 py-2">
          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
          <span className="text-white font-bold text-lg">{avgRating}</span>
          <span className="text-gray-500 text-xs">/ 5 ({reviews.length} total)</span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(['all', 'pending', 'approved'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-sm border transition-colors ${
              filter === f
                ? 'bg-brand-orange border-brand-orange text-white'
                : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
            }`}
          >
            {f}
            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${filter === f ? 'bg-white/20' : 'bg-gray-800'}`}>
              {f === 'all' ? reviews.length : reviews.filter(r => f === 'approved' ? r.isApproved : !r.isApproved).length}
            </span>
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-brand-orange animate-spin" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="bg-brand-dark border border-gray-800 rounded-sm p-10 text-center text-gray-500">
          <ThumbsUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No reviews yet.</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(r => (
            <div
              key={r.id}
              className="bg-brand-dark border border-gray-800 rounded-sm p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-orange/20 flex items-center justify-center shrink-0">
                    <span className="text-brand-orange text-sm font-black uppercase">
                      {r.reviewerName[0]}
                    </span>
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{r.reviewerName}</p>
                    <p className="text-gray-500 text-xs">{r.serviceName} · {r.vehicleInfo}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {r.isApproved ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-green-400 bg-green-500/10 border border-green-500/30 px-2.5 py-1 rounded-sm">
                      <CheckCircle2 className="w-3 h-3" /> Published
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-2.5 py-1 rounded-sm">
                      <AlertCircle className="w-3 h-3" /> Pending
                    </span>
                  )}
                </div>
              </div>

              <div className="mb-2">
                <StarDisplay rating={r.rating} />
              </div>

              {r.review && (
                <p className="text-gray-300 text-sm leading-relaxed mb-3">{r.review}</p>
              )}

              <p className="text-gray-600 text-xs mb-4">
                {new Date(r.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>

              <div className="flex items-center gap-2 pt-3 border-t border-gray-800">
                {!r.isApproved && (
                  <button
                    onClick={() => handleApprove(r.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 text-xs font-bold uppercase rounded-sm transition-colors"
                  >
                    <CheckCircle2 className="w-3 h-3" /> Approve
                  </button>
                )}
                {r.isApproved && (
                  <button
                    onClick={() => handleReject(r.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20 text-xs font-bold uppercase rounded-sm transition-colors"
                  >
                    <XCircle className="w-3 h-3" /> Unpublish
                  </button>
                )}
                <button
                  onClick={() => handleDelete(r.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 text-xs font-bold uppercase rounded-sm transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
