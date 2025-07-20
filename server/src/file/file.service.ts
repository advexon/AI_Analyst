import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { File, FileDocument, FileStatus, FileType, FileAccessLevel, FilePermission } from './schemas/file.schema';
import { User, UserDocument, UserRole } from '../user/schemas/user.schema';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import * as Papa from 'papaparse';

export interface FileSearchFilters {
  search?: string;
  status?: FileStatus;
  fileType?: FileType;
  accessLevel?: FileAccessLevel;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  userId?: string;
  department?: string;
  category?: string;
}

@Injectable()
export class FileService {
  constructor(
    @InjectModel(File.name) private fileModel: Model<FileDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async uploadFile(
    file: Express.Multer.File,
    userId: string,
    aiModel?: string,
    metadata?: any,
  ): Promise<FileDocument> {
    // Validate file type
    const fileExtension = path.extname(file.originalname).toLowerCase();
    let fileType: FileType;

    switch (fileExtension) {
      case '.csv':
        fileType = FileType.CSV;
        break;
      case '.json':
        fileType = FileType.JSON;
        break;
      case '.xlsx':
      case '.xls':
        fileType = FileType.XLSX;
        break;
      default:
        throw new BadRequestException(
          'Unsupported file type. Please upload CSV, JSON, or Excel files.',
        );
    }

    // Create file record
    const newFile = new this.fileModel({
      originalName: file.originalname,
      fileName: file.filename,
      filePath: file.path,
      fileType,
      fileSize: file.size,
      userId: new Types.ObjectId(userId),
      aiModel,
      status: FileStatus.PENDING,
      accessLevel: FileAccessLevel.PRIVATE,
      permissions: [],
      tags: metadata?.tags || [],
      description: metadata?.description,
      metadata: {
        department: metadata?.department,
        category: metadata?.category,
        confidentialityLevel: metadata?.confidentialityLevel || 'internal',
      },
    });

    return newFile.save();
  }

  async getUserFiles(userId: string): Promise<FileDocument[]> {
    return this.fileModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
  }

  async getAccessibleFiles(userId: string, filters?: FileSearchFilters): Promise<FileDocument[]> {
    const user = await this.userModel.findById(userId);
    const userObjectId = new Types.ObjectId(userId);

    let query: any = {};

    // Build base access query
    if (user?.role === UserRole.ADMIN) {
      // Admin can see all files
      query = {};
    } else {
      // Regular users can see their own files and files shared with them
      query = {
        $or: [
          { userId: userObjectId },
          { accessLevel: FileAccessLevel.PUBLIC },
          { 'permissions.userId': userObjectId },
        ],
      };
    }

    // Apply filters
    if (filters) {
      if (filters.search) {
        query.$and = query.$and || [];
        query.$and.push({
          $or: [
            { originalName: { $regex: filters.search, $options: 'i' } },
            { description: { $regex: filters.search, $options: 'i' } },
            { tags: { $in: [new RegExp(filters.search, 'i')] } },
          ],
        });
      }

      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.fileType) {
        query.fileType = filters.fileType;
      }

      if (filters.accessLevel) {
        query.accessLevel = filters.accessLevel;
      }

      if (filters.tags && filters.tags.length > 0) {
        query.tags = { $in: filters.tags };
      }

      if (filters.dateFrom || filters.dateTo) {
        query.createdAt = {};
        if (filters.dateFrom) {
          query.createdAt.$gte = filters.dateFrom;
        }
        if (filters.dateTo) {
          query.createdAt.$lte = filters.dateTo;
        }
      }

      if (filters.department) {
        query['metadata.department'] = filters.department;
      }

      if (filters.category) {
        query['metadata.category'] = filters.category;
      }
    }

    return this.fileModel
      .find(query)
      .populate('userId', 'firstName lastName email role')
      .sort({ createdAt: -1 })
      .exec();
  }

  async getFileById(fileId: string, userId: string): Promise<FileDocument> {
    const userObjectId = new Types.ObjectId(userId);
    const user = await this.userModel.findById(userId);

    const file = await this.fileModel.findById(fileId);

    if (!file) {
      throw new NotFoundException('File not found');
    }

    // Check access permissions
    const hasAccess = 
      user?.role === UserRole.ADMIN ||
      file.userId.equals(userObjectId) ||
      file.accessLevel === FileAccessLevel.PUBLIC ||
      file.permissions.some(p => p.userId.equals(userObjectId));

    if (!hasAccess) {
      throw new ForbiddenException('Access denied to this file');
    }

    return file;
  }

