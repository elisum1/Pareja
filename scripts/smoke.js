const { randomUUID } = require("crypto");
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { env } = require("../src/env");
const { startServer } = require("../src/index");

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForHealth(baseUrl) {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${baseUrl}/health`);
      if (r.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error("API_NOT_READY");
}

async function api(baseUrl, path, opts) {
  const r = await fetch(`${baseUrl}${path}`, {
    method: opts?.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(opts?.token ? { authorization: `Bearer ${opts.token}` } : {})
    },
    body: opts?.body ? JSON.stringify(opts.body) : undefined
  });
  const text = await r.text();
  const data = text ? JSON.parse(text) : null;
  if (!r.ok) {
    const err = data && typeof data === "object" && "error" in data ? data.error : r.status;
    throw new Error(String(err));
  }
  return data;
}

async function main() {
  const { server } = startServer({ port: 0 });
  const address = server.address();
  const port = address && typeof address === "object" ? address.port : env.PORT;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await waitForHealth(baseUrl);

    const suffix = randomUUID().slice(0, 8);
    const emailA = `a_${suffix}@demo.local`;
    const emailB = `b_${suffix}@demo.local`;
    const password = `Passw0rd_${suffix}`;

    const regA = await api(baseUrl, "/auth/register", { method: "POST", body: { email: emailA, password } });
    const tokenA = regA.token;
    const userAId = regA.user.id;

    const invite = await api(baseUrl, "/invites", {
      method: "POST",
      token: tokenA,
      body: { phoneE164: "+521234567890" }
    });
    const inviteToken = invite.invite.token;

    const regB = await api(baseUrl, "/auth/register", { method: "POST", body: { email: emailB, password } });
    const tokenB = regB.token;
    const userBId = regB.user.id;

    await api(baseUrl, `/invites/${inviteToken}/accept`, { method: "POST", token: tokenB });

    const q = await api(baseUrl, "/test/questions");
    const questions = q.questions;
    if (!Array.isArray(questions) || questions.length === 0) throw new Error("NO_QUESTIONS");

    const answersA = {};
    const answersB = {};
    for (let i = 0; i < questions.length; i++) {
      const id = String(questions[i].id);
      answersA[id] = i % 2 === 0 ? 1 : 0;
      answersB[id] = i % 3 === 0 ? 1 : 0;
    }

    const submitA = await api(baseUrl, "/test/submit", {
      method: "POST",
      token: tokenA,
      body: { answers: answersA }
    });
    const submitB = await api(baseUrl, "/test/submit", {
      method: "POST",
      token: tokenB,
      body: { answers: answersB }
    });
    if (!submitA.response.completed || !submitB.response.completed) throw new Error("TEST_NOT_COMPLETED_AFTER_SUBMIT");

    const resultsA = await api(baseUrl, "/results", { method: "GET", token: tokenA });
    if (!resultsA.partner || !resultsA.partner.completed) throw new Error("PARTNER_RESULTS_NOT_READY");

    const dbPath = path.isAbsolute(env.SQLITE_PATH) ? env.SQLITE_PATH : path.join(__dirname, "..", env.SQLITE_PATH);
    if (!fs.existsSync(dbPath)) throw new Error("SQLITE_DB_NOT_FOUND");

    const db = new Database(dbPath, { readonly: true });
    try {
      const rows = db
        .prepare("select user_id, completed, answers from test_response where user_id in (?, ?)")
        .all([userAId, userBId]);
      if (rows.length !== 2) throw new Error("DB_MISSING_TEST_RESPONSES");
      for (const r of rows) {
        if (!Boolean(r.completed)) throw new Error("DB_RESPONSE_NOT_COMPLETED");
        const parsed = typeof r.answers === "string" ? JSON.parse(r.answers || "{}") : {};
        if (Object.keys(parsed).length === 0) throw new Error("DB_ANSWERS_EMPTY");
      }
      const couple = db
        .prepare("select id from couple where (user_a_id=? and user_b_id=?) or (user_a_id=? and user_b_id=?) limit 1")
        .get([userAId, userBId, userBId, userAId]);
      if (!couple) throw new Error("DB_COUPLE_NOT_CREATED");
    } finally {
      db.close();
    }

    process.stdout.write("SMOKE_OK\n");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((e) => {
  process.stderr.write(`${e?.message ?? e}\n`);
  process.exit(1);
});
