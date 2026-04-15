from backend.database import engine
from sqlalchemy import text

def sync_eta_column():
    print("Adding estimated_arrival_at to bookings...")
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS estimated_arrival_at TIMESTAMP WITH TIME ZONE"))
            conn.commit()
            print("Success! column added.")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    sync_eta_column()
