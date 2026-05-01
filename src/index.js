const express = require("express");
const cors = require("cors");
const { env } = require("./env");
const { dbQuery } = require("./db");
const { authRouter } = require("./routes/auth");
const { invitesRouter } = require("./routes/invites");
const { testRouter } = require("./routes/test");
const { resultsRouter } = require("./routes/results");

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on("finish", () => {
      const ms = Date.now() - startedAt;
      process.stdout.write(`[${res.statusCode}] ${req.method} ${req.originalUrl} ${ms}ms\n`);
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
  app.use("/invites", invitesRouter);
  app.use("/test", testRouter);
  app.use("/results", resultsRouter);

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
