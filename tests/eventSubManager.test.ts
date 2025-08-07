import { strict as assert } from 'node:assert';
import { EventSubManager } from '../src/eventSubManager';
import { TwitchClient } from '../src/twitchClient';
import { promises as fs } from 'fs';

class MockClient {
  calls = 0;
  async createEventSubSubscription() {
    this.calls++;
    return { data: [{ id: 'sub1', expires_at: new Date(Date.now() + 3600000).toISOString() }] };
  }
}

export async function testPersistence() {
  const mock = new MockClient();
  const client = mock as unknown as TwitchClient;
  const file = 'tmp-eventsub.json';
  try {
    const mgr = new EventSubManager(client, file);
    await mgr.ensureSubscription('stream.online', { broadcaster_user_id: '1' }, 'cb', 'secret');
    const raw = await fs.readFile(file, 'utf-8');
    const state = JSON.parse(raw);
    assert(state['stream.online:{"broadcaster_user_id":"1"}'].id === 'sub1');
    await mgr.ensureSubscription('stream.online', { broadcaster_user_id: '1' }, 'cb', 'secret');
    assert.equal(mock.calls, 1); // no extra call since not expired
  } finally {
    await fs.unlink(file).catch(() => {});
  }
}

testPersistence();
