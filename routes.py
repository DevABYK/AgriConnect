import os
import uuid
from datetime import datetime, date
from flask import render_template, request, jsonify, redirect, url_for, flash, current_app
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash
from app import app, db
from models import User, Crop, Order, Transaction, Message, MarketPrice, Location
from utils import allowed_file, calculate_distance, get_market_prices
from send_message import send_twilio_message
import logging

@app.route('/')
def index():
    recent_crops = Crop.query.filter_by(status='available').order_by(Crop.created_at.desc()).limit(6).all()
    return render_template('index.html', recent_crops=recent_crops)

def init_admin_user():
    """Initialize admin user if none exists"""
    admin = User.query.filter_by(user_type='admin').first()
    if not admin:
        admin_user = User(
            username='admin',
            email='admin@agrimarket.com',
            user_type='admin',
            is_admin=True,
            admin_permissions='["manage_users", "manage_content", "view_analytics"]',
            phone_number='',
            location='System',
            county='System'
        )
        admin_user.set_password('admin123')  # Should be changed on first login
        db.session.add(admin_user)
        db.session.commit()
        logging.info('Admin user created with username: admin, password: admin123')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        data = request.get_json() if request.is_json else request.form
        
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        user_type = data.get('user_type')
        phone_number = data.get('phone_number')
        location = data.get('location')
        county = data.get('county')
        
        # Validation
        if User.query.filter_by(username=username).first():
            if request.is_json:
                return jsonify({'success': False, 'message': 'Username already exists'})
            flash('Username already exists')
            return render_template('register.html')
        
        if User.query.filter_by(email=email).first():
            if request.is_json:
                return jsonify({'success': False, 'message': 'Email already registered'})
            flash('Email already registered')
            return render_template('register.html')
        
        user = User(
            username=username,
            email=email,
            user_type=user_type,
            phone_number=phone_number,
            location=location,
            county=county
        )
        user.set_password(password)
        
        db.session.add(user)
        db.session.commit()
        
        login_user(user)
        
        if request.is_json:
            return jsonify({'success': True, 'redirect': url_for('farmer_dashboard' if user_type == 'farmer' else 'buyer_dashboard')})
        
        if user_type == 'farmer':
            return redirect(url_for('farmer_dashboard'))
        elif user_type == 'buyer':
            return redirect(url_for('buyer_dashboard'))
        elif user_type == 'admin':
            return redirect(url_for('admin_dashboard'))
        else:
            return redirect(url_for('index'))
    
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        data = request.get_json() if request.is_json else request.form
        
        username = data.get('username')
        password = data.get('password')
        
        user = User.query.filter_by(username=username).first()
        
        if user and user.check_password(password):
            login_user(user)
            if request.is_json:
                return jsonify({'success': True, 'redirect': url_for('farmer_dashboard' if user.user_type == 'farmer' else 'buyer_dashboard')})
            if user.user_type == 'farmer':
                return redirect(url_for('farmer_dashboard'))
            elif user.user_type == 'buyer':
                return redirect(url_for('buyer_dashboard'))
            elif user.user_type == 'admin':
                return redirect(url_for('admin_dashboard'))
            else:
                return redirect(url_for('index'))
        
        if request.is_json:
            return jsonify({'success': False, 'message': 'Invalid username or password'})
        flash('Invalid username or password')
    
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

@app.route('/admin/dashboard')
@login_required
def admin_dashboard():
    if not current_user.is_admin:
        flash('Admin access required')
        return redirect(url_for('index'))
    
    # Admin stats and controls
    total_users = User.query.count()
    total_farmers = User.query.filter_by(user_type='farmer').count()
    total_buyers = User.query.filter_by(user_type='buyer').count()
    total_crops = Crop.query.count()
    total_orders = Order.query.count()
    recent_users = User.query.order_by(User.created_at.desc()).limit(10).all()
    
    return render_template('admin_dashboard.html', 
                         total_users=total_users, total_farmers=total_farmers,
                         total_buyers=total_buyers, total_crops=total_crops,
                         total_orders=total_orders, recent_users=recent_users)

@app.route('/farmer/dashboard')
@login_required
def farmer_dashboard():
    if current_user.user_type != 'farmer':
        flash('Access denied')
        return redirect(url_for('index'))
    
    crops = Crop.query.filter_by(farmer_id=current_user.id).order_by(Crop.created_at.desc()).all()
    orders = Order.query.filter_by(farmer_id=current_user.id).order_by(Order.created_at.desc()).limit(10).all()
    
    return render_template('farmer_dashboard.html', crops=crops, orders=orders)

