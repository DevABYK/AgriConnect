from datetime import datetime
from app import db, login_manager
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    phone_number = db.Column(db.String(20))
    user_type = db.Column(db.String(20), nullable=False)  # 'farmer', 'buyer', or 'admin'
    is_admin = db.Column(db.Boolean, default=False)
    admin_permissions = db.Column(db.String(500))  # JSON string of permissions
    location = db.Column(db.String(200))
    county = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    rating = db.Column(db.Float, default=0.0)
    total_ratings = db.Column(db.Integer, default=0)
    
    # Relationships
    crops = db.relationship('Crop', backref='farmer', lazy=True, foreign_keys='Crop.farmer_id')
    orders_as_buyer = db.relationship('Order', backref='buyer', lazy=True, foreign_keys='Order.buyer_id')
    orders_as_farmer = db.relationship('Order', backref='farmer', lazy=True, foreign_keys='Order.farmer_id')
    sent_messages = db.relationship('Message', backref='sender', lazy=True, foreign_keys='Message.sender_id')
    received_messages = db.relationship('Message', backref='receiver', lazy=True, foreign_keys='Message.receiver_id')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Crop(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    farmer_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(50), nullable=False)
    quantity = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(20), nullable=False)  # kg, tons, pieces, etc.
    price_per_unit = db.Column(db.Float, nullable=False)
    description = db.Column(db.Text)
    harvest_date = db.Column(db.Date)
    expiry_date = db.Column(db.Date)
    location = db.Column(db.String(200))
    county = db.Column(db.String(100))
    image_filename = db.Column(db.String(200))
    status = db.Column(db.String(20), default='available')  # available, sold, expired
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    quality_grade = db.Column(db.String(10), default='A')  # A, B, C
    
    # Relationships
    orders = db.relationship('Order', backref='crop', lazy=True)

class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    buyer_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    farmer_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    crop_id = db.Column(db.Integer, db.ForeignKey('crop.id'), nullable=False)
    quantity = db.Column(db.Float, nullable=False)
    total_amount = db.Column(db.Float, nullable=False)
    status = db.Column(db.String(20), default='pending')  # pending, accepted, rejected, delivered, paid
    delivery_address = db.Column(db.String(300))
    delivery_date = db.Column(db.Date)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    notes = db.Column(db.Text)
    
    # Relationships
    transaction = db.relationship('Transaction', backref='order', uselist=False)
    messages = db.relationship('Message', backref='order', lazy=True)

class Transaction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey('order.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    transaction_fee = db.Column(db.Float, nullable=False)  # 2% fee
    payment_method = db.Column(db.String(50), nullable=False)  # mpesa, bank, etc.
    transaction_id = db.Column(db.String(100), unique=True)
    status = db.Column(db.String(20), default='pending')  # pending, completed, failed, refunded
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    escrow_released = db.Column(db.Boolean, default=False)

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    receiver_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    order_id = db.Column(db.Integer, db.ForeignKey('order.id'))
    content = db.Column(db.Text, nullable=False)
    message_type = db.Column(db.String(20), default='text')  # text, system, delivery_update
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    read_at = db.Column(db.DateTime)
    
class MarketPrice(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    crop_name = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(100), nullable=False)
    average_price = db.Column(db.Float, nullable=False)
    date = db.Column(db.Date, nullable=False)
    source = db.Column(db.String(50))  # market, platform, government
    
class Location(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    county = db.Column(db.String(100), nullable=False)
    sub_county = db.Column(db.String(100))
    market_name = db.Column(db.String(100))
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
