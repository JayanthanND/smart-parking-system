import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Auth from './pages/Auth';
import OwnerPanel from './pages/OwnerPanel';
import OperationsQueue from './pages/OperationsQueue';
import CustomerPanel from './pages/CustomerPanel';
import './App.css';
import { LogOut, Zap, History as HistoryIcon, Bell, X, Phone } from 'lucide-react';
import { SnackbarProvider, useSnackbar } from './components/Snackbar';
import History from './pages/History';

// Error Boundary: Shows error details instead of a blank page
// Error Boundary has been moved to main.jsx for root-level protection.

const ProtectedRoute = ({ allowedRole }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-container">Loading session...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRole && user.role !== allowedRole) return <Navigate to="/" replace />;
  return <Outlet />;
};

const RootRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-container">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return user.role === 'OWNER' ? <Navigate to="/owner" replace /> : <Navigate to="/customer" replace />;
};

const Layout = () => {
  const { user, logout, authAxios } = useAuth();
  const { showSnackbar } = useSnackbar();

  const [notifications, setNotifications] = React.useState([]);
  const [showInbox, setShowInbox] = React.useState(false);

  const fetchNotifications = async () => {
    try {
      const { data } = await authAxios.get('/notifications');
      setNotifications(data);
    } catch(err) { console.error("Notif fetch failed", err); }
  };

  React.useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 10000);
      return () => clearInterval(interval);
    }
  }, [user]);

  const handleLogout = () => {
    logout();
    showSnackbar("Logged out successfully", "info");
  };

  const hasNew = notifications.length > 0;

  return (
    <div className="app-container">
      <header className="top-bar">
        <Link to="/" className="select-none" style={{ display: 'flex', flexDirection: 'column', gap: '2px', textDecoration: 'none', color: 'inherit' }}>
          <div className="d-flex align-center gap-2">
            <Zap size={32} color="#fbbf24" fill="#fbbf24" style={{ marginTop: '-2px' }} />
            <h1 style={{ fontSize: '2.4rem', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.02em' }}>
              <span style={{ color: 'white' }}>S</span>
              <span style={{ color: '#fbbf24' }}>parkit</span>
            </h1>
          </div>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '2px' }}>
            Smart Parking at Your Fingertips
          </p>
        </Link>
        {user && (
          <div className="top-bar-user">
            <div className="d-flex align-center gap-4 mr-6">
              {user.role === 'CUSTOMER' && (
                <Link to="/history" className="btn-icon" title="View History" style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '0.5rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center' }}>
                  <HistoryIcon size={20} color="var(--accent-primary)" />
                </Link>
              )}
              
              <div style={{ position: 'relative' }}>
                <button
                  className="btn-icon"
                  onClick={() => setShowInbox(!showInbox)}
                  style={{
                    position: 'relative',
                    background: showInbox ? 'rgba(255,255,255,0.05)' : 'transparent',
                    borderRadius: 'var(--radius-md)'
                  }}
                >
                  <Bell size={20} color={hasNew ? 'var(--status-yellow)' : 'var(--text-secondary)'} />
                  {hasNew && (
                    <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, background: '#ef4444', borderRadius: '50%', border: '2px solid var(--surface-color)' }} />
                  )}
                </button>

                {showInbox && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setShowInbox(false)} />
                    <div className="glass-panel" style={{
                      position: 'absolute', top: '120%', right: 0, width: 320, zIndex: 1000,
                      padding: '1.25rem', boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                      maxHeight: '400px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                      <div className="d-flex justify-between align-center mb-4">
                        <h4 style={{ margin: 0, fontSize: '0.9rem' }}>Live Notifications</h4>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{notifications.length} unread</span>
                      </div>

                      <div className="d-flex flex-column gap-3">
                        {notifications.length === 0 ? (
                          <div className="text-center py-6 text-secondary" style={{ fontSize: '0.85rem' }}>
                            No new alerts at the moment.
                          </div>
                        ) : (
                          notifications.map(n => (
                            <div key={n.id} style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(255,255,255,0.03)', fontSize: '0.8rem', borderLeft: '3px solid var(--accent-primary)' }}>
                              {n.message}
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '0.4rem' }}>
                                {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="d-flex flex-column text-right" style={{ lineHeight: 1.2 }}>
              <span>Welcome, <strong>{user.username}</strong> ({user.role})</span>
              {user.phone_no && (
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px', marginTop: '2px' }}>
                  <Phone size={10} /> {user.phone_no}
                </span>
              )}
            </div>
            <button className="btn-icon" onClick={handleLogout} title="Logout">
              <LogOut size={20} color="#ef4444" />
            </button>
          </div>
        )}
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <SnackbarProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/login" element={<Auth />} />

              <Route element={<ProtectedRoute allowedRole="OWNER" />}>
                <Route path="/owner" element={<OwnerPanel />} />
                <Route path="/owner/operations" element={<OperationsQueue />} />
              </Route>

              <Route element={<ProtectedRoute allowedRole="CUSTOMER" />}>
                <Route path="/customer" element={<CustomerPanel />} />
                <Route path="/history" element={<History />} />
                <Route path="/customer/history" element={<History />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </SnackbarProvider>
    </AuthProvider>
  );
}

export default App;
