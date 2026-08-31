import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";

const BREVO_API_BASE = "https://api.brevo.com/v3";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const memory = globalThis.__millionMindsRateLimits ??= new Map();

export function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

export async function readJson(request) {
  const raw = await request.text();
  if (!raw || raw.length > 20_000) throw new PublicError("Invalid request.", 400);
  try {
    return JSON.parse(raw);
  } catch {
    throw new PublicError("Invalid request.", 400);
  }
}

export class PublicError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function publicErrorResponse(error, fallback) {
  if (error instanceof PublicError) return json({ error: error.message }, error.status);
  console.error(fallback, error);
  return json({ error: fallback }, 500);
}

export function getConfig() {
  const required = [
    "OTP_SECRET",
    "TWO_FACTOR_API_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  if (process.env.OTP_SECRET.length < 32) throw new Error("OTP_SECRET must be at least 32 characters.");

  return {
    apiKey: process.env.BREVO_API_KEY,
    senderEmail: process.env.BREVO_SENDER_EMAIL,
    senderName: process.env.BREVO_SENDER_NAME || "Million Minds Tech City",
    adminEmail: process.env.ADMIN_EMAIL,
    otpSecret: process.env.OTP_SECRET,
    twoFactorApiKey: process.env.TWO_FACTOR_API_KEY,
    supabaseUrl: process.env.SUPABASE_URL?.replace(/\/$/, ""),
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    otpMinutes: Math.min(Math.max(Number(process.env.OTP_EXPIRES_MINUTES) || 5, 2), 10),
  };
}

export function clean(value, max = 250) {
  return String(value ?? "").trim().replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max);
}

export function validateGateLead(input) {
  const countryCode = clean(input.country_code, 5).replace(/[^+\d]/g, "") || "+91";
  const phone = clean(input.phone, 20).replace(/\D/g, "");
  const lead = {
    requirement: clean(input.requirement, 100),
    budget: clean(input.budget, 100),
    first_name: clean(input.first_name, 80),
    last_name: clean(input.last_name, 80),
    email: clean(input.email, 160).toLowerCase(),
    country_code: countryCode,
    phone,
    source: "OTP access form",
  };

  if (!lead.requirement || !lead.budget || !lead.first_name || !lead.last_name || !lead.email || !lead.phone) {
    throw new PublicError("Please complete all required fields.");
  }
  if (!EMAIL_PATTERN.test(lead.email)) throw new PublicError("Please enter a valid email address.");
  if (lead.country_code !== "+91" || !/^\d{10}$/.test(lead.phone)) {
    throw new PublicError("Please enter a valid 10-digit Indian phone number.");
  }
  return lead;
}

export function validateContactLead(input) {
  const lead = {
    first_name: clean(input.fname, 120),
    last_name: "",
    email: clean(input.email, 160).toLowerCase(),
    phone: clean(input.phone, 30),
    requirement: clean(input.interest, 100) || "Not selected",
    budget: "Not provided",
    message: clean(input.message, 2000),
    source: "Website contact form",
  };
  if (!lead.first_name || !lead.email || !lead.phone || !lead.message) {
    throw new PublicError("Please complete all required fields.");
  }
  if (!EMAIL_PATTERN.test(lead.email)) throw new PublicError("Please enter a valid email address.");
  if (lead.phone.replace(/\D/g, "").length < 10) throw new PublicError("Please enter a valid phone number.");
  return lead;
}

