/**
 * Jest测试配置
 * 配置测试环境和覆盖率设置
 * @author Booking System
 * @since 2024
 */

module.exports = {
  // 测试环境
  testEnvironment: 'node',
  
  // 模块文件扩展名
  moduleFileExtensions: ['js', 'json', 'ts'],
  
  // 根目录
  rootDir: '.',
  
  // 测试文件匹配模式
  testRegex: '.*\\.spec\\.ts$',
  
  // 转换器
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  
  // 收集覆盖率信息
  collectCoverageFrom: [
    'src/**/*.(t|j)s',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.entity.ts',
  ],
  
  // 覆盖率阈值
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  
  // 测试覆盖率报告目录
  coverageDirectory: './coverage',
  
  // 测试覆盖率报告格式
  coverageReporters: ['text', 'lcov', 'html'],
  
  // 模块名称映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  
  // 全局设置
  setupFilesAfterEnv: ['./test/setup.ts'],
  
  // 测试超时时间
  testTimeout: 30000,
  
  // 并行测试数量
  maxWorkers: '50%',
  
  // 清理模拟
  clearMocks: true,
  
  // 重置模块
  resetModules: true,
  
  // 恢复模拟
  restoreMocks: true,
};