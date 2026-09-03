/**
 * MetricMatch — alineado con mobile/src/domain/compareTestModel.js
 */
const COMPARE_CATEGORY_KEYS = [
  "principios_valores",
  "proyecto_vida",
  "confianza_seguridad",
  "manejo_conflictos",
  "compatibilidad_emocional",
  "comunicacion",
  "habitos_estilo_vida",
  "admiracion_crecimiento",
  "tolerancia_afinidades",
  "compatibilidad_social_familiar",
  "atraccion_fisica_intima"
];

const COMPARE_RANK_WEIGHTS = [0.2, 0.16, 0.14, 0.12, 0.1, 0.08, 0.06, 0.05, 0.04, 0.03, 0.02];

const COMPARE_CATEGORY_LABEL = {
  principios_valores: "Principios y Valores",
  proyecto_vida: "Proyecto de Vida",
  confianza_seguridad: "Confianza y Seguridad",
  manejo_conflictos: "Manejo de Conflictos",
  compatibilidad_emocional: "Compatibilidad Emocional",
  comunicacion: "Comunicación",
  habitos_estilo_vida: "Hábitos y Estilo de Vida",
  admiracion_crecimiento: "Admiración y Crecimiento Personal",
  tolerancia_afinidades: "Tolerancia y Afinidades Personales",
  compatibilidad_social_familiar: "Compatibilidad Social y Familiar",
  atraccion_fisica_intima: "Atracción Física e Íntima"
};

const COMPARE_QUESTIONS = [
  { id: "pv_valores", categoryKey: "principios_valores" },
  { id: "pv_vision", categoryKey: "proyecto_vida" },
  { id: "pv_crisis", categoryKey: "proyecto_vida" },
  { id: "pv_familia", categoryKey: "proyecto_vida" },
  { id: "cs_confianza", categoryKey: "confianza_seguridad" },
  { id: "cs_seguridad", categoryKey: "confianza_seguridad" },
  { id: "mc_resolucion", categoryKey: "manejo_conflictos" },
  { id: "ce_autenticidad", categoryKey: "compatibilidad_emocional" },
  { id: "com_calidad", categoryKey: "comunicacion" },
  { id: "hev_habitos", categoryKey: "habitos_estilo_vida" },
  { id: "hev_estilo", categoryKey: "habitos_estilo_vida" },
  { id: "ag_admiracion", categoryKey: "admiracion_crecimiento" },
  { id: "ag_crecimiento", categoryKey: "admiracion_crecimiento" },
  { id: "ta_respeto", categoryKey: "tolerancia_afinidades" },
  { id: "ta_disfrute", categoryKey: "tolerancia_afinidades" },
  { id: "sf_integracion", categoryKey: "compatibilidad_social_familiar" },
  { id: "af_atraccion", categoryKey: "atraccion_fisica_intima" },
  { id: "af_intimidad", categoryKey: "atraccion_fisica_intima" }
];

function clampRating(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  const r = Math.max(1, Math.min(5, Math.round(v)));
  return r;
}

function average(nums) {
  if (!nums.length) return 1;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function computeCompareWeightsFromOrder(orderKeys) {
  const order = Array.isArray(orderKeys) ? orderKeys.map(String) : [];
  const valid =
    order.length === COMPARE_CATEGORY_KEYS.length &&
    new Set(order).size === order.length &&
    COMPARE_CATEGORY_KEYS.every((k) => order.includes(k));

  if (!valid) {
    return COMPARE_CATEGORY_KEYS.reduce((acc, key, idx) => {
      acc[key] = COMPARE_RANK_WEIGHTS[idx] ?? 0;
      return acc;
    }, {});
  }

  return order.reduce((acc, key, idx) => {
    acc[key] = COMPARE_RANK_WEIGHTS[idx] ?? 0;
    return acc;
  }, {});
}

/**
 * ratings pueden venir por questionId (app) o por categoryKey (legacy).
 */
function ratingForQuestion(ratings, question) {
  if (!ratings || typeof ratings !== "object") return null;
  if (Object.prototype.hasOwnProperty.call(ratings, question.id)) {
    return clampRating(ratings[question.id]);
  }
  if (Object.prototype.hasOwnProperty.call(ratings, question.categoryKey)) {
    return clampRating(ratings[question.categoryKey]);
  }
  return null;
}

function validateCompareRatings(ratingsA, ratingsB) {
  const missing = [];
  for (const q of COMPARE_QUESTIONS) {
    const a = ratingForQuestion(ratingsA, q);
    const b = ratingForQuestion(ratingsB, q);
    if (a == null || b == null) missing.push(q.id);
  }
  return missing;
}

function computeCompareResults(order, ratingsA, ratingsB) {
  const weights = computeCompareWeightsFromOrder(order);
  const questionRows = COMPARE_QUESTIONS.map((question) => {
    const weight = weights[question.categoryKey] ?? 0;
    const ratingA = ratingForQuestion(ratingsA, question) ?? 1;
    const ratingB = ratingForQuestion(ratingsB, question) ?? 1;
    return {
      ...question,
      label: COMPARE_CATEGORY_LABEL[question.categoryKey] || question.categoryKey,
      weight,
      ratingA,
      ratingB,
      scoreA: ratingA * weight,
      scoreB: ratingB * weight,
      normA: ratingA / 5,
      normB: ratingB / 5
    };
  });

  const maxTotal = questionRows.reduce((sum, row) => sum + 5 * row.weight, 0);
  const totalA = questionRows.reduce((sum, row) => sum + row.scoreA, 0);
  const totalB = questionRows.reduce((sum, row) => sum + row.scoreB, 0);

  const orderKeys = Array.isArray(order) && order.length ? order.map(String) : COMPARE_CATEGORY_KEYS;
  const breakdown = orderKeys.map((key) => {
    const rows = questionRows.filter((row) => row.categoryKey === key);
    const weight = weights[key] ?? 0;
    const ratingA = average(rows.map((row) => row.ratingA));
    const ratingB = average(rows.map((row) => row.ratingB));
    const scoreA = rows.reduce((sum, row) => sum + row.scoreA, 0);
    const scoreB = rows.reduce((sum, row) => sum + row.scoreB, 0);
    return {
      key,
      label: COMPARE_CATEGORY_LABEL[key] || key,
      weight,
      weightPercent: Math.round(weight * 100),
      ratingA: Math.round(ratingA * 10) / 10,
      ratingB: Math.round(ratingB * 10) / 10,
      scoreA,
      scoreB,
      normA: ratingA / 5,
      normB: ratingB / 5,
      questionCount: rows.length
    };
  });

  const winner = Math.abs(totalA - totalB) < 0.001 ? "tie" : totalA > totalB ? "a" : "b";

  return {
    order: orderKeys,
    weights,
    breakdown,
    questions: questionRows,
    maxTotal,
    totalA,
    totalB,
    totalAPercent: maxTotal > 0 ? Math.round((totalA / maxTotal) * 100) : 0,
    totalBPercent: maxTotal > 0 ? Math.round((totalB / maxTotal) * 100) : 0,
    winner
  };
}

module.exports = {
  COMPARE_CATEGORY_KEYS,
  COMPARE_RANK_WEIGHTS,
  COMPARE_QUESTIONS,
  computeCompareWeightsFromOrder,
  computeCompareResults,
  validateCompareRatings
};