export function clientIp(request) {
  return clean(request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown", 80);
}

export function clientFingerprint(request, config) {
  return hmac(config.otpSecret, `ip:${clientIp(request)}`);
}

export function enforceRateLimit(key, limit, windowMs) {
  const now = Date.now();
  if (memory.size > 5_000) {
    for (const [storedKey, value] of memory) {
      if (value.resetAt <= now) memory.delete(storedKey);
    }
  }
  const current = memory.get(key);
  if (!current || current.resetAt <= now) {
    memory.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    throw new PublicError(`Too many attempts. Please try again in ${Math.ceil(retryAfter / 60)} minute(s).`, 429);
  }
  current.count += 1;
}

function hmac(secret, value) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createOtpChallenge(lead, config) {
  const otp = String(randomInt(100000, 1000000));
  const id = randomUUID();
  const expiresAt = Date.now() + config.otpMinutes * 60_000;
  const signature = hmac(config.otpSecret, `otp-token:${id}:${expiresAt}`);
  return {
    id,
    otp,
    expiresAt,
    otpDigest: hmac(config.otpSecret, `otp-code:${id}:${lead.country_code}${lead.phone}:${otp}`),
    token: `${id}.${expiresAt}.${signature}`,
  };
}

function parseOtpChallenge(token, config) {
  const parts = clean(token, 500).split(".");
  if (parts.length !== 3) throw new PublicError("Invalid or expired OTP. Please request a new code.", 401);
  const [id, expiresAt, signature] = parts;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^\d{13}$/.test(expiresAt)) {
    throw new PublicError("Invalid or expired OTP. Please request a new code.", 401);
  }
  const expectedSignature = hmac(config.otpSecret, `otp-token:${id}:${expiresAt}`);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new PublicError("Invalid or expired OTP. Please request a new code.", 401);
  }
  if (Date.now() > Number(expiresAt)) {
    throw new PublicError("OTP expired. Please request a new code.", 401);
  }
  return { id };
}

function assertSupabase(config) {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error("Missing environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
  }
}

