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
  validateContactLead,
} from "./_lib.mjs";

export default {
  async fetch(request) {
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, { Allow: "POST" });
    try {
      enforceSameOrigin(request);
      const input = await readJson(request);
      if (input.website) return json({ ok: true });
      enforceRateLimit(`lead-ip:${clientIp(request)}`, 5, 30 * 60_000);
      const config = getConfig();
      const lead = validateContactLead(input);
      const [storageResult, emailResult] = await Promise.allSettled([
        saveLead(lead, request, false, config),
        sendLeadEmail(lead, config),
      ]);
      if (storageResult.status === "rejected") console.error("Lead database save failed; email fallback was attempted.", storageResult.reason);
      if (emailResult.status === "rejected") console.error("Lead admin email failed; database storage was attempted.", emailResult.reason);
      if (storageResult.status === "rejected" && emailResult.status === "rejected") {
        throw new Error("Both lead capture channels failed.");
      }
      return json({ ok: true });
    } catch (error) {
      return publicErrorResponse(error, "Your enquiry could not be sent. Please try again shortly.");
    }
  },
};
