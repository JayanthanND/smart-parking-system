from backend.database import engine
from sqlalchemy import text

def sync_schema():
    with engine.connect() as conn:
        print("Syncing 'users' table...")
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS active_nav_land_id INTEGER REFERENCES parking_lands(id)"))
            conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_nav_fullscreen BOOLEAN DEFAULT FALSE"))
            conn.commit()
            print("Users table synced.")
        except Exception as e:
            print(f"Error syncing users: {e}")

        print("Syncing 'bookings' table...")
        try:
            conn.execute(text("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS rating INTEGER"))
            conn.execute(text("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS review TEXT"))
            conn.execute(text("ALTER TABLE bookings ADD COLUMN IF NOT EXISTS verification_requested BOOLEAN DEFAULT FALSE"))
            conn.commit()
            print("Bookings table synced.")
        except Exception as e:
            print(f"Error syncing bookings: {e}")

if __name__ == '__main__':
    sync_schema()
