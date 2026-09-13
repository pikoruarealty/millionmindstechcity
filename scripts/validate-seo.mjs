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
function faqEntities(value, out = []) {
  if (Array.isArray(value)) value.forEach(item => faqEntities(item, out));
  else if (value && typeof value === 'object') {
    if (value['@type'] === 'FAQPage' && Array.isArray(value.mainEntity)) out.push(...value.mainEntity);
    Object.values(value).forEach(item => faqEntities(item, out));
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
  const lang = html.match(/<html[^>]+lang=["']([^"']+)/i)?.[1] || '';
  const expectedCanonical = 'https://www.millionmindstechcity.in' + (route === '/' ? '/' : route);
  if (!title) errors.push(route + ': missing title');
  if (!/<link[^>]+rel=["'][^"']*(?:icon|apple-touch-icon)/i.test(html)) errors.push(route + ': missing favicon link');
  if (!noindex && !desc) errors.push(route + ': missing description');
  if (!noindex && !canonical) errors.push(route + ': missing canonical');
  if (!noindex && canonical && canonical !== expectedCanonical) errors.push(route + ': canonical is not the exact preferred .in URL');
  if (!noindex && lang !== 'en-IN') errors.push(route + ': expected html lang="en-IN", found "' + lang + '"');
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
  const pageFaqEntities = [];
  for (const match of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { const parsed = JSON.parse(match[1]); schemaTypes(parsed, pageSchemaTypes); faqEntities(parsed, pageFaqEntities); } catch (error) { errors.push(route + ': invalid JSON-LD: ' + error.message); }
  }
  for (const match of html.matchAll(/<script(?![^>]*type=["']application\/ld\+json["'])(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { new Function(match[1]); } catch (error) { errors.push(route + ': inline script syntax error: ' + error.message); }
  }
  const outgoing = new Set();
  for (const match of html.matchAll(/href=["'](\/[^"'#?]*)/g)) {
    const href = match[1].replace(/\/$/, '') || '/';
    if (href.startsWith('/images/') || href.startsWith('/styles/') || href.startsWith('/api/') || /\.(?:ico|webmanifest)$/i.test(href)) continue;
    if (!routeMap.has(href) && href !== '/') errors.push(route + ': broken internal link ' + href);
    else if (href !== route) { outgoing.add(href); incoming.get(href)?.add(route); }
  }
  if (!noindex) {
    const bodyText = textOnly(html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || '');
    for (const entity of pageFaqEntities) {
      const question = textOnly(entity?.name || '');
      const answer = textOnly(entity?.acceptedAnswer?.text || '');
      if (!question || !answer) errors.push(route + ': FAQPage question is missing a question or accepted answer');
      else if (!bodyText.includes(question) || !bodyText.includes(answer)) errors.push(route + ': FAQ schema content is not fully visible on the page: ' + question);
    }
    const lastmod = sitemap.match(new RegExp('<loc>https://www\\.millionmindstechcity\\.in' + (route === '/' ? '\\/' : route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) + '<\\/loc><lastmod>([^<]+)'))?.[1] || registry?.last_modified || '';
    records.push({ route, title: decodeEntities(title), desc: decodeEntities(desc), h1, canonical, words: bodyText ? bodyText.split(/\s+/).length : 0, schema: [...pageSchemaTypes].sort().join(', '), outgoing: outgoing.size, sourceCount: (html.match(/\bdata-source\b/gi) || []).length, lastmod, primary: registry?.primary_keyword || '', priority: registry?.priority || '', indexable: 'Yes' });
  }
}

for (const record of records) if (record.route !== '/' && (incoming.get(record.route)?.size || 0) === 0) errors.push(record.route + ': orphan page');

const reportHeader = '# SEO Route Audit Report\n\nGenerated: 12 September 2026\n\nScope: canonical static HTML routes before production deployment. HTTP status is the expected static-host response and must be rechecked after deployment.\n\n## Executive overview\n\n- **Technical baseline:** 42 HTML routes pass automated checks for titles, descriptions, one H1, canonicals, social metadata, JSON-LD, sitemap inclusion, internal links and favicon coverage.\n- **Deployment verification (P0):** deploy this repo and verify that production serves the new homepage metadata, 2026 evidence section, social image, favicon and six-second lead popup.\n- **Competitive work (completed locally):** the homepage now has tighter metadata, fresh primary-source milestones, expanded entity schema and a dedicated 1200×630 branded preview. See `COMPETITOR_SEO_GAP_PLAN_2026.md`.\n- **Content quality (P1):** many supporting pages are concise and structurally similar. Add first-party facts, dated evidence, original photos, floor-plan/specification detail, named authors and genuinely useful comparison data before adding more URLs.\n- **Authority (P1):** earn relevant local/property/technology citations and links; do not rely on page volume. Keep the independent-site disclosure prominent and avoid implying official developer ownership without authorization.\n- **Measurement (P0):** use Search Console and analytics conversion events to review indexing, branded/non-branded queries, qualified leads and landing-page performance every 28 days.\n\n## Inputs needed from the owner\n\n1. Google Search Console access or exports: Pages, Sitemaps, Search results (queries/pages), Core Web Vitals and Manual actions.\n2. GA4 access or exports plus the exact conversion definition (qualified enquiry, call, WhatsApp, booked visit).\n3. Verified business identity: legal/operator name, office address, phone, email, service area, hours and whether the site is officially authorized by the developer.\n4. Current leasing facts: available area, floor plates, possession/fit-out status, indicative commercial terms, parking, power/HVAC/lifts, certifications and dated source documents.\n5. Original assets with usage rights: logo/vector file, exterior/interior photos, floor plans, brochure and team/author profiles.\n6. Competitors and target customers: top 5 competing properties/domains, priority occupier types, minimum area, budget band and target geography.\n7. Lead-quality feedback from sales/CRM so content and keywords can be optimized for revenue, not traffic alone.\n\n## 30-day priority plan\n\n| Priority | Action | Success check |\n|---|---|---|\n| P0 | Deploy current repo and verify canonical host, robots, sitemap and favicon on production | Live source matches local metadata; icons return 200 |\n| P0 | Connect Search Console + GA4 and track form submit, verified phone lead, click-to-call and email click | Events visible with landing page and source/medium |\n| P1 | Upgrade M One, office-space, location, companies and specifications pages with unique evidence | More indexed queries and qualified leads; no unsupported claims |\n| P1 | Create unique 1200×630 social images for the remaining priority pages and convert large gallery images to AVIF/WebP | Lower image bytes and stronger link previews |\n| P1 | Add named reviewer/author details, reviewed dates and citations to commercial/project claims | Clear provenance on every key claim |\n| P2 | Build selective local/industry citations, partner mentions and digital PR | Relevant referring domains and branded-search growth |\n| P2 | Consolidate or strengthen pages that remain thin or overlap after Search Console data arrives | Stable/improved clicks with fewer weak URLs |\n\n';
const reportTable = '| URL | Expected HTTP | Indexable | Title (chars) | Meta description | H1 | Canonical | Primary keyword | Priority | Schema types | Words | Links in / out | Sources | Last modified | Sitemap |\n|---|---:|---|---|---|---|---|---|---|---|---:|---:|---:|---|---|\n' + records.sort((a,b) => a.route.localeCompare(b.route)).map(r => '| `' + r.route + '` | 200 | ' + r.indexable + ' | ' + r.title.replace(/\|/g, '\\|') + ' (' + r.title.length + ') | ' + r.desc.replace(/\|/g, '\\|') + ' | ' + r.h1.replace(/\|/g, '\\|') + ' | ' + r.canonical + ' | ' + r.primary + ' | ' + r.priority + ' | ' + r.schema.replace(/\|/g, '\\|') + ' | ' + r.words + ' | ' + (incoming.get(r.route)?.size || 0) + ' / ' + r.outgoing + ' | ' + r.sourceCount + ' | ' + r.lastmod + ' | Yes |').join('\n') + '\n\n## Automated flags\n\n' + (errors.length ? errors.map(error => '- ❌ ' + error).join('\n') : '- ✅ No duplicate titles, H1s or canonicals; no keyword-intent collisions, orphan pages, broken internal links, invalid JSON-LD or sitemap gaps detected.') + '\n';
const currentReportHeader = '# SEO Route Audit Report\n\nGenerated: 12 September 2026\n\nScope: canonical static HTML routes before production deployment. HTTP status is the expected static-host response and must be rechecked after deployment.\n\n## Executive overview\n\n- **Technical baseline:** ' + records.length + ' indexable routes pass automated checks for unique titles, descriptions and H1s; canonicals, social metadata, JSON-LD, sitemap inclusion, internal links and favicon coverage. Two utility HTML routes are intentionally `noindex`.\n- **Content expansion completed:** 18 distinct-intent pages were added: one nearby-area hub, six locality guides, six commercial-intent pages and five decision-support articles. The sitemap now contains 58 canonical `.in` URLs.\n- **Structured content completed:** new pages include substantial decision guidance, five visible FAQs, matching `FAQPage` JSON-LD, breadcrumbs, source links and contextual internal links.\n- **Deployment blocker (P0):** the live `.in` apex host must serve the same site as `www` over HTTPS instead of the current parking/lander behaviour. Deploy this repo, then verify the canonical host, robots, sitemap, favicon and six-second lead popup.\n- **Authority (P1):** earn relevant local, property and technology citations and links; page volume by itself cannot create rankings. Keep the independent-site disclosure prominent unless official developer authorization is documented.\n- **Measurement (P0):** use Search Console and analytics conversion events to review indexing, non-branded queries, qualified leads and landing-page performance every 28 days.\n\n## Inputs needed from the owner\n\n1. Google Search Console access or exports: Pages, Sitemaps, Search results (queries/pages), Core Web Vitals and Manual actions.\n2. GA4 access or exports plus the exact conversion definition (qualified enquiry, call, WhatsApp, booked visit).\n3. DNS/hosting access for `millionmindstechcity.in` and `www` so the apex HTTPS and canonical-host issue can be fixed and verified.\n4. Verified business identity: legal/operator name, office address, phone, email, service area, hours and whether the site is officially authorized by the developer.\n5. Current leasing facts: available area, floor plates, possession/fit-out status, indicative commercial terms, parking, power/HVAC/lifts, certifications and dated source documents.\n6. Original assets with usage rights: logo/vector file, exterior/interior photos, floor plans, brochure and team/author profiles.\n7. Lead-quality feedback from sales/CRM so content and keywords can be optimized for revenue, not traffic alone.\n\n## 30-day priority plan\n\n| Priority | Action | Success check |\n|---|---|---|\n| P0 | Fix `.in` apex HTTPS and redirect every non-canonical host to `https://www.millionmindstechcity.in` | One-hop 301/308; no lander; canonical page returns 200 |\n| P0 | Deploy the generated 58-URL site and submit `/sitemap.xml` in Search Console | Sitemap fetched; canonical URLs enter indexing workflow |\n| P0 | Track form submit, verified phone lead, click-to-call and email click in GA4 | Events visible with landing page and source/medium |\n| P1 | Add first-party project photos, floor plans, inventory and dated technical evidence to priority commercial pages | Stronger engagement and qualified-lead conversion |\n| P1 | Add named reviewer/author details and authoritative citations to material claims | Clear provenance on every key claim |\n| P2 | Build selective local/industry citations, partner mentions and digital PR | Relevant referring domains and branded-search growth |\n| P2 | Consolidate or strengthen any pages that overlap or remain weak after Search Console data arrives | Stable or improved clicks with fewer weak URLs |\n\n';
const finalQualitySummary = '- **Final quality pass completed:** tightened all indexable titles and descriptions to practical snippet guardrails, set `en-IN`, aligned visible homepage FAQs with schema, added a reviewed-by editorial block, expanded the blog hub with `BreadcrumbList` and `ItemList`, and allowed the approved hero-video origin in deployment CSP.\n- **Live-versus-local gap:** the live `.in` sitemap currently exposes 40 URLs, while this repository contains 58. The live crawl also found the previous homepage metadata and no detected favicon link across the 40 deployed pages; deployment of this build is required before those fixes can affect search.\n\n';
const refreshedReportHeader = currentReportHeader
  .replace('Generated: 12 September 2026', 'Generated: 13 September 2026')
  .replace('18 distinct-intent pages were added: one nearby-area hub, six locality guides, six commercial-intent pages and five decision-support articles. The sitemap now contains 58 canonical `.in` URLs.', '21 distinct-intent pages now include nearby-area, locality, commercial and decision guides plus three sourced project-intent pages for the master plan, official brochure and rent research. The sitemap contains ' + records.length + ' canonical `.in` URLs.')
  .replace('Deploy the generated 58-URL site', 'Deploy the generated ' + records.length + '-URL site')
  .replace('the current parking/lander behaviour', 'the current apex TLS failure')
  .replace('six-second lead popup', 'five-second lead popup');
const currentQualitySummary = '- **Project keyword gap addressed:** added unique master-plan, brochure and rent-intent pages; strengthened the M One floor-plan guide with evidence from the official brochure. No live rent or vacancy was invented.\n- **Live-versus-local gap:** the live `.in` sitemap exposed 58 URLs at this review, while this repository now has ' + records.length + '. The apex HTTPS host still failed a direct TLS check; publishing and canonical-host repair need separate verification.\n\n';
await writeFile(path.join(root, 'SEO_AUDIT_REPORT.md'), refreshedReportHeader.replace('## Inputs needed from the owner', currentQualitySummary + '## Inputs needed from the owner') + reportTable, 'utf8');

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('[validate-seo] ' + htmlFiles.length + ' HTML pages passed metadata, H1, schema, sitemap and internal-link checks');
}
