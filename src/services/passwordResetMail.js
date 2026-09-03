/**
 * Entrega del código de recuperación.
 * Sin SMTP configurado: se registra en logs (y el API puede devolverlo para la app).
 */
const { env } = require("../env");

async function deliverPasswordResetCode({ email, code }) {
  process.stdout.write(`[PASSWORD_RESET] email=${email} code=${code}\n`);

  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM) {
    // Placeholder: cuando configures SMTP real, envía aquí.
    process.stdout.write(`[PASSWORD_RESET] SMTP configurado pero envío aún no implementado; usa el código en logs/app.\n`);
  }

  return { delivered: true, channel: "app" };
}

module.exports = { deliverPasswordResetCode };