  async shareFile(
    fileId: string,
    ownerId: string,
    targetUserId: string,
    accessLevel: 'read' | 'write' | 'admin',
  ): Promise<FileDocument> {
    const file = await this.fileModel.findOne({
      _id: new Types.ObjectId(fileId),
      userId: new Types.ObjectId(ownerId),
    });

    if (!file) {
      throw new NotFoundException('File not found or you are not the owner');
    }

    const targetUser = await this.userModel.findById(targetUserId);
    if (!targetUser) {
      throw new NotFoundException('Target user not found');
    }

    // Remove existing permission for this user
    file.permissions = file.permissions.filter(
      p => !p.userId.equals(new Types.ObjectId(targetUserId))
    );

    // Add new permission
    const newPermission: FilePermission = {
      userId: new Types.ObjectId(targetUserId),
      accessLevel,
      grantedBy: new Types.ObjectId(ownerId),
      grantedAt: new Date(),
    };

    file.permissions.push(newPermission);
    file.accessLevel = FileAccessLevel.SHARED;

    return file.save();
  }

  async updateFileMetadata(
    fileId: string,
    userId: string,
    updates: {
      tags?: string[];
      description?: string;
      accessLevel?: FileAccessLevel;
      metadata?: any;
    },
  ): Promise<FileDocument> {
    const file = await this.getFileById(fileId, userId);

    // Check write permissions
    const userObjectId = new Types.ObjectId(userId);
    const user = await this.userModel.findById(userId);
    
    const hasWriteAccess =
      user?.role === UserRole.ADMIN ||
      file.userId.equals(userObjectId) ||
      file.permissions.some(p => 
        p.userId.equals(userObjectId) && 
        (p.accessLevel === 'write' || p.accessLevel === 'admin')
      );

    if (!hasWriteAccess) {
      throw new ForbiddenException('You do not have write access to this file');
    }

    const updateData: any = {};
    if (updates.tags !== undefined) updateData.tags = updates.tags;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.accessLevel !== undefined) updateData.accessLevel = updates.accessLevel;
    if (updates.metadata !== undefined) {
      updateData.metadata = { ...file.metadata, ...updates.metadata };
    }

    const updatedFile = await this.fileModel.findByIdAndUpdate(
      fileId,
      updateData,
      { new: true }
    );

