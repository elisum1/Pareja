const express = require("express");
const { dbQuery } = require("../db");
const { requireAuth } = require("../auth/middleware");
const { categories, computeWeightsFromOrder, computeUserResults, extraQuestionsByCategory, tipsForCategory } = require("../domain/testModel");
const { buildCategoryDetailReport } = require("../domain/categoryDetailExplainer");
const { relationTests } = require("../domain/relationTestModel");
const {
  buildFollowUpPlan,
  buildMainTestNoInsightBlocks,
  categoryKeysWithMainTestNo
} = require("../domain/partnerFollowUp");
const { buildCoachContext, handleCoachMessage } = require("../domain/coupleCoachChat");
const { parseAnswersField } = require("../domain/coupleTestAnswers");

const resultsRouter = express.Router();

resultsRouter.get("/", requireAuth, async (req, res) => {
  const userId = req.userId;

  const questions = await dbQuery(
    "select id, category_key, question_order, text from test_question order by category_order asc, question_order asc"
  );

  const meRows = await dbQuery("select answers, completed from test_response where user_id=? limit 1", [userId]);
  const me = meRows[0];
  if (!me || !Boolean(me.completed)) {
    res.status(409).json({ error: "TEST_NOT_COMPLETED" });
    return;
  }

  const meAnswers = parseAnswersField(me.answers);
  const myPriority = await loadPriorityForUser(userId);
  const myResults = computeUserResults(questions, meAnswers, myPriority.weightsByKey);
  myResults.priorityOrder = myPriority.order;

  const couple = await dbQuery("select user_a_id, user_b_id from couple where user_a_id=? or user_b_id=? limit 1", [userId, userId]);
  const pair = couple[0];
  if (!pair) {
    res.json({
      me: myResults,
      partner: null,
      insights: buildInsights(myResults, null)
    });
    return;
  }

  const partnerId = pair.user_a_id === userId ? pair.user_b_id : pair.user_a_id;
  const partnerRows = await dbQuery("select answers, completed from test_response where user_id=? limit 1", [partnerId]);
  const partner = partnerRows[0];
  if (!partner || !Boolean(partner.completed)) {
    res.json({
      me: myResults,
      partner: { userId: partnerId, completed: false, results: null },
      insights: buildInsights(myResults, null)
    });
    return;
  }

  const partnerAnswers = parseAnswersField(partner.answers);
  const partnerPriority = await loadPriorityForUser(partnerId);
  const partnerResults = computeUserResults(questions, partnerAnswers, partnerPriority.weightsByKey);
  partnerResults.priorityOrder = partnerPriority.order;

  const partnerUserRows = await dbQuery(
    "select coalesce(nullif(trim(display_name),''), username, email) as label from app_user where id=? limit 1",
    [partnerId]
  );
  const partnerLabel = String(partnerUserRows[0]?.label || "Tu pareja").trim() || "Tu pareja";
  const partnerMainTestNos = buildMainTestNoInsightBlocks(questions, partnerAnswers, partnerLabel, {
    authorResults: partnerResults,
    partnerResults: myResults
  });
  const partnerCategoryKeysWithNo = categoryKeysWithMainTestNo(questions, partnerAnswers);
  const myCategoryKeysWithNo = categoryKeysWithMainTestNo(questions, meAnswers);

  res.json({
    me: myResults,
    partner: { userId: partnerId, completed: true, results: partnerResults },
    partnerLabel,
    partnerMainTestNos,
    partnerCategoryKeysWithNo,
    myCategoryKeysWithNo,
    insights: buildInsights(myResults, partnerResults)
  });
});

