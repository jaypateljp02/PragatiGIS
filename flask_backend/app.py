"""
FRA Atlas Platform - Flask Backend
Main application file with routes and configuration
"""
import os
import sqlite3
from datetime import datetime, timedelta
from functools import wraps
import secrets
import hashlib
import base64
import io
import json
from werkzeug.utils import secure_filename
from werkzeug.security import check_password_hash, generate_password_hash

from flask import Flask, request, jsonify, session, send_file
from flask_cors import CORS
from flask_session import Session
import bcrypt
import pytesseract
from PIL import Image
import cv2
import numpy as np
import pandas as pd

# Initialize Flask app
app = Flask(__name__)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'your-secret-key-here')
app.config['SESSION_TYPE'] = 'filesystem'
app.config['SESSION_PERMANENT'] = False
app.config['SESSION_USE_SIGNER'] = True
app.config['SESSION_KEY_PREFIX'] = 'fra_atlas:'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=30)

# Initialize extensions
CORS(app, supports_credentials=True, origins=['http://localhost:5000', 'https://*.replit.app'])
Session(app)

# Database configuration
DATABASE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'local-database.db')

def get_db_connection():
    """Get database connection"""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row  # Enable column access by name
    return conn

def require_auth(f):
    """Authentication decorator"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Authentication required'}), 401
        return f(*args, **kwargs)
    return decorated_function

def require_role(*allowed_roles):
    """Role-based authorization decorator"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_id' not in session:
                return jsonify({'error': 'Authentication required'}), 401
            
            conn = get_db_connection()
            user = conn.execute(
                'SELECT role FROM users WHERE id = ?', 
                (session['user_id'],)
            ).fetchone()
            conn.close()
            
            if not user or user['role'] not in allowed_roles:
                return jsonify({'error': 'Insufficient permissions'}), 403
                
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# Authentication Routes
@app.route('/api/auth/login', methods=['POST'])
def login():
    """User login endpoint"""
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'error': 'Username and password required'}), 400
        
        conn = get_db_connection()
        user = conn.execute(
            'SELECT id, username, email, fullName, role, stateId, districtId, isActive, passwordHash FROM users WHERE username = ?',
            (username,)
        ).fetchone()
        conn.close()
        
        if not user:
            return jsonify({'error': 'Invalid credentials'}), 401
        
        if not user['isActive']:
            return jsonify({'error': 'Account is disabled'}), 401
        
        # Verify password
        if not bcrypt.checkpw(password.encode('utf-8'), user['passwordHash']):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        # Create session
        session['user_id'] = user['id']
        session['username'] = user['username']
        session['role'] = user['role']
        session.permanent = True
        
        # Create session token in database
        session_token = secrets.token_urlsafe(32)
        expires_at = datetime.now() + timedelta(days=30)
        
        conn = get_db_connection()
        conn.execute(
            'INSERT INTO sessions (token, userId, expiresAt) VALUES (?, ?, ?)',
            (session_token, user['id'], expires_at.isoformat())
        )
        conn.commit()
        conn.close()
        
        user_data = {
            'id': user['id'],
            'username': user['username'],
            'email': user['email'],
            'fullName': user['fullName'],
            'role': user['role'],
            'stateId': user['stateId'],
            'districtId': user['districtId'],
            'isActive': user['isActive']
        }
        
        return jsonify({'user': user_data, 'token': session_token})
        
    except Exception as e:
        print(f'Login error: {e}')
        return jsonify({'error': 'Login failed'}), 500

@app.route('/api/auth/logout', methods=['POST'])
@require_auth
def logout():
    """User logout endpoint"""
    try:
        # Clear session from database if token exists
        if 'session_token' in session:
            conn = get_db_connection()
            conn.execute('DELETE FROM sessions WHERE token = ?', (session['session_token'],))
            conn.commit()
            conn.close()
        
        # Clear Flask session
        session.clear()
        return jsonify({'message': 'Logged out successfully'})
        
    except Exception as e:
        print(f'Logout error: {e}')
        return jsonify({'error': 'Logout failed'}), 500

@app.route('/api/auth/me', methods=['GET'])
@require_auth
def get_current_user():
    """Get current user info"""
    try:
        conn = get_db_connection()
        user = conn.execute(
            'SELECT id, username, email, fullName, role, stateId, districtId, isActive FROM users WHERE id = ?',
            (session['user_id'],)
        ).fetchone()
        conn.close()
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        user_data = {
            'id': user['id'],
            'username': user['username'],
            'email': user['email'],
            'fullName': user['fullName'],
            'role': user['role'],
            'stateId': user['stateId'],
            'districtId': user['districtId'],
            'isActive': user['isActive']
        }
        
        return jsonify({'user': user_data})
        
    except Exception as e:
        print(f'Get current user error: {e}')
        return jsonify({'error': 'Failed to get user info'}), 500

