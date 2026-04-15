import gradio as gr
import requests
import json
import pandas as pd
from datetime import datetime
import time

BASE_URL = "http://127.0.0.1:8000"

# --- Utils ---
def get_headers(token):
    return {"Authorization": f"Bearer {token}"}

def format_dt(dt_str):
    if not dt_str: return "-"
    try:
        dt = datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d %H:%M")
    except:
        return dt_str

# --- API Calls ---
def login_user(username, password):
    try:
        response = requests.post(f"{BASE_URL}/token", data={"username": username, "password": password})
        if response.status_code == 200:
            token = response.json()["access_token"]
            user_info = requests.get(f"{BASE_URL}/me", headers=get_headers(token)).json()
            return token, user_info, "Login successful!"
        return None, None, response.json().get("detail", "Login failed")
    except Exception as e:
        return None, None, f"Error: {str(e)}"

def register_user(username, email, password, role):
    try:
        res = requests.post(f"{BASE_URL}/register", json={"username": username, "email": email, "password": password, "role": role})
        return "Registration successful!" if res.status_code == 200 else res.json().get("detail", "Failed")
    except Exception as e: return f"Error: {str(e)}"

# --- Owner API ---
def get_owner_lands(token):
    res = requests.get(f"{BASE_URL}/owner/lands", headers=get_headers(token))
    return pd.DataFrame(res.json()) if res.status_code == 200 else pd.DataFrame()

def toggle_land_status(token, land_id, status):
    res = requests.patch(f"{BASE_URL}/owner/lands/{land_id}/status", params={"status": status}, headers=get_headers(token))
    return res.json().get("message", "Error")

def get_owner_bookings(token):
    res = requests.get(f"{BASE_URL}/owner/bookings", headers=get_headers(token))
    if res.status_code == 200:
        data = res.json()
        for d in data:
            d['reserved_at'] = format_dt(d['reserved_at'])
            d['checked_in_at'] = format_dt(d['checked_in_at'])
        return pd.DataFrame(data)
    return pd.DataFrame()

def approve_check_in(token, booking_id):
    res = requests.post(f"{BASE_URL}/owner/approve-check-in/{booking_id}", headers=get_headers(token))
    return res.json().get("message", "Error")

def confirm_payment(token, booking_id):
    res = requests.post(f"{BASE_URL}/owner/confirm-payment/{booking_id}", headers=get_headers(token))
    return res.json().get("message", "Error")

# --- Customer API ---
def get_vehicles(token):
    res = requests.get(f"{BASE_URL}/customer/vehicles", headers=get_headers(token))
    return pd.DataFrame(res.json()) if res.status_code == 200 else pd.DataFrame()

def reserve_slot(token, land_id, vehicle_id, intended_duration):
    res = requests.post(f"{BASE_URL}/bookings/reserve/{land_id}", 
                        params={"vehicle_id": vehicle_id, "intended_duration": intended_duration}, 
                        headers=get_headers(token))
    return res.json() if res.status_code == 200 else {"error": res.json().get("detail", "Failed")}

def request_check_in(token, booking_id):
    res = requests.post(f"{BASE_URL}/bookings/{booking_id}/check-in", headers=get_headers(token))
    return res.json().get("message", "Error")

def request_checkout(token, booking_id):
    res = requests.post(f"{BASE_URL}/bookings/{booking_id}/checkout", headers=get_headers(token))
    return res.json() if res.status_code == 200 else {"error": "Failed"}

def process_payment(token, booking_id, method):
    res = requests.post(f"{BASE_URL}/bookings/{booking_id}/pay", params={"method": method}, headers=get_headers(token))
    return res.json().get("message", "Error")

def get_my_active_booking(token):
    # This is a bit of a hack since we don't have a direct 'my active booking' endpoint
    # We'll fetch all my bookings and filter for RESERVE/ACTIVE
    # (Actually I should add an endpoint for this, but for now I'll just search )
    res = requests.get(f"{BASE_URL}/me", headers=get_headers(token))
    if res.status_code == 200:
        # In a real app, I'd have /bookings/me
        # Let's assume we fetch from /me if it returns nested bookings? 
        # Models.py has relationships, so maybe. 
        # But let's just create a quick endpoint in main.py instead.
        pass
    return None

# --- UI ---
CUSTOM_CSS = """
.gradio-container { background-color: #f7f9fc; }
h1 { font-family: 'Outfit', sans-serif; font-weight: 800; letter-spacing: -1px; }
.gr-button-primary { background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); border: none; }
.gr-button-secondary { background: #white; border: 1px solid #e5e7eb; color: #374151; }
.gr-box { border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
"""

