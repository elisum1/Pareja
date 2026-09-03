const express = require("express");
const { randomUUID } = require("crypto");
const { z } = require("zod");
const { dbQuery } = require("../db");
const { env } = require("../env");
const { requireAuth } = require("../auth/middleware");
const { sendWhatsAppInvite } = require("../services/whatsapp");
const { notifyInviteReceived, notifyInviteAccepted } = require("../domain/notifications");

const invitesRouter = express.Router();

const createInviteSchema = z.object({
  phoneE164: z.string().trim().min(0).max(20).optional(),
  targetUsername: z.string().trim().toLowerCase().min(3).max(20).optional(),
  targetEmail: z.string().trim().email().optional(),
  targetUserId: z.string().trim().min(1).max(64).optional()
});

function normalizeLinkBase(base) {
  const value = String(base || "").trim();
  if (!value) return "";
  return value.endsWith("/") ? value : `${value}/`;
}

function buildInviteDeepLink(token) {
  const encoded = encodeURIComponent(String(token || ""));
  return `${normalizeLinkBase(env.APP_LINK_BASE)}invite?token=${encoded}`;
}

/** Link que se comparte: abre la invitación (API pública redirige al deep link de la app). */
function buildInviteLink(token) {
  const apiBase = String(env.API_BASE_URL || "").replace(/\/+$/, "");
  const apiLooksPublic = /^https?:\/\//i.test(apiBase) && !/localhost|127\.0\.0\.1/i.test(apiBase);
  if (apiLooksPublic) {
    return `${apiBase}/invites/open/${encodeURIComponent(String(token || ""))}`;
  }
  return buildInviteDeepLink(token);
}

invitesRouter.get("/sent/list", requireAuth, async (req, res) => {
  const userId = req.userId;
  const rows = await dbQuery(
    `select
        i.id, i.phone_e164, i.token, i.status, i.created_at, i.expires_at,
        i.accepted_user_id, i.target_user_id,
        au.email as accepted_email, au.username as accepted_username, au.display_name as accepted_display_name,
        tu.email as target_email, tu.username as target_username, tu.display_name as target_display_name,
        c.id as couple_id
     from invite i
     left join app_user au on au.id = i.accepted_user_id
     left join app_user tu on tu.id = i.target_user_id
     left join couple c on (
       i.status = 'accepted'
       and i.accepted_user_id is not null
       and (
         (c.user_a_id = i.inviter_user_id and c.user_b_id = i.accepted_user_id)
         or (c.user_a_id = i.accepted_user_id and c.user_b_id = i.inviter_user_id)
       )
     )
     where i.inviter_user_id=?
       and (i.status = 'pending' or (i.status = 'accepted' and c.id is not null))
     order by datetime(i.created_at) desc`,
    [userId]
  );

  res.json({
    invites: rows.map((row) => ({
      id: row.id,
      phoneE164: row.phone_e164 || null,
      token: row.token,
      status: row.status,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      link: buildInviteLink(row.token),
      acceptedUserId: row.accepted_user_id,
      acceptedEmail: row.accepted_email || null,
      acceptedUsername: row.accepted_username || null,
      acceptedDisplayName: row.accepted_display_name || null,
      targetUserId: row.target_user_id,
      targetEmail: row.target_email || null,
      targetUsername: row.target_username || null,
      targetDisplayName: row.target_display_name || null,
      coupleId: row.couple_id || null
    }))
  });
});

