const express = require("express");
const crypto = require("crypto");
const { z } = require("zod");
const { db, dbQuery } = require("../db");
const { requireAuth } = require("../auth/middleware");
const { categories, computeWeightsFromOrder } = require("../domain/testModel");
const { normalizeAnswersForPersist } = require("../domain/coupleTestAnswers");
const { relationTests, getRelationTest, computeRelationResult } = require("../domain/relationTestModel");

const testRouter = express.Router();

testRouter.get("/questions", async (_req, res) => {
  const questions = await dbQuery("select id, category_key, text from test_question order by category_order asc, question_order asc");
  res.json({ questions });
});

const prioritiesSchema = z.object({
  order: z.array(z.string())
});

testRouter.get("/priorities", requireAuth, async (req, res) => {
  const userId = req.userId;
  const rows = await dbQuery("select category_key, rank from user_priority where user_id=? order by rank asc", [userId]);
  const savedOrder = rows.map((r) => r.category_key);
  const saved = savedOrder.length === categories.length;
  const order = saved ? savedOrder : categories.map((c) => c.key);
  const weights = computeWeightsFromOrder(order);
  res.json({
    saved,
    order,
    weights: categories.map((c, idx) => ({
      key: c.key,
      label: c.label,
      rank: order.indexOf(c.key) + 1 || idx + 1,
      weight: weights[c.key] ?? 0,
      percent: Math.round((weights[c.key] ?? 0) * 100)
    }))
  });
});

testRouter.post("/priorities", requireAuth, async (req, res) => {
  const userId = req.userId;
  const parsed = prioritiesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "BAD_REQUEST", details: parsed.error.flatten() });
    return;
  }

  const order = parsed.data.order.map(String);
  const keys = categories.map((c) => c.key);
  const unique = new Set(order);
  const valid = order.length === keys.length && unique.size === keys.length && keys.every((k) => unique.has(k));
  if (!valid) {
    res.status(400).json({ error: "INVALID_ORDER" });
    return;
  }

  const tx = db.transaction(() => {
    db.prepare("delete from user_priority where user_id=?").run(userId);
    const ins = db.prepare("insert into user_priority (user_id, category_key, rank) values (?, ?, ?)");
    for (let i = 0; i < order.length; i += 1) {
      ins.run(userId, order[i], i + 1);
    }
  });
  tx();

  const weights = computeWeightsFromOrder(order);
  res.json({
    ok: true,
    order,
    weights: categories.map((c) => ({
      key: c.key,
      label: c.label,
      rank: order.indexOf(c.key) + 1,
      weight: weights[c.key] ?? 0,
      percent: Math.round((weights[c.key] ?? 0) * 100)
    }))
  });
});

const submitSchema = z.object({
  answers: z.record(z.string(), z.any())
});

testRouter.post("/submit", requireAuth, async (req, res) => {
  const userId = req.userId;
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "BAD_REQUEST", details: parsed.error.flatten() });
    return;
  }

  const questions = await dbQuery("select id from test_question order by id asc");
  const questionIds = questions.map((q) => q.id);
  const total = questionIds.length;
  const { answers: normalizedAnswers, missing } = normalizeAnswersForPersist(parsed.data.answers, questionIds);
  const answered = total - missing.length;

  if (missing.length > 0) {
    res.status(400).json({
      error: "BAD_REQUEST",
      message: "Cada pregunta debe tener respuesta 0 o 1 (Sí/No).",
      missingQuestionIds: missing.slice(0, 48),
      missingCount: missing.length
    });
    return;
  }

  const completed = total > 0;
  const completedInt = completed ? 1 : 0;

  const existing = await dbQuery("select id from test_response where user_id=? limit 1", [userId]);
  if (existing[0]) {
    await dbQuery(
      "update test_response set answers=?, completed=?, completed_at=case when ? then strftime('%Y-%m-%dT%H:%M:%fZ','now') else null end, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') where id=?",
      [JSON.stringify(normalizedAnswers), completedInt, completedInt, existing[0].id]
    );
    res.json({ response: { id: existing[0].id, completed, answered, total } });
    return;
  }

  const responseId = require("crypto").randomUUID();
  await dbQuery(
    "insert into test_response (id, user_id, answers, completed, completed_at, updated_at) values (?, ?, ?, ?, case when ? then strftime('%Y-%m-%dT%H:%M:%fZ','now') else null end, strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
    [responseId, userId, JSON.stringify(normalizedAnswers), completedInt, completedInt]
  );
  res.json({ response: { id: responseId, completed, answered, total } });
});

