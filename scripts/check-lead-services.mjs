import { readFile } from 'node:fs/promises';

const env = {};
for (const line of (await readFile('.env.local', 'utf8')).split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (!match) continue;
  env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
}

const required = ['OTP_SECRET', 'TWO_FACTOR_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'BREVO_API_KEY', 'BREVO_SENDER_EMAIL', 'ADMIN_EMAIL'];
const missing = required.filter(key => !env[key]);
if (missing.length) {
  console.error('[check-lead-services] missing local variables: ' + missing.join(', '));
  process.exitCode = 1;
} else {
  console.log('[check-lead-services] required local variables are present');
}

if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  let supabaseUrlValid = false;
  try {
    const parsed = new URL(env.SUPABASE_URL);
    supabaseUrlValid = parsed.protocol === 'https:' && Boolean(parsed.hostname);
    console.log(`[check-lead-services] Supabase hosted-domain format: ${parsed.hostname.endsWith('.supabase.co') ? 'recognized' : 'custom or unrecognized'}`);
  } catch {}
  console.log(`[check-lead-services] Supabase URL format: ${supabaseUrlValid ? 'valid HTTPS URL' : 'invalid'}`);
  console.log(`[check-lead-services] Supabase key format: ${key.startsWith('sb_secret_') ? 'secret key' : key.split('.').length === 3 ? 'legacy service-role JWT' : 'unrecognized'}`);
  const headers = { apikey: key, 'user-agent': 'MillionMinds-ConfigCheck/1.0' };
  if (!key.startsWith('sb_')) headers.Authorization = `Bearer ${key}`;
  for (const table of ['leads', 'otp_challenges']) {
    try {
      const response = await fetch(`${env.SUPABASE_URL.replace(/\/$/, '')}/rest/v1/${table}?select=id&limit=0`, { method: 'HEAD', headers });
      console.log(`[check-lead-services] Supabase ${table}: ${response.status} ${response.ok ? 'reachable' : 'failed'}`);
      if (!response.ok) process.exitCode = 1;
    } catch (error) {
      const code = error?.cause?.code || error?.name || 'unknown';
      console.log(`[check-lead-services] Supabase ${table}: network error (${code})`);
      process.exitCode = 1;
    }
  }
}

if (env.BREVO_API_KEY) {
  try {
    const response = await fetch('https://api.brevo.com/v3/account', { headers: { accept: 'application/json', 'api-key': env.BREVO_API_KEY } });
    console.log(`[check-lead-services] Brevo account API: ${response.status} ${response.ok ? 'authenticated' : 'failed'}`);
    if (!response.ok) process.exitCode = 1;
  } catch {
    console.log('[check-lead-services] Brevo account API: network error');
    process.exitCode = 1;
  }
}

console.log('[check-lead-services] No SMS was sent and no lead data was created');
