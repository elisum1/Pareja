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
    `select id, username, display_name, photo_url
     from app_user
     where username is not null
       and id != ?
       and (lower(username) like ? or lower(coalesce(display_name,'')) like ?)
     order by case when lower(username) like ? then 0 else 1 end, lower(username)
     limit 12`,
    [req.userId, like, like, prefixLike]
  );
  res.json({
    users: rows.map((r) => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name || null,
      photoUrl: r.photo_url || null
    }))
  });
});

usersRouter.get("/:username", requireAuth, async (req, res) => {
  const username = String(req.params.username || "").trim().toLowerCase();
  if (!username) {
    res.status(400).json({ error: "USERNAME_REQUIRED" });
    return;
  }
  const rows = await dbQuery(
    "select id, username, display_name, photo_url from app_user where lower(username)=? limit 1",
    [username]
  );
  if (!rows[0]) {
    res.status(404).json({ error: "NOT_FOUND" });
    return;
  }
  const r = rows[0];
  res.json({
    user: {
      id: r.id,
      username: r.username,
      displayName: r.display_name || null,
      photoUrl: r.photo_url || null
    }
  });
});

module.exports = { usersRouter };
