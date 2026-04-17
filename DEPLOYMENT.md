# Hosting Guide: Deploying to Render

This guide provides step-by-step instructions for deploying the **Smart Parking Management System** to Render.

---

## 1. Prerequisites
- A GitHub repository with your latest code.
- A **Neon Database** connection string.

---

## 2. Deploy the Backend (FastAPI)

1. **New Web Service**: Connect your GitHub repository.
2. **Configuration**:
   - **Name**: `smart-parking-backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
3. **Environment Variables**:
   - `DATABASE_URL`: Your Neon connection string.
   - `JWT_SECRET`: A secure random string.
   - `PYTHON_VERSION`: `3.11.0`

> [!IMPORTANT]
> Note your backend URL (e.g., `https://backend.onrender.com`) for the frontend setup.

---

## 3. Deploy the Frontend (React/Vite)

1. **New Static Site**: Connect the same GitHub repository.
2. **Configuration**:
   - **Name**: `smart-parking-system-ui`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
3. **Environment Variables**:
   - `VITE_API_URL`: Your Backend Web Service URL.

> [!IMPORTANT]
> **SPA REWRITE RULE (REQUIRED)**
> To prevent "Not Found" errors on page refresh:
> 1. Go to **Redirects/Rewrites** settings.
> 2. Add Rule: Source: `/*`, Destination: `/index.html`, Action: `Rewrite`.

---

## 4. Setup Database
Run the following in the Render Backend **Shell** tab:
```bash
python3 init_db.py
```

---

## 🛠️ Troubleshooting
- **Mixed Content**: Use `https` for `VITE_API_URL`.
- **404 on Refresh**: Ensure the SPA Rewrite rule in Step 3 is applied.
