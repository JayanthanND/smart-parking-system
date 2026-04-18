from fastapi import FastAPI, Depends, HTTPException, status, Body
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import uuid
from typing import List, Optional, Any
from pydantic import BaseModel, EmailStr
from geopy.distance import geodesic
import random

from .database import get_db, engine
from .models import Base, User, UserRole, ParkingLand, Vehicle, Booking, BookingStatus, Notification, VahanSession
from .auth import verify_password, get_password_hash, create_access_token, decode_access_token
from fastapi.middleware.cors import CORSMiddleware
from .vahan_scraper import get_real_vehicle_details

# Initialize FastAPI
app = FastAPI(title="Smart Parking System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OAuth2 setup
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Pydantic Schemas
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: UserRole
    phone_no: str

class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: UserRole
    active_nav_land_id: Optional[int] = None
    is_nav_fullscreen: bool = False
    phone_no: Optional[str] = None
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class ParkingLandCreate(BaseModel):
    name: str
    address: str
    latitude: float
    longitude: float
    total_slots: int
    vehicle_types: List[str]
    price_per_hour: float
    penalty_per_hour: float
    grace_minutes: int = 15
    boundaries: Optional[Any] = None

class NavStateUpdate(BaseModel):
    active_nav_land_id: Optional[int] = None
    is_nav_fullscreen: bool = False

class ParkingLandOut(BaseModel):
    id: int
    name: str
    address: str
    latitude: float
    longitude: float
    boundaries: Optional[Any] = None
    total_slots: int
    available_slots: int
    status: str
    vehicle_types: List[str]
    price_per_hour: float
    penalty_per_hour: float
    grace_minutes: int
    avg_rating: Optional[float] = 0.0
    review_count: Optional[int] = 0
    image_url: Optional[str] = None
    owner_phone_no: Optional[str] = None
    class Config:
        from_attributes = True

class VehicleCreate(BaseModel):
    vehicle_number: str
    vehicle_type: str

class VehicleOut(BaseModel):
    id: int
    vehicle_number: str
    vehicle_type: str
    vehicle_model: Optional[str] = None
    image_url: Optional[str] = None
    class Config:
        from_attributes = True

class BookingOut(BaseModel):
    id: int
    land_id: int
    vehicle_id: Optional[int] = None
    status: BookingStatus
    reserved_at: datetime
    checked_in_at: Optional[datetime]
    checked_out_at: Optional[datetime]
    total_amount: float
    penalty_amount: float
    payment_status: str
    payment_method: Optional[str]
    group_id: Optional[str] = None
    rating: Optional[int] = None
    review: Optional[str] = None
    verification_requested: bool = False
    estimated_arrival_at: Optional[datetime] = None
    vehicle_model: Optional[str] = None
    vehicle_number: Optional[str] = None
    # Communication & Navigation fields
    land_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    owner_phone_no: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone_no: Optional[str] = None
    class Config:
        from_attributes = True

class ReviewIn(BaseModel):
    rating: int
    review: Optional[str] = None

class PublicReviewOut(BaseModel):
    id: int
    username: str
    rating: int
    review: Optional[str]
    created_at: datetime
    class Config:
        from_attributes = True

class VahanVerifyIn(BaseModel):
    vehicle_number: str

class VahanConfirmIn(BaseModel):
    session_id: str
    otp: str

class ETAUpdateIn(BaseModel):
    estimated_arrival_at: datetime

# Dependency to get current user
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    username: str = payload.get("sub")
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

# Auth Endpoints
@app.post("/register", response_model=UserOut)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.username == user_in.username).first():
        raise HTTPException(status_code=400, detail="Username already registered")
    if db.query(User).filter(User.email == user_in.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user_in.password)
    db_user = User(
        username=user_in.username,
        email=user_in.email,
        password_hash=hashed_password,
        role=user_in.role,
        phone_no=user_in.phone_no
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.post("/token", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@app.post("/customer/navigation-state")
def update_nav_state(state: NavStateUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=403, detail="Only customers can set navigation state")
    
    current_user.active_nav_land_id = state.active_nav_land_id
    current_user.is_nav_fullscreen = state.is_nav_fullscreen
    db.commit()
    return {"status": "updated"}

# Owner Dashboard Endpoints
@app.post("/owner/lands", response_model=ParkingLandOut)
def create_land(land_in: ParkingLandCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Only owners can create parking lands")
    
    db_land = ParkingLand(
        **land_in.dict(),
        owner_id=current_user.id,
        available_slots=land_in.total_slots,
        status="OFFLINE"
    )
    db.add(db_land)
    db.commit()
    db.refresh(db_land)
    return db_land

@app.get("/owner/lands", response_model=List[ParkingLandOut])
def get_owner_lands(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Only owners can view their parking lands")
    return db.query(ParkingLand).filter(ParkingLand.owner_id == current_user.id, ParkingLand.is_active == True).all()

@app.delete("/owner/lands/{land_id}")
def delete_land(land_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    land = db.query(ParkingLand).filter(ParkingLand.id == land_id).first()
    if not land or land.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Land not found or unauthorized")
    
    # Check for active bookings
    active_booking = db.query(Booking).filter(
        Booking.land_id == land_id,
        Booking.status.in_([BookingStatus.RESERVED, BookingStatus.ACTIVE])
    ).first()
    
    if active_booking:
        raise HTTPException(status_code=400, detail="Cannot delete a land area with active reservations or vehicles parked. Please clear the slots first.")
    
    # Soft Delete: Keep the land in DB but hide it from active lists
    land.is_active = False
    
    # Clear any active navigation targets for users navigating to this land
    affected_users = db.query(User).filter(User.active_nav_land_id == land_id).all()
    for u in affected_users:
        u.active_nav_land_id = None
        u.is_nav_fullscreen = False
    
    db.commit()
    return {"message": "Land area removed successfully"}

@app.patch("/owner/lands/{land_id}/status")
def update_land_status(land_id: int, status: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Only owners can update facility status")
    land = db.query(ParkingLand).filter(ParkingLand.id == land_id, ParkingLand.owner_id == current_user.id).first()
    if not land:
        raise HTTPException(status_code=404, detail="Land not found")
    land.status = status
    db.commit()
    return {"message": "Booking status updated"}

@app.put("/bookings/{booking_id}/eta")
def update_booking_eta(booking_id: int, eta_in: ETAUpdateIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Simple security: only the booking owner or the land owner can update ETA
    # (Though usually it's the customer's app updating it)
    if booking.user_id != current_user.id:
         # Check if current_user is the owner of the land
         land = db.query(ParkingLand).filter(ParkingLand.id == booking.land_id).first()
         if not land or land.owner_id != current_user.id:
             raise HTTPException(status_code=403, detail="Not authorized to update this ETA")

    booking.estimated_arrival_at = eta_in.estimated_arrival_at
    db.commit()
    return {"message": "ETA updated successfully"}

@app.get("/owner/bookings", response_model=List[BookingOut])
def list_owner_bookings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != UserRole.OWNER:
        raise HTTPException(status_code=403, detail="Only owners can view bookings")

    # Join with ParkingLand to get land details, filter by owner
    results = db.query(Booking, ParkingLand.name, ParkingLand.latitude, ParkingLand.longitude).join(
        ParkingLand, Booking.land_id == ParkingLand.id
    ).filter(ParkingLand.owner_id == current_user.id).order_by(Booking.id.desc()).all()

    output = []
    for booking, name, lat, lng in results:
        b_dict = {c.name: getattr(booking, c.name) for c in booking.__table__.columns}
        b_dict["land_name"] = name
        b_dict["latitude"] = lat
        b_dict["longitude"] = lng
        if booking.user:
            b_dict["customer_name"] = booking.user.username
            b_dict["customer_phone_no"] = booking.user.phone_no
            
        # Safe vehicle details: vehicle may be NULL if the vehicle was deleted
        if booking.vehicle:
            b_dict["vehicle_model"] = booking.vehicle.vehicle_model
            b_dict["vehicle_number"] = booking.vehicle.vehicle_number
        else:
            b_dict["vehicle_model"] = None
            b_dict["vehicle_number"] = None
        output.append(b_dict)
    return output



# Customer Endpoints
@app.post("/customer/vehicles", response_model=VehicleOut)
def add_vehicle(vehicle_in: VehicleCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=403, detail="Only customers can add vehicles")
    
    db_vehicle = Vehicle(**vehicle_in.dict(), user_id=current_user.id)
    db.add(db_vehicle)
    db.commit()
    db.refresh(db_vehicle)
    return db_vehicle

@app.get("/customer/vehicles", response_model=List[VehicleOut])
def get_customer_vehicles(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=403, detail="Only customers can view their vehicles")
    return db.query(Vehicle).filter(Vehicle.user_id == current_user.id).all()

@app.delete("/customer/vehicles/{vehicle_id}")
def delete_vehicle(vehicle_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    vehicle = db.query(Vehicle).filter(Vehicle.id == vehicle_id).first()
    if not vehicle or vehicle.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Vehicle not found or unauthorized")
    
    # Check for active/reserved bookings — ACTIVE is the correct enum value (not CHECKED_IN)
    active_booking = db.query(Booking).filter(
        Booking.vehicle_id == vehicle_id,
        Booking.status.in_([BookingStatus.RESERVED, BookingStatus.ACTIVE])
    ).first()
    
    if active_booking:
        raise HTTPException(status_code=400, detail="Cannot delete a vehicle with an active booking. Please cancel or complete it first.")
    
    # Nullify vehicle_id on historical (completed/cancelled) bookings to avoid FK constraint
    db.query(Booking).filter(
        Booking.vehicle_id == vehicle_id,
        Booking.status.in_([BookingStatus.COMPLETED, BookingStatus.CANCELLED])
    ).update({Booking.vehicle_id: None}, synchronize_session=False)
    
    db.delete(vehicle)
    db.commit()
    return {"message": "Vehicle deleted successfully"}


# Moved History and Bookings higher for better registration
@app.get("/customer/history", response_model=List[BookingOut])
def get_customer_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=403, detail="Only customers can view history")
    
    results = db.query(Booking, ParkingLand.name, ParkingLand.latitude, ParkingLand.longitude).join(
        ParkingLand, Booking.land_id == ParkingLand.id
    ).filter(
        Booking.user_id == current_user.id,
        Booking.status.in_([BookingStatus.COMPLETED, BookingStatus.CANCELLED])
    ).order_by(Booking.id.desc()).all()
    
    output = []
    for booking, name, lat, lng in results:
        b_dict = {c.name: getattr(booking, c.name) for c in booking.__table__.columns}
        b_dict["land_name"] = name
        b_dict["latitude"] = lat
        b_dict["longitude"] = lng
        output.append(b_dict)
    return output

@app.get("/search", response_model=List[ParkingLandOut])
def search_parking(
    lat: Optional[float] = None, 
    lng: Optional[float] = None, 
    radius: float = 5.0, 
    vehicle_type: Optional[str] = None,
    max_price: Optional[float] = None,
    required_slots: int = 1,
    db: Session = Depends(get_db)
):
    # Auto-expire reservations before search
    expire_reservations(db)
    
    query = db.query(ParkingLand).filter(ParkingLand.status == "ONLINE", ParkingLand.is_active == True)
    
    if max_price is not None:
        query = query.filter(ParkingLand.price_per_hour <= max_price)
    
    if required_slots > 1:
        query = query.filter(ParkingLand.available_slots >= required_slots)
    else:
        query = query.filter(ParkingLand.available_slots > 0)

    lands = query.all()
    
    # Fetch all ratings and owner phone numbers
    land_ids = [land.id for land in lands]
    rating_map = {}
    owner_phone_map = {}
    if land_ids:
        ratings = db.query(
            Booking.land_id,
            func.avg(Booking.rating).label('avg'),
            func.count(Booking.rating).label('count')
        ).filter(
            Booking.land_id.in_(land_ids), 
            Booking.rating.isnot(None)
        ).group_by(Booking.land_id).all()
        rating_map = {r.land_id: {"avg": float(r.avg), "count": int(r.count)} for r in ratings}
        
        # Get owner phones
        owners = db.query(User.id, User.phone_no).join(
            ParkingLand, User.id == ParkingLand.owner_id
        ).filter(ParkingLand.id.in_(land_ids)).all()
        owner_phone_map = {o.id: o.phone_no for o in owners}
    
    results = []
    for land in lands:
        # Distance Filter
        dist = None
        if lat is not None and lng is not None:
            dist = geodesic((lat, lng), (land.latitude, land.longitude)).km
            if dist > radius:
                continue
        
        # Vehicle Type Filter
        if vehicle_type and land.vehicle_types:
            # Check if requested type is in the allowed types (case-insensitive)
            allowed_types = [t.lower() for t in land.vehicle_types]
            if vehicle_type.lower() not in allowed_types:
                continue

        land_dict = {c.name: getattr(land, c.name) for c in land.__table__.columns}
        r_data = rating_map.get(land.id, {"avg": 0.0, "count": 0})
        land_dict["avg_rating"] = r_data["avg"]
        land_dict["review_count"] = r_data["count"]
        land_dict["owner_phone_no"] = owner_phone_map.get(land.owner_id)
        # Add distance for potential front-end sorting/display if needed
        land_dict["computedDistance"] = dist
        results.append(land_dict)
    
    return results


def expire_reservations(db: Session):
    expiry_time = datetime.utcnow() - timedelta(minutes=3)
    expired = db.query(Booking).filter(
        Booking.status == BookingStatus.RESERVED,
        Booking.reserved_at < expiry_time
    ).all()
    
    for booking in expired:
        booking.status = BookingStatus.CANCELLED
        # Release the slot
        land = db.query(ParkingLand).filter(ParkingLand.id == booking.land_id).first()
        if land:
            land.available_slots += 1
    db.commit()

@app.post("/bookings/reserve/{land_id}")
def reserve_slot(
    land_id: int, 
    vehicle_id: int, 
    intended_duration: float = 1.0,
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    if current_user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=403, detail="Only customers can book")
    
    land = db.query(ParkingLand).filter(ParkingLand.id == land_id).first()
    if not land or land.status != "ONLINE" or land.available_slots <= 0:
        raise HTTPException(status_code=400, detail="Parking not available")
    
    # Allow booking if their active booking is for a different vehicle
    active = db.query(Booking).filter(
        Booking.user_id == current_user.id,
        Booking.vehicle_id == vehicle_id,
        Booking.status.in_([BookingStatus.RESERVED, BookingStatus.ACTIVE])
    ).first()
    if active:
        raise HTTPException(status_code=400, detail="This vehicle is already parked/reserved")

    booking = Booking(
        user_id=current_user.id,
        land_id=land_id,
        vehicle_id=vehicle_id,
        status=BookingStatus.RESERVED,
        intended_duration_hours=intended_duration
    )
    land.available_slots -= 1
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking

class ReserveMultipleRequest(BaseModel):
    vehicle_ids: List[int]
    intended_duration: float = 1.0

@app.post("/bookings/reserve-multiple/{land_id}")
def reserve_multiple_slots(
    land_id: int, 
    req: ReserveMultipleRequest,
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    if current_user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=403, detail="Only customers can book")
    
    land = db.query(ParkingLand).filter(ParkingLand.id == land_id).first()
    if not land or land.status != "ONLINE" or land.available_slots < len(req.vehicle_ids):
        raise HTTPException(status_code=400, detail="Not enough available slots")
        
    created_bookings = []
    group_id = str(uuid.uuid4()) # Generate a unique group token
    for vid in req.vehicle_ids:
        # Check if specific vehicle is actively parked
        active = db.query(Booking).filter(
            Booking.user_id == current_user.id,
            Booking.vehicle_id == vid,
            Booking.status.in_([BookingStatus.RESERVED, BookingStatus.ACTIVE])
        ).first()
        if active:
            raise HTTPException(status_code=400, detail=f"Vehicle #{vid} is already active/reserved")

        b = Booking(
            user_id=current_user.id,
            land_id=land_id,
            vehicle_id=vid,
            status=BookingStatus.RESERVED,
            intended_duration_hours=req.intended_duration,
            group_id=group_id
        )
        db.add(b)
        created_bookings.append(b)
        
    land.available_slots -= len(req.vehicle_ids)
    db.commit()
    return [{
        "id": b.id, 
        "vehicle_id": b.vehicle_id, 
        "group_id": group_id,
        "land_name": land.name,
        "latitude": land.latitude,
        "longitude": land.longitude
    } for b in created_bookings]

@app.post("/bookings/{booking_id}/check-in")
def check_in(booking_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.id == booking_id, Booking.user_id == current_user.id).first()
    if not booking or booking.status != BookingStatus.RESERVED:
        raise HTTPException(status_code=400, detail="Invalid booking status for check-in")
    
    # In a real app, verify geo-radius here. For now, we assume user is there.
    # The requirement says owner must approve. So we change status to "PENDING_CHECK_IN" or similar?
    # Actually models.py doesn't have PENDING_CHECK_IN. I'll use a Notification for owner.
    
    booking.verification_requested = True
    notification = Notification(
        user_id=booking.land.owner_id,
        message=f"Check-in request for Booking #{booking.id} by {current_user.username}"
    )
    db.add(notification)
    db.commit()
    return {"message": "Check-in requested. Waiting for owner approval."}

@app.post("/owner/approve-check-in/{booking_id}")
def approve_check_in(booking_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking or booking.land.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Booking not found or unauthorized")
    
    booking.status = BookingStatus.ACTIVE
    booking.checked_in_at = func.now()
    
    notification = Notification(
        user_id=booking.user_id,
        message=f"Access Granted! Your check-in at {booking.land.name} has been authorized."
    )
    db.add(notification)
    db.commit()
    return {"message": "User checked in successfully"}

@app.post("/bookings/{booking_id}/checkout")
def checkout(booking_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.id == booking_id, Booking.user_id == current_user.id).first()
    if not booking or booking.status != BookingStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Booking is not active")
    
    now = datetime.utcnow()
    booking.checked_out_at = now
    
    # Calculate fee
    duration_delta = now - booking.checked_in_at.replace(tzinfo=None)
    actual_hours = duration_delta.total_seconds() / 3600
    
    base_fee = actual_hours * booking.land.price_per_hour
    
    # Penalty calculation
    penalty = 0.0
    exceeded_hours = actual_hours - booking.intended_duration_hours
    if exceeded_hours > (booking.land.grace_minutes / 60.0):
        penalty = exceeded_hours * booking.land.penalty_per_hour
    
    booking.total_amount = base_fee + penalty
    booking.penalty_amount = penalty
    db.commit()
    return {"total_amount": booking.total_amount, "penalty": penalty}

@app.post("/bookings/{booking_id}/pay")
def pay(booking_id: int, method: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not booking_id or not isinstance(booking_id, int):
        raise HTTPException(status_code=400, detail="Invalid Booking ID")
        
    booking = db.query(Booking).filter(Booking.id == booking_id, Booking.user_id == current_user.id).first()
    if not booking:
        # Check if it exists at all to differentiate between Not Found and Unauthorized
        exists = db.query(Booking).filter(Booking.id == booking_id).first()
        if exists:
            raise HTTPException(status_code=403, detail="Unauthorized access to this booking")
        raise HTTPException(status_code=404, detail="Booking record not found in system")
    
    booking.payment_method = method
    if method == "ONLINE":
        booking.payment_status = "PAID"
        booking.status = BookingStatus.COMPLETED
        booking.land.available_slots += 1
    else:
        # Cash needs owner confirmation
        notification = Notification(
            user_id=booking.land.owner_id,
            message=f"Cash payment pending for Booking #{booking.id}"
        )
        db.add(notification)
    
    db.commit()
    return {"message": "Payment processed" if method == "ONLINE" else "Waiting for owner cash confirmation"}

@app.post("/owner/confirm-payment/{booking_id}")
def confirm_payment(booking_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking or booking.land.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Booking not found or unauthorized")
    
    booking.payment_status = "PAID"
    booking.status = BookingStatus.COMPLETED
    booking.land.available_slots += 1
    
    notification = Notification(
        user_id=booking.user_id,
        message=f"Payment Verified! Your transaction for {booking.land.name} has been processed. Safe travels!"
    )
    db.add(notification)
    db.commit()
    return {"message": "Payment confirmed and slot released"}

@app.get("/customer/bookings", response_model=List[BookingOut])
def list_customer_bookings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != UserRole.CUSTOMER:
        raise HTTPException(status_code=403, detail="Only customers can view their bookings")
    
    results = db.query(Booking, ParkingLand.name, ParkingLand.latitude, ParkingLand.longitude, User.phone_no).join(
        ParkingLand, Booking.land_id == ParkingLand.id
    ).join(
        User, User.id == ParkingLand.owner_id
    ).filter(Booking.user_id == current_user.id).order_by(Booking.id.desc()).all()
    
    output = []
    for booking, name, lat, lng, owner_phone_no in results:
        b_dict = {c.name: getattr(booking, c.name) for c in booking.__table__.columns}
        b_dict["land_name"] = name
        b_dict["latitude"] = lat
        b_dict["longitude"] = lng
        b_dict["owner_phone_no"] = owner_phone_no
        output.append(b_dict)
    return output

@app.post("/bookings/{booking_id}/review")
def review_booking(booking_id: int, review_in: ReviewIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not booking_id or not isinstance(booking_id, int):
        raise HTTPException(status_code=400, detail="Invalid Booking ID for review")

    booking = db.query(Booking).filter(Booking.id == booking_id, Booking.user_id == current_user.id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found for review")
        
    if booking.status != BookingStatus.COMPLETED and not booking.checked_out_at:
        raise HTTPException(status_code=400, detail="Booking must be checked out to review")
    
    booking.rating = review_in.rating
    booking.review = review_in.review
    db.commit()
    return {"message": "Review submitted successfully"}

@app.get("/lands/{land_id}/reviews", response_model=List[PublicReviewOut])
def get_land_reviews(land_id: int, db: Session = Depends(get_db)):
    results = db.query(Booking, User.username).join(User, Booking.user_id == User.id).filter(
        Booking.land_id == land_id,
        Booking.rating.isnot(None)
    ).order_by(Booking.id.desc()).all()
    
    output = []
    for booking, username in results:
        output.append({
            "id": booking.id,
            "username": username,
            "rating": booking.rating,
            "review": booking.review,
            "created_at": booking.checked_out_at or booking.reserved_at
        })
    return output

@app.post("/owner/reject-reservation/{booking_id}")
def reject_reservation(booking_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking or booking.land.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Booking not found or unauthorized")
    
    if booking.status != BookingStatus.RESERVED:
        raise HTTPException(status_code=400, detail="Only pending reservations can be rejected")
    
    booking.status = BookingStatus.CANCELLED
    booking.land.available_slots += 1
    
    # Clear user navigation if they were heading to this rejected land
    user = db.query(User).filter(User.id == booking.user_id).first()
    if user and user.active_nav_land_id == booking.land_id:
        user.active_nav_land_id = None
        user.is_nav_fullscreen = False

    notification = Notification(
        user_id=booking.user_id,
        message=f"Your reservation for {booking.land.name} was rejected/cancelled by the owner."
    )
    db.add(notification)
    db.commit()
    db.refresh(booking.land)
    return {"message": "Reservation rejected successfully", "new_available": booking.land.available_slots}

# --- VAHAN AUTO-SCRAPE ENGINE (NO OTP) ---

@app.post("/vahan/verify-and-add")
def verify_and_add_vahan(verify_in: VahanVerifyIn, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # 1. Check if vehicle already exists for this user to avoid duplicates
    existing = db.query(Vehicle).filter(Vehicle.vehicle_number == verify_in.vehicle_number, Vehicle.user_id == current_user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Vehicle already in your fleet")

    # 2. Scrape REAL details from CarInfo
    details = get_real_vehicle_details(verify_in.vehicle_number)
    
    if details is None:
        # Fallback if scraper fails completely (site down or blocked)
        details = {"error": "SCRAPE_FAILED"}

    if details.get("error") == "INVALID":
        raise HTTPException(status_code=400, detail="Invalid vehicle number. Not found on portal.")
    
    if "error" in details:
        # Stop using fallback data to keep dashboard clean
        raise HTTPException(
            status_code=503, 
            detail="Vehicle Registry is currently busy. Please try again in 30 seconds."
        )

    # 3. Create and save vehicle
    new_v = Vehicle(
        user_id=current_user.id,
        vehicle_number=verify_in.vehicle_number,
        vehicle_type=details.get("vehicle_type", "Car"),
        vehicle_model=details.get("model")
    )
    db.add(new_v)
    
    notif = Notification(
        user_id=current_user.id,
        message=f"Success! {verify_in.vehicle_number} ({details.get('model')}) has been added to your dashboard."
    )
    db.add(notif)
    db.commit()
    db.refresh(new_v)
    
    return {
        "message": "Vehicle added successfully",
        "vehicle": {
            "id": new_v.id,
            "number": new_v.vehicle_number,
            "type": new_v.vehicle_type,
            "model": details.get("model")
        }
    }

@app.get("/notifications")
def get_notifications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Notification).filter(Notification.user_id == current_user.id, Notification.is_read == False).all()
