/**
 * 通知控制器
 * 处理通知相关的HTTP请求
 * @author Booking System
 * @since 2024
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators';
import { WebsocketService } from './websocket.service';

/**
 * 通知创建DTO
 */
export class CreateNotificationDto {
  userId: string;
  type: 'SMS' | 'EMAIL' | 'WECHAT' | 'PUSH';
  title: string;
  content: string;
  priority?: 'low' | 'medium' | 'high';
  data?: any;
  scheduledAt?: Date;
}

/**
 * 通知查询DTO
 */
export class NotificationQueryDto {
  userId?: string;
  type?: string[];
  isRead?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * 通知控制器类
 * 提供通知管理的REST API接口
 */
@ApiTags('通知管理')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationController {
  constructor(private readonly websocketService: WebsocketService) {}

  /**
   * 创建通知
   * @param createNotificationDto 通知创建数据
   * @returns 创建的通知
   */
  @Post()
  @ApiOperation({ summary: '创建通知' })
  @ApiResponse({ status: 201, description: '通知创建成功' })
  async createNotification(@Body() createNotificationDto: CreateNotificationDto) {
    return this.websocketService.createNotification(createNotificationDto);
  }

  /**
   * 获取用户通知列表
   * @param req 请求对象
   * @param query 查询参数
   * @returns 通知列表
   */
  @Get()
  @ApiOperation({ summary: '获取用户通知列表' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getUserNotifications(@Request() req: any, @Query() query: NotificationQueryDto) {
    const userId = req.user.userId;
    return this.websocketService.getUserNotifications({ ...query, userId });
  }

  /**
   * 标记通知为已读
   * @param id 通知ID
   * @param req 请求对象
   */
  @Put(':id/read')
  @ApiOperation({ summary: '标记通知为已读' })
  @ApiResponse({ status: 200, description: '标记成功' })
  async markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    const userId = req.user.userId;
    await this.websocketService.markAsRead(id, userId);
    return { message: '通知已标记为已读' };
  }

  /**
   * 标记所有通知为已读
   * @param req 请求对象
   */
  @Put('read-all')
  @ApiOperation({ summary: '标记所有通知为已读' })
  @ApiResponse({ status: 200, description: '标记成功' })
  async markAllAsRead(@Request() req: any) {
    const userId = req.user.userId;
    await this.websocketService.markAllAsRead(userId);
    return { message: '所有通知已标记为已读' };
  }

  /**
   * 删除通知
   * @param id 通知ID
   * @param req 请求对象
   */
  @Delete(':id')
  @ApiOperation({ summary: '删除通知' })
  @ApiResponse({ status: 200, description: '删除成功' })
  async deleteNotification(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req: any,
  ) {
    const userId = req.user.userId;
    await this.websocketService.deleteNotification(id, userId);
    return { message: '通知已删除' };
  }

  /**
   * 获取未读通知数量
   * @param req 请求对象
   * @returns 未读数量
   */
  @Get('unread-count')
  @ApiOperation({ summary: '获取未读通知数量' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getUnreadCount(@Request() req: any) {
    const userId = req.user.userId;
    const count = await this.websocketService.getUnreadCount(userId);
    return { count };
  }

  /**
   * 广播系统通知（管理员权限）
   * @param body 通知内容
   */
  @Post('broadcast')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '广播系统通知' })
  @ApiResponse({ status: 201, description: '广播成功' })
  async broadcastNotification(@Body() body: { title: string; content: string; priority?: 'low' | 'medium' | 'high' }) {
    await this.websocketService.broadcastSystemNotification(
      body.title,
      body.content,
      body.priority || 'medium',
    );
    return { message: '系统通知已广播' };
  }

  /**
   * 获取在线用户统计（管理员权限）
   * @returns 在线用户统计
   */
  @Get('online-stats')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '获取在线用户统计' })
  @ApiResponse({ status: 200, description: '获取成功' })
  async getOnlineStats() {
    const count = this.websocketService.getOnlineUserCount();
    const users = this.websocketService.getOnlineUsers();
    return {
      onlineCount: count,
      onlineUsers: users,
    };
  }
}