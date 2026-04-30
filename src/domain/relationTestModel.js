const relationTests = {
  amigos: {
    title: "Test de amigos",
    subtitle: "Confianza, apoyo y calidad de amistad.",
    categories: {
      confianza: "Confianza",
      apoyo: "Apoyo",
      comunicacion: "Comunicación",
      diversion: "Diversión"
    },
    questions: [
      { id: "a1", category_key: "confianza", text: "Siento que puedo contarle cosas personales sin miedo a juicios." },
      { id: "a2", category_key: "confianza", text: "Respeta mis límites cuando digo no." },
      { id: "a3", category_key: "apoyo", text: "Me acompaña en momentos difíciles." },
      { id: "a4", category_key: "apoyo", text: "Celebra sinceramente mis logros." },
      { id: "a5", category_key: "comunicacion", text: "Podemos resolver conflictos hablando con calma." },
      { id: "a6", category_key: "comunicacion", text: "Existe honestidad cuando algo molesta." },
      { id: "a7", category_key: "diversion", text: "Pasamos tiempo de calidad y nos divertimos." },
      { id: "a8", category_key: "diversion", text: "Hay equilibrio entre apoyo emocional y buenos momentos." }
    ]
  },
  conocidos: {
    title: "Test de conocidos",
    subtitle: "Afinidad y convivencia saludable.",
    categories: {
      respeto: "Respeto",
      limites: "Límites",
      colaboracion: "Colaboración",
      convivencia: "Convivencia"
    },
    questions: [
      { id: "c1", category_key: "respeto", text: "La interacción es cordial y respetuosa." },
      { id: "c2", category_key: "respeto", text: "Evita comentarios ofensivos o incómodos." },
      { id: "c3", category_key: "limites", text: "Respeta mi espacio y mis tiempos." },
      { id: "c4", category_key: "limites", text: "No invade temas personales sin permiso." },
      { id: "c5", category_key: "colaboracion", text: "Cumple acuerdos cuando hacemos algo en conjunto." },
      { id: "c6", category_key: "colaboracion", text: "Es confiable en tareas compartidas." },
      { id: "c7", category_key: "convivencia", text: "La convivencia se siente ligera y agradable." },
      { id: "c8", category_key: "convivencia", text: "La relación no me genera desgaste constante." }
    ]
  },
  familia: {
    title: "Test de familia",
    subtitle: "Respeto, apoyo y comunicación familiar.",
    categories: {
      respeto: "Respeto",
      apoyo: "Apoyo",
      comunicacion: "Comunicación",
      organizacion: "Organización"
    },
    questions: [
      { id: "f1", category_key: "respeto", text: "En casa se respetan opiniones diferentes." },
      { id: "f2", category_key: "respeto", text: "Se evita descalificar durante discusiones." },
      { id: "f3", category_key: "apoyo", text: "Recibo apoyo emocional cuando lo necesito." },
      { id: "f4", category_key: "apoyo", text: "Nos ayudamos en momentos de presión." },
      { id: "f5", category_key: "comunicacion", text: "Podemos hablar temas difíciles sin rompernos." },
      { id: "f6", category_key: "comunicacion", text: "Escuchamos antes de responder." },
      { id: "f7", category_key: "organizacion", text: "Las responsabilidades del hogar están claras." },
      { id: "f8", category_key: "organizacion", text: "Existe coordinación para resolver pendientes." }
    ]
  }
};

function getRelationTest(type) {
  return relationTests[type] ?? null;
}

function computeRelationResult(testType, answers) {
  const test = getRelationTest(testType);
  if (!test) return null;
  const grouped = new Map();
  test.questions.forEach((q) => {
    if (!grouped.has(q.category_key)) grouped.set(q.category_key, []);
    grouped.get(q.category_key).push(q);
  });
  const byCategory = Array.from(grouped.entries()).map(([key, qs]) => {
    const ok = qs.reduce((acc, q) => acc + Number(answers[q.id] ?? 0), 0);
    const score = qs.length ? ok / qs.length : 0;
    return { key, label: test.categories[key] ?? key, score };
  });
  const score = byCategory.reduce((acc, c) => acc + c.score, 0) / byCategory.length;
  let classification = "SALUDABLE";
  if (score < 0.45) classification = "CRITICO";
  else if (score < 0.7) classification = "MEJORABLE";

  const tips = byCategory
    .filter((c) => c.score < 0.7)
    .map((c) => ({
      category: c.label,
      text: `Fortalece ${String(c.label).toLowerCase()} con acuerdos concretos y seguimiento semanal.`
    }));

  return {
    testType,
    title: test.title,
    subtitle: test.subtitle,
    score,
    classification,
    byCategory,
    tips
  };
}

module.exports = { relationTests, getRelationTest, computeRelationResult };
