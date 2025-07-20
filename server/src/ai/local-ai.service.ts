import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { pipeline } from 'stream';
import axios from 'axios';

const streamPipeline = promisify(pipeline);

export interface LocalModel {
  id: string;
  name: string;
  type: 'ollama' | 'huggingface' | 'local';
  size: string;
  description: string;
  status: 'available' | 'downloading' | 'installed' | 'error';
  progress?: number;
  path?: string;
  parameters?: any;
}

export interface ModelResponse {
  response: string;
  model: string;
  tokens_used?: number;
  processing_time?: number;
}

@Injectable()
export class LocalAiService {
  private readonly logger = new Logger(LocalAiService.name);
  private readonly modelsDir: string;
  private availableModels: LocalModel[] = [];
  private ollamaBaseUrl: string;

  constructor(
    private readonly configService: ConfigService,
  ) {
    this.modelsDir = this.configService.get('MODELS_DIR', './models');
    this.ollamaBaseUrl = this.getOllamaUrl();
    this.initializeModelsDirectory();
    this.loadAvailableModels();
  }

  private getOllamaUrl(): string {
    // Check if we're in Docker environment
    const isDocker = this.configService.get('DOCKER_ENV', 'false') === 'true';
    const customUrl = this.configService.get('OLLAMA_URL');
    
    if (customUrl) {
      return customUrl;
    }

    if (isDocker) {
      // Try Docker-specific URLs in order of preference
      return 'http://ollama:11434'; // Docker service name
    }

    // Default URLs to try for local development
    return 'http://localhost:11434';
  }

  private initializeModelsDirectory() {
    if (!fs.existsSync(this.modelsDir)) {
      fs.mkdirSync(this.modelsDir, { recursive: true });
      this.logger.log(`Created models directory: ${this.modelsDir}`);
    }
  }

  private loadAvailableModels() {
    // Define available models for Economic Analysis
    this.availableModels = [
      // Latest Ollama Models for Economic Analysis
      {
        id: 'llama3.3',
        name: 'Llama 3.3 (Latest)',
        type: 'ollama',
        size: '4.9GB',
        description: 'Latest Llama model optimized for economic data analysis and forecasting',
        status: 'available',
      },
      {
        id: 'llama3.2',
        name: 'Llama 3.2',
        type: 'ollama',
        size: '2.0GB',
        description: 'Advanced model with improved economic reasoning capabilities',
        status: 'available',
      },
      {
        id: 'deepseek-r1',
        name: 'DeepSeek R1',
        type: 'ollama',
        size: '1.1GB',
        description: 'Specialized reasoning model perfect for economic forecasting and trend analysis',
        status: 'available',
      },
      {
        id: 'qwen2.5',
        name: 'Qwen 2.5',
        type: 'ollama',
        size: '4.7GB',
        description: 'Alibaba model with excellent mathematical and statistical analysis capabilities',
        status: 'available',
      },
      {
        id: 'gemma2',
        name: 'Gemma 2',
        type: 'ollama',
        size: '5.4GB',
        description: 'Google model optimized for data analysis and economic insights',
        status: 'available',
      },
      {
        id: 'mistral-nemo',
        name: 'Mistral Nemo',
        type: 'ollama',
        size: '7.2GB',
        description: 'Advanced Mistral model for complex economic data processing',
        status: 'available',
      },
      // Hugging Face Models
      {
        id: 'microsoft/DialoGPT-medium',
        name: 'DialoGPT Medium',
        type: 'huggingface',
        size: '350MB',
        description: 'Conversational AI model for interactive analysis',
        status: 'available',
      },
      {
        id: 'facebook/bart-large-cnn',
        name: 'BART Large CNN',
        type: 'huggingface',
        size: '1.6GB',
        description: 'Excellent for text summarization and analysis',
        status: 'available',
      },
      {
        id: 'microsoft/deberta-v3-base',
        name: 'DeBERTa V3 Base',
        type: 'huggingface',
        size: '440MB',
        description: 'Advanced language understanding for data analysis',
        status: 'available',
      },
    ];

    this.checkInstalledModels();
  }

