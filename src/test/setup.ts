/**
 * 测试环境设置
 * 配置测试环境的全局设置
 * @author Booking System
 * @since 2024
 */

import { config } from 'dotenv';

// 加载测试环境变量
config({ path: require('fs').existsSync('.env.test') ? '.env.test' : '.env.test.example' });

// 设置测试环境变量
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/booking_test';

// 全局测试超时
jest.setTimeout(30000);

// 全局模拟
jest.mock('../modules/prisma/prisma.service', () => {
  return {
    PrismaService: jest.fn().mockImplementation(() => ({
      $connect: jest.fn(),
      $disconnect: jest.fn(),
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      booking: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      timeSlot: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    })),
  };
});

// 清理所有模拟
beforeEach(() => {
  jest.clearAllMocks();
});

// 测试完成后清理
afterAll(async () => {
  jest.restoreAllMocks();
});