async function supabaseRequest(path, options, config) {
  assertSupabase(config);
  const isOpaqueApiKey = config.supabaseServiceRoleKey.startsWith("sb_");
  const response = await fetch(`${config.supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: config.supabaseServiceRoleKey,
      // New sb_secret keys are opaque API keys, not JWTs. They must not be
      // sent as a Bearer token; legacy service-role JWTs remain supported.
      ...(isOpaqueApiKey ? {} : { Authorization: `Bearer ${config.supabaseServiceRoleKey}` }),
      "Content-Type": "application/json",
      Prefer: "return=representation",
      // Supabase refuses sb_secret keys from browser-like user agents. This
      // identifies the request as the Vercel server, never the browser.
      "User-Agent": "MillionMinds-VercelServer/1.0",
      ...(options.headers || {}),
    },
  });
  const raw = await response.text();
  let body = null;
  try { body = raw ? JSON.parse(raw) : null; } catch { body = null; }
  if (!response.ok) throw new Error(`Supabase ${path} failed (${response.status}): ${raw.slice(0, 500)}`);
  return body;
}

export async function storeOtpChallenge(challenge, lead, request, config) {
  await supabaseRequest("/rest/v1/otp_challenges", {
    method: "POST",
    body: JSON.stringify({
      id: challenge.id,
      phone: `${lead.country_code}${lead.phone}`,
      otp_digest: challenge.otpDigest,
      lead_data: lead,
      expires_at: new Date(challenge.expiresAt).toISOString(),
      ip_hash: clientFingerprint(request, config),
    }),
  }, config);
}

export async function removeOtpChallenge(id, config) {
  await supabaseRequest(`/rest/v1/otp_challenges?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" }, config);
}

export async function verifyOtpChallenge(token, otp, config) {
  if (!/^\d{6}$/.test(clean(otp, 6))) throw new PublicError("Please enter the 6-digit OTP.");
  const { id } = parseOtpChallenge(token, config);
  const rows = await supabaseRequest(`/rest/v1/otp_challenges?id=eq.${encodeURIComponent(id)}&select=*`, { method: "GET" }, config);
  const challenge = rows?.[0];
  if (!challenge || challenge.used_at || new Date(challenge.expires_at).getTime() < Date.now()) {
    throw new PublicError("OTP expired. Please request a new code.", 401);
  }
  if (Number(challenge.attempts) >= 5) throw new PublicError("Too many incorrect attempts. Please request a new OTP.", 429);

  const lead = validateGateLead(challenge.lead_data);
  const suppliedDigest = hmac(config.otpSecret, `otp-code:${id}:${lead.country_code}${lead.phone}:${clean(otp, 6)}`);
  const storedBuffer = Buffer.from(challenge.otp_digest || "");
  const suppliedBuffer = Buffer.from(suppliedDigest);
  if (storedBuffer.length !== suppliedBuffer.length || !timingSafeEqual(storedBuffer, suppliedBuffer)) {
    await supabaseRequest(`/rest/v1/otp_challenges?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ attempts: Number(challenge.attempts) + 1 }),
    }, config);
    throw new PublicError("The OTP is incorrect. Please try again.", 401);
  }

  const consumed = await supabaseRequest(`/rest/v1/otp_challenges?id=eq.${encodeURIComponent(id)}&used_at=is.null`, {
    method: "PATCH",
    body: JSON.stringify({ used_at: new Date().toISOString() }),
  }, config);
  if (!consumed?.length) throw new PublicError("OTP has already been used. Please request a new code.", 409);
  return lead;
}

export async function saveLead(lead, request, verified, config) {
  const rows = await supabaseRequest("/rest/v1/leads", {
    method: "POST",
    body: JSON.stringify({
      source: lead.source,
      first_name: lead.first_name,
      last_name: lead.last_name || null,
      email: lead.email,
      country_code: lead.country_code || null,
      phone: lead.phone,
      requirement: lead.requirement,
      budget: lead.budget,
      message: lead.message || null,
      verified_at: verified ? new Date().toISOString() : null,
      ip_hash: clientFingerprint(request, config),
      user_agent: clean(request.headers.get("user-agent"), 500) || null,
    }),
  }, config);
  return rows?.[0] || null;
}

async function brevoRequest(path, payload, config) {
  const response = await fetch(`${BREVO_API_BASE}${path}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": config.apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Brevo ${path} failed (${response.status}): ${detail.slice(0, 500)}`);
  }
  return response.json().catch(() => ({}));
}

export async function sendOtpSms(lead, otp, config) {
  const phone = `${lead.country_code.replace(/\D/g, "")}${lead.phone}`;
  const url = `https://2factor.in/API/V1/${encodeURIComponent(config.twoFactorApiKey)}/SMS/${encodeURIComponent(phone)}/${encodeURIComponent(otp)}`;
  const response = await fetch(url, { method: "POST" });
  const raw = await response.text();
  let body = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch { body = {}; }
  const status = String(body.Status || body.status || "").toLowerCase();
  if (!response.ok || (status && !["success", "sent"].includes(status))) {
    throw new Error(`2Factor OTP request failed (${response.status}): ${raw.slice(0, 500)}`);
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function sendLeadEmail(lead, config) {
  if (!config.apiKey || !config.senderEmail || !config.adminEmail) {
    throw new Error("Missing environment variables: BREVO_API_KEY, BREVO_SENDER_EMAIL, ADMIN_EMAIL");
  }
  const fullName = `${lead.first_name || ""} ${lead.last_name || ""}`.trim();
  const rows = [
    ["Source", lead.source],
    ["Name", fullName],
    ["Email", lead.email],
    ["Phone", `${lead.country_code || ""} ${lead.phone}`.trim()],
    ["Requirement", lead.requirement],
    ["Budget", lead.budget],
    ["Message", lead.message || "—"],
    ["Received", new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST"],
  ];
  const table = rows
    .map(([label, value]) => `<tr><th style="padding:10px;text-align:left;border:1px solid #dbe2ea;background:#f4f7f9">${escapeHtml(label)}</th><td style="padding:10px;border:1px solid #dbe2ea">${escapeHtml(value)}</td></tr>`)
    .join("");

  return brevoRequest(
    "/smtp/email",
    {
      sender: { name: config.senderName, email: config.senderEmail },
      to: [{ email: config.adminEmail, name: "Leasing Admin" }],
      replyTo: { email: lead.email, name: fullName },
      subject: `New Million Minds lead: ${fullName || lead.phone}`,
      htmlContent: `<html><body style="font-family:Arial,sans-serif;color:#0d1b2e"><h2>New website lead</h2><table style="border-collapse:collapse;width:100%;max-width:700px">${table}</table></body></html>`,
      tags: ["million-minds-lead"],
    },
    config,
  );
}
