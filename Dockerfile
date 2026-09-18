FROM python:3.12-slim

# Prevent Python from writing .pyc and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies if required
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code and frontend assets
COPY backend/ ./backend/
COPY index.html ./
COPY style.css ./
COPY app.js ./
COPY auth.js ./
COPY .env.example ./.env

EXPOSE 8000

# Run FastAPI backend (serving both REST API and web UI)
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
