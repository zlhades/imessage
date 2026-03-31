/**
 * ============================================================================
 * 意图识别单元测试
 * ============================================================================
 * 
 * 测试内容:
 * - 问题报告识别
 * - 严重性判断
 * - 问题分类
 * - 解决方案识别
 */

import { describe, it, expect } from 'vitest';
import {
  classifyIntent,
  classifyIntents,
  getPrimaryIntent,
  detectSeverity,
} from '../../../src/analysis/intent.js';

describe('意图识别', () => {
  describe('classifyIntent', () => {
    describe('问题报告识别', () => {
      it('应该识别包含 error 的问题报告', () => {
        const intent = classifyIntent('We are seeing errors in production');
        expect(intent.type).toBe('problem_report');
        expect(intent.severity).toBe('P2');
      });

      it('应该识别包含 down 的严重问题', () => {
        const intent = classifyIntent('The service is down!');
        expect(intent.type).toBe('problem_report');
        expect(intent.severity).toBe('P1');
      });

      it('应该识别 P0 级别的问题', () => {
        const intent = classifyIntent('P0 incident! Core service is down');
        expect(intent.type).toBe('problem_report');
        expect(intent.severity).toBe('P0');
      });

      it('应该识别包含 crash 的问题', () => {
        const intent = classifyIntent('The app keeps crashing');
        expect(intent.type).toBe('problem_report');
      });

      it('应该识别包含 timeout 的问题', () => {
        const intent = classifyIntent('Getting timeout errors');
        expect(intent.type).toBe('problem_report');
      });
    });

    describe('问题解决方案识别', () => {
      it('应该识别已解决的问题', () => {
        const intent = classifyIntent('Issue is fixed now');
        expect(intent.type).toBe('resolution');
      });

      it('应该识别已恢复的服务', () => {
        const intent = classifyIntent('Service is back to normal');
        expect(intent.type).toBe('resolution');
      });

      it('应该识别已部署的修复', () => {
        const intent = classifyIntent('Deployed the fix');
        expect(intent.type).toBe('resolution');
      });
    });

    describe('问题询问识别', () => {
      it('应该识别问句', () => {
        const intent = classifyIntent('Does anyone know what happened?');
        expect(intent.type).toBe('question');
      });

      it('应该识别 Can you 开头的问句', () => {
        const intent = classifyIntent('Can you check the logs?');
        expect(intent.type).toBe('question');
      });

      it('应该识别 What 开头的问句', () => {
        const intent = classifyIntent('What is the status?');
        expect(intent.type).toBe('question');
      });

      it('应该识别 How 开头的问句', () => {
        const intent = classifyIntent('How do we fix this?');
        expect(intent.type).toBe('question');
      });
    });

    describe('信息更新识别', () => {
      it('应该识别更新信息', () => {
        const intent = classifyIntent('Update: found the root cause');
        expect(intent.type).toBe('information_update');
      });

      it('应该识别发现信息', () => {
        const intent = classifyIntent('I found something interesting in the logs');
        expect(intent.type).toBe('information_update');
      });

      it('应该识别看起来信息', () => {
        const intent = classifyIntent('It looks like a database issue');
        expect(intent.type).toBe('information_update');
      });
    });

    describe('默认类型', () => {
      it('应该将未知类型归类为 other', () => {
        const intent = classifyIntent('Random message');
        expect(intent.type).toBe('other');
      });

      it('应该处理空消息', () => {
        const intent = classifyIntent('');
        expect(intent.type).toBe('other');
      });
    });
  });

  describe('detectSeverity', () => {
    it('应该检测 P0 严重性', () => {
      const messages = [
        { ts: '1', user: 'U1', text: 'P0 incident!' },
      ];
      const severity = detectSeverity(messages);
      expect(severity).toBe('P0');
    });

    it('应该检测 P1 严重性（outage）', () => {
      const messages = [
        { ts: '1', user: 'U1', text: 'We have an outage' },
      ];
      const severity = detectSeverity(messages);
      expect(severity).toBe('P1');
    });

    it('应该检测 P2 严重性（error）', () => {
      const messages = [
        { ts: '1', user: 'U1', text: 'Seeing errors everywhere' },
      ];
      const severity = detectSeverity(messages);
      expect(severity).toBe('P2');
    });

    it('应该检测 P3 严重性（默认）', () => {
      const messages = [
        { ts: '1', user: 'U1', text: 'Minor issue here' },
      ];
      const severity = detectSeverity(messages);
      expect(severity).toBe('P3');
    });
  });

  describe('classifyIntents', () => {
    it('应该批量分类多个消息', () => {
      const messages = [
        { ts: '1', user: 'U1', text: 'Service is down!' },
        { ts: '2', user: 'U2', text: 'Looking into it' },
        { ts: '3', user: 'U1', text: 'Fixed now' },
      ];

      const results = classifyIntents(messages);
      expect(results.length).toBe(3);
      expect(results[0].intent.type).toBe('problem_report');
      expect(results[2].intent.type).toBe('resolution');
    });
  });

  describe('getPrimaryIntent', () => {
    it('应该优先返回问题报告', () => {
      const messages = [
        { ts: '1', user: 'U1', text: 'Hello everyone' },
        { ts: '2', user: 'U2', text: 'The service is down!' },
        { ts: '3', user: 'U1', text: 'OK' },
      ];

      const intent = getPrimaryIntent(messages);
      expect(intent?.type).toBe('problem_report');
    });

    it('如果没有问题报告，返回最后一个消息的意图', () => {
      const messages = [
        { ts: '1', user: 'U1', text: 'Hello' },
        { ts: '2', user: 'U2', text: 'Hi there' },
      ];

      const intent = getPrimaryIntent(messages);
      expect(intent).toBeDefined();
    });

    it('空消息列表应该返回 null', () => {
      const intent = getPrimaryIntent([]);
      expect(intent).toBeNull();
    });
  });
});
