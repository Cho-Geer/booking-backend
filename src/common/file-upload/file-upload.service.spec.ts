/**
 * 文件上传服务单元测试
 * 覆盖路径穿越防护(单一路径段校验 + 解析后包含性双保险)与正常文件操作
 * @author Booking System
 * @since 2024
 */

import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';

// 全部 mock fs/promises,避免真实磁盘操作
jest.mock('fs/promises', () => ({
  access: jest.fn(),
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  stat: jest.fn().mockResolvedValue({ size: 1024 }),
  readdir: jest.fn().mockResolvedValue([]),
}));

import * as fs from 'fs/promises';
import { FileUploadService } from './file-upload.service';

const mockedFs = fs as jest.Mocked<typeof fs>;

describe('FileUploadService', () => {
  let service: FileUploadService;

  const mockConfigService = {
    get: jest.fn().mockImplementation((key: string) => {
      const config: Record<string, any> = {
        UPLOAD_DIR: './uploads',
        MAX_FILE_SIZE: 5 * 1024 * 1024,
        ALLOWED_MIME_TYPES: [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ],
        UPLOAD_BASE_URL: '/uploads',
      };
      return config[key];
    }),
  };

  // 构造最小可用的 Multer.File 夹具
  function createMockFile(originalname = 'photo.jpg', mimetype = 'image/jpeg'): Express.Multer.File {
    return {
      originalname,
      mimetype,
      size: 100,
      buffer: Buffer.from('fake-file-content'),
      fieldname: 'file',
      encoding: '7bit',
      destination: '',
      filename: '',
      path: '',
      stream: undefined as any,
    } as Express.Multer.File;
  }

  beforeEach(() => {
    // 模拟 uploadDir 需要创建(access 抛 ENOENT -> 走 mkdir)
    (mockedFs.access as jest.Mock).mockRejectedValue({ code: 'ENOENT' });
    (mockedFs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (mockedFs.writeFile as jest.Mock).mockResolvedValue(undefined);
    (mockedFs.unlink as jest.Mock).mockResolvedValue(undefined);
    (mockedFs.stat as jest.Mock).mockResolvedValue({ size: 1024 });
    (mockedFs.readdir as jest.Mock).mockResolvedValue([]);
    service = new FileUploadService(mockConfigService as unknown as ConfigService);
    // 清掉构造函数内 ensureUploadDirectory 的 access/mkdir 调用,使各用例断言从干净计数开始
    jest.clearAllMocks();
  });

  describe('路径穿越防护', () => {
    const maliciousNames = ['../../evil.txt', '..\\evil', '/etc/passwd', 'a/b'];

    it.each(maliciousNames)('uploadFile 应拒绝恶意文件名 "%s" 且不写任何文件', async (name) => {
      await expect(service.uploadFile(createMockFile(), { filename: name })).rejects.toThrow(BadRequestException);
      expect(mockedFs.writeFile).not.toHaveBeenCalled();
    });

    it.each(maliciousNames)('deleteFile 应拒绝恶意文件名 "%s" 且不触碰文件系统', async (name) => {
      await expect(service.deleteFile(name)).rejects.toThrow(BadRequestException);
      expect(mockedFs.unlink).not.toHaveBeenCalled();
    });

    it.each(maliciousNames)('getFileInfo 应拒绝恶意文件名 "%s" 且不触碰文件系统', async (name) => {
      await expect(service.getFileInfo(name)).rejects.toThrow(BadRequestException);
      expect(mockedFs.stat).not.toHaveBeenCalled();
    });

    it.each(maliciousNames)('fileExists 应拒绝恶意文件名 "%s" 且不触碰文件系统', async (name) => {
      await expect(service.fileExists(name)).rejects.toThrow(BadRequestException);
      expect(mockedFs.access).not.toHaveBeenCalled();
    });

    it('uploadAvatar 应拒绝包含 ../ 的 userId', async () => {
      await expect(service.uploadAvatar(createMockFile(), '../../evil')).rejects.toThrow(BadRequestException);
      expect(mockedFs.writeFile).not.toHaveBeenCalled();
    });
  });

  describe('合法文件操作', () => {
    it('uploadFile 使用合法文件名时应写入 uploadDir 内的路径', async () => {
      const result = await service.uploadFile(createMockFile('photo.jpg'), { filename: 'photo.jpg' });

      expect(result.filename).toBe('photo.jpg');
      expect(mockedFs.writeFile).toHaveBeenCalledTimes(1);
      const [writtenPath] = (mockedFs.writeFile as jest.Mock).mock.calls[0];
      expect(path.basename(writtenPath)).toBe('photo.jpg');
      expect(path.resolve(writtenPath)).toBe(path.resolve('./uploads', 'photo.jpg'));
    });

    it('uploadAvatar 使用合法 userId 时应在 avatars 目录内写入', async () => {
      const result = await service.uploadAvatar(createMockFile('photo.jpg'), 'u-123');

      expect(mockedFs.writeFile).toHaveBeenCalledTimes(1);
      const [writtenPath] = (mockedFs.writeFile as jest.Mock).mock.calls[0];
      expect(path.basename(writtenPath)).toMatch(/^avatar_u-123_\d+\.jpg$/);
      expect(path.resolve(writtenPath)).toBe(path.resolve('./uploads/avatars', path.basename(writtenPath)));
      expect(result.filename).toBe(path.basename(writtenPath));
    });

    it('deleteFile 使用合法文件名时应在 uploadDir 内执行 unlink', async () => {
      await service.deleteFile('photo.jpg');

      expect(mockedFs.unlink).toHaveBeenCalledTimes(1);
      const [deletedPath] = (mockedFs.unlink as jest.Mock).mock.calls[0];
      expect(path.resolve(deletedPath)).toBe(path.resolve('./uploads', 'photo.jpg'));
    });

    it('getFileInfo 使用合法文件名时应返回文件信息', async () => {
      const info = await service.getFileInfo('photo.jpg');

      expect(info).not.toBeNull();
      expect(info?.filename).toBe('photo.jpg');
      expect(mockedFs.stat).toHaveBeenCalledTimes(1);
    });

    it('fileExists 使用合法文件名时应返回 true', async () => {
      (mockedFs.access as jest.Mock).mockResolvedValue(undefined);

      await expect(service.fileExists('photo.jpg')).resolves.toBe(true);
    });

    it('getFileStats 对合法目录项应正常统计', async () => {
      (mockedFs.readdir as jest.Mock).mockResolvedValue([
        { name: 'a.jpg', isFile: () => true },
        { name: 'b.png', isFile: () => true },
      ]);

      const stats = await service.getFileStats();

      expect(stats.totalFiles).toBe(2);
      expect(mockedFs.stat).toHaveBeenCalledTimes(2);
      const [firstPath] = (mockedFs.stat as jest.Mock).mock.calls[0];
      expect(path.basename(firstPath)).toBe('a.jpg');
    });
  });
});