@app.route('/buyer/dashboard')
@login_required
def buyer_dashboard():
    if current_user.user_type != 'buyer':
        flash('Access denied')
        return redirect(url_for('index'))
    
    # Get available crops with location-based sorting
    crops = Crop.query.filter_by(status='available').all()
    orders = Order.query.filter_by(buyer_id=current_user.id).order_by(Order.created_at.desc()).limit(10).all()
    
    return render_template('buyer_dashboard.html', crops=crops, orders=orders)

@app.route('/api/crops', methods=['GET', 'POST'])
@login_required
def handle_crops():
    if request.method == 'POST':
        if current_user.user_type != 'farmer':
            return jsonify({'success': False, 'message': 'Only farmers can add crops'})
        
        data = request.form
        file = request.files.get('image')
        
        filename = None
        if file and file.filename and allowed_file(file.filename):
            filename = secure_filename(str(uuid.uuid4()) + '_' + file.filename)
            file.save(os.path.join(current_app.config['UPLOAD_FOLDER'], filename))
        
        crop = Crop(
            farmer_id=current_user.id,
            name=data.get('name'),
            category=data.get('category'),
            quantity=float(data.get('quantity') or 0),
            unit=data.get('unit'),
            price_per_unit=float(data.get('price_per_unit') or 0),
            description=data.get('description'),
            harvest_date=datetime.strptime(data.get('harvest_date'), '%Y-%m-%d').date() if data.get('harvest_date') else None,
            expiry_date=datetime.strptime(data.get('expiry_date'), '%Y-%m-%d').date() if data.get('expiry_date') else None,
            location=data.get('location') or current_user.location,
            county=data.get('county') or current_user.county,
            image_filename=filename,
            quality_grade=data.get('quality_grade', 'A')
        )
        
        db.session.add(crop)
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Crop added successfully'})
    
    # GET request - search and filter crops
    crops_query = Crop.query.filter_by(status='available')
    
    # Apply filters
    category = request.args.get('category')
    county = request.args.get('county')
    max_price = request.args.get('max_price')
    search = request.args.get('search')
    
    if category:
        crops_query = crops_query.filter(Crop.category == category)
    if county:
        crops_query = crops_query.filter(Crop.county == county)
    if max_price:
        crops_query = crops_query.filter(Crop.price_per_unit <= float(max_price))
    if search:
        crops_query = crops_query.filter(Crop.name.contains(search))
    
    crops = crops_query.order_by(Crop.created_at.desc()).all()
    
    return jsonify({
        'crops': [{
            'id': crop.id,
            'farmer_id': crop.farmer_id,
            'name': crop.name,
            'category': crop.category,
            'quantity': crop.quantity,
            'unit': crop.unit,
            'price_per_unit': crop.price_per_unit,
            'location': crop.location,
            'county': crop.county,
            'farmer_name': crop.farmer.username,
            'farmer_rating': crop.farmer.rating,
            'image_filename': crop.image_filename,
            'harvest_date': crop.harvest_date.isoformat() if crop.harvest_date else None,
            'quality_grade': crop.quality_grade
        } for crop in crops]
    })

