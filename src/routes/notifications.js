const express = require("express");
const { dbQuery } = require("../db");
const { requireAuth } = require("../auth/middleware");
const { mapNotificationRow } = require("../domain/notifications");

const notificationsRouter = express.Router();

const LIST_SQL = `
  select
    n.id, n.type, n.title, n.body, n.actor_user_id, n.data_json, n.read_at, n.created_at,
    u.display_name as actor_display_name, u.username as actor_username, u.photo_url as actor_photo_url
  from app_notification n
  left join app_user u on u.id = n.actor_user_id
  where n.user_id = ?
  order by datetime(n.created_at) desc
  limit ?
`;

notificationsRouter.get("/", requireAuth, async (req, res) => {
  const userId = req.userId;
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const rows = await dbQuery(LIST_SQL, [userId, limit]);
  res.json({ notifications: rows.map(mapNotificationRow) });
});

notificationsRouter.get("/unread-count", requireAuth, async (req, res) => {
  const userId = req.userId;
  const rows = await dbQuery(
    "select count(*) as c from app_notification where user_id=? and read_at is null",
    [userId]
  );
  res.json({ count: Number(rows[0]?.c ?? 0) });
});

notificationsRouter.patch("/read-all", requireAuth, async (req, res) => {
  const userId = req.userId;
  await dbQuery(
    "update app_notification set read_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') where user_id=? and read_at is null",
    [userId]
  );
  res.json({ ok: true });
});

notificationsRouter.patch("/:id/read", requireAuth, async (req, res) => {
  const userId = req.userId;
  const id = String(req.params.id || "");
  const rows = await dbQuery("select id from app_notification where id=? and user_id=? limit 1", [id, userId]);
  if (!rows[0]) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  await dbQuery(
    "update app_notification set read_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') where id=? and user_id=?",
    [id, userId]
  );
  res.json({ ok: true });
});

module.exports = { notificationsRouter };
