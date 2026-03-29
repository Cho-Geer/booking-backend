/**
 * WebSocket服务
 * 处理通知创建和管理
 * @author Booking System
 * @since 2024
 */

import { Injectable, Logger } from '@nestjs/common';
import { WebsocketGateway, NotificationMessage } from './websocket.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationQueryDto, NotificationListResponseDto, NotificationCreateDto, NotificationDto, NotificationResponseDto } from './dto/notification.dto';
import { DatabaseException } from '../../common/exceptions/business.exceptions';

/**
 * WebSocket服务类
 * 负责通知的创建、发送和管理
 */
@Injectable()
export class WebsocketService {
  private readonly logger = new Logger(WebsocketService.name);

  constructor(
    private websocketGateway: WebsocketGateway,
    private prisma: PrismaService,
  ) {}

  /**
   * 创建通知
   * @param dto 通知创建数据
   * @returns 创建的通知
   */
  async createNotification(dto: NotificationCreateDto): Promise<any> {
    try {
      // 创建数据库记录
      const notification = await this.prisma.notification.create({
        data: {
          userId: dto.userId,
          type: dto.type,
          title: dto.title,
          content: dto.content,
          metadata: dto.data ? JSON.stringify(dto.data) : null,
          scheduledFor: dto.scheduledAt,
        },
      });

      // 发送WebSocket通知
      const message: NotificationMessage = {
        id: notification.id,
        type: 'system', // 使用gateway接口定义的类型
        title: dto.title,
        content: dto.content,
        timestamp: notification.createdAt,
        userId: dto.userId,
        data: dto.data,
        priority: dto.priority || 'medium',
      };

      await this.websocketGateway.sendNotification(dto.userId, message);

      return notification;
    } catch (error) {
      this.logger.error(`创建通知失败: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * 创建预约通知
   * @param userId 用户ID
   * @param bookingId 预约ID
   * @param action 操作类型
   * @param bookingData 预约数据
   */
  async createBookingNotification(
    userId: string,
    bookingId: string,
    action: 'created' | 'updated' | 'cancelled' | 'reminder',
    bookingData?: any,
  ): Promise<void> {
    const actionMessages = {
      created: '预约已创建',
      updated: '预约已更新',
      cancelled: '预约已取消',
      reminder: '预约提醒',
    };

    const title = actionMessages[action];
    const content = `您的预约 ${bookingId} ${title}`;

    await this.createNotification({
      userId,
      type: 'PUSH',
      title,
      content,
      data: {
        bookingId,
        action,
        ...bookingData,
      },
    });
  }

  /**
   * 创建系统通知
   * @param userId 用户ID
   * @param title 标题
   * @param content 内容
   * @param priority 优先级
   * @param data 附加数据
   */
  async createSystemNotification(
    userId: string,
    title: string,
    content: string,
    priority: 'low' | 'medium' | 'high' = 'medium',
    data?: any,
  ): Promise<void> {
    await this.createNotification({
      userId,
      type: 'PUSH',
      title,
      content,
      priority,
      data,
    });
  }

  /**
   * 创建提醒通知
   * @param userId 用户ID
   * @param title 标题
   * @param content 内容
   * @param scheduledAt 计划时间
   * @param data 附加数据
   */
  async createReminderNotification(
    userId: string,
    title: string,
    content: string,
    scheduledAt: Date,
    data?: any,
  ): Promise<void> {
    await this.createNotification({
      userId,
      type: 'PUSH',
      title,
      content,
      scheduledAt,
      data,
    });
  }

  /**
   * 获取用户通知列表
   * @param query 查询条件
   * @returns 通知列表
   */
  async getUserNotifications(query: NotificationQueryDto): Promise<NotificationListResponseDto> {
    try{
      const { page = 1, limit = 10 } = query;
      // 确保page和limit是数字类型
      const pageNum = typeof page === 'string' ? parseInt(page, 10) : page;
      const limitNum = typeof limit === 'string' ? parseInt(limit, 10) : limit;
      const skip = (pageNum - 1) * limitNum;
      const where: any = {};
      
      if (query.userId) {
        where.userId = query.userId;
      }
      
      if (query.type && query.type.length > 0) {
        where.type = { in: query.type };
      }
      
      if (query.isRead !== undefined) {
        where.isRead = query.isRead;
      }
      this.logger.log(`查询预约列表: page=${pageNum}, limit=${limitNum}`);
      // 查询总数
      const total = await this.prisma.notification.count({ where });
      this.logger.log(`查询到的总数: ${total}`);

      // 查询数据
      const notifications = await this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limitNum,
        skip,
      });

      this.logger.log(`查询到的通知数量: ${notifications.length}`);

      const items = notifications.map((notification: NotificationDto) => {
          try {
            return this.mapToResponseDto(notification);
          } catch (error) {
            this.logger.error(`映射通知数据失败: ${error.message}`, error);
            throw error;
          }
        });
      this.logger.log(`映射后的通知数量: ${items.length}`);

      // 直接返回对象而不是使用构造函数
      const result = {
        items,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      };
      
      this.logger.log(`最终返回结果: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error('查询通知列表失败', error);
      throw new DatabaseException('查询通知列表失败');
    }
  }

  /**
   * 获取未读通知数量
   * @param userId 用户ID
   * @returns 未读数量
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, isRead: false },
    });
  }

  /**
   * 标记通知为已读
   * @param notificationId 通知ID
   * @param userId 用户ID
   */
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.prisma.notification.update({
      where: { id: notificationId, userId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * 标记所有通知为已读
   * @param userId 用户ID
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  /**
   * 删除通知
   * @param notificationId 通知ID
   * @param userId 用户ID
   */
  async deleteNotification(notificationId: string, userId: string): Promise<void> {
    await this.prisma.notification.delete({
      where: { id: notificationId, userId },
    });
  }

  /**
   * 清理过期通知
   * @returns 清理数量
   */
  async cleanupExpiredNotifications(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await this.prisma.notification.deleteMany({
      where: {
        createdAt: { lt: thirtyDaysAgo },
        isRead: true,
      },
    });

    return result.count;
  }

  /**
   * 广播系统通知
   * @param title 标题
   * @param content 内容
   * @param priority 优先级
   */
  async broadcastSystemNotification(
    title: string,
    content: string,
    priority: 'low' | 'medium' | 'high' = 'medium',
  ): Promise<void> {
    // 获取所有在线用户
    const onlineUsers = this.websocketGateway.getOnlineUsers();
    
    if (onlineUsers.length > 0) {
      await this.sendBulkNotifications(onlineUsers, 'PUSH', title, content, priority);
    }
  }

  /**
   * 批量发送通知
   * @param userIds 用户ID列表
   * @param type 通知类型
   * @param title 标题
   * @param content 内容
   * @param priority 优先级
   * @param data 附加数据
   */
  async sendBulkNotifications(
    userIds: string[],
    type: 'SMS' | 'EMAIL' | 'WECHAT' | 'PUSH',
    title: string,
    content: string,
    priority: 'low' | 'medium' | 'high' = 'medium',
    data?: any,
  ): Promise<void> {
    if (userIds.length === 0) return;

    // 创建通知消息
    const message: NotificationMessage = {
      id: Date.now().toString(),
      type: 'system', // 使用gateway接口定义的类型
      title,
      content,
      timestamp: new Date(),
      priority,
      data,
    };

    // 批量创建通知
    const notifications = await this.prisma.notification.createMany({
      data: userIds.map(userId => ({
        userId,
        type,
        title,
        content,
        metadata: data ? JSON.stringify(data) : null,
        isRead: false,
      })),
    });

    // 发送WebSocket通知
    await this.websocketGateway.sendBulkNotifications(userIds, message);

    this.logger.log(`批量发送通知完成: ${userIds.length} 个用户`);
  }

  /**
   * 获取在线用户数量
   * @returns 在线用户数量
   */
  getOnlineUserCount(): number {
    return this.websocketGateway.getOnlineUserCount();
  }

  /**
   * 获取在线用户列表
   * @returns 在线用户列表
   */
  getOnlineUsers(): string[] {
    return this.websocketGateway.getOnlineUsers();
  }

  /**
   * 检查用户是否在线
   * @param userId 用户ID
   * @returns 是否在线
   */
  isUserOnline(userId: string): boolean {
    return this.websocketGateway.isUserOnline(userId);
  }

  private mapToResponseDto(notification: NotificationDto): NotificationResponseDto {
    return {
      id: notification.id,
      userId: notification.userId,
      appointmentId: notification.appointmentId,
      type: notification.type,
      title: notification.title,
      content: notification.content,
      isRead: notification.isRead,
      status: notification.status,
      scheduledFor: notification.scheduledFor,
      sentAt: notification.sentAt,
      readAt: notification.readAt,
      metadata: notification.metadata,
      createdAt: notification.createdAt,
    };
  }
}