with gr.Blocks(theme=gr.themes.Soft(primary_hue="indigo", secondary_hue="slate"), css=CUSTOM_CSS) as demo:
    token_state = gr.State("")
    user_state = gr.State(None)
    
    gr.HTML("<h1 style='text-align: center; color: #1e1b4b; padding: 20px 0;'>🅿️ Smart Parking OS</h1>")
    
    with gr.Tabs() as main_tabs:
        # --- Auth ---
        with gr.Tab("Welcome", id="auth_tab") as tab0:
            with gr.Row():
                with gr.Column(scale=1, elem_classes=["gr-box"]):
                    gr.Markdown("### 🔑 Login")
                    u_login = gr.Textbox(label="Username", placeholder="Enter your username")
                    p_login = gr.Textbox(label="Password", type="password")
                    b_login = gr.Button("Sign In", variant="primary")
                with gr.Column(scale=1, elem_classes=["gr-box"]):
                    gr.Markdown("### 📝 Register")
                    u_reg = gr.Textbox(label="Username")
                    e_reg = gr.Textbox(label="Email")
                    p_reg = gr.Textbox(label="Password", type="password")
                    r_reg = gr.Radio(["CUSTOMER", "OWNER"], label="I am a...", value="CUSTOMER")
                    b_reg = gr.Button("Create Account")
            out_auth = gr.Markdown()

        # --- Dashboard ---
        with gr.Tab("Dashboard", id="dash_tab", visible=False) as tab1:
            welcome_msg = gr.Markdown()
            
            with gr.Tabs() as role_tabs:
                # --- OWNER SECTION ---
                with gr.Tab("Owner Console", visible=False) as owner_tab:
                    with gr.Row():
                        with gr.Column(scale=1):
                            gr.Markdown("### 🏗️ Facility Management")
                            with gr.Accordion("Register New Parking Land", open=False):
                                l_name = gr.Textbox(label="Facility Name")
                                l_addr = gr.Textbox(label="Address")
                                with gr.Row():
                                    l_lat = gr.Number(label="Latitude", value=12.97)
                                    l_lng = gr.Number(label="Longitude", value=77.59)
                                l_slots = gr.Number(label="Total Slots", value=10)
                                l_types = gr.Textbox(label="Vehicle Types (e.g., Car, Bike)")
                                with gr.Row():
                                    l_price = gr.Number(label="Base Price/Hr", value=40)
                                    l_pen = gr.Number(label="Penalty/Hr", value=100)
                                l_grace = gr.Number(label="Grace Period (min)", value=15)
                                b_add_land = gr.Button("Add Land", variant="primary")
                            
                            gr.Markdown("#### Dynamic Availability Control")
                            lands_df = gr.Dataframe(interactive=False)
                            with gr.Row():
                                target_land_id = gr.Number(label="Land ID", precision=0)
                                target_status = gr.Dropdown(["ONLINE", "OFFLINE"], label="New Status")
                                b_update_status = gr.Button("Update Facility Status")

                        with gr.Column():
                            gr.Markdown("### 🕒 Active Queue & Approvals")
                            bookings_df = gr.Dataframe(interactive=False)
                            with gr.Row():
                                target_booking_id = gr.Number(label="Booking ID", precision=0)
                                b_approve = gr.Button("Approve Check-In", variant="primary")
                                b_confirm_pay = gr.Button("Confirm Cash Payment", variant="secondary")
                            
                            gr.Markdown("#### 🔔 Recent Notifications")
                            notifs_df = gr.Dataframe(interactive=False)

                # --- CUSTOMER SECTION ---
                with gr.Tab("Customer Hub", visible=False) as customer_tab:
                    with gr.Row():
                        with gr.Column(scale=1):
                            gr.Markdown("### 🚗 My Vehicles")
                            v_df = gr.Dataframe(interactive=False)
                            with gr.Accordion("Register New Vehicle", open=False):
                                v_num = gr.Textbox(label="Vehicle Number")
                                v_type = gr.Dropdown(["Car", "Bike", "Truck"], label="Type")
                                b_add_v = gr.Button("Add")
                        
                        with gr.Column(scale=2):
                            gr.Markdown("### 🔍 Find Parking")
                            with gr.Row():
                                s_lat = gr.Number(label="Lat", value=12.97)
                                s_lng = gr.Number(label="Lng", value=77.59)
                                s_rad = gr.Slider(1, 20, 5, label="Radius (km)")
                                s_type = gr.Dropdown(["Car", "Bike", "Truck"], label="Filter Type")
                            b_search = gr.Button("Find Nearby Parking", variant="primary")
                            search_results = gr.Dataframe(interactive=False)
                            
                            with gr.Row():
                                sel_land_id = gr.Number(label="Target Land ID", precision=0)
                                sel_v_id = gr.Number(label="Select Vehicle ID", precision=0)
                                sel_duration = gr.Number(label="Intended Duration (Hours)", value=1.0)
                                b_reserve = gr.Button("RESERVE SLOT", variant="primary")

                    gr.Markdown("---")
                    with gr.Row():
                        with gr.Column():
                            gr.Markdown("### 📍 Active Parking Session")
                            active_info = gr.Markdown("No active session")
                            with gr.Row():
                                b_check_in = gr.Button("Check-In", visible=False)
                                b_checkout = gr.Button("Initiate Checkout", visible=False)
                            
                            with gr.Column(visible=False) as pay_panel:
                                pay_msg = gr.Markdown()
                                pay_method = gr.Radio(["ONLINE", "CASH"], label="Payment Method")
                                b_pay = gr.Button("Complete Payment")

    # --- Auth Logic ---
    def auth_flow(u, p):
        t, info, msg = login_user(u, p)
        if t:
            role = info['role']
            return (
                t, info,
                gr.update(visible=True),
                gr.update(value=f"Welcome, **{info['username']}**! You are logged in as a **{role}**."),
                gr.update(visible=True if role == 'OWNER' else False),
                gr.update(visible=True if role == 'CUSTOMER' else False),
                msg
            )
        return "", None, gr.update(visible=False), "", False, False, msg

    b_login.click(auth_flow, inputs=[u_login, p_login], outputs=[token_state, user_state, tab1, welcome_msg, owner_tab, customer_tab, out_auth])
    b_reg.click(register_user, inputs=[u_reg, e_reg, p_reg, r_reg], outputs=out_auth)

    # --- Owner Logic ---
    def refresh_owner(token):
        lands = get_owner_lands(token)
        bookings = get_owner_bookings(token)
        # Fetch notifications
        res = requests.get(f"{BASE_URL}/notifications", headers=get_headers(token))
        notifs = pd.DataFrame(res.json()) if res.status_code == 200 else pd.DataFrame()
        return lands, bookings, notifs

    b_add_land.click(lambda t, n, a, lat, lng, s, vt, p, pen, g: requests.post(f"{BASE_URL}/owner/lands", json={
        "name": n, "address": a, "latitude": lat, "longitude": lng, "total_slots": s,
        "vehicle_types": [x.strip() for x in vt.split(",")], "price_per_hour": p, "penalty_per_hour": pen, "grace_minutes": g
    }, headers=get_headers(t)).json().get("name", "Error"), 
    inputs=[token_state, l_name, l_addr, l_lat, l_lng, l_slots, l_types, l_price, l_pen, l_grace]).then(refresh_owner, inputs=token_state, outputs=[lands_df, bookings_df, notifs_df])

    b_update_status.click(toggle_land_status, inputs=[token_state, target_land_id, target_status]).then(refresh_owner, inputs=token_state, outputs=[lands_df, bookings_df, notifs_df])
    b_approve.click(approve_check_in, inputs=[token_state, target_booking_id]).then(refresh_owner, inputs=token_state, outputs=[lands_df, bookings_df, notifs_df])
    b_confirm_pay.click(confirm_payment, inputs=[token_state, target_booking_id]).then(refresh_owner, inputs=token_state, outputs=[lands_df, bookings_df, notifs_df])

    # --- Customer Logic ---
    def refresh_customer(token):
        v = get_vehicles(token)
        # Find active booking (simple search)
        # For demo, we skip detailed status check, but we'll show buttons if user has any RESERVED/ACTIVE
        return v

    b_add_v.click(lambda t, n, ty: requests.post(f"{BASE_URL}/customer/vehicles", json={"vehicle_number": n, "vehicle_type": ty}, headers=get_headers(t)).json(), 
                inputs=[token_state, v_num, v_type]).then(refresh_customer, inputs=token_state, outputs=v_df)

    b_search.click(lambda t, la, ln, r, ty: pd.DataFrame(requests.get(f"{BASE_URL}/search", params={"lat":la, "lng":ln, "radius":r, "vehicle_type":ty}).json()), 
                   inputs=[token_state, s_lat, s_lng, s_rad, s_type], outputs=search_results)

    def handle_reserve(token, l_id, v_id, duration):
        res = reserve_slot(token, l_id, v_id, duration)
        if "error" in res: return res["error"], gr.update(visible=False), gr.update(visible=False)
        return f"Reserved! Booking ID: {res['id']}. Please check in within 3 mins (Simulated).", gr.update(visible=True, value=res['id']), gr.update(visible=True)

    # State for current user booking
    cur_booking_id = gr.State(0)

    b_reserve.click(handle_reserve, inputs=[token_state, sel_land_id, sel_v_id, sel_duration], outputs=[active_info, cur_booking_id, b_check_in])
    
    b_check_in.click(request_check_in, inputs=[token_state, cur_booking_id], outputs=active_info).then(
        lambda: (gr.update(visible=False), gr.update(visible=True)), outputs=[b_check_in, b_checkout]
    )

    def handle_checkout(token, b_id):
        res = request_checkout(token, b_id)
        if "error" in res: return "Error during checkout", gr.update(visible=False)
        msg = f"Checkout initiated! Total Duration Fee: ₹{res['total_amount']:.2f}. Penalty: ₹{res['penalty']:.2f}."
        return msg, gr.update(visible=True)

    b_checkout.click(handle_checkout, inputs=[token_state, cur_booking_id], outputs=[pay_msg, pay_panel])

    b_pay.click(process_payment, inputs=[token_state, cur_booking_id, pay_method], outputs=active_info).then(
        lambda: (gr.update(visible=False), gr.update(visible=False), "Session Completed! Slot Released."), outputs=[pay_panel, b_checkout, active_info]
    )

    # Initial refresh on login
    b_login.click(refresh_owner, inputs=token_state, outputs=[lands_df, bookings_df, notifs_df])
    b_login.click(refresh_customer, inputs=token_state, outputs=v_df)

if __name__ == "__main__":
    demo.launch()
