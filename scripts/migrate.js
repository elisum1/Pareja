const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { env } = require("../src/env");
const { categories } = require("../src/domain/testModel");

function normalizeStr(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getRowValueInsensitive(row, candidateKeys) {
  const normalized = new Map(Object.keys(row).map((k) => [normalizeStr(k), k]));
  for (const k of candidateKeys) {
    const realKey = normalized.get(normalizeStr(k));
    if (realKey) return row[realKey];
  }
  return undefined;
}

function resolveCategoryKey(rawCategory) {
  const v = normalizeStr(rawCategory);
  if (!v) return null;

  const byKey = new Set(categories.map((c) => c.key));
  if (byKey.has(v)) return v;

  const labelToKey = new Map(
    categories.map((c) => [
      normalizeStr(c.label),
      c.key
    ])
  );
  if (labelToKey.has(v)) return labelToKey.get(v);

  const synonyms = new Map([
    ["economia", "eco"],
    ["economica", "eco"],
    ["estabilidad economica", "eco"],
    ["estabilidad financiera", "eco"],
    ["estabilidad economica financiera", "eco"],
    ["comunicacion", "comunicacion"],
    ["diversion", "diversion"],
    ["organizacion", "organizacion"],
    ["intimidad", "intimidad"],
    ["sexo", "intimidad"],
    ["convivencia social", "convivencia_social"],
    ["social", "convivencia_social"],
    ["cuidado personal", "cuidado_personal"],
    ["salud", "cuidado_personal"]
  ]);
  if (synonyms.has(v)) return synonyms.get(v);

  return null;
}

function parseCsvQuestions(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row = {};
    for (let i = 0; i < headers.length; i += 1) row[headers[i]] = values[i] ?? "";
    return row;
  });

  return rows;
}

function parseXlsxQuestions(filePath, sheetName) {
  const xlsx = require("xlsx");
  const workbook = xlsx.readFile(filePath);
  const name = sheetName || workbook.SheetNames[0];
  if (!name) return [];
  const sheet = workbook.Sheets[name];
  if (!sheet) return [];
  return xlsx.utils.sheet_to_json(sheet, { defval: "" });
}

function loadQuestionsFromSpreadsheet(filePath, sheetName) {
  const ext = normalizeStr(path.extname(filePath));
  const rows =
    ext === ".csv"
      ? parseCsvQuestions(filePath)
      : ext === ".xlsx" || ext === ".xlsm" || ext === ".xls"
        ? parseXlsxQuestions(filePath, sheetName)
        : null;

  if (!rows) {
    throw new Error(`Formato no soportado: ${path.extname(filePath)} (usa .xlsx o .csv)`);
  }

  const items = [];
  for (const row of rows) {
    const rawCategory = getRowValueInsensitive(row, [
      "category_key",
      "category",
      "categoria",
      "categoría",
      "dimension",
      "dimensión",
      "area",
      "área"
    ]);
    const rawText = getRowValueInsensitive(row, ["text", "pregunta", "question", "enunciado"]);
    const rawOrder = getRowValueInsensitive(row, ["question_order", "orden", "order", "n"]);

    const categoryKey = resolveCategoryKey(rawCategory);
    const text = String(rawText ?? "").trim();
    const questionOrder = Number(rawOrder);

    if (!categoryKey || !text) continue;
    items.push({
      categoryKey,
      text,
      questionOrder: Number.isFinite(questionOrder) ? questionOrder : null
    });
  }

  const byCategory = new Map(categories.map((c) => [c.key, []]));
  for (const it of items) {
    const list = byCategory.get(it.categoryKey);
    if (!list) continue;
    list.push(it);
  }

  const finalQuestions = [];
  for (const [idx, c] of categories.entries()) {
    const list = byCategory.get(c.key) ?? [];
    const hasAnyExplicitOrder = list.some((q) => q.questionOrder !== null);
    const ordered = hasAnyExplicitOrder
      ? [...list].sort((a, b) => (a.questionOrder ?? 999999) - (b.questionOrder ?? 999999))
      : list;

    for (let i = 0; i < ordered.length; i += 1) {
      finalQuestions.push({
        category_key: c.key,
        category_order: idx + 1,
        question_order: i + 1,
        text: ordered[i].text
      });
    }
  }

  const totalExpected = categories.reduce((acc, c) => acc + c.maxYes, 0);
  const totalActual = finalQuestions.length;
  if (totalActual !== totalExpected) {
    throw new Error(`Cantidad de preguntas inválida: ${totalActual}. Se esperan ${totalExpected}.`);
  }
  for (const c of categories) {
    const count = finalQuestions.filter((q) => q.category_key === c.key).length;
    if (count !== c.maxYes) {
      throw new Error(`Categoría "${c.key}" inválida: ${count} preguntas. Se esperan ${c.maxYes}.`);
    }
  }

  return finalQuestions;
}

