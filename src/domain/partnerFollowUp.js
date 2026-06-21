/**
 * Plan de seguimiento post-compatibilidad (solo test principal + actividades sugeridas).
 */
const { categories } = require("./testModel");
const { getBinaryAnswer } = require("./coupleTestAnswers");
const { formatCoupleCompatibilitySummary } = require("./coupleCompatibilityBands");
const { getNoAnswerRecommendation, buildQuestionOrderMap } = require("./noAnswerRecommendations");
const { buildEnrichedFollowUpCategories } = require("./coupleRecommendationEngine");

function clamp01(n) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function categoryScorePct(results, categoryKey) {
  const row = results?.byCategory?.find((c) => c.key === categoryKey);
  if (!row || typeof row.score !== "number") return null;
  return Math.round(row.score * 100);
}

function pickNoImprovementInsight(question, orderMap, authorResults, partnerResults, includeGapNote = false) {
  const categoryKey = question.category_key;
  const questionOrder = orderMap.get(question.id) ?? 1;
  const authorPct = categoryScorePct(authorResults, categoryKey);
  const partnerPct = categoryScorePct(partnerResults, categoryKey);
  const gapPct =
    authorPct != null && partnerPct != null ? Math.abs(authorPct - partnerPct) : null;
  const combinedScorePct =
    authorPct != null && partnerPct != null
      ? Math.round((authorPct + partnerPct) / 2)
      : authorPct ?? partnerPct ?? null;

  return getNoAnswerRecommendation({
    categoryKey,
    questionOrder,
    categoryScorePct: authorPct ?? combinedScorePct ?? 50,
    combinedScorePct: combinedScorePct ?? authorPct ?? 50,
    gapPct,
    includeGapNote
  });
}

/**
 * Agrupa las preguntas del test oficial con respuesta «No» (0) por categoría.
 */
function buildMainTestNoInsightBlocks(questions, answersRaw, authorLabel, context = {}) {
  const { authorResults = null, partnerResults = null } = context;
  const orderMap = buildQuestionOrderMap(questions);
  const label = String(authorLabel || "Tu pareja").trim() || "Tu pareja";
  const byCat = new Map();
  for (const q of questions) {
    if (getBinaryAnswer(answersRaw, q.id) !== 0) continue;
    const ck = q.category_key;
    if (!byCat.has(ck)) byCat.set(ck, []);
    byCat.get(ck).push(q);
  }

  const blocks = [];
  for (const cat of categories) {
    const qs = byCat.get(cat.key);
    if (!qs?.length) continue;

    const authorPct = categoryScorePct(authorResults, cat.key);
    const partnerPct = categoryScorePct(partnerResults, cat.key);
    const gapPct =
      authorPct != null && partnerPct != null ? Math.abs(authorPct - partnerPct) : null;
    const showGapOnceInCategory = gapPct != null && gapPct >= 25;

    const items = qs.map((q, idx) => {
      const insight = pickNoImprovementInsight(
        q,
        orderMap,
        authorResults,
        partnerResults,
        showGapOnceInCategory && idx === 0
      );
      return {
        questionText: q.text,
        whyNo: insight.whyNo,
        recommendation: insight.recommendation,
        tier: insight.tier,
        tierLabel: insight.tierLabel,
        improvementHint: insight.improvementHint
      };
    });

    blocks.push({
      categoryKey: cat.key,
      categoryLabel: cat.label,
      partnerLabel: label,
      items
    });
  }
  return blocks;
}

function categoryKeysWithMainTestNo(questions, answersRaw) {
  const set = new Set();
  for (const q of questions) {
    if (getBinaryAnswer(answersRaw, q.id) === 0) set.add(q.category_key);
  }
  return categories.map((c) => c.key).filter((k) => set.has(k));
}

function buildOverview(partnerLabel, overallAvg, weakest, strongest) {
  const pct = Math.round(clamp01(overallAvg) * 100);
  const w = weakest?.label;
  const s = strongest?.label;
  let body = formatCoupleCompatibilitySummary(pct);
  body += " Cuando vuelvan a hacer el test principal podrán comparar en Resultados si las áreas con “No” mejoran.";
  if (w) body += ` Prioridad suave: ${w}.`;
  if (s) body += ` Fortaleza a cuidar: ${s}.`;
  return body.replace("{partner}", partnerLabel);
}

function buildFollowUpPlan({ partnerLabel, myResults, partnerResults, userIdA, userIdB }) {
  const { combined, alignmentGuidance } = buildEnrichedFollowUpCategories({
    userIdA: userIdA || "a",
    userIdB: userIdB || "b",
    myResults,
    partnerResults,
    partnerLabel
  });

  const sortedByAvg = [...combined].sort((a, b) => a.baselineAvg - b.baselineAvg);
  const weakest = sortedByAvg[0];
  const strongest = [...combined].sort((a, b) => b.baselineAvg - a.baselineAvg)[0];
  const overallAvg = combined.reduce((acc, c) => acc + c.baselineAvg, 0) / (combined.length || 1);

  const focusAreas = sortedByAvg.slice(0, 3).map((c) => ({
    key: c.key,
    label: c.label,
    baselinePct: c.baselinePct,
    why:
      c.severity === "low"
        ? "Área con menor promedio conjunto."
        : "Área a reforzar con hábitos concretos."
  }));

  return {
    partnerLabel,
    overview: buildOverview(partnerLabel, overallAvg, weakest, strongest),
    alignmentGuidance,
    stats: {
      overallCompatibilityPct: Math.round(clamp01(overallAvg) * 100),
      categoriesTracked: combined.length,
      focusCount: focusAreas.length
    },
    focusAreas,
    categories: combined
  };
}

module.exports = {
  buildFollowUpPlan,
  buildMainTestNoInsightBlocks,
  categoryKeysWithMainTestNo
};