invitesRouter.get("/received/list", requireAuth, async (req, res) => {
  const userId = req.userId;
  const rows = await dbQuery(
    `select
        i.id, i.phone_e164, i.token, i.status, i.created_at, i.expires_at, i.target_user_id, i.accepted_user_id,
        inviter.email as inviter_email, inviter.username as inviter_username, inviter.display_name as inviter_display_name, inviter.photo_url as inviter_photo_url
     from invite i
     join app_user inviter on inviter.id = i.inviter_user_id
     left join couple c on (
       i.status = 'accepted'
       and i.accepted_user_id is not null
       and (
         (c.user_a_id = i.inviter_user_id and c.user_b_id = i.accepted_user_id)
         or (c.user_a_id = i.accepted_user_id and c.user_b_id = i.inviter_user_id)
       )
     )
     where (i.target_user_id = ? and i.status = 'pending')
        or (i.accepted_user_id = ? and i.status = 'accepted' and c.id is not null)
     order by datetime(i.created_at) desc`,
    [userId, userId]
  );

  res.json({
    invites: rows.map((row) => ({
      id: row.id,
      phoneE164: row.phone_e164 || null,
      token: row.token,
      status: row.status,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      targetUserId: row.target_user_id,
      isTargeted: row.target_user_id === userId,
      isAccepted: row.accepted_user_id === userId,
      inviter: {
        email: row.inviter_email,
        username: row.inviter_username || null,
        displayName: row.inviter_display_name || null,
        photoUrl: row.inviter_photo_url || null
      }
    }))
  });
});

invitesRouter.post("/", requireAuth, async (req, res) => {
  const userId = req.userId;
  const parsed = createInviteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "BAD_REQUEST", details: parsed.error.flatten() });
    return;
  }

  const { phoneE164, targetUsername, targetUserId, targetEmail } = parsed.data;
  const phone = (phoneE164 || "").trim();

  let resolvedTargetUserId = null;
  let resolvedTargetUsername = null;
  if (targetUserId || targetUsername || targetEmail) {
    let row;
    if (targetUserId) {
      const rs = await dbQuery(
        "select id, username, email, display_name from app_user where id=? limit 1",
        [targetUserId]
      );
      row = rs[0];
    } else if (targetEmail) {
      const rs = await dbQuery(
        "select id, username, email, display_name from app_user where lower(email)=? limit 1",
        [String(targetEmail).trim().toLowerCase()]
      );
      row = rs[0];
    } else {
      const rs = await dbQuery(
        "select id, username, email, display_name from app_user where lower(username)=? limit 1",
        [targetUsername]
      );
      row = rs[0];
    }
    if (!row) {
      res.status(404).json({ error: "TARGET_USER_NOT_FOUND" });
      return;
    }
    if (row.id === userId) {
      res.status(409).json({ error: "CANNOT_INVITE_SELF" });
      return;
    }

    const existingPending = await dbQuery(
      "select id from invite where inviter_user_id=? and target_user_id=? and status='pending' limit 1",
      [userId, row.id]
    );
    if (existingPending[0]) {
      res.status(409).json({ error: "ALREADY_INVITED" });
      return;
    }

    const alreadyTogether = await dbQuery(
      "select id from couple where (user_a_id=? and user_b_id=?) or (user_a_id=? and user_b_id=?) limit 1",
      [userId, row.id, row.id, userId]
    );
    if (alreadyTogether[0]) {
      res.status(409).json({ error: "ALREADY_LINKED_WITH_USER" });
      return;
    }

    resolvedTargetUserId = row.id;
    resolvedTargetUsername = row.username;
  }

  const token = randomUUID().replace(/-/g, "");
  const inviteId = randomUUID();
  const link = buildInviteLink(token);

  await dbQuery(
    `insert into invite (id, inviter_user_id, target_user_id, phone_e164, token, status, expires_at)
     values (?,?,?,?,?, 'pending', strftime('%Y-%m-%dT%H:%M:%fZ','now','+7 days'))`,
    [inviteId, userId, resolvedTargetUserId, phone, token]
  );

  if (phone) {
    try {
      await sendWhatsAppInvite(phone, link);
    } catch (e) {
      console.log("[invites] sendWhatsAppInvite failed:", e?.message || e);
    }
  }

  if (resolvedTargetUserId) {
    try {
      await notifyInviteReceived({
        targetUserId: resolvedTargetUserId,
        inviterUserId: userId,
        inviteId,
        inviteToken: token
      });
    } catch (e) {
      console.log("[invites] notifyInviteReceived failed:", e?.message || e);
    }
  }

  res.json({
    invite: {
      id: inviteId,
      token,
      phoneE164: phone || null,
      link,
      deepLink: buildInviteDeepLink(token),
      status: "pending",
      targetUserId: resolvedTargetUserId,
      targetUsername: resolvedTargetUsername
    }
  });
});

