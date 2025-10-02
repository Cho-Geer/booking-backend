/**
 * 文件上传服务
 * 处理文件上传、存储和管理
 * @author Booking System
 * @since 2024
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

export interface FileUploadOptions {
  maxSize?: number; // 最大文件大小（字节）
  allowedTypes?: string[]; // 允许的文件类型
  destination?: string; // 存储目录
  filename?: string; // 自定义文件名
}

export interface UploadedFile {
  originalname: string;
  filename: string;
  mimetype: string;
  size: number;
  path: string;
  url: string;
}

@Injectable()
export class FileUploadService {
  private readonly logger = new Logger(FileUploadService.name);
  private readonly uploadDir: string;
  private readonly maxFileSize: number;
  private readonly allowedMimeTypes: string[];
  private readonly baseUrl: string;

  constructor(private configService: ConfigService) {
    this.uploadDir = this.configService.get('UPLOAD_DIR', './uploads');
    this.maxFileSize = this.configService.get('MAX_FILE_SIZE', 5 * 1024 * 1024); // 5MB
    this.allowedMimeTypes = this.configService.get('ALLOWED_MIME_TYPES', [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]);
    this.baseUrl = this.configService.get('UPLOAD_BASE_URL', '/uploads');
    
    this.ensureUploadDirectory();
  }

  /**
   * 确保上传目录存在
   */
  private async ensureUploadDirectory(): Promise<void> {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
      this.logger.log(`创建上传目录: ${this.uploadDir}`);
    }
  }

  /**
   * 验证文件类型
   */
  private validateFileType(mimetype: string, originalname: string): boolean {
    // 检查MIME类型
    if (this.allowedMimeTypes.length > 0 && !this.allowedMimeTypes.includes(mimetype)) {
      return false;
    }

    // 检查文件扩展名
    const ext = path.extname(originalname).toLowerCase();
    const allowedExtensions = this.getAllowedExtensions();
    
    return allowedExtensions.includes(ext);
  }

  /**
   * 获取允许的文件扩展名
   */
  private getAllowedExtensions(): string[] {
    const mimeToExt = {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    };

    const extensions: string[] = [];
    this.allowedMimeTypes.forEach(mime => {
      if (mimeToExt[mime]) {
        extensions.push(...mimeToExt[mime]);
      }
    });

    return extensions;
  }

  /**
   * 生成唯一文件名
   */
  private generateFilename(originalname: string): string {
    const ext = path.extname(originalname);
    const basename = path.basename(originalname, ext);
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    
    // 清理基础文件名（移除特殊字符）
    const cleanBasename = basename.replace(/[^a-zA-Z0-9\-_]/g, '');
    
    return `${cleanBasename}_${timestamp}_${random}${ext}`;
  }

  /**
   * 上传文件
   */
  async uploadFile(file: Express.Multer.File, options?: FileUploadOptions): Promise<UploadedFile> {
    // 验证文件大小
    const maxSize = options?.maxSize || this.maxFileSize;
    if (file.size > maxSize) {
      throw new Error(`文件大小超过限制: ${maxSize / (1024 * 1024)}MB`);
    }

    // 验证文件类型
    if (!this.validateFileType(file.mimetype, file.originalname)) {
      throw new Error(`不支持的文件类型: ${file.mimetype}`);
    }

    // 生成文件名和路径
    const filename = options?.filename || this.generateFilename(file.originalname);
    const destination = options?.destination || this.uploadDir;
    const filePath = path.join(destination, filename);

    try {
      // 确保目标目录存在
      await fs.mkdir(destination, { recursive: true });

      // 保存文件
      await fs.writeFile(filePath, new Uint8Array(file.buffer));

      // 生成访问URL
      const url = `${this.baseUrl}/${filename}`;

      const uploadedFile: UploadedFile = {
        originalname: file.originalname,
        filename,
        mimetype: file.mimetype,
        size: file.size,
        path: filePath,
        url,
      };

      this.logger.log(`文件上传成功: ${file.originalname} -> ${filename}`);
      
      return uploadedFile;
    } catch (error) {
      this.logger.error(`文件上传失败: ${file.originalname}`, error);
      throw new Error(`文件上传失败: ${error.message}`);
    }
  }

  /**
   * 上传头像文件（专用方法）
   */
  async uploadAvatar(file: Express.Multer.File, userId: string): Promise<UploadedFile> {
    const avatarOptions: FileUploadOptions = {
      maxSize: 2 * 1024 * 1024, // 2MB
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      destination: path.join(this.uploadDir, 'avatars'),
      filename: `avatar_${userId}_${Date.now()}${path.extname(file.originalname)}`,
    };

    return this.uploadFile(file, avatarOptions);
  }

  /**
   * 删除文件
   */
  async deleteFile(filename: string): Promise<void> {
    try {
      const filePath = path.join(this.uploadDir, filename);
      await fs.unlink(filePath);
      this.logger.log(`文件删除成功: ${filename}`);
    } catch (error) {
      if (error.code === 'ENOENT') {
        this.logger.warn(`文件不存在: ${filename}`);
      } else {
        this.logger.error(`文件删除失败: ${filename}`, error);
        throw new Error(`文件删除失败: ${error.message}`);
      }
    }
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(filename: string): Promise<UploadedFile | null> {
    try {
      const filePath = path.join(this.uploadDir, filename);
      const stats = await fs.stat(filePath);
      
      return {
        originalname: filename,
        filename,
        mimetype: this.getMimeType(filename),
        size: stats.size,
        path: filePath,
        url: `${this.baseUrl}/${filename}`,
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * 根据文件名获取MIME类型
   */
  private getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * 检查文件是否存在
   */
  async fileExists(filename: string): Promise<boolean> {
    try {
      const filePath = path.join(this.uploadDir, filename);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取文件统计信息
   */
  async getFileStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    fileTypes: Record<string, number>;
  }> {
    try {
      const files = await fs.readdir(this.uploadDir, { withFileTypes: true });
      let totalSize = 0;
      const fileTypes: Record<string, number> = {};

      for (const file of files) {
        if (file.isFile()) {
          const filePath = path.join(this.uploadDir, file.name);
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
          
          const ext = path.extname(file.name).toLowerCase();
          fileTypes[ext] = (fileTypes[ext] || 0) + 1;
        }
      }

      return {
        totalFiles: files.filter(f => f.isFile()).length,
        totalSize,
        fileTypes,
      };
    } catch (error) {
      this.logger.error('获取文件统计信息失败', error);
      return {
        totalFiles: 0,
        totalSize: 0,
        fileTypes: {},
      };
    }
  }
}