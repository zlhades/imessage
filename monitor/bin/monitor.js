#!/usr/bin/env node
/**
 * Incident Monitor - 命令行入口
 * 
 * 使用方式:
 *   node bin/monitor.js <channel/file> [options]
 * 
 * 示例:
 *   node bin/monitor.js data/incidents.jsonl
 *   node bin/monitor.js #incidents --interval 60
 */

import { createMonitor } from '../core/loop.js';
import { loadState, getActiveMonitors, stopMonitoring } from '../core/state.js';
import { readMessages, formatMessages } from '../core/file-reader.js';
import path from 'path';

// 解析命令行参数
const args = process.argv.slice(2);
const channel = args[0];
const options = {
  interval: 30000,
  action: 'monitor',
};

// 解析选项
for (let i = 1; i < args.length; i++) {
  if (args[i] === '--interval' && args[i + 1]) {
    options.interval = parseInt(args[i + 1]) * 1000;
    i++;
  } else if (args[i] === '--status') {
    options.action = 'status';
  } else if (args[i] === '--stop') {
    options.action = 'stop';
  } else if (args[i] === '--list') {
    options.action = 'list';
  } else if (args[i] === '--analyze') {
    options.action = 'analyze';
  }
}

// 主函数
async function main() {
  console.log('='.repeat(60));
  console.log('🚨 Incident Monitor v1.0');
  console.log('='.repeat(60));

  switch (options.action) {
    case 'list':
      listActiveMonitors();
      break;
    case 'status':
      showStatus(channel);
      break;
    case 'stop':
      stopMonitor(channel);
      break;
    case 'analyze':
      analyzeOnce(channel);
      break;
    case 'monitor':
    default:
      startMonitoring(channel, options);
      break;
  }
}

/**
 * 列出活跃的监控
 */
function listActiveMonitors() {
  const active = getActiveMonitors();
  if (active.length === 0) {
    console.log('\n没有活跃的监控');
    return;
  }
  
  console.log('\n活跃的监控:');
  for (const state of active) {
    console.log(`  - ${state.channel}`);
    console.log(`    开始时间：${new Date(state.startTime).toLocaleString()}`);
    console.log(`    消息数：${state.context?.messageCount || 0}`);
    console.log(`    最后活动：${state.context?.lastActivity || '无'}`);
  }
}

/**
 * 显示状态
 */
function showStatus(channel) {
  if (!channel) {
    console.error('请指定频道/文件');
    return;
  }
  
  const state = loadState(channel);
  if (!state) {
    console.log(`没有 ${channel} 的监控记录`);
    return;
  }
  
  console.log(`\n📊 ${channel} 状态:`);
  console.log(`  活跃：${state.isActive ? '是' : '否'}`);
  console.log(`  开始时间：${new Date(state.startTime).toLocaleString()}`);
  console.log(`  消息数：${state.context?.messageCount || 0}`);
  console.log(`  最后活动：${state.context?.lastActivity || '无'}`);
  console.log(`  最后读取：${state.lastReadTs}`);
}

/**
 * 停止监控
 */
function stopMonitor(channel) {
  if (!channel) {
    console.error('请指定频道/文件');
    return;
  }
  
  stopMonitoring(channel);
  console.log(`✅ 已停止监控：${channel}`);
}

/**
 * 单次分析
 */
async function analyzeOnce(channel) {
  if (!channel) {
    console.error('请指定频道/文件');
    return;
  }
  
  const messages = readMessages(channel);
  if (messages.length === 0) {
    console.log('没有消息');
    return;
  }
  
  console.log(`\n📄 最近消息 (${messages.length} 条):`);
  console.log('-'.repeat(60));
  console.log(formatMessages(messages.slice(-10))); // 显示最近 10 条
  console.log('-'.repeat(60));
  
  console.log('\n💡 请将以上消息发送给 AI 进行分析');
  console.log('示例 Prompt:');
  console.log('  "请分析以上事件讨论，给出：');
  console.log('   1. 问题类型和严重性');
  console.log('   2. 缺失的关键信息');
  console.log('   3. 排查步骤建议"');
}

/**
 * 启动监控
 */
async function startMonitoring(channel, options) {
  if (!channel) {
    console.error('请指定频道/文件');
    console.log('用法：node bin/monitor.js <channel/file> [options]');
    console.log('示例：node bin/monitor.js data/incidents.jsonl');
    return;
  }
  
  // 解析文件路径
  const filePath = path.isAbsolute(channel) ? channel : path.join(process.cwd(), channel);
  
  console.log(`\n📁 监控目标：${filePath}`);
  console.log(`⏱️  轮询间隔：${options.interval / 1000}秒`);
  console.log(`\n按 Ctrl+C 停止监控\n`);
  
  // 创建监控器
  const monitor = createMonitor({
    channel: filePath,
    interval: options.interval,
    onNewMessages: async (messages, state) => {
      // 新消息回调
      console.log('\n' + '='.repeat(60));
      console.log('🔔 新消息提醒');
      console.log('='.repeat(60));
      console.log(formatMessages(messages));
      console.log('-'.repeat(60));
      
      // 输出 AI 分析提示
      console.log('\n📋 AI 分析 Prompt:');
      console.log('请分析以上事件讨论：');
      console.log('1. 识别问题类型和严重性 (P0/P1/P2/P3)');
      console.log('2. 列出缺失的关键信息');
      console.log('3. 给出排查步骤建议');
      console.log('4. 如需追问，生成最多 3 个问题');
      console.log('='.repeat(60));
      console.log('\n💡 将以上内容发送给 AI 进行分析\n');
    },
    onEnd: async (state) => {
      console.log('\n' + '='.repeat(60));
      console.log('✅ 事件结束');
      console.log('='.repeat(60));
      console.log(`结束原因：${state.context?.endReason}`);
      console.log(`总消息数：${state.context?.messageCount}`);
      console.log(`监控时长：${new Date(state.endTime) - new Date(state.startTime)}ms`);
      console.log('='.repeat(60));
    },
    onTick: ({ hasNewMessages }) => {
      if (!hasNewMessages) {
        process.stdout.write('.'); // 没有新消息时显示 .
      }
    },
  });
  
  // 处理退出
  process.on('SIGINT', async () => {
    console.log('\n\n收到退出信号...');
    await monitor.stop('user_interrupt');
    process.exit(0);
  });
  
  // 启动监控
  await monitor.start();
}

// 运行
main().catch(console.error);
