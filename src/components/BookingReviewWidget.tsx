import { useState, useEffect } from 'react';
import { Star, Send, CheckCircle2, Loader2, Edit3 } from 'lucide-react';
import {
  getBookingReviewApi,
  submitBookingReviewApi,
} from '../services/api';
import type { BookingReview } from '../types';

interface Props {
  bookingId: string;
  token: string;
}

function StarRating({
  value,
  onChange,
  readonly = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
}) {
  const [hovered, setHovered] = useState(0);
  const display = hovered || value;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(n)}
          onMouseEnter={() => !readonly && setHovered(n)}
          onMouseLeave={() => !readonly && setHovered(0)}
          className={`transition-colors ${readonly ? 'cursor-default' : 'cursor-pointer'}`}
        >
          <Star
            className={`w-6 h-6 transition-colors ${
              n <= display ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function BookingReviewWidget({ bookingId, token }: Props) {
  const [existing, setExisting]   = useState<BookingReview | null | undefined>(undefined);
  const [rating,   setRating]     = useState(5);
  const [text,     setText]       = useState('');
  const [editing,  setEditing]    = useState(false);
  const [saving,   setSaving]     = useState(false);
  const [err,      setErr]        = useState<string | null>(null);
  const [success,  setSuccess]    = useState(false);

  useEffect(() => {
    getBookingReviewApi(token, bookingId)
      .then(r => {
        setExisting(r.review ?? null);
        if (r.review) {
          setRating(r.review.rating);
          setText(r.review.review ?? '');
        }
      })
      .catch(() => setExisting(null));
  }, [bookingId, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1) { setErr('Please select a star rating.'); return; }
    setSaving(true);
    setErr(null);
    try {
      const r = await submitBookingReviewApi(token, bookingId, { rating, review: text });
      setExisting(r.review);
      setEditing(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (existing === undefined) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 text-brand-orange animate-spin" />
      </div>
    );
  }

  // Show existing (non-editing)
  if (existing && !editing) {
    return (
      <div className="bg-brand-dark border border-gray-800 rounded-sm p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-widest">Your Review</h3>
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-orange transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" /> Edit
          </button>
        </div>
        <StarRating value={existing.rating} readonly />
        {existing.review && (
          <p className="text-gray-300 text-sm leading-relaxed">{existing.review}</p>
        )}
        <div className="flex items-center gap-2">
          {existing.isApproved ? (
            <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-green-400">
              <CheckCircle2 className="w-3 h-3" /> Published
            </span>
          ) : (
            <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-400">
              Pending Approval
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-brand-dark border border-gray-800 rounded-sm p-5">
      <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4">
        {existing ? 'Edit Your Review' : 'Leave a Review'}
      </h3>
      {success && (
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 text-green-400 text-sm px-3 py-2 rounded-sm mb-4">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Review submitted! It will appear once approved.
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Rating</p>
          <StarRating value={rating} onChange={setRating} />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
            Comment <span className="text-gray-700 normal-case font-normal">(optional)</span>
          </p>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Tell us about your experience…"
            className="w-full bg-brand-darker border border-gray-700 text-white text-sm px-3 py-2.5 rounded-sm focus:outline-none focus:border-brand-orange resize-none placeholder-gray-600 transition-colors"
          />
        </div>
        {err && <p className="text-red-400 text-xs">{err}</p>}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving || rating === 0}
            className="flex items-center gap-2 bg-brand-orange text-white px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:bg-orange-600 transition-colors rounded-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Submit Review
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => { setEditing(false); setRating(existing!.rating); setText(existing!.review ?? ''); }}
              className="text-xs text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
