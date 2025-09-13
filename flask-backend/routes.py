from flask import request, jsonify, session, send_file, make_response
from werkzeug.utils import secure_filename
from functools import wraps
from datetime import datetime, timedelta
import uuid
import json
import os
import io
import csv
import pandas as pd
from PIL import Image
import pytesseract
import cv2
import numpy as np
import base64
import tempfile

from models import db, User, UserSession, State, District, Claim, Document, AuditLogEntry

def require_auth(f):
    """Authentication middleware"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check for session token in cookies
        token = request.cookies.get('fra_session')
        if not token:
            return jsonify({'error': 'Authentication required'}), 401
        
        # Find valid session
        user_session = UserSession.query.filter_by(token=token).first()
        if not user_session or not user_session.is_valid():
            return jsonify({'error': 'Invalid or expired session'}), 401
        
        # Get user
        user = User.query.get(user_session.user_id)
        if not user or not user.is_active:
            return jsonify({'error': 'User not found or inactive'}), 401
        
        # Attach user and session to request
        request.current_user = user
        request.current_session = user_session
        
        return f(*args, **kwargs)
    return decorated_function

def require_role(*allowed_roles):
    """Role-based authorization middleware"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not hasattr(request, 'current_user'):
                return jsonify({'error': 'Authentication required'}), 401
            
            if request.current_user.role not in allowed_roles:
                return jsonify({'error': 'Insufficient permissions'}), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def log_audit(user_id, action, resource_type, resource_id, changes=None):
    """Log audit entry"""
    try:
        audit_entry = AuditLogEntry(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            changes=json.dumps(changes) if changes else None,
            ip_address=request.remote_addr,
            user_agent=request.headers.get('User-Agent')
        )
        db.session.add(audit_entry)
        db.session.commit()
    except Exception as e:
        print(f"Audit logging error: {e}")

def sanitize_document(document):
    """Remove fileContent from document response"""
    doc_dict = document.to_dict()
    if 'fileContent' in doc_dict:
        del doc_dict['fileContent']
    return doc_dict

