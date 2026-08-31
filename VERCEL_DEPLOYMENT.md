# Vercel + Brevo setup

Add these Environment Variables in **Vercel → Project → Settings → Environment Variables** for Production, Preview, and Development:

- `BREVO_API_KEY`: Brevo API v3 key (not an SMTP key).
- `BREVO_SENDER_EMAIL`: a sender/domain verified in Brevo.
- `BREVO_SENDER_NAME`: display name for lead emails.
- `TWO_FACTOR_API_KEY`: 2Factor API key used only by the server to deliver OTP SMS.
- `SUPABASE_URL`: your Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase Secret key (`sb_secret_…`) used to save leads and OTP state; a legacy service-role JWT is also supported.
- `ADMIN_EMAIL`: inbox that receives every verified lead and contact enquiry.
- `OTP_SECRET`: a private random value of at least 32 characters.
- `OTP_EXPIRES_MINUTES`: optional; defaults to 5 and is restricted to 2–10.
- `REIP_MANIFEST_TOKEN`: optional; only needed if you want the external REIP schema/sitemap sync at build time.

Before going live, enable Transactional Email in Brevo and verify the sender email/domain. In 2Factor, create the required Indian DLT-compliant OTP template, add SMS credits and generate the API key.

Deploy the repository to Vercel normally. The static site is served from the root and files in `api/` become `/api/request-otp`, `/api/verify-otp`, and `/api/submit-lead` functions.

Before deployment, run [supabase/schema.sql](supabase/schema.sql) in Supabase SQL Editor. See [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for the required RLS and secret-handling steps.

Never put the real values from `.env.example` inside `index.html` or commit a real `.env` file. The public page can see endpoint URLs such as `/api/request-otp`, but it can never see the provider keys or server-side API source.
