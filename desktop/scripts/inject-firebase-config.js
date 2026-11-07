const fs = require('fs');
const path = require('path');

const raw = String(process.env.BANANA_FIREBASE_CONFIG_JSON || '').trim();
if (!raw) {
  console.error('BANANA_FIREBASE_CONFIG_JSON is required for a configured release build.');
  process.exit(1);
}

let parsed;
try {
  parsed = require('../firebase-public-config')(JSON.parse(raw));
} catch (err) {
  console.error('BANANA_FIREBASE_CONFIG_JSON must contain valid public Firebase web configuration only.');
  process.exit(1);
}

const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
for (const key of required) {
  if (!String(parsed[key] || '').trim()) {
    console.error(`Missing Firebase config field: ${key}`);
    process.exit(1);
  }
}

if (!parsed.databaseURL) parsed.databaseURL = 'https://banana-cord-default-rtdb.firebaseio.com';

const output = `// Generated at build time. Do not edit manually.\nmodule.exports = ${JSON.stringify(parsed, null, 2)};\n`;
const target = path.resolve(__dirname, '..', 'cloud', 'firebase-config.js');
fs.writeFileSync(target, output, 'utf8');
console.log('Firebase web config injected into Banana Cord V2 build.');

// Only a public HTTPS issuer URL is packaged; TURN passwords are never bundled.
const relayUrl=String(process.env.MINGRX_TURN_CREDENTIALS_URL||'').trim();
if(relayUrl){const url=new URL(relayUrl);if(url.protocol!=='https:'||url.username||url.password)throw new Error('TURN issuer must be HTTPS without embedded credentials.');}
require('fs').writeFileSync(require('path').join(__dirname,'../cloud/rtc-config.json'),JSON.stringify({credentialsUrl:relayUrl},null,2)+'\n');
