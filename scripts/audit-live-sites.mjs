import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OUTPUT = path.join(ROOT, 'seo', 'live-crawl-audit.json');
const SITES = [
  { key: 'in', origin: 'https://www.millionmindstechcity.in' },
  { key: 'com', origin: 'https://www.millionmindstechcity.com' },
];
const USER_AGENT = 'MillionMindsOwnedSitesAudit/1.0 (+https://www.millionmindstechcity.in/)';

function cleanText(value = '') {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:amp|#38);/gi, '&')
    .replace(/&(?:quot|#34);/gi, '"')
    .replace(/&(?:apos|#39);/gi, "'")
    .replace(/&(?:nbsp|#160);/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function attrTag(html, tagName, attrName, attrValue, resultAttr) {
  for (const match of html.matchAll(new RegExp(`<${tagName}\\b([^>]*)>`, 'gi'))) {
    const attrs = match[1];
    const selector = attrs.match(new RegExp(`\\b${attrName}=["']([^"']*)["']`, 'i'))?.[1];
    if (selector?.toLowerCase() !== attrValue.toLowerCase()) continue;
    return attrs.match(new RegExp(`\\b${resultAttr}=["']([^"']*)["']`, 'i'))?.[1] || '';
  }
  return '';
}

function schemaTypes(value, output = new Set()) {
  if (Array.isArray(value)) value.forEach((item) => schemaTypes(item, output));
  else if (value && typeof value === 'object') {
    const type = value['@type'];
    if (typeof type === 'string') output.add(type);
    if (Array.isArray(type)) type.filter((item) => typeof item === 'string').forEach((item) => output.add(item));
    Object.values(value).forEach((item) => schemaTypes(item, output));
  }
  return output;
}

function extractHtmlSignals(html, finalUrl) {
  const title = cleanText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  const description = attrTag(html, 'meta', 'name', 'description', 'content');
  const canonical = attrTag(html, 'link', 'rel', 'canonical', 'href');
  const robots = attrTag(html, 'meta', 'name', 'robots', 'content');
  const ogTitle = attrTag(html, 'meta', 'property', 'og:title', 'content');
  const ogDescription = attrTag(html, 'meta', 'property', 'og:description', 'content');
  const ogImage = attrTag(html, 'meta', 'property', 'og:image', 'content');
  const twitterCard = attrTag(html, 'meta', 'name', 'twitter:card', 'content');
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => cleanText(match[1]));
  const h2Count = (html.match(/<h2\b/gi) || []).length;
  const imageCount = (html.match(/<img\b/gi) || []).length;
  const lazyImageCount = (html.match(/<img\b[^>]*\bloading=["']lazy["']/gi) || []).length;
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || '';
  const bodyText = cleanText(body);
  const jsonLdTypes = new Set();
  const jsonLdErrors = [];
  let jsonLdBlocks = 0;
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    jsonLdBlocks += 1;
    try { schemaTypes(JSON.parse(match[1]), jsonLdTypes); }
    catch (error) { jsonLdErrors.push(error.message); }
  }
  const links = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["']/gi)) {
    try { links.push(new URL(match[1], finalUrl).href); } catch {}
  }
  const fingerprintText = bodyText.toLowerCase().replace(/\b\d+[\d,.]*\b/g, '#');
  return {
    title,
    title_length: title.length,
    description,
    description_length: description.length,
    canonical,
    robots,
    h1: h1s,
    h1_count: h1s.length,
    h2_count: h2Count,
    word_count: bodyText ? bodyText.split(/\s+/).length : 0,
    og_title: ogTitle,
    og_description: ogDescription,
    og_image: ogImage,
    twitter_card: twitterCard,
    json_ld_blocks: jsonLdBlocks,
    schema_types: [...jsonLdTypes].sort(),
    json_ld_errors: jsonLdErrors,
    image_count: imageCount,
    lazy_image_count: lazyImageCount,
    link_count: links.length,
    links: [...new Set(links)].sort(),
    lang: html.match(/<html\b[^>]*lang=["']([^"']*)/i)?.[1] || '',
    favicon: attrTag(html, 'link', 'rel', 'icon', 'href') || attrTag(html, 'link', 'rel', 'shortcut icon', 'href'),
    text_fingerprint: createHash('sha256').update(fingerprintText).digest('hex'),
  };
}

async function fetchText(url, options = {}) {
  const started = Date.now();
  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'user-agent': USER_AGENT, accept: options.accept || '*/*' },
    signal: AbortSignal.timeout(30000),
    method: options.method || 'GET',
  });
  const text = options.method === 'HEAD' ? '' : await response.text();
  return {
    response,
    text,
    duration_ms: Date.now() - started,
  };
}

function sitemapUrls(xml) {
  return [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((match) => cleanText(match[1]));
}

async function discover(site) {
  const robotsUrl = site.origin + '/robots.txt';
  let robots = '';
  let sitemapUrl = site.origin + '/sitemap.xml';
  try {
    const fetched = await fetchText(robotsUrl, { accept: 'text/plain' });
    robots = fetched.text;
    const declared = robots.match(/^\s*sitemap\s*:\s*(\S+)/im)?.[1];
    if (declared) sitemapUrl = declared;
  } catch {}
  const pending = [sitemapUrl];
  const seenSitemaps = new Set();
  const urls = new Set([site.origin + '/']);
  while (pending.length) {
    const current = pending.shift();
    if (seenSitemaps.has(current)) continue;
    seenSitemaps.add(current);
    try {
      const fetched = await fetchText(current, { accept: 'application/xml,text/xml' });
      for (const loc of sitemapUrls(fetched.text)) {
        if (/\.xml(?:$|[?#])/i.test(loc)) pending.push(loc);
        else urls.add(loc);
      }
    } catch {}
  }
  return { robots_url: robotsUrl, robots, sitemap_urls: [...seenSitemaps], urls: [...urls].sort() };
}

async function crawlUrl(url) {
  const isDocument = /\.(?:pdf|docx?|xlsx?|pptx?)(?:$|[?#])/i.test(url);
  try {
    const fetched = await fetchText(url, { method: isDocument ? 'HEAD' : 'GET', accept: isDocument ? '*/*' : 'text/html,application/xhtml+xml' });
    const { response, text, duration_ms: durationMs } = fetched;
    const contentType = response.headers.get('content-type') || '';
    const record = {
      requested_url: url,
      final_url: response.url,
      status: response.status,
      redirected: response.url !== url,
      content_type: contentType,
      content_length_header: Number(response.headers.get('content-length') || 0),
      html_bytes: text ? Buffer.byteLength(text) : 0,
      duration_ms: durationMs,
      x_robots_tag: response.headers.get('x-robots-tag') || '',
      cache_control: response.headers.get('cache-control') || '',
    };
    if (contentType.includes('text/html') || (!isDocument && text.includes('<html'))) Object.assign(record, extractHtmlSignals(text, response.url));
    return record;
  } catch (error) {
    return { requested_url: url, status: 0, error: error.message };
  }
}

async function mapLimit(items, limit, fn) {
  const output = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return output;
}

function internalHtmlCandidate(link, site) {
  try {
    const url = new URL(link);
    const expectedHost = new URL(site.origin).hostname.replace(/^www\./, '');
    if (url.hostname.replace(/^www\./, '') !== expectedHost) return null;
    url.hash = '';
    url.search = '';
    if (/\/(?:assets|static|api)\//i.test(url.pathname)) return null;
    const extension = path.posix.extname(url.pathname).toLowerCase();
    if (extension && extension !== '.html' && extension !== '.htm') return null;
    return url.href;
  } catch {
    return null;
  }
}

async function crawlSite(site, discovery) {
  const sitemapSet = new Set(discovery.urls);
  const records = new Map();
  let pending = [...discovery.urls];
  while (pending.length && records.size < 300) {
    const batch = pending.splice(0, Math.min(40, 300 - records.size));
    const crawled = await mapLimit(batch, 4, crawlUrl);
    for (const page of crawled) records.set(page.requested_url, page);
    const next = new Set();
    for (const page of crawled) {
      for (const link of page.links || []) {
        const candidate = internalHtmlCandidate(link, site);
        if (candidate && !records.has(candidate) && !pending.includes(candidate)) next.add(candidate);
      }
    }
    pending.push(...next);
  }
  return [...records.values()].map((page) => ({ ...page, sitemap_listed: sitemapSet.has(page.requested_url) }));
}

const result = { generated_at: new Date().toISOString(), sites: {} };
for (const site of SITES) {
  const discovery = await discover(site);
  const pages = await crawlSite(site, discovery);
  result.sites[site.key] = { ...site, ...discovery, pages };
  const htmlPages = pages.filter((page) => page.title !== undefined);
  const discoveredCount = pages.filter((page) => !page.sitemap_listed).length;
  console.log(`[crawl] ${site.key}: ${discovery.urls.length} sitemap URLs, ${htmlPages.length} HTML pages, ${discoveredCount} additional internal URLs`);
}

await mkdir(path.dirname(OUTPUT), { recursive: true });
await writeFile(OUTPUT, JSON.stringify(result, null, 2) + '\n', 'utf8');
console.log(`[crawl] wrote ${path.relative(ROOT, OUTPUT)}`);
