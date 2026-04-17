import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSnackbar } from '../components/Snackbar';
import ReviewModal from '../components/ReviewModal';
import {
  History as HistoryIcon,
  MapPin,
  Calendar,
  Clock,
  CreditCard,
  Star,
  Info,
  ChevronRight,
  Receipt,
  Download,
  Phone
} from 'lucide-react';

export default function History() {
  const { authAxios, user } = useAuth();
  const { showSnackbar } = useSnackbar();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [reviewBookingId, setReviewBookingId] = useState(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const { data } = await authAxios.get('/customer/history');
      setHistory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('History fetch error:', err?.response?.status, err?.response?.data);
      showSnackbar(`Failed to load history: ${err?.response?.data?.detail || err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const statusColors = {
    COMPLETED: 'badge-online',
    CANCELLED: 'badge-offline',
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch { return 'N/A'; }
  };

  const safeAmount = (val) => (typeof val === 'number' ? val.toFixed(2) : '0.00');

  if (loading) return <div className="app-container"><div className="glass-panel p-8 text-center">Analysing Records...</div></div>;

  return (
    <div className="app-container">
      <div className="dashboard-layout" style={{ gridTemplateColumns: selectedBooking ? '1.5fr 1fr' : '1fr' }}>
        {/* History List */}
        <section>
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h2 className="mb-8 d-flex align-center gap-3">
              <HistoryIcon size={28} className="text-secondary" />
              Booking & Invoice History
            </h2>

            {history.length === 0 ? (
              <div className="text-center p-12 text-secondary">
                <Info size={48} className="mb-4" style={{ margin: '0 auto' }} />
                <p>No historical records found. Start your journey today!</p>
              </div>
            ) : (
              <div className="grid-cards" style={{ gridTemplateColumns: '1fr' }}>
                {history.map(item => (
                  <div
                    key={item.id}
                    className={`glass-card p-4 d-flex align-center justify-between pointer-events-auto ${selectedBooking?.id === item.id ? 'active-history-card' : ''}`}
                    onClick={() => setSelectedBooking(item)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="d-flex align-center gap-4">
                      <div className="glass-panel p-3" style={{ borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }}>
                        <MapPin size={24} className={item.status === 'COMPLETED' ? 'text-success' : 'text-danger'} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{item.land_name}</div>
                        <div className="text-secondary" style={{ fontSize: '0.85rem' }}>{formatDate(item.reserved_at)}</div>
                      </div>
                    </div>

                    <div className="d-flex align-center gap-6">
                      <div className="text-right">
                        <div style={{ fontWeight: 700 }}>₹{safeAmount(item.total_amount)}</div>
                        <div className={`card-badge ${statusColors[item.status]}`} style={{ fontSize: '0.65rem' }}>
                          {item.status}
                        </div>
                      </div>
                      <ChevronRight size={20} className="text-secondary" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Detailed Information (Invoice) */}
        {selectedBooking && (
          <aside>
            <div className="glass-panel" style={{ padding: '2.5rem', position: 'sticky', top: '2rem' }}>
              <div className="text-center mb-8">
                <Receipt size={48} className="mb-4 text-secondary" style={{ margin: '0 auto' }} />
                <h3 className="mb-1">Invoice Detail</h3>
                <p className="text-secondary" style={{ fontSize: '0.8rem' }}>Ref: #SPT-{selectedBooking.id}-{new Date(selectedBooking.reserved_at).getFullYear()}</p>
              </div>

              <div className="d-flex flex-column gap-6 mb-8" style={{ fontSize: '0.9rem' }}>
                <div className="d-flex justify-between pb-4 border-bottom">
                  <span className="text-secondary">Vehicle</span>
                  <strong>{selectedBooking.vehicle_number || "Default Fleet"}</strong>
                </div>
                <div className="d-flex justify-between pb-4 border-bottom">
                  <span className="text-secondary">Arrived</span>
                  <span>{selectedBooking.checked_in_at ? formatDate(selectedBooking.checked_in_at) : "N/A"}</span>
                </div>
                <div className="d-flex justify-between pb-4 border-bottom">
                  <span className="text-secondary">Departed</span>
                  <span>{selectedBooking.checked_out_at ? formatDate(selectedBooking.checked_out_at) : "N/A"}</span>
                </div>
                <div className="d-flex justify-between pb-4 border-bottom">
                  <span className="text-secondary">Base Fee</span>
                  <span>₹{safeAmount((selectedBooking.total_amount || 0) - (selectedBooking.penalty_amount || 0))}</span>
                </div>
                {selectedBooking.penalty_amount > 0 && (
                  <div className="d-flex justify-between pb-4 border-bottom">
                    <span className="text-danger">Overstay Penalty</span>
                    <span className="text-danger">₹{safeAmount(selectedBooking.penalty_amount)}</span>
                  </div>
                )}
                <div className="d-flex justify-between pt-2" style={{ fontSize: '1.2rem' }}>
                  <strong>Total Amount</strong>
                  <strong className="text-success">₹{safeAmount(selectedBooking.total_amount)}</strong>
                </div>
                <div className="d-flex justify-between text-secondary" style={{ fontSize: '0.8rem' }}>
                  <span>Payment Mode</span>
                  <span>{selectedBooking.payment_method || "CASH"}</span>
                </div>
                {selectedBooking.owner_phone_no && (
                  <div className="d-flex justify-between align-center mt-4 p-3 glass-card" style={{ background: 'rgba(99, 102, 241, 0.05)' }}>
                    <div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Facility Contact</div>
                      <div style={{ fontWeight: 600 }}>{selectedBooking.owner_phone_no}</div>
                    </div>
                    <a href={`tel:${selectedBooking.owner_phone_no}`} className="btn-icon" style={{ background: 'var(--accent-primary)', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Phone size={16} color="white" />
                    </a>
                  </div>
                )}
              </div>

              {selectedBooking.rating ? (
                <div className="glass-card p-4 text-center mt-6">
                  <div className="d-flex justify-center gap-1 mb-2">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star key={star} size={18} fill={star <= selectedBooking.rating ? "#fbbf24" : "none"} color="#fbbf24" />
                    ))}
                  </div>
                  <p style={{ fontStyle: 'italic', fontSize: '0.85rem' }} className="text-secondary">"{selectedBooking.review}"</p>
                </div>
              ) : selectedBooking.status === 'COMPLETED' && (
                <div className="text-center mt-6">
                  <button className="btn-action w-full" onClick={() => setReviewBookingId(selectedBooking.id)}>
                    <Star size={18} /> Rate Experience
                  </button>
                </div>
              )}

              <button className="btn-secondary w-full mt-4 d-flex align-center justify-center gap-2" onClick={() => window.print()}>
                <Download size={18} /> Download Invoice
              </button>
            </div>
          </aside>
        )}
      </div>

      <style>{`
        .active-history-card {
           background: rgba(99, 102, 241, 0.15) !important;
           border-color: var(--accent-primary) !important;
        }
        .border-bottom { border-bottom: 1px solid var(--surface-border); }
      `}</style>
      {reviewBookingId && (
        <ReviewModal
          bookingId={reviewBookingId}
          onComplete={() => {
            fetchHistory();
            setReviewBookingId(null);
          }}
          onClose={() => setReviewBookingId(null)}
        />
      )}
    </div>
  );
}
