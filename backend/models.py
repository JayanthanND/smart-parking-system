from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, JSON, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from .database import Base

class UserRole(str, enum.Enum):
    OWNER = "OWNER"
    CUSTOMER = "CUSTOMER"

class BookingStatus(str, enum.Enum):
    RESERVED = "RESERVED"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.CUSTOMER)
    
    hands = relationship("ParkingLand", back_populates="owner")
    vehicles = relationship("Vehicle", back_populates="owner")
    bookings = relationship("Booking", back_populates="user")

class ParkingLand(Base):
    __tablename__ = "parking_lands"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String, nullable=False)
    address = Column(String)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    total_slots = Column(Integer, nullable=False)
    available_slots = Column(Integer, nullable=False)
    status = Column(String, default="OFFLINE") # ONLINE, OFFLINE, FULL
    vehicle_types = Column(JSON) # e.g., ["Car", "Bike"]
    price_per_hour = Column(Float, nullable=False)
    penalty_per_hour = Column(Float, nullable=False)
    grace_minutes = Column(Integer, default=15)
    boundaries = Column(JSON, nullable=True) # GeoJSON style or array of 4 objects
    
    
    owner = relationship("User", back_populates="hands")
    bookings = relationship("Booking", back_populates="land")

class Vehicle(Base):
    __tablename__ = "vehicles"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    vehicle_number = Column(String, unique=True, nullable=False)
    vehicle_type = Column(String, nullable=False)
    
    owner = relationship("User", back_populates="vehicles")
    bookings = relationship("Booking", back_populates="vehicle")

class Booking(Base):
    __tablename__ = "bookings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    land_id = Column(Integer, ForeignKey("parking_lands.id"))
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"))
    status = Column(Enum(BookingStatus), default=BookingStatus.RESERVED)
    intended_duration_hours = Column(Float, default=1.0)
    
    reserved_at = Column(DateTime(timezone=True), server_default=func.now())
    checked_in_at = Column(DateTime(timezone=True), nullable=True)
    checked_out_at = Column(DateTime(timezone=True), nullable=True)
    
    total_amount = Column(Float, default=0.0)
    penalty_amount = Column(Float, default=0.0)
    payment_status = Column(String, default="PENDING") # PENDING, PAID
    payment_method = Column(String, nullable=True) # ONLINE, CASH
    group_id = Column(String, nullable=True) # For grouping multiple vehicles together
    
    user = relationship("User", back_populates="bookings")
    land = relationship("ParkingLand", back_populates="bookings")
    vehicle = relationship("Vehicle", back_populates="bookings")

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    message = Column(String, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
