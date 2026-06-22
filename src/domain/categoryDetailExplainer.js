/**
 * Detalle compacto por categoría: solo preguntas con «No» y tips suaves.
 */

const { getBinaryAnswer } = require("./coupleTestAnswers");
const { getNoAnswerRecommendation, buildQuestionOrderMap } = require("./noAnswerRecommendations");

function clampAnswer(v) {
  const n = Number(v);
  return n === 1 ? 1 : 0;
}

function formatSoftImprovementTip(recommendation) {
  const text = String(recommendation || "").trim();
  if (!text) {
    return "Hablen de esto con calma y elijan juntos un paso pequeño para los próximos días.";
  }
  return text;
}

function buildCategoryDetailReport(categoryKey, categoryLabel, categoryWeight, questionsRows, answersMap) {
  const sorted = [...questionsRows].sort((a, b) => Number(a.id) - Number(b.id));
  const orderMap = buildQuestionOrderMap(sorted);
  const scorePct = Math.round(
    (sorted.length
      ? sorted.reduce((acc, q) => {
          const v = getBinaryAnswer(answersMap, q.id);
          return acc + (v === 1 ? 1 : 0);
        }, 0) / sorted.length
      : 0) * 100
  );

  const items = sorted.map((q) => {
    const v = getBinaryAnswer(answersMap, q.id);
    const answer = v === undefined ? 0 : clampAnswer(v);
    return { questionId: q.id, text: q.text, answer };
  });

  const yes = items.reduce((a, it) => a + (it.answer === 1 ? 1 : 0), 0);
  const total = items.length;
  const score = total === 0 ? 0 : yes / total;

  const noAnswers = items
    .filter((it) => it.answer === 0)
    .map((it) => {
      const questionOrder = orderMap.get(it.questionId) ?? 1;
      const insight = getNoAnswerRecommendation({
        categoryKey,
        questionOrder,
        categoryScorePct: scorePct,
        includeGapNote: false
      });
      return {
        questionId: it.questionId,
        text: it.text,
        improvementTip: formatSoftImprovementTip(insight.recommendation)
      };
    });

  return {
    categoryKey,
    label: categoryLabel,
    score,
    yes,
    total,
    weightInGlobal: typeof categoryWeight === "number" ? categoryWeight : null,
    noAnswersIntro:
      noAnswers.length > 0
        ? "En las siguientes preguntas marcaste «No»:"
        : null,
    noAnswers,
    perAnswer: items
  };
}

module.exports = { buildCategoryDetailReport };
