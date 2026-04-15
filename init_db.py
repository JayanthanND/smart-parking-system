from backend.database import engine, Base
from backend.models import *

def init():
    print("--- Sparkit Neon DB Initializer ---")
    print(f"Targeting Database URL: {engine.url.render_as_string(hide_password=True)}")
    
    try:
        # We don't drop_all because we don't want to accidentally wipe production data
        # but create_all will add any MISSING tables (like notifications).
        # Note: it WON'T add missing columns to existing tables.
        print("Syncing tables...")
        Base.metadata.create_all(bind=engine)
        print("Success! Schema is now up to date on Neon.")
    except Exception as e:
        print(f"FAILED to initialize database: {e}")

if __name__ == "__main__":
    init()
