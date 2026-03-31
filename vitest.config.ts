/**
 * Vitest 测试配置
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 全局超时
    testTimeout: 30000,
    
    // 测试文件匹配模式
    include: [
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.test.ts',
      'tests/e2e/**/*.test.ts',
    ],
    
    // 排除模式
    exclude: [
      'node_modules',
      'dist',
      'mcp-servers',
    ],
    
    // 覆盖率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/**/*.ts',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/**/index.ts',  // 导出文件
      ],
      thresholds: {
        global: {
          statements: 70,
          branches: 60,
          functions: 70,
          lines: 70,
        },
      },
    },
    
    // 模拟配置
    mockReset: true,
    clearMocks: true,
    
    // 环境配置
    environment: 'node',
    
    // 全局测试钩子
    setupFiles: ['./tests/setup.ts'],
  },
});
