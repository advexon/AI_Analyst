# Ollama Installation Script for Government Analytics Dashboard
# This script installs Ollama and recommended AI models for secure, local analysis

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "    Government Analytics Dashboard - Local AI Setup" -ForegroundColor Cyan
Write-Host "    Secure, Private AI Models for Government Data Analysis" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")

if (-not $isAdmin) {
    Write-Host "⚠️  This script requires administrator privileges." -ForegroundColor Yellow
    Write-Host "   Please run PowerShell as Administrator and try again." -ForegroundColor Yellow
    Read-Host "Press any key to exit"
    exit 1
}

Write-Host "✅ Running with administrator privileges" -ForegroundColor Green
Write-Host ""

# Function to check if Ollama is already installed
function Test-OllamaInstalled {
    try {
        $ollamaPath = Get-Command ollama -ErrorAction SilentlyContinue
        return $null -ne $ollamaPath
    }
    catch {
        return $false
    }
}

# Function to download and install Ollama
function Install-Ollama {
    Write-Host "📦 Installing Ollama..." -ForegroundColor Blue
    
    $ollamaUrl = "https://ollama.ai/download/windows"
    $tempPath = "$env:TEMP\OllamaSetup.exe"
    
    try {
        Write-Host "   Downloading Ollama installer..." -ForegroundColor Gray
        Invoke-WebRequest -Uri $ollamaUrl -OutFile $tempPath -UseBasicParsing
        
        Write-Host "   Running Ollama installer..." -ForegroundColor Gray
        Start-Process -FilePath $tempPath -ArgumentList "/S" -Wait
        
        Write-Host "   Cleaning up installer..." -ForegroundColor Gray
        Remove-Item $tempPath -Force -ErrorAction SilentlyContinue
        
        Write-Host "✅ Ollama installed successfully!" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "❌ Failed to install Ollama: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Function to wait for Ollama service to start
function Wait-OllamaService {
    Write-Host "⏳ Waiting for Ollama service to start..." -ForegroundColor Blue
    
    $maxAttempts = 30
    $attempt = 0
    
    do {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:11434/api/version" -UseBasicParsing -TimeoutSec 2
            if ($response.StatusCode -eq 200) {
                Write-Host "✅ Ollama service is running!" -ForegroundColor Green
                return $true
            }
        }
        catch {
            Start-Sleep -Seconds 2
            $attempt++
            Write-Host "   Attempt $attempt/$maxAttempts..." -ForegroundColor Gray
        }
    } while ($attempt -lt $maxAttempts)
    
    Write-Host "❌ Ollama service failed to start within 60 seconds" -ForegroundColor Red
    return $false
}

# Function to install AI models
function Install-AIModels {
    Write-Host "🤖 Installing recommended AI models..." -ForegroundColor Blue
    Write-Host "   This may take several minutes depending on your internet speed." -ForegroundColor Gray
    Write-Host ""
    
    $models = @(
        @{ Name = "phi"; Size = "1.7GB"; Description = "Small, fast model - perfect for quick analysis" },
        @{ Name = "llama2"; Size = "3.8GB"; Description = "Meta's Llama 2 - excellent general purpose model" },
        @{ Name = "mistral"; Size = "4.1GB"; Description = "Efficient European AI model" }
    )
    
    foreach ($model in $models) {
        Write-Host "📥 Installing $($model.Name) ($($model.Size))..." -ForegroundColor Cyan
        Write-Host "   $($model.Description)" -ForegroundColor Gray
        
        try {
            $process = Start-Process -FilePath "ollama" -ArgumentList "pull", $model.Name -PassThru -Wait -NoNewWindow
            if ($process.ExitCode -eq 0) {
                Write-Host "✅ $($model.Name) installed successfully!" -ForegroundColor Green
            }
            else {
                Write-Host "⚠️  $($model.Name) installation may have issues (exit code: $($process.ExitCode))" -ForegroundColor Yellow
            }
        }
        catch {
            Write-Host "❌ Failed to install $($model.Name): $($_.Exception.Message)" -ForegroundColor Red
        }
        Write-Host ""
    }
}

# Function to test model functionality
function Test-Models {
    Write-Host "🧪 Testing installed models..." -ForegroundColor Blue
    
    try {
        Write-Host "   Testing phi model..." -ForegroundColor Gray
        $testPrompt = "Hello! Please respond with 'Test successful' to confirm you are working."
        
        $process = Start-Process -FilePath "ollama" -ArgumentList "run", "phi", $testPrompt -PassThru -Wait -NoNewWindow -RedirectStandardOutput "$env:TEMP\ollama_test.txt"
        
        if ($process.ExitCode -eq 0) {
            $response = Get-Content "$env:TEMP\ollama_test.txt" -Raw
            Write-Host "✅ Model test successful!" -ForegroundColor Green
            Write-Host "   Response: $($response.Substring(0, [Math]::Min(100, $response.Length)))..." -ForegroundColor Gray
        }
        else {
            Write-Host "⚠️  Model test completed with warnings" -ForegroundColor Yellow
        }
        
        Remove-Item "$env:TEMP\ollama_test.txt" -Force -ErrorAction SilentlyContinue
    }
    catch {
        Write-Host "❌ Model test failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Function to configure Windows Firewall
function Configure-Firewall {
    Write-Host "🔥 Configuring Windows Firewall..." -ForegroundColor Blue
    
    try {
        # Allow Ollama through Windows Firewall
        New-NetFirewallRule -DisplayName "Ollama API" -Direction Inbound -Port 11434 -Protocol TCP -Action Allow -ErrorAction SilentlyContinue
        Write-Host "✅ Firewall configured for Ollama" -ForegroundColor Green
    }
    catch {
        Write-Host "⚠️  Could not configure firewall automatically" -ForegroundColor Yellow
        Write-Host "   You may need to manually allow port 11434 through Windows Firewall" -ForegroundColor Gray
    }
}

# Function to create desktop shortcut
function Create-Shortcuts {
    Write-Host "🔗 Creating shortcuts..." -ForegroundColor Blue
    
    try {
        $desktop = [Environment]::GetFolderPath("Desktop")
        $shortcutPath = "$desktop\Government Analytics Dashboard.url"
        
        $shortcutContent = @"
[InternetShortcut]
URL=file://$PWD\government-analytics-dashboard.html
IconFile=%SystemRoot%\system32\shell32.dll
IconIndex=13
"@
        
        $shortcutContent | Out-File -FilePath $shortcutPath -Encoding ASCII
        Write-Host "✅ Desktop shortcut created" -ForegroundColor Green
    }
    catch {
        Write-Host "⚠️  Could not create desktop shortcut" -ForegroundColor Yellow
    }
}

# Main installation flow
Write-Host "🔍 Checking current installation..." -ForegroundColor Blue

if (Test-OllamaInstalled) {
    Write-Host "✅ Ollama is already installed!" -ForegroundColor Green
    Write-Host "   Skipping installation..." -ForegroundColor Gray
}
else {
    Write-Host "📦 Ollama not found. Installing..." -ForegroundColor Yellow
    
    if (-not (Install-Ollama)) {
        Write-Host "❌ Installation failed. Please visit https://ollama.ai manually." -ForegroundColor Red
        Read-Host "Press any key to exit"
        exit 1
    }
}

Write-Host ""

# Start Ollama service and wait for it to be ready
if (-not (Wait-OllamaService)) {
    Write-Host "❌ Ollama service is not responding. Please restart and try again." -ForegroundColor Red
    Read-Host "Press any key to exit"
    exit 1
}

Write-Host ""

# Install AI models
$installModels = Read-Host "Do you want to install recommended AI models? (Y/N) [Y]"
if ($installModels -eq "" -or $installModels -eq "Y" -or $installModels -eq "y") {
    Install-AIModels
    Test-Models
}
else {
    Write-Host "⏭️  Skipping model installation" -ForegroundColor Yellow
}

Write-Host ""

# Configure firewall
Configure-Firewall

# Create shortcuts
Create-Shortcuts

Write-Host ""
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "    🎉 Local AI Setup Complete!" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "✅ Ollama is running at: http://localhost:11434" -ForegroundColor Green
Write-Host "✅ Government Analytics Dashboard is ready for local AI" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "   1. Open the Government Analytics Dashboard" -ForegroundColor White
Write-Host "   2. Navigate to 'Local AI Models' section" -ForegroundColor White
Write-Host "   3. Your installed models will be available for private analysis" -ForegroundColor White
Write-Host ""
Write-Host "🔒 Benefits:" -ForegroundColor Cyan
Write-Host "   • Complete data privacy - nothing leaves your computer" -ForegroundColor White
Write-Host "   • No internet required for AI analysis" -ForegroundColor White
Write-Host "   • No API costs or usage limits" -ForegroundColor White
Write-Host "   • Government-grade security compliance" -ForegroundColor White
Write-Host ""
Write-Host "❓ Troubleshooting:" -ForegroundColor Cyan
Write-Host "   • If models don't appear, refresh the Local AI Models page" -ForegroundColor White
Write-Host "   • Check Windows Firewall if connection issues occur" -ForegroundColor White
Write-Host "   • Restart Ollama service if needed: 'ollama serve'" -ForegroundColor White
Write-Host ""

Read-Host "Press any key to finish" 