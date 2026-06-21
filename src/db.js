const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { env } = require("./env");

const dbPath = path.isAbsolute(env.SQLITE_PATH) ? env.SQLITE_PATH : path.join(__dirname, "..", env.SQLITE_PATH);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const { applyMigrations } = require("../scripts/migrate");
const { ensureRuntimeSchema } = require("../scripts/schemaEnsure");

applyMigrations(db);
ensureRuntimeSchema(db);

function isReadQuery(sql) {
  const s = String(sql).trim().toLowerCase();
  return s.startsWith("select") || s.startsWith("pragma") || s.startsWith("with");
}

async function dbQuery(sql, params = []) {
  const stmt = db.prepare(sql);
  if (isReadQuery(sql)) {
    return stmt.all(params);
  }
  if (/\breturning\b/i.test(sql)) {
    const row = stmt.get(params);
    return row ? [row] : [];
  }
  stmt.run(params);
  return [];
}

module.exports = { db, dbPath, dbQuery };
