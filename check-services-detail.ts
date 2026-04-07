import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkServicesDetail() {
  console.log('详细检查服务数据...');
  
  try {
    const services = await prisma.service.findMany({
      orderBy: { displayOrder: 'asc' }
    });
    
    console.log(`找到 ${services.length} 个服务：`);
    services.forEach((service, index) => {
      console.log(`${index + 1}. ${service.name} (ID: ${service.id}, duration: ${service.durationMinutes}分钟)`);
    });
    
    // 检查所有服务的durationMinutes是否为30
    const allDuration30 = services.every(service => service.durationMinutes === 30);
    if (allDuration30) {
      console.log('\n✓ 所有服务的durationMinutes字段都已更新为30分钟');
    } else {
      console.log('\n✗ 有服务的durationMinutes字段不是30分钟');
    }
  } catch (error) {
    console.error('检查服务数据失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkServicesDetail();
