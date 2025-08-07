import { strict as assert } from 'node:assert';
import { TwitchClient } from '../src/twitchClient';

// Basic test ensuring the factory rejects missing credentials
export async function testMissingEnv() {
  const oldId = process.env.TWITCH_CLIENT_ID;
  const oldSecret = process.env.TWITCH_CLIENT_SECRET;
  delete process.env.TWITCH_CLIENT_ID;
  delete process.env.TWITCH_CLIENT_SECRET;

  try {
    assert.throws(() => TwitchClient.fromEnv(), /Missing Twitch credentials/);
  } finally {
    if (oldId) process.env.TWITCH_CLIENT_ID = oldId;
    if (oldSecret) process.env.TWITCH_CLIENT_SECRET = oldSecret;
  }
}

testMissingEnv();
