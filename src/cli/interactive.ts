/**
 * Interactive CLI
 * 
 * Provides interactive command-line interface for:
 * - Displaying Slack messages
 * - Showing draft responses
 * - Getting user confirmation/input
 * - Multi-line input support
 */

import * as readline from 'readline';

export interface ActionOption {
  key: string;
  label: string;
  value?: string;
}

export interface PromptOptions {
  context: string;
  draft?: string;
  actions: ActionOption[];
  allowCustomInput?: boolean;
}

class InteractiveCLI {
  private rl: readline.Interface;
  private isMultiLineMode = false;
  private multiLineLines: string[] = [];

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  /**
   * Clear the console
   */
  clear(): void {
    console.clear();
  }

  /**
   * Print a message to the console
   */
  print(message: string): void {
    console.log(message);
  }

  /**
   * Print a separator line
   */
  printSeparator(char: string = '=', length: number = 60): void {
    console.log(char.repeat(length));
  }

  /**
   * Display Slack messages
   */
  displayMessages(
    messages: Array<{
      ts: string;
      user: string;
      text: string;
      thread_ts?: string;
    }>,
    title: string = 'Slack Messages'
  ): void {
    this.printSeparator();
    this.print(`📬 ${title}`);
    this.printSeparator();

    if (messages.length === 0) {
      this.print('  (No messages)');
    } else {
      for (const msg of messages) {
        const time = new Date(parseFloat(msg.ts) * 1000).toLocaleTimeString();
        const threadIndicator = msg.thread_ts ? '  ↳ ' : '';
        this.print(`${threadIndicator}[${time}] @${msg.user}: ${msg.text}`);
      }
    }

    this.printSeparator();
  }

  /**
   * Display a draft response and get user action
   */
  async prompt(options: PromptOptions): Promise<string> {
    return new Promise((resolve) => {
      // Display context
      if (options.context) {
        this.print('\n' + options.context);
      }

      // Display draft
      if (options.draft) {
        this.printSeparator();
        this.print('📤 准备发送以下回复到 Slack:');
        this.printSeparator();
        this.print(options.draft);
        this.printSeparator();
      }

      // Display actions
      this.print('\n请选择操作:');
      for (const action of options.actions) {
        this.print(`  [${action.key}] ${action.label}`);
      }

      if (options.allowCustomInput !== false) {
        this.print('  [Text] 直接输入补充信息 (按 Enter 发送，输入 "END" 结束多行输入)');
      }

      this.printSeparator('-', 40);

      // Get user input
      this.rl.question('> ', (input) => {
        const trimmedInput = input.trim();

        // Check if it's an action key
        const action = options.actions.find(
          (a) => a.key === trimmedInput
        );
        if (action) {
          resolve(action.value || action.key);
        } else if (options.allowCustomInput !== false && trimmedInput) {
          // It's custom input
          resolve(trimmedInput);
        } else {
          // Invalid input, prompt again
          this.print('❌ 无效输入，请重试\n');
          this.prompt(options).then(resolve);
        }
      });
    });
  }

  /**
   * Get multi-line input from user
   */
  async getMultiLineInput(promptText: string = '请输入 (输入 END 结束):'): Promise<string> {
    return new Promise((resolve) => {
      this.print(promptText);
      this.isMultiLineMode = true;
      this.multiLineLines = [];

      const onLine = (line: string) => {
        if (line === 'END') {
          this.rl.removeListener('line', onLine);
          this.isMultiLineMode = false;
          resolve(this.multiLineLines.join('\n'));
        } else {
          this.multiLineLines.push(line);
        }
      };

      this.rl.on('line', onLine);
    });
  }

  /**
   * Show a confirmation message
   */
  async confirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      this.rl.question(`${message} (y/n) > `, (input) => {
        resolve(input.toLowerCase().trim() === 'y' || input.toLowerCase().trim() === 'yes');
      });
    });
  }

  /**
   * Show progress indicator
   */
  showProgress(message: string): () => void {
    process.stdout.write(`⏳ ${message}... `);
    return () => {
      process.stdout.write('\r\x1b[K'); // Clear line
    };
  }

  /**
   * Close the CLI interface
   */
  close(): void {
    this.rl.close();
  }
}

// Singleton instance
let cliInstance: InteractiveCLI | null = null;

export function getCLI(): InteractiveCLI {
  if (!cliInstance) {
    cliInstance = new InteractiveCLI();
  }
  return cliInstance;
}

/**
 * Format messages for display
 */
export function formatMessages(
  messages: Array<{
    ts: string;
    user: string;
    text: string;
    thread_ts?: string;
  }>
): string {
  if (messages.length === 0) {
    return '(No messages)';
  }

  return messages
    .map((msg) => {
      const time = new Date(parseFloat(msg.ts) * 1000).toLocaleTimeString();
      const threadIndicator = msg.thread_ts ? '  ↳ ' : '';
      return `${threadIndicator}[${time}] @${msg.user}: ${msg.text}`;
    })
    .join('\n');
}

/**
 * Format a draft for display
 */
export function formatDraft(draft: string): string {
  return draft
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
}
