import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FileDocument = File & Document;

export enum FileStatus {
  PENDING = 'pending',
  QUEUED = 'queued', 
  ANALYZING = 'analyzing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum FileType {
  CSV = 'csv',
  JSON = 'json',
  XLSX = 'xlsx',
}

export enum AIModel {
  // Cloud-based AI models
  GPT4 = 'gpt-4',
  GPT35 = 'gpt-3.5-turbo',
  GEMINI = 'gemini-pro',
  CLAUDE = 'claude-3-sonnet',
  
  // Local Ollama models for Ministry use
  LLAMA32 = 'llama3.2:latest',
  DEEPSEEK_R1 = 'deepseek-r1:1.5b',
  QWEN25 = 'qwen2.5:7b',
  LLAMA33 = 'llama3.3:latest',
  MISTRAL_NEMO = 'mistral-nemo:latest',
}

export enum FileAccessLevel {
  PRIVATE = 'private',
  SHARED = 'shared',
  PUBLIC = 'public',
  RESTRICTED = 'restricted',
}

export interface FilePermission {
  userId: Types.ObjectId;
  accessLevel: 'read' | 'write' | 'admin';
  grantedBy: Types.ObjectId;
  grantedAt: Date;
}

@Schema({
  timestamps: true,
  toJSON: {
    transform: (doc, ret: any) => {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
  },
})
export class File {
  _id: Types.ObjectId;

  @Prop({ required: true })
  originalName: string;

  @Prop({ required: true })
  fileName: string;

  @Prop({ required: true })
  filePath: string;

  @Prop({ required: true, enum: FileType })
  fileType: FileType;

  @Prop({ required: true })
  fileSize: number;

  @Prop({ required: true, enum: FileStatus, default: FileStatus.PENDING })
  status: FileStatus;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ enum: AIModel })
  aiModel?: AIModel;

  // Enhanced permissions and access control
  @Prop({ enum: FileAccessLevel, default: FileAccessLevel.PRIVATE })
  accessLevel: FileAccessLevel;

  @Prop({ type: [Object], default: [] })
  permissions: FilePermission[];

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop()
  description?: string;

  @Prop({ type: Object })
  metadata?: {
    department?: string;
    category?: string;
    confidentialityLevel?: 'public' | 'internal' | 'confidential' | 'restricted';
    expirationDate?: Date;
  };

  @Prop({ type: Object })
  analysisResult?: {
    summary: string;
    insights: string[];
    trends: string[];
    anomalies: string[];
    recommendations: string[];
    statistics: {
      totalRows: number;
      totalColumns: number;
      dataTypes: Record<string, string>;
    };
    visualizations: {
      chartType: string;
      data: any;
      config: any;
    }[];
    chartData?: {
      timeSeriesData?: any[];
      statisticalSummary?: any;
      trends?: any[];
      correlations?: any[];
    };
  };

  @Prop()
  errorMessage?: string;

  @Prop()
  processingStartTime?: Date;

  @Prop()
  processingEndTime?: Date;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;
}

export const FileSchema = SchemaFactory.createForClass(File); 