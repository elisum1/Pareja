/** Parches de esquema en caliente (Render: la DB de runtime no es la del build). */
function ensureAppUserProfileColumns(db) {
  const cols = db.prepare("pragma table_info(app_user)").all();
  const names = new Set(cols.map((c) => String(c.name || "").toLowerCase()));
  if (!names.has("display_name")) {
    db.exec("alter table app_user add column display_name text;");
  }
  if (!names.has("photo_url")) {
    db.exec("alter table app_user add column photo_url text;");
  }
  if (!names.has("username")) {
    db.exec("alter table app_user add column username text;");
  }
  if (!names.has("age")) {
    db.exec("alter table app_user add column age integer;");
  }
  if (!names.has("phone")) {
    db.exec("alter table app_user add column phone text;");
  }
  if (!names.has("country")) {
    db.exec("alter table app_user add column country text;");
  }
  if (!names.has("city")) {
    db.exec("alter table app_user add column city text;");
  }
  if (!names.has("bio")) {
    db.exec("alter table app_user add column bio text;");
  }
  db.exec(
    "create unique index if not exists app_user_username_unique on app_user(lower(username)) where username is not null;"
  );
}

function ensureInviteColumns(db) {
  const cols = db.prepare("pragma table_info(invite)").all();
  const names = new Set(cols.map((c) => String(c.name || "").toLowerCase()));
  if (!names.has("target_user_id")) {
    db.exec("alter table invite add column target_user_id text references app_user(id) on delete set null;");
  }
  db.exec("create index if not exists invite_target_user_idx on invite(target_user_id);");
}

function ensureRuntimeSchema(db) {
  ensureAppUserProfileColumns(db);
  ensureInviteColumns(db);
}

module.exports = {
  ensureAppUserProfileColumns,
  ensureInviteColumns,
  ensureRuntimeSchema
};
