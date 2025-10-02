/**
 * 文件上传控制器
 * 处理文件上传相关的HTTP请求
 * @author Booking System
 * @since 2024
 */

import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators';
import { FileUploadService, UploadedFile as FileUploadResult } from './file-upload.service';

/**
 * 文件上传控制器类
 * 提供文件上传、下载和管理功能
 */
@ApiTags('文件上传')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FileUploadController {
  constructor(private readonly fileUploadService: FileUploadService) {}

  /**
   * 上传单个文件
   * @param file 上传的文件
   * @param currentUser 当前用户
   * @returns 上传结果
   */
  @Post('single')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: '上传单个文件' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: '上传成功' })
  async uploadSingle(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() currentUser: any,
  ): Promise<FileUploadResult> {
    if (!file) {
      throw new BadRequestException('请选择要上传的文件');
    }

    return await this.fileUploadService.uploadFile(file);
  }

  /**
   * 上传多个文件
   * @param files 上传的文件列表
   * @param currentUser 当前用户
   * @returns 上传结果列表
   */
  @Post('multiple')
  @UseInterceptors(FilesInterceptor('files', 10))
  @ApiOperation({ summary: '上传多个文件（最多10个）' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: '上传成功' })
  async uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() currentUser: any,
  ): Promise<FileUploadResult[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('请选择要上传的文件');
    }

    const uploadResults = await Promise.all(
      files.map(file => this.fileUploadService.uploadFile(file))
    );

    return uploadResults;
  }

  /**
   * 上传头像
   * @param avatar 头像文件
   * @param currentUser 当前用户
   * @returns 头像上传结果
   */
  @Post('avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiOperation({ summary: '上传用户头像' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: '头像上传成功' })
  async uploadAvatar(
    @UploadedFile() avatar: Express.Multer.File,
    @CurrentUser() currentUser: any,
  ): Promise<FileUploadResult> {
    if (!avatar) {
      throw new BadRequestException('请选择头像文件');
    }

    return await this.fileUploadService.uploadAvatar(avatar, currentUser.userId);
  }

  /**
   * 获取文件统计信息
   * @returns 文件统计信息
   */
  @Get('stats')
  @ApiOperation({ summary: '获取文件统计信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getFileStats() {
    return await this.fileUploadService.getFileStats();
  }

  /**
   * 检查文件是否存在
   * @param filename 文件名
   * @returns 文件是否存在
   */
  @Get('exists/:filename')
  @ApiOperation({ summary: '检查文件是否存在' })
  @ApiResponse({ status: 200, description: '检查成功' })
  async fileExists(@Param('filename') filename: string) {
    const exists = await this.fileUploadService.fileExists(filename);
    return { exists };
  }

  /**
   * 获取文件信息
   * @param filename 文件名
   * @returns 文件信息
   */
  @Get('info/:filename')
  @ApiOperation({ summary: '获取文件信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getFileInfo(@Param('filename') filename: string) {
    const fileInfo = await this.fileUploadService.getFileInfo(filename);
    if (!fileInfo) {
      throw new BadRequestException('文件不存在');
    }
    return fileInfo;
  }

  /**
   * 删除文件
   * @param filename 文件名
   * @returns 删除结果
   */
  @Delete(':filename')
  @ApiOperation({ summary: '删除文件' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async deleteFile(@Param('filename') filename: string) {
    await this.fileUploadService.deleteFile(filename);
    return { message: '文件删除成功' };
  }
}