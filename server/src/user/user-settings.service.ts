import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UserSettings, UserSettingsDocument } from './schemas/user-settings.schema';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import * as crypto from 'crypto';

@Injectable()
export class UserSettingsService {
  private readonly encryptionKey = process.env.ENCRYPTION_KEY || 'your-32-character-secret-key-here!';
  private readonly algorithm = 'aes-256-cbc';

  constructor(
    @InjectModel(UserSettings.name) private userSettingsModel: Model<UserSettingsDocument>,
  ) {}

  async getUserSettings(userId: string): Promise<UserSettingsDocument> {
    let settings = await this.userSettingsModel.findOne({ 
      userId: new Types.ObjectId(userId) 
    });

    if (!settings) {
      // Create default settings for new user
      settings = new this.userSettingsModel({
        userId: new Types.ObjectId(userId),
        defaultAiModel: 'gpt-3.5-turbo',
        emailNotifications: true,
        theme: 'light',
        language: 'en',
      });
      await settings.save();
    }

    return settings;
  }

  async updateUserSettings(userId: string, updateData: UpdateSettingsDto): Promise<UserSettingsDocument> {
    const settings = await this.getUserSettings(userId);
    
    // Handle API key encryption
    const encryptedApiKeys = { ...settings.encryptedApiKeys };
    
    if (updateData.openaiApiKey) {
      if (updateData.openaiApiKey === '***HIDDEN***') {
        // Don't update if it's the masked value
      } else if (updateData.openaiApiKey === '') {
        // Remove the key
        delete encryptedApiKeys.openai;
      } else {
        // Encrypt and store new key
        encryptedApiKeys.openai = this.encrypt(updateData.openaiApiKey);
      }
    }

    if (updateData.geminiApiKey) {
      if (updateData.geminiApiKey === '***HIDDEN***') {
        // Don't update if it's the masked value
      } else if (updateData.geminiApiKey === '') {
        delete encryptedApiKeys.gemini;
      } else {
        encryptedApiKeys.gemini = this.encrypt(updateData.geminiApiKey);
      }
    }

    if (updateData.claudeApiKey) {
      if (updateData.claudeApiKey === '***HIDDEN***') {
        // Don't update if it's the masked value  
      } else if (updateData.claudeApiKey === '') {
        delete encryptedApiKeys.claude;
      } else {
        encryptedApiKeys.claude = this.encrypt(updateData.claudeApiKey);
      }
    }

    // Update settings
    const updatePayload: any = {
      encryptedApiKeys,
      ...(updateData.defaultAiModel && { defaultAiModel: updateData.defaultAiModel }),
      ...(updateData.emailNotifications !== undefined && { emailNotifications: updateData.emailNotifications }),
      ...(updateData.theme && { theme: updateData.theme }),
      ...(updateData.language && { language: updateData.language }),
    };

    const updatedSettings = await this.userSettingsModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      updatePayload,
      { new: true, upsert: true }
    );

    if (!updatedSettings) {
      throw new NotFoundException('Failed to update settings');
    }

    return updatedSettings;
  }

  async getUserApiKey(userId: string, provider: 'openai' | 'gemini' | 'claude'): Promise<string | null> {
    const settings = await this.getUserSettings(userId);
    
    if (!settings.encryptedApiKeys || !settings.encryptedApiKeys[provider]) {
      return null;
    }

    try {
      return this.decrypt(settings.encryptedApiKeys[provider]);
    } catch (error) {
      console.error(`Failed to decrypt ${provider} API key for user ${userId}:`, error);
      return null;
    }
  }

  async getSettingsForDisplay(userId: string): Promise<any> {
    const settings = await this.getUserSettings(userId);
    
    return {
      id: settings._id,
      defaultAiModel: settings.defaultAiModel,
      emailNotifications: settings.emailNotifications,
      theme: settings.theme,
      language: settings.language,
      hasOpenaiKey: !!(settings.encryptedApiKeys?.openai),
      hasGeminiKey: !!(settings.encryptedApiKeys?.gemini),
      hasClaudeKey: !!(settings.encryptedApiKeys?.claude),
      // Return masked keys for display
      openaiApiKey: settings.encryptedApiKeys?.openai ? '***HIDDEN***' : '',
      geminiApiKey: settings.encryptedApiKeys?.gemini ? '***HIDDEN***' : '',
      claudeApiKey: settings.encryptedApiKeys?.claude ? '***HIDDEN***' : '',
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }

  async deleteUserSettings(userId: string): Promise<void> {
    await this.userSettingsModel.deleteOne({ 
      userId: new Types.ObjectId(userId) 
    });
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
} 