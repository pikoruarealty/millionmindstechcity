# Lead Capture API Audit

Updated: 13 September 2026

## Current result

| Check | Result |
|---|---|
| Live `/api/request-otp` route | Reachable; rejects GET with 405 and invalid POST with 400 as expected |
| Live `/api/verify-otp` route | Reachable; rejects GET with 405 and invalid POST with 400 as expected |
| Live `/api/submit-lead` route | Reachable; the earlier valid production test returned HTTP 500 before Supabase recovery, and has not been repeated |
| Local environment-variable presence | All required variable names have non-empty local values; values were not printed |
| Local Brevo credential | Authenticated successfully with a read-only account request |
| Local Supabase connection after project recovery | `leads` and `otp_challenges` both return HTTP 200 with the configured server key |
| Mocked end-to-end integration test | Passed; now covers 2Factor rejection and Supabase-outage OTP guard |
| Real OTP delivery | Not triggered; requires an owner-approved controlled Indian phone number |

The earlier failed production test was labelled `API Health Check` and returned 500 while the Supabase project was paused. This result is historical, not evidence of a continuing production failure. The recovered local project now responds successfully; production write and OTP-delivery checks remain outstanding.

The OTP handler saves its challenge to Supabase before calling 2Factor, so recovery removes the previously observed local blocker. The live OTP route still responds to read-only requests, but neither that check nor the local table checks prove that the production Vercel environment can write or that SMS reaches a handset. Those require a controlled phone test and, if it fails, the Vercel function log reference.

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
- Reject 2Factor HTTP 200 replies unless the JSON explicitly reports a successful send status; test both provider rejection and missing status.

## Commands

```powershell
node scripts/test-lead-api.mjs
node scripts/check-lead-services.mjs
node scripts/validate-seo.mjs
```

## Remaining production verification

1. Confirm Vercel Production uses the recovered project's `SUPABASE_URL` and matching server-only `SUPABASE_SERVICE_ROLE_KEY`.
2. Confirm `supabase/schema.sql` has been applied in that project, and the latest GitHub commit is deployed.
3. With an approved test phone, request an OTP, complete verification, and confirm `verified_at` is populated in `public.leads`.
4. If the request fails, use the response reference and timestamp to inspect the Vercel function logs; if it reports success but SMS does not arrive, check the 2Factor delivery report, credits, and approved template.
5. Submit one contact test and confirm the row in `public.leads` plus the admin email.

Never paste production secrets into documentation, browser JavaScript, source control or chat. Configure them directly in the hosting provider's encrypted environment-variable settings.
