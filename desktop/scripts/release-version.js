const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');

function normalize(version) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\.([0-9]))?$/.exec(String(version));
  if (!match) throw new Error('Use major.minor or major.minor.patch, with patch from 0 to 9.');
  return `${match[1]}.${match[2]}.${match[3] || '0'}`;
}
function displayVersion(version) { return normalize(version).replace(/\.0$/, ''); }
function nextVersion(version) {
  const [major, minor, patch] = normalize(version).split('.').map(Number);
  return `${major}.${minor + (patch === 9 ? 1 : 0)}.${patch === 9 ? 0 : patch + 1}`;
}
function versionBlock(version) {
  return `<!-- mingrx-version:begin -->\n> **Mingrx ${displayVersion(version)}** · Versão técnica: \`${version}\`\n>\n> [Notas desta versão](RELEASE_NOTES-${version}.md) · [Última versão publicada](https://github.com/rafaelmingroni/mingrx-app/releases/latest)\n>\n> Projeto pessoal de **Rafael Mingroni**.\n<!-- mingrx-version:end -->`;
}
function checkDocuments() {
  const version = require('../package.json').version;
  assert.equal(normalize(version), version);
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8').replace(/\r\n/g, '\n');
  assert(readme.includes(versionBlock(version)), 'README must be synchronized with the release version');
  assert(readme.includes('https://img.shields.io/github/v/release/rafaelmingroni/mingrx-app'), 'README must show the actual latest GitHub release');
  const notes = fs.readFileSync(path.join(root, `RELEASE_NOTES-${version}.md`), 'utf8').replace(/\r\n/g, '\n');
  assert(notes.startsWith(`# Mingrx ${displayVersion(version)}\n`), 'Release notes must identify the public version');
  console.log(`Release ${displayVersion(version)} (${version}): README, live release badge and release notes synchronized.`);
}
function setVersion(version) {
  version = normalize(version);
  for (const relative of ['desktop/package.json', 'desktop/package-lock.json']) {
    const file = path.join(root, relative), parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    parsed.version = version;
    if (parsed.packages?.['']) parsed.packages[''].version = version;
    fs.writeFileSync(file, JSON.stringify(parsed, null, 2) + '\n');
  }
  const file = path.join(root, 'README.md');
  const source = fs.readFileSync(file, 'utf8');
  if (!source.includes('<!-- mingrx-version:begin -->')) throw new Error('README version marker is missing');
  fs.writeFileSync(file, source.replace(/<!-- mingrx-version:begin -->[\s\S]*?<!-- mingrx-version:end -->/, versionBlock(version)));
  console.log(`Prepared Mingrx ${displayVersion(version)} (${version}). Update release notes and feature descriptions before publication.`);
}
module.exports = { normalize, displayVersion, nextVersion, checkDocuments };
if (require.main === module) {
  if (process.argv[2] === '--set') setVersion(process.argv[3]);
  else if (process.argv[2] === '--next') setVersion(nextVersion(require('../package.json').version));
  else if (process.argv[2] === '--check') checkDocuments();
  else throw new Error('Use --set VERSION, --next or --check.');
}
