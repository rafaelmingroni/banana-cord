// Run only in the trusted deployment job. Never export users, password hashes,
// provider credentials, tokens, API keys, or authentication configuration bodies.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const base = path.join(root, 'desktop');
const { requireAuth } = require(path.join(base, 'node_modules/firebase-tools/lib/requireAuth'));
const { Client } = require(path.join(base, 'node_modules/firebase-tools/lib/apiv2'));
const project = require(path.join(base, 'cloud/firebase-config.js')).projectId;
const skipLog = { body: true, resBody: true, queryParams: true };
const report = { commit: process.env.GITHUB_SHA || null, checkedAt: new Date().toISOString(), auth: { status: 'unverified' }, firestore: { status: 'unverified' } };
const reportPath = path.join(base, 'backend-security-report.json');
const hash = source => crypto.createHash('sha256').update(source.replace(/\r\n/g, '\n').trim()).digest('hex');

(async () => {
  if (!process.env.FIREBASE_TOKEN || !project || project.startsWith('demo-')) throw new Error('Production Firebase deployment credentials and project are required.');
  await requireAuth({ project, token: process.env.FIREBASE_TOKEN });
  const auth = new Client({ urlPrefix: 'https://identitytoolkit.googleapis.com', auth: true });
  const configPath = `/admin/v2/projects/${project}/config`;
  const options = { headers: { 'x-goog-user-project': project }, skipLog };
  try {
    let config = (await auth.get(configPath, options)).body;
    if (config.emailPrivacyConfig?.enableImprovedEmailPrivacy !== true && process.argv.includes('--apply')) {
      await auth.patch(configPath, { emailPrivacyConfig: { enableImprovedEmailPrivacy: true } }, {
        ...options, queryParams: { updateMask: 'emailPrivacyConfig' }
      });
      config = (await auth.get(configPath, options)).body;
    }
    report.auth = {
      status: config.emailPrivacyConfig?.enableImprovedEmailPrivacy === true ? 'verified' : 'needs-configuration',
      emailEnumerationProtection: config.emailPrivacyConfig?.enableImprovedEmailPrivacy === true,
      emailPasswordEnabled: config.signIn?.email?.enabled === true,
      recaptchaEmailPasswordEnforcement: config.recaptchaConfig?.emailPasswordEnforcementState || 'not-configured'
    };
  } catch {
    report.auth = { status: 'needs-console-verification', reason: 'The deployment identity could not read or update Authentication security settings. No settings were assumed active.' };
    console.warn('Authentication security settings need Firebase console verification; Firestore publication is checked independently.');
  }
  if (process.argv.includes('--verify-rules')) {
    const rules = new Client({ urlPrefix: 'https://firebaserules.googleapis.com', apiVersion: 'v1', auth: true });
    const release = (await rules.get(`projects/${project}/releases/cloud.firestore`, { skipLog })).body;
    const deployed = (await rules.get(release.rulesetName, { skipLog })).body;
    const contents = deployed.source?.files || [];
    if (contents.length !== 1 || hash(contents[0].content || '') !== hash(fs.readFileSync(path.join(root, 'firebase/firestore.rules'), 'utf8'))) {
      throw new Error('Deployed Firestore authorization does not match the tested rules. Release must remain a draft.');
    }
    report.firestore = { status: 'verified', sourceSha256: hash(contents[0].content) };
  }
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
})().catch(() => {
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.error('Backend security verification could not complete. Release must remain a draft; inspect deployment access and rules.');
  process.exitCode = 1;
});
