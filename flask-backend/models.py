from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import uuid
import json

db = SQLAlchemy()

# States table
class State(db.Model):
    __tablename__ = 'states'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    code = db.Column(db.String(2), unique=True, nullable=False)
    language = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'code': self.code,
            'language': self.language,
            'createdAt': self.created_at.isoformat() if self.created_at else None
        }

# Districts table
class District(db.Model):
    __tablename__ = 'districts'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    state_id = db.Column(db.Integer, db.ForeignKey('states.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    state = db.relationship('State', backref='districts')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'stateId': self.state_id,
            'createdAt': self.created_at.isoformat() if self.created_at else None
        }

# Users table
class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(50), nullable=False)  # ministry, state, district, village
    state_id = db.Column(db.Integer, db.ForeignKey('states.id'))
    district_id = db.Column(db.Integer, db.ForeignKey('districts.id'))
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    state = db.relationship('State', backref='users')
    district = db.relationship('District', backref='users')
    
    def set_password(self, password):
        self.password = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password, password)
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'fullName': self.full_name,
            'role': self.role,
            'stateId': self.state_id,
            'districtId': self.district_id,
            'isActive': self.is_active,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }

# User Sessions table
class UserSession(db.Model):
    __tablename__ = 'user_sessions'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    token = db.Column(db.String(255), unique=True, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User', backref='sessions')
    
    def is_valid(self):
        return self.expires_at > datetime.utcnow()
    
    def to_dict(self):
        return {
            'id': self.id,
            'userId': self.user_id,
            'token': self.token,
            'expiresAt': self.expires_at.isoformat() if self.expires_at else None,
            'createdAt': self.created_at.isoformat() if self.created_at else None
        }

# Claims table
class Claim(db.Model):
    __tablename__ = 'claims'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    claim_id = db.Column(db.String(100), unique=True, nullable=False)
    claimant_name = db.Column(db.String(200), nullable=False)
    location = db.Column(db.String(200), nullable=False)
    district = db.Column(db.String(100), nullable=False)
    state = db.Column(db.String(100), nullable=False)
    area = db.Column(db.Numeric(10, 2), nullable=False)
    land_type = db.Column(db.String(50), nullable=False)  # individual, community
    status = db.Column(db.String(50), nullable=False)  # pending, approved, rejected, under-review
    date_submitted = db.Column(db.DateTime, nullable=False)
    date_processed = db.Column(db.DateTime)
    assigned_officer = db.Column(db.String(36), db.ForeignKey('users.id'))
    family_members = db.Column(db.Integer)
    coordinates = db.Column(db.Text)  # JSON string
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    officer = db.relationship('User', backref='assigned_claims')
    
    def to_dict(self):
        return {
            'id': self.id,
            'claimId': self.claim_id,
            'claimantName': self.claimant_name,
            'location': self.location,
            'district': self.district,
            'state': self.state,
            'area': float(self.area),
            'landType': self.land_type,
            'status': self.status,
            'dateSubmitted': self.date_submitted.isoformat() if self.date_submitted else None,
            'dateProcessed': self.date_processed.isoformat() if self.date_processed else None,
            'assignedOfficer': self.assigned_officer,
            'familyMembers': self.family_members,
            'coordinates': json.loads(self.coordinates) if self.coordinates else None,
            'notes': self.notes,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }

# Documents table
class Document(db.Model):
    __tablename__ = 'documents'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    claim_id = db.Column(db.String(36), db.ForeignKey('claims.id'))
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    file_type = db.Column(db.String(100), nullable=False)
    file_size = db.Column(db.Integer, nullable=False)
    upload_path = db.Column(db.String(500))
    file_content = db.Column(db.LargeBinary)  # Store file content in database
    ocr_status = db.Column(db.String(50), nullable=False)  # pending, processing, completed, failed
    ocr_text = db.Column(db.Text)
    extracted_data = db.Column(db.Text)  # JSON string
    confidence = db.Column(db.Numeric(5, 2))
    review_status = db.Column(db.String(50), default='pending')  # pending, approved, rejected
    reviewed_by = db.Column(db.String(36), db.ForeignKey('users.id'))
    uploaded_by = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    claim = db.relationship('Claim', backref='documents')
    reviewer = db.relationship('User', foreign_keys=[reviewed_by], backref='reviewed_documents')
    uploader = db.relationship('User', foreign_keys=[uploaded_by], backref='uploaded_documents')
    
    def to_dict(self, include_content=False):
        result = {
            'id': self.id,
            'claimId': self.claim_id,
            'filename': self.filename,
            'originalFilename': self.original_filename,
            'fileType': self.file_type,
            'fileSize': self.file_size,
            'uploadPath': self.upload_path,
            'ocrStatus': self.ocr_status,
            'ocrText': self.ocr_text,
            'extractedData': json.loads(self.extracted_data) if self.extracted_data else None,
            'confidence': float(self.confidence) if self.confidence else None,
            'reviewStatus': self.review_status,
            'reviewedBy': self.reviewed_by,
            'uploadedBy': self.uploaded_by,
            'createdAt': self.created_at.isoformat() if self.created_at else None,
            'updatedAt': self.updated_at.isoformat() if self.updated_at else None
        }
        if include_content and self.file_content:
            result['fileContent'] = base64.b64encode(self.file_content).decode('utf-8')
        return result

# Audit Log table
class AuditLogEntry(db.Model):
    __tablename__ = 'audit_log'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    action = db.Column(db.String(100), nullable=False)
    resource_type = db.Column(db.String(100), nullable=False)
    resource_id = db.Column(db.String(36), nullable=False)
    changes = db.Column(db.Text)  # JSON string
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User', backref='audit_entries')
    
    def to_dict(self):
        return {
            'id': self.id,
            'userId': self.user_id,
            'action': self.action,
            'resourceType': self.resource_type,
            'resourceId': self.resource_id,
            'changes': json.loads(self.changes) if self.changes else None,
            'ipAddress': self.ip_address,
            'userAgent': self.user_agent,
            'createdAt': self.created_at.isoformat() if self.created_at else None
        }

def init_db(app):
    """Initialize database with tables and seed data"""
    with app.app_context():
        # Create all tables
        db.create_all()
        print("📊 Database tables created")
        
        # Check if we need to seed data
        if State.query.first() is None:
            print("🌱 Seeding database with initial data...")
            seed_database()
        else:
            print("✅ Database already has data, skipping seed")

def seed_database():
    """Seed database with initial data"""
    try:
        # Seed states
        states_data = [
            {'id': 1, 'name': 'Madhya Pradesh', 'code': 'MP', 'language': 'Hindi'},
            {'id': 2, 'name': 'Odisha', 'code': 'OR', 'language': 'Odia'},
            {'id': 3, 'name': 'Telangana', 'code': 'TG', 'language': 'Telugu'},
            {'id': 4, 'name': 'Tripura', 'code': 'TR', 'language': 'Bengali'},
            {'id': 5, 'name': 'Maharashtra', 'code': 'MH', 'language': 'Marathi'},
            {'id': 6, 'name': 'Gujarat', 'code': 'GJ', 'language': 'Gujarati'},
        ]
        
        for state_data in states_data:
            state = State(**state_data)
            db.session.add(state)
        
        # Seed districts
        districts_data = [
            {'id': 1, 'name': 'Mandla', 'state_id': 1},
            {'id': 2, 'name': 'Balaghat', 'state_id': 1},
            {'id': 3, 'name': 'Mayurbhanj', 'state_id': 2},
            {'id': 4, 'name': 'Keonjhar', 'state_id': 2},
            {'id': 5, 'name': 'Adilabad', 'state_id': 3},
            {'id': 6, 'name': 'Warangal', 'state_id': 3},
        ]
        
        for district_data in districts_data:
            district = District(**district_data)
            db.session.add(district)
        
        # Seed demo users
        demo_users = [
            {
                'id': 'admin-1',
                'username': 'ministry.admin',
                'email': 'admin@tribal.gov.in',
                'password': 'admin123',
                'full_name': 'Ministry Administrator',
                'role': 'ministry',
                'state_id': None,
                'district_id': None,
                'is_active': True
            },
            {
                'id': 'state-1',
                'username': 'mp.admin',
                'email': 'mp@tribal.gov.in',
                'password': 'state123',
                'full_name': 'MP State Administrator',
                'role': 'state',
                'state_id': 1,
                'district_id': None,
                'is_active': True
            },
            {
                'id': 'district-1',
                'username': 'district.officer',
                'email': 'district@tribal.gov.in',
                'password': 'district123',
                'full_name': 'District Officer',
                'role': 'district',
                'state_id': 1,
                'district_id': 1,
                'is_active': True
            },
            {
                'id': 'village-1',
                'username': 'village.officer',
                'email': 'village@tribal.gov.in',
                'password': 'village123',
                'full_name': 'Village Officer',
                'role': 'village',
                'state_id': 1,
                'district_id': 1,
                'is_active': True
            }
        ]
        
        for user_data in demo_users:
            password = user_data.pop('password')
            user = User(**user_data)
            user.set_password(password)
            db.session.add(user)
        
        db.session.commit()
        print("✅ Database seeded successfully!")
        print("👥 Demo users created:")
        print("   - ministry.admin / admin123 (Ministry Administrator)")
        print("   - mp.admin / state123 (MP State Administrator)")
        print("   - district.officer / district123 (District Officer)")
        print("   - village.officer / village123 (Village Officer)")
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error seeding database: {e}")
        raise