@app.route('/api/orders', methods=['GET', 'POST'])
@login_required
def handle_orders():
    if request.method == 'POST':
        if current_user.user_type != 'buyer':
            return jsonify({'success': False, 'message': 'Only buyers can place orders'})
        
        data = request.get_json()
        crop_id = data.get('crop_id')
        quantity = float(data.get('quantity'))
        delivery_address = data.get('delivery_address')
        delivery_date = datetime.strptime(data.get('delivery_date'), '%Y-%m-%d').date() if data.get('delivery_date') else None
        notes = data.get('notes', '')
        
        crop = Crop.query.get(crop_id)
        if not crop or crop.status != 'available':
            return jsonify({'success': False, 'message': 'Crop not available'})
        
        if quantity > crop.quantity:
            return jsonify({'success': False, 'message': 'Insufficient quantity available'})
        
        total_amount = quantity * crop.price_per_unit
        
        order = Order(
            buyer_id=current_user.id,
            farmer_id=crop.farmer_id,
            crop_id=crop_id,
            quantity=quantity,
            total_amount=total_amount,
            delivery_address=delivery_address,
            delivery_date=delivery_date,
            notes=notes
        )
        
        db.session.add(order)
        db.session.commit()
        
        # Send SMS notification to farmer
        try:
            if crop.farmer.phone_number:
                message = f"New order from {current_user.username} for {quantity} {crop.unit} of {crop.name}. Total: KSh {total_amount:.2f}"
                send_twilio_message(crop.farmer.phone_number, message)
        except Exception as e:
            logging.error(f"Failed to send SMS: {e}")
        
        return jsonify({'success': True, 'order_id': order.id, 'message': 'Order placed successfully'})
    
    # GET request - get user's orders
    if current_user.user_type == 'farmer':
        orders = Order.query.filter_by(farmer_id=current_user.id).order_by(Order.created_at.desc()).all()
    else:
        orders = Order.query.filter_by(buyer_id=current_user.id).order_by(Order.created_at.desc()).all()
    
    return jsonify({
        'orders': [{
            'id': order.id,
            'crop_name': order.crop.name,
            'quantity': order.quantity,
            'total_amount': order.total_amount,
            'status': order.status,
            'buyer_name': order.buyer.username,
            'farmer_name': order.farmer.username,
            'delivery_date': order.delivery_date.isoformat() if order.delivery_date else None,
            'created_at': order.created_at.isoformat()
        } for order in orders]
    })

@app.route('/api/orders/<int:order_id>/status', methods=['PUT'])
@login_required
def update_order_status(order_id):
    order = Order.query.get_or_404(order_id)
    
    # Only farmer can update order status initially, buyer can confirm delivery
    if current_user.user_type == 'farmer' and order.farmer_id != current_user.id:
        return jsonify({'success': False, 'message': 'Access denied'})
    if current_user.user_type == 'buyer' and order.buyer_id != current_user.id:
        return jsonify({'success': False, 'message': 'Access denied'})
    
    data = request.get_json()
    new_status = data.get('status')
    
    valid_statuses = ['pending', 'accepted', 'rejected', 'delivered', 'paid']
    if new_status not in valid_statuses:
        return jsonify({'success': False, 'message': 'Invalid status'})
    
    order.status = new_status
    order.updated_at = datetime.utcnow()
    
    # Update crop quantity if order is accepted
    if new_status == 'accepted':
        crop = order.crop
        crop.quantity -= order.quantity
        if crop.quantity <= 0:
            crop.status = 'sold'
    
    db.session.commit()
    
    # Send SMS notification
    try:
        if new_status == 'accepted' and order.buyer.phone_number:
            message = f"Your order for {order.crop.name} has been accepted by {order.farmer.username}."
            send_twilio_message(order.buyer.phone_number, message)
        elif new_status == 'delivered' and order.buyer.phone_number:
            message = f"Your order for {order.crop.name} has been delivered. Please confirm receipt."
            send_twilio_message(order.buyer.phone_number, message)
    except Exception as e:
        logging.error(f"Failed to send SMS: {e}")
    
    return jsonify({'success': True, 'message': 'Order status updated successfully'})

@app.route('/conversation/<int:partner_id>')
@login_required
def view_conversation(partner_id):
    """Direct route to view a conversation with a specific user."""
    partner = User.query.get_or_404(partner_id)

    # Allow access if the current user is part of the conversation.
    # This check is implicitly handled by the message query, but an explicit check is good practice.
    if current_user.id == partner_id:
        flash("You cannot start a conversation with yourself.")
        return redirect(url_for('index'))
    
    # Get existing conversation
    messages = Message.query.filter(
        ((Message.sender_id == current_user.id) & (Message.receiver_id == partner_id)) |
        ((Message.sender_id == partner_id) & (Message.receiver_id == current_user.id))
    ).order_by(Message.created_at.asc()).all()
    
    return render_template('chat.html', partner=partner, messages=messages)

@app.route('/contact-admin')
@login_required
def contact_admin():
    """Route to contact admin team"""
    # Get all admin users
    admins = User.query.filter_by(user_type='admin').all()
    if not admins:
        flash('No admin available')
        return redirect(url_for('index'))
    
    # For simplicity, contact the first admin
    admin = admins[0]
    
    # Get existing conversation with admin
    messages = Message.query.filter(
        ((Message.sender_id == current_user.id) & (Message.receiver_id == admin.id)) |
        ((Message.sender_id == admin.id) & (Message.receiver_id == current_user.id))
    ).order_by(Message.created_at.asc()).all()
    
    return render_template('chat.html', partner=admin, messages=messages, is_admin=True)

