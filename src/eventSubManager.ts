import { promises as fs } from 'fs';
import { TwitchClient } from './twitchClient';
import { logger } from './logger';

interface StoredSubscription {
  id: string;
  type: string;
  condition: Record<string, string>;
  expires_at: string;
}

/**
 * EventSubManager persists subscriptions and auto-renews them before expiry.
 */
export class EventSubManager {
  constructor(private client: TwitchClient, private stateFile = process.env.EVENTSUB_STATE_FILE || 'eventsub-state.json') {}

  /**
   * Ensure a subscription exists and renew it as it nears expiration.
   */
  async ensureSubscription(
    type: string,
    condition: Record<string, string>,
    callback: string,
    secret: string,
  ): Promise<void> {
    const state = await this.loadState();
    const key = this.makeKey(type, condition);
    const existing = state[key];
    const now = Date.now();

    if (existing && new Date(existing.expires_at).getTime() - now > 60 * 1000) {
      // Schedule renewal one minute before expiry
      this.scheduleRenewal(existing, type, condition, callback, secret);
      return;
    }

    const resp = await this.client.createEventSubSubscription(type, condition, callback, secret);
    const sub = resp.data[0];
    state[key] = { id: sub.id, type, condition, expires_at: sub.expires_at };
    await this.saveState(state);
    logger.info({ type }, 'EventSub subscription ensured');
    this.scheduleRenewal(sub, type, condition, callback, secret);
  }

  private scheduleRenewal(
    sub: { expires_at: string },
    type: string,
    condition: Record<string, string>,
    callback: string,
    secret: string,
  ) {
    const delay = new Date(sub.expires_at).getTime() - Date.now() - 60 * 1000;
    setTimeout(() => {
      this.ensureSubscription(type, condition, callback, secret).catch((err) =>
        logger.error({ err }, 'Failed to renew EventSub subscription'),
      );
    }, Math.max(delay, 0)).unref();
  }

  private makeKey(type: string, condition: Record<string, string>): string {
    return `${type}:${JSON.stringify(condition)}`;
  }

  private async loadState(): Promise<Record<string, StoredSubscription>> {
    try {
      const raw = await fs.readFile(this.stateFile, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  private async saveState(state: Record<string, StoredSubscription>): Promise<void> {
    await fs.writeFile(this.stateFile, JSON.stringify(state, null, 2));
  }
}
