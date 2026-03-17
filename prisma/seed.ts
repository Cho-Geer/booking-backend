/**
 * Prisma 种子脚本 - 创建初始管理员用户
 * 
 * 使用方法：
 * 
 * 方式 1（推荐）：使用 npm 脚本
 * ```bash
 * npm run prisma:seed
 * ```
 * 
 * 方式 2：使用 ts-node 直接执行
 * ```bash
 * npx ts-node prisma/seed.ts
 * ```
 * 
 * 方式 3：使用 Prisma CLI
 * ```bash
 * npx prisma db seed
 * ```
 * 
 * @author Booking System
 * @since 2026-03-14
 */

import { PrismaClient, UserType, UserStatus } from '@prisma/client';
import * as crypto from 'crypto';

const prisma = new PrismaClient({
  log: ['info', 'warn', 'error'],
});

/**
 * 对手机号进行 SHA-256 哈希处理
 * 
 * 哈希后的手机号用于：
 * 1. 快速查询用户（使用哈希索引）
 * 2. 用户验证（比对手机号）
 * 3. 保护用户隐私（原始手机号不直接存储）
 * 
 * @param phoneNumber - 11 位中国大陆手机号
 * @returns 64 位十六进制哈希字符串
 * 
 * @example
 * hashPhoneNumber('13800138001')
 * // 返回：'abc123...' (64 位十六进制)
 */
function hashPhoneNumber(phoneNumber: string): string {
  return crypto
    .createHash('sha256')
    .update(phoneNumber)
    .digest('hex');
}

/**
 * 对手机号进行脱敏处理
 * 
 * 脱敏规则：保留前 3 位和后 4 位，中间 4 位用 **** 替换
 * 例如：13800138001 → 138****8001
 * 
 * 脱敏后的手机号用于：
 * 1. 前端显示（保护用户隐私）
 * 2. 日志记录（避免泄露完整手机号）
 * 
 * @param phoneNumber - 11 位中国大陆手机号
 * @returns 脱敏后的手机号字符串
 * 
 * @example
 * maskPhoneNumber('13800138001')
 * // 返回：'138****8001'
 */
function maskPhoneNumber(phoneNumber: string): string {
  if (phoneNumber.length !== 11) {
    console.warn(`警告：手机号长度不正确：${phoneNumber}`);
    return phoneNumber;
  }
  return phoneNumber.substring(0, 3) + '****' + phoneNumber.substring(7);
}

/**
 * 验证手机号格式是否正确
 * 
 * 中国大陆手机号规则：
 * 1. 11 位数字
 * 2. 以 1 开头
 * 3. 第二位为 3-9
 * 
 * @param phoneNumber - 待验证的手机号
 * @returns 是否为有效的手机号
 */
function isValidPhoneNumber(phoneNumber: string): boolean {
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phoneNumber);
}

/**
 * 主函数：执行种子数据初始化
 */
