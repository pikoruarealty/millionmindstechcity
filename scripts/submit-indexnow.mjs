import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const HOST = 'www.millionmindstechcity.in';
const ORIGIN = 'https://' + HOST;
const KEY = '549bfa646efa3d6b27b972ecd260406f';
const KEY_LOCATION = ORIGIN + '/' + KEY + '.txt';
const STATE_FILE = path.join(ROOT, 'seo/indexnow-state.json');
const dryRun = process.argv.includes('--dry-run');
const forceAll = process.argv.includes('--all');

function routeFile(url) {
  const pathname = new URL(url).pathname.replace(/\/$/, '') || '/';
  if (pathname === '/') return path.join(ROOT, 'index.html');
  if (pathname === '/blog') return path.join(ROOT, 'blog/index.html');
  return path.join(ROOT, pathname.slice(1) + '.html');
}
function digest(content) { return createHash('sha256').update(content).digest('hex'); }

const sitemap = await readFile(path.join(ROOT, 'sitemap.xml'), 'utf8');
const urls = [...sitemap.matchAll(/<loc>(https:\/\/www\.millionmindstechcity\.in[^<]+)<\/loc>/g)].map(match => match[1]);
let previous = {};
try { previous = JSON.parse(await readFile(STATE_FILE, 'utf8')); } catch {}

const current = {};
for (const url of urls) current[url] = digest(await readFile(routeFile(url), 'utf8'));
const changed = urls.filter(url => forceAll || current[url] !== previous[url]);
const deleted = Object.keys(previous).filter(url => !current[url]);
const urlList = [...new Set([...changed, ...deleted])];

if (!urlList.length) {
  console.log('[indexnow] no materially changed canonical URLs');
  process.exit(0);
}
if (dryRun) {
  console.log('[indexnow] dry run; URLs that would be submitted:\n' + urlList.join('\n'));
  process.exit(0);
}

const response = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList })
});
if (!response.ok && response.status !== 202) throw new Error('IndexNow submission failed with HTTP ' + response.status);
await writeFile(STATE_FILE, JSON.stringify(current, null, 2) + '\n', 'utf8');
console.log('[indexnow] submitted ' + urlList.length + ' changed/deleted canonical URLs');
