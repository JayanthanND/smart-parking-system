import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const { login, register, user, loading } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ username: '', email: '', password: '', role: 'CUSTOMER', phone_no: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (user && !loading) {
      if (user.role === 'OWNER') navigate('/owner');
      else navigate('/customer');
    }
  }, [user, loading, navigate]);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        await login(form.username, form.password);
      } else {
        await register(form.username, form.email, form.password, form.role, form.phone_no);
        setIsLogin(true);
        setError('Registration successful! Please sign in.');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'An error occurred.');
    }
  };

  if (loading || user) return null;

  return (
    <div style={{ maxWidth: 450, margin: '4rem auto' }} className="glass-panel">
      <div style={{ padding: '2rem' }}>
        <h2 className="mb-4 text-center">{isLogin ? 'Sign In' : 'Create Account'}</h2>
        
        {error && <div className="mb-4 text-center text-success" style={{color: error.includes('success') ? 'var(--status-green)' : 'var(--status-red)'}}>{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input name="username" value={form.username} onChange={handleChange} className="form-input" required />
          </div>
          
          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Email</label>
              <input name="email" type="email" value={form.email} onChange={handleChange} className="form-input" required />
            </div>
          )}
          
          <div className="form-group">
            <label className="form-label">Password</label>
            <input name="password" type="password" value={form.password} onChange={handleChange} className="form-input" required />
          </div>

          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input name="phone_no" value={form.phone_no} onChange={handleChange} className="form-input" placeholder="e.g. +91 9876543210" required />
            </div>
          )}

          {!isLogin && (
            <div className="form-group">
              <label className="form-label">Role</label>
              <select name="role" value={form.role} onChange={handleChange} className="form-select">
                <option value="CUSTOMER">Customer</option>
                <option value="OWNER">Facility Owner</option>
              </select>
            </div>
          )}

          <button type="submit" className="btn-action w-full mt-4">
            {isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button className="btn-icon" onClick={() => { setIsLogin(!isLogin); setError(''); }} style={{fontSize: '0.85rem', color: 'var(--text-secondary)'}}>
            {isLogin ? "New here? Get started" : "Already have an account? Sign In"}
          </button>
        </div>
      </div>
    </div>
  );
}