# Document Upload and OCR Routes
@app.route('/api/documents/upload', methods=['POST'])
@require_auth
def upload_document():
    """Upload and process document with OCR"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        claim_id = request.form.get('claimId')
        
        # Validate file type
        allowed_types = ['image/jpeg', 'image/png', 'image/tiff', 'application/pdf']
        if file.content_type not in allowed_types:
            return jsonify({'error': 'Unsupported file type'}), 400
        
        # Read file content
        file_content = file.read()
        file_size = len(file_content)
        
        # Generate unique filename
        secure_name = secure_filename(file.filename or 'unnamed')
        unique_filename = f"{secrets.token_hex(16)}_{secure_name}"
        
        # Store document in database
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO documents (
                filename, originalFilename, fileType, fileSize, 
                fileContent, ocrStatus, reviewStatus, uploadedBy, claimId
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            unique_filename, file.filename, file.content_type, file_size,
            file_content, 'pending', 'pending', session['user_id'], claim_id
        ))
        
        document_id = cursor.lastrowid
        conn.commit()
        
        # Process OCR
        try:
            ocr_text = process_ocr(file_content, file.content_type, file.filename)
            
            # Update with OCR results
            cursor.execute('''
                UPDATE documents 
                SET ocrText = ?, ocrStatus = ?, processedAt = ? 
                WHERE id = ?
            ''', (ocr_text, 'completed', datetime.now().isoformat(), document_id))
            conn.commit()
            
        except Exception as ocr_error:
            print(f'OCR processing error: {ocr_error}')
            cursor.execute('''
                UPDATE documents 
                SET ocrStatus = ?, ocrError = ? 
                WHERE id = ?
            ''', ('failed', str(ocr_error), document_id))
            conn.commit()
        
        # Get the created document
        document = conn.execute(
            'SELECT * FROM documents WHERE id = ?', (document_id,)
        ).fetchone()
        conn.close()
        
        doc_data = {
            'id': document['id'],
            'filename': document['filename'],
            'originalFilename': document['originalFilename'],
            'fileType': document['fileType'],
            'fileSize': document['fileSize'],
            'ocrStatus': document['ocrStatus'],
            'ocrText': document['ocrText'],
            'reviewStatus': document['reviewStatus'],
            'createdAt': document['createdAt'],
            'uploadedBy': document['uploadedBy']
        }
        
        return jsonify({'document': doc_data})
        
    except Exception as e:
        print(f'Document upload error: {e}')
        return jsonify({'error': 'Failed to upload document'}), 500

def process_ocr(file_content, file_type, filename):
    """Process OCR on uploaded file"""
    try:
        if file_type.startswith('image/'):
            # Process image with Tesseract
            image = Image.open(io.BytesIO(file_content))
            
            # Convert to RGB if necessary
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Enhance image for better OCR
            image_array = np.array(image)
            
            # Apply image processing for better OCR
            gray = cv2.cvtColor(image_array, cv2.COLOR_RGB2GRAY)
            
            # Apply adaptive thresholding for better text extraction
            processed = cv2.adaptiveThreshold(
                gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
            )
            
            # Convert back to PIL Image
            processed_image = Image.fromarray(processed)
            
            # Extract text using Tesseract
            text = pytesseract.image_to_string(processed_image)
            
            return f"Image OCR Results for {filename}:\n\n{text.strip()}"
            
        elif file_type == 'application/pdf':
            # For PDFs, return metadata and suggest conversion
            size_kb = len(file_content) // 1024
            estimated_pages = max(1, size_kb // 50)
            
            return f"""PDF Document Analysis:

Filename: {filename}
Size: {size_kb} KB
Estimated Pages: {estimated_pages}

Note: For best OCR results with PDFs, please:
1. Convert PDF pages to high-quality images (JPG/PNG)
2. Or use PDFs with selectable text

This PDF was uploaded successfully. To extract text, please upload as an image file."""
        
        else:
            return f"Unsupported file type: {file_type}. Please upload PDF, JPEG, PNG, or TIFF files."
            
    except Exception as e:
        raise Exception(f"OCR processing failed: {str(e)}")

@app.route('/api/documents/<document_id>/download', methods=['GET'])
@require_auth
def download_document(document_id):
    """Download document file"""
    try:
        conn = get_db_connection()
        document = conn.execute(
            'SELECT filename, originalFilename, fileType, fileContent FROM documents WHERE id = ?',
            (document_id,)
        ).fetchone()
        conn.close()
        
        if not document:
            return jsonify({'error': 'Document not found'}), 404
        
        # Create file-like object from binary data
        file_data = io.BytesIO(document['fileContent'])
        
        return send_file(
            file_data,
            as_attachment=True,
            download_name=document['originalFilename'],
            mimetype=document['fileType']
        )
        
    except Exception as e:
        print(f'Document download error: {e}')
        return jsonify({'error': 'Failed to download document'}), 500

@app.route('/api/documents', methods=['GET'])
@require_auth
def get_documents():
    """Get user's documents"""
    try:
        conn = get_db_connection()
        documents = conn.execute('''
            SELECT id, filename, originalFilename, fileType, fileSize, 
                   ocrStatus, reviewStatus, createdAt, claimId
            FROM documents 
            WHERE uploadedBy = ?
            ORDER BY createdAt DESC
        ''', (session['user_id'],)).fetchall()
        conn.close()
        
        docs_list = []
        for doc in documents:
            docs_list.append({
                'id': doc['id'],
                'filename': doc['filename'],
                'originalFilename': doc['originalFilename'],
                'fileType': doc['fileType'],
                'fileSize': doc['fileSize'],
                'ocrStatus': doc['ocrStatus'],
                'reviewStatus': doc['reviewStatus'],
                'createdAt': doc['createdAt'],
                'claimId': doc['claimId']
            })
        
        return jsonify({'documents': docs_list})
        
    except Exception as e:
        print(f'Get documents error: {e}')
        return jsonify({'error': 'Failed to get documents'}), 500

