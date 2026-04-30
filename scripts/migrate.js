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
    ["estabilidad economica financiera", "eco"],
    ["comunicacion", "comunicacion"],
    ["diversion", "diversion"],
    ["organizacion", "organizacion"],
    ["fisico", "fisico"]
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

  const dbPath = path.isAbsolute(env.SQLITE_PATH) ? env.SQLITE_PATH : path.join(__dirname, "..", env.SQLITE_PATH);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  try {
    db.exec(sql);
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

main().catch((e) => {
  process.stderr.write(`${e?.message ?? e}\n`);
  process.exit(1);
});
