import { IsOptional, IsString, IsBoolean, IsEnum } from 'class-validator';

export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  openaiApiKey?: string;

  @IsOptional()
  @IsString()
  geminiApiKey?: string;

  @IsOptional()
  @IsString()
  claudeApiKey?: string;

  @IsOptional()
  @IsEnum(['gpt-3.5-turbo', 'gpt-4', 'gemini-pro', 'claude-3-sonnet'])
  defaultAiModel?: string;

  @IsOptional()
  @IsBoolean()
  emailNotifications?: boolean;

  @IsOptional()
  @IsEnum(['light', 'dark'])
  theme?: string;

  @IsOptional()
  @IsEnum(['en', 'es', 'fr', 'de'])
  language?: string;
} 