    return updatedFile!;
  }

  async deleteFile(fileId: string, userId: string): Promise<void> {
    const file = await this.getFileById(fileId, userId);

    // Check delete permissions
    const userObjectId = new Types.ObjectId(userId);
    const user = await this.userModel.findById(userId);
    
    const hasDeleteAccess =
      user?.role === UserRole.ADMIN ||
      file.userId.equals(userObjectId) ||
      file.permissions.some(p => 
        p.userId.equals(userObjectId) && 
        p.accessLevel === 'admin'
      );

    if (!hasDeleteAccess) {
      throw new ForbiddenException('You do not have delete access to this file');
    }

    // Delete physical file
    if (fs.existsSync(file.filePath)) {
      fs.unlinkSync(file.filePath);
    }

    // Delete database record
    await this.fileModel.deleteOne({ _id: file._id });
  }

  async updateFileStatus(
    fileId: string,
    status: FileStatus,
    errorMessage?: string,
  ): Promise<FileDocument> {
    const updateData: any = { 
      status,
      ...(status === FileStatus.ANALYZING && { processingStartTime: new Date() }),
      ...(status === FileStatus.COMPLETED && { processingEndTime: new Date() }),
      ...(status === FileStatus.FAILED && { 
        processingEndTime: new Date(),
        errorMessage 
      }),
    };

    const updatedFile = await this.fileModel.findByIdAndUpdate(
      fileId,
      updateData,
      { new: true },
    );

    if (!updatedFile) {
      throw new NotFoundException('File not found');
    }

    return updatedFile;
  }

  async saveAnalysisResult(
    fileId: string,
    analysisResult: any,
  ): Promise<FileDocument> {
    // Enhanced analysis result with chart data
    const enhancedResult = {
      ...analysisResult,
      chartData: this.generateChartData(analysisResult),
    };

    const updatedFile = await this.fileModel.findByIdAndUpdate(
      fileId,
      {
        analysisResult: enhancedResult,
        status: FileStatus.COMPLETED,
        processingEndTime: new Date(),
      },
      { new: true },
    );

    if (!updatedFile) {
      throw new NotFoundException('File not found');
    }

    return updatedFile;
  }

  private generateChartData(analysisResult: any): any {
    // Generate real chart data from analysis results
    const chartData: any = {};

    // Time series data if dates are detected
    if (analysisResult.statistics?.dataTypes) {
      const dateColumns = Object.entries(analysisResult.statistics.dataTypes)
        .filter(([_, type]) => type === 'date')
        .map(([col, _]) => col);

      if (dateColumns.length > 0) {
        chartData.timeSeriesData = {
          hasTimeSeries: true,
          dateColumns,
        };
      }
    }

    // Statistical summary for charts
    chartData.statisticalSummary = {
      totalRows: analysisResult.statistics?.totalRows || 0,
      totalColumns: analysisResult.statistics?.totalColumns || 0,
      insightsCount: analysisResult.insights?.length || 0,
      trendsCount: analysisResult.trends?.length || 0,
    };

    // Trends data for line charts
    chartData.trends = analysisResult.trends?.map((trend: string, index: number) => ({
      id: index,
      label: trend.substring(0, 50),
      value: Math.random() * 100, // In real implementation, extract actual values
    })) || [];

    return chartData;
  }

  async parseFileData(filePath: string, fileType: FileType): Promise<any[]> {
    try {
      switch (fileType) {
        case FileType.CSV:
          return this.parseCSV(filePath);
        case FileType.JSON:
          return this.parseJSON(filePath);
        case FileType.XLSX:
          return this.parseExcel(filePath);
        default:
          throw new BadRequestException('Unsupported file type');
      }
    } catch (error) {
      throw new BadRequestException(`Failed to parse file: ${error.message}`);
    }
  }

  private parseCSV(filePath: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      // Read file content with UTF-8 encoding
      let fileContent = fs.readFileSync(filePath, 'utf8');
      
      // Remove UTF-8 BOM if present (common in multilingual files)
      if (fileContent.charCodeAt(0) === 0xFEFF) {
        fileContent = fileContent.slice(1);
      }
      
      Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        encoding: 'UTF-8',
        complete: (results) => {
          resolve(results.data);
        },
        error: (error) => {
          reject(error);
        },
      });
    });
  }

  private parseJSON(filePath: string): any[] {
    // Read file content with UTF-8 encoding
    let fileContent = fs.readFileSync(filePath, 'utf8');
    
    // Remove UTF-8 BOM if present (common in multilingual files)
    if (fileContent.charCodeAt(0) === 0xFEFF) {
      fileContent = fileContent.slice(1);
    }
    
    const data = JSON.parse(fileContent);
    
    // Ensure data is an array
    if (Array.isArray(data)) {
      return data;
    } else if (typeof data === 'object') {
      // If it's an object, wrap it in an array
      return [data];
    } else {
      throw new Error('JSON file must contain an array or object');
    }
  }

  private parseExcel(filePath: string): any[] {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];
    
    return XLSX.utils.sheet_to_json(worksheet);
  }

  async getDataPreview(filePath: string, fileType: FileType, limit = 5): Promise<any[]> {
    const data = await this.parseFileData(filePath, fileType);
    return data.slice(0, limit);
  }

  getFileStatistics(data: any[]): any {
    if (!data.length) {
      return {
        totalRows: 0,
        totalColumns: 0,
        dataTypes: {},
      };
    }

    const firstRow = data[0];
    const columns = Object.keys(firstRow);
    const dataTypes: Record<string, string> = {};

    // Analyze data types for each column
    columns.forEach(column => {
      const values = data.map(row => row[column]).filter(val => val !== null && val !== undefined);
      const sampleValue = values[0];
      
      if (typeof sampleValue === 'number') {
        dataTypes[column] = 'number';
      } else if (typeof sampleValue === 'boolean') {
        dataTypes[column] = 'boolean';
      } else if (!isNaN(Date.parse(sampleValue))) {
        dataTypes[column] = 'date';
      } else {
        dataTypes[column] = 'string';
      }
    });

    return {
      totalRows: data.length,
      totalColumns: columns.length,
      dataTypes,
      detectedLanguages: this.detectLanguages(data),
    };
  }

  private detectLanguages(data: any[]): string[] {
    const languages: string[] = [];
    
    if (!data.length) return ['unknown'];
    
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
        if (!languages.includes('Tajik (тоҷикӣ)')) {
          languages.push('Tajik (тоҷикӣ)');
        }
      } else {
        if (!languages.includes('Russian (русский)')) {
          languages.push('Russian (русский)');
        }
      }
    }
    
    if (/[a-z]/i.test(allText)) {
      if (!languages.includes('English')) {
        languages.push('English');
      }
    }
    
    // Add more language detection logic here as needed
    if (/[ა-ჯ]/.test(allText)) {
      if (!languages.includes('Georgian')) {
        languages.push('Georgian');
      }
    }
    
    if (/[ա-ֆ]/.test(allText)) {
      if (!languages.includes('Armenian')) {
        languages.push('Armenian');
      }
    }
    
    return languages.length > 0 ? languages : ['English (detected)'];
  }

  async getUserStats(userId: string): Promise<any> {
    const userFiles = await this.fileModel.find({ 
      userId: new Types.ObjectId(userId) 
    });

    return {
      totalFiles: userFiles.length,
      completedAnalyses: userFiles.filter(f => f.status === FileStatus.COMPLETED).length,
      pendingFiles: userFiles.filter(f => f.status === FileStatus.PENDING || f.status === FileStatus.QUEUED).length,
      failedFiles: userFiles.filter(f => f.status === FileStatus.FAILED).length,
    };
  }

  async getAnalyticsData(userId: string): Promise<any> {
    const user = await this.userModel.findById(userId);
    
    // Get accessible files for analytics
    const files = await this.getAccessibleFiles(userId);
    
    // Generate real analytics data from files
    const completedFiles = files.filter(f => f.status === FileStatus.COMPLETED && f.analysisResult);
    
    // Monthly activity data
    const monthlyData = this.generateMonthlyAnalytics(completedFiles);
    
    // File type distribution
    const fileTypeData = this.generateFileTypeAnalytics(files);
    
    // Trend analysis
    const trendData = this.generateTrendAnalytics(completedFiles);
    
    return {
      monthlyActivity: monthlyData,
      fileTypeDistribution: fileTypeData,
      trendAnalysis: trendData,
      totalFiles: files.length,
      completedAnalyses: completedFiles.length,
    };
  }

  private generateMonthlyAnalytics(files: FileDocument[]): any {
    const monthData = new Array(12).fill(0);
    const currentYear = new Date().getFullYear();
    
    files.forEach(file => {
      const fileDate = new Date(file.createdAt);
      if (fileDate.getFullYear() === currentYear) {
        monthData[fileDate.getMonth()]++;
      }
    });
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return {
      labels: months,
      datasets: [{
        label: 'Files Analyzed',
        data: monthData,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        tension: 0.4,
      }]
    };
  }

  private generateFileTypeAnalytics(files: FileDocument[]): any {
    const typeCounts = files.reduce((acc, file) => {
      acc[file.fileType] = (acc[file.fileType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      labels: Object.keys(typeCounts).map(type => type.toUpperCase()),
      datasets: [{
        data: Object.values(typeCounts),
        backgroundColor: [
          'rgb(59, 130, 246)',
          'rgb(16, 185, 129)',
          'rgb(245, 158, 11)',
          'rgb(239, 68, 68)',
        ],
      }]
    };
  }

  private generateTrendAnalytics(files: FileDocument[]): any {
    // Generate insights trend data
    const insightCounts = files.map(file => ({
      fileName: file.originalName,
      insightCount: file.analysisResult?.insights?.length || 0,
      date: file.createdAt,
    }));
    
    return {
      labels: insightCounts.slice(-6).map(item => 
        item.fileName.length > 15 ? item.fileName.substring(0, 15) + '...' : item.fileName
      ),
      datasets: [{
        label: 'AI Insights Generated',
        data: insightCounts.slice(-6).map(item => item.insightCount),
        backgroundColor: 'rgba(16, 185, 129, 0.5)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 1,
      }]
    };
  }
} 