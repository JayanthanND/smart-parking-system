# 🚗 Smart Parking Management System (Obsidian Edition)
**Live Application:** [https://sparkit-zjuc.onrender.com](https://sparkit-zjuc.onrender.com)

A premium, full-stack parking management solution featuring high-fidelity indoor/outdoor navigation, real-time fleet management, and server-side state persistence. Designed with a sleek "Obsidian" aesthetic, this system provides a seamless experience for both parking owners and customers.

## ✨ Core Features

### 🏁 Next-Gen Navigation (Google Maps Style)
- **Live Proximity Tracking:** Real-time GPS integration that monitors user position relative to navigation maneuvers.
- **Turn-by-Turn Guidance:** Directional instructions ($Left\ turn$, $U-turn$, etc.) with dynamic distance countdowns.
- **Auto-Focus Mode:** Dedicated fullscreen navigation interface optimized for mobile dashboard mounting.
- **Vivid Pathing:** High-contrast vivid blue routes for superior visibility.
- **Session Persistence:** Navigation state is stored on the server—log out or refresh without losing your active mission.

### 👥 Advanced Booking Engine
- **Unified Group Sessions:** Park multiple vehicles as a single entity with combined billing and synchronized check-ins.
- **Optional Grouping Toggle:** Flexibility to choose between unified fleet control or independent vehicle sessions.
- **Proactive Expiry:** Automated reservation cleanup to ensure maximum slot availability.

### 📊 Operational transparency
- **Profile Persistence:** Users and Owners can see their registered phone numbers in the global header.
- **Direct Facility Contact:** Customers can call facility owners directly from search results or booking history.
- **Operations Hub:** A dedicated real-time view for owners to manage live arrivals and departures.

### 🛡️ Premium Valet Service
- **Dual Slot Pools:** Strict separation between standard and valet slots ensuring reserved spots are always available.
- **Valet-Ready Dispatch:** Owners see a bright blue **VALET badge** in the operations queue for incoming valet requests.
- **Real-Time Capacity:** Owners and customers can monitor valet-specific occupancy in real-time.
- **Dynamic Pricing Integration:** Seamlessly choose between standard or premium valet services during the booking flow.

## 📂 Project Structure
```text
smart-parking-system/
├── backend/
│   ├── main.py             # API Gateway & Logic Engine
│   ├── models.py           # SQLAlchemy Data Schemas
│   ├── auth.py             # JWT & Security Abstraction
│   ├── database.py         # Connection & Session Setup
│   └── vahan_scraper.py    # Vehicle verification logic
├── frontend/src/
│   ├── pages/
│   │   ├── CustomerPanel.jsx # Booking & Live Navigation
│   │   ├── OwnerPanel.jsx    # Facility & Revenue Dashboard
│   │   ├── OperationsQueue.jsx # Real-time Operational Hub
│   │   └── Auth.jsx         # Secure Access Gateway
│   ├── components/         # Reusable Primitives (Maps, UI)
│   ├── context/            # Global Auth & Application State
│   └── main.jsx            # Application Root
├── init_db.py              # Database Schema Sync Script
└── README.md               # System Documentation
```

## 🛠️ Tech Stack
- **Frontend:** React 19, Vite, React-Leaflet, Lucide Icons.
- **Backend:** Python 3.11+, FastAPI, SQLAlchemy, SQLite/PostgreSQL.
- **Security:** JWT Authentication with bcrypt hashing.

---

## 🚀 Getting Started

### Prerequisites
- Python 3.11+ installed.
- Node.js & npm installed.

### 1. Backend Setup
```bash
# Install dependencies
pip install -r requirements.txt

# Initialize database
python3 init_db.py

# Start the server (Development)
uvicorn backend.main:app --reload
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*Access the dashboard at `http://localhost:5173`*

---

## 🗺️ Functional Flow

### For Customers
1. **Fleet Registration:** Add vehicles to "My Fleet" with plate numbers and types.
2. **Explore:** Use the map to find nearby ONLINE facilities with real-time pricing and availability.
3. **Secure Reservation:** Select multiple vehicles, choose your duration, and reserve.
   - **Toggle Valet:** Optionally enable **Premium Valet Service** to have your vehicle parked by professionals upon arrival.
   - **Unified Group:** Group multiple vehicles as a single entity for synchronized billing.
4. **Navigational Focus:** Click "Navigate" to enter **Focus Mode**—the map will follow your live position and provide turn-by-turn guidance until arrival.
5. **Verify & Pay:** Once at the location, verify your entry. Checkout and pay (Online/Cash) when departing.

### For Owners
1. **Facility Setup:** Register your land with coordinates, slots, and **Valet Capacity**.
2. **Go Live:** Set your status to ONLINE to appear on the customer map.
3. **Manage Queue:** Monitor the **Operations Queue** to approve arrivals. Look for the **VALET badge** to prioritize premium service requests.

---

## 📄 License
Designed and Developed by Jayanthan ND. Full-stack Smart Parking solution.
