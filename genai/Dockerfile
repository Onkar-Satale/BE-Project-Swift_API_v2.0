FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Environment configuration
ENV PYTHONUNBUFFERED=1

# Install dependencies (leverages layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . .

EXPOSE 8000

# Start Uvicorn server using dynamic environment PORT
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]