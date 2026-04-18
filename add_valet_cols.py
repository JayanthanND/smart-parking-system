import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load variables from .env
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("Error: DATABASE_URL not found in .env")
    exit(1)

# Fix for Render/Postgres URL if needed
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)

def run_migration():
    print("--- 🚀 Force Adding Valet Columns to Neon DB ---")
    
    # SQL commands to add columns if they don't exist
    commands = [
        # Parking Land Columns
        "ALTER TABLE parking_lands ADD COLUMN IF NOT EXISTS has_valet BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE parking_lands ADD COLUMN IF NOT EXISTS valet_slots_total INTEGER DEFAULT 0;",
        "ALTER TABLE parking_lands ADD COLUMN IF NOT EXISTS valet_slots_available INTEGER DEFAULT 0;",
        
        # Booking Columns
        "ALTER TABLE bookings ADD COLUMN IF NOT EXISTS use_valet BOOLEAN DEFAULT FALSE;"
    ]

    with engine.connect() as conn:
        for cmd in commands:
            try:
                print(f"Executing: {cmd}")
                conn.execute(text(cmd))
                conn.commit()
            except Exception as e:
                print(f"Skipping or failed: {e}")
                
    print("\n✅ Migration Finished. The columns should now exist in Neon.")

if __name__ == "__main__":
    run_migration()