invitesRouter.get("/open/:token", async (req, res) => {
  const token = String(req.params.token || "").trim();
  const rows = await dbQuery("select id, status, expires_at from invite where token=? limit 1", [token]);
  const inv = rows[0];
  if (!inv) {
    res.status(404).type("html").send(inviteLandingHtml({
      ok: false,
      title: "Invitación no encontrada",
      body: "Este enlace no es válido o ya no existe. Pide a tu pareja que genere uno nuevo.",
      downloadUrl: env.APP_DOWNLOAD_URL
    }));
    return;
  }

  const expired = new Date(inv.expires_at).getTime() < Date.now();
  if (inv.status !== "pending" || expired) {
    res.status(409).type("html").send(inviteLandingHtml({
      ok: false,
      title: expired ? "Invitación expirada" : "Invitación no disponible",
      body: expired
        ? "Esta invitación ya caducó. Pide un enlace nuevo desde la app."
        : "Esta invitación ya se usó o no está pendiente.",
      downloadUrl: env.APP_DOWNLOAD_URL
    }));
    return;
  }

  const deepLink = buildInviteDeepLink(token);
  const downloadUrl = String(env.APP_DOWNLOAD_URL || "").trim();
  const androidPackage = "com.elisum1.parejaneon";
  // Intent: abre la app si está instalada; si no, cae a la página de descarga.
  const androidIntent = `intent://invite?token=${encodeURIComponent(token)}#Intent;scheme=pareja-neon;package=${androidPackage};S.browser_fallback_url=${encodeURIComponent(downloadUrl)};end`;

  res.status(200).type("html").send(inviteLandingHtml({
    ok: true,
    title: "Abrir Metriclove",
    body: "Si ya tienes la app, se abrirá para aceptar la vinculación. Si no, te llevamos a descargarla.",
    deepLink,
    androidIntent,
    downloadUrl,
    token
  }));
});

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inviteLandingHtml({ ok, title, body, deepLink = "", androidIntent = "", downloadUrl = "", token = "" }) {
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body);
  const safeDeep = escapeHtml(deepLink);
  const safeDownload = escapeHtml(downloadUrl);

  const autoOpenScript = ok && deepLink
    ? `
<script>
(function () {
  var deep = ${JSON.stringify(deepLink)};
  var intent = ${JSON.stringify(androidIntent)};
  var download = ${JSON.stringify(downloadUrl)};
  var ua = navigator.userAgent || "";
  var isAndroid = /Android/i.test(ua);
  var started = Date.now();

  function goDownload() {
    if (download) window.location.replace(download);
  }

  function tryOpen() {
    if (isAndroid && intent) {
      window.location.href = intent;
      return;
    }
    window.location.href = deep;
  }

  tryOpen();

  // Si la app no abre, tras un momento ofrecemos / forzamos descarga.
  setTimeout(function () {
    if (document.hidden) return;
    if (Date.now() - started < 1600) goDownload();
  }, 1800);
})();
</script>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#6B3DDB" />
  <title>${safeTitle} · Metriclove</title>
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background: linear-gradient(165deg, #6B3DDB 0%, #A64DFF 45%, #FF4D8D 100%);
      min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px;
    }
    .card {
      width: 100%; max-width: 420px; background: #fff; border-radius: 24px; padding: 28px 22px;
      box-shadow: 0 18px 50px rgba(30,30,63,.22); text-align: center;
    }
    h1 { margin: 0 0 10px; font-size: 1.45rem; color: #1E1E3F; }
    p { margin: 0 0 22px; color: #5b5b7a; line-height: 1.5; font-size: .98rem; }
    .btn {
      display: block; width: 100%; box-sizing: border-box; text-decoration: none; border-radius: 14px;
      padding: 14px 16px; font-weight: 700; font-size: 1rem; margin-bottom: 10px;
    }
    .primary { background: #6B3DDB; color: #fff; }
    .secondary { background: rgba(107,61,219,.1); color: #6B3DDB; }
    .hint { margin-top: 14px; font-size: .78rem; color: #8a8aa3; }
    code { font-size: .7rem; word-break: break-all; color: #6B3DDB; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${safeTitle}</h1>
    <p>${safeBody}</p>
    ${ok && deepLink ? `<a class="btn primary" href="${safeDeep}">Abrir Metriclove</a>` : ""}
    ${downloadUrl ? `<a class="btn secondary" href="${safeDownload}">Descargar la app</a>` : ""}
    ${ok ? `<p class="hint">Si no se abre sola, usa los botones de arriba.</p>` : ""}
  </div>
  ${autoOpenScript}
</body>
</html>`;
}

