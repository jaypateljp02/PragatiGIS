#!/usr/bin/env python3
"""
Flask Backend Entry Point
Starts the Flask server for FRA Atlas Platform
"""
import os
import sys
from pathlib import Path

# Add the parent directory to the path so we can import from flask_backend
sys.path.insert(0, str(Path(__file__).parent.parent))

from flask_backend.app import app

if __name__ == '__main__':
    # Set environment variables
    os.environ.setdefault('FLASK_ENV', 'development')
    os.environ.setdefault('FLASK_DEBUG', '1')
    
    print("Starting FRA Atlas Flask Backend...")
    print(f"Server will be available at: http://localhost:3000")
    
    # Run the Flask app on localhost:5050 for proxy
    app.run(
        host='127.0.0.1',
        port=5050,
        debug=True,
        threaded=True
    )