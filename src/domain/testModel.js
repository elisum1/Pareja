const categories = [
  { key: "eco", label: "Estabilidad económica", weight: 0.15, maxYes: 3 },
  { key: "respeto", label: "Respeto", weight: 0.13, maxYes: 4 },
  { key: "tolerancia", label: "Tolerancia", weight: 0.12, maxYes: 6 },
  { key: "confianza", label: "Confianza", weight: 0.11, maxYes: 3 },
  { key: "comunicacion", label: "Comunicación", weight: 0.1, maxYes: 4 },
  { key: "diversion", label: "Diversión", weight: 0.09, maxYes: 3 },
  { key: "sexo", label: "Sexo", weight: 0.08, maxYes: 3 },
  { key: "social", label: "Social", weight: 0.07, maxYes: 4 },
  { key: "salud", label: "Salud", weight: 0.06, maxYes: 4 },
  { key: "organizacion", label: "Organización", weight: 0.05, maxYes: 2 },
  { key: "fisico", label: "Físico", weight: 0.04, maxYes: 5 }
];

function computeWeightsFromOrder(orderKeys) {
  const keys = categories.map((c) => c.key);
  const order = Array.isArray(orderKeys) ? orderKeys.map(String) : [];
  const unique = new Set(order);
  const valid = order.length === keys.length && unique.size === keys.length && keys.every((k) => unique.has(k));

  if (!valid) {
    return keys.reduce((acc, k) => {
      const c = categories.find((x) => x.key === k);
      acc[k] = c ? c.weight : 0;
      return acc;
    }, {});
  }

  const byRank = [0.15, 0.13, 0.12, 0.11, 0.1, 0.09, 0.08, 0.07, 0.06, 0.05, 0.04];
  return order.reduce((acc, key, idx) => {
    acc[key] = byRank[idx] ?? 0;
    return acc;
  }, {});
}

function computeUserResults(questions, answers, weightsByKey) {
  const fallback = categories.reduce((acc, c) => {
    acc[c.key] = c.weight;
    return acc;
  }, {});
  const weights = weightsByKey && typeof weightsByKey === "object" ? weightsByKey : fallback;

  const byCategory = categories.map((c) => {
    const qs = questions.filter((q) => q.category_key === c.key);
    const yes = qs.reduce((acc, q) => acc + (answers[String(q.id)] === 1 ? 1 : 0), 0);
    const total = qs.length;
    const score = total === 0 ? 0 : yes / total;
    const weight = typeof weights[c.key] === "number" ? weights[c.key] : c.weight;
    return { key: c.key, label: c.label, yes, total, score, weight };
  });

  const yesSinFisico = byCategory.filter((c) => c.key !== "fisico").reduce((a, c) => a + c.yes, 0);
  const yesConFisico = byCategory.reduce((a, c) => a + c.yes, 0);
  const generalSinFisico = clamp01(yesSinFisico / 36);
  const generalConFisico = clamp01(yesConFisico / 41);
  const ponderado = clamp01(byCategory.reduce((a, c) => a + c.score * c.weight, 0));

  const metric = ponderado;
  const clasificacion = metric < 0.4 ? "CRITICO" : metric < 0.7 ? "MEJORABLE" : "SALUDABLE";

  const weightsUsed = byCategory.reduce((acc, c) => {
    acc[c.key] = c.weight;
    return acc;
  }, {});

  return { byCategory, generalSinFisico, generalConFisico, ponderado, clasificacion, weightsUsed };
}

function clamp01(n) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

const extraQuestionsByCategory = {
  sexo: [
    "¿Con qué frecuencia te gustaría tener relaciones?",
    "¿Has hablado abiertamente de tus fantasías?",
    "¿Sientes que su deseo sexual es compatible con el tuyo?"
  ],
  comunicacion: [
    "¿Qué tema evitas porque sientes que terminará en discusión?",
    "¿Cómo prefieres que te pidan perdón?",
    "¿Se sienten escuchados cuando hablan de algo importante?"
  ],
  confianza: [
    "¿Qué te haría sentir más seguridad en la relación esta semana?",
    "¿Hay algo pendiente de aclarar que sigues guardando?",
    "¿Sientes que puedes contarle algo incómodo sin miedo?"
  ],
  organizacion: [
    "¿Qué tarea del hogar sientes que cargas más tú?",
    "¿Cómo se reparten gastos y responsabilidades hoy?"
  ]
};

function tipsForCategory(_key, score) {
  if (score >= 0.7) {
    return [
      "Mantengan la constancia: lo que ya funciona es su superpoder.",
      "Hagan una mini-revisión semanal: 10 minutos para ajustar sin drama."
    ];
  }
  if (score >= 0.4) {
    return [
      "Elijan un cambio pequeño y medible para esta semana.",
      "Acordar una regla simple suele vencer a discutir una teoría."
    ];
  }
  return [
    "Pongan un límite claro: sin respeto no hay negociación.",
    "Busquen una conversación guiada: preguntas cortas, turnos, sin interrupciones."
  ];
}

module.exports = { categories, computeWeightsFromOrder, computeUserResults, extraQuestionsByCategory, tipsForCategory };
