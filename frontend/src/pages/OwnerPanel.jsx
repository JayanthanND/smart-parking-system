import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Building2, Plus, RefreshCw, Layers, CheckCircle, ShieldCheck, MapPin, Activity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Polygon, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

// Helper component to plot 4 boundary points
const MapPlotter = ({ onBoundariesComplete }) => {
  const [points, setPoints] = useState([]);
  
  useMapEvents({
    click(e) {
      if (points.length < 4) {
        const newPoints = [...points, { lat: e.latlng.lat, lng: e.latlng.lng }];
        setPoints(newPoints);
        if (newPoints.length === 4) {
          // Calculate centroid
          const latCenter = newPoints.reduce((acc, p) => acc + p.lat, 0) / 4;
          const lngCenter = newPoints.reduce((acc, p) => acc + p.lng, 0) / 4;
          onBoundariesComplete(newPoints, latCenter, lngCenter);
        }
      }
    }
  });

  return (
    <>
      {points.map((p, idx) => <Marker key={idx} position={[p.lat, p.lng]} />)}
      {points.length === 4 && <Polygon positions={points.map(p => [p.lat, p.lng])} color="#6366f1" />}
    </>
  );
};

export default function OwnerPanel() {
  const { authAxios, user } = useAuth();
  const navigate = useNavigate();
  
  const [lands, setLands] = useState([]);
  const [bookings, setBookings] = useState([]);
  
  const [isAdding, setIsAdding] = useState(false);
  const [landForm, setLandForm] = useState({
    name: '', address: '', latitude: null, longitude: null,
    total_slots: 10, vehicle_types: ['Car', 'Bike'], price_per_hour: 40, penalty_per_hour: 100, grace_minutes: 15,
    boundaries: null
  });

  const fetchData = async () => {
    try {
      const [lRes, bRes] = await Promise.all([
        authAxios.get('/owner/lands'),
        authAxios.get('/owner/bookings')
      ]);
      setLands(lRes.data);
      setBookings(bRes.data);
    } catch(err) { console.error('Fetch error:', err); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleBoundaries = (bnd, lat, lng) => {
    setLandForm({...landForm, boundaries: bnd, latitude: lat, longitude: lng});
  };

  const clearMap = () => {
    setLandForm({...landForm, boundaries: null, latitude: null, longitude: null});
  };

  const handleAddLand = async (e) => {
    e.preventDefault();
    if (!landForm.boundaries) return alert("Please plot the 4 boundary points on the map first.");
    try {
      await authAxios.post('/owner/lands', { 
        ...landForm, 
        vehicle_types: typeof landForm.vehicle_types === 'string' ? landForm.vehicle_types.split(',') : landForm.vehicle_types 
      });
      setIsAdding(false);
      fetchData();
    } catch(err) { alert('Error adding facility'); }
  };

  const toggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'ONLINE' ? 'OFFLINE' : 'ONLINE';
    try {
      await authAxios.patch(`/owner/lands/${id}/status?status=${newStatus}`);
      fetchData();
    } catch(err) { alert('Status Update Failed'); }
  };

  const getMetrics = () => {
    const totalCap = lands.reduce((acc, l) => acc + l.total_slots, 0);
    const available = lands.reduce((acc, l) => acc + l.available_slots, 0);
    const occupied = totalCap - available;
    const occPct = totalCap ? ((occupied / totalCap) * 100) : 0;
    const availPct = totalCap ? ((available / totalCap) * 100) : 0;
    const revenue = bookings.filter(b => b.status === "COMPLETED" || b.status === 4).reduce((acc, b) => acc + (b.total_amount || 0), 0);
    return { totalCap, available, occupied, occPct, availPct, revenue };
  };

  const metrics = getMetrics();
  
  return (
    <div className="dashboard-layout" style={{display: 'block'}}>
      <div style={{maxWidth: '1200px', margin: '0 auto'}}>
        <div className="summary-section glass-panel">
          <div className="d-flex justify-between align-center">
            <div>
              <div className="metric-label">System Revenue (Today)</div>
              <h2 className="metric-large" style={{color: 'var(--status-green)'}}>₹{metrics.revenue.toFixed(2)}</h2>
            </div>
            <div className="text-right">
              <div className="metric-label">Total Occupation</div>
              <div style={{fontSize: '2rem', fontWeight: 700}}>{metrics.occupied} / {metrics.totalCap} Slots</div>
            </div>
          </div>
          
          <div className="progress-bar-container">
            <div className="progress-segment green" style={{width: `${metrics.availPct}%`}} title="Available"></div>
            <div className="progress-segment yellow" style={{width: `${metrics.occPct}%`}} title="Occupied"></div>
          </div>
          <div className="d-flex justify-between" style={{fontSize: '0.8rem', marginTop: '0.5rem', color: 'var(--text-secondary)'}}>
            <span>Available ({metrics.availPct.toFixed(0)}%)</span>
            <span>Occupied ({metrics.occPct.toFixed(0)}%)</span>
          </div>
          
          <div className="summary-actions">
            <button className="btn-action" onClick={() => navigate('/owner/operations')} style={{background: 'var(--accent-primary)', color: '#fff'}}><Activity size={18}/> Access Operations Hub</button>
            <button className="btn-action btn-secondary" onClick={() => setIsAdding(true)}><Plus size={18}/> Register New Facility</button>
            <button className="btn-action btn-secondary" onClick={fetchData}><RefreshCw size={18} /> Sync Dashboard</button>
          </div>
        </div>

        {isAdding && (
          <div className="modal-overlay">
            <div className="modal-content glass-panel" style={{maxWidth: 700, maxHeight: '90vh', overflowY: 'auto'}}>
              <div className="modal-header">
                <h2>Plot Parking Facility</h2>
                <button className="btn-icon" onClick={() => setIsAdding(false)}>X</button>
              </div>
              <form onSubmit={handleAddLand}>
                <div className="d-flex gap-4 mb-4">
                  <div className="w-full">
                    <label className="form-label">Name</label>
                    <input className="form-input" required value={landForm.name} onChange={e=>setLandForm({...landForm, name: e.target.value})} />
                  </div>
                  <div className="w-full">
                    <label className="form-label">Address</label>
                    <input className="form-input" required value={landForm.address} onChange={e=>setLandForm({...landForm, address: e.target.value})} />
                  </div>
                </div>

                <div className="mb-4">
                  <label className="form-label">Location Plotting (Click 4 points to define boundaries)</label>
                  <div style={{height: 250, borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--surface-border)', position: 'relative'}}>
                    <MapContainer center={[12.9716, 77.5946]} zoom={13} style={{ height: '100%', width: '100%', cursor: 'crosshair' }} key={landForm.boundaries ? 'mapped' : 'unmapped'}>
                      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
                      {!landForm.boundaries && <MapPlotter onBoundariesComplete={handleBoundaries} />}
                      {landForm.boundaries && (
                        <>
                          {landForm.boundaries.map((p, idx) => <Marker key={idx} position={[p.lat, p.lng]} />)}
                          <Polygon positions={landForm.boundaries.map(p => [p.lat, p.lng])} color="#10b981" />
                        </>
                      )}
                    </MapContainer>
                    {landForm.boundaries && (
                       <button type="button" className="btn-action btn-secondary" style={{position: 'absolute', top: 10, right: 10, zIndex: 1000, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)'}} onClick={clearMap}>Reset Map</button>
                    )}
                  </div>
                </div>

                <div className="d-flex gap-4">
                  <div className="form-group w-full"><label className="form-label">Total Slots</label><input type="number" className="form-input" required value={landForm.total_slots} onChange={e=>setLandForm({...landForm, total_slots: parseInt(e.target.value)})} /></div>
                  <div className="form-group w-full"><label className="form-label">Base ₹/Hr</label><input type="number" className="form-input" required value={landForm.price_per_hour} onChange={e=>setLandForm({...landForm, price_per_hour: parseFloat(e.target.value)})} /></div>
                  <div className="form-group w-full"><label className="form-label">Grace (min)</label><input type="number" className="form-input" required value={landForm.grace_minutes} onChange={e=>setLandForm({...landForm, grace_minutes: parseInt(e.target.value)})} /></div>
                </div>
                
                <button type="submit" className="btn-action w-full mt-4" disabled={!landForm.boundaries}>Deploy Facility</button>
              </form>
            </div>
          </div>
        )}

        <h3 className="mb-4 d-flex align-center gap-2"><Layers size={20} /> Facility Network</h3>
        <div className="grid-cards">
          {lands.map(land => (
            <div key={land.id} className="card-item glass-card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">{land.name}</h3>
                  <div style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}><MapPin size={12}/> {land.address}</div>
                </div>
                <span className={`card-badge ${land.status === 'ONLINE' ? 'badge-online' : 'badge-offline'}`}>{land.status}</span>
              </div>
              
              <div className="card-body">
                <div className="mt-4 mb-4" style={{fontSize: '2rem', fontWeight: 800, textAlign: 'center'}}>
                  <span style={{color: land.available_slots === 0 ? 'var(--status-red)' : 'var(--text-primary)'}}>{land.available_slots}</span> <span style={{fontSize: '1rem', color:'var(--text-secondary)'}}>/ {land.total_slots}</span>
                </div>
              </div>

              <div className="card-footer">
                <div className="card-stat">₹{land.price_per_hour}/hr</div>
                <button className={`btn-action ${land.status==='ONLINE' ? 'btn-secondary' : ''}`} style={{padding: '0.4rem 1rem'}} onClick={() => toggleStatus(land.id, land.status)}>
                  {land.status === 'ONLINE' ? 'Take Offline' : 'Go Online'}
                </button>
              </div>
            </div>
          ))}
        </div>

        <h3 className="mb-4 mt-4 d-flex align-center gap-2"><Layers size={20} /> Complete Booking History</h3>
        <div className="glass-panel" style={{marginBottom: '2rem', overflowX: 'auto'}}>
          <table style={{width: '100%', textAlign: 'left', borderCollapse: 'collapse'}}>
            <thead>
              <tr style={{borderBottom: '1px solid var(--surface-border)'}}>
                <th style={{padding: '0.75rem'}}>ID</th>
                <th style={{padding: '0.75rem'}}>Land ID</th>
                <th style={{padding: '0.75rem'}}>Vehicle</th>
                <th style={{padding: '0.75rem'}}>Status</th>
                <th style={{padding: '0.75rem'}}>Total Amt</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => {
                let statusLabel = typeof b.status === 'number' ? (b.status===4?'COMPLETED':b.status===3?'CANCELLED':b.status===2?'ACTIVE':b.status===1?'RESERVED':b.status) : b.status;
                return (
                  <tr key={b.id} style={{borderBottom: '1px solid var(--surface-border)'}}>
                    <td style={{padding: '0.75rem'}}>#{b.id}</td>
                    <td style={{padding: '0.75rem'}}>{b.land_id}</td>
                    <td style={{padding: '0.75rem'}}>{b.vehicle_id}</td>
                    <td style={{padding: '0.75rem'}}>{statusLabel}</td>
                    <td style={{padding: '0.75rem'}}>₹{b.total_amount?.toFixed(2)||'0.00'}</td>
                  </tr>
                );
              })}
              {bookings.length === 0 && <tr><td colSpan="5" style={{padding: '1rem', textAlign: 'center'}}>No bookings found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
