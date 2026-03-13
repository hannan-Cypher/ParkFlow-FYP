#!/bin/bash

echo "=========================================="
echo "    ParkFlow FYP - Setup Dependencies     "
echo "=========================================="
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null
then
    echo "[ERROR] npm is not installed. Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Check if python3 is installed
if ! command -v python3 &> /dev/null
then
    echo "[ERROR] python3 is not installed. Please install Python 3 from https://www.python.org/downloads/"
    exit 1
fi

echo "[1/4] Installing Next.js Frontend Dependencies..."
# Install Node modules
npm install
if [ $? -eq 0 ]; then
    echo "✔ Frontend dependencies installed successfully."
else
    echo "❌ Failed to install frontend dependencies."
    exit 1
fi

echo ""
echo "[2/4] Setting up Python Virtual Environment in 'model' directory..."
cd model

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✔ Virtual environment 'venv' created."
else
    echo "✔ Virtual environment 'venv' already exists."
fi

echo ""
echo "[3/4] Activating Virtual Environment and Installing Python Dependencies..."
# Activate venv
source venv/bin/activate

# Upgrade pip and install requirements
pip install --upgrade pip
pip install -r requirements.txt

if [ $? -eq 0 ]; then
    echo "✔ Backend dependencies installed successfully."
else
    echo "❌ Failed to install backend dependencies."
    exit 1
fi

echo ""
echo "[4/4] Pre-warming Fast-Plate-OCR model weights..."
# Run a quick script to download ONNX weights so they don't download during the first request
python -c "
try:
    from fast_plate_ocr import LicensePlateRecognizer
    print('Downloading fast-plate-ocr weights if not present...')
    model = LicensePlateRecognizer(hub_ocr_model='global-plates-mobile-vit-v2-model', device='cpu')
    print('✔ fast-plate-ocr model ready.')
except ImportError:
    pass
"

# Deactivate venv
deactivate
cd ..

echo ""
echo "=========================================="
echo "          Setup Complete!                 "
echo "=========================================="
echo ""
echo "To run the project:"
echo "1. Terminal 1 (Frontend): npm run dev"
echo "2. Terminal 2 (Backend):  cd model && source venv/bin/activate && python app.py"
echo ""
echo "Please read SETUP_GUIDE.md for detailed instructions."
sleep 2