async function main() {
  console.log('🌱 开始初始化数据库种子数据...\n');

  // ============================================
  // 第一部分：创建管理员用户
  // ============================================
  console.log('📋 第一部分：创建管理员用户');
  console.log('='.repeat(50));

  // 定义管理员用户列表
  const adminUsers = [
    {
      name: '系统管理员',
      phone: '13800138001',
      email: 'admin@example.com',
    },
    {
      name: '运营管理员',
      phone: '13800138002',
      email: 'operator@example.com',
    },
    {
      name: '客服管理员',
      phone: '13800138003',
      email: 'support@example.com',
    },
  ];

  // 逐个创建管理员用户
  for (const adminUser of adminUsers) {
    try {
      // 验证手机号格式
      if (!isValidPhoneNumber(adminUser.phone)) {
        console.error(`❌ 手机号格式不正确：${adminUser.phone}，跳过创建`);
        continue;
      }

      // 处理手机号
      const maskedPhone = maskPhoneNumber(adminUser.phone);
      const phoneHash = hashPhoneNumber(adminUser.phone);

      // 使用 upsert 方法（存在则更新，不存在则创建）
      const createdUser = await prisma.user.upsert({
        where: {
          phone: maskedPhone,
        },
        update: {
          name: adminUser.name,
          email: adminUser.email,
          userType: UserType.ADMIN,
          status: UserStatus.ACTIVE,
        },
        create: {
          name: adminUser.name,
          phone: maskedPhone,
          phoneHash: phoneHash,
          email: adminUser.email,
          userType: UserType.ADMIN,
          status: UserStatus.ACTIVE,
        },
      });

      console.log(`✅ 管理员创建成功：`);
      console.log(`   - ID: ${createdUser.id}`);
      console.log(`   - 姓名：${createdUser.name}`);
      console.log(`   - 手机：${createdUser.phone}`);
      console.log(`   - 邮箱：${createdUser.email}`);
      console.log(`   - 类型：${createdUser.userType}`);
      console.log(`   - 状态：${createdUser.status}\n`);
    } catch (error) {
      console.error(`❌ 创建管理员失败 (${adminUser.name}):`, error);
    }
  }

  // ============================================
  // 第二部分：创建默认时间段（如果不存在）
  // ============================================
  console.log('\n📋 第二部分：创建默认时间段');
  console.log('='.repeat(50));

  const existingSlots = await prisma.timeSlot.count();
  
  if (existingSlots === 0) {
    console.log('正在创建默认时间段（09:00-17:00）...');
    
    // 定义默认时间段：09:00-17:00，每 30 分钟一个时间段
    const defaultSlots = [
      { slotTime: '09:00:00', durationMinutes: 30, isActive: true, displayOrder: 1 },
      { slotTime: '09:30:00', durationMinutes: 30, isActive: true, displayOrder: 2 },
      { slotTime: '10:00:00', durationMinutes: 30, isActive: true, displayOrder: 3 },
      { slotTime: '10:30:00', durationMinutes: 30, isActive: true, displayOrder: 4 },
      { slotTime: '11:00:00', durationMinutes: 30, isActive: true, displayOrder: 5 },
      { slotTime: '11:30:00', durationMinutes: 30, isActive: true, displayOrder: 6 },
      { slotTime: '12:00:00', durationMinutes: 30, isActive: true, displayOrder: 7 },
      { slotTime: '12:30:00', durationMinutes: 30, isActive: true, displayOrder: 8 },
      { slotTime: '13:00:00', durationMinutes: 30, isActive: true, displayOrder: 9 },
      { slotTime: '13:30:00', durationMinutes: 30, isActive: true, displayOrder: 10 },
      { slotTime: '14:00:00', durationMinutes: 30, isActive: true, displayOrder: 11 },
      { slotTime: '14:30:00', durationMinutes: 30, isActive: true, displayOrder: 12 },
      { slotTime: '15:00:00', durationMinutes: 30, isActive: true, displayOrder: 13 },
      { slotTime: '15:30:00', durationMinutes: 30, isActive: true, displayOrder: 14 },
      { slotTime: '16:00:00', durationMinutes: 30, isActive: true, displayOrder: 15 },
      { slotTime: '16:30:00', durationMinutes: 30, isActive: true, displayOrder: 16 },
    ];

    // 批量创建默认时间段
    await prisma.timeSlot.createMany({
      data: defaultSlots
    });

    console.log(`✅ 已创建 ${defaultSlots.length} 个默认时间段（09:00-17:00）`);
  } else {
    console.log(`ℹ️  数据库中已有 ${existingSlots} 个时间段，跳过初始化`);
  }

  // ============================================
  // 第三部分：创建默认服务（如果不存在）
  // ============================================
  console.log('\n📋 第三部分：创建默认服务');
  console.log('='.repeat(50));

  const existingServices = await prisma.service.count();
  
  if (existingServices === 0) {
    console.log('正在创建默认服务...');
    
    // 定义默认服务
    const defaultServices = [
      { 
        name: '咨询服务', 
        description: '提供专业咨询服务', 
        durationMinutes: 30, 
        imageUrl: 'https://example.com/services/consultation.jpg', 
        isActive: true, 
        displayOrder: 1 
      },
      { 
        name: '培训服务', 
        description: '提供专业培训服务', 
        durationMinutes: 30, 
        imageUrl: 'https://example.com/services/training.jpg', 
        isActive: true, 
        displayOrder: 2 
      },
      { 
        name: '技术支持', 
        description: '提供技术支持服务', 
        durationMinutes: 30, 
        imageUrl: 'https://example.com/services/support.jpg', 
        isActive: true, 
        displayOrder: 3 
      },
      { 
        name: '其他服务', 
        description: '其他类型服务', 
        durationMinutes: 30, 
        imageUrl: 'https://example.com/services/other.jpg', 
        isActive: true, 
        displayOrder: 4 
      },
      { 
        name: 'VIP 服务', 
        description: '高级 VIP 服务', 
        durationMinutes: 30, 
        imageUrl: 'https://example.com/services/vip.jpg', 
        isActive: true, 
        displayOrder: 5 
      }
    ];

    // 批量创建默认服务
    await prisma.service.createMany({
      data: defaultServices
    });

    console.log(`✅ 已创建 ${defaultServices.length} 个默认服务`);
  } else {
    console.log(`ℹ️  数据库中已有 ${existingServices} 个服务，跳过初始化`);
  }

  // ============================================
  // 完成统计
  // ============================================
  console.log('\n' + '='.repeat(50));
  console.log('📊 种子数据初始化完成统计');
  console.log('='.repeat(50));

  // 统计管理员数量
  const adminCount = await prisma.user.count({
    where: { userType: UserType.ADMIN },
  });

  console.log(`👤 管理员总数：${adminCount}`);
  console.log(` 时间段总数：${existingSlots}`);
  console.log(`🛎️  服务总数：${existingServices}`);

  console.log('\n🎉 数据库种子数据初始化完成！');
  console.log('✨ 提示：管理员登录使用手机号 + 验证码方式');
  console.log('📱 管理员手机号：13800138001, 13800138002, 13800138003');
}

/**
 * 执行主函数并处理错误
 */
main()
  .catch((e) => {
    console.error('\n❌ 种子数据初始化失败:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    // 确保数据库连接正确关闭
    await prisma.$disconnect();
    console.log('\n👋 数据库连接已关闭');
  });
