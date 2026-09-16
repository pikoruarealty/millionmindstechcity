# SEO Deployment Checklist

## Before deployment

- Run `node scripts/generate-seo-pages.mjs`.
- Run `node scripts/apply-seo.mjs`.
- Run `node scripts/validate-seo.mjs` and resolve every failure.
- Confirm the preferred host is `https://www.millionmindstechcity.in` and non-www redirects to www.
- Confirm the homepage H1 and factual text appear before the enquiry/OTP form in source order.
- Confirm no core content requires a click, scroll, OTP or login.
- Confirm `robots.txt`, `sitemap.xml`, `llms.txt` and the IndexNow key file return HTTP 200.
- Confirm `/site-index` returns HTTP 200 and links to every canonical indexable page.
- Confirm the sitemap contains only self-canonical, indexable `https://www.millionmindstechcity.in` URLs with no duplicates.
- Confirm no verified crawler receives a CAPTCHA, JavaScript challenge, 403 or accidental 429. Validate bots by hosting-provider verified-bot controls or published IP/rDNS methods, not user-agent alone.

## Google Search Console submission order

1. Verify the Domain property for `millionmindstechcity.in` through DNS.
2. Confirm HTTPS and the www canonical host in URL Inspection.
3. Submit `https://www.millionmindstechcity.in/sitemap.xml`.
4. Inspect and request indexing for `/`.
5. Inspect `/office-space-ahmedabad` for the broad non-branded office-space cluster.
6. Inspect Address & Location.
7. Inspect Companies / Occupier Tracker.
8. Inspect M One.
9. Inspect Million Minds Office Space.
10. Inspect Developer, Specifications and SEZ.
11. Inspect `/site-index`, News and `/blog` after P0 routes pass live testing.
12. Review Page Indexing, canonical selection, Core Web Vitals, security and manual-action reports.
13. Monitor brand, Ahmedabad office, location, company, M One, leasing, SG Highway, GIFT corridor, IT park and GCC query groups.

## Bing Webmaster Tools submission order

1. Add and verify the `millionmindstechcity.in` property.
2. Submit `https://www.millionmindstechcity.in/sitemap.xml`.
3. Confirm the hosted IndexNow key file is reachable.
4. Run `node scripts/submit-indexnow.mjs --dry-run` and review changed URLs.
5. After deployment, run `node scripts/submit-indexnow.mjs` once for materially changed canonical pages.
6. Inspect homepage and P0 URLs.
7. Review crawl diagnostics, indexed pages and AI Performance/citation reporting where available.

## Validation after deployment

- Test every sitemap URL for HTTP 200, self-canonical and indexability.
- Validate JSON-LD with Schema.org Validator and Google Rich Results Test where applicable.
- Confirm title, description, OG URL and H1 match the metadata registry.
- Confirm invalid URLs return a genuine HTTP 404 using `404.html`.
- Check mobile usability, keyboard access and enquiry/OTP behaviour.
- Check LCP, INP and CLS in PageSpeed Insights and field data; targets are LCP ≤2.5s, INP ≤200ms and CLS ≤0.1 at p75.
- Track Google, Bing, ChatGPT, Perplexity and Copilot referral sources in analytics.
- Do not repeatedly request indexing for unchanged or low-quality pages.
