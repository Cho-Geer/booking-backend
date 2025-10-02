/**
 * 文件上传拦截器
 * 处理文件上传验证和预处理
 * @author Booking System
 * @since 2024
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FileUploadService, FileUploadOptions } from './file-upload.service';

export interface FileInterceptorOptions extends FileUploadOptions {
  fieldName?: string; // 表单字段名
  maxCount?: number; // 最大文件数量
}

@Injectable()
export class FileUploadInterceptor implements NestInterceptor {
  constructor(
    private fileUploadService: FileUploadService,
    private options: FileInterceptorOptions = {},
  ) {}

  /**
   * 拦截器主方法
   */
  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    
    // 检查是否有文件上传
    if (!request.files || !request.files[this.options.fieldName || 'file']) {
      return next.handle();
    }

    const files = request.files[this.options.fieldName || 'file'];
    const isMultiple = Array.isArray(files);
    const fileArray = isMultiple ? files : [files];

    try {
      // 验证文件数量
      if (this.options.maxCount && fileArray.length > this.options.maxCount) {
        throw new BadRequestException(`最多上传 ${this.options.maxCount} 个文件`);
      }

      // 处理文件上传
      const uploadedFiles = await Promise.all(
        fileArray.map(file => this.fileUploadService.uploadFile(file, this.options)),
      );

      // 更新请求对象
      request.uploadedFiles = isMultiple ? uploadedFiles : uploadedFiles[0];

      return next.handle().pipe(
        map(data => {
          // 添加文件信息到响应
          if (request.uploadedFiles) {
            return {
              ...data,
              files: request.uploadedFiles,
            };
          }
          return data;
        }),
      );
    } catch (error) {
      throw new BadRequestException(`文件上传失败: ${error.message}`);
    }
  }
}

/**
 * 头像上传拦截器
 */
@Injectable()
export class AvatarUploadInterceptor implements NestInterceptor {
  constructor(private fileUploadService: FileUploadService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;

    if (!userId) {
      throw new BadRequestException('用户未登录');
    }

    if (!request.files || !request.files.avatar) {
      return next.handle();
    }

    const avatarFile = request.files.avatar[0];

    try {
      // 上传头像
      const uploadedAvatar = await this.fileUploadService.uploadAvatar(avatarFile, userId);
      
      // 更新请求对象
      request.uploadedAvatar = uploadedAvatar;
      request.body.avatarUrl = uploadedAvatar.url;

      return next.handle();
    } catch (error) {
      throw new BadRequestException(`头像上传失败: ${error.message}`);
    }
  }
}