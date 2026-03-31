#!/usr/bin/env node
/**
 * 简单测试模式 - 仅测试 File MCP Server
 * 不需要 AI API Key
 */

import fs from 'fs';
import path from 'path';

const MESSAGES_FILE = path.join(process.cwd(), 'data', 'messages.jsonl');
const OUTPUT_FILE = path.join(process.cwd(), 'data', 'output.jsonl');

console.log('='.repeat(60));
console.log('📄 File 模式简单测试');
console.log('='.repeat(60));

// 1. 读取消息
console.log('\n1️⃣  读取消息文件...');
if (!fs.existsSync(MESSAGES_FILE)) {
  console.log('❌ 消息文件不存在，创建示例消息...');
  
  const sampleMessages = [
    { ts: String(Date.now() / 1000), user: 'user1', text: '大家好，API 服务突然返回 500 错误！' },
    { ts: String(Date.now() / 1000 + 1), user: 'user2', text: '我也是，从 10 分钟前开始的。' },
    { ts: String(Date.now() / 1000 + 2), user: 'user1', text: '有人知道怎么回事吗？' },
  ];
  
  fs.mkdirSync(path.dirname(MESSAGES_FILE), { recursive: true });
  fs.writeFileSync(MESSAGES_FILE, '', 'utf-8');
  sampleMessages.forEach(m => {
    fs.appendFileSync(MESSAGES_FILE, JSON.stringify(m) + '\n');
  });
  
  console.log('✅ 已创建示例消息');
}

// 2. 显示消息
console.log('\n2️⃣  当前消息内容：');
console.log('-'.repeat(60));
const content = fs.readFileSync(MESSAGES_FILE, 'utf-8');
const lines = content.trim().split('\n').filter(l => l.trim());
lines.forEach((line, i) => {
  const msg = JSON.parse(line);
  console.log(`[${i + 1}] ${msg.user} (${new Date(parseFloat(msg.ts) * 1000).toLocaleTimeString()}): ${msg.text}`);
});
console.log('-'.repeat(60));

// 3. 模拟机器人回复
console.log('\n3️⃣  模拟机器人回复...');
const botResponse = {
  ts: String(Date.now() / 1000),
  user: 'bot',
  text: '收到。正在分析 API 500 错误问题...\n\n根据讨论，问题从 10 分钟前开始，影响多个用户。\n\n建议检查：\n1. API 服务日志\n2. 最近的部署变更\n3. 数据库连接状态',
};

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.appendFileSync(OUTPUT_FILE, JSON.stringify(botResponse) + '\n');
console.log('✅ 机器人回复已写入 output.jsonl');

// 4. 显示输出
console.log('\n4️⃣  查看输出文件：');
console.log('-'.repeat(60));
const outputContent = fs.readFileSync(OUTPUT_FILE, 'utf-8');
const outputLines = outputContent.trim().split('\n').filter(l => l.trim());
outputLines.forEach((line, i) => {
  const msg = JSON.parse(line);
  console.log(`[${i + 1}] ${msg.user} (${new Date(parseFloat(msg.ts) * 1000).toLocaleTimeString()}):`);
  console.log(`    ${msg.text.split('\n').join('\n    ')}`);
});
console.log('-'.repeat(60));

console.log('\n✅ 测试完成！');
console.log('\n💡 提示：');
console.log('   - 查看消息文件：cat data/messages.jsonl');
console.log('   - 查看输出文件：cat data/output.jsonl');
console.log('   - 清空消息：rm data/*.jsonl');
console.log('   - 运行完整机器人：npm run dev (需要 AI API Key)');
console.log('='.repeat(60));
