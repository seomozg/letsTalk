#!/bin/bash

# Fly.io deployment script for AI Audio Chat
set -e

echo "🚀 Deploying AI Audio Chat to Fly.io..."

# Check if fly CLI is installed
if ! command -v fly &> /dev/null; then
    echo "❌ Fly CLI not found!"
    echo "💡 Install it from: https://fly.io/docs/getting-started/installing-flyctl/"
    exit 1
fi

# Check if user is logged in
if ! fly auth whoami &> /dev/null; then
    echo "❌ Not logged in to Fly.io!"
    echo "💡 Run: fly auth login"
    exit 1
fi

# Check if app exists, create if not
if ! fly apps list | grep -q "letstalk"; then
    echo "📦 Creating Fly.io app..."
    fly apps create letstalk --org personal
fi

# Build and deploy
echo "🏗️  Building and deploying..."
fly deploy

echo "✅ Deployment complete!"
echo "🌐 Your app is available at: $(fly apps list | grep letstalk | awk '{print $2}')"
echo ""
echo "📊 View logs: fly logs"
echo "🛑 Stop app: fly apps destroy letstalk"
