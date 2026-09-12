import assert from 'node:assert/strict';

process.env.OTP_SECRET = 'test-only-secret-that-is-longer-than-thirty-two-characters';
process.env.TWO_FACTOR_API_KEY = 'test-2factor-key';
process.env.SUPABASE_URL = 'https://test-project.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test_only';
process.env.BREVO_API_KEY = 'test-brevo-key';
process.env.BREVO_SENDER_EMAIL = 'verified@example.com';
process.env.BREVO_SENDER_NAME = 'Million Minds Test';
process.env.ADMIN_EMAIL = 'admin@example.com';

const { default: requestOtp } = await import('../api/request-otp.mjs');
const { default: verifyOtp } = await import('../api/verify-otp.mjs');
const { default: submitLead } = await import('../api/submit-lead.mjs');

let otpRecord = null;
let deliveredOtp = '';
const savedLeads = [];
let sentEmails = 0;
let failSupabase = false;

globalThis.fetch = async (input, options = {}) => {
  const url = String(input);
  const method = options.method || 'GET';
  if (failSupabase && url.startsWith('https://test-project.supabase.co/')) throw new Error('Mocked Supabase outage');
  if (url.startsWith('https://test-project.supabase.co/rest/v1/otp_challenges')) {
    if (method === 'POST') {
      otpRecord = { ...JSON.parse(options.body), attempts: 0, used_at: null };
      return Response.json([otpRecord], { status: 201 });
    }
    if (method === 'GET') return Response.json(otpRecord ? [otpRecord] : []);
    if (method === 'PATCH') {
      otpRecord = { ...otpRecord, ...JSON.parse(options.body) };
      return Response.json([otpRecord]);
    }
    if (method === 'DELETE') {
      otpRecord = null;
      return Response.json([]);
    }
  }
  if (url === 'https://test-project.supabase.co/rest/v1/leads' && method === 'POST') {
    const lead = { id: `lead-${savedLeads.length + 1}`, ...JSON.parse(options.body) };
    savedLeads.push(lead);
    return Response.json([lead], { status: 201 });
  }
  if (url.startsWith('https://2factor.in/API/V1/')) {
    const parts = url.split('/');
    deliveredOtp = decodeURIComponent(parts[parts.indexOf('SMS') + 2] || '');
    return Response.json({ Status: 'Success' });
  }
  if (url === 'https://api.brevo.com/v3/smtp/email') {
    sentEmails += 1;
    return Response.json({ messageId: `email-${sentEmails}` }, { status: 201 });
  }
  throw new Error(`Unexpected mocked request: ${method} ${url}`);
};

function apiRequest(path, payload, origin = 'https://www.millionmindstechcity.in') {
  return new Request(`https://www.millionmindstechcity.in/api/${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
      'x-forwarded-for': '203.0.113.20',
      'user-agent': 'lead-api-test',
    },
    body: JSON.stringify(payload),
  });
}

const gateLead = {
  requirement: 'Office space',
  budget: 'Rs 4 Cr - Rs 5 Cr',
  first_name: 'Test',
  last_name: 'Lead',
  email: 'test@example.com',
  country_code: '+91',
  phone: '9876543210',
  website: '',
};

const otpStartResponse = await requestOtp.fetch(apiRequest('request-otp', gateLead));
const otpStartBody = await otpStartResponse.json();
assert.equal(otpStartResponse.status, 200);
assert.equal(otpStartBody.ok, true);
assert.match(otpStartBody.challenge, /^[0-9a-f-]{36}\.\d{13}\.[A-Za-z0-9_-]+$/i);
assert.match(deliveredOtp, /^\d{6}$/);
assert.ok(otpRecord?.otp_digest);
assert.equal(otpRecord?.lead_data?.email, gateLead.email);

const verifyResponse = await verifyOtp.fetch(apiRequest('verify-otp', {
  challenge: otpStartBody.challenge,
  otp: deliveredOtp,
}));
assert.equal(verifyResponse.status, 200);
assert.deepEqual(await verifyResponse.json(), { ok: true });
assert.equal(savedLeads.length, 1);
assert.ok(savedLeads[0].verified_at);
assert.ok(otpRecord.used_at);

const contactResponse = await submitLead.fetch(apiRequest('submit-lead', {
  fname: 'Contact Test',
  email: 'contact@example.com',
  phone: '+91 98765 43210',
  interest: 'Corporate office',
  message: 'Please arrange a consultation.',
  website: '',
}));
assert.equal(contactResponse.status, 200);
assert.deepEqual(await contactResponse.json(), { ok: true });
assert.equal(savedLeads.length, 2);
assert.equal(savedLeads[1].source, 'Website contact form');
assert.equal(savedLeads[1].verified_at, null);
assert.equal(sentEmails, 2);

failSupabase = true;
const originalConsoleError = console.error;
console.error = () => {};
const emailFallbackResponse = await submitLead.fetch(apiRequest('submit-lead', {
  fname: 'Fallback Test',
  email: 'fallback@example.com',
  phone: '+91 98765 43211',
  interest: 'Office space',
  message: 'Capture through email when the database is unavailable.',
  website: '',
}));
assert.equal(emailFallbackResponse.status, 200);
assert.deepEqual(await emailFallbackResponse.json(), { ok: true });
assert.equal(savedLeads.length, 2);
assert.equal(sentEmails, 3);
console.error = originalConsoleError;
failSupabase = false;

const blockedOriginResponse = await submitLead.fetch(apiRequest('submit-lead', {
  fname: 'Blocked', email: 'blocked@example.com', phone: '9876543210', message: 'Blocked request',
}, 'https://malicious.example'));
assert.equal(blockedOriginResponse.status, 403);

const invalidMethodResponse = await submitLead.fetch(new Request('https://www.millionmindstechcity.in/api/submit-lead'));
assert.equal(invalidMethodResponse.status, 405);

console.log('[test-lead-api] OTP request, verification, database and email capture, database-outage fallback, origin protection and method handling passed');
