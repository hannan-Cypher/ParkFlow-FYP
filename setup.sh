#!/bin/bash
set -e

echo "=== ParkFlow Automated Setup ==="

# 1. System Dependency Checks
echo "[1/4] Checking system dependencies..."

if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed. Please install it from https://nodejs.org/"
    exit 1
else
    echo "✅ Node.js found."
fi

if ! command -v python3 &> /dev/null; then
    echo "❌ Error: Python 3 is not installed. Please install it from https://www.python.org/downloads/"
    exit 1
else
    echo "✅ Python 3 found."
fi

if ! command -v ffmpeg &> /dev/null; then
    echo "⚠️ Warning: FFmpeg is not installed. The camera streamer requires FFmpeg for RTSP video capture."
    echo "   Mac: brew install ffmpeg"
    echo "   Linux: sudo apt install ffmpeg"
else
    echo "✅ FFmpeg found."
fi

if ! command -v psql &> /dev/null; then
    echo "⚠️ Warning: PostgreSQL is not installed or psql is not in PATH. You'll need it for the database."
else
    echo "✅ PostgreSQL found."
fi

# 2. Frontend Dependencies
echo ""
echo "[2/4] Installing Next.js frontend dependencies..."
npm install

# 3. Backend Dependencies
echo ""
echo "[3/4] Setting up Python backend..."
cd model

if [ ! -d "venv" ]; then
    echo "Creating virtual environment 'venv'..."
    python3 -m venv venv
else
    echo "Virtual environment 'venv' already exists."
fi

echo "Activating virtual environment and installing python packages..."
source venv311/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
cd ..

# 4. Environment Variables
echo ""
echo "[4/4] Setting up environment variables..."
if [ ! -f ".env" ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "⚠️ PLEASE NOTE: You need to open the .env file and configure your local PostgreSQL database credentials."
else
    echo ".env file already exists."
fi

echo ""
echo "=== Setup Sequence Complete! ==="
echo "Check SETUP_GUIDE.md for details on database migrations and running the project."
