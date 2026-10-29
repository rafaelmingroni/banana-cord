const fs = require('fs');
const path = require('path');

const raw = String(process.env.BANANA_FIREBASE_CONFIG_JSON || '').trim();
if (!raw) {
  console.log('BANANA_FIREBASE_CONFIG_JSON not set; keeping V2 preview unconfigured.');
  process.exit(0);
}

let parsed;
try {
  parsed = JSON.parse(raw);
} catch (err) {
  console.error('BANANA_FIREBASE_CONFIG_JSON must be valid JSON.');
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
