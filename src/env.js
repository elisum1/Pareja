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
  PORT: z.coerce.number().int().positive().default(4008),
  SQLITE_PATH: z.string().min(1).default("./db/pareja_neon.sqlite"),
  JWT_SECRET: z.string().min(16),
  APP_LINK_BASE: z.string().min(1).default("pareja-neon://"),
  API_BASE_URL: z.string().url().default("http://localhost:4008"),
  WHATSAPP_PROVIDER: z.enum(["mock", "twilio"]).default("mock"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional()
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
