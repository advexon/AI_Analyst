import { IsEnum, IsOptional } from 'class-validator';
import { AIModel } from '../schemas/file.schema';

export class UploadFileDto {
  @IsOptional()
  @IsEnum(AIModel)
  aiModel?: AIModel;
} 