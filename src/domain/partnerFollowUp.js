/**
 * Plan de seguimiento post-compatibilidad (solo test principal + actividades sugeridas).
 * No hay mini cuestionario aparte: el seguimiento se apoya en resultados del test oficial.
 */
const { categories, tipsForCategory } = require("./testModel");
const { getBinaryAnswer } = require("./coupleTestAnswers");

/** Actividades concretas por categoría (pareja). */
const pairActivitiesByCategory = {
  eco: [
    "Revisión express de gastos fijos (15 min) con una hoja o app compartida.",
    "Definir un “tope de conversación” para compras grandes y respetarlo una semana.",
    "Cada uno escribe una meta financiera pequeña del mes y la comparten en cena."
  ],
  respeto: [
    "Regla de pausa: si alguien pide 20 minutos, el otro lo respeta sin perseguir el tema.",
    "Lista de 3 cosas que cada uno valora del otro y compartirlas sin contraargumentar.",
    "Acordar cómo se habla del trabajo o familia cuando uno está agotado."
  ],
  tolerancia: [
    "Juego “un sí por día”: cada uno propone algo pequeño fuera de la zona cómoda del otro.",
    "Charla sobre un hábito molesto usando solo observaciones (“noto que…”) sin juicio.",
    "Planificar un plan B cuando no coincidan gustos (película, comida, salida)."
  ],
  confianza: [
    "Compartir una preocupación menor que antes no contaban y validar sin solucionar.",
    "Acordar un canal claro para mensajes importantes (evitar malentendidos por chat).",
    "Revisar juntos un límite que les dé seguridad (horarios, espacio, privacidad)."
  ],
  comunicacion: [
    "Diez minutos de conversación cotidiana sin pantallas: energía del 1 al 10 y por qué.",
    "Practicar escucha: uno habla 3 minutos y el otro solo reformula lo escuchado.",
    "Escribir un tema difícil en un papel y leerlo en voz baja con turnos."
  ],
  diversion: [
    "Una salida sin móviles durante 90 minutos (caminata, juego de mesa, cocina).",
    "Lista de 5 cosas que les hacen reír y elegir una para repetir pronto.",
    "Inventar un ritual tonto semanal (café los domingos, playlist compartida)."
  ],
  intimidad: [
    "Conversación sobre ritmos y deseos sin presión de “resolver” todo en una noche.",
    "Un abrazo largo (60 s) como ritual de conexión sin expectativas extra.",
    "Planificar una cita con tiempo reservado solo para ustedes (sin agenda apretada)."
  ],
  convivencia_social: [
    "Acordar cuántas salidas sociales al mes se sienten bien para cada uno.",
    "Un evento donde uno “lidera” y el otro apoya (y al revés la próxima vez).",
    "Definir señales discretas para cuando uno quiera irse sin drama."
  ],
  cuidado_personal: [
    "Bloquear en calendario 2 huecos semanales de autocuidado innegociables.",
    "Compartir qué los recarga vs. qué los drena y buscar un equilibrio realista.",
    "Caminata o deporte juntos una vez por semana, sin competir."
  ],
  organizacion: [
    "Reparto visible de 3 tareas del hogar con responsable y día.",
    "Mini sprint de 25 minutos ordenando un solo espacio juntos.",
    "Revisar recordatorios y calendario compartido cada domingo a la misma hora."
  ]
};

function clamp01(n) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function pickNoImprovementHint(categoryKey, questionText) {
  const tips = tipsForCategory(categoryKey, 0.35);
  const base = tips[0] || "Propongan un micro-cambio esta semana y revísenlo sin culpas.";
  return `En el test principal indicó “No” en: “${questionText}”. ${base}`;
}

/**
 * Agrupa las preguntas del test oficial con respuesta “No” (0) por categoría.
 * `questions`: filas test_question { id, category_key, text }.
 */
function buildMainTestNoInsightBlocks(questions, answersRaw, authorLabel) {
  const label = String(authorLabel || "Tu pareja").trim() || "Tu pareja";
  const byCat = new Map();
  for (const q of questions) {
    if (getBinaryAnswer(answersRaw, q.id) !== 0) continue;
    const ck = q.category_key;
    if (!byCat.has(ck)) byCat.set(ck, []);
    byCat.get(ck).push({
      questionText: q.text,
      improvementHint: pickNoImprovementHint(ck, q.text)
    });
  }
  const blocks = [];
  for (const cat of categories) {
    const items = byCat.get(cat.key);
    if (items?.length) {
      blocks.push({
        categoryKey: cat.key,
        categoryLabel: cat.label,
        partnerLabel: label,
        items
      });
    }
  }
  return blocks;
}

