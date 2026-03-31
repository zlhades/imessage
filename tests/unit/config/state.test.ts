/**
 * ============================================================================
 * 状态持久化单元测试
 * ============================================================================
 */

import { describe, it, expect, beforeEach, vi, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  loadState,
  saveState,
  updateLastPullTs,
  markMessagesProcessed,
  isMessageProcessed,
  addLocalInput,
  getRecentLocalInputs,
  clearLocalInputs,
  createIncident,
  updateIncidentStatus,
  getOpenIncidents,
  getIncidentByChannel,
  PeriodicStateSaver,
  type PersistedState,
} from '../../../src/config/state.js';

// Mock fs 模块
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

describe('状态持久化', () => {
  const mockStateFile = '/mock/data/state.json';
  
  beforeEach(() => {
    vi.clearAllMocks();
    // 默认模拟文件不存在
    (fs.existsSync as any).mockReturnValue(false);
  });

  describe('loadState', () => {
    it('文件不存在时应该返回默认状态', () => {
      const state = loadState();
      
      expect(state).toEqual({
        last_pull_ts: '0',
        processed_message_ids: [],
        pending_draft: undefined,
        local_inputs: [],
        incident_history: [],
      });
    });

    it('应该从文件加载状态', () => {
      const mockData = {
        last_pull_ts: '1234567890',
        processed_message_ids: ['msg1', 'msg2'],
        local_inputs: [{ text: 'test', timestamp: 123, type: 'SUPPLEMENT' }],
      };
      
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(JSON.stringify(mockData));
      
      const state = loadState();
      
      expect(state.last_pull_ts).toBe('1234567890');
      expect(state.processed_message_ids).toEqual(['msg1', 'msg2']);
      expect(fs.readFileSync).toHaveBeenCalled();
    });

    it('文件解析失败时应该返回默认状态', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue('invalid json');
      
      const state = loadState();
      
      expect(state.last_pull_ts).toBe('0');
    });
  });

  describe('saveState', () => {
    it('应该保存状态到文件', () => {
      const state: PersistedState = {
        last_pull_ts: '1234567890',
        processed_message_ids: ['msg1'],
        pending_draft: undefined,
        local_inputs: [],
        incident_history: [],
      };
      
      saveState(state);
      
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('1234567890')
      );
    });
  });

  describe('updateLastPullTs', () => {
    it('应该更新最后拉取时间', () => {
      (fs.existsSync as any).mockReturnValue(false);
      
      const state = updateLastPullTs('9876543210');
      
      expect(state.last_pull_ts).toBe('9876543210');
      expect(fs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe('markMessagesProcessed', () => {
    it('应该标记消息为已处理', () => {
      (fs.existsSync as any).mockReturnValue(false);
      
      const state = markMessagesProcessed(['msg1', 'msg2']);
      
      expect(state.processed_message_ids).toEqual(['msg1', 'msg2']);
    });

    it('应该去重已处理的消息', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(
        JSON.stringify({ processed_message_ids: ['msg1'] })
      );
      
      const state = markMessagesProcessed(['msg1', 'msg2']);
      
      expect(state.processed_message_ids).toEqual(['msg1', 'msg2']);
    });

    it('应该限制数组大小', () => {
      const largeArray = Array.from({ length: 10001 }, (_, i) => `msg${i}`);
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(
        JSON.stringify({ processed_message_ids: largeArray })
      );
      
      const state = markMessagesProcessed(['new_msg']);
      
      expect(state.processed_message_ids.length).toBeLessThanOrEqual(10000);
    });
  });

  describe('isMessageProcessed', () => {
    it('已处理的消息应该返回 true', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(
        JSON.stringify({ processed_message_ids: ['msg1', 'msg2'] })
      );
      
      expect(isMessageProcessed('msg1')).toBe(true);
    });

    it('未处理的消息应该返回 false', () => {
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(
        JSON.stringify({ processed_message_ids: ['msg1'] })
      );
      
      expect(isMessageProcessed('msg2')).toBe(false);
    });
  });

  describe('本地输入管理', () => {
    beforeEach(() => {
      (fs.existsSync as any).mockReturnValue(false);
    });

    it('应该添加本地输入', () => {
      const state = addLocalInput({
        text: 'Test input',
        timestamp: 123456,
        type: 'SUPPLEMENT',
      });
      
      expect(state.local_inputs.length).toBe(1);
      expect(state.local_inputs[0].text).toBe('Test input');
    });

    it('应该限制本地输入数量', () => {
      // 先添加 100 条
      for (let i = 0; i < 100; i++) {
        addLocalInput({
          text: `Input ${i}`,
          timestamp: i,
          type: 'SUPPLEMENT',
        });
      }
      
      // 再添加 1 条
      const state = addLocalInput({
        text: 'Input 101',
        timestamp: 101,
        type: 'SUPPLEMENT',
      });
      
      expect(state.local_inputs.length).toBeLessThanOrEqual(100);
    });

    it('应该获取最近的本地输入', () => {
      addLocalInput({ text: 'Input 1', timestamp: 1, type: 'SUPPLEMENT' });
      addLocalInput({ text: 'Input 2', timestamp: 2, type: 'SUPPLEMENT' });
      addLocalInput({ text: 'Input 3', timestamp: 3, type: 'SUPPLEMENT' });
      
      const inputs = getRecentLocalInputs(2);
      
      expect(inputs.length).toBe(2);
      expect(inputs[0].text).toBe('Input 2');
      expect(inputs[1].text).toBe('Input 3');
    });

    it('应该清空本地输入', () => {
      addLocalInput({ text: 'Test', timestamp: 1, type: 'SUPPLEMENT' });
      const state = clearLocalInputs();
      
      expect(state.local_inputs.length).toBe(0);
    });
  });

  describe('事件历史记录', () => {
    beforeEach(() => {
      (fs.existsSync as any).mockReturnValue(false);
    });

    it('应该创建事件记录', () => {
      const state = createIncident({
        id: 'incident-001',
        channel: '#incidents',
        start_ts: '1234567890',
      });
      
      expect(state.incident_history.length).toBe(1);
      expect(state.incident_history[0].id).toBe('incident-001');
      expect(state.incident_history[0].status).toBe('open');
    });

    it('应该更新事件状态', () => {
      createIncident({
        id: 'incident-001',
        channel: '#incidents',
        start_ts: '1234567890',
      });
      
      const state = updateIncidentStatus('incident-001', 'resolved', 'Fixed by restart');
      
      const incident = state.incident_history.find(i => i.id === 'incident-001');
      expect(incident?.status).toBe('resolved');
      expect(incident?.summary).toBe('Fixed by restart');
      expect(incident?.end_ts).toBeDefined();
    });

    it('应该获取未解决的事件', () => {
      createIncident({ id: 'i1', channel: '#incidents', start_ts: '1' });
      createIncident({ id: 'i2', channel: '#general', start_ts: '2' });
      updateIncidentStatus('i1', 'resolved');
      
      const openIncidents = getOpenIncidents();
      
      expect(openIncidents.length).toBe(1);
      expect(openIncidents[0].id).toBe('i2');
    });

    it('应该根据频道获取事件', () => {
      createIncident({ id: 'i1', channel: '#incidents', start_ts: '1' });
      
      const incident = getIncidentByChannel('#incidents');
      
      expect(incident).toBeDefined();
      expect(incident.id).toBe('i1');
    });
  });

  describe('PeriodicStateSaver', () => {
    vi.useFakeTimers();

    it('应该定期保存状态', () => {
      const getStateFn = vi.fn(() => ({
        last_pull_ts: '123',
        processed_message_ids: [],
        pending_draft: undefined,
        local_inputs: [],
        incident_history: [],
      }));
      
      const saver = new PeriodicStateSaver(getStateFn, 1); // 1 秒间隔
      saver.start();
      
      // 快进 2.5 秒
      vi.advanceTimersByTime(2500);
      
      // 应该保存了 2 次
      expect(getStateFn).toHaveBeenCalledTimes(2);
      expect(fs.writeFileSync).toHaveBeenCalledTimes(2);
      
      saver.stop();
    });

    it('应该能够停止保存', () => {
      const getStateFn = vi.fn(() => ({
        last_pull_ts: '123',
        processed_message_ids: [],
        pending_draft: undefined,
        local_inputs: [],
        incident_history: [],
      }));
      
      const saver = new PeriodicStateSaver(getStateFn, 1);
      saver.start();
      vi.advanceTimersByTime(500);
      
      saver.stop();
      vi.advanceTimersByTime(2000);
      
      // 停止后不应该再保存
      const callCount = getStateFn.mock.calls.length;
      vi.advanceTimersByTime(1500);
      expect(getStateFn).toHaveBeenCalledTimes(callCount);
    });

    afterAll(() => {
      vi.useRealTimers();
    });
  });
});
