# Lead Capture API Audit

Updated: 12 September 2026

## Current result

| Check | Result |
|---|---|
| Live `/api/request-otp` route | Reachable; rejects GET with 405 and invalid POST with 400 as expected |
| Live `/api/verify-otp` route | Reachable; rejects GET with 405 and invalid POST with 400 as expected |
| Live `/api/submit-lead` route | Reachable, but a valid production test returned HTTP 500 |
| Local environment-variable presence | All required variable names have non-empty local values; values were not printed |
| Local Brevo credential | Authenticated successfully with a read-only account request |
| Local Supabase URL | Valid HTTPS and hosted-domain format, but DNS lookup returns `ENOTFOUND` |
| Mocked end-to-end integration test | Passed |
| Real OTP delivery | Not triggered; requires an owner-approved controlled Indian phone number |

The failed production test was labelled `API Health Check` and returned 500 before a successful capture response. Under the deployed implementation, an email failure after a successful database save would not return 500, so the failure points to production configuration or Supabase storage connectivity rather than the contact-form JavaScript.

## Fixes implemented locally

- Added a mocked integration test covering OTP request, OTP verification, verified lead storage, contact storage, Brevo notification, database-outage email fallback, rate-path behaviour, origin protection and method handling.
- Added same-origin protection to all three public lead endpoints.
- Decoupled contact-form capture from SMS-only configuration.
- Made contact lead storage redundant: Supabase and Brevo are attempted independently, and the request succeeds when either channel captures the enquiry.
- Added a safe short reference ID to unexpected 500 responses and matching Vercel logs.
- Added 15-second browser request timeouts and user-friendly timeout messages.
- Added a “Continue browsing” option only after OTP API failure so an infrastructure outage cannot permanently lock visitors out of the site.
- Added the lead integration test to the Vercel build command so API regressions block deployment.
- Added a read-only service diagnostic that never sends SMS and never creates lead data.

## Commands

```powershell
node scripts/test-lead-api.mjs
node scripts/check-lead-services.mjs
node scripts/validate-seo.mjs
```

## Required production repair

1. Authenticate or link this directory to the correct Vercel project.
2. In the Vercel Production environment, replace `SUPABASE_URL` with the URL of an active Supabase project.
3. Add the matching server-only `SUPABASE_SERVICE_ROLE_KEY` secret key.
4. Run `supabase/schema.sql` in that same project.
5. Redeploy so the API resilience and diagnostic-reference changes become live.
6. Run `node scripts/check-lead-services.mjs` until both tables return a successful status.
7. Submit one contact test and confirm the row in `public.leads` plus the admin email.
8. With an approved test phone, complete one OTP flow and confirm `verified_at` is populated.

Never paste production secrets into documentation, browser JavaScript, source control or chat. Configure them directly in the hosting provider's encrypted environment-variable settings.
