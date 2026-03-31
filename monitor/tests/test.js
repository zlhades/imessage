#!/usr/bin/env node
/**
 * 测试脚本
 */

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const TEST_FILE = path.join(DATA_DIR, 'test-incident.jsonl');

// 确保数据目录存在
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

console.log('='.repeat(60));
console.log('🧪 Incident Monitor 测试');
console.log('='.repeat(60));

// 测试 1: 创建测试文件
console.log('\n1️⃣  创建测试消息文件...');
const testMessages = [
  { ts: '1711953600', user: 'user1', text: 'API 服务返回 500 错误！' },
  { ts: '1711953601', user: 'user2', text: '我也是，从 10 分钟前开始的' },
  { ts: '1711953602', user: 'user1', text: '影响支付功能，错误率 80%' },
];

fs.writeFileSync(TEST_FILE, '', 'utf-8');
testMessages.forEach(msg => {
  fs.appendFileSync(TEST_FILE, JSON.stringify(msg) + '\n');
});
console.log('✅ 已创建测试文件');

// 测试 2: 读取消息
console.log('\n2️⃣  读取测试消息...');
import { readMessages, formatMessages } from '../core/file-reader.js';

const messages = readMessages(TEST_FILE);
console.log(`读取到 ${messages.length} 条消息:`);
console.log(formatMessages(messages));

// 测试 3: 状态管理
console.log('\n3️⃣  测试状态管理...');
import { loadState, createState, saveState, markProcessed, isProcessed } from '../core/state.js';

let state = loadState(TEST_FILE);
if (!state) {
  state = createState(TEST_FILE);
  saveState(TEST_FILE, state);
}
console.log('初始状态:', state);

markProcessed(TEST_FILE, '1711953600');
console.log('标记 1711953600 为已处理');
console.log('是否已处理:', isProcessed(TEST_FILE, '1711953600'));

// 测试 4: 监控器
console.log('\n4️⃣  测试监控器（运行 5 秒）...');
import { createMonitor } from '../core/loop.js';

const monitor = createMonitor({
  channel: TEST_FILE,
  interval: 2000, // 2 秒
  onNewMessages: async (messages) => {
    console.log('\n🔔 新消息:', formatMessages(messages));
  },
  onEnd: async (state) => {
    console.log('\n✅ 监控结束:', state.context?.endReason);
  },
});

// 启动监控
await monitor.start();

// 2 秒后添加新消息
setTimeout(() => {
  console.log('\n📝 添加新消息...');
  const newMsg = { ts: '1711953603', user: 'user3', text: '正在调查...' };
  fs.appendFileSync(TEST_FILE, JSON.stringify(newMsg) + '\n');
}, 3000);

// 5 秒后停止
setTimeout(async () => {
  console.log('\n⏹️  停止监控...');
  await monitor.stop('test_complete');
  
  // 清理
  console.log('\n🧹 清理测试文件...');
  fs.unlinkSync(TEST_FILE);
  const stateFile = path.join(DATA_DIR, path.basename(TEST_FILE).replace('.jsonl', '-state.json'));
  if (fs.existsSync(stateFile)) {
    fs.unlinkSync(stateFile);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ 测试完成！');
  console.log('='.repeat(60));
}, 6000);
