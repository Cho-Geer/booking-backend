import { StartedTestContainer } from 'testcontainers';

/**
 * 全局测试清理 - 停止PostgreSQL容器
 */
export default async function globalTeardown(): Promise<void> {
  console.log('🧹 清理测试环境...');
  
  // 获取全局容器实例
  const postgresContainer = (global as any).postgresContainer as StartedTestContainer;
  
  if (postgresContainer) {
    try {
      await postgresContainer.stop();
      console.log('✅ PostgreSQL容器已停止');
    } catch (error) {
      console.error('❌ 停止PostgreSQL容器失败:', error);
    }
  }
  
  console.log('✅ 测试环境清理完成');
}