# Claims Management Routes
@app.route('/api/claims', methods=['GET'])
@require_auth
def get_claims():
    """Get claims based on user role"""
    try:
        conn = get_db_connection()
        
        # Filter claims based on user role
        user = conn.execute(
            'SELECT role, stateId, districtId FROM users WHERE id = ?',
            (session['user_id'],)
        ).fetchone()
        
        if user['role'] == 'ministry':
            # Ministry can see all claims
            claims = conn.execute('SELECT * FROM claims ORDER BY dateSubmitted DESC').fetchall()
        elif user['role'] == 'state':
            # State admin sees claims in their state
            claims = conn.execute(
                'SELECT * FROM claims WHERE state = (SELECT name FROM states WHERE id = ?) ORDER BY dateSubmitted DESC',
                (user['stateId'],)
            ).fetchall()
        elif user['role'] == 'district':
            # District officer sees claims in their district
            claims = conn.execute(
                'SELECT * FROM claims WHERE district = (SELECT name FROM districts WHERE id = ?) ORDER BY dateSubmitted DESC',
                (user['districtId'],)
            ).fetchall()
        else:
            # Village officer sees claims in their area
            claims = conn.execute(
                'SELECT * FROM claims WHERE assignedOfficer = ? ORDER BY dateSubmitted DESC',
                (session['username'],)
            ).fetchall()
        
        conn.close()
        
        claims_list = []
        for claim in claims:
            claims_list.append({
                'id': claim['id'],
                'claimId': claim['claimId'],
                'claimantName': claim['claimantName'],
                'location': claim['location'],
                'district': claim['district'],
                'state': claim['state'],
                'area': claim['area'],
                'landType': claim['landType'],
                'status': claim['status'],
                'dateSubmitted': claim['dateSubmitted'],
                'assignedOfficer': claim['assignedOfficer'],
                'coordinates': claim['coordinates']
            })
        
        return jsonify({'claims': claims_list})
        
    except Exception as e:
        print(f'Get claims error: {e}')
        return jsonify({'error': 'Failed to get claims'}), 500

@app.route('/api/claims', methods=['POST'])
@require_auth
@require_role('ministry', 'state', 'district', 'village')
def create_claim():
    """Create new claim"""
    try:
        data = request.get_json()
        
        # Generate unique claim ID
        claim_id = f"FRA-{datetime.now().strftime('%Y%m%d')}-{secrets.token_hex(4).upper()}"
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO claims (
                claimId, claimantName, location, district, state, area,
                landType, status, dateSubmitted, assignedOfficer, coordinates
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            claim_id,
            data.get('claimantName'),
            data.get('location'),
            data.get('district'),
            data.get('state'),
            float(data.get('area', 0)),
            data.get('landType'),
            'pending',
            datetime.now().isoformat(),
            data.get('assignedOfficer'),
            data.get('coordinates')
        ))
        
        new_claim_id = cursor.lastrowid
        conn.commit()
        
        # Get the created claim
        claim = conn.execute('SELECT * FROM claims WHERE id = ?', (new_claim_id,)).fetchone()
        conn.close()
        
        claim_data = {
            'id': claim['id'],
            'claimId': claim['claimId'],
            'claimantName': claim['claimantName'],
            'location': claim['location'],
            'district': claim['district'],
            'state': claim['state'],
            'area': claim['area'],
            'landType': claim['landType'],
            'status': claim['status'],
            'dateSubmitted': claim['dateSubmitted'],
            'assignedOfficer': claim['assignedOfficer'],
            'coordinates': claim['coordinates']
        }
        
        return jsonify({'claim': claim_data}), 201
        
    except Exception as e:
        print(f'Create claim error: {e}')
        return jsonify({'error': 'Failed to create claim'}), 500

# Health check
@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'message': 'Flask backend is running'})

if __name__ == '__main__':
    app.run(host='127.0.0.1', port=5050, debug=True)