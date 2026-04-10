import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkServices() {
  console.log('检查服务数据...');
  
  try {
    const services = await prisma.service.findMany({
      orderBy: { displayOrder: 'asc' }
    });
    
    console.log(`找到 ${services.length} 个服务：`);
    services.forEach((service, index) => {
      console.log(`${index + 1}. ${service.name} (ID: ${service.id})`);
    });
  } catch (error) {
    console.error('检查服务数据失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkServices();
