/**
 * 系统配置服务
 * 处理系统配置相关的业务逻辑
 * @author Booking System
 * @since 2024
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  /**
   * 获取所有系统配置
   * @returns 系统配置列表
   */
  async getAllSettings() {
    return await this.prisma.systemSetting.findMany();
  }

  /**
   * 根据键名获取系统配置
   * @param key 配置键名
   * @returns 配置值
   */
  async getSettingByKey(key: string) {
    return await this.prisma.systemSetting.findUnique({
      where: { settingKey: key },
    });
  }

  /**
   * 更新系统配置
   * @param key 配置键名
   * @param value 配置值
   * @returns 更新后的配置
   */
  async updateSetting(key: string, value: string) {
    return await this.prisma.systemSetting.upsert({
      where: { settingKey: key },
      update: { settingValue: value },
      create: {
        settingKey: key,
        settingValue: value,
        settingType: 'STRING',
        isPublic: false,
        category: 'SYSTEM',
      },
    });
  }

  /**
   * 获取公开的系统配置
   * @returns 公开配置列表
   */
  async getPublicSettings() {
    return await this.prisma.systemSetting.findMany({
      where: { isPublic: true },
    });
  }
}