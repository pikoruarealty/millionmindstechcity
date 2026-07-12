// Applies REIP-approved SEO changes to the static site at build time.
//
// Runs as Netlify's build command (see netlify.toml). Two sources, both
// additive/safe by design (REIP never auto-applies anything with a price or
// RERA number — those stay pending for human review):
//   1. seo/metadata.json — REIP's copy PRs (title/meta description) land here.
//      Only fields actually present for a route are applied; nothing else in
//      the page is touched.
//   2. The REIP schema manifest (fetched over HTTPS using REIP_MANIFEST_TOKEN)
//      — approved JSON-LD blocks. Merged into <head> alongside any existing
//      hand-authored schema, never replacing it; exact-duplicate blocks are
//      skipped so repeat builds don't pile up copies.
//
// No dependencies beyond Node built-ins (this repo has no package.json/npm
// install step, so anything importable must ship with Node itself).

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const REIP_API_URL = process.env.REIP_API_URL ?? "https://reip-api-weyv.vercel.app";
const REIP_PROJECT_ID = process.env.REIP_PROJECT_ID ?? "288776dc-fcff-4746-a41e-51d23efb156a";
const REIP_MANIFEST_TOKEN = process.env.REIP_MANIFEST_TOKEN ?? "";

// Route ("/") -> the static HTML file that serves it. Add entries here as
// more pages come under REIP's management; unmapped routes are skipped.
const ROUTE_TO_FILE = {
  "/": "index.html",
};

async function readJsonSafe(relPath, fallback) {
  try {
    const raw = await readFile(path.join(ROOT, relPath), "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function fetchManifest() {
  if (!REIP_MANIFEST_TOKEN) {
    console.log("[apply-seo] REIP_MANIFEST_TOKEN not set — skipping schema injection.");
    return { pages: [] };
  }
  try {
    const res = await fetch(`${REIP_API_URL}/v1/projects/${REIP_PROJECT_ID}/seo-manifest`, {
      headers: { authorization: `Bearer ${REIP_MANIFEST_TOKEN}` },
    });
    if (!res.ok) {
      console.warn(`[apply-seo] manifest fetch failed: ${res.status} — continuing without schema.`);
      return { pages: [] };
    }
    const body = await res.json();
    return body.data ?? { pages: [] };
  } catch (err) {
    console.warn("[apply-seo] manifest fetch errored — continuing without schema:", err.message);
    return { pages: [] };
  }
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Replace <title>…</title> if a title is provided; leaves it alone otherwise. */
function applyTitle(html, title) {
  if (!title) return html;
  return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
}

/** Replace the meta description content if provided; leaves it alone otherwise. */
function applyMetaDescription(html, description) {
  if (!description) return html;
  return html.replace(
    /(<meta\s+name=["']description["']\s+content=)["'][\s\S]*?["']/i,
    `$1"${escapeHtml(description)}"`,
  );
}

/**
 * Append any JSON-LD blocks not already present (exact-match dedupe against
 * existing <script type="application/ld+json"> contents), right before
 * </head>. Never removes or rewrites existing schema.
 */
function appendSchema(html, jsonLdBlocks) {
  if (!jsonLdBlocks || jsonLdBlocks.length === 0) return html;

  const existingBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => {
      try {
        return JSON.stringify(JSON.parse(m[1]));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
  const existingSet = new Set(existingBlocks);

  const toAdd = jsonLdBlocks
    .map((block) => JSON.stringify(block))
    .filter((serialized) => !existingSet.has(serialized));

  if (toAdd.length === 0) return html;

  const scriptTags = toAdd
    .map((serialized) => `<script type="application/ld+json">\n${JSON.stringify(JSON.parse(serialized), null, 2)}\n</script>`)
    .join("\n");

  return html.replace(
    /<\/head>/i,
    `\n<!-- REIP: approved schema, auto-injected at build time -->\n${scriptTags}\n</head>`,
  );
}

async function applyToRoute(route, file, metadataForRoute, manifestPage) {
  const filePath = path.join(ROOT, file);
  let html;
  try {
    html = await readFile(filePath, "utf8");
  } catch {
    console.warn(`[apply-seo] ${file} not found for route ${route} — skipping.`);
    return;
  }

  let updated = html;
  if (metadataForRoute?.title) updated = applyTitle(updated, metadataForRoute.title);
  if (metadataForRoute?.meta_description) {
    updated = applyMetaDescription(updated, metadataForRoute.meta_description);
  }
  if (manifestPage?.json_ld) {
    updated = appendSchema(updated, manifestPage.json_ld);
  }

  if (updated !== html) {
    await writeFile(filePath, updated, "utf8");
    console.log(`[apply-seo] updated ${file} for route ${route}`);
  } else {
    console.log(`[apply-seo] no changes for route ${route}`);
  }
}

async function main() {
  const metadata = await readJsonSafe("seo/metadata.json", {});
  const manifest = await fetchManifest();
  const manifestByRoute = new Map((manifest.pages ?? []).map((p) => [p.path, p]));

  for (const [route, file] of Object.entries(ROUTE_TO_FILE)) {
    await applyToRoute(route, file, metadata[route], manifestByRoute.get(route));
  }
}

main().catch((err) => {
  // Never fail the deploy over an SEO-application error — the site as
  // generated is still valid and should ship. Log loudly instead.
  console.error("[apply-seo] unexpected error, continuing build unmodified:", err);
});
