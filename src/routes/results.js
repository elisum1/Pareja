const express = require("express");
const { dbQuery } = require("../db");
const { requireAuth } = require("../auth/middleware");
const { categories, computeWeightsFromOrder, computeUserResults, extraQuestionsByCategory, tipsForCategory } = require("../domain/testModel");
const { relationTests } = require("../domain/relationTestModel");

const resultsRouter = express.Router();

resultsRouter.get("/", requireAuth, async (req, res) => {
  const userId = req.userId;

  const questions = await dbQuery("select id, category_key, text from test_question order by category_order asc, question_order asc");

  const meRows = await dbQuery("select answers, completed from test_response where user_id=? limit 1", [userId]);
  const me = meRows[0];
  if (!me || !Boolean(me.completed)) {
    res.status(409).json({ error: "TEST_NOT_COMPLETED" });
    return;
  }

  const meAnswers = typeof me.answers === "string" ? JSON.parse(me.answers || "{}") : me.answers ?? {};
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

  const partnerAnswers = typeof partner.answers === "string" ? JSON.parse(partner.answers || "{}") : partner.answers ?? {};
  const partnerPriority = await loadPriorityForUser(partnerId);
  const partnerResults = computeUserResults(questions, partnerAnswers, partnerPriority.weightsByKey);
  partnerResults.priorityOrder = partnerPriority.order;

  res.json({
    me: myResults,
    partner: { userId: partnerId, completed: true, results: partnerResults },
    insights: buildInsights(myResults, partnerResults)
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
    .filter((c) => c.key !== "fisico")
    .sort((a, b) => a.score - b.score)
    .slice(0, 2);

  const followUps = lows.flatMap((c) => {
    const qs = extraQuestionsByCategory[c.key] ?? [];
    return qs.map((q) => ({ categoryKey: c.key, categoryLabel: c.label, question: q }));
  });

  const tips = combined.flatMap((c) => tipsForCategory(c.key, c.score).map((t) => ({ categoryKey: c.key, tip: t })));

  return { topDiffs, lows, followUps, tips };
}

module.exports = { resultsRouter };
