<div align="center">

![Million Minds Tech City Ahmedabad](docs/readme-hero.svg)

# Million Minds Tech City Ahmedabad

SEO-focused commercial real-estate website for Million Minds Tech City, M One, SG Highway office requirements and Ahmedabad business-location research.

[![Live Website](https://img.shields.io/badge/LIVE_WEBSITE-millionmindstechcity.in-18a779?style=for-the-badge)](https://www.millionmindstechcity.in/)
[![Project Website](https://img.shields.io/badge/PROJECT_WEBSITE-.com-2668b4?style=for-the-badge)](https://www.millionmindstechcity.com/)
[![Sitemap](https://img.shields.io/badge/SEO_SITEMAP-61_URLs-0d1b2e?style=for-the-badge)](https://www.millionmindstechcity.in/sitemap.xml)
[![Repository](https://img.shields.io/badge/GITHUB-REPOSITORY-24292f?style=for-the-badge&logo=github)](https://github.com/pikoruarealty/millionmindstechcity)

[Open live site](https://www.millionmindstechcity.in/) · [View sitemap](https://www.millionmindstechcity.in/sitemap.xml) · [SEO audit](SEO_AUDIT_REPORT.md) · [Keyword map](SEO_KEYWORD_MAP_2026.md) · [Deployment checklist](SEO_DEPLOYMENT_CHECKLIST.md)

</div>

> **Website status:** this repository currently presents `.in` as an independent real-estate information and leasing-assistance website operated by PIKORUA Realty. Do not remove that disclosure or claim official developer status unless the required authorization has been confirmed.

## Project overview

The site is a static, performance-oriented marketing and research platform with serverless lead-capture endpoints. It targets branded project searches and distinct commercial intents without generating duplicate, keyword-swapped location pages.

| Area | Current implementation |
|---|---|
| Primary SEO domain | [`www.millionmindstechcity.in`](https://www.millionmindstechcity.in/) |
| Project reference domain | [`www.millionmindstechcity.com`](https://www.millionmindstechcity.com/) |
| Canonical URLs | 61 indexable pages on `.in` |
| Utility pages | 404 and legacy redirect are intentionally `noindex` |
| Frontend | Static HTML, CSS and vanilla JavaScript |
| Lead capture | Five-second homepage popup, phone OTP and enquiry workflow |
| API | Vercel serverless functions in `api/` |
| Lead storage | Supabase |
| Email and OTP | Brevo and 2Factor |
| Hosting | Vercel configuration included; Netlify fallback included |
| SEO data | JSON metadata registry, XML sitemap, robots.txt and llms.txt |

## Live links

### Main experience

- [Homepage](https://www.millionmindstechcity.in/)
- [Office space at Million Minds Tech City](https://www.millionmindstechcity.in/million-minds-tech-city-office-space)
- [M One office tower](https://www.millionmindstechcity.in/m-one-million-minds-tech-city)
- [Project master plan](https://www.millionmindstechcity.in/million-minds-tech-city-master-plan)
- [Official brochure guide](https://www.millionmindstechcity.in/million-minds-tech-city-brochure)
- [Rent and availability guide](https://www.millionmindstechcity.in/million-minds-tech-city-rent)
- [Address and location](https://www.millionmindstechcity.in/million-minds-tech-city-address-location)
- [Companies and occupier tracker](https://www.millionmindstechcity.in/million-minds-tech-city-companies)
- [Specifications](https://www.millionmindstechcity.in/million-minds-tech-city-specifications)
- [Research and guides](https://www.millionmindstechcity.in/blog)

### Commercial search pages

- [Luxury office space in Ahmedabad](https://www.millionmindstechcity.in/luxury-office-space-ahmedabad)
- [Corporate office space in Ahmedabad](https://www.millionmindstechcity.in/corporate-office-space-ahmedabad)
- [Ready-to-move office space](https://www.millionmindstechcity.in/ready-to-move-office-space-ahmedabad)
- [Built-to-suit office space](https://www.millionmindstechcity.in/built-to-suit-office-space-ahmedabad)
- [Showroom space on SG Highway](https://www.millionmindstechcity.in/showroom-space-sg-highway-ahmedabad)
- [Retail space on SG Highway](https://www.millionmindstechcity.in/retail-space-sg-highway-ahmedabad)
- [GCC office space in Ahmedabad](https://www.millionmindstechcity.in/gcc-office-space-ahmedabad)

### Location research

- [Areas near Million Minds Tech City](https://www.millionmindstechcity.in/areas-near-million-minds-tech-city)
- [Near Nirma University](https://www.millionmindstechcity.in/localities/nirma-university-ahmedabad)
- [Vaishnodevi Circle](https://www.millionmindstechcity.in/localities/vaishnodevi-circle-ahmedabad)
- [Zundal](https://www.millionmindstechcity.in/localities/zundal-ahmedabad)
- [Chandkheda](https://www.millionmindstechcity.in/localities/chandkheda-ahmedabad)
- [Motera](https://www.millionmindstechcity.in/localities/motera-ahmedabad)
- [Gota](https://www.millionmindstechcity.in/localities/gota-ahmedabad)

## Homepage experience

The homepage includes:

- Responsive navigation and conversion CTAs
- Full-screen background hero video from [`hero_banner.mp4`](https://www.millionmindstechcity.com/assets/video/hero_banner.mp4)
- Muted autoplay, looping and `playsinline` mobile support
- Dark readability overlay and image poster fallback
- Reduced-motion fallback for accessibility
- Project facts, location, gallery, research hub and visible FAQs
- A lead-capture popup scheduled five seconds after homepage script start
- OTP verification before a lead is marked complete

The approved `.com` video origin is explicitly allowed by the Content Security Policy in both `vercel.json` and `netlify.toml`.

## SEO architecture

Every generated indexable page includes:

- Unique title, meta description and H1
- Self-referencing `.in` canonical
- Open Graph and Twitter metadata
- `WebSite`, `Organization`, `Place`, `WebPage` or `BlogPosting` JSON-LD
- `BreadcrumbList` schema
- Visible FAQs with matching `FAQPage` JSON-LD where applicable
- Contextual internal links and source references
- Sitemap and metadata-registry entries

The page generator reads the core route definitions plus [`seo/expansion-pages.json`](seo/expansion-pages.json). Generated landing-page HTML should be changed at the source level and regenerated so edits are not lost.

## Repository structure

```text
.
├── index.html                       # Homepage and lead popup
├── api/                             # OTP and lead serverless endpoints
├── blog/                            # Generated research articles
├── localities/                      # Generated locality guides
├── images/                          # Brand, gallery and social assets
├── styles/landing-pages.css         # Generated-page design system
├── seo/
│   ├── expansion-pages.json         # New page content and keyword targets
│   ├── metadata.json                # Canonical metadata registry
│   └── keyword-map.csv              # Route-to-keyword ownership
├── scripts/
│   ├── generate-seo-pages.mjs       # Generates pages, sitemap and maps
│   ├── apply-seo.mjs                # Applies shared SEO and favicon markup
│   └── validate-seo.mjs             # Runs technical SEO validation
├── supabase/schema.sql              # Lead database schema
├── robots.txt
├── sitemap.xml
├── llms.txt
├── vercel.json
└── netlify.toml
```

## Local development

No frontend framework or package installation is required. Use a local static server so clean URLs and relative assets behave consistently.

```powershell
cd C:\Users\pikor\Downloads\millionmindstechcity-1
npx --yes serve .
```

Then open the URL printed by the server. The serverless endpoints require a Vercel-compatible local or deployed environment and configured secrets.

## Generate and validate SEO pages

Run the complete build pipeline before every deployment:

```powershell
node scripts/generate-seo-pages.mjs
node scripts/apply-seo.mjs
node scripts/validate-seo.mjs
node scripts/test-lead-api.mjs
node scripts/check-lead-services.mjs
```

Expected result:

```text
[generate-seo-pages] generated 61 crawlable pages
[validate-seo] 63 HTML pages passed metadata, H1, schema, sitemap and internal-link checks
[test-lead-api] OTP request, verification, database and email capture, database-outage fallback, origin protection and method handling passed
```

The 63 checked files comprise 61 indexable URLs and two intentional `noindex` utility routes.

## Environment variables

Copy `.env.example` to `.env.local` for local serverless development. Never commit real credentials.

| Variable | Purpose |
|---|---|
| `BREVO_API_KEY` | Sends verified lead and enquiry email |
| `BREVO_SENDER_EMAIL` | Brevo-verified sender |
| `BREVO_SENDER_NAME` | Sender display name |
| `TWO_FACTOR_API_KEY` | Delivers OTP SMS |
| `SUPABASE_URL` | Supabase project endpoint |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only lead and OTP database access |
| `ADMIN_EMAIL` | Receives verified leads |
| `OTP_SECRET` | Minimum 32-character private OTP secret |
| `OTP_EXPIRES_MINUTES` | Optional OTP lifetime; defaults to five minutes |
| `REIP_MANIFEST_TOKEN` | Optional external SEO-manifest integration |

See [Vercel deployment](VERCEL_DEPLOYMENT.md) and [Supabase setup](SUPABASE_SETUP.md) for the complete backend setup.

## Production deployment

1. Add all required environment variables to the hosting project.
2. Run `supabase/schema.sql` in the correct Supabase project.
3. Confirm `www.millionmindstechcity.in` points to the production deployment.
4. Redirect apex `.in` to the HTTPS `www` canonical in one hop.
5. Run the SEO build and validation pipeline.
6. Deploy and verify the hero video, five-second homepage popup and OTP flow.
7. Confirm every sitemap URL returns HTTP 200 with the expected self-canonical.
8. Submit [`sitemap.xml`](https://www.millionmindstechcity.in/sitemap.xml) in Google Search Console and Bing Webmaster Tools.

The current high-priority live infrastructure issue is the apex `https://millionmindstechcity.in/` TLS failure. Fix the domain/certificate configuration so it redirects directly to the canonical `www` site.

## SEO operations

Use these project documents as the operating source of truth:

- [Automated route audit](SEO_AUDIT_REPORT.md)
- [61-page keyword map](SEO_KEYWORD_MAP_2026.md)
- [Dual-domain audit and ranking plan](DUAL_DOMAIN_SEO_AUDIT_AND_RANKING_PLAN_2026.md)
- [Competitor gap plan](COMPETITOR_SEO_GAP_PLAN_2026.md)
- [Deployment checklist](SEO_DEPLOYMENT_CHECKLIST.md)
- [Lead capture API audit](LEAD_CAPTURE_API_AUDIT.md)
- [Backlink outreach plan](BACKLINK_OUTREACH_PLAN.md)

Review Search Console and conversion performance every 28 days. Strengthen or consolidate overlapping pages based on query and lead evidence; do not create additional near-duplicate locality pages solely to increase URL count.

## Content and factual safeguards

- Keep the project location wording anchored to current primary documentation: behind Nirma University, off SG Highway, Ahmedabad.
- Treat nearby locality pages as commute and selection guides, not alternative project addresses.
- Do not publish live rates, availability, possession, certification or occupier status without dated evidence.
- Do not describe the project as being inside GIFT City.
- Preserve the independent-site disclosure until official authorization is documented.
- Rankings cannot be guaranteed; technical SEO, authority, content quality, indexation and user response work together.

## Security

- Never expose API, Supabase service-role or OTP secrets in browser code.
- Keep `.env.local` ignored by Git.
- Restrict CSP origins to services genuinely required by the site.
- Rotate any secret that is accidentally logged or committed.
- Validate and rate-limit all public lead endpoints.

## Maintainer

**PIKORUA Realty Research Desk**  
Website: [millionmindstechcity.in](https://www.millionmindstechcity.in/)  
Repository: [pikoruarealty/millionmindstechcity](https://github.com/pikoruarealty/millionmindstechcity)

---

<div align="center">
Built for accurate project research, qualified commercial enquiries and durable organic visibility.
</div>
