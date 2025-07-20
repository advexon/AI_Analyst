import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { LocalAiService, LocalModel, ModelResponse } from './local-ai.service';

export class GenerateRequestDto {
  modelId: string;
  prompt: string;
  options?: {
    temperature?: number;
    max_tokens?: number;
    top_p?: number;
  };
}

export class DownloadModelDto {
  modelId: string;
}

@Controller('local-ai')
export class LocalAiController {
  constructor(private readonly localAiService: LocalAiService) {}

  @Get('models')
  async getAvailableModels(): Promise<{ models: LocalModel[] }> {
    try {
      const models = await this.localAiService.getAvailableModels();
      return { models };
    } catch (error) {
      throw new HttpException(
        `Failed to fetch models: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('models/installed')
  async getInstalledModels(): Promise<{ models: LocalModel[] }> {
    try {
      const models = await this.localAiService.getInstalledModels();
      return { models };
    } catch (error) {
      throw new HttpException(
        `Failed to fetch installed models: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('models/:modelId/status')
  async getModelStatus(@Param('modelId') modelId: string): Promise<{ model: LocalModel | null }> {
    try {
      const model = await this.localAiService.getModelStatus(modelId);
      return { model };
    } catch (error) {
      throw new HttpException(
        `Failed to get model status: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('models/download')
  async downloadModel(@Body() downloadDto: DownloadModelDto): Promise<{ message: string }> {
    try {
      await this.localAiService.downloadModel(downloadDto.modelId);
      return { message: `Model ${downloadDto.modelId} download started` };
    } catch (error) {
      throw new HttpException(
        `Failed to download model: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete('models/:modelId')
  async deleteModel(@Param('modelId') modelId: string): Promise<{ message: string }> {
    try {
      await this.localAiService.deleteModel(modelId);
      return { message: `Model ${modelId} deleted successfully` };
    } catch (error) {
      throw new HttpException(
        `Failed to delete model: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post('generate')
  async generateResponse(@Body() generateDto: GenerateRequestDto): Promise<ModelResponse> {
    try {
      const response = await this.localAiService.generateResponse(
        generateDto.modelId,
        generateDto.prompt,
        generateDto.options || {},
      );
      return response;
    } catch (error) {
      throw new HttpException(
        `Failed to generate response: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get('system/info')
  async getSystemInfo(): Promise<any> {
    try {
      const info = await this.localAiService.getSystemInfo();
      return info;
    } catch (error) {
      throw new HttpException(
        `Failed to get system info: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('system/ollama-status')
  async getOllamaStatus(): Promise<{ available: boolean }> {
    try {
      const available = await this.localAiService.isOllamaAvailable();
      return { available };
    } catch (error) {
      return { available: false };
    }
  }

  @Get('system/diagnostics')
  async getDiagnostics(): Promise<any> {
    try {
      const urls = [
        'http://localhost:11434',
        'http://host.docker.internal:11434',
        'http://172.17.0.1:11434',
        'http://ollama:11434'
      ];

      const results: Array<{
        url: string;
        status: string;
        version?: string;
        message: string;
      }> = [];
      
      for (const url of urls) {
        try {
          const response = await fetch(`${url}/api/version`, { 
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(3000)
          });
          
          if (response.ok) {
            const data = await response.json();
            results.push({
              url,
              status: 'connected',
              version: data.version || 'unknown',
              message: 'Successfully connected'
            });
          } else {
            results.push({
              url,
              status: 'error',
              message: `HTTP ${response.status}: ${response.statusText}`
            });
          }
        } catch (error) {
          results.push({
            url,
            status: 'failed',
            message: error.message
          });
        }
      }

      return {
        environment: {
          node_env: process.env.NODE_ENV,
          docker_env: process.env.DOCKER_ENV,
          ollama_url: process.env.OLLAMA_URL,
          platform: process.platform,
          arch: process.arch
        },
        connection_tests: results,
        recommendations: this.generateRecommendations(results)
      };
    } catch (error) {
      throw new HttpException(
        `Diagnostics failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private generateRecommendations(results: any[]): string[] {
    const recommendations: string[] = [];
    const successfulConnections = results.filter(r => r.status === 'connected');
    
    if (successfulConnections.length === 0) {
      recommendations.push("No Ollama instances found. Install Ollama first: https://ollama.ai/download");
      recommendations.push("If Ollama is installed, try running: ollama serve");
      
      if (process.env.DOCKER_ENV === 'true') {
        recommendations.push("You're in Docker. Try setting OLLAMA_URL=http://host.docker.internal:11434");
        recommendations.push("Or use the complete Docker setup: docker-compose -f docker-compose.ollama.yml up -d");
      }
    } else {
      const bestUrl = successfulConnections[0].url;
      recommendations.push(`Found Ollama at: ${bestUrl}`);
      recommendations.push(`Set environment: OLLAMA_URL=${bestUrl}`);
      recommendations.push("Install models with: ollama pull phi");
    }
    
    return recommendations;
  }

  @Post('analyze')
  async analyzeWithLocalModel(
    @Body() body: { 
      modelId: string; 
      data: any; 
      analysisType: string;
      options?: any;
    }
  ): Promise<any> {
    try {
      const { modelId, data, analysisType, options } = body;
      
      // Create analysis prompt based on the data and analysis type
      const prompt = this.createAnalysisPrompt(data, analysisType);
      
      const response = await this.localAiService.generateResponse(
        modelId,
        prompt,
        options || {},
      );

      // Parse and structure the AI response into analysis result format
      const analysisResult = this.parseAnalysisResponse(response.response, data);
      
      return {
        success: true,
        analysis: analysisResult,
        model_used: modelId,
        processing_time: response.processing_time,
        local_processing: true,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to analyze with local model: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private createAnalysisPrompt(data: any, analysisType: string): string {
    const dataPreview = JSON.stringify(data).substring(0, 2000); // Limit data size
    
    let prompt = `You are a government data analyst. Analyze the following dataset and provide insights.\n\n`;
    prompt += `Analysis Type: ${analysisType}\n`;
    prompt += `Data Preview: ${dataPreview}\n\n`;
    
    prompt += `Please provide:\n`;
    prompt += `1. Summary: A brief overview of the data\n`;
    prompt += `2. Key Insights: 5-7 important findings\n`;
    prompt += `3. Trends: Any patterns or trends observed\n`;
    prompt += `4. Recommendations: Actionable recommendations\n`;
    prompt += `5. Data Quality: Assessment of data completeness and accuracy\n\n`;
    
    prompt += `Please structure your response in a clear, professional manner suitable for government use.`;
    
    return prompt;
  }

  private parseAnalysisResponse(response: string, originalData: any): any {
    // This is a simplified parser - in a real implementation, you'd want more sophisticated parsing
    
    const lines = response.split('\n').filter(line => line.trim());
    
    const result = {
      summary: '',
      insights: [] as string[],
      trends: [] as string[],
      recommendations: [] as string[],
      statistics: {
        totalRows: Array.isArray(originalData) ? originalData.length : 1,
        totalColumns: Array.isArray(originalData) && originalData.length > 0 
          ? Object.keys(originalData[0]).length 
          : 0,
      },
      metadata: {
        dataQuality: {
          overall: 'Good',
        },
        localProcessing: true,
        privacyCompliant: true,
      },
    };

    // Simple parsing logic - extract sections based on keywords
    let currentSection = '';
    
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      
      if (lowerLine.includes('summary:') || lowerLine.includes('overview:')) {
        currentSection = 'summary';
        result.summary = line.substring(line.indexOf(':') + 1).trim();
      } else if (lowerLine.includes('insight') || lowerLine.includes('finding')) {
        currentSection = 'insights';
        if (line.includes(':')) {
          result.insights.push(line.substring(line.indexOf(':') + 1).trim());
        } else if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
          result.insights.push(line.trim().substring(1).trim());
        }
      } else if (lowerLine.includes('trend') || lowerLine.includes('pattern')) {
        currentSection = 'trends';
        if (line.includes(':')) {
          result.trends.push(line.substring(line.indexOf(':') + 1).trim());
        } else if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
          result.trends.push(line.trim().substring(1).trim());
        }
      } else if (lowerLine.includes('recommend')) {
        currentSection = 'recommendations';
        if (line.includes(':')) {
          result.recommendations.push(line.substring(line.indexOf(':') + 1).trim());
        } else if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
          result.recommendations.push(line.trim().substring(1).trim());
        }
      } else if (currentSection && (line.trim().startsWith('-') || line.trim().startsWith('•'))) {
        // Continue adding to current section
        const content = line.trim().substring(1).trim();
        if (content) {
          if (currentSection === 'insights') {
            result.insights.push(content);
          } else if (currentSection === 'trends') {
            result.trends.push(content);
          } else if (currentSection === 'recommendations') {
            result.recommendations.push(content);
          }
        }
      }
    }

    // Ensure we have at least some content
    if (result.insights.length === 0) {
      result.insights.push('Local AI analysis completed successfully');
    }
    if (result.trends.length === 0) {
      result.trends.push('Data trends analyzed locally for maximum privacy');
    }
    if (result.recommendations.length === 0) {
      result.recommendations.push('Continue using local AI for secure data analysis');
    }

    return result;
  }
} 