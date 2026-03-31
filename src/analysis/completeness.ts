/**
 * Information Completeness Checker
 * 
 * Checks if we have enough information to respond to an incident.
 */

import { IncidentIntent, AnalysisResult } from '../ai/provider.js';

/**
 * Required information for different intent types
 */
const REQUIRED_INFO: Record<string, string[]> = {
  problem_report: [
    'What is the problem?',
    'When did it start?',
    'What services are affected?',
  ],
  information_update: [],
  question: ['What is the question?'],
  resolution: ['What was the fix?'],
  other: [],
};

/**
 * Check completeness of incident information
 */
export interface CompletenessCheck {
  isComplete: boolean;
  missingFields: string[];
  suggestedQuestions: string[];
  confidence: number;
}

export function checkCompleteness(
  intent: IncidentIntent,
  messages: Array<{ text: string; user: string }>
): CompletenessCheck {
  const missingFields: string[] = [];
  const suggestedQuestions: string[] = [];

  // Check based on intent type
  if (intent.type === 'problem_report') {
    // Check for description
    if (!intent.description || intent.description.length < 10) {
      missingFields.push('Problem description');
      suggestedQuestions.push('Can you describe what happened in more detail?');
    }

    // Check for affected service
    if (!intent.affectedService) {
      missingFields.push('Affected service');
      suggestedQuestions.push('Which service or system is affected?');
    }

    // Check for timing
    const hasTimeInfo = messages.some((m) =>
      /start|begin|since|ago|today|yesterday|\d+:\d+|minutes|hours/i.test(
        m.text
      )
    );
    if (!hasTimeInfo) {
      missingFields.push('Start time');
      suggestedQuestions.push('When did this issue start?');
    }

    // Check for impact
    const hasImpactInfo = messages.some((m) =>
      /users|customers|traffic|requests|errors|latency|slow/i.test(m.text)
    );
    if (!hasImpactInfo) {
      missingFields.push('Impact assessment');
      suggestedQuestions.push(
        'What is the impact? (users affected, error rate, etc.)'
      );
    }
  } else if (intent.type === 'question') {
    // Questions are usually complete by themselves
    if (!intent.description || intent.description.length < 5) {
      missingFields.push('Question content');
      suggestedQuestions.push('Could you clarify your question?');
    }
  } else if (intent.type === 'resolution') {
    // Check for fix description
    if (!intent.description || intent.description.length < 10) {
      missingFields.push('Resolution details');
      suggestedQuestions.push('What was done to resolve the issue?');
    }
  }

  // Calculate confidence
  const totalFields = REQUIRED_INFO[intent.type]?.length || 3;
  const missingCount = missingFields.length;
  const confidence = Math.max(0, 1 - missingCount / totalFields);

  return {
    isComplete: missingFields.length === 0,
    missingFields,
    suggestedQuestions,
    confidence,
  };
}

/**
 * Check completeness from AI analysis result
 */
export function checkCompletenessFromAI(
  analysis: AnalysisResult
): CompletenessCheck {
  const isComplete = analysis.missingInfo.length === 0;
  const confidence = isComplete ? 1.0 : analysis.confidence;

  return {
    isComplete,
    missingFields: analysis.missingInfo,
    suggestedQuestions: analysis.suggestedQuestions,
    confidence,
  };
}

/**
 * Generate follow-up questions based on missing info
 */
export function generateFollowUpQuestions(
  missingFields: string[]
): string[] {
  if (missingFields.length === 0) {
    return [];
  }

  const questions: string[] = [];

  for (const field of missingFields) {
    // Generate specific question based on field type
    if (field.toLowerCase().includes('description')) {
      questions.push('Can you provide more details about what happened?');
    } else if (field.toLowerCase().includes('service')) {
      questions.push('Which service or system is affected?');
    } else if (field.toLowerCase().includes('time')) {
      questions.push('When did this issue start?');
    } else if (field.toLowerCase().includes('impact')) {
      questions.push(
        'What is the impact? (e.g., number of users affected, error rate)'
      );
    } else if (field.toLowerCase().includes('severity')) {
      questions.push('How severe is this issue? (P0-P3)');
    } else {
      questions.push(`Could you provide more information about: ${field}?`);
    }
  }

  return questions;
}

/**
 * Determine if we should ask follow-up questions or proceed with investigation
 */
export function shouldAskQuestions(
  completeness: CompletenessCheck
): boolean {
  // Ask if we're missing critical information
  if (!completeness.isComplete) {
    return true;
  }

  // Don't ask if confidence is high
  if (completeness.confidence > 0.8) {
    return false;
  }

  // Ask if confidence is low
  return completeness.confidence < 0.5;
}