@app.route('/api/messages', methods=['GET', 'POST'])
@login_required
def handle_messages():
    if request.method == 'POST':
        data = request.get_json()
        receiver_id = data.get('receiver_id')
        order_id = data.get('order_id')
        content = data.get('content')
        
        if not receiver_id or not content:
            return jsonify({'success': False, 'message': 'Missing required fields'})
        
        message = Message(
            sender_id=current_user.id,
            receiver_id=receiver_id,
            order_id=order_id,
            content=content
        )
        
        db.session.add(message)
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Message sent successfully'})
    
    # GET request - get conversations with improved threading
    user_id = request.args.get('user_id')
    if user_id:
        # Get conversation with specific user
        messages = Message.query.filter(
            ((Message.sender_id == current_user.id) & (Message.receiver_id == user_id)) |
            ((Message.sender_id == user_id) & (Message.receiver_id == current_user.id))
        ).order_by(Message.created_at.asc()).all()
        
        # Mark messages as read
        unread_messages = Message.query.filter(
            (Message.sender_id == user_id) & 
            (Message.receiver_id == current_user.id) & 
            (Message.read_at.is_(None))
        ).all()
        for msg in unread_messages:
            msg.read_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'messages': [{
                'id': msg.id,
                'sender_id': msg.sender_id,
                'sender_name': msg.sender.username,
                'content': msg.content,
                'created_at': msg.created_at.isoformat(),
                'is_mine': msg.sender_id == current_user.id,
                'read_at': msg.read_at.isoformat() if msg.read_at else None
            } for msg in messages]
        })
    else:
        # Get conversation list with improved logic
        # Only show conversations where:
        # - Farmers can see conversations with buyers who contacted them
        # - Buyers can see their initiated conversations
        # - Admins can see all conversations
        
        if current_user.user_type == 'farmer':
            # Farmers see conversations with buyers who contacted them
            conversations = db.session.query(Message).filter(
                (Message.receiver_id == current_user.id) & 
                (Message.sender.has(User.user_type.in_(['buyer', 'admin'])))
            ).order_by(Message.created_at.desc()).all()
        elif current_user.user_type == 'buyer':
            # Buyers see their initiated conversations
            conversations = db.session.query(Message).filter(
                ((Message.sender_id == current_user.id) & (Message.receiver.has(User.user_type.in_(['farmer', 'admin'])))) |
                ((Message.receiver_id == current_user.id) & (Message.sender.has(User.user_type.in_(['farmer', 'admin']))))
            ).order_by(Message.created_at.desc()).all()
        else:  # admin
            # Admins see all conversations
            conversations = db.session.query(Message).filter(
                (Message.sender_id == current_user.id) | (Message.receiver_id == current_user.id)
            ).order_by(Message.created_at.desc()).all()
        
        # Group by conversation partner
        conv_dict = {}
        for msg in conversations:
            partner_id = msg.receiver_id if msg.sender_id == current_user.id else msg.sender_id
            if partner_id not in conv_dict:
                partner = User.query.get(partner_id)
                if partner:
                    # Count unread messages
                    unread_count = Message.query.filter(
                        (Message.sender_id == partner_id) & 
                        (Message.receiver_id == current_user.id) & 
                        (Message.read_at.is_(None))
                    ).count()
                    
                    conv_dict[partner_id] = {
                        'partner_id': partner_id,
                        'partner_name': partner.username,
                        'partner_type': partner.user_type,
                        'last_message': msg.content,
                        'last_message_time': msg.created_at.isoformat(),
                        'unread_count': unread_count,
                        'last_sender_name': msg.sender.username
                    }
        
        return jsonify({'conversations': list(conv_dict.values())})

@app.route('/api/market-prices')
def get_market_prices_api():
    crop_name = request.args.get('crop_name')
    location = request.args.get('location')
    
    prices = get_market_prices(crop_name, location)
    return jsonify({'prices': prices})

@app.route('/crop/<int:crop_id>')
def crop_details(crop_id):
    crop = Crop.query.get_or_404(crop_id)
    return render_template('crop_details.html', crop=crop)

