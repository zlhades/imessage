/**
 * 循环监控器
 * 
 * 核心逻辑：
 * 1. 定时读取文件/Slack
 * 2. 有新消息才分析（节省 token）
 * 3. 可同时接收用户指令
 * 4. 检测到结束标记停止
 */

import { readNewMessages, checkEndMarker, formatMessages } from './file-reader.js';
import { loadState, saveState, createState, markProcessed, isProcessed } from './state.js';

const DEFAULT_INTERVAL = 30000; // 30 秒

/**
 * 监控器配置
 * @typedef {Object} MonitorConfig
 * @property {string} channel - 频道/文件名
 * @property {number} [interval] - 轮询间隔（毫秒）
 * @property {function} onNewMessages - 新消息回调
 * @property {function} onEnd - 结束回调
 * @property {function} [onTick] - 每次轮询回调
 */

/**
 * 监控器实例
 */
export class IncidentMonitor {
  constructor(config) {
    this.config = config;
    this.channel = config.channel;
    this.interval = config.interval || DEFAULT_INTERVAL;
    this.state = null;
    this.running = false;
    this.timer = null;
    this.userQueue = []; // 用户指令队列
  }

  /**
   * 启动监控
   */
  async start() {
    console.log(`[Monitor] 启动监控：${this.channel}`);
    
    // 加载或创建状态
    this.state = loadState(this.channel) || createState(this.channel);
    saveState(this.channel, this.state);
    
    this.running = true;
    
    // 开始循环
    this._runLoop();
    
    return this;
  }

  /**
   * 循环执行
   * @private
   */
  async _runLoop() {
    while (this.running) {
      try {
        // 等待间隔时间
        await this._sleep(this.interval);
        
        // 检查是否被用户中断
        if (this.userQueue.length > 0) {
          const cmd = this.userQueue.shift();
          await this._handleUserCommand(cmd);
          continue;
        }
        
        // 读取新消息
        const newMessages = readNewMessages(this.channel, this.state.lastReadTs);
        
        if (newMessages.length > 0) {
          console.log(`[Monitor] 发现 ${newMessages.length} 条新消息`);
          
          // 过滤已处理的消息
          const unprocessed = newMessages.filter(msg => !isProcessed(this.channel, msg.ts));
          
          if (unprocessed.length > 0) {
            // 有新消息，调用回调（会消耗 token 分析）
            await this.config.onNewMessages(unprocessed, this.state);
            
            // 更新状态
            for (const msg of unprocessed) {
              markProcessed(this.channel, msg.ts);
            }
            this.state.lastReadTs = unprocessed[unprocessed.length - 1].ts;
            this.state.context.messageCount += unprocessed.length;
            this.state.context.lastActivity = new Date().toISOString();
          }
          
          // 检查结束标记
          if (checkEndMarker(newMessages)) {
            console.log('[Monitor] 检测到结束标记');
            await this.stop('end_marker');
            break;
          }
        } else {
          // 没有新消息，不消耗 token
          if (this.config.onTick) {
            this.config.onTick({ hasNewMessages: false });
          }
        }
        
        // 保存状态
        saveState(this.channel, this.state);
        
      } catch (error) {
        console.error('[Monitor] 循环错误:', error);
      }
    }
  }

  /**
   * 处理用户指令
   * @private
   */
  async _handleUserCommand(cmd) {
    console.log(`[Monitor] 处理用户指令：${cmd.type}`);
    
    switch (cmd.type) {
      case 'stop':
        await this.stop('user_request');
        break;
      case 'analyze':
        await this.config.onNewMessages(cmd.messages, this.state);
        break;
      case 'status':
        console.log('[Monitor] 状态:', {
          channel: this.channel,
          messageCount: this.state.context.messageCount,
          lastActivity: this.state.context.lastActivity,
        });
        break;
    }
  }

  /**
   * 停止监控
   * @param {string} reason - 停止原因
   */
  async stop(reason) {
    console.log(`[Monitor] 停止监控：${reason}`);
    this.running = false;
    
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    
    this.state.isActive = false;
    this.state.endTime = new Date().toISOString();
    this.state.context.endReason = reason;
    saveState(this.channel, this.state);
    
    if (this.config.onEnd) {
      await this.config.onEnd(this.state);
    }
  }

  /**
   * 发送用户指令
   * @param {string} type - 指令类型
   * @param {any} [data] - 指令数据
   */
  sendCommand(type, data) {
    this.userQueue.push({ type, ...data });
  }

  /**
   * 获取状态
   */
  getStatus() {
    return {
      channel: this.channel,
      running: this.running,
      state: this.state,
    };
  }

  /**
   * 睡眠工具
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => {
      this.timer = setTimeout(resolve, ms);
    });
  }
}

/**
 * 创建监控器
 * @param {MonitorConfig} config 
 * @returns {IncidentMonitor}
 */
export function createMonitor(config) {
  return new IncidentMonitor(config);
}
