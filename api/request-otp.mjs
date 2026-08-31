import {
  clientIp,
  createOtpChallenge,
  enforceRateLimit,
  getConfig,
  json,
  publicErrorResponse,
  readJson,
  removeOtpChallenge,
  sendOtpSms,
  storeOtpChallenge,
  validateGateLead,
} from "./_lib.mjs";

export default {
  async fetch(request) {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, { Allow: "POST" });
    try {
      const input = await readJson(request);
      if (input.website) return json({ ok: true });
      const config = getConfig();
      const lead = validateGateLead(input);
      enforceRateLimit(`otp-ip:${clientIp(request)}`, 5, 15 * 60_000);
      enforceRateLimit(`otp-phone:${lead.country_code}${lead.phone}`, 3, 15 * 60_000);
      const challenge = createOtpChallenge(lead, config);
      await storeOtpChallenge(challenge, lead, request, config);
      try {
        await sendOtpSms(lead, challenge.otp, config);
      } catch (error) {
        await removeOtpChallenge(challenge.id, config).catch(() => {});
        throw error;
      }
      return json({ ok: true, challenge: challenge.token, expiresIn: config.otpMinutes * 60 });
    } catch (error) {
      return publicErrorResponse(error, "OTP could not be sent. Please try again shortly.");
    }
  },
};
