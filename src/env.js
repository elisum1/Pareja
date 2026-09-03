const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { z } = require("zod");

const envPath = path.join(__dirname, "..", ".env");
const envExamplePath = path.join(__dirname, "..", ".env.example");

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else if (fs.existsSync(envExamplePath)) {
  dotenv.config({ path: envExamplePath });
}

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(10000),
  HOST: z.string().min(1).default("0.0.0.0"),
  SQLITE_PATH: z.string().min(1).default("./db/pareja_neon.sqlite"),
  JWT_SECRET: z.string().min(16),
  /** URL pública para descargar/abrir la app (Expo Go o build). */
  APP_DOWNLOAD_URL: z
    .string()
    .url()
    .default("https://expo.dev/@elisum94/pareja-neon"),
  /** Deep link para aceptar invitación dentro de la app instalada. */
  APP_LINK_BASE: z.string().min(1).default("pareja-neon://"),
  API_BASE_URL: z.string().url().default("http://localhost:10000"),
  WHATSAPP_PROVIDER: z.enum(["mock", "twilio"]).default("mock"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
  /** Orígenes extra para CORS, separados por coma (ej. Expo Web: http://192.168.18.35:8081) */
  CORS_EXTRA_ORIGINS: z.string().optional(),
  /**
   * Si es true, el endpoint de forgot-password incluye el código en la respuesta
   * (necesario mientras no haya SMTP). En producción con email real, pon false.
   */
  PASSWORD_RESET_RETURN_CODE: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((v) => {
      if (v === undefined || v === null || v === "") return true;
      if (typeof v === "boolean") return v;
      return !["0", "false", "no", "off"].includes(String(v).trim().toLowerCase());
    }),
  SMTP_HOST: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional()
});

let env;
try {
  env = envSchema.parse(process.env);
} catch (e) {
  if (e && typeof e === "object" && "errors" in e) {
    throw new Error(
      [
        "Faltan variables de entorno en apps/api.",
        "Crea apps/api/.env (puedes copiar apps/api/.env.example) y define como mínimo:",
        "- SQLITE_PATH",
        "- JWT_SECRET"
      ].join("\n")
    );
  }
  throw e;
}

module.exports = { env };
