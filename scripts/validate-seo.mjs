import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
async function files(dir = root, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await files(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}
function routeFor(file) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  if (rel === 'index.html') return '/';
  if (rel.endsWith('/index.html')) return '/' + rel.slice(0, -11);
  return '/' + rel.slice(0, -5);
}
const htmlFiles = (await files()).filter(file => !path.basename(file).startsWith('google'));
const routeMap = new Map(htmlFiles.map(file => [routeFor(file), file]));
const sitemap = await readFile(path.join(root, 'sitemap.xml'), 'utf8');
const metadataRegistry = JSON.parse(await readFile(path.join(root, 'seo/metadata.json'), 'utf8'));
const errors = [];
const titles = new Map();
const descriptions = new Map();
const h1Values = new Map();
const canonicals = new Map();
const primaryKeywords = new Map();
const incoming = new Map([...routeMap.keys()].map(route => [route, new Set()]));
const records = [];

function textOnly(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&[a-z0-9#]+;/gi, ' ').replace(/\s+/g, ' ').trim();
}
function decodeEntities(value) {
  return String(value || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&ndash;/g, '–').replace(/&mdash;/g, '—');
}
function schemaTypes(value, out = new Set()) {
  if (Array.isArray(value)) value.forEach(item => schemaTypes(item, out));
  else if (value && typeof value === 'object') {
    if (typeof value['@type'] === 'string') out.add(value['@type']);
    Object.values(value).forEach(item => schemaTypes(item, out));
  }
  return out;
}

for (const file of htmlFiles) {
  const route = routeFor(file); const html = await readFile(file, 'utf8');
  const noindex = /<meta[^>]+name=["']robots["'][^>]+noindex/i.test(html);
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  const desc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1]?.trim();
  const canonical = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)/i)?.[1];
  const h1s = (html.match(/<h1\b/gi) || []).length;
  const h1 = textOnly(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '');
  if (!title) errors.push(route + ': missing title');
  if (!noindex && !desc) errors.push(route + ': missing description');
  if (!noindex && !canonical) errors.push(route + ': missing canonical');
  if (h1s !== 1) errors.push(route + ': expected one H1, found ' + h1s);
  if (!noindex && !/property=["']og:title["']/i.test(html)) errors.push(route + ': missing og:title');
  if (!noindex && !/name=["']twitter:card["']/i.test(html)) errors.push(route + ': missing twitter card');
  if (!noindex && !/application\/ld\+json/i.test(html)) errors.push(route + ': missing JSON-LD');
  if (!noindex && !sitemap.includes('<loc>https://www.millionmindstechcity.in' + (route === '/' ? '/' : route) + '</loc>')) errors.push(route + ': missing from sitemap');
  if (!noindex && title) { if (titles.has(title)) errors.push(route + ': duplicate title with ' + titles.get(title)); else titles.set(title, route); }
  if (!noindex && desc) { if (descriptions.has(desc)) errors.push(route + ': duplicate description with ' + descriptions.get(desc)); else descriptions.set(desc, route); }
  if (!noindex && h1) { if (h1Values.has(h1)) errors.push(route + ': duplicate H1 with ' + h1Values.get(h1)); else h1Values.set(h1, route); }
  if (!noindex && canonical) { if (canonicals.has(canonical)) errors.push(route + ': duplicate canonical with ' + canonicals.get(canonical)); else canonicals.set(canonical, route); }
  const registry = metadataRegistry[route];
  if (!noindex && !registry) errors.push(route + ': missing metadata registry entry');
  if (!noindex && registry?.primary_keyword) { if (primaryKeywords.has(registry.primary_keyword)) errors.push(route + ': keyword-intent cannibalization with ' + primaryKeywords.get(registry.primary_keyword)); else primaryKeywords.set(registry.primary_keyword, route); }
  const pageSchemaTypes = new Set();
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { schemaTypes(JSON.parse(match[1]), pageSchemaTypes); } catch (error) { errors.push(route + ': invalid JSON-LD: ' + error.message); }
  }
  for (const match of html.matchAll(/<script(?![^>]*type=["']application\/ld\+json["'])(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { new Function(match[1]); } catch (error) { errors.push(route + ': inline script syntax error: ' + error.message); }
  }
  const outgoing = new Set();
  for (const match of html.matchAll(/href=["'](\/[^"'#?]*)/g)) {
    const href = match[1].replace(/\/$/, '') || '/';
    if (href.startsWith('/images/') || href.startsWith('/styles/') || href.startsWith('/api/')) continue;
    if (!routeMap.has(href) && href !== '/') errors.push(route + ': broken internal link ' + href);
    else if (href !== route) { outgoing.add(href); incoming.get(href)?.add(route); }
  }
  if (!noindex) {
    const bodyText = textOnly(html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || '');
    const lastmod = sitemap.match(new RegExp('<loc>https://www\\.millionmindstechcity\\.in' + (route === '/' ? '\\/' : route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) + '<\\/loc><lastmod>([^<]+)'))?.[1] || registry?.last_modified || '';
    records.push({ route, title: decodeEntities(title), desc: decodeEntities(desc), h1, canonical, words: bodyText ? bodyText.split(/\s+/).length : 0, schema: [...pageSchemaTypes].sort().join(', '), outgoing: outgoing.size, sourceCount: (html.match(/\bdata-source\b/gi) || []).length, lastmod, primary: registry?.primary_keyword || '', priority: registry?.priority || '', indexable: 'Yes' });
  }
}

for (const record of records) if (record.route !== '/' && (incoming.get(record.route)?.size || 0) === 0) errors.push(record.route + ': orphan page');

const reportHeader = '# SEO Route Audit Report\n\nGenerated: 1 September 2026  \nScope: canonical static HTML routes before production deployment. HTTP status is the expected static-host response and must be rechecked after deployment.\n\n';
const reportTable = '| URL | Expected HTTP | Indexable | Title (chars) | Meta description | H1 | Canonical | Primary keyword | Priority | Schema types | Words | Links in / out | Sources | Last modified | Sitemap |\n|---|---:|---|---|---|---|---|---|---|---|---:|---:|---:|---|---|\n' + records.sort((a,b) => a.route.localeCompare(b.route)).map(r => '| `' + r.route + '` | 200 | ' + r.indexable + ' | ' + r.title.replace(/\|/g, '\\|') + ' (' + r.title.length + ') | ' + r.desc.replace(/\|/g, '\\|') + ' | ' + r.h1.replace(/\|/g, '\\|') + ' | ' + r.canonical + ' | ' + r.primary + ' | ' + r.priority + ' | ' + r.schema.replace(/\|/g, '\\|') + ' | ' + r.words + ' | ' + (incoming.get(r.route)?.size || 0) + ' / ' + r.outgoing + ' | ' + r.sourceCount + ' | ' + r.lastmod + ' | Yes |').join('\n') + '\n\n## Automated flags\n\n' + (errors.length ? errors.map(error => '- ❌ ' + error).join('\n') : '- ✅ No duplicate titles, H1s or canonicals; no keyword-intent collisions, orphan pages, broken internal links, invalid JSON-LD or sitemap gaps detected.') + '\n';
await writeFile(path.join(root, 'SEO_AUDIT_REPORT.md'), reportHeader + reportTable, 'utf8');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('[validate-seo] ' + htmlFiles.length + ' HTML pages passed metadata, H1, schema, sitemap and internal-link checks');
}
