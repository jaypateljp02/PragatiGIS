from flask import Flask, request, jsonify, send_from_directory
from flask_session import Session
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import os
from datetime import datetime, timedelta
import uuid
import json
import sqlite3
from functools import wraps
import tempfile
import io
import base64

# Initialize Flask app
app = Flask(__name__, static_folder='../client/dist', static_url_path='')

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-change-in-production')
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///local-database.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_PERMANENT'] = False
app.config['SESSION_USE_SIGNER'] = True
app.config['SESSION_FILE_DIR'] = tempfile.mkdtemp()
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size

# Import db from models (unified SQLAlchemy instance)
from models import db

# Initialize extensions
db.init_app(app)
Session(app)
CORS(app, supports_credentials=True)

# Create upload directory
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

print("🐍 Flask backend starting up...")
print(f"📁 Database: {app.config['SQLALCHEMY_DATABASE_URI']}")

if __name__ == '__main__':
    from models import init_db
    from routes import register_routes
    
    # Initialize database
    init_db(app)
    
    # Register all routes
    register_routes(app, db)
    
    # Serve React frontend for all non-API routes
    @app.route('/')
    def serve_react_app():
        return send_from_directory(app.static_folder, 'index.html')

    @app.route('/<path:path>')
    def serve_react_routes(path):
        # If it's not an API route, serve the React app
        if not path.startswith('api/'):
            if os.path.exists(os.path.join(app.static_folder, path)):
                return send_from_directory(app.static_folder, path)
            else:
                return send_from_directory(app.static_folder, 'index.html')
        return "Not found", 404
    
    port = int(os.environ.get('PORT', 5000))
    print(f"🚀 Starting Flask server on port {port}")
    app.run(host='0.0.0.0', port=port, debug=True)