#!/usr/bin/env powershell

# Economic AI Models Installation Script
# For Ministry of Economic Development and Trade of the Republic of Tajikistan
# This script installs the latest AI models optimized for economic data analysis and forecasting

Write-Host "=== Economic AI Models Installation ===" -ForegroundColor Green
Write-Host "Ministry of Economic Development and Trade - Republic of Tajikistan" -ForegroundColor Yellow
Write-Host ""

# Check if Ollama is installed
try {
    $ollamaVersion = ollama --version 2>$null
    Write-Host "✓ Ollama found: $ollamaVersion" -ForegroundColor Green
}
catch {
    Write-Host "✗ Ollama not found. Please install Ollama first." -ForegroundColor Red
    Write-Host "Download from: https://ollama.ai" -ForegroundColor Yellow
    exit 1
}

# Define economic analysis models
$models = @(
    @{
        name        = "llama3.3"
        description = "Latest Llama model - Best for economic analysis and forecasting"
        size        = "4.9GB"
        priority    = 1
    },
    @{
        name        = "qwen2.5:7b"
        description = "Alibaba Qwen - Excellent for mathematical and statistical analysis"
        size        = "4.7GB"
        priority    = 2
    },
    @{
        name        = "gemma2:9b"
        description = "Google Gemma - Optimized for data analysis and insights"
        size        = "5.4GB"
        priority    = 3
    },
    @{
        name        = "deepseek-r1:32b"
        description = "DeepSeek R1 Large - Advanced reasoning for complex economic models"
        size        = "18GB"
        priority    = 4
    },
    @{
        name        = "mistral-nemo"
        description = "Mistral Nemo - Advanced model for economic data processing"
        size        = "7.2GB"
        priority    = 5
    }
)

Write-Host "Available Economic Analysis Models:" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

foreach ($model in $models) {
    Write-Host "[$($model.priority)] $($model.name) - $($model.description)" -ForegroundColor White
    Write-Host "    Size: $($model.size)" -ForegroundColor Gray
    Write-Host ""
}

# Get user selection
Write-Host "Which models would you like to install?" -ForegroundColor Yellow
Write-Host "Options:" -ForegroundColor Yellow
Write-Host "  'all' - Install all models" -ForegroundColor White
Write-Host "  '1,2,3' - Install specific models by number" -ForegroundColor White
Write-Host "  'recommended' - Install top 3 recommended models" -ForegroundColor White
Write-Host ""

$selection = Read-Host "Enter your choice"

$modelsToInstall = @()

switch ($selection.ToLower()) {
    "all" {
        $modelsToInstall = $models
    }
    "recommended" {
        $modelsToInstall = $models | Where-Object { $_.priority -le 3 }
    }
    default {
        if ($selection -match "^\d+(,\d+)*$") {
            $numbers = $selection.Split(",") | ForEach-Object { [int]$_.Trim() }
            $modelsToInstall = $models | Where-Object { $_.priority -in $numbers }
        }
        else {
            Write-Host "Invalid selection. Installing recommended models..." -ForegroundColor Yellow
            $modelsToInstall = $models | Where-Object { $_.priority -le 3 }
        }
    }
}

Write-Host ""
Write-Host "Installing the following models:" -ForegroundColor Green
foreach ($model in $modelsToInstall) {
    Write-Host "  • $($model.name) - $($model.description)" -ForegroundColor White
}

$totalSize = ($modelsToInstall | ForEach-Object { 
        [float]($_.size -replace '[^\d.]', '') 
    }) | Measure-Object -Sum | Select-Object -ExpandProperty Sum

Write-Host ""
Write-Host "Total download size: approximately $([math]::Round($totalSize, 1)) GB" -ForegroundColor Yellow
Write-Host ""

$confirm = Read-Host "Continue with installation? (y/N)"
if ($confirm.ToLower() -ne "y") {
    Write-Host "Installation cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Starting installation..." -ForegroundColor Green
Write-Host "========================" -ForegroundColor Green

foreach ($model in $modelsToInstall) {
    Write-Host ""
    Write-Host "Installing $($model.name)..." -ForegroundColor Cyan
    Write-Host "Description: $($model.description)" -ForegroundColor Gray
    
    try {
        ollama pull $model.name
        Write-Host "✓ Successfully installed $($model.name)" -ForegroundColor Green
    }
    catch {
        Write-Host "✗ Failed to install $($model.name): $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Installation Complete ===" -ForegroundColor Green
Write-Host ""

# List installed models
Write-Host "Currently installed models:" -ForegroundColor Cyan
ollama list

Write-Host ""
Write-Host "🎉 Your economic analysis AI models are ready!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Open your dashboard: http://localhost:5173" -ForegroundColor White
Write-Host "2. Navigate to 'Local AI Models' section" -ForegroundColor White
Write-Host "3. Refresh status to see your new models" -ForegroundColor White
Write-Host "4. Start analyzing economic data with local AI!" -ForegroundColor White
Write-Host ""
Write-Host "Ministry of Economic Development and Trade" -ForegroundColor Green
Write-Host "Republic of Tajikistan" -ForegroundColor Green 