const express = require("express");
const { randomUUID } = require("crypto");
const { z } = require("zod");
const { dbQuery } = require("../db");
const { requireAuth } = require("../auth/middleware");
const { categories, computeUserResults, computeWeightsFromOrder, tipsForCategory } = require("../domain/testModel");
const { parseAnswersField } = require("../domain/coupleTestAnswers");

const linkedRouter = express.Router();

const TASK_STATUS = new Set(["pending", "in_progress", "done"]);
const TEST_TYPES = ["amigos", "conocidos", "familia"];

const createTaskSchema = z.object({
  coupleId: z.string().min(1).optional(),
  title: z.string().min(3).max(120),
  description: z.string().max(500).optional()
});

const updateTaskSchema = z.object({
  title: z.string().min(3).max(120).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(["pending", "in_progress", "done"]).optional()
});

linkedRouter.get("/overview", requireAuth, async (req, res) => {
  const userId = req.userId;
  const linksMeta = await getLinksForUser(userId);

  const [meUser] = await dbQuery(
    "select id, email, username, display_name, photo_url from app_user where id=? limit 1",
    [userId]
  );

  const links = [];
  for (const link of linksMeta) {
    const [partnerUser] = await dbQuery(
      "select id, email, username, display_name, photo_url from app_user where id=? limit 1",
      [link.partnerId]
    );
    const [mainComparison, relationComparisons, tasks] = await Promise.all([
      buildMainComparison(userId, link.partnerId),
      buildRelationComparisons(userId, link.partnerId),
      loadTasks(link.id)
    ]);
    links.push({
      coupleId: link.id,
      partner: normalizeUser(partnerUser) || { id: link.partnerId, email: "", username: null, displayName: null, photoUrl: null },
      summary: summarizeComparison(mainComparison),
      comparisons: {
        main: mainComparison,
        relation: relationComparisons
      },
      tasks
    });
  }

  res.json({
    me: normalizeUser(meUser) || { id: userId, email: "", username: null, displayName: null, photoUrl: null },
    links,
    /** @deprecated formato antiguo: primer vínculo */
    couple:
      links.length > 0
        ? {
            id: links[0].coupleId,
            me: normalizeUser(meUser),
            partner: links[0].partner
          }
        : null
  });
});

/** Elimina el vínculo (pareja). Cualquiera de los dos miembros puede desvincular. */
linkedRouter.delete("/couple/:coupleId", requireAuth, async (req, res) => {
  const userId = req.userId;
  const coupleId = String(req.params.coupleId || "").trim();
  if (!coupleId) {
    res.status(400).json({ error: "BAD_REQUEST" });
    return;
  }
  const rows = await dbQuery("select id, user_a_id, user_b_id from couple where id=? limit 1", [coupleId]);
  const c = rows[0];
  if (!c) {
    /** Idempotente: la otra persona ya desvinculó o la lista venía de caché. */
    res.json({ ok: true, alreadyRemoved: true });
    return;
  }
  if (c.user_a_id !== userId && c.user_b_id !== userId) {
    res.status(403).json({ error: "FORBIDDEN" });
    return;
  }
  const ua = c.user_a_id;
  const ub = c.user_b_id;
  await dbQuery("delete from couple where id=?", [coupleId]);
  await dbQuery(
    `delete from invite where status='accepted' and accepted_user_id is not null
       and ((inviter_user_id=? and accepted_user_id=?) or (inviter_user_id=? and accepted_user_id=?))`,
    [ua, ub, ub, ua]
  );
  res.json({ ok: true });
});

linkedRouter.post("/tasks", requireAuth, async (req, res) => {
  const userId = req.userId;
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "BAD_REQUEST", details: parsed.error.flatten() });
    return;
  }

  const userCouples = await getLinksForUser(userId);
  if (!userCouples.length) {
    res.status(404).json({ error: "COUPLE_NOT_FOUND" });
    return;
  }

  let couple = userCouples[0];
  if (parsed.data.coupleId) {
    const picked = userCouples.find((c) => c.id === parsed.data.coupleId);
    if (!picked) {
      res.status(404).json({ error: "COUPLE_NOT_FOUND" });
      return;
    }
    couple = picked;
  }

  const id = randomUUID();
  const title = parsed.data.title.trim();
  const description = (parsed.data.description || "").trim();
  await dbQuery(
    "insert into couple_task (id, couple_id, created_by_user_id, title, description, status) values (?, ?, ?, ?, ?, 'pending')",
    [id, couple.id, userId, title, description || null]
  );
  const [task] = await dbQuery(
    "select id, title, description, status, created_by_user_id, created_at, updated_at, completed_at from couple_task where id=? limit 1",
    [id]
  );
  res.json({ task: normalizeTask(task) });
});

