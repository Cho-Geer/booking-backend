import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteServices() {
  console.log('开始删除服务数据...');
  
  try {
    // 删除所有服务数据
    const deletedCount = await prisma.service.deleteMany({});
    console.log(`成功删除 ${deletedCount.count} 个服务`);
  } catch (error) {
    console.error('删除服务数据失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteServices();
