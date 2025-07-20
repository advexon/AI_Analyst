import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { OpenAI } from 'openai';
import { UserSettings, UserSettingsDocument } from '../user/schemas/user-settings.schema';
import { AIModel } from '../file/schemas/file.schema';
import { LocalAiService } from './local-ai.service'; // Import LocalAiService

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);

  constructor(
    @InjectModel(UserSettings.name)
    private userSettingsModel: Model<UserSettingsDocument>,
    private localAiService: LocalAiService, // Inject LocalAiService
  ) {}

  private async getOpenAIClient(userId: string): Promise<OpenAI | null> {
    try {
      // Get user settings from database
      const userSettings = await this.userSettingsModel.findOne({ userId });
      
      const openaiKey = userSettings?.encryptedApiKeys?.openai; // Use encryptedApiKeys
      
      if (!openaiKey) {
        return null;
      }

      return new OpenAI({
        apiKey: openaiKey,
      });
    } catch (error) {
      this.logger.error('Failed to get OpenAI client:', error);
      return null;
    }
  }

  async analyzeData(
    data: any[],
    aiModel: AIModel = AIModel.GPT35,
    fileName: string,
    userId: string,
  ): Promise<any> {
    // Check if it's a local Ollama model
    const localModels = [
      AIModel.LLAMA32,
      AIModel.DEEPSEEK_R1,
      AIModel.QWEN25,
      AIModel.LLAMA33,
      AIModel.MISTRAL_NEMO
    ];

    if (localModels.includes(aiModel)) {
      // Use local AI service for Ollama models (Ministry preferred)
      return this.analyzeWithLocalAI(data, aiModel, fileName);
    } else {
      // Use OpenAI for cloud models (fallback)
      return this.analyzeWithOpenAI(data, aiModel, fileName, userId);
    }
  }

  private async analyzeWithLocalAI(
    data: any[],
    aiModel: AIModel,
    fileName: string,
  ): Promise<any> {
    try {
      // Prepare data summary for AI analysis
      const dataSummary = this.prepareDataSummary(data, fileName);
      
      // Create analysis prompt
      const prompt = this.createAnalysisPrompt(dataSummary, data.slice(0, 10));

      this.logger.log(`Starting LOCAL AI analysis for ${fileName} with ${aiModel}`);

      // Use LocalAiService to generate response
      const response = await this.localAiService.generateResponse(
        aiModel.toString(), // Convert enum to string
        prompt,
        {
          temperature: 0.3,
          max_tokens: 2000,
        }
      );

      if (!response.response) {
        throw new Error('No response received from local AI model');
      }
      
      // Parse AI response
      const analysisResult = this.parseAIResponse(response.response, data);
      
      this.logger.log(`LOCAL AI analysis completed for ${fileName} using ${aiModel}`);
      
      return analysisResult;
    } catch (error) {
      this.logger.error(`LOCAL AI analysis failed for ${fileName}:`, error);
      throw new Error(`Local AI analysis failed: ${error.message}`);
    }
  }

  private async analyzeWithOpenAI(
    data: any[],
    aiModel: AIModel,
    fileName: string,
    userId: string,
  ): Promise<any> {
    const openai = await this.getOpenAIClient(userId);
    if (!openai) {
      throw new Error('OpenAI API key not configured. Please add your API key in settings or use local AI models.');
    }

    try {
      // Prepare data summary for AI analysis
      const dataSummary = this.prepareDataSummary(data, fileName);
      
      // Create analysis prompt
      const prompt = this.createAnalysisPrompt(dataSummary, data.slice(0, 10));

      this.logger.log(`Starting OpenAI analysis for ${fileName} with ${aiModel}`);

      const completion = await openai.chat.completions.create({
        model: this.mapAIModel(aiModel),
        messages: [
          {
            role: 'system',
            content: `You are an expert multilingual data analyst. You can analyze datasets in any language including English, Russian (русский), Tajik (тоҷикӣ), and other languages. Always respond in English but understand and analyze content in the original language. Analyze the provided dataset and return insights in the specified JSON format. Be thorough but concise. If you detect non-Latin text, mention the language in your analysis.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      });

      const response = completion.choices[0].message.content;
      
      if (!response) {
        throw new Error('No response received from AI model');
      }
      
      // Parse AI response
      const analysisResult = this.parseAIResponse(response, data);
      
      this.logger.log(`OpenAI analysis completed for ${fileName}`);
      
      return analysisResult;
    } catch (error) {
      this.logger.error(`OpenAI analysis failed for ${fileName}:`, error);
      throw new Error(`OpenAI analysis failed: ${error.message}`);
    }
  }

  private prepareDataSummary(data: any[], fileName: string) {
    const totalRows = data.length;
    const firstRow = data[0] || {};
    const columns = Object.keys(firstRow);
    
    // Sample data types
    const columnTypes: Record<string, string> = {};
    columns.forEach(col => {
      const sampleValues = data.slice(0, 5).map(row => row[col]);
      const nonNullValues = sampleValues.filter(val => val !== null && val !== undefined);
      
      if (nonNullValues.length === 0) {
        columnTypes[col] = 'unknown';
      } else {
        const firstValue = nonNullValues[0];
        if (typeof firstValue === 'number') {
          columnTypes[col] = 'numeric';
        } else if (!isNaN(Date.parse(firstValue))) {
          columnTypes[col] = 'date';
        } else {
          columnTypes[col] = 'text';
        }
      }
    });

    return {
      fileName,
      totalRows,
      totalColumns: columns.length,
      columns,
      columnTypes,
    };
  }

  private createAnalysisPrompt(dataSummary: any, sampleData: any[]): string {
    return `
Please analyze this dataset and provide insights in the following JSON format:

{
  "summary": "Brief overview of the dataset",
  "insights": ["Key insight 1", "Key insight 2", "Key insight 3"],
  "trends": ["Trend 1", "Trend 2"],
  "anomalies": ["Anomaly 1", "Anomaly 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"],
  "statistics": {
    "totalRows": ${dataSummary.totalRows},
    "totalColumns": ${dataSummary.totalColumns},
    "dataTypes": ${JSON.stringify(dataSummary.columnTypes)}
  },
  "visualizations": [
    {
      "chartType": "bar|line|pie|scatter",
      "title": "Chart title",
      "xAxis": "column_name",
      "yAxis": "column_name",
      "description": "What this chart shows"
    }
  ]
}

Dataset Information:
- File: ${dataSummary.fileName}
- Rows: ${dataSummary.totalRows}
- Columns: ${dataSummary.columns.join(', ')}
- Column Types: ${JSON.stringify(dataSummary.columnTypes, null, 2)}

Sample Data (first 10 rows):
${JSON.stringify(sampleData, null, 2)}

Focus on:
1. Data quality and completeness
2. Statistical patterns and distributions
3. Correlations between variables
4. Potential business insights
5. Recommended visualizations
6. Data anomalies or outliers
7. Language detection and multilingual content analysis
8. Cultural and regional context (if applicable)

Important notes:
- If you detect Russian text (Cyrillic), mention this in your analysis
- If you detect Tajik text (Cyrillic), mention this in your analysis  
- For multilingual datasets, provide insights about language distribution
- Consider regional/cultural context in business recommendations
- All column names and text content should be analyzed regardless of language

Return ONLY the JSON response, no additional text.`;
  }

  private parseAIResponse(response: string, originalData: any[]): any {
    try {
      // Clean the response to extract JSON
      const cleanedResponse = response.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleanedResponse);
      
      // Enhance with additional computed statistics
      const enhancedResult = {
        ...parsed,
        statistics: {
          ...parsed.statistics,
          sampleSize: Math.min(originalData.length, 1000), // Limit for performance
        },
        metadata: {
          analysisDate: new Date(),
          dataQuality: this.assessDataQuality(originalData),
        },
      };

      return enhancedResult;
    } catch (error) {
      this.logger.error('Failed to parse AI response:', error);
      
      // Return fallback analysis
      return this.createFallbackAnalysis(originalData, response);
    }
  }

  private createFallbackAnalysis(data: any[], rawResponse: string): any {
    const columns = data.length > 0 ? Object.keys(data[0]) : [];
    const detectedLanguages = this.detectLanguagesInData(data);
    const languageInfo = detectedLanguages.length > 1 ? 
      `Multilingual dataset detected: ${detectedLanguages.join(', ')}` :
      `Language detected: ${detectedLanguages[0] || 'English'}`;
    
    return {
      summary: `Analysis of ${languageInfo.toLowerCase()} dataset with ${data.length} rows and ${columns.length} columns.`,
      insights: [
        `Dataset contains ${data.length} records`,
        `${columns.length} columns identified: ${columns.slice(0, 3).join(', ')}${columns.length > 3 ? '...' : ''}`,
        languageInfo,
        'Automated analysis completed successfully',
      ],
      trends: ['Data trends analysis available'],
      anomalies: ['No specific anomalies detected in automated scan'],
      recommendations: [
        'Review data for quality and completeness',
        'Consider visualizing key metrics',
        'Perform deeper statistical analysis',
      ],
      statistics: {
        totalRows: data.length,
        totalColumns: columns.length,
        dataTypes: this.getDataTypes(data),
      },
      visualizations: [
        {
          chartType: 'bar',
          title: 'Data Overview',
          xAxis: columns[0] || 'index',
          yAxis: columns[1] || 'value',
          description: 'Basic data visualization suggestion',
        },
      ],
      metadata: {
        analysisDate: new Date(),
        fallbackUsed: true,
        rawResponse: rawResponse.substring(0, 500), // First 500 chars for debugging
      },
    };
  }

  private getDataTypes(data: any[]): Record<string, string> {
    if (!data.length) return {};
    
    const firstRow = data[0];
    const types: Record<string, string> = {};
    
    Object.keys(firstRow).forEach(key => {
      const value = firstRow[key];
      if (typeof value === 'number') {
        types[key] = 'numeric';
      } else if (typeof value === 'boolean') {
        types[key] = 'boolean';
      } else if (!isNaN(Date.parse(value))) {
        types[key] = 'date';
      } else {
        types[key] = 'text';
      }
    });
    
    return types;
  }

  private assessDataQuality(data: any[]): any {
    if (!data.length) {
      return { completeness: 0, consistency: 0, overall: 'poor' };
    }

    const totalCells = data.length * Object.keys(data[0]).length;
    let filledCells = 0;
    
    data.forEach(row => {
      Object.values(row).forEach(value => {
        if (value !== null && value !== undefined && value !== '') {
          filledCells++;
        }
      });
    });

    const completeness = (filledCells / totalCells) * 100;
    const overall = completeness > 90 ? 'excellent' : 
                   completeness > 75 ? 'good' : 
                   completeness > 50 ? 'fair' : 'poor';

    return {
      completeness: Math.round(completeness),
      consistency: 85, // Simplified for now
      overall,
    };
  }

  private mapAIModel(aiModel: AIModel): string {
    switch (aiModel) {
      case AIModel.GPT4:
        return 'gpt-4';
      case AIModel.GPT35:
        return 'gpt-3.5-turbo';
      default:
        return 'gpt-3.5-turbo';
    }
  }

  async getAvailableModels(userId: string): Promise<AIModel[]> {
    // Return available models based on configuration
    const models: AIModel[] = [];
    
    const openai = await this.getOpenAIClient(userId);
    if (openai) {
      models.push(AIModel.GPT35);
      models.push(AIModel.GPT4);
    }
    
    // Check for other AI providers when implemented
    const geminiKey = await this.userSettingsModel.findOne({ userId }).then(s => s?.encryptedApiKeys?.gemini);
    if (geminiKey) {
      models.push(AIModel.GEMINI);
    }
    
    const claudeKey = await this.userSettingsModel.findOne({ userId }).then(s => s?.encryptedApiKeys?.claude);
    if (claudeKey) {
      models.push(AIModel.CLAUDE);
    }
    
    return models;
  }

  private detectLanguagesInData(data: any[]): string[] {
    const languages: string[] = [];
    
    if (!data.length) return ['English'];
    
    // Check column headers and sample data for language detection
    const sampleText: string[] = [];
    
    // Add column headers
    const columns = Object.keys(data[0]);
    sampleText.push(...columns);
    
    // Add sample values from first few rows
    data.slice(0, 5).forEach(row => {
      Object.values(row).forEach(value => {
        if (typeof value === 'string' && value.length > 2) {
          sampleText.push(value);
        }
      });
    });
    
    const allText = sampleText.join(' ');
    
    // Detect languages based on character sets
    if (/[а-яё]/i.test(allText)) {
      // Contains Russian Cyrillic characters
      if (/[ӣӯқҳҷғ]/i.test(allText)) {
        if (!languages.includes('Tajik')) {
          languages.push('Tajik');
        }
      } else {
        if (!languages.includes('Russian')) {
          languages.push('Russian');
        }
      }
    }
    
    if (/[a-z]/i.test(allText)) {
      if (!languages.includes('English')) {
        languages.push('English');
      }
    }
    
    return languages.length > 0 ? languages : ['English'];
  }
} 