linkedRouter.patch("/tasks/:taskId", requireAuth, async (req, res) => {
  const userId = req.userId;
  const parsed = updateTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "BAD_REQUEST", details: parsed.error.flatten() });
    return;
  }
  if (!Object.keys(parsed.data).length) {
    res.status(400).json({ error: "EMPTY_UPDATE" });
    return;
  }

  const ownedCoupleIds = new Set((await getLinksForUser(userId)).map((c) => c.id));
  const taskId = String(req.params.taskId || "");
  const rows = await dbQuery("select id, couple_id, status from couple_task where id=? limit 1", [taskId]);
  const existing = rows[0];
  if (!existing || !ownedCoupleIds.has(existing.couple_id)) {
    res.status(404).json({ error: "TASK_NOT_FOUND" });
    return;
  }

  const title = parsed.data.title !== undefined ? parsed.data.title.trim() : null;
  const description = parsed.data.description !== undefined ? parsed.data.description.trim() : null;
  const status = parsed.data.status !== undefined ? String(parsed.data.status) : null;
  if (status !== null && !TASK_STATUS.has(status)) {
    res.status(400).json({ error: "INVALID_STATUS" });
    return;
  }

  const nextStatus = status || existing.status;
  await dbQuery(
    "update couple_task set title=coalesce(?, title), description=coalesce(?, description), status=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now'), completed_at=case when ?='done' then coalesce(completed_at, strftime('%Y-%m-%dT%H:%M:%fZ','now')) else null end where id=?",
    [title, description, nextStatus, nextStatus, taskId]
  );

  const [task] = await dbQuery(
    "select id, title, description, status, created_by_user_id, created_at, updated_at, completed_at from couple_task where id=? limit 1",
    [taskId]
  );
  res.json({ task: normalizeTask(task) });
});

async function getLinksForUser(userId) {
  const rows = await dbQuery(
    "select id, user_a_id, user_b_id from couple where user_a_id=? or user_b_id=? order by datetime(created_at) desc",
    [userId, userId]
  );
  return rows.map((pair) => ({
    id: pair.id,
    userAId: pair.user_a_id,
    userBId: pair.user_b_id,
    partnerId: pair.user_a_id === userId ? pair.user_b_id : pair.user_a_id
  }));
}

function summarizeComparison(mainComparison) {
  const by = mainComparison?.byCategory ?? [];
  const values = by
    .filter((c) => typeof c.meScore === "number" && typeof c.partnerScore === "number")
    .map((c) => (Number(c.meScore) + Number(c.partnerScore)) / 2);
  const compatibilityPct =
    values.length > 0
      ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100)
      : null;

  const topDiffCat = [...by]
    .filter((c) => typeof c.diff === "number")
    .sort((a, b) => Number(b.diff) - Number(a.diff))[0];

  let shortText =
    mainComparison?.bothCompleted
      ? compatibilityPct !== null
        ? `Su compatibilidad general es cercana al ${compatibilityPct}%.`
        : "Ya ambos tienen resultado del test principal."
      : mainComparison?.meCompleted && !mainComparison?.partnerCompleted
        ? "Tu pareja aún debe completar el test principal para ver el comparativo completo."
        : !mainComparison?.meCompleted && mainComparison?.partnerCompleted
          ? "Completa tu test principal para liberar tu comparativo completo."
          : "Completen el test principal para obtener el comparativo detallado.";

  if (topDiffCat?.label && mainComparison?.bothCompleted) {
    shortText += ` Mayor diferencia: ${topDiffCat.label}.`;
  }

  const bullets = Array.isArray(mainComparison?.tips) ? mainComparison.tips.slice(0, 2).map((t) => t.suggestion || t.categoryLabel || "") : [];

  return {
    compatibilityPct,
    bothCompleted: Boolean(mainComparison?.bothCompleted),
    meCompleted: Boolean(mainComparison?.meCompleted),
    partnerCompleted: Boolean(mainComparison?.partnerCompleted),
    shortText,
    bullets,
    topDiffCategory: topDiffCat
      ? { key: topDiffCat.key, label: topDiffCat.label, diff: topDiffCat.diff }
      : null
  };
}

function normalizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    username: user.username || null,
    displayName: user.display_name || null,
    photoUrl: user.photo_url || null
  };
}