invitesRouter.get("/:token", async (req, res) => {
  const token = String(req.params.token || "");
  const rows = await dbQuery(
    `select i.id, i.inviter_user_id, i.phone_e164, i.status, i.expires_at,
            u.email as inviter_email, u.username as inviter_username, u.display_name as inviter_display_name, u.photo_url as inviter_photo_url
     from invite i
     join app_user u on u.id=i.inviter_user_id
     where i.token=?
     limit 1`,
    [token]
  );
  const inv = rows[0];
  if (!inv) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  res.json({
    invite: {
      id: inv.id,
      inviter_user_id: inv.inviter_user_id,
      inviter_email: inv.inviter_email,
      inviter_username: inv.inviter_username || null,
      inviter_display_name: inv.inviter_display_name || null,
      inviter_photo_url: inv.inviter_photo_url || null,
      phone_e164: inv.phone_e164 || null,
      status: inv.status,
      expires_at: inv.expires_at
    }
  });
});

invitesRouter.post("/:token/accept", requireAuth, async (req, res) => {
  const userId = req.userId;
  const token = String(req.params.token || "");

  const rows = await dbQuery(
    "select id, inviter_user_id, target_user_id, status, expires_at from invite where token=? limit 1",
    [token]
  );
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
  if (inv.target_user_id && inv.target_user_id !== userId) {
    res.status(409).json({ error: "INVITE_NOT_FOR_YOU" });
    return;
  }

  const dup = await dbQuery(
    "select id from couple where (user_a_id=? and user_b_id=?) or (user_a_id=? and user_b_id=?) limit 1",
    [userId, inv.inviter_user_id, inv.inviter_user_id, userId]
  );
  if (dup[0]) {
    res.status(409).json({ error: "ALREADY_LINKED_THIS_PAIR" });
    return;
  }

  const coupleId = randomUUID();
  await dbQuery("insert into couple (id, user_a_id, user_b_id) values (?, ?, ?)", [coupleId, inv.inviter_user_id, userId]);
  await dbQuery("update invite set status='accepted', accepted_user_id=? where id=?", [userId, inv.id]);

  try {
    await notifyInviteAccepted({
      inviterUserId: inv.inviter_user_id,
      acceptedUserId: userId,
      coupleId,
      inviteId: inv.id
    });
  } catch (e) {
    console.log("[invites] notifyInviteAccepted failed:", e?.message || e);
  }

  res.json({ couple: { id: coupleId, userAId: inv.inviter_user_id, userBId: userId } });
});

invitesRouter.delete("/:id", requireAuth, async (req, res) => {
  const userId = req.userId;
  const id = String(req.params.id || "");
  const rows = await dbQuery("select id, inviter_user_id, status from invite where id=? limit 1", [id]);
  const inv = rows[0];
  if (!inv) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  if (inv.inviter_user_id !== userId) {
    res.status(403).json({ error: "FORBIDDEN" });
    return;
  }
  if (inv.status !== "pending") {
    /** Idempotente: la UI puede estar desactualizada (caché); no fallar al “cancelar” de nuevo. */
    res.json({ ok: true, skipped: true, status: inv.status });
    return;
  }
  await dbQuery("delete from invite where id=? and inviter_user_id=?", [id, userId]);
  res.json({ ok: true });
});

module.exports = { invitesRouter };
