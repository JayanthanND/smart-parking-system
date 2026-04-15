from backend.database import engine
from sqlalchemy import text

def sync_vehicle_model_column():
    print("Adding vehicle_model to vehicles table...")
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vehicle_model VARCHAR"))
            conn.commit()
            print("Success! vehicle_model column added.")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    sync_vehicle_model_column()
