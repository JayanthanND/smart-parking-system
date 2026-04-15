import React, { useState } from 'react';
import { Star, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSnackbar } from './Snackbar';

export default function ReviewModal({ bookingId, onComplete, onClose }) {
  const { authAxios } = useAuth();
  const { showSnackbar } = useSnackbar();
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [submitting, setSubmitting] = useState(false);

  const submitReview = async () => {
    if (!bookingId) return;
    setSubmitting(true);
    try {
      showSnackbar("Saving your feedback...", "info");
      await authAxios.post(`/bookings/${bookingId}/review`, {
        rating: reviewForm.rating,
        review: reviewForm.comment
      });
      showSnackbar("Thank you for your feedback!", "success");
      onComplete();
      onClose();
    } catch (err) {
      console.error(err);
      showSnackbar(err.response?.data?.detail || "Review submission failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10001, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(2, 6, 23, 0.85)', backdropFilter: 'blur(8px)' }} onClick={onClose} />
      <div className="glass-panel" style={{ position: 'relative', width: '90%', maxWidth: 450, padding: '2.5rem' }}>
        <button style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={onClose} disabled={submitting}>
          <X size={24} />
        </button>
        <div className="text-center mb-8">
          <Star size={48} className="text-secondary mb-4" fill="#fbbf24" color="#fbbf24" style={{ margin: '0 auto' }} />
          <h2>Rate Your Experience</h2>
          <p className="text-secondary">Your feedback helps the community find better parking.</p>
        </div>

        <div className="d-flex justify-center gap-2 mb-8">
          {[1, 2, 3, 4, 5].map(star => (
            <button 
              key={star} 
              type="button"
              onClick={() => setReviewForm({ ...reviewForm, rating: star })} 
              style={{ background: 'none', border: 'none', cursor: 'pointer', outline: 'none' }}
              disabled={submitting}
            >
              <Star size={32} fill={star <= reviewForm.rating ? "#fbbf24" : "none"} color="#fbbf24" style={{ transition: '0.2s', transform: star <= reviewForm.rating ? 'scale(1.1)' : 'scale(1)' }} />
            </button>
          ))}
        </div>

        <textarea
          className="form-input mb-6"
          rows="4"
          placeholder="Write a quick comment (optional)..."
          style={{ width: '100%', resize: 'none' }}
          value={reviewForm.comment}
          onChange={e => setReviewForm({ ...reviewForm, comment: e.target.value })}
          disabled={submitting}
        />

        <button className="btn-action w-full" onClick={submitReview} disabled={submitting}>
          {submitting ? "Submitting..." : "Submit Feedback"}
        </button>
      </div>
    </div>
  );
}
