/**
 * 用户头像控制器
 * 处理用户头像上传相关的HTTP请求
 * @author Booking System
 * @since 2024
 */

import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators';
import { FileUploadService } from '../../../common/file-upload/file-upload.service';
import { AvatarUploadInterceptor } from '../../../common/file-upload/file-upload.interceptor';

@ApiTags('用户管理')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserAvatarController {
  constructor(private readonly fileUploadService: FileUploadService) {}

  /**
   * 上传用户头像
   * @param avatar 头像文件
   * @param currentUser 当前用户
   * @returns 头像上传结果
   */
  @Post('profile/avatar')
  @UseInterceptors(FileInterceptor('avatar'), AvatarUploadInterceptor)
  @ApiOperation({ summary: '上传用户头像' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: '头像上传成功' })
  async uploadAvatar(
    @UploadedFile() avatar: Express.Multer.File,
    @CurrentUser() currentUser: any,
  ) {
    if (!avatar) {
      throw new BadRequestException('请选择头像文件');
    }

    return await this.fileUploadService.uploadAvatar(avatar, currentUser.userId);
  }
}