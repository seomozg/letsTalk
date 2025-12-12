#!/bin/bash

# Deploy script for AI Audio Chat
set -e

echo "🚀 Deploying AI Audio Chat..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "📝 Copy .env.template to .env and fill in your API key"
    exit 1
fi

# Load environment variables
set -a
source .env
set +a

# Check if GEMINI_API_KEY is set
if [ -z "$GEMINI_API_KEY" ] || [ "$GEMINI_API_KEY" = "your_gemini_api_key_here" ]; then
    echo "❌ GEMINI_API_KEY not set in .env file!"
    echo "📝 Get your API key from https://aistudio.google.com/app/apikey"
    exit 1
fi

echo "📦 Building and starting containers..."

# For production deployment (with HTTPS)
if [ "$1" = "prod" ]; then
    echo "🔒 Production mode - make sure SSL certificates are in nginx/ssl/"
    if [ ! -f "nginx/ssl/cert.pem" ] || [ ! -f "nginx/ssl/key.pem" ]; then
        echo "⚠️  SSL certificates not found in nginx/ssl/"
        echo "💡 For development, you can use Let's Encrypt or self-signed certificates"
        echo "   Continuing anyway..."
    fi
    docker-compose --profile prod up -d --build
    echo "✅ Production deployment complete!"
    echo "🌐 Your app should be available at https://your-domain.com"
else
    echo "🧪 Development mode"
    docker-compose up -d --build
    echo "✅ Development deployment complete!"
    echo "🌐 Your app should be available at http://localhost:8000"
fi

echo "📊 Container status:"
docker-compose ps

echo ""
echo "🔍 To view logs: docker-compose logs -f"
echo "⏹️  To stop: docker-compose down"
