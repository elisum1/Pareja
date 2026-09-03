const express = require("express");
const { dbQuery } = require("../db");
const { requireAuth } = require("../auth/middleware");

const usersRouter = express.Router();

usersRouter.get("/search", requireAuth, async (req, res) => {
  const raw = String(req.query.q ?? "").trim().toLowerCase();
  if (raw.length < 2) {
    res.json({ users: [] });
    return;
  }
  const cleaned = raw.replace(/[%_]/g, "");
  const like = `%${cleaned}%`;
  const prefixLike = `${cleaned}%`;
  const rows = await dbQuery(
    `select id, email, username, display_name, photo_url
     from app_user
     where id != ?
       and (
         lower(coalesce(display_name,'')) like ?
         or lower(email) like ?
         or lower(coalesce(username,'')) like ?
       )
     order by
       case
         when lower(coalesce(display_name,'')) like ? then 0
         when lower(email) like ? then 1
         else 2
       end,
       lower(coalesce(nullif(trim(display_name),''), email))
     limit 12`,
    [req.userId, like, like, like, prefixLike, prefixLike]
  );
  res.json({
    users: rows.map((r) => ({
      id: r.id,
      email: r.email || null,
      username: r.username || null,
      displayName: r.display_name || null,
      photoUrl: r.photo_url || null
    }))
  });
});

usersRouter.get("/by-id/:id", requireAuth, async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) {
    res.status(400).json({ error: "BAD_REQUEST" });
    return;
  }
  const rows = await dbQuery(
    "select id, email, username, display_name, photo_url from app_user where id=? limit 1",
    [id]
  );
  if (!rows[0]) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  const r = rows[0];
  res.json({
    user: {
      id: r.id,
      email: r.email || null,
      username: r.username || null,
      displayName: r.display_name || null,
      photoUrl: r.photo_url || null
    }
  });
});

module.exports = { usersRouter };
