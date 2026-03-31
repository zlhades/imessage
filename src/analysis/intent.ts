/**
 * Intent Recognition
 * 
 * Analyzes messages to identify incident-related intents.
 */

import { SlackMessage, IncidentIntent } from '../ai/provider.js';

/**
 * Keywords that indicate a problem report
 */
const PROBLEM_KEYWORDS = [
  'error',
  'fail',
  'broken',
  'down',
  'issue',
  'problem',
  'bug',
  'crash',
  'outage',
  'incident',
  'alert',
  'warning',
  'exception',
  'timeout',
  '500',
  '502',
  '503',
  '504',
];

/**
 * Keywords that indicate severity
 */
const SEVERITY_KEYWORDS: Record<string, 'P0' | 'P1' | 'P2' | 'P3'> = {
  'p0': 'P0',
  'p1': 'P1',
  'p2': 'P2',
  'p3': 'P3',
  'critical': 'P0',
  'urgent': 'P1',
  'high': 'P2',
  'low': 'P3',
  'emergency': 'P0',
  'sev1': 'P0',
  'sev2': 'P1',
  'sev3': 'P2',
};

/**
 * Patterns that indicate questions
 */
const QUESTION_PATTERNS = [
  /\?$/,
  /^can you/i,
  /^could you/i,
  /^do you know/i,
  /^has anyone/i,
  /^is anyone/i,
  /^what/i,
  /^when/i,
  /^where/i,
  /^why/i,
  /^how/i,
];

/**
 * Patterns that indicate resolution
 */
const RESOLUTION_PATTERNS = [
  /fixed/i,
  /resolved/i,
  /solved/i,
  /working now/i,
  /issue is gone/i,
  /back to normal/i,
  /deployed/i,
  /rolled back/i,
];

/**
 * Patterns that indicate information update
 */
const UPDATE_PATTERNS = [
  /looks like/i,
  /seems like/i,
  /i think/i,
  /probably/i,
  /might be/i,
];

/**
 * Classify the intent of a message
 */
export function classifyIntent(text: string, user?: string): IncidentIntent {
  const lowerText = text.toLowerCase();

  // Check for information update FIRST (before problem report)
  for (const pattern of UPDATE_PATTERNS) {
    if (pattern.test(text)) {
      return {
        type: 'information_update',
        description: text,
        reporter: user,
      };
    }
  }

  // Check for resolution
  for (const pattern of RESOLUTION_PATTERNS) {
    if (pattern.test(text)) {
      return {
        type: 'resolution',
        description: text,
        reporter: user,
      };
    }
  }

  // Check for question
  for (const pattern of QUESTION_PATTERNS) {
    if (pattern.test(text)) {
      return {
        type: 'question',
        description: text,
        reporter: user,
      };
    }
  }

  // Check for problem report
  const hasProblemKeyword = PROBLEM_KEYWORDS.some((keyword) =>
    lowerText.includes(keyword)
  );

  if (hasProblemKeyword) {
    // Check for severity
    let severity: 'P0' | 'P1' | 'P2' | 'P3' | undefined;
    for (const [keyword, sev] of Object.entries(SEVERITY_KEYWORDS)) {
      if (lowerText.includes(keyword)) {
        severity = sev;
        break;
      }
    }

    // Default severity based on keywords
    if (!severity) {
      if (lowerText.includes('down') || lowerText.includes('outage')) {
        severity = 'P1';
      } else if (lowerText.includes('error') || lowerText.includes('fail')) {
        severity = 'P2';
      } else {
        severity = 'P3';
      }
    }

    return {
      type: 'problem_report',
      severity,
      description: text,
      reporter: user,
    };
  }

  // Default: other
  return {
    type: 'other',
    description: text,
    reporter: user,
  };
}

/**
 * Classify intents for multiple messages
 */
export function classifyIntents(messages: SlackMessage[]): Array<{
  message: SlackMessage;
  intent: IncidentIntent;
}> {
  return messages.map((msg) => ({
    message: msg,
    intent: classifyIntent(msg.text, msg.user),
  }));
}

/**
 * Get the primary intent from a conversation
 */
export function getPrimaryIntent(
  messages: SlackMessage[]
): IncidentIntent | null {
  if (messages.length === 0) {
    return null;
  }

  // Look for problem reports first
  for (const msg of messages) {
    const intent = classifyIntent(msg.text, msg.user);
    if (intent.type === 'problem_report') {
      return intent;
    }
  }

  // Then resolutions
  for (const msg of messages) {
    const intent = classifyIntent(msg.text, msg.user);
    if (intent.type === 'resolution') {
      return intent;
    }
  }

  // Return the last message's intent
  const lastMessage = messages[messages.length - 1];
  return classifyIntent(lastMessage.text, lastMessage.user);
}

/**
 * Detect severity from conversation
 */
export function detectSeverity(messages: SlackMessage[]): 'P0' | 'P1' | 'P2' | 'P3' | undefined {
  // Check for explicit severity mentions
  for (const msg of messages) {
    const lowerText = msg.text.toLowerCase();
    for (const [keyword, severity] of Object.entries(SEVERITY_KEYWORDS)) {
      if (lowerText.includes(keyword)) {
        return severity;
      }
    }
  }

  // Infer from problem keywords
  let hasOutage = false;
  let hasError = false;

  for (const msg of messages) {
    const lowerText = msg.text.toLowerCase();
    if (lowerText.includes('outage') || lowerText.includes('down')) {
      hasOutage = true;
    }
    if (lowerText.includes('error') || lowerText.includes('fail')) {
      hasError = true;
    }
  }

  if (hasOutage) return 'P1';
  if (hasError) return 'P2';
  return 'P3';
}