@app.route('/api/crops/<int:crop_id>')
@login_required
def get_crop_details(crop_id):
    """API endpoint to get crop details"""
    crop = Crop.query.get(crop_id)
    if not crop:
        return jsonify({'error': 'Crop not found'}), 404
    
    return jsonify({
        'id': crop.id,
        'name': crop.name,
        'category': crop.category,
        'price_per_unit': float(crop.price_per_unit),
        'unit': crop.unit,
        'quantity': float(crop.quantity),
        'location': crop.location,
        'county': crop.county,
        'description': crop.description,
        'status': crop.status,
        'farmer_id': crop.farmer_id,
        'farmer_name': crop.farmer.username,
        'harvest_date': crop.harvest_date.isoformat() if crop.harvest_date else None,
        'image_filename': crop.image_filename
    })

@app.route('/orders')
@login_required
def orders():
    return render_template('orders.html')

@app.route('/messages')
@login_required
def messages():
    return render_template('messages.html')

@app.route('/api/locations')
def get_locations():
    counties = db.session.query(Location.county).distinct().all()
    return jsonify({'counties': [county[0] for county in counties]})

@app.route('/api/payment/initiate', methods=['POST'])
@login_required
def initiate_payment():
    data = request.get_json()
    order_id = data.get('order_id')
    payment_method = data.get('payment_method', 'mpesa')
    
    order = Order.query.get_or_404(order_id)
    
    if order.buyer_id != current_user.id:
        return jsonify({'success': False, 'message': 'Access denied'})
    
    # Calculate transaction fee (2%)
    transaction_fee = order.total_amount * 0.02
    total_with_fee = order.total_amount + transaction_fee
    
    # Create transaction record
    transaction = Transaction(
        order_id=order_id,
        amount=order.total_amount,
        transaction_fee=transaction_fee,
        payment_method=payment_method,
        transaction_id=str(uuid.uuid4())
    )
    
    db.session.add(transaction)
    db.session.commit()
    
    # TODO: Integrate with actual payment gateway (M-Pesa, etc.)
    # For now, simulate successful payment
    transaction.status = 'completed'
    transaction.completed_at = datetime.utcnow()
    order.status = 'paid'
    
    db.session.commit()
    
    return jsonify({
        'success': True,
        'transaction_id': transaction.transaction_id,
        'total_amount': total_with_fee,
        'message': 'Payment processed successfully'
    })

@app.route('/admin/users', methods=['GET', 'POST', 'DELETE'])
@login_required
def admin_manage_users():
    if not current_user.is_admin:
        return jsonify({'success': False, 'message': 'Admin access required'}), 403
    
    if request.method == 'GET':
        users = User.query.all()
        return jsonify({
            'users': [{
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'user_type': user.user_type,
                'is_admin': user.is_admin,
                'created_at': user.created_at.isoformat(),
                'rating': user.rating
            } for user in users]
        })
    
    elif request.method == 'POST':
        # Create new admin
        data = request.get_json()
        username = data.get('username')
        email = data.get('email')
        password = data.get('password', 'admin123')
        
        if User.query.filter_by(username=username).first():
            return jsonify({'success': False, 'message': 'Username already exists'})
        
        new_admin = User(
            username=username,
            email=email,
            user_type='admin',
            is_admin=True,
            admin_permissions='["manage_users", "manage_content"]'
        )
        new_admin.set_password(password)
        db.session.add(new_admin)
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Admin user created successfully'})
    
    elif request.method == 'DELETE':
        # Remove admin privileges
        user_id = request.args.get('user_id')
        user = User.query.get_or_404(user_id)
        
        if user.id == current_user.id:
            return jsonify({'success': False, 'message': 'Cannot remove your own admin privileges'})
        
        user.is_admin = False
        user.admin_permissions = None
        if user.user_type == 'admin':
            user.user_type = 'buyer'  # Default to buyer
        
        db.session.commit()
        return jsonify({'success': True, 'message': 'Admin privileges removed'})

@app.route('/api/crops/<int:crop_id>/contact-farmer')
@login_required
def get_crop_farmer_contact(crop_id):
    """API endpoint to get farmer contact info for a crop"""
    crop = Crop.query.get_or_404(crop_id)
    return jsonify({
        'farmer_id': crop.farmer_id,
        'farmer_name': crop.farmer.username,
        'contact_url': url_for('view_conversation', partner_id=crop.farmer_id)
    })

@app.errorhandler(404)
def not_found(error):
    return '<h1>404 - Page Not Found</h1><p>The page you are looking for does not exist.</p>', 404

@app.errorhandler(500)
def internal_error(error):
    return '<h1>500 - Internal Server Error</h1><p>Something went wrong on our end.</p>', 500
