import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, CheckCircle, RefreshCw, ArrowLeft, Clock, Banknote, User as UserIcon, XCircle, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from '../components/Snackbar';

export default function OperationsQueue() {
  const { authAxios } = useAuth();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState([]);
  const [lands, setLands] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null); // { type: 'SINGLE' | 'GROUP', id, landName }
  const [selectedVehicle, setSelectedVehicle] = useState(null); // { model, number, customer_name, customer_phone_no }

  const fetchData = async () => {
    try {
      setLoading(true);
      const [lRes, bRes, nRes] = await Promise.all([
        authAxios.get('/owner/lands'),
        authAxios.get('/owner/bookings'),
        authAxios.get('/notifications')
      ]);
      setLands(lRes.data);
      setBookings(bRes.data);
      setNotifications(nRes.data);
    } catch (err) { console.error('Fetch error:', err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const { showSnackbar } = useSnackbar();

  const approveCheckIn = async (bookingId) => {
    try {
      await authAxios.post(`/owner/approve-check-in/${bookingId}`);
      showSnackbar("Vehicle Entry Authorized", "success");
      fetchData();
    } catch (err) { showSnackbar("Approval failed", "error"); }
  };

  const approveGroupCheckIn = async (groupId) => {
    try {
      const groupBookings = bookings.filter(b => b.group_id === groupId && (b.status === 'RESERVED' || b.status === 1));
      await Promise.all(groupBookings.map(b => authAxios.post(`/owner/approve-check-in/${b.id}`)));
      showSnackbar("Group Entry Authorized", "success");
      fetchData();
    } catch (err) { showSnackbar("Group Approval failed", "error"); }
  };

  const rejectReservation = async (bookingId) => {
    try {
      await authAxios.post(`/owner/reject-reservation/${bookingId}`);
      showSnackbar("Reservation Rejected", "warning");
      setConfirmDelete(null);
      fetchData();
    } catch (err) { showSnackbar("Rejection failed", "error"); }
  };

  const rejectGroupReservation = async (groupId) => {
    try {
      const groupBookings = bookings.filter(b => b.group_id === groupId && (b.status === 'RESERVED' || b.status === 1));
      await Promise.all(groupBookings.map(b => authAxios.post(`/owner/reject-reservation/${b.id}`)));
      showSnackbar("Group Reservation Rejected", "warning");
      setConfirmDelete(null);
      fetchData();
    } catch (err) { showSnackbar("Group Rejection failed", "error"); }
  };

  const confirmCash = async (bookingId) => {
    try {
      await authAxios.post(`/owner/confirm-payment/${bookingId}`);
      showSnackbar("Payment Confirmed", "success");
      fetchData();
    } catch (err) { showSnackbar("Confirmation failed", "error"); }
  };

  const confirmGroupCash = async (groupId) => {
    try {
      const groupBookings = bookings.filter(b => b.group_id === groupId && b.payment_method === 'CASH' && b.payment_status !== 'PAID');
      await Promise.all(groupBookings.map(b => authAxios.post(`/owner/confirm-payment/${b.id}`)));
      showSnackbar("Group Payments Confirmed", "success");
      fetchData();
    } catch (err) { showSnackbar("Group confirmation failed", "error"); }
  };

  const groupOps = (list) => {
    const groups = {};
    list.forEach(item => {
      const gid = item.group_id || `single-${item.id}`;
      if (!groups[gid]) groups[gid] = { id: gid, items: [], isGroup: !!item.group_id, total: 0, land_id: item.land_id, created_at: item.reserved_at };
      groups[gid].items.push(item);
      groups[gid].total += (item.total_amount || 0);
    });
    return Object.values(groups).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  };

  const checkinsList = groupOps(bookings.filter(b => b.status === 'RESERVED' || b.status === 1));
  const cashList = groupOps(bookings.filter(b => (b.status === 'ACTIVE' || b.status === 2 || b.status === 3) && b.payment_method === 'CASH' && b.payment_status !== 'PAID'));

  const formatETA = (etaStr) => {
    if (!etaStr) return null;
    try {
      return new Date(etaStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return null; }
  };

  if (loading && lands.length === 0) return <div className="app-container">Loading Operations...</div>;

  return (
    <div className="dashboard-layout" style={{ gridTemplateColumns: '1fr 350px', gap: '2rem' }}>
      {/* Actionable Queue */}
      <div className="main-content">
        <header className="d-flex justify-between align-center mb-6">
          <div className="d-flex align-center gap-4">
            <button className="btn-icon" onClick={() => navigate('/owner')}><ArrowLeft size={24} /></button>
            <h2 className="d-flex align-center gap-2">Live Operations Queue</h2>
          </div>
          <button className="btn-action btn-secondary" onClick={fetchData}><RefreshCw size={18} /> Sync Queue</button>
        </header>

        <section className="mb-8">
          <h3 className="mb-4 d-flex align-center gap-2" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}><Clock size={16} /> Pending Arrivals ({checkinsList.length})</h3>
          <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {checkinsList.map(group => (
              <div key={group.id} className="card-item glass-card" style={{ borderLeft: group.isGroup ? '4px solid var(--accent-primary)' : '4px solid var(--status-yellow)' }}>
                <div className="card-header">
                  <div>
                    <h3 className="card-title">{group.isGroup ? 'Group Arrival' : 'Single Arrival'}</h3>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {lands.find(l => l.id === group.land_id)?.name || `Land #${group.land_id}`}
                    </div>
                    {group.isGroup && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontWeight: 600 }}>
                        <Phone size={12} /> {group.items[0]?.customer_phone_no || "N/A"}
                      </div>
                    )}
                  </div>
                  <span className="card-badge badge-active">#{group.id.slice(-4)}</span>
                </div>
                <div className="card-body">
                  <div className="mb-2" style={{ fontSize: '0.9rem' }}>
                    <strong>{group.items.length} Vehicles:</strong>
                    <div className="mt-1 d-flex flex-column gap-1">
                      {group.items.map(i => (
                        <div
                          key={i.id}
                          style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', paddingBottom: '4px', cursor: 'pointer' }}
                          onClick={() => setSelectedVehicle({
                            model: i.vehicle_model || "Generic Vehicle",
                            number: i.vehicle_number || "N/A",
                            customer_name: i.customer_name,
                            customer_phone_no: i.customer_phone_no
                          })}
                          className="hover-card"
                        >
                          <div className="d-flex justify-between align-center" style={{ padding: '0.4rem', borderRadius: '4px', background: 'rgba(255,255,255,0.03)', overflow: 'hidden' }}>
                            <div className="d-flex flex-column" style={{ overflow: 'hidden', flex: 1 }}>
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><strong>{i.vehicle_number || 'No Plate'}</strong> {i.vehicle_model}</span>
                              {!group.isGroup && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                  <Phone size={10} /> {i.customer_phone_no || "N/A"}
                                </span>
                              )}
                            </div>
                            {i.estimated_arrival_at && (
                              <span style={{ color: '#fbbf24', background: 'rgba(251, 191, 36, 0.1)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                ETA {formatETA(i.estimated_arrival_at)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="card-footer d-flex gap-2 flex-wrap">
                  <button className="btn-action w-full" style={{ minWidth: '120px', flex: 1 }} onClick={() => group.isGroup ? approveGroupCheckIn(group.id) : approveCheckIn(group.items[0].id)}>
                    Allow Entry
                  </button>
                  <button className="btn-action btn-secondary" style={{ color: 'var(--status-red)', borderColor: 'rgba(239, 68, 68, 0.3)', width: 'auto' }} onClick={() => setConfirmDelete({ type: group.isGroup ? 'GROUP' : 'SINGLE', id: group.id, count: group.items.length })} title="Reject Reservation">
                    <XCircle size={18} />
                  </button>
                </div>
              </div>
            ))}
            {checkinsList.length === 0 && <div className="glass-panel w-full text-center py-8">No pending arrivals at the moment.</div>}
          </div>
        </section>

        <section>
          <h3 className="mb-4 d-flex align-center gap-2" style={{ color: 'var(--status-green)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '1px' }}><Banknote size={20} /> Pending Cash Collections ({cashList.length})</h3>
          <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {cashList.map(group => (
              <div key={group.id} className="card-item glass-card" style={{ borderLeft: group.isGroup ? '6px solid #10b981' : '4px solid var(--status-green)' }}>
                <div className="card-header">
                  <div>
                    <h3 className="card-title">{group.isGroup ? 'Group Collection' : 'Single Collection'}</h3>
                    <div style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--status-green)', margin: '0.5rem 0' }}>₹{group.total.toFixed(2)}</div>
                  </div>
                </div>
                <div className="card-body">
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <div className="mb-2"><strong>Customer:</strong> {group.items[0]?.customer_name || "N/A"}</div>
                    <div className="d-flex align-center gap-2 mb-2" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                      <Phone size={14} /> {group.items[0]?.customer_phone_no || "N/A"}
                    </div>
                    Ensuring payment for {group.items.length} spots at facility.
                  </div>
                </div>
                <div className="card-footer">
                  <button className="btn-action w-full" onClick={() => group.isGroup ? confirmGroupCash(group.id) : confirmCash(group.items[0].id)}>
                    Confirm Receipt
                  </button>
                </div>
              </div>
            ))}
            {cashList.length === 0 && <div className="glass-panel w-full text-center py-8">All payments are up to date!</div>}
          </div>
        </section>
      </div>

      {/* Activity Feed Sidebar */}
      <aside className="side-panel glass-panel">
        <h3 className="mb-6 d-flex align-center gap-2"><UserIcon size={20} /> System Activity</h3>
        <div className="timeline-feed">
          {notifications.map(n => (
            <div key={n.id} className="timeline-item">
              <div className="timeline-dot" style={{ borderColor: 'var(--status-yellow)' }}></div>
              <div className="timeline-time">{new Date(n.created_at).toLocaleTimeString()}</div>
              <div className="timeline-content" style={{ fontSize: '0.85rem' }}>{n.message}</div>
            </div>
          ))}
          {notifications.length === 0 && <div className="text-center text-muted py-4">No recent activity.</div>}
        </div>
      </aside>

      {/* Vehicle Detail Modal */}
      {selectedVehicle && (
        <div className="modal-overlay" style={{ zIndex: 10001 }} onClick={() => setSelectedVehicle(null)}>
          <div className="glass-panel modal-content" style={{ maxWidth: 450, padding: 0, overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: '2rem', borderBottom: '1px solid var(--surface-border)', position: 'relative', background: 'rgba(255,255,255,0.02)' }}>
              <button className="btn-icon" style={{ position: 'absolute', top: 15, right: 15 }} onClick={() => setSelectedVehicle(null)}>
                <XCircle size={20} color="var(--text-secondary)" />
              </button>
              <div className="d-flex align-center gap-3">
                <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', background: 'rgba(99, 102, 241, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UserIcon size={24} color="var(--accent-primary)" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.5rem', marginBottom: '0.2rem' }}>{selectedVehicle.model}</h2>
                  <div style={{ display: 'inline-block', background: 'rgba(251, 191, 36, 0.1)', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.9rem', fontWeight: 900, color: '#fbbf24', letterSpacing: '1px' }}>
                    {selectedVehicle.number}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ padding: '2rem' }}>
              <div className="mb-6">
                <label className="metric-label" style={{ marginBottom: '0.5rem', display: 'block' }}>Customer Contact Info</label>
                <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.2rem' }}>{selectedVehicle.customer_name || "Anonymous User"}</div>
                  <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Phone size={14} /> {selectedVehicle.customer_phone_no || "No phone provided"}
                  </div>
                </div>
              </div>

              <div className="d-flex gap-3">
                {selectedVehicle.customer_phone_no && (
                  <a href={`tel:${selectedVehicle.customer_phone_no}`} className="btn-action w-full text-center d-flex align-center justify-center gap-2" style={{ textDecoration: 'none' }}>
                    <Phone size={18} /> Call Customer
                  </a>
                )}
                <button className="btn-action btn-secondary w-full" onClick={() => setSelectedVehicle(null)}>Dismiss</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Premium Confirm Modal */}
      {confirmDelete && (
        <div className="modal-overlay" style={{ zIndex: 10000 }}>
          <div className="glass-panel modal-content" style={{ maxWidth: 400, textAlign: 'center' }}>
            <div className="d-flex justify-center mb-6">
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '50%' }}>
                <XCircle size={48} color="var(--status-red)" />
              </div>
            </div>
            <h2>Confirm Rejection</h2>
            <p className="text-secondary mt-2 mb-8">
              Are you sure you want to reject this {confirmDelete.type === 'GROUP' ? `group reservation of ${confirmDelete.count} vehicles` : 'reservation'}?
              The user will be notified and the slot will be released.
            </p>
            <div className="d-flex gap-4">
              <button className="btn-action btn-secondary w-full" onClick={() => setConfirmDelete(null)}>Take Me Back</button>
              <button className="btn-action w-full" style={{ background: 'var(--status-red)', borderColor: 'var(--status-red)' }} onClick={() => confirmDelete.type === 'GROUP' ? rejectGroupReservation(confirmDelete.id) : rejectReservation(confirmDelete.id)}>Confirm Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
