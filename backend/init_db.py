from .database import engine, Base
from .models import User, ParkingLand, Vehicle, Booking, Notification

def init_db():
    print("Initializing database tables...")
    Base.metadata.create_all(bind=engine)
    print("Done.")

if __name__ == "__main__":
    init_db()
