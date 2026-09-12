import {
  clientIp,
  enforceSameOrigin,
  enforceRateLimit,
  getConfig,
  json,
  publicErrorResponse,
  readJson,
  saveLead,
  sendLeadEmail,
  verifyOtpChallenge,
} from "./_lib.mjs";

export default {
  async fetch(request) {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, { Allow: "POST" });
    try {
      enforceSameOrigin(request);
      const input = await readJson(request);
      const config = getConfig({ requireDatabase: true });
      enforceRateLimit(`verify-ip:${clientIp(request)}`, 12, 15 * 60_000);
      enforceRateLimit(`verify-token:${String(input.challenge || "").slice(-32)}`, 5, 10 * 60_000);
      const verifiedLead = await verifyOtpChallenge(input.challenge, input.otp, config);
      await saveLead(verifiedLead, request, true, config);
      try {
        await sendLeadEmail(verifiedLead, config);
      } catch (emailError) {
        console.error("Verified lead saved but admin email failed.", emailError);
      }
      return json({ ok: true });
    } catch (error) {
      return publicErrorResponse(error, "Verification failed. Please try again.");
    }
  },
};
