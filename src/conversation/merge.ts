/**
 * Context Merger
 * 
 * Merges Slack messages and local inputs into a unified context.
 */

import {
  MergedContext,
  SlackMessage,
  LocalInput,
  TimelineEvent,
} from '../ai/provider.js';

/**
 * Merge Slack messages and local inputs
 */
export function mergeContext(
  slackMessages: SlackMessage[],
  localInputs: LocalInput[],
  channel: string,
  threadTs?: string
): MergedContext {
  const timeline: TimelineEvent[] = [];

  // Add Slack messages to timeline
  for (const msg of slackMessages) {
    timeline.push({
      ts: msg.ts,
      type: 'SLACK_MESSAGE',
      content: msg.text,
      source: 'SLACK',
      user: msg.user,
    });
  }

  // Add local inputs to timeline
  for (const input of localInputs) {
    timeline.push({
      ts: String(input.timestamp),
      type: 'LOCAL_INPUT',
      content: input.text,
      source: 'LOCAL',
    });
  }

  // Sort by timestamp
  timeline.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));

  // Extract participants
  const participants = Array.from(
    new Set([...slackMessages.map((m) => m.user), '[Local User]'])
  );

  // Extract start time (earliest message)
  const startTime = timeline.length > 0
    ? new Date(parseFloat(timeline[0].ts) * 1000)
    : undefined;

  return {
    slackMessages,
    localInputs,
    timeline,
    metadata: {
      channel,
      threadTs,
      participants,
      startTime,
    },
  };
}

/**
 * Add a new Slack message to existing context
 */
export function addSlackMessage(
  context: MergedContext,
  message: SlackMessage
): MergedContext {
  // Check if message already exists
  const exists = context.timeline.some(
    (e) => e.ts === message.ts && e.source === 'SLACK'
  );

  if (exists) {
    return context;
  }

  const newTimeline = [
    ...context.timeline,
    {
      ts: message.ts,
      type: 'SLACK_MESSAGE' as const,
      content: message.text,
      source: 'SLACK' as const,
      user: message.user,
    },
  ];

  // Re-sort
  newTimeline.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));

  return {
    ...context,
    slackMessages: [...context.slackMessages, message],
    timeline: newTimeline,
    metadata: {
      ...context.metadata,
      participants: Array.from(
        new Set([...context.metadata.participants, message.user])
      ),
    },
  };
}

/**
 * Add a local input to existing context
 */
export function addLocalInput(
  context: MergedContext,
  input: LocalInput
): MergedContext {
  const newTimeline = [
    ...context.timeline,
    {
      ts: String(input.timestamp),
      type: 'LOCAL_INPUT' as const,
      content: input.text,
      source: 'LOCAL' as const,
    },
  ];

  // Re-sort
  newTimeline.sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));

  return {
    ...context,
    localInputs: [...context.localInputs, input],
    timeline: newTimeline,
  };
}

/**
 * Add an AI action to timeline
 */
export function addAIAction(
  context: MergedContext,
  action: string
): MergedContext {
  const now = String(Date.now());

  const newTimeline = [
    ...context.timeline,
    {
      ts: now,
      type: 'AI_ACTION' as const,
      content: action,
      source: 'LOCAL' as const,
    },
  ];

  return {
    ...context,
    timeline: newTimeline,
  };
}

/**
 * Get recent context (last N events)
 */
export function getRecentContext(
  context: MergedContext,
  limit: number = 50
): MergedContext {
  if (context.timeline.length <= limit) {
    return context;
  }

  const recentTimeline = context.timeline.slice(-limit);

  return {
    ...context,
    timeline: recentTimeline,
  };
}

/**
 * Format context for display
 */
export function formatContext(context: MergedContext): string {
  const lines = context.timeline.map((event) => {
    const time = new Date(parseFloat(event.ts) * 1000).toLocaleTimeString();
    const source = event.source === 'SLACK' ? 'Slack' : 'Local';
    const user = event.user ? `@${event.user}` : '[User]';
    return `[${time}] (${source}) ${user}: ${event.content}`;
  });

  return lines.join('\n');
}
