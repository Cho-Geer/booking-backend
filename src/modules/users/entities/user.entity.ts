/**
 * 用户实体类
 * 基于Prisma的用户数据模型
 */

import { ApiProperty } from '@nestjs/swagger';

/**
 * 用户实体类
 * 对应数据库中的users表
 */
export class User {
  @ApiProperty({ description: '用户ID' })
  id: string;

  @ApiProperty({ description: '用户姓名' })
  name: string;

  @ApiProperty({ description: '手机号码（加密存储）' })
  phone: string;

  @ApiProperty({ description: '手机号哈希（用于查询）' })
  phoneHash: string;

  @ApiProperty({ description: '邮箱（选填）', required: false })
  email?: string;

  @ApiProperty({ description: '微信号（选填）', required: false })
  wechat?: string;

  @ApiProperty({ description: '验证码', required: false })
  verificationCode?: string;

  @ApiProperty({ description: '验证码过期时间', required: false })
  codeExpiresAt?: Date;

  @ApiProperty({ description: '是否已验证', default: false })
  isVerified: boolean;

  @ApiProperty({ description: '用户类型', default: 'customer' })
  userType: string;

  @ApiProperty({ description: '状态', default: 'active' })
  status: string;

  @ApiProperty({ description: '最后登录时间', required: false })
  lastLoginAt?: Date;

  @ApiProperty({ description: '登录次数', default: 0 })
  loginCount: number;

  @ApiProperty({ description: '注册IP地址', required: false })
  ipAddress?: string;

  @ApiProperty({ description: '用户代理', required: false })
  userAgent?: string;

  @ApiProperty({ description: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  updatedAt: Date;
}