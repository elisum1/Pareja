const express = require("express");
const { randomUUID } = require("crypto");
const { z } = require("zod");
const { dbQuery } = require("../db");
const { env } = require("../env");
const { requireAuth } = require("../auth/middleware");
const { sendWhatsAppInvite } = require("../services/whatsapp");

const invitesRouter = express.Router();

const createInviteSchema = z.object({
  phoneE164: z.string().min(8).max(20)
});

invitesRouter.post("/", requireAuth, async (req, res) => {
  const userId = req.userId;
  const parsed = createInviteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "BAD_REQUEST", details: parsed.error.flatten() });
    return;
  }

  const phone = parsed.data.phoneE164.trim();

  const existingCouple = await dbQuery("select id as couple_id from couple where user_a_id=? or user_b_id=? limit 1", [userId, userId]);
  if (existingCouple[0]) {
    res.status(409).json({ error: "ALREADY_PAIRED" });
    return;
  }

  const token = randomUUID().replace(/-/g, "");
  const inviteId = randomUUID();
  const link = `${env.APP_LINK_BASE}invite?token=${token}`;

  await dbQuery(
    "insert into invite (id, inviter_user_id, phone_e164, token, status, expires_at) values (?,?,?,?, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','+7 days'))",
    [inviteId, userId, phone, token]
  );

  await sendWhatsAppInvite(phone, link);

  res.json({ invite: { id: inviteId, token, phoneE164: phone, link, status: "pending" } });
});

invitesRouter.get("/:token", async (req, res) => {
  const token = String(req.params.token || "");
  const rows = await dbQuery(
    "select id, inviter_user_id, phone_e164, status, expires_at from invite where token=? limit 1",
    [token]
  );
  const inv = rows[0];
  if (!inv) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  res.json({ invite: inv });
});

invitesRouter.post("/:token/accept", requireAuth, async (req, res) => {
  const userId = req.userId;
  const token = String(req.params.token || "");

  const rows = await dbQuery("select id, inviter_user_id, status, expires_at from invite where token=? limit 1", [token]);
  const inv = rows[0];
  if (!inv) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  if (inv.status !== "pending") {
    res.status(409).json({ error: "INVITE_NOT_PENDING" });
    return;
  }

  const expired = new Date(inv.expires_at).getTime() < Date.now();
  if (expired) {
    await dbQuery("update invite set status='expired' where id=?", [inv.id]);
    res.status(409).json({ error: "INVITE_EXPIRED" });
    return;
  }
  if (inv.inviter_user_id === userId) {
    res.status(409).json({ error: "CANNOT_ACCEPT_OWN_INVITE" });
    return;
  }

  const alreadyPaired = await dbQuery("select id from couple where user_a_id=? or user_b_id=? limit 1", [userId, userId]);
  if (alreadyPaired[0]) {
    res.status(409).json({ error: "ALREADY_PAIRED" });
    return;
  }
  const inviterPaired = await dbQuery("select id from couple where user_a_id=? or user_b_id=? limit 1", [
    inv.inviter_user_id,
    inv.inviter_user_id
  ]);
  if (inviterPaired[0]) {
    res.status(409).json({ error: "INVITER_ALREADY_PAIRED" });
    return;
  }

  const coupleId = randomUUID();
  await dbQuery("insert into couple (id, user_a_id, user_b_id) values (?, ?, ?)", [coupleId, inv.inviter_user_id, userId]);
  await dbQuery("update invite set status='accepted', accepted_user_id=? where id=?", [userId, inv.id]);

  res.json({ couple: { id: coupleId, userAId: inv.inviter_user_id, userBId: userId } });
});

module.exports = { invitesRouter };
