# ParkFlow Setup Guide

Welcome to the ParkFlow project! This guide will help you install all the necessary dependencies and get the project running on your local machine.

## Prerequisites

Before running the setup, ensure you have the following installed on your system:
1. **Node.js & npm** (v18 or higher recommended): [Download Here](https://nodejs.org/)
2. **Python 3** (v3.10 or higher recommended): [Download Here](https://www.python.org/downloads/)

## Installation (Automated)

We have provided a bash script that will automatically install all dependencies for both the frontend and the backend.

1. Open your terminal and navigate to the root directory of the project (`ParkFlow-FYP-main`).
2. Make the script executable by running:
   ```bash
   chmod +x setup.sh
   ```
3. Run the setup script:
   ```bash
   ./setup.sh
   ```

The script will:
- Run `npm install` for the Next.js frontend.
- Create a Python virtual environment (`venv`) inside the `model/` directory.
- Install all backend dependencies via `pip` from `model/requirements.txt`.
- Pre-download the fast-plate-ocr ONNX weights so your first API call doesn't time out.

## Installation (Manual)

If you prefer to install things manually, follow these steps:

### 1. Frontend Setup
```bash
# In the root project directory
npm install
```

### 2. Backend Setup
```bash
# Navigate to the model directory
cd model

# Create a virtual environment
python3 -m venv venv

# Activate the virtual environment
# On Mac/Linux:
source venv/bin/activate
# On Windows (Command Prompt):
# venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt
```

---

## Running the Project

To run the project, you need to start both the frontend and the backend servers in two separate terminal windows.

### Terminal 1: Next.js Frontend
```bash
# In the root project directory
npm run dev
```
The frontend will be available at `http://localhost:3000`.

### Terminal 2: Python AI Backend
```bash
# In the root project directory
cd model

# Activate the virtual environment
source venv311/bin/activate

# Start the Flask API
python app.py
```
The backend API will run on `http://localhost:8080`.

---

## Troubleshooting

- **Operation not permitted on Mac:** 
  If you get permission errors when running the script, make sure you ran `chmod +x setup.sh`.
- **Missing python3 command:**
  Make sure Python is added to your system PATH during installation.
- **Port already in use:**
  If port 3000 or 8080 is already in use, you can terminate the existing processes or change the ports in the respective configurations (`package.json` and `app.py`).
