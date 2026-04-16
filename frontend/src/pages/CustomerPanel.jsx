import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Activity, MapPin, Search, CheckCircle, Navigation, Key, Crosshair, Map as MapIcon, SlidersHorizontal, ArrowUp, ArrowUpRight, ArrowUpLeft, ArrowLeft, ArrowRight, CornerUpLeft, CornerUpRight, RotateCcw, Flag, Maximize, Minimize, Star, X, ShieldCheck, Trash2, Clock } from 'lucide-react';
import { useSnackbar } from '../components/Snackbar';
import ReviewModal from '../components/ReviewModal';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import RoutingMachine from '../components/RoutingMachine';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const userIcon = new L.divIcon({
  className: 'custom-div-icon',
  html: '<div style="background-color: #4285F4; width: 16px; height: 16px; display: block; position: relative; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>',
  iconSize: [22, 22],
  iconAnchor: [11, 11]
});

const redPinSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ef4444" stroke="#7f1d1d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3" fill="#fff"/></svg>`;

const parkingIcon = new L.divIcon({
  className: 'custom-parking-icon',
  html: `<div style="width: 36px; height: 36px; filter: drop-shadow(0px 4px 3px rgba(0,0,0,0.3));">${redPinSVG}</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36]
});

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const p = 0.017453292519943295;
  const c = Math.cos;
  const a = 0.5 - c((lat2 - lat1) * p) / 2 + c(lat1 * p) * c(lat2 * p) * (1 - c((lon2 - lon1) * p)) / 2;
  return 12742 * Math.asin(Math.sqrt(a));
};

const MapPanner = ({ center, isNavigating }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      if (isNavigating) {
        // During navigation, use smooth pan and keep a tighter zoom
        map.panTo(center, { animate: true, duration: 1.0 });
        if (map.getZoom() < 16) map.setZoom(16);
      } else {
        map.flyTo(center, map.getZoom());
      }
    }
  }, [center, map, isNavigating]);
  return null;
};

export default function CustomerPanel() {
  const { authAxios, user } = useAuth();

  const [vehicles, setVehicles] = useState([]);
  const [searchRes, setSearchRes] = useState([]);
  const [searching, setSearching] = useState(false);
  const [hasLocation, setHasLocation] = useState(false);

  // Geolocation & Swiggy-like exact filters
  const [userLoc, setUserLoc] = useState([12.9716, 77.5946]);
  const [filterForm, setFilterForm] = useState({ radius: 5, vehicle_type: '', max_price: '', intended_duration: 1.0 });
  const [selectedVehicleIds, setSelectedVehicleIds] = useState([]); // Multiple selection
  const [newVehicle, setNewVehicle] = useState({ vehicle_number: '', vehicle_type: 'Car' });

  const [activeBookings, setActiveBookings] = useState([]);
  const [navigatingTo, setNavigatingTo] = useState(null); // { lat, lng, name }
  const [watchId, setWatchId] = useState(null);
  const [routeData, setRouteData] = useState(null); // { instructions, coordinates, summary }
  const [currentInstructionIndex, setCurrentInstructionIndex] = useState(0);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [shouldGroup, setShouldGroup] = useState(true); // New: Optional grouping preference
  const [reviewBookingId, setReviewBookingId] = useState(null); // ID of booking to review
  const [isVerifying, setIsVerifying] = useState({}); // Tracking which booking is pending verification

  const [selectedLand, setSelectedLand] = useState(null);
  const [landReviews, setLandReviews] = useState([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [isVerifyingVahan, setIsVerifyingVahan] = useState(false);
  const [recentStays, setRecentStays] = useState([]);
  const [sortBy, setSortBy] = useState('distance'); // 'distance' | 'rating' | 'price'
  const [eta, setEta] = useState(null); // Calculated arrival time

  const { showSnackbar } = useSnackbar();

  // Initial Load Persistence
  useEffect(() => {
    fetchVehicles();
    fetchActiveBookings();
    fetchRecentStays();
    locateUser();
  }, []);

  const fetchRecentStays = async () => {
    try {
      const { data } = await authAxios.get('/customer/history');
      setRecentStays(data.slice(0, 3)); // Only show last 3 in sidebar
    } catch (err) { console.error("History fetch failed", err); }
  };

  const fetchLandReviews = async (landId) => {
    setLoadingReviews(true);
    try {
      const { data } = await authAxios.get(`/lands/${landId}/reviews`);
      setLandReviews(data);
    } catch (err) {
      console.error("Failed to fetch reviews", err);
    } finally {
      setLoadingReviews(false);
    }
  };

  const openDetails = (land) => {
    setSelectedLand(land);
    fetchLandReviews(land.id);
  };

  // Session Restoration Logic: Restore navigation mission if it exists in DB
  useEffect(() => {
    if (user && user.active_nav_land_id && !navigatingTo) {
      // Find the booking/facility corresponding to the saved ID
      const restoreDest = async () => {
        try {
          const { data } = await authAxios.get('/customer/bookings');
          const activeTarget = data.find(b => b.land_id === user.active_nav_land_id);
          if (activeTarget) {
            setNavigatingTo({
              lat: activeTarget.latitude,
              lng: activeTarget.longitude,
              name: activeTarget.land_name
            });
            setIsMapFullscreen(user.is_nav_fullscreen);
            // Start tracking automatically
            const id = navigator.geolocation.watchPosition(
              (pos) => setUserLoc([pos.coords.latitude, pos.coords.longitude]),
              (err) => console.error(err),
              { enableHighAccuracy: true }
            );
            setWatchId(id);
          }
        } catch (err) { console.error("Session restoration failed", err); }
      };
      restoreDest();
    }
  }, [user]);

  const syncNavState = async (landId, isFullscreen) => {
    try {
      await authAxios.post('/customer/navigation-state', {
        active_nav_land_id: landId,
        is_nav_fullscreen: isFullscreen
      });
    } catch (err) { console.error("Navigation sync failed", err); }
  };

  const locateUser = () => {
    if (!navigator.geolocation) {
      alert("Your browser does not support Geolocation. Live navigation will not work.");
      return;
    }

    // Check if we are in a secure context (HTTPS/localhost), otherwise Geolocation is blocked
    if (!window.isSecureContext) {
      console.warn("Geolocation requires a secure context (HTTPS/localhost). Live tracking may fail.");
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc([pos.coords.latitude, pos.coords.longitude]);
        handleSearch(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        console.warn("Location permission denied", err);
        if (err.code === 1) {
          alert("Location Permission Denied. Please enable location access in your browser settings to use live navigation.");
        }
        handleSearch(null, null);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  const startLiveTracking = (dest, landId) => {
    setNavigatingTo(dest);
    setIsMapFullscreen(true); // Auto-trigger fullscreen focus mode
    syncNavState(landId, true); // Persist to DB

    if (watchId) navigator.geolocation.clearWatch(watchId);

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLoc([pos.coords.latitude, pos.coords.longitude]);
      },
      (err) => {
        console.error("Live tracking error:", err);
        if (err.code === 1) {
          alert("Live tracking requires Location access. Please enable it in your browser settings.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0 // Force fresh data for "lively" updates
      }
    );
    setWatchId(id);
  };

  const stopNavigation = () => {
    if (watchId) navigator.geolocation.clearWatch(watchId);
    setWatchId(null);
    setNavigatingTo(null);
    setRouteData(null);
    setCurrentInstructionIndex(0);
    syncNavState(null, false); // Clear from DB
  };

  // Guidance Logic: Proximity detection to auto-advance instructions
  useEffect(() => {
    if (!routeData || !routeData.instructions || !userLoc) return;

    const currentInstr = routeData.instructions[currentInstructionIndex];
    if (!currentInstr) return;

    // Get the point in the coordinates array where the next maneuver happens
    const nextManeuverCoord = routeData.coordinates[currentInstr.index];
    if (!nextManeuverCoord) return;

    const distToManeuver = calculateDistance(userLoc[0], userLoc[1], nextManeuverCoord.lat, nextManeuverCoord.lng) * 1000; // meters

    // If within 20 meters of the maneuver, advance to the next instruction
    if (distToManeuver < 20 && currentInstructionIndex < routeData.instructions.length - 1) {
      setCurrentInstructionIndex(prev => prev + 1);
    }
  }, [userLoc, routeData, currentInstructionIndex]);

  const maneuverIcon = (type) => {
    const t = type.toLowerCase();
    if (t.includes('straight')) return <ArrowUp size={32} />;
    if (t.includes('right')) {
      if (t.includes('slight')) return <ArrowUpRight size={32} />;
      if (t.includes('sharp')) return <CornerUpRight size={32} />;
      return <ArrowRight size={32} />;
    }
    if (t.includes('left')) {
      if (t.includes('slight')) return <ArrowUpLeft size={32} />;
      if (t.includes('sharp')) return <CornerUpLeft size={32} />;
      return <ArrowLeft size={32} />;
    }
    if (t.includes('turnaround')) return <RotateCcw size={32} />;
    if (t.includes('destination')) return <Flag size={32} />;
    return <Navigation size={32} />;
  };

  const handleInstructionsFound = React.useCallback((data) => {
    // Only update if summary changed to avoid circular renders
    setRouteData(prev => {
      if (prev?.summary?.totalDistance === data.summary.totalDistance) return prev;
      return data;
    });

    // Calculate and sync ETA
    if (data.summary && data.summary.totalTime) {
      const etaTime = new Date(Date.now() + data.summary.totalTime * 1000);
      setEta(etaTime);

      // Sync to backend if we have an active nav booking
      if (user?.active_nav_land_id) {
        // We need to find the specific booking ID. 
        // activeBookings contains the list of current sessions.
        const active = activeBookings.find(group => group.land_id === user.active_nav_land_id);
        if (active && active.bookings[0]) {
          authAxios.put(`/bookings/${active.bookings[0].id}/eta`, {
            estimated_arrival_at: etaTime.toISOString()
          }).catch(e => console.error("ETA sync failed", e));
        }
      }
    }
  }, [user, activeBookings, authAxios]);

  const fetchVehicles = async () => {
    try {
      const { data } = await authAxios.get('/customer/vehicles');
      setVehicles(data);
    } catch (err) {
      console.error(err);
      showSnackbar("Failed to sync fleet data. Access restricted.", "error");
    }
  };

  const fetchActiveBookings = async () => {
    try {
      const { data } = await authAxios.get('/customer/bookings');
      // Filter out purely COMPLETED or CANCELLED bookings that are fully paid
      const active = data.filter(b => {
        const s = typeof b.status === 'number' ? (b.status === 4 ? 'COMPLETED' : b.status === 3 ? 'CANCELLED' : b.status === 2 ? 'ACTIVE' : b.status === 1 ? 'RESERVED' : b.status) : b.status;
        if (s === 'CANCELLED') return false;
        if (s === 'COMPLETED' && b.payment_status === 'PAID') return false;
        return true;
      });

      const mapped = active.map(b => {
        let step = 'RESERVED';
        const s = typeof b.status === 'number' ? (b.status === 4 ? 'COMPLETED' : b.status === 3 ? 'CANCELLED' : b.status === 2 ? 'ACTIVE' : b.status === 1 ? 'RESERVED' : b.status) : b.status;

        if (s === 'RESERVED') step = 'RESERVED';
        if (s === 'ACTIVE') {
          if (b.checked_out_at) step = 'PAYMENT';
          else step = 'CHECK_IN_REQ';
        }
        if (b.checked_out_at && b.payment_status !== 'PAID') step = 'PAYMENT';

        return { ...b, step, fees: { total_amount: b.total_amount, penalty: b.penalty_amount } };
      });

      // Grouping Logic
      const groups = {};
      mapped.forEach(b => {
        const gid = b.group_id || `single-${b.id}`;
        if (!groups[gid]) {
          groups[gid] = {
            id: gid,
            bookings: [],
            total_amount: 0,
            penalty: 0,
            step: b.step,
            land_id: b.land_id,
            isGroup: !!b.group_id
          };
        }
        groups[gid].bookings.push(b);
        groups[gid].total_amount += (b.fees?.total_amount || 0);
        groups[gid].penalty += (b.fees?.penalty || 0);
        // Step priority: if any is RESERVED, whole group might show as RESERVED? 
        // Or if any is PAYMENT, show PAYMENT?
        // Usually they move together. We pick the first one's step for simplicity.
      });

      setActiveBookings(Object.values(groups));
    } catch (err) {
      console.error('Error fetching active bookings:', err);
      showSnackbar("Could not sync active sessions.", "error");
    }
  };

  const handleAddVehicle = async (e) => {
    e.preventDefault();
    if (!newVehicle.vehicle_number) return;

    setIsVerifyingVahan(true);
    showSnackbar("Analyzing Registration (Vahan Portal)...", "info");
    try {
      const { data } = await authAxios.post('/vahan/verify-and-add', { vehicle_number: newVehicle.vehicle_number });
      showSnackbar(`Success! ${data.vehicle.number} added to your fleet.`, "success");

      setNewVehicle({ vehicle_number: '', vehicle_type: 'Car' });
      fetchVehicles();
    } catch (err) {
      showSnackbar(err.response?.data?.detail || "Vahan search failed", "error");
    } finally {
      setIsVerifyingVahan(false);
    }
  };

  const handleDeleteVehicle = async (e, vehicleId, vehicleNumber) => {
    e.stopPropagation(); // Don't select the vehicle when deleting
    if (!window.confirm(`Are you sure you want to remove ${vehicleNumber} from your fleet?`)) return;

    try {
      await authAxios.delete(`/customer/vehicles/${vehicleId}`);
      showSnackbar("Vehicle removed successfully", "success");
      fetchVehicles();
      // Deselect if it was selected
      setSelectedVehicleIds(prev => prev.filter(id => id !== vehicleId));
    } catch (err) {
      showSnackbar(err.response?.data?.detail || "Failed to delete vehicle", "error");
    }
  };

  const toggleVehicleSelection = (vid) => {
    if (selectedVehicleIds.includes(vid)) {
      setSelectedVehicleIds(selectedVehicleIds.filter(id => id !== vid));
    } else {
      setSelectedVehicleIds([...selectedVehicleIds, vid]);
    }
  };

  const handleSearch = async (lat = userLoc[0], lng = userLoc[1]) => {
    setSearching(true);
    try {
      const params = { radius: filterForm.radius || 10, required_slots: selectedVehicleIds.length || 1 };
      if (lat !== null && lng !== null) {
        params.lat = lat;
        params.lng = lng;
      }
      if (filterForm.vehicle_type) params.vehicle_type = filterForm.vehicle_type;
      if (filterForm.max_price) params.max_price = filterForm.max_price;

      const { data } = await authAxios.get('/search', { params });

      // Smart Jitter Algorithm: Separates markers that perfectly overlap
      const seen = new Set();
      const jitteredData = data.map(land => {
        let lat = land.latitude;
        let lng = land.longitude;
        let key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
        while (seen.has(key)) {
          // Add an extremely tiny ~20 meter offset if another marker sits perfectly here!
          lat += (Math.random() - 0.5) * 0.0003;
          lng += (Math.random() - 0.5) * 0.0003;
          key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
        }
        seen.add(key);
        // Pre-compute expensive Distance calculation exactly once!
        const computedDistance = calculateDistance(userLoc[0], userLoc[1], lat, lng);
        return { ...land, displayLat: lat, displayLng: lng, computedDistance };
      });

      setSearchRes(jitteredData);
    } catch (err) { console.error("Search Error", err); }
  };

  const reserveMultiple = async (landId) => {
    if (selectedVehicleIds.length === 0) return alert("Select at least one vehicle from your fleet.");
    try {
      if (shouldGroup && selectedVehicleIds.length > 1) {
        const payload = { vehicle_ids: selectedVehicleIds, intended_duration: parseFloat(filterForm.intended_duration) };
        await authAxios.post(`/bookings/reserve-multiple/${landId}`, payload);
        alert(`Unified reservation secured for ${selectedVehicleIds.length} vehicles!`);
      } else {
        // Individual bookings
        await Promise.all(selectedVehicleIds.map(vId =>
          authAxios.post(`/bookings/reserve/${landId}?vehicle_id=${vId}&intended_duration=${filterForm.intended_duration}`)
        ));
        alert(selectedVehicleIds.length > 1
          ? `Created ${selectedVehicleIds.length} independent reservations.`
          : "Reservation secured!");
      }
      setSelectedVehicleIds([]);
      fetchActiveBookings();
      handleSearch();
    } catch (err) {
      alert(err.response?.data?.detail || "Booking failed");
    }
  };

  const groupCheckIn = async (group) => {
    try {
      await Promise.all(group.bookings.map(b => authAxios.post(`/bookings/${b.id}/check-in`)));
      fetchActiveBookings();
      alert("Check-in requested for group! Awaiting owner approval.");
    } catch (err) { alert("Group Check-in failed"); }
  };

  const groupCheckout = async (group) => {
    try {
      await Promise.all(group.bookings.map(b => authAxios.post(`/bookings/${b.id}/checkout`)));
      fetchActiveBookings();
    } catch (err) { alert("Group Checkout failed. Owner must verify entries first."); }
  };

  const groupPay = async (group, method) => {
    try {
      // Defensive check for valid IDs
      const validBookings = group.bookings.filter(b => b.id != null);
      if (validBookings.length === 0) {
        showSnackbar("No valid bookings found to pay", "error");
        return;
      }

      await Promise.all(validBookings.map(b => authAxios.post(`/bookings/${b.id}/pay?method=${method}`)));
      fetchActiveBookings();
      fetchRecentStays();
      showSnackbar(`Payment for ${group.isGroup ? 'Group' : 'Stay'} Success!`, "success");

      // Auto-trigger review for the first booking in the group
      if (group.bookings && group.bookings[0]) {
        // If cash, we still allow review if checkout happened
        setReviewBookingId(group.bookings[0].id);
      }

      handleSearch();
    } catch (err) {
      showSnackbar("Group Payment error", "error");
      console.error(err);
    }
  };

  const onReviewComplete = () => {
    fetchRecentStays();
    handleSearch(); // Refresh ratings on map
  };

  return (
    <div className="dashboard-layout">
      {/* Main Column */}
      <div className="main-content" style={{ height: '80vh', display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingRight: '1rem' }}>

        {/* Floating Filter Bar (Swiggy Style) */}
        <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="metric-label d-flex align-center gap-2" style={{ marginRight: 'auto', color: 'var(--text-primary)' }}><MapIcon size={18} /> Live Map Explore</div>

          <button className="btn-action btn-secondary" onClick={locateUser} title="Locate Me" style={{ padding: '0.4rem' }}><Crosshair size={18} /></button>

          <select className="form-select" style={{ width: 130, padding: '0.4rem' }} value={filterForm.vehicle_type} onChange={e => setFilterForm({ ...filterForm, vehicle_type: e.target.value })}>
            <option value="">Any Vehicle</option><option value="Car">Car</option><option value="Bike">Bike</option>
          </select>

          <input type="number" placeholder="Max ₹/hr" className="form-input" style={{ width: 100, padding: '0.4rem' }} value={filterForm.max_price} onChange={e => setFilterForm({ ...filterForm, max_price: e.target.value })} />

          <input type="number" placeholder="Duration(hr)" min="0.5" step="0.5" className="form-input" style={{ width: 110, padding: '0.4rem' }} value={filterForm.intended_duration} onChange={e => setFilterForm({ ...filterForm, intended_duration: e.target.value })} title="Intended Hours" />

          <select className="form-select" style={{ width: 130, padding: '0.4rem' }} value={sortBy} onChange={e => setSortBy(e.target.value)} title="Sort Results">
            <option value="distance">📍 Nearest</option>
            <option value="rating">⭐ Top Rated</option>
            <option value="price">💰 Cheapest</option>
          </select>

          <button className="btn-action" style={{ padding: '0.4rem 1rem' }} onClick={() => handleSearch()}><SlidersHorizontal size={18} /> Apply</button>
        </div>

        {/* Live Interaction Map */}
        <div style={{
          height: isMapFullscreen ? '100vh' : 400,
          width: isMapFullscreen ? '100vw' : '100%',
          position: isMapFullscreen ? 'fixed' : 'relative',
          top: isMapFullscreen ? 0 : 'auto',
          left: isMapFullscreen ? 0 : 'auto',
          zIndex: isMapFullscreen ? 9999 : 1,
          flexShrink: 0,
          borderRadius: isMapFullscreen ? 0 : 'var(--radius-lg)',
          overflow: 'hidden',
          border: isMapFullscreen ? 'none' : '1px solid var(--surface-border)',
          marginBottom: '1.5rem',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}>
          <MapContainer center={userLoc} zoom={14} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
            <MapPanner center={userLoc} isNavigating={!!navigatingTo} />
            <Marker position={userLoc} icon={userIcon}>
              <Popup><strong>You are here</strong></Popup>
            </Marker>

            {searchRes.map(land => (
              <Marker key={land.id} position={[land.displayLat || land.latitude, land.displayLng || land.longitude]} icon={parkingIcon} eventHandlers={{ click: () => openDetails(land) }}>
                <Popup>
                  <div style={{ width: 220 }}>
                    <strong style={{ fontSize: '1.2rem', color: '#1e1b4b' }}>{land.name}</strong><br />
                    <span style={{ color: '#64748b' }}>{land.address}</span><br />
                    <span style={{ color: 'var(--status-green)', fontWeight: 700, fontSize: '0.9rem' }}>{land.available_slots} slots available now</span>
                    <hr style={{ margin: '0.5rem 0', borderColor: '#e2e8f0' }} />
                    <button className="btn-action w-full" style={{ padding: '0.6rem' }} onClick={(e) => { e.stopPropagation(); openDetails(land); }}>
                      View Details & Reviews
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Active Reservation Markers */}
            {activeBookings.map((group, idx) => {
              const b = group.bookings[0];
              if (!b) return null;
              return (
                <Marker key={`active-${idx}`} position={[b.latitude, b.longitude]} icon={parkingIcon}>
                  <Popup>
                    <div style={{ width: 200 }}>
                      <strong style={{ color: 'var(--accent-primary)' }}>YOUR ACTIVE BOOKING</strong><br />
                      <strong>{b.land_name || `Facility #${b.land_id}`}</strong><br />
                      <span style={{ fontSize: '0.8rem' }}>{group.bookings.length} Vehicle(s)</span>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {navigatingTo && (
              <>
                <RoutingMachine
                  start={userLoc}
                  end={[navigatingTo.lat, navigatingTo.lng]}
                  color="#1a73e8"
                  onInstructionsFound={handleInstructionsFound}
                />
                <Marker position={[navigatingTo.lat, navigatingTo.lng]} icon={parkingIcon}>
                  <Popup>Destination: {navigatingTo.name}</Popup>
                </Marker>
              </>
            )}
          </MapContainer>

          {/* Map Interaction Tools */}
          <div style={{
            position: 'absolute',
            bottom: isMapFullscreen ? 40 : 20,
            right: 20,
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.8rem'
          }}>
            <button style={{ width: 44, height: 44, borderRadius: '12px', cursor: 'pointer', background: 'rgba(15, 23, 42, 0.8)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onClick={() => {
              const nextState = !isMapFullscreen;
              setIsMapFullscreen(nextState);
              if (navigatingTo) syncNavState(user.active_nav_land_id, nextState);
            }} title={isMapFullscreen ? "Exit Focus" : "Focus Mode"}>
              {isMapFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
            <button style={{ width: 44, height: 44, borderRadius: '12px', cursor: 'pointer', background: 'rgba(15, 23, 42, 0.8)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }} onClick={locateUser} title="Jump to My Location">
              <Crosshair size={20} />
            </button>
          </div>

          {/* Premium Guidance Overlay */}
          {navigatingTo && routeData && routeData.instructions[currentInstructionIndex] && (
            <div style={{ position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, width: '90%', maxWidth: 450 }}>
              <div className="glass-panel" style={{ padding: '1.25rem', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ background: 'var(--accent-primary)', pading: '0.75rem', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, flexShrink: 0 }}>
                  {maneuverIcon(routeData.instructions[currentInstructionIndex].type)}
                </div>
                <div style={{ flexGrow: 1 }}>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, lineHeight: 1.2, marginBottom: '0.25rem' }}>
                    {routeData.instructions[currentInstructionIndex].text}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Navigation size={14} style={{ transform: 'rotate(45deg)' }} />
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-md)', fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {(routeData.instructions[currentInstructionIndex].distance).toFixed(0)} meters
                    </div>
                  </div>

                  {/* New: ETA Indicator */}
                  {eta && (
                    <div className="d-flex align-center gap-2 mt-2 px-1" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-primary)' }}>
                      <Clock size={12} />
                      <span>Estimated Arrival: {eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  )}
                </div>
                <button className="btn-icon" onClick={stopNavigation} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '50%', width: 32, height: 32 }}>
                  <Search size={16} style={{ transform: 'rotate(45deg)' }} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Available Nearby Slots Grid */}
        {searchRes.length > 0 && (
          <div className="d-flex align-center justify-between mb-4">
            <h3>Nearby Parkings ({searchRes.length} found)</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Sorted by: <strong style={{ color: 'var(--accent-primary)' }}>{sortBy === 'rating' ? '⭐ Rating' : sortBy === 'price' ? '💰 Price' : '📍 Distance'}</strong>
            </span>
          </div>
        )}
        <div className="grid-cards">
          {[...searchRes]
            .sort((a, b) => {
              let scoreA = 0, scoreB = 0;

              // Ultra-fast O(1) property lookup (memoized during network fetch)
              const dA = a.computedDistance || 0;
              const dB = b.computedDistance || 0;

              if (dA <= (filterForm.radius || 10)) scoreA += 100;
              if (dB <= (filterForm.radius || 10)) scoreB += 100;

              if (filterForm.vehicle_type) {
                if (a.vehicle_types.includes(filterForm.vehicle_type)) scoreA += 50;
                if (b.vehicle_types.includes(filterForm.vehicle_type)) scoreB += 50;
              }

              if (filterForm.max_price) {
                if (a.price_per_hour <= filterForm.max_price) scoreA += 30;
                if (b.price_per_hour <= filterForm.max_price) scoreB += 30;
              }

              const reqSlots = selectedVehicleIds.length || 1;
              if (a.available_slots >= reqSlots) scoreA += 80;
              if (b.available_slots >= reqSlots) scoreB += 80;

              // 1. User Explicit SortBy overrides everything so they see what they clicked immediately
              if (sortBy === 'price' && a.price_per_hour !== b.price_per_hour) {
                return a.price_per_hour - b.price_per_hour;
              }
              if (sortBy === 'rating' && (b.avg_rating || 0) !== (a.avg_rating || 0)) {
                return (b.avg_rating || 0) - (a.avg_rating || 0);
              }

              // 2. Highest filter match score bubbles to the top next
              if (scoreA !== scoreB) return scoreB - scoreA;

              // 3. Ultimate Fallback: distance
              return dA - dB;
            })
            .map(land => {
              const distance = land.computedDistance?.toFixed(1) || "0.0";
              return (
                <div key={land.id} className="glass-card mb-4" onClick={() => openDetails(land)} style={{ cursor: 'pointer', transition: '0.2s', borderLeft: '4px solid #fbbf24' }}>
                  <div className="card-header">
                    <div>
                      <h3 className="card-title">{land.name}</h3>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}><MapPin size={12} /> {land.address}</div>
                    </div>
                    <span className="card-badge badge-online">{distance} km</span>
                  </div>
                  <div className="card-body" style={{ marginTop: '0.5rem' }}>
                    <div className="d-flex align-center gap-1 mb-2">
                      <Star size={14} fill="#fbbf24" color="#fbbf24" />
                      <span style={{ fontWeight: 700 }}>{land.avg_rating?.toFixed(1) || "New"}</span>
                      <span className="text-secondary">({land.review_count || 0} reviews)</span>
                    </div>
                    <div><strong>Base:</strong> ₹{land.price_per_hour}/hr</div>
                    <div style={{ color: 'var(--status-green)', marginTop: '0.5rem', fontWeight: 700 }}>{land.available_slots} slots left</div>
                  </div>
                  <div className="card-footer" style={{ marginTop: '0.5rem', paddingTop: '0.5rem' }}>
                    <button className="btn-action btn-secondary w-full" onClick={(e) => { e.stopPropagation(); openDetails(land); }}>
                      See Community Reviews
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Side Panel: Fleet & HUD */}
      <div className="side-panel glass-panel" style={{ height: '80vh', overflowY: 'auto' }}>
        {/* Active Flow HUD */}
        {activeBookings.length > 0 && (
          <div className="mb-4">
            <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>Current Active Deployment</h3>
            {activeBookings.map((group, idx) => (
              <div key={idx} className="glass-card" style={{ padding: '1.25rem', marginTop: '1rem', borderTop: group.isGroup ? '4px solid #6366f1' : '3px solid var(--accent-primary)' }}>
                <div className="mb-3">
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    {group.isGroup ? "SHARED GROUP SESSION" : `BOOKING ID #${group.bookings[0]?.id}`}
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 600 }}>
                    {group.bookings.length} Vehicle(s) at {group.bookings[0]?.land_name || `Facility #${group.land_id}`}
                  </div>
                </div>

                {group.step === 'RESERVED' && (
                  <div className="d-flex gap-2">
                    <button
                      className={`btn-action w-full ${isVerifying[group.id] ? 'btn-secondary' : ''}`}
                      disabled={isVerifying[group.id]}
                      onClick={() => groupCheckIn(group)}
                    >
                      {isVerifying[group.id] ? <><Activity size={18} className="animate-pulse" /> Requesting...</> : <><Navigation size={18} /> Verify Group Entry</>}
                    </button>
                    <button className="btn-action btn-secondary" title="Navigate Lively" onClick={() => {
                      const b = group.bookings && group.bookings[0];
                      if (b) {
                        startLiveTracking({ lat: b.latitude, lng: b.longitude, name: b.land_name }, group.land_id);
                      } else {
                        showSnackbar("No facility data found for navigation", "error");
                      }
                    }}>
                      <Navigation size={18} />
                    </button>
                  </div>
                )}

                {group.step === 'CHECK_IN_REQ' && (
                  <div>
                    <span className="card-badge badge-active mb-2 d-inline-block">Awaiting Verification</span>
                    <button className="btn-action w-full mt-2" onClick={() => groupCheckout(group)}>Initiate Group Checkout</button>
                  </div>
                )}

                {group.step === 'PAYMENT' && (
                  <div>
                    <div style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>
                      Group Total Due: <br /><strong>₹{group.total_amount?.toFixed(2)}</strong>
                      {group.penalty > 0 && <div style={{ fontSize: '0.8rem', color: 'var(--status-red)' }}>Incl. ₹{group.penalty.toFixed(2)} penalty</div>}
                    </div>
                    <div className="d-flex gap-2">
                      <button className="btn-action w-full" onClick={() => groupPay(group, "ONLINE")}>Pay All Online</button>
                      <button className="btn-action btn-secondary w-full" onClick={() => groupPay(group, "CASH")}>Pay All Cash</button>
                    </div>
                  </div>
                )}

                <div className="mt-2" style={{ fontSize: '0.75rem', borderTop: '1px solid var(--surface-border)', paddingTop: '0.5rem' }}>
                  {group.bookings.map(b => (
                    <div key={b.id} className="d-flex justify-between">
                      <span>Vehicle #{b.vehicle_id}</span>
                      <span>{b.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mb-4 mt-4">
          <h3><Key size={18} /> My Fleet & Selection</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Select exactly which vehicles to park simultaneously.</p>

          <div className="timeline-feed mt-4" style={{ paddingLeft: 0, gap: '0.5rem' }}>
            <div className="glass-card mb-2" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(99, 102, 241, 0.05)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Unified Group Session</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Combine vehicles into one payment/control</div>
              </div>
              <div onClick={() => setShouldGroup(!shouldGroup)} style={{ width: 44, height: 24, borderRadius: 12, background: shouldGroup ? 'var(--accent-primary)' : 'rgba(255,255,255,0.1)', cursor: 'pointer', position: 'relative', transition: '0.3s' }}>
                <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'white', position: 'absolute', top: 3, left: shouldGroup ? 23 : 3, transition: '0.3s' }} />
              </div>
            </div>

            {vehicles.map((v, idx) => {
              const isSelected = selectedVehicleIds.includes(v.id);
              return (
                <div key={v.id} onClick={() => toggleVehicleSelection(v.id)} className="glass-card" style={{ padding: '0.75rem', cursor: 'pointer', border: isSelected ? '1px solid var(--status-green)' : '1px solid var(--surface-border)', background: isSelected ? 'rgba(16, 185, 129, 0.1)' : '' }}>
                  <div className="d-flex justify-between align-center mb-1">
                    <div className="d-flex align-center gap-2">
                      <div style={{ width: 16, height: 16, borderRadius: 4, border: '1px solid var(--text-secondary)', background: isSelected ? 'var(--status-green)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {isSelected && <CheckCircle size={12} color="white" />}
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>#{idx + 1}</span>
                      <span style={{ fontWeight: 700 }}>{v.vehicle_number}</span>
                    </div>
                    <div className="d-flex align-center gap-2">
                      <span className="card-badge badge-offline">{v.vehicle_type}</span>
                      <button
                        onClick={(e) => handleDeleteVehicle(e, v.id, v.vehicle_number)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px', borderRadius: '4px', transition: '0.2s', display: 'flex', alignItems: 'center' }}
                        onMouseOver={e => e.currentTarget.style.color = '#ef4444'}
                        onMouseOut={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                        title="Delete Vehicle"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {v.vehicle_model && (
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', paddingLeft: '2.2rem', marginTop: '2px', fontStyle: 'italic' }}>
                      {v.vehicle_model}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Vehicle Hook */}
          <form onSubmit={handleAddVehicle} className="mt-4 pt-4" style={{ borderTop: '1px solid var(--surface-border)' }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Register New Vehicle</h4>
            <div className="d-flex gap-2 mb-4">
              <input
                className="form-input"
                placeholder="Plate Num (e.g. KA01AB1234)"
                value={newVehicle.vehicle_number}
                onChange={e => setNewVehicle({ ...newVehicle, vehicle_number: e.target.value.toUpperCase() })}
                required
                disabled={isVerifyingVahan}
              />
            </div>
            <button className="btn-action w-full text-center d-flex align-center justify-center gap-2" disabled={isVerifyingVahan || !newVehicle.vehicle_number}>
              {isVerifyingVahan ? (
                <>
                  <Activity className="animate-pulse" size={16} /> Connecting to Vahan Portal...
                </>
              ) : "Verify & Add to Fleet"}
            </button>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.5rem', textAlign: 'center' }}>
              Secure verification via Parivahan Government Portal
            </p>
          </form>
        </div>
      </div>

      {/* Review Modal */}
      {reviewBookingId && (
        <ReviewModal
          bookingId={reviewBookingId}
          onComplete={onReviewComplete}
          onClose={() => setReviewBookingId(null)}
        />
      )}

      {/* Facility Details Overlay Browser-style Drawer */}
      {selectedLand && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10005, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(2, 6, 23, 0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setSelectedLand(null)} />
          <div className="glass-panel" style={{
            position: 'relative',
            width: '90%',
            maxWidth: '500px',
            height: '100%',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideIn 0.3s ease-out'
          }}>
            {/* Header Info */}
            <div style={{ padding: '2rem', borderBottom: '1px solid var(--surface-border)', position: 'relative' }}>
              <button style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setSelectedLand(null)}>
                <X size={24} />
              </button>
              <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{selectedLand.name}</h2>
              <p className="text-secondary d-flex align-center gap-2"><MapPin size={16} /> {selectedLand.address}</p>
              <div className="d-flex align-center gap-3 mt-4">
                <div style={{ background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', fontWeight: 700, fontSize: '1.2rem' }}>
                  ★ {selectedLand.avg_rating?.toFixed(1) || "0.0"}
                </div>
                <span className="text-secondary">{selectedLand.review_count || 0} community ratings</span>
                <div style={{ marginLeft: 'auto', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--status-green)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', fontWeight: 700 }}>
                  {selectedLand.available_slots} Slots Free
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div style={{ padding: '1.5rem 2rem', background: 'rgba(255,255,255,0.02)', display: 'flex', gap: '1rem' }}>
              <button className="btn-action w-full" onClick={() => reserveMultiple(selectedLand.id)}>
                Secure Space Now (₹{selectedLand.price_per_hour}/hr)
              </button>
              <button className="btn-action btn-secondary" title="Navigate" onClick={() => {
                startLiveTracking({ lat: selectedLand.latitude, lng: selectedLand.longitude, name: selectedLand.name }, selectedLand.id);
                setSelectedLand(null);
              }}>
                <Navigation size={20} />
              </button>
            </div>

            {/* Reviews Section */}
            <div style={{ flexGrow: 1, overflowY: 'auto', padding: '2rem' }}>
              <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Star size={20} className="text-secondary" /> Customer Experience Logs
              </h3>

              {loadingReviews ? (
                <div className="text-center py-8">
                  <Activity className="animate-pulse text-secondary" size={32} />
                  <p className="text-secondary mt-2">Opening logs...</p>
                </div>
              ) : landReviews.length === 0 ? (
                <div className="glass-card text-center py-12" style={{ opacity: 0.7 }}>
                  <p>No textual logs recorded yet.<br />Be the first to rate after your stay!</p>
                </div>
              ) : (
                <div className="d-flex flex-column gap-4">
                  {landReviews.map((rev, i) => (
                    <div key={i} className="glass-card" style={{ padding: '1.25rem', background: 'rgba(255,255,255,0.03)' }}>
                      <div className="d-flex justify-between align-center mb-2">
                        <div style={{ display: 'flex', gap: '2px' }}>
                          {[1, 2, 3, 4, 5].map(s => (
                            <Star key={s} size={14} fill={s <= rev.rating ? "#fbbf24" : "none"} color="#fbbf24" />
                          ))}
                        </div>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{new Date(rev.checked_out_at).toLocaleDateString()}</span>
                      </div>
                      <p style={{ fontSize: '0.9rem', lineHeight: 1.5 }}>{rev.review || "No verbal feedback left."}</p>
                      <div style={{ fontSize: '0.75rem', marginTop: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>— ID Card Verified Customer</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}



      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        .animate-pulse { animation: pulse 1.5s infinite; }
        @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
      `}</style>
    </div>
  );
}
