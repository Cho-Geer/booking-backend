import { ApiProperty } from '@nestjs/swagger';
import { NotificationType, NotificationStatus } from '@prisma/client';

/**
 * WebSocket 通知实体
 * 用于 WebSocket 消息传递的通知数据结构
 */
export class NotificationEntity {
  /**
   * 通知ID
   */
  @ApiProperty({ description: '通知ID' })
  id: string;

  /**
   * 用户ID
   */
  @ApiProperty({ description: '用户ID' })
  userId: string;

  /**
   * 预约ID（可选）
   */
  @ApiProperty({ description: '预约ID', required: false })
  appointmentId?: string;

  /**
   * 通知类型
   */
  @ApiProperty({ 
    description: '通知类型', 
    enum: NotificationType 
  })
  type: NotificationType;

  /**
   * 通知标题
   */
  @ApiProperty({ description: '通知标题', maxLength: 200 })
  title: string;

  /**
   * 通知内容
   */
  @ApiProperty({ description: '通知内容' })
  content: string;

  /**
   * 是否已读
   */
  @ApiProperty({ description: '是否已读' })
  isRead: boolean;

  /**
   * 通知状态
   */
  @ApiProperty({ 
    description: '通知状态', 
    enum: NotificationStatus 
  })
  status: NotificationStatus;

  /**
   * 计划发送时间（可选）
   */
  @ApiProperty({ description: '计划发送时间', required: false })
  scheduledFor?: Date;

  /**
   * 实际发送时间（可选）
   */
  @ApiProperty({ description: '实际发送时间', required: false })
  sentAt?: Date;

  /**
   * 阅读时间（可选）
   */
  @ApiProperty({ description: '阅读时间', required: false })
  readAt?: Date;

  /**
   * 附加数据（可选）
   */
  @ApiProperty({ description: '附加数据', required: false })
  metadata?: any;

  /**
   * 创建时间
   */
  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  /**
   * WebSocket 消息类型
   */
  @ApiProperty({ description: 'WebSocket 消息类型', default: 'notification' })
  messageType: 'notification';

  /**
   * 构造函数
   * @param data 通知数据
   */
  constructor(data: Partial<NotificationEntity>) {
    this.id = data.id || '';
    this.userId = data.userId || '';
    this.appointmentId = data.appointmentId;
    this.type = data.type || NotificationType.PUSH;
    this.title = data.title || '';
    this.content = data.content || '';
    this.isRead = data.isRead || false;
    this.status = data.status || NotificationStatus.PENDING;
    this.scheduledFor = data.scheduledFor;
    this.sentAt = data.sentAt;
    this.readAt = data.readAt;
    this.metadata = data.metadata;
    this.createdAt = data.createdAt || new Date();
    this.messageType = 'notification';
  }
}

/**
 * WebSocket 通知列表实体
 * 用于批量发送通知的消息结构
 */
export class NotificationListEntity {
  /**
   * 通知列表
   */
  @ApiProperty({ description: '通知列表', type: [NotificationEntity] })
  notifications: NotificationEntity[];

  /**
   * WebSocket 消息类型
   */
  @ApiProperty({ description: 'WebSocket 消息类型', default: 'notification_list' })
  messageType: 'notification_list';

  /**
   * 构造函数
   * @param notifications 通知列表
   */
  constructor(notifications: NotificationEntity[]) {
    this.notifications = notifications;
    this.messageType = 'notification_list';
  }
}

/**
 * WebSocket 通知状态更新实体
 * 用于通知状态变更的消息结构
 */
export class NotificationStatusUpdateEntity {
  /**
   * 通知ID
   */
  @ApiProperty({ description: '通知ID' })
  notificationId: string;

  /**
   * 新状态
   */
  @ApiProperty({ 
    description: '新状态', 
    enum: NotificationStatus 
  })
  status: NotificationStatus;

  /**
   * WebSocket 消息类型
   */
  @ApiProperty({ description: 'WebSocket 消息类型', default: 'notification_status_update' })
  messageType: 'notification_status_update';

  /**
   * 构造函数
   * @param notificationId 通知ID
   * @param status 新状态
   */
  constructor(notificationId: string, status: NotificationStatus) {
    this.notificationId = notificationId;
    this.status = status;
    this.messageType = 'notification_status_update';
  }
}
