const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createRendezvous, normalizeCode, isValidShortCode } = require('../rendezvous');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'banana-rv-'));
  const dataFile = path.join(dir, 'data.json');
  fs.writeFileSync(dataFile, JSON.stringify({
    servers: {
      srv_demo: { id: 'srv_demo', name: 'Demo', inviteCode: '48B05463', members: [], channels: [] }
    }
  }));
  const rv = createRendezvous({ storageDir: path.join(dir, 'rv'), relays: [] });
  const first = rv.getCodeForServer('srv_demo', dataFile);
  assert(first && first.raw.length === 8, 'permanent code must have 8 chars');
  assert(isValidShortCode(first.raw), 'permanent code must be valid');
  const second = rv.getCodeForServer('srv_demo', dataFile);
  assert.strictEqual(first.raw, second.raw, 'permanent code must be stable');
  const temp = await rv.createTemporaryInvite({
    serverId: 'srv_demo',
    dataFile,
    url: 'https://example.trycloudflare.com',
    durationMs: 30 * 60_000,
    publish: false
  });
  assert.strictEqual(normalizeCode(temp.code).length, 12, 'temporary code must have 12 chars');
  assert(normalizeCode(temp.code).startsWith(first.raw), 'temporary code must be tied to permanent server code');
  rv.close();
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('Banana Cord v1.1.0 rendezvous smoke test: OK');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