async function main() {
  const sqlPath = path.join(__dirname, "..", "db", "migrations", "001_init_sqlite.sql");
  const sql = fs.readFileSync(sqlPath, "utf8");

  const sql002Path = path.join(__dirname, "..", "db", "migrations", "002_reseed_couple_test_v2.sql");
  const sql002 = fs.existsSync(sql002Path) ? fs.readFileSync(sql002Path, "utf8") : "";
  const sql003Path = path.join(__dirname, "..", "db", "migrations", "003_reseed_couple_test_excel_v3.sql");
  const sql003 = fs.existsSync(sql003Path) ? fs.readFileSync(sql003Path, "utf8") : "";

  const sql004Path = path.join(__dirname, "..", "db", "migrations", "004_reseed_couple_test_excel_v7.sql");
  const sql004 = fs.existsSync(sql004Path) ? fs.readFileSync(sql004Path, "utf8") : "";
  const sql005Path = path.join(__dirname, "..", "db", "migrations", "005_reseed_couple_test_excel_v8.sql");
  const sql005 = fs.existsSync(sql005Path) ? fs.readFileSync(sql005Path, "utf8") : "";
  const sql006Path = path.join(__dirname, "..", "db", "migrations", "006_reseed_couple_test_excel_v8_fix.sql");
  const sql006 = fs.existsSync(sql006Path) ? fs.readFileSync(sql006Path, "utf8") : "";
  const sql007Path = path.join(__dirname, "..", "db", "migrations", "007_restore_convivencia_hogar.sql");
  const sql007 = fs.existsSync(sql007Path) ? fs.readFileSync(sql007Path, "utf8") : "";

  const dbPath = path.isAbsolute(env.SQLITE_PATH) ? env.SQLITE_PATH : path.join(__dirname, "..", env.SQLITE_PATH);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  try {
    db.exec(sql);
    const applied002 = db.prepare("select 1 as ok from _app_migrations where name = ?").get("couple_test_v2");
    if (!applied002?.ok && sql002) {
      db.exec(sql002);
      db.prepare("insert into _app_migrations (name) values (?)").run("couple_test_v2");
    }
    const applied003 = db.prepare("select 1 as ok from _app_migrations where name = ?").get("couple_test_excel_v3");
    if (!applied003?.ok && sql003) {
      db.exec(sql003);
      db.prepare("insert into _app_migrations (name) values (?)").run("couple_test_excel_v3");
    }
    const applied004 = db.prepare("select 1 as ok from _app_migrations where name = ?").get("couple_test_excel_v7");
    if (!applied004?.ok && sql004) {
      db.exec(sql004);
      db.prepare("insert into _app_migrations (name) values (?)").run("couple_test_excel_v7");
    }
    const applied005 = db.prepare("select 1 as ok from _app_migrations where name = ?").get("couple_test_excel_v8");
    if (!applied005?.ok && sql005) {
      db.exec(sql005);
      db.prepare("insert into _app_migrations (name) values (?)").run("couple_test_excel_v8");
    }
    const applied006 = db.prepare("select 1 as ok from _app_migrations where name = ?").get("couple_test_excel_v8_fix");
    if (!applied006?.ok && sql006) {
      db.exec(sql006);
      db.prepare("insert into _app_migrations (name) values (?)").run("couple_test_excel_v8_fix");
    }
    const applied007 = db.prepare("select 1 as ok from _app_migrations where name = ?").get("couple_test_convivencia_hogar");
    if (!applied007?.ok && sql007) {
      db.exec(sql007);
      db.prepare("insert into _app_migrations (name) values (?)").run("couple_test_convivencia_hogar");
    }
    ensureAppUserProfileColumns(db);
    ensureInviteColumns(db);
    ensureComparisonTestTable(db);
    const args = process.argv.slice(2);
    const questionsPathArgIndex = args.findIndex((a) => a === "--questions" || a === "--preguntas");
    const questionsPathFromArg = questionsPathArgIndex >= 0 ? args[questionsPathArgIndex + 1] : null;
    const sheetArgIndex = args.findIndex((a) => a === "--sheet" || a === "--hoja");
    const sheetName = sheetArgIndex >= 0 ? args[sheetArgIndex + 1] : null;

    const questionsPath = questionsPathFromArg || process.env.QUESTIONS_XLSX_PATH || process.env.QUESTIONS_PATH || null;
    if (questionsPath) {
      const absQuestionsPath = path.isAbsolute(questionsPath) ? questionsPath : path.join(process.cwd(), questionsPath);
      if (!fs.existsSync(absQuestionsPath)) {
        throw new Error(`No existe el archivo de preguntas: ${absQuestionsPath}`);
      }

      const questions = loadQuestionsFromSpreadsheet(absQuestionsPath, sheetName);

      const insert = db.prepare(
        "insert into test_question (category_key, category_order, question_order, text) values (?, ?, ?, ?)"
      );
      const tx = db.transaction(() => {
        db.exec("delete from test_response;");
        db.exec("delete from test_question;");
        for (const q of questions) insert.run(q.category_key, q.category_order, q.question_order, q.text);
      });
      tx();

      process.stdout.write(`Preguntas importadas: ${questions.length} (${path.basename(absQuestionsPath)})\n`);
    }
    process.stdout.write(`Migration OK (${dbPath})\n`);
  } finally {
    db.close();
  }
}

const { ensureAppUserProfileColumns, ensureInviteColumns, ensureComparisonTestTable } = require("./schemaEnsure");

main().catch((e) => {
  process.stderr.write(`${e?.message ?? e}\n`);
  process.exit(1);
});
