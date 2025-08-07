import tmi from 'tmi.js';
import { logger } from './logger';
import { chatMessageCounter } from './telemetry';

/**
 * ChatBot wraps the tmi.js library to provide a simple interface
 * for interacting with Twitch chat. It can listen for messages
 * and respond programmatically, enabling in-stream automations.
 */
interface CommandOptions {
  /** Minimum time between invocations per user in ms */
  cooldownMs?: number;
  /** Allowed roles. Defaults to everyone */
  roles?: UserRole[];
}

type CommandHandler = (channel: string, userstate: tmi.ChatUserstate, args: string) => void;

type UserRole = 'broadcaster' | 'mod' | 'vip' | 'subscriber' | 'viewer';

export class ChatBot {
  private client: tmi.Client;
  private commands = new Map<string, { handler: CommandHandler; options: CommandOptions }>();
  private lastRun = new Map<string, number>(); // user-command key => last timestamp

  constructor(private username: string, private token: string, private channels: string[]) {
    // Establish a resilient chat connection with auto-reconnect and TLS
    this.client = new tmi.Client({
      identity: { username: this.username, password: this.token },
      channels: this.channels,
      connection: { reconnect: true, secure: true },
    });
  }

  /** Connect to Twitch chat */
  async connect(): Promise<void> {
    await this.client.connect();
    // Route messages through internal processor for throttling & auth
    this.client.on('message', this.handleMessage.bind(this));
  }

  /** Send a message to a channel */
  async say(channel: string, message: string): Promise<void> {
    await this.client.say(channel, message);
  }

  /** Register a command with optional throttle and role gating */
  registerCommand(command: string, handler: CommandHandler, options: CommandOptions = {}): void {
    this.commands.set(command.toLowerCase(), { handler, options });
  }

  // Determine user role hierarchy for permission checks
  private getRole(user: tmi.ChatUserstate): UserRole {
    if (user.badges?.broadcaster) return 'broadcaster';
    if (user.mod) return 'mod';
    if (user.badges?.vip) return 'vip';
    if (user.badges?.subscriber) return 'subscriber';
    return 'viewer';
  }

  /** Internal processor for all chat messages */
  private handleMessage(channel: string, userstate: tmi.ChatUserstate, message: string, self: boolean): void {
    if (self || !message.startsWith('!')) return;
    chatMessageCounter.add(1);

    const [cmd, ...args] = message.slice(1).split(' ');
    const entry = this.commands.get(cmd.toLowerCase());
    if (!entry) return;

    const role = this.getRole(userstate);
    if (entry.options.roles && !entry.options.roles.includes(role)) {
      logger.debug({ cmd, role }, 'Command rejected due to insufficient role');
      return;
    }

    if (entry.options.cooldownMs) {
      const key = `${userstate['user-id']}:${cmd}`;
      const last = this.lastRun.get(key) || 0;
      const now = Date.now();
      if (now - last < entry.options.cooldownMs) {
        logger.debug({ cmd, user: userstate.username }, 'Command throttled');
        return;
      }
      this.lastRun.set(key, now);
    }

    entry.handler(channel, userstate, args.join(' '));
  }

  /**
   * Factory helper that constructs a bot from environment variables.
   */
  static fromEnv(): ChatBot {
    const { TWITCH_CHAT_USERNAME, TWITCH_CHAT_TOKEN, TWITCH_CHAT_CHANNELS } = process.env;
    if (!TWITCH_CHAT_USERNAME || !TWITCH_CHAT_TOKEN || !TWITCH_CHAT_CHANNELS) {
      throw new Error('Missing chat bot credentials. Set TWITCH_CHAT_USERNAME, TWITCH_CHAT_TOKEN, and TWITCH_CHAT_CHANNELS.');
    }
    const channels = TWITCH_CHAT_CHANNELS.split(',').map((c) => c.trim());
    return new ChatBot(TWITCH_CHAT_USERNAME, TWITCH_CHAT_TOKEN, channels);
  }
}
