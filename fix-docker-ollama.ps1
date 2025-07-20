# Quick fix script for Docker + Ollama connectivity issues (Windows)
# Government Analytics Dashboard

Write-Host "🔧 Docker + Ollama Quick Fix Script (Windows)" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# Function to test if command exists
function Test-Command($Command) {
    try {
        if (Get-Command $Command -ErrorAction SilentlyContinue) {
            return $true
        }
        return $false
    }
    catch {
        return $false
    }
}

# Check Docker
if (-not (Test-Command "docker")) {
    Write-Host "❌ Docker not found. Please install Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
}
catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

Write-Host "📋 Detected OS: Windows" -ForegroundColor Blue

# For Windows, use host.docker.internal
$OLLAMA_URL = "http://host.docker.internal:11434"

Write-Host "🔗 Using Ollama URL: $OLLAMA_URL" -ForegroundColor Blue

# Test if Ollama is accessible from host
Write-Host ""
Write-Host "🧪 Testing Ollama accessibility..." -ForegroundColor Yellow

$HOST_OLLAMA = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:11434/api/version" -TimeoutSec 3 -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Ollama is running on host (localhost:11434)" -ForegroundColor Green
        $HOST_OLLAMA = $true
    }
}
catch {
    Write-Host "❌ Ollama not accessible on localhost:11434" -ForegroundColor Red
    $HOST_OLLAMA = $false
}

# Check if there's a backend container running
$BACKEND_CONTAINER = docker ps --filter "name=backend" --filter "name=analytics" --format "{{.Names}}" | Select-Object -First 1

$CONNECTION_OK = $false
if ($BACKEND_CONTAINER) {
    Write-Host "✅ Found backend container: $BACKEND_CONTAINER" -ForegroundColor Green
    
    # Test connection from container
    Write-Host "🔍 Testing connection from container..." -ForegroundColor Yellow
    
    try {
        $testResult = docker exec $BACKEND_CONTAINER curl -s --connect-timeout 3 "$OLLAMA_URL/api/version" 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Container can reach Ollama at $OLLAMA_URL" -ForegroundColor Green
            $CONNECTION_OK = $true
        }
        else {
            Write-Host "❌ Container cannot reach Ollama at $OLLAMA_URL" -ForegroundColor Red
            $CONNECTION_OK = $false
        }
    }
    catch {
        Write-Host "❌ Container cannot reach Ollama at $OLLAMA_URL" -ForegroundColor Red
        $CONNECTION_OK = $false
    }
}
else {
    Write-Host "⚠️  No backend container found" -ForegroundColor Yellow
    $CONNECTION_OK = $false
}

Write-Host ""
Write-Host "📋 Diagnostic Results:" -ForegroundColor Blue
Write-Host "----------------------" -ForegroundColor Blue
Write-Host "Host Ollama Running: $HOST_OLLAMA" -ForegroundColor White
Write-Host "Container Connection: $CONNECTION_OK" -ForegroundColor White
Write-Host "Recommended URL: $OLLAMA_URL" -ForegroundColor White

# Provide solutions
Write-Host ""
Write-Host "🚀 Solutions:" -ForegroundColor Green
Write-Host "=============" -ForegroundColor Green

if (-not $HOST_OLLAMA) {
    Write-Host ""
    Write-Host "1️⃣ INSTALL OLLAMA (if not installed):" -ForegroundColor Yellow
    Write-Host "   Download from: https://ollama.ai/download/windows" -ForegroundColor White
    Write-Host "   Or run the setup script: .\setup-ollama.ps1" -ForegroundColor White
    Write-Host ""
    Write-Host "2️⃣ START OLLAMA:" -ForegroundColor Yellow
    Write-Host "   ollama serve" -ForegroundColor White
    Write-Host ""
}

if (-not $CONNECTION_OK -and $HOST_OLLAMA) {
    Write-Host ""
    Write-Host "3️⃣ FIX DOCKER CONFIGURATION:" -ForegroundColor Yellow
    Write-Host ""
    
    # Check if docker-compose.yml exists
    if (Test-Path "docker-compose.yml") {
        Write-Host "   Option A: Update your docker-compose.yml" -ForegroundColor Cyan
        Write-Host "   Add this to your backend service environment:" -ForegroundColor White
        Write-Host ""
        Write-Host "   environment:" -ForegroundColor Gray
        Write-Host "     - OLLAMA_URL=$OLLAMA_URL" -ForegroundColor Gray
        Write-Host "     - DOCKER_ENV=true" -ForegroundColor Gray
        Write-Host ""
        Write-Host "   Then run: docker-compose restart backend" -ForegroundColor White
        Write-Host ""
    }
    
    Write-Host "   Option B: Set environment variable" -ForegroundColor Cyan
    Write-Host "   `$env:OLLAMA_URL='$OLLAMA_URL'" -ForegroundColor Gray
    Write-Host "   docker-compose restart backend" -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "   Option C: Use complete Docker setup (recommended)" -ForegroundColor Cyan
    Write-Host "   docker-compose -f docker-compose.ollama.yml up -d" -ForegroundColor Gray
    Write-Host ""
}

# Check for docker-compose.ollama.yml
if (Test-Path "docker-compose.ollama.yml") {
    Write-Host "4️⃣ USE COMPLETE DOCKER SETUP (RECOMMENDED):" -ForegroundColor Yellow
    Write-Host "   This will run Ollama inside Docker too:" -ForegroundColor White
    Write-Host ""
    Write-Host "   # Stop current containers" -ForegroundColor Gray
    Write-Host "   docker-compose down" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   # Start complete stack" -ForegroundColor Gray
    Write-Host "   docker-compose -f docker-compose.ollama.yml up -d" -ForegroundColor Gray
    Write-Host ""
    Write-Host "   # Install models" -ForegroundColor Gray
    Write-Host "   docker exec analytics-ollama ollama pull phi" -ForegroundColor Gray
    Write-Host ""
}

# Generate a quick fix command
Write-Host ""
Write-Host "⚡ QUICK FIX COMMAND:" -ForegroundColor Magenta
Write-Host "====================" -ForegroundColor Magenta

if ((Test-Path "docker-compose.yml") -and $BACKEND_CONTAINER) {
    Write-Host "Run this command to try the quick fix:" -ForegroundColor White
    Write-Host ""
    Write-Host "`$env:OLLAMA_URL='$OLLAMA_URL'" -ForegroundColor Yellow
    Write-Host "docker-compose restart backend" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Then check the dashboard Local AI Models section." -ForegroundColor White
}

Write-Host ""
Write-Host "📚 For detailed help, see:" -ForegroundColor Blue
Write-Host "   - DOCKER_OLLAMA_SETUP.md" -ForegroundColor White
Write-Host "   - LOCAL_AI_SETUP.md" -ForegroundColor White
Write-Host ""
Write-Host "🔧 If you're still having issues, run the diagnostics in the dashboard:" -ForegroundColor Blue
Write-Host "   Dashboard > Local AI Models > Run Diagnostics" -ForegroundColor White

Write-Host ""
Write-Host "Press any key to continue..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown") 