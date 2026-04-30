const relationTests = {
  amigos: {
    title: "Test de amigos",
    subtitle: "Confianza, apoyo y calidad de amistad.",
    categories: {
      confianza: { label: "Confianza", weight: 0.3 },
      apoyo: { label: "Apoyo", weight: 0.25 },
      comunicacion: { label: "Comunicación", weight: 0.25 },
      diversion: { label: "Diversión", weight: 0.2 }
    },
    questions: [
      { id: "amigos-1", category_key: "confianza", text: "Siento que puedo contarle cosas personales sin miedo a juicios." },
      { id: "amigos-2", category_key: "confianza", text: "Respeta mis límites cuando digo no." },
      { id: "amigos-3", category_key: "apoyo", text: "Me acompaña en momentos difíciles." },
      { id: "amigos-4", category_key: "apoyo", text: "Celebra sinceramente mis logros." },
      { id: "amigos-5", category_key: "comunicacion", text: "Podemos resolver conflictos hablando con calma." },
      { id: "amigos-6", category_key: "comunicacion", text: "Existe honestidad cuando algo molesta." },
      { id: "amigos-7", category_key: "diversion", text: "Pasamos tiempo de calidad y nos divertimos." },
      { id: "amigos-8", category_key: "diversion", text: "Hay equilibrio entre apoyo emocional y buenos momentos." }
    ]
  },
  conocidos: {
    title: "Test de conocidos",
    subtitle: "Afinidad y convivencia saludable.",
    categories: {
      respeto: { label: "Respeto", weight: 0.3 },
      limites: { label: "Límites", weight: 0.25 },
      colaboracion: { label: "Colaboración", weight: 0.25 },
      convivencia: { label: "Convivencia", weight: 0.2 }
    },
    questions: [
      { id: "conocidos-1", category_key: "respeto", text: "La interacción es cordial y respetuosa." },
      { id: "conocidos-2", category_key: "respeto", text: "Evita comentarios ofensivos o incómodos." },
      { id: "conocidos-3", category_key: "limites", text: "Respeta mi espacio y mis tiempos." },
      { id: "conocidos-4", category_key: "limites", text: "No invade temas personales sin permiso." },
      { id: "conocidos-5", category_key: "colaboracion", text: "Cumple acuerdos cuando hacemos algo en conjunto." },
      { id: "conocidos-6", category_key: "colaboracion", text: "Es confiable en tareas compartidas." },
      { id: "conocidos-7", category_key: "convivencia", text: "La convivencia se siente ligera y agradable." },
      { id: "conocidos-8", category_key: "convivencia", text: "La relación no me genera desgaste constante." }
    ]
  },
  familia: {
    title: "Test de familia",
    subtitle: "Respeto, apoyo y comunicación familiar.",
    categories: {
      respeto: { label: "Respeto", weight: 0.3 },
      apoyo: { label: "Apoyo", weight: 0.25 },
      comunicacion: { label: "Comunicación", weight: 0.25 },
      organizacion: { label: "Organización", weight: 0.2 }
    },
    questions: [
      { id: "familia-1", category_key: "respeto", text: "En casa se respetan opiniones diferentes." },
      { id: "familia-2", category_key: "respeto", text: "Se evita descalificar durante discusiones." },
      { id: "familia-3", category_key: "apoyo", text: "Recibo apoyo emocional cuando lo necesito." },
      { id: "familia-4", category_key: "apoyo", text: "Nos ayudamos en momentos de presión." },
      { id: "familia-5", category_key: "comunicacion", text: "Podemos hablar temas difíciles sin rompernos." },
      { id: "familia-6", category_key: "comunicacion", text: "Escuchamos antes de responder." },
      { id: "familia-7", category_key: "organizacion", text: "Las responsabilidades del hogar están claras." },
      { id: "familia-8", category_key: "organizacion", text: "Existe coordinación para resolver pendientes." }
    ]
  }
};

function getRelationTest(type) {
  return relationTests[type] ?? null;
}

function computeRelationResult(testType, answers) {
  const test = getRelationTest(testType);
  if (!test) return null;

  const byCategory = Object.entries(test.categories).map(([key, cfg]) => {
    const qs = test.questions.filter((q) => q.category_key === key);
    const yes = qs.reduce((acc, q) => acc + Number(answers[q.id] ?? 0), 0);
    const score = qs.length ? yes / qs.length : 0;
    return { key, label: cfg.label, score, weight: cfg.weight };
  });

  const score = byCategory.reduce((acc, c) => acc + c.score * c.weight, 0);
  const normalizedScore = Math.max(0, Math.min(1, score));
  let classification = "SALUDABLE";
  if (normalizedScore < 0.45) classification = "CRITICO";
  else if (normalizedScore < 0.7) classification = "MEJORABLE";

  const tips = byCategory
    .filter((c) => c.score < 0.7)
    .map((c) => ({
      category: c.label,
      text: `Refuerza ${String(c.label).toLowerCase()} con acuerdos concretos y seguimiento semanal.`
    }));

  return {
    testType,
    title: test.title,
    subtitle: test.subtitle,
    score: normalizedScore,
    classification,
    byCategory: byCategory.map((c) => ({ key: c.key, label: c.label, score: c.score })),
    tips
  };
}

module.exports = { relationTests, getRelationTest, computeRelationResult };
