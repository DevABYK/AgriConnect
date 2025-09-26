# AgriConnect

AgriConnect is a web-based agricultural marketplace platform designed to connect farmers and buyers, streamline crop sales, and facilitate communication. The platform allows farmers to list crops, buyers to browse and order, and both parties to communicate via integrated messaging. Admin features are included for platform management.

## Features
- Farmer and buyer registration/login
- Crop listing and browsing
- Order management
- Real-time messaging between users
- Admin dashboard for user and order management
- File uploads for crop images

## How to Run

1. **Clone the repository:**
	```
	git clone https://github.com/KBungei/AgriConnect.git
	cd AgriConnect
	```

2. **Install dependencies:**
	```
	pip install -r requirements.txt
	```

3. **Set up environment variables:**
	- Create a `.env` file in the project root (optional, for secrets like SESSION_SECRET or DATABASE_URL).

4. **Initialize the database (optional):**
	```
	python -m flask init-db
	```

5. **Run the application:**
	```
	python main.py
	```
	The app will be available at [http://localhost:5000](http://localhost:5000)

## Folder Structure
- `app.py` - Main Flask app and configuration
- `main.py` - Entry point to run the server
- `models.py` - Database models
- `routes.py` - Application routes
- `templates/` - HTML templates
- `static/` - Static files (CSS, JS, images)
- `uploads/` - Uploaded crop images

## License
MIT
