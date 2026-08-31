# Supabase setup: private lead storage

Supabase is used only by Vercel server functions. It is not connected directly from `index.html`.

1. Create a Supabase project.
2. In **SQL Editor**, run [schema.sql](supabase/schema.sql).
3. In **Project Settings → API**, copy the project URL and a server-only **Secret key** (`sb_secret_…`). A legacy `service_role` JWT also works if your project still uses legacy keys.
4. Add these values in **Vercel → Project → Settings → Environment Variables** for Production, Preview and Development:

   ```env
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=sb_secret_your-server-only-supabase-secret-key
   ```

5. Keep both values out of `index.html`, Git, and client-side JavaScript. Do not use the publishable/anon key for this integration.

The schema enables RLS and removes `anon` and `authenticated` access from both `leads` and `otp_challenges`. The server secret bypasses RLS, which is why it must remain in Vercel only. The application sends new `sb_secret_…` keys only in Supabase's server-side `apikey` header; it never puts them in browser code.

After deployment, leads are stored in `public.leads`:

- OTP-gated leads have `verified_at` populated.
- Contact-form leads have `verified_at` empty.
- `ip_hash` is a keyed one-way hash, not the raw IP address.

OTP data is held in `public.otp_challenges` only for validation; use the commented cleanup statement in [schema.sql](supabase/schema.sql) in a scheduled process to delete expired rows after your chosen retention window.
