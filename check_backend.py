import requests
import sys

BASE_URL = "http://127.0.0.1:8000"

def check_backend():
    print(f"--- Diagnostic Check: Sparkit Backend ---")
    
    # 1. Health Check
    try:
        res = requests.get(f"{BASE_URL}/health")
        if res.status_code == 200:
            data = res.json()
            print(f"[SUCCESS] Health Check: Version {data.get('version', 'unknown')} is RUNNING.")
        else:
            print(f"[FAILED] Health Check: Status {res.status_code}. Response: {res.text}")
    except Exception as e:
        print(f"[CRITICAL] Could not connect to backend at {BASE_URL}. Is uvicorn running?")
        return

    # 2. Check Customer History Route
    try:
        res = requests.get(f"{BASE_URL}/customer/history")
        if res.status_code == 401:
            print(f"[SUCCESS] Route Registered: /customer/history found (returned 401 Unauthorized as expected).")
        elif res.status_code == 404:
            print(f"[FAILED] Route Missing: /customer/history returned 404. Your server is out of sync!")
        else:
            print(f"[INFO] Route Status: {res.status_code}.")
    except Exception as e:
        print(f"[ERROR] Connection lost: {e}")

    # 3. Check Customer Bookings Route
    try:
        res = requests.get(f"{BASE_URL}/customer/bookings")
        if res.status_code == 401:
            print(f"[SUCCESS] Route Registered: /customer/bookings found.")
        elif res.status_code == 404:
            print(f"[FAILED] Route Missing: /customer/bookings returned 404.")
    except Exception as e:
        print(f"[ERROR] Connection lost: {e}")

    print("\n--- Recommendation ---")
    print("If you see [FAILED] or [CRITICAL], please RESTART your uvicorn server:")
    print("Command: uvicorn backend.main:app --reload")

if __name__ == "__main__":
    check_backend()
