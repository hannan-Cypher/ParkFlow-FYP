FROM python:3.11-slim

# Install system dependencies for OpenCV and YOLOv8
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the model code
COPY . .

# Set environment variables
ENV PYTORCH_ENABLE_MPS_FALLBACK=1
ENV STREAMER_PORT=8081

# Expose the streamer port
EXPOSE 8081

# Run the camera streamer
CMD ["python", "camera_streamer.py"]
