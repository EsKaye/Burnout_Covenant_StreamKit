import { strict as assert } from 'node:assert';
import { ChatBot } from '../src/chatBot';

// Ensure the factory rejects when env vars are missing
export async function testMissingEnv() {
  const oldUser = process.env.TWITCH_CHAT_USERNAME;
  const oldToken = process.env.TWITCH_CHAT_TOKEN;
  const oldChannels = process.env.TWITCH_CHAT_CHANNELS;
  delete process.env.TWITCH_CHAT_USERNAME;
  delete process.env.TWITCH_CHAT_TOKEN;
  delete process.env.TWITCH_CHAT_CHANNELS;

  try {
    assert.throws(() => ChatBot.fromEnv(), /Missing chat bot credentials/);
  } finally {
    if (oldUser) process.env.TWITCH_CHAT_USERNAME = oldUser;
    if (oldToken) process.env.TWITCH_CHAT_TOKEN = oldToken;
    if (oldChannels) process.env.TWITCH_CHAT_CHANNELS = oldChannels;
  }
}

testMissingEnv();

// Verify throttling and role-based access mechanics
export async function testThrottleAndRoles() {
  const bot = new ChatBot('tester', 'token', ['#chan']);
  const outputs: string[] = [];

  bot.registerCommand('ping', (channel) => outputs.push(`pong:${channel}`), { cooldownMs: 1000 });
  const viewer = { 'user-id': '1', username: 'alice', badges: {}, mod: false } as any;
  bot['handleMessage']('#chan', viewer, '!ping', false);
  bot['handleMessage']('#chan', viewer, '!ping', false);
  assert.deepEqual(outputs, ['pong:#chan']); // second call throttled

  bot.registerCommand('modonly', (channel) => outputs.push(`mod:${channel}`), { roles: ['mod'] });
  bot['handleMessage']('#chan', viewer, '!modonly', false); // viewer rejected
  const mod = { 'user-id': '2', username: 'bob', badges: {}, mod: true } as any;
  bot['handleMessage']('#chan', mod, '!modonly', false);
  assert(outputs.includes('mod:#chan'));
}

testThrottleAndRoles();
