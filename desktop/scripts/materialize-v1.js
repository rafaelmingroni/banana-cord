const fs = require('fs');
const path = require('path');
const https = require('https');

const root = path.resolve(__dirname, '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'v1-blob-manifest.json'), 'utf8'));
const repo = process.env.GITHUB_REPOSITORY || 'rafaelmingroni/banana-cord';

function getBlob(sha) {
  return new Promise((resolve, reject) => {
    const headers = {
      'User-Agent': 'BananaCord-v1-materializer',
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
    if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    const req = https.get(`https://api.github.com/repos/${repo}/git/blobs/${sha}`, { headers }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`GitHub blob ${sha}: HTTP ${res.statusCode} ${body.slice(0, 200)}`));
        try {
          const data = JSON.parse(body);
          resolve(Buffer.from(String(data.content || '').replace(/\s/g, ''), data.encoding || 'base64'));
        } catch (err) { reject(err); }
      });
    });
    req.on('error', reject);
  });
}

(async () => {
  for (const item of manifest.files) {
    const target = path.join(root, item.path);
    if (item.delete) {
      try { fs.unlinkSync(target); } catch {}
      console.log(`deleted ${item.path}`);
      continue;
    }
    const bytes = await getBlob(item.sha);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
    console.log(`materialized ${item.path} (${bytes.length} bytes)`);
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});
