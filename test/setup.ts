/**
 * 测试环境设置
 * 使用TestContainers配置PostgreSQL测试数据库
 * @author Booking System
 * @since 2024
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { execSync } from 'child_process';

// 全局变量存储容器实例
let postgresContainer: StartedTestContainer;
let prismaService: PrismaService;

/**
 * 全局测试设置 - 启动PostgreSQL容器
 */
export default async function globalSetup(): Promise<void> {
  console.log('🚀 启动PostgreSQL测试容器...');
  
  // 启动PostgreSQL容器
  postgresContainer = await new GenericContainer('postgres:16-alpine')
    .withEnvironment({
      POSTGRES_DB: 'booking_system_test',
      POSTGRES_USER: 'test_user',
      POSTGRES_PASSWORD: 'test_password',
    })
    .withExposedPorts(5432)
    .start();

  // 设置环境变量
  const host = postgresContainer.getHost();
  const port = postgresContainer.getMappedPort(5432);
  const connectionString = `postgresql://test_user:test_password@${host}:${port}/booking_system_test`;
  process.env.DATABASE_URL = connectionString;
  process.env.NODE_ENV = 'test';

  // 将容器实例存储到全局变量
  (global as any).postgresContainer = postgresContainer;

  console.log(`✅ PostgreSQL容器已启动: ${connectionString}`);

  // 运行数据库迁移
  try {
    console.log('🔄 运行数据库迁移...');
    execSync('npx prisma migrate deploy', { 
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: connectionString }
    });
    console.log('✅ 数据库迁移完成');
  } catch (error) {
    console.error('❌ 数据库迁移失败:', error);
    throw error;
  }
}

/**
 * 全局测试清理 - 停止PostgreSQL容器
 */
export async function globalTeardown(): Promise<void> {
  console.log('🧹 清理测试环境...');
  
  if (prismaService) {
    await prismaService.$disconnect();
  }
  
  if (postgresContainer) {
    await postgresContainer.stop();
    console.log('✅ PostgreSQL容器已停止');
  }
}

/**
 * 创建测试模块
 * @param imports 额外的模块导入
 * @returns 测试模块和Prisma服务实例
 */
export async function createTestModule(imports: any[] = []): Promise<{
  module: TestingModule;
  prismaService: PrismaService;
}> {
  const module: TestingModule = await Test.createTestingModule({
    imports: [
      ...imports,
    ],
    providers: [
      PrismaService,
    ],
  }).compile();

  prismaService = module.get<PrismaService>(PrismaService);
  
  return { module, prismaService };
}

/**
 * 清理测试数据
 * 在每个测试后清理数据库
 */
export async function cleanupTestData(): Promise<void> {
  if (!prismaService) {
    return;
  }

  try {
    // 按照外键依赖顺序删除数据
    await prismaService.appointmentHistory.deleteMany();
    await prismaService.appointment.deleteMany();
    await prismaService.userSession.deleteMany();
    await prismaService.notification.deleteMany();
    await prismaService.activityLog.deleteMany();
    await prismaService.user.deleteMany();
    await prismaService.blockedTimeSlot.deleteMany();
    await prismaService.timeSlot.deleteMany();
    await prismaService.systemSetting.deleteMany();
    await prismaService.appointmentStatistic.deleteMany();
  } catch (error) {
    console.error('清理测试数据失败:', error);
    throw error;
  }
}

/**
 * 获取测试数据库连接字符串
 */
export function getTestDatabaseUrl(): string {
  return process.env.DATABASE_URL || '';
}

/**
 * 初始化测试数据
 * 创建基础的测试数据
 */
export async function seedTestData(): Promise<void> {
  if (!prismaService) {
    throw new Error('PrismaService未初始化');
  }

  try {
    // 创建基础时间段数据
    const timeSlots = [
      { slotTime: '09:00:00', durationMinutes: 30, displayOrder: 1 },
      { slotTime: '09:30:00', durationMinutes: 30, displayOrder: 2 },
      { slotTime: '10:00:00', durationMinutes: 30, displayOrder: 3 },
      { slotTime: '10:30:00', durationMinutes: 30, displayOrder: 4 },
      { slotTime: '11:00:00', durationMinutes: 30, displayOrder: 5 },
      { slotTime: '14:00:00', durationMinutes: 30, displayOrder: 6 },
      { slotTime: '14:30:00', durationMinutes: 30, displayOrder: 7 },
      { slotTime: '15:00:00', durationMinutes: 30, displayOrder: 8 },
    ];

    for (const slot of timeSlots) {
      await prismaService.timeSlot.upsert({
        where: { slotTime: slot.slotTime },
        update: {},
        create: slot,
      });
    }

    // 创建系统设置
    await prismaService.systemSetting.upsert({
      where: { settingKey: 'max_advance_days' },
      update: {},
      create: {
        settingKey: 'max_advance_days',
        settingValue: '30',
        settingType: 'NUMBER',
        description: '最大提前预约天数',
        category: 'BUSINESS'
      },
    });

    // 初始化系统设置
    await prismaService.systemSetting.upsert({
      where: { settingKey: 'appointment_duration' },
      update: {},
      create: {
        settingKey: 'appointment_duration',
        settingValue: '30',
        settingType: 'NUMBER',
        description: '预约时长（分钟）',
        category: 'BUSINESS'
      }
    });

    console.log('✅ 测试数据初始化完成');
  } catch (error) {
    console.error('❌ 测试数据初始化失败:', error);
    throw error;
  }
}