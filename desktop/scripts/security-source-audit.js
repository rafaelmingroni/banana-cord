// Redacted checks: never print a matching secret, a token, or historical contents.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const run = (args, options = {}) => execFileSync('git', args, { cwd: root, maxBuffer: 512 * 1024 * 1024, ...options });
const patterns = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{70,})\b/],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/],
  ['google-refresh-token', /\b1\/\/[A-Za-z0-9_-]{64,}/],
  ['service-account-document', /"type"\s*:\s*"service_account"\s*,[\s\S]{0,500}"private_key"\s*:/]
];
const findings = [];
function scan(name, bytes) {
  if (bytes.includes(0)) return;
  const content = bytes.toString('utf8');
  for (const [kind, pattern] of patterns) {
    const match = pattern.exec(content);
    if (match) findings.push({ file: name, line: content.slice(0, match.index).split('\n').length, kind });
  }
  for (const match of content.matchAll(/\beyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
    try {
      if (JSON.parse(Buffer.from(match[1], 'base64url')).role === 'service_role') {
        findings.push({ file: name, kind: 'privileged-service-role-token' });
      }
    } catch { /* Not a JWT payload. */ }
  }
}
const paths = run(['ls-files', '-z', '--cached', '--others', '--exclude-standard']).toString().split('\0').filter(Boolean);
for (const name of new Set(paths)) {
  const file = path.join(root, name);
  if (fs.existsSync(file) && fs.statSync(file).isFile()) scan(name, fs.readFileSync(file));
}
let historicalBlobs = 0;
if (process.argv.includes('--history')) {
  const objects = run(['rev-list', '--objects', '--all']).toString().trim().split('\n').map(line => line.split(' ')[0]);
  const batch = run(['cat-file', '--batch'], { input: objects.join('\n') + '\n' });
  let at = 0;
  while (at < batch.length) {
    const end = batch.indexOf(10, at);
    const [id, type, rawSize] = batch.subarray(at, end).toString().split(' ');
    const size = Number(rawSize);
    if (!Number.isSafeInteger(size)) throw new Error('Invalid history object');
    at = end + 1;
    if (type === 'blob') { scan(`history:${id.slice(0, 12)}`, batch.subarray(at, at + size)); historicalBlobs++; }
    at += size + 1;
  }
}
if (findings.length) {
  console.error(JSON.stringify({ redactedSecretFindings: findings }, null, 2));
  process.exit(1);
}
const pkg = require('../package.json'), lock = require('../package-lock.json');
for (const section of ['dependencies', 'devDependencies']) {
  for (const [name, version] of Object.entries(pkg[section])) {
    if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version) || version !== lock.packages[`node_modules/${name}`]?.version) {
      throw new Error(`Direct dependency is not pinned to the lockfile: ${name}`);
    }
  }
}
let packages = 0;
for (const [name, entry] of Object.entries(lock.packages)) {
  if (!entry.resolved) continue;
  const url = new URL(entry.resolved);
  if (url.protocol !== 'https:' || url.hostname !== 'registry.npmjs.org' || url.username || url.password || !/^sha512-/.test(entry.integrity || '')) {
    throw new Error(`Unapproved dependency source or missing integrity: ${name}`);
  }
  packages++;
}
console.log(`Security source checks: ${new Set(paths).size} files, ${historicalBlobs} historical blobs; no configured secret patterns found. ${packages} lockfile packages use HTTPS npm sources and SHA-512 integrity; direct dependencies are pinned.`);
