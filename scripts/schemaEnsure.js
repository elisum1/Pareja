function tableExists(db, tableName) {
  const row = db
    .prepare("select 1 as ok from sqlite_master where type = 'table' and name = ?")
    .get(tableName);
  return Boolean(row?.ok);
}

/** Parches de esquema en caliente (Render: la DB de runtime no es la del build). */
function ensureAppUserProfileColumns(db) {
  if (!tableExists(db, "app_user")) return;
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
  if (!tableExists(db, "invite")) return;
  const cols = db.prepare("pragma table_info(invite)").all();
  const names = new Set(cols.map((c) => String(c.name || "").toLowerCase()));
  if (!names.has("target_user_id")) {
    db.exec("alter table invite add column target_user_id text references app_user(id) on delete set null;");
  }
  db.exec("create index if not exists invite_target_user_idx on invite(target_user_id);");
}

function ensureComparisonTestTable(db) {
  if (!tableExists(db, "app_user")) return;
  db.exec(`
    create table if not exists comparison_test_result (
      id text primary key,
      user_id text not null references app_user(id) on delete cascade,
      person_a_name text not null,
      person_a_avatar text,
      person_b_name text not null,
      person_b_avatar text,
      priority_order text not null default '[]',
      ratings_a text not null default '{}',
      ratings_b text not null default '{}',
      result_json text not null default '{}',
      score_a real not null default 0,
      score_b real not null default 0,
      created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);
  db.exec("create index if not exists comparison_test_result_user_idx on comparison_test_result(user_id);");
}

function ensureAppNotificationTable(db) {
  if (!tableExists(db, "app_user")) return;
  db.exec(`
    create table if not exists app_notification (
      id text primary key,
      user_id text not null references app_user(id) on delete cascade,
      type text not null,
      title text not null,
      body text not null,
      actor_user_id text references app_user(id) on delete set null,
      data_json text not null default '{}',
      read_at text,
      created_at text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);
  db.exec("create index if not exists app_notification_user_created_idx on app_notification(user_id, datetime(created_at) desc);");
  db.exec(
    "create index if not exists app_notification_user_unread_idx on app_notification(user_id) where read_at is null;"
  );
}

function ensureRuntimeSchema(db) {
  ensureAppUserProfileColumns(db);
  ensureInviteColumns(db);
  ensureComparisonTestTable(db);
  ensureAppNotificationTable(db);
}

module.exports = {
  ensureAppUserProfileColumns,
  ensureInviteColumns,
  ensureComparisonTestTable,
  ensureAppNotificationTable,
  ensureRuntimeSchema
};
