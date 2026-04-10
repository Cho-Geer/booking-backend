import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function insertServices() {
  console.log('开始插入服务数据...');
  
  try {
    // 定义服务数据
    const services = [
      { name: '咨询服务', description: '提供专业咨询服务', durationMinutes: 30, imageUrl: 'https://example.com/services/consultation.jpg', isActive: true, displayOrder: 1 },
      { name: '培训服务', description: '提供专业培训服务', durationMinutes: 30, imageUrl: 'https://example.com/services/training.jpg', isActive: true, displayOrder: 2 },
      { name: '技术支持', description: '提供技术支持服务', durationMinutes: 30, imageUrl: 'https://example.com/services/support.jpg', isActive: true, displayOrder: 3 },
      { name: '其他服务', description: '其他类型服务', durationMinutes: 30, imageUrl: 'https://example.com/services/other.jpg', isActive: true, displayOrder: 4 },
      { name: 'VIP服务', description: '高级VIP服务', durationMinutes: 30, imageUrl: 'https://example.com/services/vip.jpg', isActive: true, displayOrder: 5 }
    ];
    
    // 逐个创建服务，以便查看具体错误
    for (const service of services) {
      console.log(`正在创建服务: ${service.name}`);
      try {
        const createdService = await prisma.service.create({
          data: service
        });
        console.log(`成功创建服务: ${createdService.name} (ID: ${createdService.id})`);
      } catch (error) {
        console.error(`创建服务 ${service.name} 失败:`, error);
      }
    }
    
    // 验证服务数据
    const allServices = await prisma.service.findMany({
      orderBy: { displayOrder: 'asc' }
    });
    console.log(`\n验证结果: 找到 ${allServices.length} 个服务`);
  } catch (error) {
    console.error('插入服务数据失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

insertServices();
