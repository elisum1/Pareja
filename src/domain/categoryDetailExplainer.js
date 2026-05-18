/**
 * Detalle compacto por categoría (sí/no + un consejo).
 */

const { getBinaryAnswer } = require("./coupleTestAnswers");

function clampAnswer(v) {
  const n = Number(v);
  return n === 1 ? 1 : 0;
}

function buildWhyBrief(categoryLabel, yes, total, score) {
  const pct = Math.round(score * 100);
  const no = total - yes;
  if (!total) return "";
  if (pct >= 90) {
    return `${yes} de ${total} en sí → ${pct}%. En “${categoryLabel}” casi todo encaja con lo que sientes ahora.`;
  }
  if (pct >= 80) {
    return `${yes} de ${total} en sí → ${pct}%. Va bien; los ${no} “no” son los que bajan un poco la nota y marcan temas a revisar con calma.`;
  }
  if (pct >= 70) {
    return `${yes} de ${total} en sí → ${pct}%. Varios “no” en “${categoryLabel}” explican el porcentaje: no es un veredicto, es tu lectura hoy.`;
  }
  return `${yes} de ${total} en sí → ${pct}%. Bastantes “no” en “${categoryLabel}” pesan en la nota; sirve para ver dónde conversar y acordar cambios pequeños.`;
}

function buildTip(categoryKey, score) {
  const band = score >= 0.9 ? "alto" : score >= 0.8 ? "medio" : score >= 0.7 ? "mejorable" : "bajo";
  return IA_BY_CATEGORY[categoryKey]?.[band] ?? IA_BY_CATEGORY._default[band];
}

const IA_BY_CATEGORY = {
  _default: {
    alto: "Sigue cuidando lo bueno; revisa un “no” si aparece.",
    medio: "1–2 “no” + un acuerdo pequeño esta semana.",
    mejorable: "Charla corta, un tema, pausa si sube el tono.",
    bajo: "Frases cortas, turnos, una necesidad por vez."
  },
  eco: {
    alto: "Chequeo breve de finanzas de vez en cuando.",
    medio: "Números y fechas; un acuerdo nuevo por semana.",
    mejorable: "Hablar de dinero en horario fijo, no en pelea.",
    bajo: "Pausa; luego lista corta de necesidades."
  },
  respeto: {
    alto: "Tonos y límites suaves en el día a día.",
    medio: "Ejemplo reciente + señal de pausa.",
    mejorable: "Trato civil antes de grandes soluciones.",
    bajo: "Seguridad emocional primero; límites claros."
  },
  tolerancia: {
    alto: "Curiosidad ante diferencias.",
    medio: "Un hábito cotidiano a probar una semana.",
    mejorable: "Molesto vs inaceptable: negociar distinto.",
    bajo: "Espacio, tiempos, reglas simples."
  },
  confianza: {
    alto: "Transparencia por comodidad, no por miedo.",
    medio: "Celos: ejemplos concretos y avisos acordados.",
    mejorable: "Preguntar intención antes de concluir.",
    bajo: "Acuerdos de una semana; hechos observables."
  },
  comunicacion: {
    alto: "2 minutos cada uno sin cortar en temas sensibles.",
    medio: "Sube la tensión: escrito corto y luego hablar.",
    mejorable: "Yo + petición pequeña; sin lista de fallos.",
    bajo: "Menos tema por charla; escribir primero si ayuda."
  },
  diversion: {
    alto: "Un rato mensual solo ustedes.",
    medio: "Alternar quién propone; presupuesto realista.",
    mejorable: "Plan corto que ambos disfruten.",
    bajo: "Revisar carga externa antes de culparse."
  },
  intimidad: {
    alto: "Check-ins breves; respetar ritmos.",
    medio: "Deseo: hablar sin adivinar.",
    mejorable: "“No hoy” con cariño; otras muestras de cariño.",
    bajo: "Pasos pequeños y consentimiento."
  },
  convivencia_social: {
    alto: "Límites con terceros + gratitud.",
    medio: "Obligatorio vs opcional; tiempo máximo.",
    mejorable: "Reglas simples por escrito.",
    bajo: "Prioridad pareja + límites concretos."
  },
  cuidado_personal: {
    alto: "Refuerza hábitos que ya ayudan.",
    medio: "Equipo frente al tema, no ataque.",
    mejorable: "Un apoyo concreto + revisión en 2 semanas.",
    bajo: "Seguridad primero; plan si la carga sube."
  },
  organizacion: {
    alto: "Lista: quién hace qué.",
    medio: "Un área 50/50 esta semana.",
    mejorable: "Tres tareas + fecha.",
    bajo: "Mínimo aceptable, no perfección."
  }
};

function buildCategoryDetailReport(categoryKey, categoryLabel, categoryWeight, questionsRows, answersMap) {
  const sorted = [...questionsRows].sort((a, b) => Number(a.id) - Number(b.id));
  const items = sorted.map((q) => {
    const v = getBinaryAnswer(answersMap, q.id);
    const answer = v === undefined ? 0 : clampAnswer(v);
    return { questionId: q.id, text: q.text, answer };
  });

  const yes = items.reduce((a, it) => a + (it.answer === 1 ? 1 : 0), 0);
  const total = items.length;
  const score = total === 0 ? 0 : yes / total;

  return {
    categoryKey,
    label: categoryLabel,
    score,
    yes,
    total,
    weightInGlobal: typeof categoryWeight === "number" ? categoryWeight : null,
    why: buildWhyBrief(categoryLabel, yes, total, score),
    tip: buildTip(categoryKey, score),
    perAnswer: items
  };
}

module.exports = { buildCategoryDetailReport };
