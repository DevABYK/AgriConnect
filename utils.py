import math
from datetime import datetime, date
from models import MarketPrice

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def allowed_file(filename):
    """Check if uploaded file has allowed extension"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two coordinates using Haversine formula"""
    if not all([lat1, lon1, lat2, lon2]):
        return float('inf')
    
    # Convert latitude and longitude to radians
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    
    # Haversine formula
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    # Radius of earth in kilometers
    r = 6371
    
    return c * r

def get_market_prices(crop_name=None, location=None):
    """Get market prices for crops"""
    query = MarketPrice.query
    
    if crop_name:
        query = query.filter(MarketPrice.crop_name.ilike(f'%{crop_name}%'))
    if location:
        query = query.filter(MarketPrice.location.ilike(f'%{location}%'))
    
    prices = query.order_by(MarketPrice.date.desc()).limit(10).all()
    
    return [{
        'crop_name': price.crop_name,
        'location': price.location,
        'average_price': price.average_price,
        'date': price.date.isoformat(),
        'source': price.source
    } for price in prices]

def format_currency(amount):
    """Format amount as currency"""
    return f"KSh {amount:,.2f}"

def get_crop_categories():
    """Get list of crop categories"""
    return [
        'Cereals', 'Legumes', 'Vegetables', 'Fruits', 
        'Root Tubers', 'Cash Crops', 'Herbs & Spices'
    ]

def get_kenyan_counties():
    """Get list of Kenyan counties"""
    return [
        'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet',
        'Embu', 'Garissa', 'Homa Bay', 'Isiolo', 'Kajiado',
        'Kakamega', 'Kericho', 'Kiambu', 'Kilifi', 'Kirinyaga',
        'Kisii', 'Kisumu', 'Kitui', 'Kwale', 'Laikipia',
        'Lamu', 'Machakos', 'Makueni', 'Mandera', 'Marsabit',
        'Meru', 'Migori', 'Mombasa', 'Murang\'a', 'Nairobi',
        'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua',
        'Nyeri', 'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River',
        'Tharaka-Nithi', 'Trans Nzoia', 'Turkana', 'Uasin Gishu',
        'Vihiga', 'Wajir', 'West Pokot'
    ]
