import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Auth from './pages/Auth';
import OwnerPanel from './pages/OwnerPanel';
import OperationsQueue from './pages/OperationsQueue';
import CustomerPanel from './pages/CustomerPanel';
import './App.css';
import { LogOut, ParkingCircle } from 'lucide-react';

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
  const { user, logout } = useAuth();
  return (
    <div className="app-container">
      <header className="top-bar">
        <h1 className="select-none d-flex align-center gap-3">
          <ParkingCircle size={32} color="var(--accent-primary)" />
          <span>Smart Parking OS</span>
        </h1>
        {user && (
          <div className="top-bar-user">
            <span>Welcome, <strong>{user.username}</strong> ({user.role})</span>
            <button className="btn-icon" onClick={logout} title="Logout">
              <LogOut size={20} />
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
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
