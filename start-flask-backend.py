#!/usr/bin/env python3
"""
Quick Flask Backend Starter
Runs the Flask backend server with the same UI
"""

import os
import sys
import subprocess

def main():
    print("🐍 Python Flask Backend Starter")
    print("=" * 50)
    
    # Check if Python is available
    try:
        python_version = subprocess.check_output([sys.executable, '--version'], text=True).strip()
        print(f"✅ {python_version}")
    except:
        print("❌ Python not found")
        return
    
    # Check if we're in the right directory
    flask_backend_dir = os.path.join(os.getcwd(), 'flask-backend')
    if not os.path.exists(flask_backend_dir):
        print("❌ flask-backend directory not found")
        print("Please run this script from the project root directory")
        return
    
    print("📁 Flask backend directory found")
    
    # Change to flask-backend directory
    os.chdir(flask_backend_dir)
    
    # Set environment variables
    os.environ['FLASK_APP'] = 'app.py'
    os.environ['FLASK_ENV'] = 'development'
    
    print("🚀 Starting Flask backend server...")
    print("📱 Same UI, Python Backend!")
    print("")
    print("🌐 Open http://localhost:5000 in your browser")
    print("")
    print("👥 Demo Login Accounts:")
    print("   Username: ministry.admin    | Password: admin123")
    print("   Username: mp.admin          | Password: state123") 
    print("   Username: district.officer  | Password: district123")
    print("   Username: village.officer   | Password: village123")
    print("")
    print("Press Ctrl+C to stop the server")
    print("=" * 50)
    
    try:
        # Start Flask application
        subprocess.run([sys.executable, 'app.py'], check=True)
    except KeyboardInterrupt:
        print("\n👋 Flask server stopped by user")
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Flask server failed to start: {e}")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")

if __name__ == '__main__':
    main()