#!/bin/bash

# Quick fix script for Docker + Ollama connectivity issues
# Government Analytics Dashboard

echo "🔧 Docker + Ollama Quick Fix Script"
echo "===================================="
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check Docker
if ! command_exists docker; then
    echo "❌ Docker not found. Please install Docker first."
    exit 1
fi

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

echo "✅ Docker is running"

# Check if we're on Windows/Mac or Linux
OS="$(uname -s)"
case "${OS}" in
    Linux*)     MACHINE=Linux;;
    Darwin*)    MACHINE=Mac;;
    CYGWIN*|MINGW*|MSYS*) MACHINE=Windows;;
    *)          MACHINE="Unknown";;
esac

echo "📋 Detected OS: $MACHINE"

# Set appropriate Ollama URL based on OS
if [ "$MACHINE" = "Linux" ]; then
    OLLAMA_URL="http://172.17.0.1:11434"
    HOST_COMMAND="ip route show default | awk '/default/ {print \$3}'"
    DOCKER_HOST=$(ip route show default | awk '/default/ {print $3}')
else
    OLLAMA_URL="http://host.docker.internal:11434"
    HOST_COMMAND="host.docker.internal"
    DOCKER_HOST="host.docker.internal"
fi

echo "🔗 Using Ollama URL: $OLLAMA_URL"

# Test if Ollama is accessible from host
echo ""
echo "🧪 Testing Ollama accessibility..."

if command_exists curl; then
    if curl -s http://localhost:11434/api/version >/dev/null 2>&1; then
        echo "✅ Ollama is running on host (localhost:11434)"
        HOST_OLLAMA=true
    else
        echo "❌ Ollama not accessible on localhost:11434"
        HOST_OLLAMA=false
    fi
else
    echo "⚠️  curl not found, skipping host test"
    HOST_OLLAMA=false
fi

# Check if there's a backend container running
BACKEND_CONTAINER=$(docker ps --filter "name=backend" --filter "name=analytics" --format "{{.Names}}" | head -n1)

if [ -n "$BACKEND_CONTAINER" ]; then
    echo "✅ Found backend container: $BACKEND_CONTAINER"
    
    # Test connection from container
    echo "🔍 Testing connection from container..."
    
    if docker exec "$BACKEND_CONTAINER" curl -s --connect-timeout 3 "$OLLAMA_URL/api/version" >/dev/null 2>&1; then
        echo "✅ Container can reach Ollama at $OLLAMA_URL"
        CONNECTION_OK=true
    else
        echo "❌ Container cannot reach Ollama at $OLLAMA_URL"
        CONNECTION_OK=false
    fi
else
    echo "⚠️  No backend container found"
    CONNECTION_OK=false
fi

echo ""
echo "📋 Diagnostic Results:"
echo "----------------------"
echo "Host Ollama Running: $HOST_OLLAMA"
echo "Container Connection: $CONNECTION_OK"
echo "Recommended URL: $OLLAMA_URL"

# Provide solutions
echo ""
echo "🚀 Solutions:"
echo "============="

if [ "$HOST_OLLAMA" = false ]; then
    echo ""
    echo "1️⃣ INSTALL OLLAMA (if not installed):"
    echo "   curl -fsSL https://ollama.ai/install.sh | sh"
    echo ""
    echo "2️⃣ START OLLAMA:"
    echo "   ollama serve"
    echo ""
fi

if [ "$CONNECTION_OK" = false ] && [ "$HOST_OLLAMA" = true ]; then
    echo ""
    echo "3️⃣ FIX DOCKER CONFIGURATION:"
    echo ""
    
    # Check if docker-compose.yml exists
    if [ -f "docker-compose.yml" ]; then
        echo "   Option A: Update your docker-compose.yml"
        echo "   Add this to your backend service environment:"
        echo ""
        echo "   environment:"
        echo "     - OLLAMA_URL=$OLLAMA_URL"
        echo "     - DOCKER_ENV=true"
        echo ""
        echo "   Then run: docker-compose restart backend"
        echo ""
    fi
    
    echo "   Option B: Set environment variable"
    echo "   export OLLAMA_URL=$OLLAMA_URL"
    echo "   docker-compose restart backend"
    echo ""
    
    echo "   Option C: Use complete Docker setup (recommended)"
    echo "   docker-compose -f docker-compose.ollama.yml up -d"
    echo ""
fi

# Check for docker-compose.ollama.yml
if [ -f "docker-compose.ollama.yml" ]; then
    echo "4️⃣ USE COMPLETE DOCKER SETUP (RECOMMENDED):"
    echo "   This will run Ollama inside Docker too:"
    echo ""
    echo "   # Stop current containers"
    echo "   docker-compose down"
    echo ""
    echo "   # Start complete stack"
    echo "   docker-compose -f docker-compose.ollama.yml up -d"
    echo ""
    echo "   # Install models"
    echo "   docker exec analytics-ollama ollama pull phi"
    echo ""
fi

# Generate a quick fix command
echo ""
echo "⚡ QUICK FIX COMMAND:"
echo "===================="

if [ -f "docker-compose.yml" ] && [ -n "$BACKEND_CONTAINER" ]; then
    echo "Run this command to try the quick fix:"
    echo ""
    echo "docker-compose stop backend && \\"
    echo "OLLAMA_URL=$OLLAMA_URL docker-compose up -d backend"
    echo ""
    echo "Then check the dashboard Local AI Models section."
fi

echo ""
echo "📚 For detailed help, see:"
echo "   - DOCKER_OLLAMA_SETUP.md"
echo "   - LOCAL_AI_SETUP.md"
echo ""
echo "🔧 If you're still having issues, run the diagnostics in the dashboard:"
echo "   Dashboard > Local AI Models > Run Diagnostics" 