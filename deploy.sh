#!/usr/bin/env bash

# Deploy script for AI Audio Chat
set -e

echo "🚀 Deploying AI Audio Chat..."

# Check if .env file exists
# if [ ! -f .env ]; then
#     echo "❌ .env file not found!"
#     echo "📝 Copy .env.example to .env and fill in your API keys (GEMINI_API_KEY, KIE_API_KEY)"
#     exit 1
# fi

# Load environment variables
# set -a
# . .env
# set +a
# Environment variables should be loaded by docker-compose from .env file

# API key checks removed - assuming .env is properly configured
# Docker-compose will load environment from .env file

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
