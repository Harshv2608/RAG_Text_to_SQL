FROM python:3.11-slim

WORKDIR /ai_service

# Install dependencies for postgres
RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --default-timeout=100 --no-cache-dir -r requirements.txt

# Create necessary directories
RUN mkdir -p /ai_service/data

COPY . .

ENV PYTHONPATH=/ai_service

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
