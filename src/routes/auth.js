const express = require("express");
const bcrypt = require("bcryptjs");
const { z } = require("zod");
const { randomUUID } = require("crypto");
const { dbQuery } = require("../db");
const { signJwt } = require("../auth/jwt");
const { requireAuth } = require("../auth/middleware");

const authRouter = express.Router();

const USERNAME_REGEX = /^[a-z][a-z0-9_.]{2,19}$/;

const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72)
});

const profileSchema = z.object({
  displayName: z.string().min(1).max(80).optional(),
  photoUrl: z.string().max(1000000).optional(),
  bio: z.string().max(2000).nullable().optional(),
  age: z.number().int().min(13).max(120).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  country: z.string().max(80).nullable().optional(),
  city: z.string().max(80).nullable().optional()
});

const onboardingSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(USERNAME_REGEX, "USERNAME_INVALID"),
  displayName: z.string().trim().min(1).max(80),
  age: z
    .union([z.number().int().min(13).max(120), z.string().trim().regex(/^\d{1,3}$/)])
    .nullable()
    .optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  country: z.string().trim().max(80).nullable().optional(),
  city: z.string().trim().max(80).nullable().optional()
});

function toUserDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name || null,
    photoUrl: row.photo_url || null,
    username: row.username || null,
    age: row.age ?? null,
    phone: row.phone || null,
    country: row.country || null,
    city: row.city || null,
    bio: row.bio || null
  };
}

const USER_COLUMNS = "id, email, display_name, photo_url, username, age, phone, country, city, bio";

async function loadUser(userId) {
  const rows = await dbQuery(`select ${USER_COLUMNS} from app_user where id=? limit 1`, [userId]);
  return rows[0] ? toUserDto(rows[0]) : null;
}

function isUsernameTakenError(e) {
  const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
  const msg = e && typeof e === "object" && "message" in e ? String(e.message) : "";
  return (
    code.startsWith("SQLITE_CONSTRAINT") &&
    /app_user_username_unique/i.test(msg)
  );
}

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
  const user = await loadUser(userId);
  res.json({ token, user });
});

authRouter.post("/login", async (req, res) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "BAD_REQUEST", details: parsed.error.flatten() });
    return;
  }
  const email = parsed.data.email.trim().toLowerCase();
  const rows = await dbQuery(
    `select ${USER_COLUMNS}, password_hash from app_user where email=? limit 1`,
    [email]
  );
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
  res.json({ token, user: toUserDto(user) });
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await loadUser(req.userId);
  if (!user) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  res.json({ user });
});

authRouter.get("/check-username", async (req, res) => {
  const raw = String(req.query.u ?? "").trim().toLowerCase();
  if (!raw) {
    res.status(400).json({ error: "USERNAME_REQUIRED" });
    return;
  }
  if (!USERNAME_REGEX.test(raw)) {
    res.json({ available: false, reason: "USERNAME_INVALID" });
    return;
  }
  try {
    const rows = await dbQuery(
      "select 1 as found from app_user where lower(username)=? limit 1",
      [raw]
    );
    res.json({ available: rows.length === 0 });
  } catch (e) {
    process.stderr.write(`[check-username] ${e?.message ?? e}\n`);
    res.status(500).json({ error: "SERVER_ERROR" });
  }
});

authRouter.post("/me/onboarding", requireAuth, async (req, res) => {
  const parsed = onboardingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "BAD_REQUEST", details: parsed.error.flatten() });
    return;
  }

  const username = parsed.data.username;
  if (!USERNAME_REGEX.test(username)) {
    res.status(400).json({ error: "USERNAME_INVALID" });
    return;
  }

  const displayName = parsed.data.displayName;
  const age =
    parsed.data.age === undefined || parsed.data.age === null || parsed.data.age === ""
      ? null
      : Number(parsed.data.age);
  const phone = parsed.data.phone ? parsed.data.phone : null;
  const country = parsed.data.country ? parsed.data.country : null;
  const city = parsed.data.city ? parsed.data.city : null;

  try {
    await dbQuery(
      "update app_user set username=?, display_name=?, age=?, phone=?, country=?, city=? where id=?",
      [username, displayName, age, phone, country, city, req.userId]
    );
  } catch (e) {
    if (isUsernameTakenError(e)) {
      res.status(409).json({ error: "USERNAME_TAKEN" });
      return;
    }
    res.status(500).json({ error: "SERVER_ERROR" });
    return;
  }

  const user = await loadUser(req.userId);
  res.json({ user });
});

authRouter.patch("/me/profile", requireAuth, async (req, res) => {
  const userId = req.userId;
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "BAD_REQUEST", details: parsed.error.flatten() });
    return;
  }

  const fields = [];
  const values = [];
  const data = parsed.data;
  if (Object.prototype.hasOwnProperty.call(data, "displayName")) {
    fields.push("display_name=?");
    values.push(String(data.displayName || "").trim() || null);
  }
  if (Object.prototype.hasOwnProperty.call(data, "photoUrl")) {
    fields.push("photo_url=?");
    values.push(String(data.photoUrl || "").trim() || null);
  }
  if (Object.prototype.hasOwnProperty.call(data, "bio")) {
    fields.push("bio=?");
    values.push(data.bio ? String(data.bio).trim() : null);
  }
  if (Object.prototype.hasOwnProperty.call(data, "age")) {
    fields.push("age=?");
    values.push(data.age === null || data.age === undefined ? null : Number(data.age));
  }
  if (Object.prototype.hasOwnProperty.call(data, "phone")) {
    fields.push("phone=?");
    values.push(data.phone ? String(data.phone).trim() : null);
  }
  if (Object.prototype.hasOwnProperty.call(data, "country")) {
    fields.push("country=?");
    values.push(data.country ? String(data.country).trim() : null);
  }
  if (Object.prototype.hasOwnProperty.call(data, "city")) {
    fields.push("city=?");
    values.push(data.city ? String(data.city).trim() : null);
  }

  if (fields.length === 0) {
    res.status(400).json({ error: "EMPTY_UPDATE" });
    return;
  }

  values.push(userId);
  await dbQuery(`update app_user set ${fields.join(", ")} where id=?`, values);

  const user = await loadUser(userId);
  res.json({ user });
});

module.exports = { authRouter };