async function buildMainComparison(meId, partnerId) {
  const questions = await dbQuery("select id, category_key, text from test_question order by category_order asc, question_order asc");
  const [respA, respB] = await Promise.all([
    dbQuery("select answers, completed from test_response where user_id=? limit 1", [meId]),
    dbQuery("select answers, completed from test_response where user_id=? limit 1", [partnerId])
  ]);

  const completedA = Boolean(respA[0]?.completed);
  const completedB = Boolean(respB[0]?.completed);
  if (!completedA && !completedB) {
    return { bothCompleted: false, meCompleted: false, partnerCompleted: false, byCategory: [], topDiffs: [], tips: [] };
  }

  const [priorityA, priorityB] = await Promise.all([loadPriorityForUser(meId), loadPriorityForUser(partnerId)]);
  const answersA = parseAnswersField(respA[0]?.answers);
  const answersB = parseAnswersField(respB[0]?.answers);
  const resultsA = completedA ? computeUserResults(questions, answersA, priorityA.weightsByKey) : null;
  const resultsB = completedB ? computeUserResults(questions, answersB, priorityB.weightsByKey) : null;

  const byCategory = categories.map((cat) => {
    const me = resultsA?.byCategory.find((x) => x.key === cat.key) || null;
    const partner = resultsB?.byCategory.find((x) => x.key === cat.key) || null;
    return {
      key: cat.key,
      label: cat.label,
      meScore: me ? Number(me.score) : null,
      partnerScore: partner ? Number(partner.score) : null,
      diff: me && partner ? Math.abs(Number(me.score) - Number(partner.score)) : null
    };
  });

  const topDiffs = [...byCategory]
    .filter((c) => typeof c.diff === "number")
    .sort((a, b) => Number(b.diff) - Number(a.diff))
    .slice(0, 3);

  const tips = buildPairTips(byCategory);
  return {
    bothCompleted: completedA && completedB,
    meCompleted: completedA,
    partnerCompleted: completedB,
    byCategory,
    topDiffs,
    tips
  };
}

async function buildRelationComparisons(userAId, userBId) {
  const [rowsA, rowsB] = await Promise.all([
    dbQuery("select test_type, score, classification, completed, updated_at from relation_test_result where user_id=?", [userAId]),
    dbQuery("select test_type, score, classification, completed, updated_at from relation_test_result where user_id=?", [userBId])
  ]);

  const byTypeA = new Map(rowsA.map((r) => [r.test_type, r]));
  const byTypeB = new Map(rowsB.map((r) => [r.test_type, r]));

  return TEST_TYPES.map((type) => {
    const a = byTypeA.get(type);
    const b = byTypeB.get(type);
    const aDone = Boolean(a?.completed);
    const bDone = Boolean(b?.completed);
    return {
      testType: type,
      me: aDone ? { score: Number(a.score || 0), classification: a.classification, updatedAt: a.updated_at } : null,
      partner: bDone ? { score: Number(b.score || 0), classification: b.classification, updatedAt: b.updated_at } : null,
      diff: aDone && bDone ? Math.abs(Number(a.score || 0) - Number(b.score || 0)) : null
    };
  });
}

async function loadPriorityForUser(userId) {
  const defaultOrder = categories.map((c) => c.key);
  const rows = await dbQuery("select category_key, rank from user_priority where user_id=? order by rank asc", [userId]);
  if (rows.length !== categories.length) {
    return { order: defaultOrder, weightsByKey: null };
  }
  const order = rows.map((r) => r.category_key);
  return { order, weightsByKey: computeWeightsFromOrder(order) };
}

function buildPairTips(byCategory) {
  const low = byCategory
    .filter((c) => typeof c.meScore === "number" || typeof c.partnerScore === "number")
    .map((c) => {
      const me = typeof c.meScore === "number" ? c.meScore : 0;
      const partner = typeof c.partnerScore === "number" ? c.partnerScore : 0;
      return { ...c, avg: (me + partner) / (c.partnerScore === null || c.meScore === null ? 1 : 2) };
    })
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 3);

  return low.map((item) => ({
    categoryKey: item.key,
    categoryLabel: item.label,
    suggestion: tipsForCategory(item.key, item.avg)[0] || "Definan una acción semanal concreta para mejorar esta área."
  }));
}

async function loadTasks(coupleId) {
  const rows = await dbQuery(
    "select id, title, description, status, created_by_user_id, created_at, updated_at, completed_at from couple_task where couple_id=? order by case when status='done' then 1 else 0 end asc, updated_at desc",
    [coupleId]
  );
  return rows.map(normalizeTask);
}

function normalizeTask(task) {
  return {
    id: task.id,
    title: task.title,
    description: task.description || "",
    status: task.status,
    createdByUserId: task.created_by_user_id,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    completedAt: task.completed_at
  };
}

module.exports = { linkedRouter };
