# 🐍 Flask Backend - Python + JavaScript

Your application has been successfully converted to **Python Flask backend** while keeping the **exact same React UI**! 

## 🚀 How to Run

### Option 1: Quick Start (Recommended)
```bash
python start-flask-backend.py
```

### Option 2: Manual Start
```bash
cd flask-backend
python app.py
```

## 📱 Same UI, Python Backend!

- **Frontend**: Unchanged React app with same UI
- **Backend**: Converted from Node.js/Express to Python Flask
- **Database**: SQLite (for easy development) 
- **API Endpoints**: Identical to previous Node.js version

## 👥 Demo Login Accounts

| Username | Password | Role |
|----------|----------|------|
| `ministry.admin` | `admin123` | Ministry Administrator |
| `mp.admin` | `state123` | MP State Administrator |
| `district.officer` | `district123` | District Officer |
| `village.officer` | `village123` | Village Officer |

## 🌐 Access Your App

Once running, open: **http://localhost:5000**

## ✨ What's Included

### 🔧 Full API Compatibility
- ✅ Authentication (login/logout/session)
- ✅ Claims management (create, view, approve, reject)
- ✅ Document upload with OCR processing
- ✅ Bulk import/export functionality
- ✅ Dashboard analytics
- ✅ State/District data management
- ✅ Audit logging
- ✅ File handling and downloads

### 🗂️ Backend Structure
```
flask-backend/
├── app.py          # Flask application entry point
├── models.py       # Database models (SQLAlchemy)
├── routes.py       # API endpoints (Flask routes)
├── run_flask.py    # Alternative runner
└── requirements.txt # Python dependencies
```

## 🔄 Switching Between Backends

**Flask Backend (Python):**
```bash
python start-flask-backend.py
```

**Original Backend (Node.js):**
```bash
npm run dev
```

---

**Both backends provide the exact same functionality and UI!** Choose the one you prefer to work with. 🎉