resultsRouter.get("/partner/:partnerUserId", requireAuth, async (req, res) => {
  const userId = req.userId;
  const partnerId = String(req.params.partnerUserId || "");
  if (!partnerId || partnerId === userId) {
    res.status(400).json({ error: "BAD_REQUEST" });
    return;
  }

  const link = await dbQuery(
    "select user_a_id, user_b_id from couple where (user_a_id=? and user_b_id=?) or (user_a_id=? and user_b_id=?) limit 1",
    [userId, partnerId, partnerId, userId]
  );
  if (!link[0]) {
    res.status(404).json({ error: "PARTNER_LINK_NOT_FOUND" });
    return;
  }

  const questions = await dbQuery(
    "select id, category_key, question_order, text from test_question order by category_order asc, question_order asc"
  );

  const meRows = await dbQuery("select answers, completed from test_response where user_id=? limit 1", [userId]);
  const me = meRows[0];
  if (!me || !Boolean(me.completed)) {
    res.status(409).json({ error: "TEST_NOT_COMPLETED" });
    return;
  }

  const meAnswers = parseAnswersField(me.answers);
  const myPriority = await loadPriorityForUser(userId);
  const myResults = computeUserResults(questions, meAnswers, myPriority.weightsByKey);
  myResults.priorityOrder = myPriority.order;

  const partnerRows = await dbQuery("select answers, completed from test_response where user_id=? limit 1", [partnerId]);
  const partner = partnerRows[0];

  let partnerPayload;
  let insightsPartner = null;
  if (!partner || !Boolean(partner.completed)) {
    partnerPayload = { userId: partnerId, completed: false, results: null };
  } else {
    const partnerAnswers = parseAnswersField(partner.answers);
    const partnerPriority = await loadPriorityForUser(partnerId);
    const partnerResults = computeUserResults(questions, partnerAnswers, partnerPriority.weightsByKey);
    partnerResults.priorityOrder = partnerPriority.order;
    partnerPayload = { userId: partnerId, completed: true, results: partnerResults };
    insightsPartner = partnerResults;
  }

  const myCategoryKeysWithNo = categoryKeysWithMainTestNo(questions, meAnswers);

  let partnerLabel = null;
  let partnerMainTestNos = null;
  let partnerCategoryKeysWithNo = null;
  if (partnerPayload?.completed && partnerPayload.results) {
    const partnerAnswers = parseAnswersField(partner.answers);
    const partnerUserRows = await dbQuery(
      "select coalesce(nullif(trim(display_name),''), username, email) as label from app_user where id=? limit 1",
      [partnerId]
    );
    partnerLabel = String(partnerUserRows[0]?.label || "Tu pareja").trim() || "Tu pareja";
    partnerMainTestNos = buildMainTestNoInsightBlocks(questions, partnerAnswers, partnerLabel, {
      authorResults: partnerPayload.results,
      partnerResults: myResults
    });
    partnerCategoryKeysWithNo = categoryKeysWithMainTestNo(questions, partnerAnswers);
  }

  res.json({
    me: myResults,
    partner: partnerPayload,
    partnerLabel,
    partnerMainTestNos,
    partnerCategoryKeysWithNo,
    myCategoryKeysWithNo,
    insights: buildInsights(myResults, insightsPartner)
  });
});

resultsRouter.get("/partner/:partnerUserId/follow-up", requireAuth, async (req, res) => {
  const userId = req.userId;
  const partnerId = String(req.params.partnerUserId || "");
  if (!partnerId || partnerId === userId) {
    res.status(400).json({ error: "BAD_REQUEST" });
    return;
  }

  const coupleRows = await dbQuery(
    "select id, user_a_id, user_b_id from couple where (user_a_id=? and user_b_id=?) or (user_a_id=? and user_b_id=?) limit 1",
    [userId, partnerId, partnerId, userId]
  );
  const couple = coupleRows[0];
  if (!couple) {
    res.status(404).json({ error: "PARTNER_LINK_NOT_FOUND" });
    return;
  }

  const questions = await dbQuery(
    "select id, category_key, question_order, text from test_question order by category_order asc, question_order asc"
  );
  const meRows = await dbQuery("select answers, completed from test_response where user_id=? limit 1", [userId]);
  const me = meRows[0];
  if (!me || !Boolean(me.completed)) {
    res.status(409).json({ error: "TEST_NOT_COMPLETED" });
    return;
  }

  const partnerRows = await dbQuery("select answers, completed from test_response where user_id=? limit 1", [partnerId]);
  const partner = partnerRows[0];
  if (!partner || !Boolean(partner.completed)) {
    res.status(409).json({ error: "PARTNER_TEST_NOT_COMPLETED" });
    return;
  }

  const meAnswers = parseAnswersField(me.answers);
  const partnerAnswers = parseAnswersField(partner.answers);
  const [myPriority, partnerPriority] = await Promise.all([loadPriorityForUser(userId), loadPriorityForUser(partnerId)]);
  const myResults = computeUserResults(questions, meAnswers, myPriority.weightsByKey);
  const partnerResults = computeUserResults(questions, partnerAnswers, partnerPriority.weightsByKey);
  myResults.priorityOrder = myPriority.order;
  partnerResults.priorityOrder = partnerPriority.order;

  const partnerUserRows = await dbQuery(
    "select coalesce(nullif(trim(display_name),''), username, email) as label from app_user where id=? limit 1",
    [partnerId]
  );
  const partnerLabel = String(partnerUserRows[0]?.label || "Tu pareja").trim() || "Tu pareja";

  const partnerMainTestNos = buildMainTestNoInsightBlocks(questions, partnerAnswers, partnerLabel, {
    authorResults: partnerResults,
    partnerResults: myResults
  });
  const myCategoryKeysWithNo = categoryKeysWithMainTestNo(questions, meAnswers);
  const partnerCategoryKeysWithNo = categoryKeysWithMainTestNo(questions, partnerAnswers);

  const plan = buildFollowUpPlan({
    partnerLabel,
    myResults,
    partnerResults,
    userIdA: userId,
    userIdB: partnerId
  });

  res.json({
    coupleId: couple.id,
    partnerUserId: partnerId,
    partnerLabel,
    partnerMainTestNos,
    partnerCategoryKeysWithNo,
    myCategoryKeysWithNo,
    ...plan
  });
});