  private async checkInstalledModels() {
    // Check Ollama models
    try {
      // Ensure we can connect to Ollama first
      const isAvailable = await this.isOllamaAvailable();
      
      if (isAvailable) {
        const response = await axios.get(`${this.ollamaBaseUrl}/api/tags`);
        
        const installedOllamaModels = response.data.models || [];
        this.logger.log(`Found ${installedOllamaModels.length} installed Ollama models`);
        
        // Add dynamically detected models
        installedOllamaModels.forEach((installedModel: any) => {
          const modelName = installedModel.name;
          const baseModelName = modelName.split(':')[0]; // Remove version tag
          
          // Check if we already have this model in our list
          const existingModel = this.availableModels.find(m => 
            m.id === modelName || m.id === baseModelName
          );
          
          if (existingModel) {
            existingModel.status = 'installed';
            existingModel.id = modelName; // Use full name with version
            this.logger.log(`Model ${modelName} is installed`);
          } else {
            // Add new dynamically detected model
            this.availableModels.push({
              id: modelName,
              name: this.getModelDisplayName(modelName),
              type: 'ollama',
              size: this.formatBytes(installedModel.size || 0),
              description: this.getModelDescription(baseModelName),
              status: 'installed',
            });
            this.logger.log(`Added new installed model: ${modelName}`);
          }
        });
      } else {
        this.logger.warn('Ollama not available - skipping model check');
      }
    } catch (error) {
      this.logger.error(`Error checking Ollama models: ${error.message}`);
    }

    // Check Hugging Face models
    this.availableModels.forEach(model => {
      if (model.type === 'huggingface') {
        const modelPath = path.join(this.modelsDir, model.id.replace('/', '_'));
        if (fs.existsSync(modelPath)) {
          model.status = 'installed';
          model.path = modelPath;
          this.logger.log(`Hugging Face model ${model.id} found at ${modelPath}`);
        }
      }
    });
  }

  private getModelDisplayName(modelName: string): string {
    const baseModelName = modelName.split(':')[0];
    const displayNames = {
      'llama3.2': 'Llama 3.2',
      'llama3': 'Llama 3',
      'llama4': 'Llama 4',
      'deepseek-r1': 'DeepSeek R1',
      'deepseek': 'DeepSeek',
      'mistral': 'Mistral 7B',
      'phi': 'Phi-2',
      'gemma': 'Gemma',
      'qwen': 'Qwen',
      'codegemma': 'CodeGemma',
    };
    return displayNames[baseModelName] || modelName;
  }