testRouter.post("/reset", requireAuth, async (req, res) => {
  const userId = req.userId;
  const existing = await dbQuery("select id from test_response where user_id=? limit 1", [userId]);
  if (existing[0]) {
    await dbQuery(
      "update test_response set answers='{}', completed=0, completed_at=null, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') where user_id=?",
      [userId]
    );
  } else {
    await dbQuery(
      "insert into test_response (id, user_id, answers, completed, updated_at) values (?, ?, '{}', 0, strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
      [crypto.randomUUID(), userId]
    );
  }
  res.json({ ok: true });
});

testRouter.get("/status", requireAuth, async (req, res) => {
  const userId = req.userId;
  const me = await dbQuery("select completed from test_response where user_id=?", [userId]);

  const couple = await dbQuery("select user_a_id, user_b_id from couple where user_a_id=? or user_b_id=? limit 1", [userId, userId]);
  const pair = couple[0];
  if (!pair) {
    res.json({ me: { completed: Boolean(me[0]?.completed) }, partner: null });
    return;
  }
  const partnerId = pair.user_a_id === userId ? pair.user_b_id : pair.user_a_id;
  const partner = await dbQuery("select completed from test_response where user_id=?", [partnerId]);
  res.json({
    me: { completed: Boolean(me[0]?.completed) },
    partner: { userId: partnerId, completed: Boolean(partner[0]?.completed) }
  });
});

testRouter.get("/relation/:testType/questions", requireAuth, async (req, res) => {
  const testType = String(req.params.testType || "");
  const test = getRelationTest(testType);
  if (!test) {
    res.status(404).json({ error: "TEST_TYPE_NOT_FOUND" });
    return;
  }
  res.json({
    testType,
    title: test.title,
    subtitle: test.subtitle,
    questions: test.questions.map((q) => ({ id: q.id, category_key: q.category_key, text: q.text })),
    categories: Object.fromEntries(Object.entries(test.categories).map(([k, v]) => [k, v.label]))
  });
});

testRouter.post("/relation/:testType/submit", requireAuth, async (req, res) => {
  const userId = req.userId;
  const testType = String(req.params.testType || "");
  if (!relationTests[testType]) {
    res.status(404).json({ error: "TEST_TYPE_NOT_FOUND" });
    return;
  }
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "BAD_REQUEST", details: parsed.error.flatten() });
    return;
  }

  const test = relationTests[testType];
  const questions = test.questions;
  const total = questions.length;
  const answered = questions.reduce((acc, q) => acc + (parsed.data.answers[String(q.id)] !== undefined ? 1 : 0), 0);
  const completed = total > 0 && answered === total;
  const completedInt = completed ? 1 : 0;
  const computed = computeRelationResult(testType, parsed.data.answers);

  const existing = await dbQuery("select id from relation_test_result where user_id=? and test_type=? limit 1", [userId, testType]);
  if (existing[0]) {
    await dbQuery(
      "update relation_test_result set answers=?, score=?, classification=?, by_category=?, tips=?, completed=?, completed_at=case when ? then strftime('%Y-%m-%dT%H:%M:%fZ','now') else null end, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') where id=?",
      [
        JSON.stringify(parsed.data.answers),
        computed?.score ?? 0,
        computed?.classification ?? "MEJORABLE",
        JSON.stringify(computed?.byCategory ?? []),
        JSON.stringify(computed?.tips ?? []),
        completedInt,
        completedInt,
        existing[0].id
      ]
    );
    res.json({ result: { id: existing[0].id, testType, completed, answered, total, score: computed?.score ?? 0 } });
    return;
  }

  const id = crypto.randomUUID();
  await dbQuery(
    "insert into relation_test_result (id, user_id, test_type, answers, score, classification, by_category, tips, completed, completed_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, case when ? then strftime('%Y-%m-%dT%H:%M:%fZ','now') else null end, strftime('%Y-%m-%dT%H:%M:%fZ','now'))",
    [
      id,
      userId,
      testType,
      JSON.stringify(parsed.data.answers),
      computed?.score ?? 0,
      computed?.classification ?? "MEJORABLE",
      JSON.stringify(computed?.byCategory ?? []),
      JSON.stringify(computed?.tips ?? []),
      completedInt,
      completedInt
    ]
  );
  res.json({ result: { id, testType, completed, answered, total, score: computed?.score ?? 0 } });
});

module.exports = { testRouter };