/** Categorías del test oficial donde hay al menos una respuesta “No” (solo el usuario cuyas respuestas se pasan). */
function categoryKeysWithMainTestNo(questions, answersRaw) {
  const set = new Set();
  for (const q of questions) {
    if (getBinaryAnswer(answersRaw, q.id) === 0) set.add(q.category_key);
  }
  return categories.map((c) => c.key).filter((k) => set.has(k));
}

function severityFromBaseline(avg) {
  if (avg < 0.45) return "low";
  if (avg < 0.65) return "mid";
  return "high";
}

function gapLabel(diff) {
  if (diff == null || Number.isNaN(diff)) return null;
  if (diff <= 0.12) return "Percepción muy parecida entre ustedes.";
  if (diff <= 0.28) return "Hay matiz distinto: vale la pena alinear expectativas.";
  return "Diferencia notable: conviene acordar señales y prioridades en esta área.";
}

function buildOverview(partnerLabel, overallAvg, weakest, strongest) {
  const pct = Math.round(clamp01(overallAvg) * 100);
  const w = weakest?.label;
  const s = strongest?.label;
  let body = `Su compatibilidad global ronda el ${pct}%. Cuando vuelvan a hacer el test principal podrán comparar en Resultados si las áreas con “No” mejoran.`;
  if (w) body += ` Prioridad suave: ${w}.`;
  if (s) body += ` Fortaleza a cuidar: ${s}.`;
  return body.replace("{partner}", partnerLabel);
}

function buildFollowUpPlan({ partnerLabel, myResults, partnerResults }) {
  const byKey = (arr, k) => (Array.isArray(arr) ? arr.find((x) => x.key === k) : null);
  const combined = categories.map((cat) => {
    const me = byKey(myResults?.byCategory, cat.key);
    const p = byKey(partnerResults?.byCategory, cat.key);
    const meScore = me ? Number(me.score) : null;
    const partnerScore = p ? Number(p.score) : null;
    const baselineAvg =
      meScore != null && partnerScore != null ? (meScore + partnerScore) / 2 : meScore ?? partnerScore ?? 0;
    const diff = meScore != null && partnerScore != null ? Math.abs(meScore - partnerScore) : null;
    const baselinePct = Math.round(baselineAvg * 100);
    const tips = tipsForCategory(cat.key, baselineAvg);
    const activities = pairActivitiesByCategory[cat.key] || [
      "Conversación de 15 minutos solo sobre esta área, sin juicios.",
      "Elegir una micro-acción esta semana y revisarla el domingo."
    ];
    const weaknessBullets = [];
    if (baselineAvg < 0.55) weaknessBullets.push("Puntuación conjunta baja: pequeños acuerdos semanales suelen marcar la diferencia.");
    if (diff != null && diff > 0.25) weaknessBullets.push("Perciben esta categoría muy distinto: primero alinear qué significa “bien” para cada uno.");
    if (baselineAvg >= 0.55 && baselineAvg < 0.72) weaknessBullets.push("Zona mejorable: un hábito visible mantiene el momentum.");

    return {
      key: cat.key,
      label: cat.label,
      meScore: meScore,
      partnerScore: partnerScore,
      baselineAvg: Math.round(baselineAvg * 1000) / 1000,
      baselinePct,
      gapBetweenUs: diff != null ? Math.round(diff * 1000) / 1000 : null,
      gapHint: gapLabel(diff),
      severity: severityFromBaseline(baselineAvg),
      improvementTips: tips.slice(0, 4),
      weaknessBullets,
      suggestedActivities: activities,
      trackingPct: baselinePct
    };
  });

  const sortedByAvg = [...combined].sort((a, b) => a.baselineAvg - b.baselineAvg);
  const weakest = sortedByAvg[0];
  const strongest = [...combined].sort((a, b) => b.baselineAvg - a.baselineAvg)[0];
  const overallAvg = combined.reduce((acc, c) => acc + c.baselineAvg, 0) / (combined.length || 1);

  const focusAreas = sortedByAvg.slice(0, 3).map((c) => ({
    key: c.key,
    label: c.label,
    baselinePct: c.baselinePct,
    why: c.severity === "low" ? "Área con menor promedio conjunto." : "Área a reforzar con hábitos concretos."
  }));

  return {
    partnerLabel,
    overview: buildOverview(partnerLabel, overallAvg, weakest, strongest),
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
