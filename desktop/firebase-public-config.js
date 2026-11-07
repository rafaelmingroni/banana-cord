// Firebase web API keys identify a project; they are not administrative secrets.
// Reject private credential documents instead of accidentally packaging them.
const allowed = new Set(['apiKey','authDomain','projectId','appId','databaseURL','storageBucket','messagingSenderId','measurementId']);
module.exports = input => {
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || Object.keys(input).some(key => !allowed.has(key))) {
    throw new Error('Firebase config must contain only public web configuration fields.');
  }
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== 'string' || !value.trim() || value.length > 2048) throw new Error(`Invalid public Firebase field: ${key}`);
  }
  for (const key of ['apiKey','authDomain','projectId','appId']) {
    if (!input[key]) throw new Error(`Missing public Firebase field: ${key}`);
  }
  if (!/^[a-z0-9.-]+$/i.test(input.authDomain)) throw new Error('Invalid Firebase auth domain.');
  if (input.databaseURL) {
    const url = new URL(input.databaseURL);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Firebase database URL must be HTTPS without credentials.');
  }
  return { ...input };
};
