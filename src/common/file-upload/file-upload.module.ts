/**
 * 文件上传模块
 * 提供文件上传相关服务
 * @author Booking System
 * @since 2024
 */

import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { FileUploadService } from './file-upload.service';
import { FileUploadController } from './file-upload.controller';
import { diskStorage } from 'multer';
import * as path from 'path';

@Module({
  imports: [
    // 配置JWT模块
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: Number(configService.get('JWT_EXPIRES_IN') || 3600),
        },
      }),
      inject: [ConfigService],
    }),
    // 配置Multer模块
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        storage: diskStorage({
          destination: (req, file, cb) => {
            // 根据文件类型设置不同的存储目录
            let dest = configService.get('UPLOAD_DIR', './uploads');
            
            if (file.mimetype.startsWith('image/')) {
              dest = path.join(dest, 'images');
            } else if (file.mimetype === 'application/pdf') {
              dest = path.join(dest, 'documents');
            } else {
              dest = path.join(dest, 'others');
            }

            cb(null, dest);
          },
          filename: (req, file, cb) => {
            // 生成唯一文件名
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            const ext = path.extname(file.originalname);
            const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '');
            cb(null, `${name}-${uniqueSuffix}${ext}`);
          },
        }),
        limits: {
          fileSize: configService.get('MAX_FILE_SIZE', 5 * 1024 * 1024), // 5MB
          files: 10, // 最多10个文件
        },
        fileFilter: (req, file, cb) => {
          // 文件类型过滤
          const allowedMimeTypes = configService.get('ALLOWED_MIME_TYPES', [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          ]);

          if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
          } else {
            cb(new Error('不支持的文件类型'), false);
          }
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [FileUploadController],
  providers: [FileUploadService],
  exports: [FileUploadService], // 导出服务供其他模块使用
})
export class FileUploadModule {}