  private getModelDescription(baseModelName: string): string {
    const descriptions = {
      'llama3.2': 'Advanced language model optimized for economic analysis and forecasting',
      'llama3': 'Powerful language model for data analysis and insights',
      'llama4': 'Latest Llama model with enhanced economic data processing capabilities',
      'deepseek-r1': 'Specialized reasoning model perfect for economic forecasting',
      'deepseek': 'Advanced reasoning model for complex data analysis',
      'mistral': 'Fast and efficient model for economic text analysis',
      'phi': 'Small but capable model for quick economic insights',
      'gemma': 'Google model optimized for data analysis',
      'qwen': 'Alibaba model with strong mathematical capabilities',
      'codegemma': 'Code-focused model for data processing scripts',
    };
    return descriptions[baseModelName] || 'AI model for economic data analysis';
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async getAvailableModels(): Promise<LocalModel[]> {
    await this.checkInstalledModels();
    return this.availableModels;
  }

  async getInstalledModels(): Promise<LocalModel[]> {
    await this.checkInstalledModels();
    return this.availableModels.filter(model => model.status === 'installed');
  }

  async downloadModel(modelId: string): Promise<void> {
    const model = this.availableModels.find(m => m.id === modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    model.status = 'downloading';
    model.progress = 0;

    try {
      if (model.type === 'ollama') {
        await this.downloadOllamaModel(model);
      } else if (model.type === 'huggingface') {
        await this.downloadHuggingFaceModel(model);
      }

      model.status = 'installed';
      model.progress = 100;
      this.logger.log(`Successfully downloaded model: ${modelId}`);
    } catch (error) {
      model.status = 'error';
      this.logger.error(`Failed to download model ${modelId}:`, error);
      throw error;
    }
  }

  private async downloadOllamaModel(model: LocalModel): Promise<void> {
    try {
      const response = await axios.post(`${this.ollamaBaseUrl}/api/pull`, {
        name: model.id,
      });

      // Monitor download progress
      // Note: In a real implementation, you'd want to stream the response
      // and update progress in real-time
      model.progress = 100;
    } catch (error) {
      throw new Error(`Failed to download Ollama model: ${error.message}`);
    }
  }

  private async downloadHuggingFaceModel(model: LocalModel): Promise<void> {
    const modelPath = path.join(this.modelsDir, model.id.replace('/', '_'));
    
    if (!fs.existsSync(modelPath)) {
      fs.mkdirSync(modelPath, { recursive: true });
    }

    // Download model files (config.json, pytorch_model.bin, tokenizer files)
    const filesToDownload = [
      'config.json',
      'pytorch_model.bin',
      'tokenizer.json',
      'tokenizer_config.json',
      'vocab.txt'
    ];

    let downloadedFiles = 0;
    
    for (const fileName of filesToDownload) {
      try {
        const fileUrl = `https://huggingface.co/${model.id}/resolve/main/${fileName}`;
        const filePath = path.join(modelPath, fileName);
        
        const response = await axios.get(fileUrl, { responseType: 'stream' });

        await streamPipeline(response.data, fs.createWriteStream(filePath));
        
        downloadedFiles++;
        model.progress = (downloadedFiles / filesToDownload.length) * 100;
        
        this.logger.log(`Downloaded ${fileName} for model ${model.id}`);
      } catch (error) {
        // Some files might not exist for all models, continue
        this.logger.warn(`Failed to download ${fileName} for model ${model.id}`);
      }
    }

    model.path = modelPath;
  }

  async generateResponse(
    modelId: string,
    prompt: string,
    options: any = {}
  ): Promise<ModelResponse> {
    const model = this.availableModels.find(m => m.id === modelId);
    if (!model || model.status !== 'installed') {
      throw new Error(`Model ${modelId} is not installed`);
    }

    const startTime = Date.now();

    try {
      let response: string;

      if (model.type === 'ollama') {
        response = await this.generateOllamaResponse(modelId, prompt, options);
      } else if (model.type === 'huggingface') {
        response = await this.generateHuggingFaceResponse(model, prompt, options);
      } else {
        throw new Error(`Unsupported model type: ${model.type}`);
      }

      const processingTime = Date.now() - startTime;

      return {
        response,
        model: modelId,
        processing_time: processingTime,
      };
    } catch (error) {
      this.logger.error(`Error generating response with model ${modelId}:`, error);
      throw error;
    }
  }

  private async generateOllamaResponse(
    modelId: string,
    prompt: string,
    options: any
  ): Promise<string> {
    try {
      const response = await axios.post(`${this.ollamaBaseUrl}/api/generate`, {
        model: modelId,
        prompt,
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          max_tokens: options.max_tokens || 2000,
          top_p: options.top_p || 0.9,
        },
      });

      return response.data.response;
    } catch (error) {
      throw new Error(`Ollama API error: ${error.message}`);
    }
  }

  private async generateHuggingFaceResponse(
    model: LocalModel,
    prompt: string,
    options: any
  ): Promise<string> {
    // For Hugging Face models, we'd typically use a Python service or transformers.js
    // This is a simplified implementation
    
    try {
      // In a real implementation, you would:
      // 1. Use transformers.js for browser-based inference
      // 2. Call a Python microservice with transformers library
      // 3. Use ONNX runtime for JavaScript inference
      
      // For now, return a mock response indicating local processing
      return `[LOCAL AI RESPONSE using ${model.name}]\n\nAnalyzing the provided data: "${prompt.substring(0, 100)}..."\n\nThis is a simulated response from the locally installed ${model.name} model. In a full implementation, this would process your data locally without sending it to external services, ensuring complete privacy and security for government data.`;
    } catch (error) {
      throw new Error(`Hugging Face model error: ${error.message}`);
    }
  }

  async deleteModel(modelId: string): Promise<void> {
    const model = this.availableModels.find(m => m.id === modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    try {
      if (model.type === 'ollama') {
        await axios.delete(`${this.ollamaBaseUrl}/api/delete`, {
          data: { name: modelId }
        });
      } else if (model.type === 'huggingface' && model.path) {
        // Delete local files
        if (fs.existsSync(model.path)) {
          fs.rmSync(model.path, { recursive: true, force: true });
        }
      }

      model.status = 'available';
      model.path = undefined;
      model.progress = 0;

      this.logger.log(`Successfully deleted model: ${modelId}`);
    } catch (error) {
      this.logger.error(`Failed to delete model ${modelId}:`, error);
      throw error;
    }
  }

  async getModelStatus(modelId: string): Promise<LocalModel | null> {
    await this.checkInstalledModels();
    return this.availableModels.find(m => m.id === modelId) || null;
  }

  async isOllamaAvailable(): Promise<boolean> {
    const urlsToTry = [
      this.ollamaBaseUrl,
      'http://localhost:11434',
      'http://host.docker.internal:11434',
      'http://172.17.0.1:11434',
      'http://ollama:11434'
    ];

    for (const url of urlsToTry) {
      try {
        this.logger.log(`Trying to connect to Ollama at: ${url}`);
        await axios.get(`${url}/api/version`, { timeout: 5000 });
        
        if (url !== this.ollamaBaseUrl) {
          this.logger.log(`Found Ollama at ${url}, updating base URL`);
          this.ollamaBaseUrl = url;
        }
        
        this.logger.log(`Successfully connected to Ollama at: ${url}`);
        return true;
      } catch (error) {
        this.logger.warn(`Failed to connect to Ollama at ${url}: ${error.message}`);
      }
    }
    
    this.logger.error('Could not connect to Ollama at any URL');
    return false;
  }

  async getSystemInfo(): Promise<any> {
    const ollamaAvailable = await this.isOllamaAvailable();
    const installedModels = await this.getInstalledModels();
    
    return {
      ollama_available: ollamaAvailable,
      models_directory: this.modelsDir,
      installed_models: installedModels.length,
      total_models_available: this.availableModels.length,
      disk_usage: this.getModelsDiskUsage(),
    };
  }

  private getModelsDiskUsage(): string {
    try {
      const stats = fs.statSync(this.modelsDir);
      // This is a simplified calculation
      return '0 GB'; // In reality, you'd calculate actual disk usage
    } catch (error) {
      return 'Unknown';
    }
  }
} 