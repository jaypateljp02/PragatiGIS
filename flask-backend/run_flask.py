#!/usr/bin/env python3
"""
Flask Application Runner
Run this to start the Flask backend server
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"🐍 Starting Flask backend on port {port}")
    print("🌐 Open http://localhost:5000 to view the application")
    print("👥 Demo users:")
    print("   - ministry.admin / admin123")
    print("   - mp.admin / state123") 
    print("   - district.officer / district123")
    print("   - village.officer / village123")
    print("")
    
    app.run(host='0.0.0.0', port=port, debug=True)