def register_routes(app, database):
    """Register all Flask routes"""
    
    # Configure multer equivalent for file uploads
    from werkzeug.datastructures import CombinedMultiDict
    
    def standardize_claim_data(raw_data):
        """Standardize claim data from various input formats"""
        standardized = {
            'claimId': raw_data.get('claim_id') or raw_data.get('claimId') or f"FRA-{raw_data.get('state', 'XX')}-{int(datetime.now().timestamp())}",
            'claimantName': raw_data.get('claimant_name') or raw_data.get('claimantName') or raw_data.get('name'),
            'location': raw_data.get('location') or raw_data.get('village') or raw_data.get('village_name'),
            'district': raw_data.get('district') or raw_data.get('district_name'),
            'state': raw_data.get('state') or raw_data.get('state_name'),
            'area': str(raw_data.get('area') or raw_data.get('area_hectares') or raw_data.get('land_area') or '0'),
            'landType': (raw_data.get('land_type') or raw_data.get('landType') or 'individual').lower(),
            'status': (raw_data.get('status') or 'pending').lower(),
            'dateSubmitted': datetime.fromisoformat(raw_data.get('date_submitted')) if raw_data.get('date_submitted') else datetime.utcnow(),
            'familyMembers': int(raw_data.get('family_members') or raw_data.get('familyMembers') or 0) or None,
            'coordinates': json.loads(raw_data.get('coordinates')) if raw_data.get('coordinates') else None,
            'notes': raw_data.get('notes') or raw_data.get('remarks') or None
        }
        return standardized
    
    # Authentication routes
    @app.route('/api/auth/me', methods=['GET'])
    @require_auth
    def get_current_user():
        try:
            user_data = request.current_user.to_dict()
            return jsonify({'user': user_data})
        except Exception as e:
            print(f'Get current user error: {e}')
            return jsonify({'error': 'Failed to get user info'}), 500

    @app.route('/api/auth/login', methods=['POST'])
    def login():
        try:
            data = request.get_json()
            username = data.get('username', '').strip()
            password = data.get('password', '')
            
            if not username or not password:
                return jsonify({'error': 'Username and password are required'}), 400
            
            # Verify user credentials
            user = User.query.filter_by(username=username).first()
            if not user or not user.check_password(password):
                return jsonify({'error': 'Invalid credentials'}), 401
            
            if not user.is_active:
                return jsonify({'error': 'Account is inactive'}), 401
            
            # Create session token
            token = str(uuid.uuid4())
            expires_at = datetime.utcnow() + timedelta(hours=24)  # 24 hours
            
            user_session = UserSession(
                user_id=user.id,
                token=token,
                expires_at=expires_at
            )
            db.session.add(user_session)
            db.session.commit()
            
            # Set secure HTTP-only cookie
            response = make_response(jsonify({'user': user.to_dict()}))
            response.set_cookie(
                'fra_session', 
                token,
                httponly=True,
                secure=request.is_secure,  # Use secure in HTTPS
                samesite='Lax',
                max_age=24*60*60  # 24 hours
            )
            
            # Log the login
            log_audit(user.id, 'login', 'session', user_session.id)
            
            return response
            
        except Exception as e:
            print(f'Login error: {e}')
            return jsonify({'error': 'Login failed'}), 500

    @app.route('/api/auth/logout', methods=['POST'])
    @require_auth
    def logout():
        try:
            # Invalidate the session
            db.session.delete(request.current_session)
            db.session.commit()
            
            # Log the logout
            log_audit(request.current_user.id, 'logout', 'session', request.current_session.id)
            
            # Clear the session cookie
            response = make_response(jsonify({'message': 'Logged out successfully'}))
            response.set_cookie('fra_session', '', expires=0)
            
            return response
            
        except Exception as e:
            print(f'Logout error: {e}')
            return jsonify({'error': 'Logout failed'}), 500

    # Dashboard routes
    @app.route('/api/dashboard/stats', methods=['GET'])
    @require_auth
    def get_dashboard_stats():
        try:
            # Get all claims for stats
            all_claims = Claim.query.all()
            all_documents = Document.query.all()
            
            stats = {
                'totalClaims': len(all_claims),
                'approvedClaims': len([c for c in all_claims if c.status == 'approved']),
                'pendingClaims': len([c for c in all_claims if c.status == 'pending']),
                'rejectedClaims': len([c for c in all_claims if c.status == 'rejected']),
                'totalDocuments': len(all_documents),
                'pendingOCR': len([d for d in all_documents if d.ocr_status == 'pending']),
                'processingDocuments': len([d for d in all_documents if d.ocr_status == 'processing']),
                'completedOCR': len([d for d in all_documents if d.ocr_status == 'completed']),
                'totalArea': sum(float(c.area) for c in all_claims),
                'averageClaimArea': sum(float(c.area) for c in all_claims) / len(all_claims) if all_claims else 0
            }
            
            return jsonify(stats)
            
        except Exception as e:
            print(f'Dashboard stats error: {e}')
            return jsonify({'error': 'Failed to fetch dashboard stats'}), 500

    # Claims routes
    @app.route('/api/claims', methods=['GET'])
    @require_auth
    def get_claims():
        try:
            claims = Claim.query.all()
            return jsonify([claim.to_dict() for claim in claims])
        except Exception as e:
            print(f'Get claims error: {e}')
            return jsonify({'error': 'Failed to fetch claims'}), 500

    @app.route('/api/claims', methods=['POST'])
    @require_auth
    def create_claim():
        try:
            data = request.get_json()
            
            # Generate claim ID
            claim_id = f"FRA-{data.get('state', 'XX')}-{datetime.now().year}-{str(uuid.uuid4())[:8].upper()}"
            
            claim = Claim(
                claim_id=claim_id,
                claimant_name=data['claimantName'],
                location=data['location'],
                district=data['district'],
                state=data['state'],
                area=data['area'],
                land_type=data['landType'],
                status='pending',
                date_submitted=datetime.utcnow(),
                family_members=data.get('familyMembers'),
                coordinates=json.dumps(data.get('coordinates')) if data.get('coordinates') else None,
                notes=data.get('notes')
            )
            
            db.session.add(claim)
            db.session.commit()
            
            # Log the action
            log_audit(request.current_user.id, 'create', 'claim', claim.id, {'claim_id': claim_id})
            
            return jsonify(claim.to_dict()), 201
            
        except Exception as e:
            print(f'Create claim error: {e}')
            return jsonify({'error': 'Failed to create claim'}), 500

    @app.route('/api/claims/<claim_id>', methods=['GET'])
    @require_auth
    def get_claim(claim_id):
        try:
            claim = Claim.query.get_or_404(claim_id)
            return jsonify(claim.to_dict())
        except Exception as e:
            print(f'Get claim error: {e}')
            return jsonify({'error': 'Failed to fetch claim'}), 500

    @app.route('/api/claims/<claim_id>', methods=['PATCH'])
    @require_auth
    @require_role('ministry', 'state', 'district')
    def update_claim(claim_id):
        try:
            claim = Claim.query.get_or_404(claim_id)
            data = request.get_json()
            
            # Track changes for audit log
            changes = {}
            for key, value in data.items():
                if hasattr(claim, key):
                    old_value = getattr(claim, key)
                    if old_value != value:
                        changes[key] = {'old': old_value, 'new': value}
                        setattr(claim, key, value)
            
            claim.updated_at = datetime.utcnow()
            db.session.commit()
            
            # Log the action
            if changes:
                log_audit(request.current_user.id, 'update', 'claim', claim_id, changes)
            
            return jsonify(claim.to_dict())
            
        except Exception as e:
            print(f'Update claim error: {e}')
            return jsonify({'error': 'Failed to update claim'}), 500

    # Document routes
    @app.route('/api/documents', methods=['GET'])
    @require_auth
    def get_documents():
        try:
            documents = Document.query.all()
            return jsonify([sanitize_document(doc) for doc in documents])
        except Exception as e:
            print(f'Get documents error: {e}')
            return jsonify({'error': 'Failed to fetch documents'}), 500

    @app.route('/api/documents/upload', methods=['POST'])
    @require_auth
    def upload_document():
        try:
            if 'file' not in request.files:
                return jsonify({'error': 'No file provided'}), 400
            
            file = request.files['file']
            if file.filename == '':
                return jsonify({'error': 'No file selected'}), 400
            
            # Read file content
            file_content = file.read()
            file.seek(0)  # Reset file pointer
            
            # Create document record
            document = Document(
                filename=secure_filename(file.filename),
                original_filename=file.filename,
                file_type=file.content_type,
                file_size=len(file_content),
                file_content=file_content,
                ocr_status='pending',
                uploaded_by=request.current_user.id
            )
            
            db.session.add(document)
            db.session.commit()
            
            # Start OCR processing in background (simplified)
            process_document_ocr(document.id)
            
            return jsonify(sanitize_document(document)), 201
            
        except Exception as e:
            print(f'Upload document error: {e}')
            return jsonify({'error': 'Failed to upload document'}), 500

    def process_document_ocr(document_id):
        """Process document OCR (simplified version)"""
        try:
            document = Document.query.get(document_id)
            if not document:
                return
            
            # Update status to processing
            document.ocr_status = 'processing'
            db.session.commit()
            
            # Extract text based on file type
            extracted_text = ""
            
            if document.file_type.startswith('image/'):
                # Process image with Tesseract
                try:
                    # Convert binary data to image
                    image_array = np.frombuffer(document.file_content, np.uint8)
                    image = cv2.imdecode(image_array, cv2.IMREAD_COLOR)
                    
                    # Extract text using Tesseract
                    extracted_text = pytesseract.image_to_string(image)
                    
                    # Simple confidence calculation (simplified)
                    confidence = 85.0 if extracted_text.strip() else 0.0
                    
                except Exception as ocr_error:
                    print(f"OCR processing error: {ocr_error}")
                    extracted_text = f"OCR processing failed: {str(ocr_error)}"
                    confidence = 0.0
            
            elif document.file_type == 'application/pdf':
                # For PDF, provide guidance message
                extracted_text = f"PDF Document Analysis:\n\nFilename: {document.original_filename}\nSize: {document.file_size // 1024} KB\n\nNote: For best OCR results with PDFs, please convert to images first."
                confidence = 0.0
            
            else:
                extracted_text = f"Unsupported file type: {document.file_type}"
                confidence = 0.0
            
            # Update document with OCR results
            document.ocr_text = extracted_text
            document.confidence = confidence
            document.ocr_status = 'completed'
            document.updated_at = datetime.utcnow()
            
            # Simple data extraction (can be enhanced)
            extracted_data = {}
            if extracted_text:
                # Basic keyword extraction
                text_lower = extracted_text.lower()
                if 'claim' in text_lower:
                    extracted_data['type'] = 'claim_document'
                if 'forest' in text_lower or 'land' in text_lower:
                    extracted_data['category'] = 'forest_rights'
            
            document.extracted_data = json.dumps(extracted_data) if extracted_data else None
            db.session.commit()
            
            print(f"OCR processing completed for document {document_id}")
            
        except Exception as e:
            print(f"OCR processing failed for document {document_id}: {e}")
            try:
                document = Document.query.get(document_id)
                if document:
                    document.ocr_status = 'failed'
                    db.session.commit()
            except:
                pass

    @app.route('/api/ocr-review', methods=['GET'])
    @require_auth
    def get_ocr_review_documents():
        try:
            print('Fetching documents for OCR review...')
            documents = Document.query.filter_by(ocr_status='completed').all()
            print(f'Found {len(documents)} completed documents')
            
            pending_review = [doc for doc in documents if doc.review_status == 'pending']
            print(f'Found {len(pending_review)} documents pending review')
            
            return jsonify([sanitize_document(doc) for doc in pending_review])
            
        except Exception as e:
            print(f'OCR review endpoint error: {e}')
            return jsonify({
                'error': 'Failed to fetch documents for review',
                'details': str(e)
            }), 500

    @app.route('/api/documents/<document_id>/correct-ocr', methods=['POST'])
    @require_auth
    @require_role('ministry', 'state', 'district')
    def correct_ocr_data(document_id):
        try:
            document = Document.query.get_or_404(document_id)
            data = request.get_json()
            
            # Update OCR data
            document.ocr_text = data.get('ocrText', document.ocr_text)
            document.extracted_data = json.dumps(data.get('extractedData')) if data.get('extractedData') else document.extracted_data
            document.review_status = data.get('reviewStatus', 'pending')
            document.reviewed_by = request.current_user.id
            document.updated_at = datetime.utcnow()
            
            db.session.commit()
            
            # Log the action
            log_audit(request.current_user.id, 'correct_ocr', 'document', document_id)
            
            return jsonify(sanitize_document(document))
            
        except Exception as e:
            print(f'Correct OCR error: {e}')
            return jsonify({'error': 'Failed to update OCR data'}), 400

    # States and Districts routes
    @app.route('/api/states', methods=['GET'])
    def get_states():
        try:
            states = State.query.all()
            return jsonify([state.to_dict() for state in states])
        except Exception as e:
            print(f'Get states error: {e}')
            return jsonify({'error': 'Failed to fetch states'}), 500

    @app.route('/api/districts/<state_code>', methods=['GET'])
    def get_districts_by_state_code(state_code):
        try:
            state = State.query.filter_by(code=state_code).first()
            if not state:
                return jsonify([])
            
            districts = District.query.filter_by(state_id=state.id).all()
            return jsonify([district.to_dict() for district in districts])
        except Exception as e:
            print(f'Get districts error: {e}')
            return jsonify({'error': 'Failed to fetch districts'}), 500

    @app.route('/api/states/<int:state_id>/districts', methods=['GET'])
    def get_districts_by_state_id(state_id):
        try:
            districts = District.query.filter_by(state_id=state_id).all()
            return jsonify([district.to_dict() for district in districts])
        except Exception as e:
            print(f'Get districts error: {e}')
            return jsonify({'error': 'Failed to fetch districts'}), 500

    @app.route('/api/dashboard/state/<state_code>', methods=['GET'])
    def get_state_dashboard(state_code):
        try:
            state = State.query.filter_by(code=state_code).first()
            if not state:
                return jsonify({'error': 'State not found'}), 404

            claims = Claim.query.filter_by(state=state.name).all()
            districts = District.query.filter_by(state_id=state.id).all()
            
            stats = {
                'totalClaims': len(claims),
                'pendingClaims': len([c for c in claims if c.status == 'pending']),
                'approvedClaims': len([c for c in claims if c.status == 'approved']),
                'rejectedClaims': len([c for c in claims if c.status == 'rejected']),
                'totalArea': sum(float(c.area) for c in claims),
                'districts': len(districts)
            }

            return jsonify({
                'state': state.to_dict(),
                'stats': stats,
                'districts': [d.to_dict() for d in districts],
                'recentClaims': [c.to_dict() for c in claims[-10:]]  # Last 10 claims
            })
            
        except Exception as e:
            print(f'State dashboard error: {e}')
            return jsonify({'error': 'Failed to fetch state dashboard'}), 500

    @app.route('/api/state-info/<state_code>', methods=['GET'])
    def get_state_info(state_code):
        try:
            state = State.query.filter_by(code=state_code).first()
            if not state:
                return jsonify({'error': 'State not found'}), 404
            return jsonify(state.to_dict())
        except Exception as e:
            print(f'Get state info error: {e}')
            return jsonify({'error': 'Failed to fetch state info'}), 500

    # Audit log route
    @app.route('/api/audit-log', methods=['GET'])
    @require_auth
    @require_role('ministry', 'state')
    def get_audit_log():
        try:
            resource_type = request.args.get('resourceType')
            resource_id = request.args.get('resourceId')
            
            query = AuditLogEntry.query
            
            if resource_type:
                query = query.filter_by(resource_type=resource_type)
            if resource_id:
                query = query.filter_by(resource_id=resource_id)
            
            logs = query.order_by(AuditLogEntry.created_at.desc()).all()
            return jsonify([log.to_dict() for log in logs])
            
        except Exception as e:
            print(f'Audit log error: {e}')
            return jsonify({'error': 'Failed to fetch audit log'}), 500

    # Document download endpoint
    @app.route('/api/documents/<document_id>/download', methods=['GET'])
    @require_auth
    def download_document(document_id):
        try:
            document = Document.query.get_or_404(document_id)
            
            if not document.file_content:
                return jsonify({'error': 'File content not available'}), 404
            
            # Create file-like object from binary data
            file_data = io.BytesIO(document.file_content)
            
            # Set appropriate headers for file download
            return send_file(
                file_data,
                as_attachment=True,
                download_name=document.original_filename,
                mimetype=document.file_type
            )
            
        except Exception as e:
            print(f'File download error: {e}')
            return jsonify({'error': 'Failed to download file'}), 500
    
    # Bulk claims import endpoint
    @app.route('/api/claims/bulk-import', methods=['POST'])
    @require_auth
    @require_role('ministry', 'state', 'district')
    def bulk_import_claims():
        try:
            if 'file' not in request.files:
                return jsonify({'error': 'No file uploaded'}), 400
            
            file = request.files['file']
            if file.filename == '':
                return jsonify({'error': 'No file selected'}), 400
            
            # Validate file type
            if not (file.content_type == 'text/csv' or file.filename.lower().endswith('.csv')):
                return jsonify({'error': 'Only CSV files are allowed'}), 400
            
            user = request.current_user
            results = []
            errors = []
            success_count = 0
            error_count = 0
            
            # Parse CSV data
            csv_content = file.read().decode('utf-8')
            csv_reader = csv.DictReader(io.StringIO(csv_content))
            
            for row_num, row in enumerate(csv_reader, start=1):
                try:
                    standardized_data = standardize_claim_data(row)
                    
                    # Role-based jurisdiction checks
                    if user.role == 'state' and user.state_id:
                        user_state = State.query.get(user.state_id)
                        if user_state and standardized_data['state'] != user_state.name:
                            errors.append(f"Row {row_num}: Cannot import claim for {standardized_data['state']} - outside jurisdiction")
                            error_count += 1
                            continue
                    
                    if user.role == 'district' and user.district_id:
                        user_district = District.query.get(user.district_id)
                        if user_district and standardized_data['district'] != user_district.name:
                            errors.append(f"Row {row_num}: Cannot import claim for {standardized_data['district']} - outside jurisdiction")
                            error_count += 1
                            continue
                    
                    # Create new claim
                    claim = Claim(
                        claim_id=standardized_data['claimId'],
                        claimant_name=standardized_data['claimantName'],
                        location=standardized_data['location'],
                        district=standardized_data['district'],
                        state=standardized_data['state'],
                        area=float(standardized_data['area']),
                        land_type=standardized_data['landType'],
                        status=standardized_data['status'],
                        date_submitted=standardized_data['dateSubmitted'],
                        family_members=standardized_data['familyMembers'],
                        coordinates=json.dumps(standardized_data['coordinates']) if standardized_data['coordinates'] else None,
                        notes=standardized_data['notes']
                    )
                    
                    db.session.add(claim)
                    db.session.commit()
                    
                    results.append({'row': row_num, 'status': 'success', 'claimId': claim.id})
                    success_count += 1
                    
                    # Log the action
                    log_audit(user.id, 'bulk_import_claim', 'claim', claim.id, {'imported': True, 'source': 'csv'})
                    
                except Exception as error:
                    error_msg = f"Row {row_num}: {str(error)}"
                    errors.append(error_msg)
                    error_count += 1
                    db.session.rollback()
            
            return jsonify({
                'message': f'Import completed: {success_count} successful, {error_count} failed',
                'summary': {'total': row_num, 'successful': success_count, 'failed': error_count},
                'results': results,
                'errors': errors[:50]  # Limit error details
            })
            
        except Exception as e:
            print(f'Bulk import error: {e}')
            return jsonify({'error': 'Failed to import claims data'}), 500
    
    # Claims export endpoint
    @app.route('/api/claims/export', methods=['GET'])
    @require_auth
    def export_claims():
        try:
            user = request.current_user
            claims = Claim.query.all()
            
            # Role-based filtering
            if user.role == 'state' and user.state_id:
                user_state = State.query.get(user.state_id)
                if user_state:
                    claims = [claim for claim in claims if claim.state == user_state.name]
            elif user.role == 'district' and user.district_id:
                user_district = District.query.get(user.district_id)
                if user_district:
                    claims = [claim for claim in claims if claim.district == user_district.name]
            
            # Convert to CSV format
            csv_header = 'ID,Claim ID,Claimant Name,Location,District,State,Area (hectares),Land Type,Status,Date Submitted,Date Processed,Family Members,Notes\n'
            csv_rows = []
            
            for claim in claims:
                row = [
                    claim.id,
                    claim.claim_id,
                    claim.claimant_name,
                    claim.location,
                    claim.district,
                    claim.state,
                    str(claim.area),
                    claim.land_type,
                    claim.status,
                    claim.date_submitted.strftime('%Y-%m-%d') if claim.date_submitted else '',
                    claim.date_processed.strftime('%Y-%m-%d') if claim.date_processed else '',
                    str(claim.family_members) if claim.family_members else '',
                    (claim.notes or '').replace('"', '""')  # Escape quotes
                ]
                csv_rows.append(','.join(f'"{field}"' for field in row))
            
            csv_content = csv_header + '\n'.join(csv_rows)
            
            # Create response
            response = make_response(csv_content)
            response.headers['Content-Type'] = 'text/csv'
            response.headers['Content-Disposition'] = f'attachment; filename="fra-claims-{datetime.now().strftime("%Y-%m-%d")}.csv"'
            
            # Log the export
            log_audit(user.id, 'export_claims', 'claims', 'bulk', {'exported_count': len(claims)})
            
            return response
            
        except Exception as e:
            print(f'Export claims error: {e}')
            return jsonify({'error': 'Failed to export claims'}), 500
    
    # Bulk actions endpoint
    @app.route('/api/claims/bulk-action', methods=['POST'])
    @require_auth
    @require_role('ministry', 'state', 'district')
    def bulk_action_claims():
        try:
            data = request.get_json()
            claim_ids = data.get('claimIds', [])
            action = data.get('action')
            reason = data.get('reason')
            user = request.current_user
            
            if not claim_ids or not isinstance(claim_ids, list) or len(claim_ids) == 0:
                return jsonify({'error': 'No claim IDs provided'}), 400
            
            if action not in ['approve', 'reject', 'under-review']:
                return jsonify({'error': 'Invalid action'}), 400
            
            results = []
            errors = []
            
            for claim_id in claim_ids:
                try:
                    claim = Claim.query.get(claim_id)
                    if not claim:
                        errors.append({'claimId': claim_id, 'error': 'Claim not found'})
                        continue
                    
                    # Update claim
                    if action == 'approve':
                        claim.status = 'approved'
                        claim.date_processed = datetime.utcnow()
                    elif action == 'reject':
                        claim.status = 'rejected'
                        claim.date_processed = datetime.utcnow()
                        if reason:
                            claim.notes = reason
                    else:  # under-review
                        claim.status = 'under-review'
                    
                    claim.assigned_officer = user.id
                    claim.updated_at = datetime.utcnow()
                    
                    db.session.commit()
                    
                    results.append({'claimId': claim_id, 'status': 'success'})
                    
                    # Log the action
                    log_audit(user.id, f'bulk_{action}_claim', 'claim', claim_id, {'status': claim.status, 'reason': reason})
                    
                except Exception as error:
                    errors.append({'claimId': claim_id, 'error': str(error)})
                    db.session.rollback()
            
            return jsonify({
                'message': f'Bulk action completed: {len(results)} successful, {len(errors)} failed',
                'results': results,
                'errors': errors
            })
            
        except Exception as e:
            print(f'Bulk action error: {e}')
            return jsonify({'error': 'Failed to perform bulk action'}), 500
    
    print("✅ All Flask routes registered successfully")
    print("📋 Available API endpoints:")
    print("   🔐 Authentication: /api/auth/login, /api/auth/logout, /api/auth/me")
    print("   📊 Dashboard: /api/dashboard/stats")
    print("   📄 Claims: /api/claims (GET, POST), /api/claims/bulk-import, /api/claims/export, /api/claims/bulk-action")
    print("   📁 Documents: /api/documents, /api/documents/upload, /api/documents/<id>/download")
    print("   🔍 OCR Review: /api/ocr-review")
    print("   🗺️ Geography: /api/states, /api/districts/{code}")
    print("   📝 Audit: /api/audit-log")