resultsRouter.post("/partner/:partnerUserId/coach-chat", requireAuth, async (req, res) => {
  const userId = req.userId;
  const partnerId = String(req.params.partnerUserId || "");
  const message = String(req.body?.message || "").trim();
  if (!partnerId || partnerId === userId) {
    res.status(400).json({ error: "BAD_REQUEST" });
    return;
  }
  if (!message || message.length > 2000) {
    res.status(400).json({ error: "BAD_REQUEST" });
    return;
  }

  const coupleRows = await dbQuery(
    "select id from couple where (user_a_id=? and user_b_id=?) or (user_a_id=? and user_b_id=?) limit 1",
    [userId, partnerId, partnerId, userId]
  );
  if (!coupleRows[0]) {
    res.status(404).json({ error: "PARTNER_LINK_NOT_FOUND" });
    return;
  }

  const questions = await dbQuery(
    "select id, category_key, question_order, text from test_question order by category_order asc, question_order asc"
  );
  const meRows = await dbQuery("select answers, completed from test_response where user_id=? limit 1", [userId]);
  const partnerRows = await dbQuery("select answers, completed from test_response where user_id=? limit 1", [partnerId]);
  if (!meRows[0]?.completed || !partnerRows[0]?.completed) {
    res.status(409).json({ error: "BOTH_TESTS_REQUIRED" });
    return;
  }

  const meAnswers = parseAnswersField(meRows[0].answers);
  const partnerAnswers = parseAnswersField(partnerRows[0].answers);
  const [myPriority, partnerPriority] = await Promise.all([loadPriorityForUser(userId), loadPriorityForUser(partnerId)]);
  const myResults = computeUserResults(questions, meAnswers, myPriority.weightsByKey);
  const partnerResults = computeUserResults(questions, partnerAnswers, partnerPriority.weightsByKey);

  const partnerUserRows = await dbQuery(
    "select coalesce(nullif(trim(display_name),''), username, email) as label from app_user where id=? limit 1",
    [partnerId]
  );
  const partnerLabel = String(partnerUserRows[0]?.label || "Tu pareja").trim() || "Tu pareja";

  const ctx = buildCoachContext({
    myResults,
    partnerResults,
    partnerLabel,
    userIdA: userId,
    userIdB: partnerId,
    questions,
    meAnswers,
    partnerAnswers
  });

  const history = Array.isArray(req.body?.history)
    ? req.body.history
        .filter((h) => h && (h.role === "user" || h.role === "coach") && String(h.text || "").trim())
        .slice(-10)
        .map((h) => ({ role: h.role, text: String(h.text).trim() }))
    : [];

  const { reply, suggestedPrompts, intent, contextSummary } = handleCoachMessage(message, ctx, history);

  res.json({
    reply,
    suggestedPrompts,
    intent,
    partnerLabel,
    contextSummary
  });
});

