import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function main() {
  console.log('开始初始化数据库种子数据...');

  // 检查是否已有时间段数据
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

    console.log('已创建 16 个默认时间段（09:00-17:00）');
  } else {
    console.log(`数据库中已有 ${existingSlots} 个时间段，跳过初始化`);
  }

  console.log('正在创建默认服务...');
  
  // 定义默认服务
  const defaultServices = [
    { name: '咨询服务', description: '提供专业咨询服务', durationMinutes: 30, imageUrl: 'https://example.com/services/consultation.jpg', isActive: true, displayOrder: 1 },
    { name: '培训服务', description: '提供专业培训服务', durationMinutes: 30, imageUrl: 'https://example.com/services/training.jpg', isActive: true, displayOrder: 2 },
    { name: '技术支持', description: '提供技术支持服务', durationMinutes: 30, imageUrl: 'https://example.com/services/support.jpg', isActive: true, displayOrder: 3 },
    { name: '其他服务', description: '其他类型服务', durationMinutes: 30, imageUrl: 'https://example.com/services/other.jpg', isActive: true, displayOrder: 4 },
    { name: 'VIP服务', description: '高级VIP服务', durationMinutes: 30, imageUrl: 'https://example.com/services/vip.jpg', isActive: true, displayOrder: 5 }
  ];

  // 批量创建默认服务
  await prisma.service.createMany({
    data: defaultServices
  });

  console.log('已创建 5 个默认服务');

  console.log('数据库种子数据初始化完成！');
}

main()
  .catch((e) => {
    console.error('种子数据初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
