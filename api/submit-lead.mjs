import {
  clientIp,
  enforceRateLimit,
  getConfig,
  json,
  publicErrorResponse,
  readJson,
  saveLead,
  sendLeadEmail,
  validateContactLead,
} from "./_lib.mjs";

export default {
  async fetch(request) {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, { Allow: "POST" });
    try {
      const input = await readJson(request);
      if (input.website) return json({ ok: true });
      enforceRateLimit(`lead-ip:${clientIp(request)}`, 5, 30 * 60_000);
      const config = getConfig();
      const lead = validateContactLead(input);
      await saveLead(lead, request, false, config);
      try {
        await sendLeadEmail(lead, config);
      } catch (emailError) {
        console.error("Lead saved but admin email failed.", emailError);
      }
      return json({ ok: true });
    } catch (error) {
      return publicErrorResponse(error, "Your enquiry could not be sent. Please try again shortly.");
    }
  },
};