resultsRouter.get("/relation/:testType", requireAuth, async (req, res) => {
  const userId = req.userId;
  const testType = String(req.params.testType || "");
  if (!relationTests[testType]) {
    res.status(404).json({ error: "TEST_TYPE_NOT_FOUND" });
    return;
  }

  const rows = await dbQuery(
    "select test_type, score, classification, by_category, tips, completed, completed_at, updated_at from relation_test_result where user_id=? and test_type=? limit 1",
    [userId, testType]
  );
  const row = rows[0];
  if (!row || !Boolean(row.completed)) {
    res.status(409).json({ error: "TEST_NOT_COMPLETED" });
    return;
  }

  const byCategory = typeof row.by_category === "string" ? JSON.parse(row.by_category || "[]") : row.by_category ?? [];
  const tips = typeof row.tips === "string" ? JSON.parse(row.tips || "[]") : row.tips ?? [];
  res.json({
    isLocal: true,
    testType,
    title: relationTests[testType].title,
    subtitle: relationTests[testType].subtitle,
    score: Number(row.score ?? 0),
    clasificacion: row.classification,
    byCategory,
    tips,
    completedAt: row.completed_at,
    updatedAt: row.updated_at
  });
});

async function loadPriorityForUser(userId) {
  const defaultOrder = categories.map((c) => c.key);
  const rows = await dbQuery("select category_key, rank from user_priority where user_id=? order by rank asc", [userId]);
  if (rows.length !== categories.length) {
    return { order: defaultOrder, weightsByKey: null };
  }
  const order = rows.map((r) => r.category_key);
  return { order, weightsByKey: computeWeightsFromOrder(order) };
}

function buildInsights(me, partner) {
  const base = partner
    ? me.byCategory.map((c) => {
        const p = partner.byCategory.find((x) => x.key === c.key);
        return {
          key: c.key,
          label: c.label,
          me: c.score,
          partner: p?.score ?? null,
          diff: p ? Math.abs(c.score - p.score) : 0
        };
      })
    : me.byCategory.map((c) => ({ key: c.key, label: c.label, me: c.score, partner: null, diff: 0 }));

  const topDiffs = [...base].sort((a, b) => b.diff - a.diff).slice(0, 3);

  const combined = me.byCategory.map((c) => {
    const p = partner?.byCategory.find((x) => x.key === c.key);
    const avg = p ? (c.score + p.score) / 2 : c.score;
    return { key: c.key, label: c.label, score: avg };
  });

  const lows = [...combined]
    .sort((a, b) => a.score - b.score)
    .slice(0, 2);

  const followUps = lows.flatMap((c) => {
    const qs = extraQuestionsByCategory[c.key] ?? [];
    return qs.map((q) => ({ categoryKey: c.key, categoryLabel: c.label, question: q }));
  });

  const tips = combined.flatMap((c) => {
    const seedPair = partner ? { a: "me", b: "partner" } : null;
    return tipsForCategory(c.key, c.score, seedPair).map((t) => ({ categoryKey: c.key, tip: t }));
  });

  return { topDiffs, lows, followUps, tips };
}

async function getCategoryDetailHandler(req, res) {
  const userId = req.userId;
  const categoryKey = String(req.params.categoryKey || req.query.key || "").trim();
  const cat = categories.find((c) => c.key === categoryKey);
  if (!categoryKey) {
    res.status(400).json({ error: "BAD_REQUEST" });
    return;
  }
  if (!cat) {
    res.status(400).json({ error: "UNKNOWN_CATEGORY" });
    return;
  }

  const questions = await dbQuery(
    "select id, category_key, text from test_question order by category_order asc, question_order asc"
  );

  const meRows = await dbQuery("select answers, completed from test_response where user_id=? limit 1", [userId]);
  const me = meRows[0];
  if (!me || !Boolean(me.completed)) {
    res.status(409).json({ error: "TEST_NOT_COMPLETED" });
    return;
  }

  const meAnswers = parseAnswersField(me.answers);
  const myPriority = await loadPriorityForUser(userId);
  const myResults = computeUserResults(questions, meAnswers, myPriority.weightsByKey);
  const row = myResults.byCategory.find((c) => c.key === categoryKey);
  const weight = row?.weight ?? cat.weight;
  const qs = questions.filter((q) => q.category_key === categoryKey);
  const detail = buildCategoryDetailReport(categoryKey, cat.label, weight, qs, meAnswers);
  res.json(detail);
}

module.exports = { resultsRouter, getCategoryDetailHandler };
