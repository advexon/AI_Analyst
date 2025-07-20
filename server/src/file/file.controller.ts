import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileService, FileSearchFilters } from './file.service';
import { AIService } from '../ai/ai.service';
import { UploadFileDto } from './dto/upload-file.dto';
import { FileStatus, FileAccessLevel } from './schemas/file.schema';

export interface ShareFileDto {
  targetUserId: string;
  accessLevel: 'read' | 'write' | 'admin';
}

export interface UpdateFileMetadataDto {
  tags?: string[];
  description?: string;
  accessLevel?: FileAccessLevel;
  metadata?: {
    department?: string;
    category?: string;
    confidentialityLevel?: 'public' | 'internal' | 'confidential' | 'restricted';
  };
}

@Controller('files')
// @UseGuards(JwtAuthGuard) // Disabled for Ministry use - local secure environment
export class FileController {
  constructor(
    private fileService: FileService,
    private aiService: AIService,
  ) {}

  // Helper method to get user ID - defaults to ministry user for local secure environment
  private getUserId(req: any): string {
    return req.user?._id?.toString() || '507f1f77bcf86cd799439011'; // Default ObjectId for Ministry
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          // Generate unique filename
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        // Check file type
        const allowedTypes = ['.csv', '.json', '.xlsx', '.xls'];
        const fileExtension = extname(file.originalname).toLowerCase();
        
        if (allowedTypes.includes(fileExtension)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only CSV, JSON, and Excel files are allowed'), false);
        }
      },
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadFileDto: UploadFileDto & { metadata?: string },
    @Request() req,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Parse metadata if provided
    let metadata = {};
    if (uploadFileDto.metadata) {
      try {
        metadata = JSON.parse(uploadFileDto.metadata);
      } catch (error) {
        // Ignore invalid metadata
      }
    }

    // Save file record to database
    const fileRecord = await this.fileService.uploadFile(
      file,
      this.getUserId(req),
      uploadFileDto.aiModel,
      metadata,
    );

    // Process analysis immediately for small files (< 5MB) or if AI model is specified
    if (uploadFileDto.aiModel && file.size < 5 * 1024 * 1024) {
      try {
        // Process immediately for small files
        this.processFileAnalysis(fileRecord._id.toString(), fileRecord.filePath, fileRecord.fileType, fileRecord.originalName, uploadFileDto.aiModel, this.getUserId(req));
      } catch (error) {
        console.log('Background analysis started for:', fileRecord.originalName);
      }
    }

    return {
      message: 'File uploaded successfully',
      file: fileRecord,
    };
  }

  @Get()
  async getUserFiles(@Request() req) {
    const files = await this.fileService.getUserFiles(this.getUserId(req));
    return {
      files,
      total: files.length,
    };
  }

  @Get('accessible')
  async getAccessibleFiles(
    @Query() filters: FileSearchFilters,
    @Request() req,
  ) {
    const files = await this.fileService.getAccessibleFiles(this.getUserId(req), filters);
    return {
      files,
      total: files.length,
      filters: filters,
    };
  }

  @Get('analytics')
  async getAnalyticsData(@Request() req) {
    return this.fileService.getAnalyticsData(this.getUserId(req));
  }

  @Get('stats')
  async getUserStats(@Request() req) {
    return this.fileService.getUserStats(this.getUserId(req));
  }

  @Get(':id')
  async getFileById(@Param('id') id: string, @Request() req) {
    return this.fileService.getFileById(id, this.getUserId(req));
  }

  @Get(':id/preview')
  async getFilePreview(@Param('id') id: string, @Request() req) {
    const file = await this.fileService.getFileById(id, this.getUserId(req));
    const preview = await this.fileService.getDataPreview(
      file.filePath,
      file.fileType,
      10,
    );
    
    return {
      file: {
        id: file._id,
        name: file.originalName,
        type: file.fileType,
        size: file.fileSize,
        status: file.status,
      },
      preview,
      previewRows: preview.length,
    };
  }

  @Put(':id/metadata')
  async updateFileMetadata(
    @Param('id') id: string,
    @Body() updateData: UpdateFileMetadataDto,
    @Request() req,
  ) {
    const updatedFile = await this.fileService.updateFileMetadata(
      id,
      this.getUserId(req),
      updateData,
    );

    return {
      message: 'File metadata updated successfully',
      file: updatedFile,
    };
  }

  @Post(':id/share')
  async shareFile(
    @Param('id') id: string,
    @Body() shareData: ShareFileDto,
    @Request() req,
  ) {
    const updatedFile = await this.fileService.shareFile(
      id,
      this.getUserId(req),
      shareData.targetUserId,
      shareData.accessLevel,
    );

    return {
      message: 'File shared successfully',
      file: updatedFile,
    };
  }

  @Post(':id/analyze')
  async analyzeFile(
    @Param('id') id: string,
    @Body() body: { aiModel: string },
    @Request() req,
  ) {
    const file = await this.fileService.getFileById(id, this.getUserId(req));
    
    if (file.status === FileStatus.ANALYZING || file.status === FileStatus.QUEUED) {
      throw new BadRequestException('File is already being analyzed');
    }

    if (file.status === FileStatus.COMPLETED) {
      throw new BadRequestException('File has already been analyzed');
    }

    // Process analysis immediately
    this.processFileAnalysis(
      file._id.toString(),
      file.filePath,
      file.fileType,
      file.originalName,
      body.aiModel,
      this.getUserId(req)
    );

    return {
      message: 'Analysis started',
      fileId: file._id,
      status: FileStatus.ANALYZING,
    };
  }

  @Delete(':id')
  async deleteFile(@Param('id') id: string, @Request() req) {
    await this.fileService.deleteFile(id, this.getUserId(req));
    return {
      message: 'File deleted successfully',
    };
  }

  // Process file analysis (sync or async)
  private async processFileAnalysis(
    fileId: string,
    filePath: string,
    fileType: any,
    fileName: string,
    aiModel: string,
    userId: string
  ) {
    try {
      // Update status to analyzing
      await this.fileService.updateFileStatus(fileId, FileStatus.ANALYZING);

      // Parse file data
      const data = await this.fileService.parseFileData(filePath, fileType);
      
      if (!data || data.length === 0) {
        throw new Error('No data found in file or file is empty');
      }

      console.log(`Processing ${data.length} rows from ${fileName}`);

      // Perform AI analysis
      const analysisResult = await this.aiService.analyzeData(
        data,
        aiModel as any,
        fileName,
        userId,
      );

      // Save analysis results
      await this.fileService.saveAnalysisResult(fileId, analysisResult);
      
      console.log(`Analysis completed for: ${fileName}`);
      
    } catch (error) {
      console.error(`Analysis failed for ${fileName}:`, error);
      
      // Update file status to failed
      await this.fileService.updateFileStatus(
        fileId,
        FileStatus.FAILED,
        error.message,
      );
    }
  }
} 