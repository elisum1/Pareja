const express = require("express");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const { randomUUID } = require("crypto");
const { dbQuery } = require("../db");
const { signJwt } = require("../auth/jwt");
const { requireAuth } = require("../auth/middleware");

const authRouter = express.Router();

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72)
});

authRouter.post("/register", async (req, res) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "BAD_REQUEST", details: parsed.error.flatten() });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const userId = randomUUID();

  try {
    await dbQuery("insert into app_user (id, email, password_hash) values (?, ?, ?)", [userId, email, passwordHash]);
  } catch (e) {
    const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
    const msg = e && typeof e === "object" && "message" in e ? String(e.message) : "";
    if (code.startsWith("SQLITE_CONSTRAINT") || msg.includes("UNIQUE constraint failed: app_user.email")) {
      res.status(409).json({ error: "EMAIL_IN_USE" });
      return;
    }
    res.status(500).json({ error: "SERVER_ERROR" });
    return;
  }

  const token = signJwt({ userId });
  res.json({ token, user: { id: userId, email } });
});

authRouter.post("/login", async (req, res) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "BAD_REQUEST", details: parsed.error.flatten() });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const rows = await dbQuery("select id, email, password_hash from app_user where email=? limit 1", [email]);
  const user = rows[0];
  if (!user) {
    res.status(401).json({ error: "INVALID_CREDENTIALS" });
    return;
  }
  const ok = await bcrypt.compare(parsed.data.password, user.password_hash);
  if (!ok) {
    res.status(401).json({ error: "INVALID_CREDENTIALS" });
    return;
  }
  const token = signJwt({ userId: user.id });
  res.json({ token, user: { id: user.id, email: user.email } });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const userId = req.userId;
  const rows = await dbQuery("select id, email from app_user where id=?", [userId]);
  const user = rows[0];
  if (!user) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  res.json({ user });
});

module.exports = { authRouter };
