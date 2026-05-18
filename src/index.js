const express = require("express");
const cors = require("cors");
const { env } = require("./env");
const { dbQuery } = require("./db");
const { authRouter } = require("./routes/auth");
const { invitesRouter } = require("./routes/invites");
const { testRouter } = require("./routes/test");
const { requireAuth } = require("./auth/middleware");
const { resultsRouter, getCategoryDetailHandler } = require("./routes/results");
const { linkedRouter } = require("./routes/linked");
const { usersRouter } = require("./routes/users");

const LAN_ORIGIN_RE = /^https?:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$/i;
const LOCAL_ORIGIN_RE = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

function corsOriginCallback(origin, callback) {
  if (!origin) {
    return callback(null, true);
  }
  const extras = String(env.CORS_EXTRA_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (extras.includes(origin)) {
    return callback(null, true);
  }
  const isDev = process.env.NODE_ENV !== "production";
  if (isDev && (LAN_ORIGIN_RE.test(origin) || LOCAL_ORIGIN_RE.test(origin))) {
    return callback(null, true);
  }
  return callback(null, true);
}

function createApp() {
  const app = express();

  if (process.env.RENDER) {
    app.set("trust proxy", 1);
  }

  /** Evita 304 con cuerpo vacío en clientes (p. ej. OkHttp) que dejan listas y IDs obsoletos. */
  app.set("etag", false);

  app.use(
    cors({
      origin: corsOriginCallback,
      credentials: true
    })
  );
  app.use(express.json({ limit: "2mb" }));

  app.use((_req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  });

  app.use((req, res, next) => {
    const startedAt = Date.now();
    const origin = req.headers.origin ?? "(sin Origin — típico en Expo Go / app nativa)";
    const ua = req.headers["user-agent"] ?? "";
    console.log("[api:req]", req.method, req.originalUrl, "| Origin:", origin, "| IP:", req.ip || req.socket.remoteAddress);
    if (req.method !== "GET" && req.method !== "HEAD" && req.method !== "OPTIONS") {
      console.log("[api:req] user-agent:", ua.slice(0, 120) + (ua.length > 120 ? "…" : ""));
    }
    res.on("finish", () => {
      const ms = Date.now() - startedAt;
      console.log(`[api:res] ${res.statusCode} ${req.method} ${req.originalUrl} ${ms}ms`);
    });
    next();
  });

  app.get("/health", async (_req, res) => {
    try {
      await dbQuery("select 1 as ok");
      res.json({ ok: true, db: "ok" });
    } catch (e) {
      res.status(500).json({ ok: false, db: "error", error: e?.message ?? String(e) });
    }
  });

  app.use("/auth", authRouter);
  app.use("/users", usersRouter);
  app.use("/invites", invitesRouter);
  app.use("/test", testRouter);
  app.get("/results/category/:categoryKey", requireAuth, getCategoryDetailHandler);
  app.get("/results/category-detail", requireAuth, getCategoryDetailHandler);
  app.use("/results", resultsRouter);
  app.use("/linked", linkedRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "NOT_FOUND" });
  });

  app.use((err, _req, res, _next) => {
    const message = err?.message ?? String(err);
    process.stderr.write(`[500] ${message}\n`);
    res.status(500).json({ error: "INTERNAL_ERROR", message });
  });

  return app;
}

function startServer(opts) {
  const port = opts?.port ?? env.PORT;
  const host = opts?.host ?? env.HOST;
  const app = createApp();
  const server = app.listen(port, host, () => {
    const address = server.address();
    const actualPort = address && typeof address === "object" ? address.port : port;
    process.stdout.write(`API listening on http://${host}:${actualPort}\n`);
  });
  return { app, server };
}

module.exports = { createApp, startServer };

if (require.main === module) {
  startServer();
}
