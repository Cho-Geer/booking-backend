/**
 * 系统控制器
 * 处理系统配置和报表相关的HTTP请求
 * @author Booking System
 * @since 2024
 */

import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators';
import { SettingsService } from '../services/settings.service';
import { ReportsService } from '../services/reports.service';

/**
 * 系统配置更新DTO
 */
export class UpdateSettingDto {
  settingValue: string;
}

/**
 * 系统控制器类
 * 提供系统管理和报表API接口
 */
@ApiTags('系统管理')
@Controller('system')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SystemController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly reportsService: ReportsService,
  ) {}

  /**
   * 获取系统配置（公开配置）
   * @returns 公开配置列表
   */
  @Get('settings')
  @ApiOperation({ summary: '获取系统配置（公开配置）' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getPublicSettings() {
    return await this.settingsService.getPublicSettings();
  }

  /**
   * 更新系统配置（管理员）
   * @param key 配置键
   * @param updateSettingDto 配置更新数据
   * @returns 更新后的配置
   */
  @Patch('settings/:key')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '更新系统配置（管理员）' })
  @ApiResponse({ status: 200, description: '更新成功' })
  async updateSetting(
    @Param('key') key: string,
    @Body() updateSettingDto: UpdateSettingDto,
  ) {
    return await this.settingsService.updateSetting(key, updateSettingDto.settingValue);
  }

  /**
   * 获取预约统计信息
   * @returns 预约统计
   */
  @Get('reports/statistics')
  @ApiOperation({ summary: '获取预约统计信息' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getAppointmentStatistics() {
    return await this.reportsService.getAppointmentStatistics();
  }

  /**
   * 获取用户统计信息
   * @returns 用户统计
   */
  @Get('reports/user-statistics')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '获取用户统计信息（管理员）' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getUserStatistics() {
    return await this.reportsService.getUserStatistics();
  }
}