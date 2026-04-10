/**
 * WebSocket网关
 * 处理实时通知和消息推送
 * @author Booking System
 * @since 2024
 */

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { WsJwtGuard } from './guards/ws-jwt.guard';

/**
 * 认证Socket接口
 * 扩展Socket接口，添加用户认证信息
 */
export interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
}

/**
 * 通知消息接口
 */
export interface NotificationMessage {
  id: string;
  type: 'booking' | 'system' | 'reminder' | 'alert';
  title: string;
  content: string;
  timestamp: Date;
  userId?: string;
  data?: any;
  priority?: 'low' | 'medium' | 'high';
}

/**
 * 聊天消息接口
 */
export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'image' | 'file';
  isRead: boolean;
}

/**
 * WebSocket网关类
 * 处理WebSocket连接、消息推送和通知管理
 */
@WebSocketGateway({
  // 动态端口，与 HTTP 服务器使用相同端口
  cors: {
    origin: function (origin: string, callback: (err: Error | null, allow?: boolean) => void) {
      // 明确指定允许的端口
      const allowedPorts = ['3000', '3002', '3003'];
      if (origin && allowedPorts.some(port => origin === `http://localhost:${port}`)) {
        callback(null, true);
        return;
      }
      
      // 检查是否在允许的列表中
      const allowedOrigins = process.env.FRONTEND_URLS?.split(',') || 
                            [process.env.FRONTEND_URL, 'http://localhost:3000'];
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  },
  namespace: '/ws',
  transports: ['websocket', 'polling'],
})
export class WebsocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebsocketGateway.name);
  private connectedUsers = new Map<string, AuthenticatedSocket>();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * 网关初始化
   * @param server WebSocket服务器实例
   */
  afterInit(server: Server) {
    this.logger.log('WebSocket网关初始化完成');
  }

  /**
   * 处理客户端连接
   * @param client 客户端Socket
   */
  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.replace('Bearer ', '');
      
      if (!token) {
        this.logger.warn('连接被拒绝: 缺少认证令牌');
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const authenticatedClient = client as AuthenticatedSocket;
      authenticatedClient.userId = payload.userId;
      authenticatedClient.userRole = payload.role;

      this.connectedUsers.set(payload.userId, authenticatedClient);
      this.logger.log(`用户连接: ${payload.userId} (${client.id})`);

      // 发送连接确认
      client.emit('connected', {
        message: '连接成功',
        userId: payload.userId,
        timestamp: new Date(),
      });

      // 发送未读通知
      await this.sendUnreadNotifications(payload.userId, authenticatedClient);
    } catch (error) {
      this.logger.error('连接认证失败:', error.message);
      client.disconnect();
    }
  }

  /**
   * 处理客户端断开连接
   * @param client 客户端Socket
   */
  handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      this.connectedUsers.delete(client.userId);
      this.logger.log(`用户断开连接: ${client.userId} (${client.id})`);
    }
  }

  /**
   * 处理消息
   * @param data 消息数据
   * @param client 客户端Socket
   */
  @SubscribeMessage('message')
  @UseGuards(WsJwtGuard)
  async handleMessage(
    @MessageBody() data: any,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    this.logger.log(`收到消息: ${JSON.stringify(data)} from ${client.userId}`);
    
    // 处理消息逻辑
    client.emit('message-received', {
      message: '消息已收到',
      timestamp: new Date(),
    });
  }

  /**
   * 处理通知订阅
   * @param data 订阅数据
   * @param client 客户端Socket
   */
  @SubscribeMessage('subscribe-notifications')
  @UseGuards(WsJwtGuard)
  async handleSubscribeNotifications(
    @MessageBody() data: { types?: string[] },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    // 加入通知房间
    client.join(`notifications:${client.userId}`);
    
    // 如果指定了通知类型，加入特定类型的房间
    if (data.types && data.types.length > 0) {
      for (const type of data.types) {
        client.join(`notifications:${client.userId}:${type}`);
      }
    }

    client.emit('subscription-confirmed', {
      message: '通知订阅成功',
      types: data.types || ['all'],
      timestamp: new Date(),
    });
  }

  /**
   * 处理标记通知已读
   * @param data 通知数据
   * @param client 客户端Socket
   */
  @SubscribeMessage('mark-notification-read')
  @UseGuards(WsJwtGuard)
  async handleMarkNotificationRead(
    @MessageBody() data: { notificationId: string },
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    // 这里应该调用服务来标记通知为已读
    // await this.notificationService.markAsRead(data.notificationId, client.userId);
    
    client.emit('notification-marked-read', {
      notificationId: data.notificationId,
      timestamp: new Date(),
    });
  }

  /**
   * 发送通知给指定用户
   * @param userId 用户ID
   * @param notification 通知消息
   */
  async sendNotification(userId: string, notification: NotificationMessage) {
    const socket = this.connectedUsers.get(userId);
    if (socket) {
      socket.emit('notification', notification);
      this.logger.log(`通知已发送给用户: ${userId}`);
    } else {
      this.logger.warn(`用户 ${userId} 不在线，通知将保存到数据库`);
    }
  }

  /**
   * 广播通知给所有在线用户
   * @param notification 通知消息
   */
  async broadcastNotification(notification: NotificationMessage) {
    this.server.emit('notification', notification);
  }

  /**
   * 批量发送通知
   * @param userIds 用户ID列表
   * @param notification 通知消息
   */
  async sendBulkNotifications(userIds: string[], notification: NotificationMessage) {
    for (const userId of userIds) {
      await this.sendNotification(userId, notification);
    }
  }

  /**
   * 发送未读通知给用户
   * @param userId 用户ID
   * @param client 客户端Socket
   */
  private async sendUnreadNotifications(userId: string, client: AuthenticatedSocket) {
    try {
      // 这里应该从数据库获取未读通知
      // const unreadNotifications = await this.notificationService.getUnreadNotifications(userId);
      
      // 模拟发送未读通知
      const mockNotifications: NotificationMessage[] = [
        {
          id: '1',
          type: 'system',
          title: '欢迎使用预约系统',
          content: '您已成功连接到实时通知服务',
          timestamp: new Date(),
          userId,
          priority: 'medium',
        },
      ];

      for (const notification of mockNotifications) {
        client.emit('notification', notification);
      }
    } catch (error) {
      this.logger.error(`发送未读通知失败: ${error.message}`);
    }
  }

  /**
   * 获取在线用户数量
   * @returns 在线用户数量
   */
  getOnlineUserCount(): number {
    return this.connectedUsers.size;
  }

  /**
   * 获取在线用户列表
   * @returns 在线用户ID列表
   */
  getOnlineUsers(): string[] {
    return Array.from(this.connectedUsers.keys());
  }

  /**
   * 检查用户是否在线
   * @param userId 用户ID
   * @returns 是否在线
   */
  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }
}