import { config } from 'dotenv';
import { TwitchClient } from './twitchClient';
import { ChatBot } from './chatBot';
import { EventSubManager } from './eventSubManager';
import { logger } from './logger';

// Load environment variables from a local .env file when present
config();

async function run() {
  try {
    // Instantiate client using credentials from env vars
    const client = TwitchClient.fromEnv();
    const streamer = process.env.TWITCH_STREAMER || 'SolarKhan';

    // Query Twitch for current stream info and log the response
    const info = await client.getStreamInfo(streamer);
    logger.info({ streamer, info }, 'Fetched stream info');

    // Optionally register an EventSub subscription for stream start events
    if (
      process.env.TWITCH_EVENTSUB_CALLBACK &&
      process.env.TWITCH_EVENTSUB_SECRET &&
      process.env.TWITCH_BROADCASTER_ID
    ) {
      const manager = new EventSubManager(client);
      await manager.ensureSubscription(
        'stream.online',
        { broadcaster_user_id: process.env.TWITCH_BROADCASTER_ID },
        process.env.TWITCH_EVENTSUB_CALLBACK,
        process.env.TWITCH_EVENTSUB_SECRET,
      );
    }

    // Boot chat bot if credentials are present
    try {
      const bot = ChatBot.fromEnv();
      await bot.connect();
      bot.registerCommand('ping', (channel) => bot.say(channel, 'pong!'), {
        cooldownMs: 5000,
      });
      bot.registerCommand(
        'raid',
        (channel, _user, args) => bot.say(channel, `Preparing raid for ${args}`),
        { roles: ['broadcaster', 'mod'] },
      );
      logger.info('Chat bot connected.');
    } catch (err) {
      logger.warn({ err }, 'Chat bot disabled');
    }
  } catch (err) {
    // Provide a clean error message for missing credentials or network issues
    logger.error({ err }, 'Failed to fetch stream info');
  }
}

run();
