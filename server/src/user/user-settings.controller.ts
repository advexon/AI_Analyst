import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  UseGuards,
  Request,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserSettingsService } from './user-settings.service';

export interface UpdateSettingsDto {
  apiKeys?: {
    openai?: string;
    claude?: string;
    gemini?: string;
    grok?: string;
  };
  preferences?: {
    defaultAiMode?: string;
    defaultModel?: string;
    autoAnalysis?: boolean;
    notifications?: boolean;
  };
  defaultAiModel?: string;
  emailNotifications?: boolean;
  theme?: string;
  language?: string;
}

@Controller('user/settings')
// @UseGuards(JwtAuthGuard) // Disabled for Ministry use
export class UserSettingsController {
  constructor(private userSettingsService: UserSettingsService) {}

  // Helper method to get user ID - defaults to ministry user for local secure environment
  private getUserId(req: any): string {
    return req.user?._id?.toString() || '507f1f77bcf86cd799439011'; // Default ObjectId for Ministry
  }

  @Get()
  async getSettings(@Request() req) {
    try {
      const userId = this.getUserId(req);
      const settings = await this.userSettingsService.getUserSettings(userId);
      
      // Return settings in the format expected by frontend
      return {
        apiKeys: {
          openai: settings?.encryptedApiKeys?.openai ? '***configured***' : '',
          claude: settings?.encryptedApiKeys?.claude ? '***configured***' : '',
          gemini: settings?.encryptedApiKeys?.gemini ? '***configured***' : '',
          grok: settings?.encryptedApiKeys?.grok ? '***configured***' : '',
        },
        preferences: {
          defaultAiMode: settings?.defaultAiModel?.includes('llama') || settings?.defaultAiModel?.includes('deepseek') ? 'local' : 'online',
          defaultModel: settings?.defaultAiModel || 'llama3.2:latest',
          autoAnalysis: true,
          notifications: settings?.emailNotifications ?? true,
        },
        // Legacy fields
        defaultAiModel: settings?.defaultAiModel,
        emailNotifications: settings?.emailNotifications,
        theme: settings?.theme,
        language: settings?.language,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to fetch settings',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Put()
  async updateSettings(@Body() updateData: UpdateSettingsDto, @Request() req) {
    try {
      const userId = this.getUserId(req);
      
      // Prepare settings for database
      const settingsUpdate: any = {};
      
      // Handle API keys
      if (updateData.apiKeys) {
        settingsUpdate.encryptedApiKeys = {};
        Object.entries(updateData.apiKeys).forEach(([provider, key]) => {
          if (key && key !== '***configured***' && key.trim().length > 0) {
            settingsUpdate.encryptedApiKeys[provider] = key; // Note: In production, encrypt this
          }
        });
      }
      
      // Handle preferences
      if (updateData.preferences) {
        if (updateData.preferences.defaultModel) {
          settingsUpdate.defaultAiModel = updateData.preferences.defaultModel;
        }
        if (updateData.preferences.notifications !== undefined) {
          settingsUpdate.emailNotifications = updateData.preferences.notifications;
        }
      }
      
      // Handle legacy fields
      if (updateData.defaultAiModel) {
        settingsUpdate.defaultAiModel = updateData.defaultAiModel;
      }
      if (updateData.emailNotifications !== undefined) {
        settingsUpdate.emailNotifications = updateData.emailNotifications;
      }
      if (updateData.theme) {
        settingsUpdate.theme = updateData.theme;
      }
      if (updateData.language) {
        settingsUpdate.language = updateData.language;
      }

      const updatedSettings = await this.userSettingsService.updateUserSettings(
        userId,
        settingsUpdate,
      );

      return {
        message: 'Settings updated successfully',
        settings: updatedSettings,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to update settings',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete()
  async deleteSettings(@Request() req) {
    try {
      const userId = this.getUserId(req);
      await this.userSettingsService.deleteUserSettings(userId);
      return { message: 'Settings deleted successfully' };
    } catch (error) {
      throw new HttpException(
        'Failed to delete settings',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('api-keys/status')
  async getApiKeysStatus(@Request() req) {
    try {
      const userId = this.getUserId(req);
      const settings = await this.userSettingsService.getUserSettings(userId);
      
      return {
        openai: !!settings?.encryptedApiKeys?.openai,
        claude: !!settings?.encryptedApiKeys?.claude,
        gemini: !!settings?.encryptedApiKeys?.gemini,
        grok: !!settings?.encryptedApiKeys?.grok,
      };
    } catch (error) {
      throw new HttpException(
        'Failed to fetch API keys status',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
} 