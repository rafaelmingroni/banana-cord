const assert = require('assert');

const realSetInterval = global.setInterval;
const realClearInterval = global.clearInterval;

global.window = {
  addEventListener() {},
  BananaCloudSocket: null
};
global.setInterval = () => 1;
global.clearInterval = () => {};

require('../src/cloud-v2-webrtc-fix.js');

const fix = global.window.BananaWebRtcSignalFix;
assert(fix, 'WebRTC signaling fix was not exposed.');

const description = {
  type: 'offer',
  sdp: 'v=0\r\n...',
  toJSON() { return { type: this.type, sdp: this.sdp }; }
};
const candidate = {
  candidate: 'candidate:1 1 UDP 1 192.0.2.1 5000 typ host',
  sdpMid: '0',
  sdpMLineIndex: 0,
  usernameFragment: 'banana',
  toJSON() {
    return {
      candidate: this.candidate,
      sdpMid: this.sdpMid,
      sdpMLineIndex: this.sdpMLineIndex,
      usernameFragment: this.usernameFragment
    };
  }
};

const offerSignal = fix.normalizeSignalData({ description });
assert.deepStrictEqual(offerSignal, {
  description: { type: 'offer', sdp: 'v=0\r\n...' }
});
assert.notStrictEqual(offerSignal.description, description);

const candidateSignal = fix.normalizeSignalData({ candidate });
assert.deepStrictEqual(candidateSignal, {
  candidate: {
    candidate: 'candidate:1 1 UDP 1 192.0.2.1 5000 typ host',
    sdpMid: '0',
    sdpMLineIndex: 0,
    usernameFragment: 'banana'
  }
});
assert.notStrictEqual(candidateSignal.candidate, candidate);

const sent = [];
const socket = {
  signal(payload) { sent.push(payload); }
};
global.window.BananaCloudSocket = socket;
assert.strictEqual(fix.patchSocket(), true);
socket.signal({ targetSocketId: 'peer-1', data: { candidate } });
assert.strictEqual(sent.length, 1);
assert.deepStrictEqual(sent[0].data.candidate, candidate.toJSON());
assert.strictEqual(socket.__bananaRtcJsonPatched, true);
assert.strictEqual(fix.patchSocket(), false);

global.setInterval = realSetInterval;
global.clearInterval = realClearInterval;

console.log('WebRTC signaling JSON smoke test passed.');
