import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';
import Bottleneck from 'bottleneck';
import crypto from 'node:crypto';
import { logger } from './logger';
import { apiRequestCounter } from './telemetry';

/**
 * TwitchClient is a lightweight wrapper around the Twitch Helix API.
 * It now includes rate limiting, retry logic, and EventSub helpers
 * for building real-time Twitch integrations.
 */
export class TwitchClient {
  private http: AxiosInstance;
  private accessToken: string | null = null;
  private limiter: Bottleneck;

  constructor(private clientId: string, private clientSecret: string) {
    // Preconfigure axios instance for Helix API calls
    this.http = axios.create({
      baseURL: 'https://api.twitch.tv/helix',
      timeout: 5000,
    });

    // Automatic retries with exponential backoff for transient failures
    axiosRetry(this.http, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (err) =>
        axiosRetry.isRetryableError(err) || err.response?.status === 429,
    });

    // Respect Twitch API rate limits: 800 requests per minute per app
    this.limiter = new Bottleneck({
      reservoir: 800,
      reservoirRefreshAmount: 800,
      reservoirRefreshInterval: 60 * 1000,
      maxConcurrent: 1,
    });
  }

  /**
   * Retrieve and cache an OAuth token using client credentials.
   * Subsequent calls reuse the cached token until expiry.
   */
  private async authenticate(): Promise<void> {
    if (this.accessToken) return;

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'client_credentials',
    });

    const resp = await axios.post('https://id.twitch.tv/oauth2/token', params);
    // Cache token and set headers
    this.accessToken = resp.data.access_token;
    this.http.defaults.headers.common['Client-ID'] = this.clientId;
    this.http.defaults.headers.common['Authorization'] = `Bearer ${this.accessToken}`;
  }

  /**
   * Internal request helper that applies auth, rate limiting and retries.
   */
  private async request<T>(config: AxiosRequestConfig): Promise<T> {
    await this.authenticate();
    const resp = await this.limiter.schedule(() => this.http.request<T>(config));
    apiRequestCounter.add(1, { endpoint: String(config.url) });
    return resp.data;
  }

  /**
   * Fetch current stream information for a channel.
   * @param userLogin Twitch channel login name
   */
  async getStreamInfo(userLogin: string): Promise<any> {
    return this.request({ url: '/streams', method: 'GET', params: { user_login: userLogin } });
  }

  /**
   * Subscribe to a Twitch EventSub event via webhook transport.
   * @param type Event type (e.g., 'stream.online')
   * @param condition Event condition object (e.g., { broadcaster_user_id })
   * @param callback Public callback URL for webhook delivery
   * @param secret Secret used to sign webhook payloads
   */
  async createEventSubSubscription(
    type: string,
    condition: Record<string, string>,
    callback: string,
    secret: string,
  ): Promise<any> {
    const payload = {
      type,
      version: '1',
      condition,
      transport: {
        method: 'webhook',
        callback,
        secret,
      },
    };
    const result = await this.request({ url: '/eventsub/subscriptions', method: 'POST', data: payload });
    logger.info({ type }, 'EventSub subscription requested');
    return result;
  }

  /**
   * Verify an EventSub message HMAC signature.
   */
  static verifyEventSubSignature(
    id: string,
    timestamp: string,
    body: string,
    signature: string,
    secret: string,
  ): boolean {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(id + timestamp + body);
    const expected = `sha256=${hmac.digest('hex')}`;
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
  }

  /**
   * Factory helper that constructs a client from environment variables.
   */
  static fromEnv(): TwitchClient {
    const { TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } = process.env;
    if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
      throw new Error('Missing Twitch credentials. Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET.');
    }
    return new TwitchClient(TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET);
  }
}
