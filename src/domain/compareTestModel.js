const COMPARE_CATEGORY_KEYS = ["fisico", "comunicacion", "tolerancia", "diversion", "respeto"];
const COMPARE_RANK_WEIGHTS = [0.6, 0.2, 0.1, 0.07, 0.03];

function clampRating(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 1;
  return Math.max(1, Math.min(5, Math.round(v)));
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

function computeCompareResults(order, ratingsA, ratingsB) {
  const weights = computeCompareWeightsFromOrder(order);
  const breakdown = COMPARE_CATEGORY_KEYS.map((key) => {
    const ratingA = clampRating(ratingsA?.[key]);
    const ratingB = clampRating(ratingsB?.[key]);
    const weight = weights[key] ?? 0;
    const normA = ratingA / 5;
    const normB = ratingB / 5;
    return {
      key,
      weight,
      ratingA,
      ratingB,
      scoreA: normA * weight,
      scoreB: normB * weight
    };
  });

  const totalA = breakdown.reduce((a, row) => a + row.scoreA, 0);
  const totalB = breakdown.reduce((a, row) => a + row.scoreB, 0);
  const winner = Math.abs(totalA - totalB) < 0.001 ? "tie" : totalA > totalB ? "a" : "b";

  return { order, weights, breakdown, totalA, totalB, winner };
}

module.exports = {
  COMPARE_CATEGORY_KEYS,
  COMPARE_RANK_WEIGHTS,
  computeCompareWeightsFromOrder,
  computeCompareResults
};
