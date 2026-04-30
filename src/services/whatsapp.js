const { env } = require("../env");

async function sendWhatsAppInvite(phoneE164, link) {
  if (env.WHATSAPP_PROVIDER === "mock") {
    process.stdout.write(`[WHATSAPP:MOCK] to=${phoneE164} link=${link}\n`);
    return { provider: "mock" };
  }
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_WHATSAPP_FROM) {
    throw new Error("TWILIO_NOT_CONFIGURED");
  }
  throw new Error("TWILIO_NOT_IMPLEMENTED");
}

module.exports = { sendWhatsAppInvite };

