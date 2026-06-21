/**
 * Coach conversacional de pareja (sin LLM externo).
 * Tono cercano y humano; usa resultados del test, estadísticas y respuestas «No».
 */
const { buildEnrichedFollowUpCategories, scoreBand } = require("./coupleRecommendationEngine");
const { buildMainTestNoInsightBlocks } = require("./partnerFollowUp");

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** Términos que confirman que la pregunta es sobre pareja. */
const IN_SCOPE_PATTERNS = [
  /\b(pareja|novi[oa]|espos[oa]|marido|mujer|conviv|relacion|matrimonio|amor|enamor)\b/,
  /\b(celos|confian|intim|sexo|deseo|afecto|beso|abrazo)\b/,
  /\b(comunic|hablar|escuch|dialog|pelea|discus|discut|perdon|disculp)\b/,
  /\b(respet|admir|insult|grit|humill|trato)\b/,
  /\b(dinero|econom|finanz|gasto|ahorr|deuda|presupuesto)\b/,
  /\b(cita|salida|date|plan|fin de semana|divert|abur|risa)\b/,
  /\b(familia|suegr|cuñad|amigos|social|convivencia)\b/,
  /\b(test|result|puntu|compatib|metriclove|coach|estadistic)\b/,
  /\b(seguimiento|mejorar|fortaleza|debil|problema|crisis|separ|romper|terminar)\b/,
  /\b(hogar|tarea|orden|organiz|limpi|convivir)\b/,
  /\b(estres|salud|dormir|ansiedad|autocuidado|cuidado personal)\b/,
  /\b(alinear|diferenc|distinto|gap|distancia entre)\b/,
  /\b(que hago|que hacemos|que no|evitar|consejo|recomend)\b/,
  /\b(buenas noticias|malas noticias|veredicto|diagnostico|pronostico)\b/,
  /\b(respuesta no|marque no|dije no|punt[oó] debil)\b/,
  /\b(toleranc|pacienc|habito|rutina)\b/,
  /\b(trabajo.*pareja|pareja.*trabajo|equilibrio.*vida)\b/
];

/** Temas claramente fuera del alcance del coach. */
const OUT_OF_SCOPE_PATTERNS = [
  /\b(clima|tiempo meteorolog|lluvia|temperatura|pronostico del tiempo)\b/,
  /\b(receta|ingrediente|cocinar|hornear|pastel|pizza casera)\b/,
  /\b(futbol|f[uú]tbol|baloncesto|partido de|liga|mundial|champions)\b/,
  /\b(bitcoin|cripto|ethereum|bolsa|acciones|trading|inversion en bolsa)\b/,
  /\b(programar|codigo|javascript|python|react native|sql|bug de codigo)\b/,
  /\b(tarea escolar|examen de matematic|universidad|deberes escolares)\b/,
  /\b(pelicula recomienda|serie de netflix|anime|videojuego solo)\b/,
  /\b(presidente|eleccion|politica nacional|guerra en)\b/,
  /\b(dolor de cabeza|covid|gripe|medicina general|antibiotico)\b/,
  /\b(como llegar a|mapa de|gps|direccion de calle)\b/,
  /\b(traducir al ingles|traduce esta frase|gramatica inglesa)\b/,
  /\b(comprar coche|mejor movil|iphone vs samsung)\b/
];

const INTENT_RULES = [
  {
    intent: "crisis",
    patterns: [
      /\b(romper|terminar|separ|divorc|dejarlo|dejarla|ya no aguanto|no puedo mas|crisis grave|abandonar)\b/
    ]
  },
  {
    intent: "nos",
    patterns: [
      /\b(respuesta no|respuestas no|marque no|marqu[eé] no|dije no|punt[oó] no|afirmacion.*no|interpretar.*no)\b/,
      /\b(por que no|por qu[eé] no|insatisfech|no resuena)\b/
    ]
  },
  {
    intent: "verdict",
    patterns: [
      /\b(veredicto|diagnostico|pronostico|como estamos|como vamos|que tal vamos|como lo vemos)\b/,
      /\b(buenas noticias|malas noticias|noticias agridulces|panorama general|futuro de la pareja)\b/,
      /\b(resumen global|vision general|como nos va|que dice el test sobre nosotros)\b/
    ]
  },
  {
    intent: "tracking",
    patterns: [
      /\b(seguimiento|dar seguimiento|hacer seguimiento|progreso|evolucion|como voy|como vamos mejorando)\b/,
      /\b(revisar|cada semana|domingo|control semanal|metricas|medir mejora|volver a hacer el test)\b/,
      /\b(seguir|monitorear|registro semanal|check.?in semanal)\b/
    ]
  },
  {
    intent: "dont",
    patterns: [
      /\bque no (hacer|debo|debemos|deber\w*)\b/,
      /\b(que evitar|errores comunes|no deber\w*|no debemos)\b/,
      /\b(prohibido|nunca hag|dejar de hacer|dejemos de|pitfall|trampas)\b/
    ]
  },
  {
    intent: "do",
    patterns: [
      /\b(que hago|que hacemos|que debemos hacer|plan de accion|pasos concretos|recomiendas hacer)\b/,
      /\b(como mejorar|como arreglar|como solucionar|que puedo hacer|acciones para)\b/
    ]
  },
  {
    intent: "celebrate",
    patterns: [
      /\b(fortaleza|fortalezas|lo mejor|que va bien|celebrar|orgullo|logro|punto fuerte|donde brillamos)\b/,
      /\b(lo que funciona|nuestra base|zona verde|area fuerte)\b/
    ]
  },
  {
    intent: "stats",
    patterns: [
      /\b(estadistica|estadisticas|numeros|desglose|detalle por categoria|tabla|puntuacion por)\b/,
      /\b(cuanto sacamos|porcentaje de cada|breakdown|analisis completo)\b/
    ]
  },
  {
    intent: "compare",
    patterns: [
      /\b(diferencia entre|distancia entre|yo vs|tu vs|el vs|ella vs|desalinead|no pensamos igual)\b/,
      /\b(gap|brecha|uno puntua|otro puntua|quien ve peor|quien ve mejor)\b/
    ]
  },
  {
    intent: "dates",
    patterns: [
      /\b(cita|salida|salir|plan romant|fin de semana|date|paseo|restaurante|viaje|actividad juntos)\b/
    ]
  },
  {
    intent: "money",
    patterns: [/\b(dinero|econom|finanz|gasto|ahorr|deuda|presupuesto|estabilidad financiera)\b/]
  },
  {
    intent: "intimacy",
    patterns: [/\b(intim|sexo|deseo|tocar|afecto|pasion|conexion fisica|dormitorio)\b/]
  },
  {
    intent: "trust",
    patterns: [/\b(confian|celos|mentir|mentira|secreto|privacidad|infidel|engañ)\b/]
  },
  {
    intent: "respect",
    patterns: [/\b(respet|insult|grit|gritar|humill|admir|trato|valorar)\b/]
  },
  {
    intent: "communication",
    patterns: [/\b(comunic|hablar|escuch|dialog|pelea|discus|discut|callar|silencio)\b/]
  },
  {
    intent: "tolerance",
    patterns: [/\b(toleranc|pacienc|habito|habitos|rutina|aceptar diferencias|flexib)\b/]
  },
  {
    intent: "social",
    patterns: [/\b(familia|amigos|social|salida con|suegr|cuñad|evento social)\b/]
  },
  {
    intent: "organization",
    patterns: [/\b(orden|tarea|hogar|limpi|organiz|repaso domestico|carga del hogar)\b/]
  },
  {
    intent: "selfcare",
    patterns: [/\b(estres|salud|dormir|ansiedad|autocuidado|cuidado personal|burnout)\b/]
  },
  {
    intent: "fun",
    patterns: [/\b(diver|abur|divert|risa|juego|aburrimiento|rutina aburrida)\b/]
  },
  {
    intent: "alignment",
    patterns: [
      /\b(diferenc|distinto|no entend|percib|alinear|significa bien|expectativa|no coincidimos)\b/
    ]
  },
  {
    intent: "results",
    patterns: [/\b(result|puntu|compatib|test|porcentaje|nota|score)\b/]
  },
  {
    intent: "action",
    patterns: [/\b(semana|hoy|ahora|primer paso|empezar|esta semana|proximos dias)\b/]
  }
];

const DONT_BY_CATEGORY = {
  eco: [
    "Charlas de dinero improvisadas cuando hay estrés o cansancio.",
    "Sacar deudas o compras pasadas como arma en discusiones no financieras.",
    "Exigir transparencia total de golpe si aún no hay confianza en el tema."
  ],
  respeto: [
    "Gritar, sarcasmo o desprecio «de broma» en plena discusión.",
    "Generalizar con «siempre» o «nunca» sobre el carácter del otro.",
    "Corregir al otro frente a terceros para ganar la razón."
  ],
  tolerancia: [
    "Intentar cambiar cinco hábitos del otro a la vez.",
    "Usar la tolerancia como excusa para no poner límites claros.",
    "Criticar rutinas en momentos de hambre, sueño o prisa."
  ],
  confianza: [
    "Revisar teléfono o redes como «prueba» en lugar de hablar.",
    "Hacer promesas grandes sin acciones observables en 7 días.",
    "Castigar con silencio prolongado en lugar de nombrar el miedo."
  ],
  comunicacion: [
    "Apilar tres temas difíciles en una sola noche.",
    "Interrumpir para «ganar» en lugar de escuchar hasta el final.",
    "Retomar una pelea vieja cuando el tema actual ya es suficiente."
  ],
  diversion: [
    "Cancelar planes de pareja tres veces seguidas sin reprogramar.",
    "Convertir cada salida en «reunión de problemas» sin espacio lúdico.",
    "Esperar el fin de semana perfecto y no hacer nada entre semana."
  ],
  intimidad: [
    "Presionar o culpar cuando hay «no» o bajo deseo.",
    "Comparar con parejas ajenas o estándares irreales.",
    "Interpretar falta de deseo como rechazo personal sin hablar."
  ],
  convivencia_social: [
    "Comprometer al otro con planes sociales sin consultar.",
    "Criticar al otro frente a familia o amigos.",
    "Ignorar señales de agotamiento social del otro."
  ],
  cuidado_personal: [
    "Minimizar el estrés del otro («no es para tanto»).",
    "Sacrificar descanso propio sistemáticamente y resentirse después.",
    "Usar el autocuidado del otro como reproche en peleas."
  ],
  organizacion: [
    "Sermonear sobre desorden en caliente; mejor acuerdo en frío.",
    "Asumir que «obvio» significa lo mismo para los dos.",
    "Acumular tareas sin reparto visible y explotar un día."
  ]
};

function isOutOfScope(message) {
  const m = normalize(message);
  if (m.length < 4) return false;
  if (IN_SCOPE_PATTERNS.some((p) => p.test(m))) return false;
  if (OUT_OF_SCOPE_PATTERNS.some((p) => p.test(m))) return true;
  if (
    /^(que es|quien es|como se|cuando fue|donde queda|cuanto cuesta|cual es la capital)/.test(m) &&
    !/\b(pareja|relacion|novi|amor|matrim|conviv)\b/.test(m)
  ) {
    return true;
  }
  return false;
}

function detectIntent(message) {
  const m = normalize(message);
  if (isOutOfScope(message)) return "out_of_scope";
  for (const rule of INTENT_RULES) {
    if (rule.patterns.some((p) => p.test(m))) return rule.intent;
  }
  return "general";
}

function categoryFromIntent(intent) {
  const map = {
    money: "eco",
    respect: "respeto",
    tolerance: "tolerancia",
    trust: "confianza",
    communication: "comunicacion",
    fun: "diversion",
    intimacy: "intimidad",
    social: "convivencia_social",
    selfcare: "cuidado_personal",
    organization: "organizacion"
  };
  return map[intent] || null;
}

function buildOverallVerdict(overallPct, combined) {
  const criticalCount = combined.filter((c) => scoreBand(c.baselineAvg) === "critical").length;
  const lowCount = combined.filter((c) => scoreBand(c.baselineAvg) === "low").length;
  const strongCount = combined.filter((c) => scoreBand(c.baselineAvg) === "strong").length;

  if (overallPct >= 78 && criticalCount === 0) {
    return {
      tier: "excellent",
      tone: "good",
      headline: "Buenas noticias",
      summary:
        "La percepción conjunta es sólida. No es perfección eterna, pero hay base real para construir y disfrutar."
    };
  }
  if (overallPct >= 65 && criticalCount <= 1) {
    return {
      tier: "good",
      tone: "good",
      headline: "Noticias mayormente buenas",
      summary:
        "Van bien en lo esencial. Hay áreas a pulir, pero no están en modo supervivencia; es momento de mantener y afinar."
    };
  }
  if (overallPct >= 50 || (criticalCount + lowCount <= 3 && strongCount >= 2)) {
    return {
      tier: "mixed",
      tone: "mixed",
      headline: "Noticias agridulces",
      summary:
        "Hay luces y sombras claras. Algunas áreas sostienen la relación y otras piden conversación honesta pronto."
    };
  }
  if (overallPct >= 38) {
    return {
      tier: "low",
      tone: "bad",
      headline: "Noticias difíciles, con salida",
      summary:
        "Varias áreas están bajo presión. No es sentencia: el test mide percepción actual. Con foco y seguimiento se puede mejorar."
    };
  }
  return {
    tier: "critical",
    tone: "bad",
    headline: "Malas noticias (con camino)",
    summary:
      "La percepción conjunta está muy baja en varias dimensiones. Prioricen seguridad emocional, acuerdos cortos y apoyo externo si hay agotamiento."
  };
}

function buildCoachContext({
  myResults,
  partnerResults,
  partnerLabel,
  userIdA,
  userIdB,
  questions = null,
  meAnswers = null,
  partnerAnswers = null
}) {
  const { combined, alignmentGuidance } = buildEnrichedFollowUpCategories({
    userIdA,
    userIdB,
    myResults,
    partnerResults,
    partnerLabel
  });
  const sorted = [...combined].sort((a, b) => a.baselineAvg - b.baselineAvg);
  const weakest = sorted.slice(0, 3);
  const strongest = [...combined].sort((a, b) => b.baselineAvg - a.baselineAvg).slice(0, 2);
  const overallAvg = combined.reduce((a, c) => a + c.baselineAvg, 0) / (combined.length || 1);
  const overallPct = Math.round(overallAvg * 100);
  const myOverallPct = Math.round(Number(myResults?.ponderado ?? 0) * 100);
  const partnerOverallPct = Math.round(Number(partnerResults?.ponderado ?? 0) * 100);
  const gapCategories = combined
    .filter((c) => c.gapBetweenUs != null && c.gapBetweenUs > 0.25)
    .sort((a, b) => b.gapBetweenUs - a.gapBetweenUs);
  const midCategories = combined.filter((c) => scoreBand(c.baselineAvg) === "mid");
  const lowCategories = combined.filter(
    (c) => scoreBand(c.baselineAvg) === "critical" || scoreBand(c.baselineAvg) === "low"
  );

  let myNoInsights = [];
  let partnerNoInsights = [];
  if (questions?.length && meAnswers) {
    myNoInsights = buildMainTestNoInsightBlocks(questions, meAnswers, "Tú", {
      authorResults: myResults,
      partnerResults
    });
  }
  if (questions?.length && partnerAnswers) {
    partnerNoInsights = buildMainTestNoInsightBlocks(questions, partnerAnswers, partnerLabel, {
      authorResults: partnerResults,
      partnerResults: myResults
    });
  }

  return {
    partnerLabel: partnerLabel || "tu pareja",
    overallPct,
    myOverallPct,
    partnerOverallPct,
    overallGap: Math.abs(myOverallPct - partnerOverallPct),
    verdict: buildOverallVerdict(overallPct, combined),
    weakest,
    strongest,
    lowCategories,
    midCategories,
    gapCategories,
    alignmentGuidance,
    byCategory: combined,
    myNoInsights,
    partnerNoInsights
  };
}

function say(...parts) {
  return parts.filter(Boolean).join("\n\n");
}

function pickVoice(ctx, salt, options) {
  const idx = (ctx.overallPct + salt * 17 + (ctx.myOverallPct || 0)) % options.length;
  return options[idx];
}

function partnerName(ctx) {
  return ctx.partnerLabel || "tu pareja";
}

function polishCoachReply(text, ctx, history) {
  if (!history?.length || history.length < 2) return text;
  const lead = pickVoice(ctx, 5, [
    "Claro, sigo contigo.",
    "Vale, miro eso con calma.",
    "Entiendo — te amplío un poco.",
    "Perfecto, vamos ahí."
  ]);
  return `${lead}\n\n${text}`;
}


function replyOutOfScope(ctx) {
  return say(
    "Mmm, eso se me sale un poco del mapa — solo puedo ayudarte con temas de pareja según vuestros resultados en Metriclove.",
    `Con ${partnerName(ctx)} puedo hablar de comunicación, confianza, dinero, intimidad, citas, seguimiento, qué probar o qué evitar, y cómo leer el test.`,
    "Si te sirve, prueba algo como: «¿Cómo lo vemos en general?», «¿Qué evitaríamos ahora?» o «¿Qué hacemos esta semana?»"
  );
}

function replyForVerdict(ctx) {
  const v = ctx.verdict;
  const weak = ctx.weakest.map((c) => c.label).join(" y ");
  const strong = ctx.strongest.map((c) => c.label).join(" y ");

  let opener;
  if (v.tone === "good") {
    opener = pickVoice(ctx, 1, [
      `He revisado vuestros datos y, sinceramente, vais bastante bien. El índice conjunto ronda el ${ctx.overallPct}%, y eso se nota.`,
      `Te cuento lo que veo: ${ctx.overallPct}% de compatibilidad percibida. No es magia, pero sí hay base sólida.`
    ]);
  } else if (v.tone === "mixed") {
    opener = pickVoice(ctx, 2, [
      `Os voy a ser honesto: hay luces y sombras. Estáis alrededor del ${ctx.overallPct}%, ni en crisis ni en piloto automático perfecto.`,
      `Mirando el test, veo un ${ctx.overallPct}% conjunto — ni mal del todo, pero tampoco para relajarse del todo.`
    ]);
  } else {
    opener = pickVoice(ctx, 3, [
      `Te voy a hablar claro: ahora mismo el panorama pesa (${ctx.overallPct}% conjunto). No es sentencia, pero sí pide cuidado.`,
      `Lo que veo no es fácil — ${ctx.overallPct}% de percepción conjunta — aunque con foco y calma se puede remontar.`
    ]);
  }

  return say(
    opener,
    v.summary,
    strong ? `Lo que más me tranquiliza es ${strong}. Ahí tenéis algo real que proteger.` : null,
    weak
      ? `Donde más conviene poner energía: ${weak}. No para alarmarse, pero sí para hablarlo con tiempo y sin acusaciones.`
      : null,
    ctx.midCategories.length
      ? `En el medio quedan cosas como ${ctx.midCategories
          .slice(0, 3)
          .map((c) => c.label)
          .join(", ")} — van bien, pero se pueden afinar.`
      : null,
    ctx.gapCategories.length
      ? `Ojo: en ${ctx.gapCategories
          .slice(0, 2)
          .map((c) => c.label)
          .join(" y ")} cada uno ve la relación distinto. Antes de pedir cambios, alineen qué significa «mejor» para cada uno.`
      : null,
    ctx.overallGap >= 15
      ? `Tú lo percibes en torno al ${ctx.myOverallPct}% y ${partnerName(ctx)} al ${ctx.partnerOverallPct}%. Esa diferencia no significa que uno falle: miden cosas distintas.`
      : null,
    "Esto mide cómo lo sentís hoy, no un destino escrito. Si quieres, bajamos a un plan concreto para esta semana."
  );
}

function replyForTracking(ctx) {
  const top = ctx.weakest[0];
  const strong = ctx.strongest[0];
  const tip = top?.improvementTips?.[0] || "una charla corta de un solo tema, sin multitarea";
  return say(
    "Me gusta que preguntes por seguimiento — es lo que de verdad mueve la aguja.",
    "Yo haría un ciclo sencillo de 7 días: cada domingo, 10 minutos para preguntar «¿ocurrió lo que acordamos?» y «del 1 al 10, cómo lo sentimos».",
    top ? `Esta semana enfocaría ${top.label} (${top.baselinePct}%). Algo pequeño basta: ${tip}.` : "Elijan una categoría débil y un solo gesto observable — nada heroico.",
    strong ? `Y no descuiden ${strong.label}: un gesto concreto que mantenga viva esa fortaleza.` : null,
    "Si marcaron «No» en el test, elijan uno y conviértanlo en conversación, no en juicio.",
    "Cuando repitáis el test principal en unas semanas, los números os dirán si la percepción sube de verdad."
  );
}

function replyForDont(ctx) {
  const parts = [
    pickVoice(ctx, 8, [
      "Buena pregunta. A veces mejorar es más «dejar de hacer» que «hacer más».",
      "Te digo lo que evitaría ahora mismo, mirando vuestras zonas más sensibles."
    ])
  ];
  ctx.weakest.slice(0, 3).forEach((cat) => {
    const donts = DONT_BY_CATEGORY[cat.key] || DONT_BY_CATEGORY.comunicacion;
    parts.push(
      `En ${cat.label} (${cat.baselinePct}%), evitaría ${donts[0].charAt(0).toLowerCase()}${donts[0].slice(1)} También ${donts[1].charAt(0).toLowerCase()}${donts[1].slice(1)}`
    );
  });
  if (ctx.gapCategories.length) {
    parts.push(`Con la brecha en ${ctx.gapCategories[0].label}, eviten asumir que el otro «debería saber» lo que necesitan sin decirlo.`);
  }
  parts.push("Y por favor, no usen el test como arma del tipo «tú sacaste peor». Es un mapa compartido, no un tribunal.");
  return say(...parts);
}

function replyForDo(ctx) {
  const top = ctx.weakest[0];
  const second = ctx.weakest[1];
  return [
    "Plan de acción según vuestros datos:",
    top
      ? `Prioridad 1 — ${top.label} (${top.baselinePct}%):\n• ${top.improvementTips?.slice(0, 2).join("\n• ") || "Conversación de 15 min con un solo tema."}`
      : null,
    second
      ? `Prioridad 2 — ${second.label}:\n• ${second.improvementTips?.[0] || second.weaknessBullets?.[0] || "Un acuerdo observable para 7 días."}`
      : null,
    top?.suggestedActivities?.[0]
      ? `Conexión práctica: ${top.suggestedActivities[0]}`
      : null,
    ctx.alignmentGuidance
      ? "Si no se entienden: primero alineen qué significa «bien» en una categoría, luego pidan cambio."
      : null,
    "Cierren cada acción con: ¿quién?, ¿cuándo?, ¿cómo sabremos que ocurrió?"
  ]
    .filter(Boolean)
    .join("\n\n");
}

function replyForCelebrate(ctx) {
  const lines = [
    "Fortalezas que conviene celebrar y proteger:",
    ...ctx.strongest.map((cat) => {
      const w = cat.weaknessBullets?.[0] || "Sigan reforzando lo que ya funciona.";
      return `• ${cat.label} (${cat.baselinePct}% conjunto): ${w}`;
    })
  ];
  if (ctx.midCategories.length >= 2) {
    lines.push(
      `\nTambién van bien (zona estable): ${ctx.midCategories
        .slice(0, 3)
        .map((c) => c.label)
        .join(", ")}.`
    );
  }
  lines.push(
    "\nCelebrar no es ignorar problemas: un elogio específico semanal reduce la erosión en áreas débiles."
  );
  return lines.join("\n");
}

function replyForStats(ctx) {
  const header = [
    `Compatibilidad conjunta: ${ctx.overallPct}%`,
    `Tu percepción global: ${ctx.myOverallPct}% · ${ctx.partnerLabel}: ${ctx.partnerOverallPct}%`,
    `Veredicto: ${ctx.verdict.headline}`,
    "",
    "Desglose por categoría (tú · pareja · conjunto):"
  ];
  const rows = ctx.byCategory.map((cat) => {
    const me = cat.meScore != null ? Math.round(cat.meScore * 100) : "—";
    const p = cat.partnerScore != null ? Math.round(cat.partnerScore * 100) : "—";
    const band = scoreBand(cat.baselineAvg);
    const bandLabel =
      band === "strong" ? "fuerte" : band === "mid" ? "media" : band === "low" ? "baja" : "crítica";
    return `• ${cat.label}: ${me}% · ${p}% · ${cat.baselinePct}% (${bandLabel})`;
  });
  return [...header, ...rows].join("\n");
}

function replyForCompare(ctx) {
  if (!ctx.gapCategories.length) {
    return [
      "Sus percepciones están bastante alineadas en el test.",
      ctx.weakest.length
        ? `Aun así, el trabajo está en mejorar ${ctx.weakest.map((c) => c.label).join(", ")}, no en convencer al otro de que vea igual.`
        : null,
      "Si hay roce, elijan un comportamiento observable que ambos reconozcan esta semana."
    ]
      .filter(Boolean)
      .join("\n\n");
  }
  const lines = [
    "Categorías donde ven la relación distinto (brecha de percepción):",
    ...ctx.gapCategories.slice(0, 4).map((cat) => {
      const me = cat.meScore != null ? Math.round(cat.meScore * 100) : "?";
      const p = cat.partnerScore != null ? Math.round(cat.partnerScore * 100) : "?";
      const hint = cat.gapHint || GAP_HINT_FALLBACK;
      return `• ${cat.label}: tú ${me}% vs ${ctx.partnerLabel} ${p}% (brecha ${Math.round((cat.gapBetweenUs || 0) * 100)} pts). ${hint}`;
    })
  ];
  if (ctx.alignmentGuidance) {
    lines.push("", ctx.alignmentGuidance.title, ctx.alignmentGuidance.body);
    lines.push("Pasos:", ...ctx.alignmentGuidance.steps.map((s, i) => `${i + 1}. ${s}`));
  }
  return lines.join("\n");
}

const GAP_HINT_FALLBACK =
  "Definan qué comportamiento concreto significaría «mejor» para cada uno antes de debatir quién tiene razón.";

function replyForNos(ctx) {
  const myCount = ctx.myNoInsights.reduce((n, b) => n + b.items.length, 0);
  const pCount = ctx.partnerNoInsights.reduce((n, b) => n + b.items.length, 0);
  if (myCount === 0 && pCount === 0) {
    return "Ninguno marcó «No» en el test principal, o aún no hay datos. Los «No» señalan afirmaciones concretas que no resuenan; son agenda de conversación, no veredicto.";
  }
  const lines = [
    "Los «No» del test son pistas concretas. No significan que la relación termine; indican dónde una afirmación no encaja con la experiencia actual."
  ];
  if (myCount > 0) {
    const block = ctx.myNoInsights[0];
    const item = block?.items?.[0];
    if (item) {
      lines.push(
        `\nEjemplo tuyo (${block.categoryLabel}): «${item.questionText}»`,
        `Por qué duele: ${item.whyNo}`,
        `Qué hacer: ${item.recommendation}`
      );
    }
    lines.push(`Tienes ${myCount} «No» repartidos en ${ctx.myNoInsights.length} categoría(s).`);
  }
  if (pCount > 0) {
    const block = ctx.partnerNoInsights[0];
    const item = block?.items?.[0];
    if (item) {
      lines.push(
        `\nEjemplo de ${ctx.partnerLabel} (${block.categoryLabel}): «${item.questionText}»`,
        `Enfoque: ${item.recommendation}`
      );
    }
    lines.push(`${ctx.partnerLabel} tiene ${pCount} «No» en ${ctx.partnerNoInsights.length} categoría(s).`);
  }
  lines.push(
    "\nRegla: hablen de un «No» a la vez. Reformulen en comportamiento observable («¿qué haríamos distinto el domingo?»)."
  );
  return lines.join("\n");
}

function replyForCrisis(ctx) {
  const critical = ctx.lowCategories.length;
  return [
    "Si sientes que no puedes más, tu experiencia importa. Este coach no reemplaza terapia ni líneas de ayuda; orienta según el test.",
    critical >= 3
      ? `Hay ${critical} áreas con percepción muy baja. Eso explica agotamiento; no significa que debáis romper hoy.`
      : "Antes de decidir algo drástico, prueben una pausa de 48 h sin discusión grande y un acuerdo mínimo de trato civil.",
    "Tres pasos urgentes: 1) Palabra de pausa si hay gritos. 2) Una conversación escrita corta (5 líneas cada uno). 3) Evaluar apoyo profesial si hay desprecio o miedo recurrente.",
    ctx.weakest[0]
      ? `Si siguen juntos esta semana, enfoquen solo ${ctx.weakest[0].label}: ${ctx.weakest[0].improvementTips?.[0] || "seguridad emocional básica"}.`
      : null,
    "Si hay violencia o miedo por tu seguridad, prioriza apoyo local especializado; la relación no debe costarte integridad."
  ]
    .filter(Boolean)
    .join("\n\n");
}

function replyForDates(ctx) {
  const fun = ctx.byCategory.find((c) => c.key === "diversion") || ctx.weakest[0];
  const acts = fun?.suggestedActivities || [];
  const lines = [
    `Para reactivar conexión con ${ctx.partnerLabel}, prioricen diversión sin multitarea. Responder con interés a propuestas pequeñas predice satisfacción más que gestos raros y grandes.`,
    acts.length
      ? `Tres planes concretos:\n1. ${acts[0]}\n2. ${acts[1] || acts[0]}\n3. ${acts[2] || acts[0]}`
      : "Elijan 90 min sin móviles: caminata, mercado local o clase corta que ninguno domine."
  ];
  if (fun) {
    lines.push(
      `En ${fun.label} (${fun.baselinePct}%) conviene mezclar disfrute y check-in honesto de 10 min, no solo entretenimiento.`
    );
  }
  return lines.join("\n\n");
}

function replyForCommunication(ctx) {
  const comm = ctx.byCategory.find((c) => c.key === "comunicacion") || ctx.weakest[0];
  const tips = comm?.improvementTips?.slice(0, 2) || [];
  return say(
    "Cuando la conversación se pone densa, a mí me ayuda salir del cara a cara rígido — caminar juntos o escribir cinco líneas y leerlas en voz baja.",
    "Una regla de oro: un tema a la vez. Si sale otro, anótalo y vuelves después.",
    tips.length ? `Para ${comm.label}: ${tips.join(" ")}` : null,
    comm?.weaknessBullets?.[0] || null,
    ctx.alignmentGuidance ? "Si sienten que no se entienden, alineen qué significa «hablar bien» antes de exigir más." : null
  );
}

function replyForMoney(ctx) {
  const eco = ctx.byCategory.find((c) => c.key === "eco") || ctx.weakest[0];
  const tips = eco?.improvementTips?.slice(0, 2) || [];
  return [
    "El dinero activa amenaza emocional rápido. Sesiones de 15–20 min, tema único, sin culpas — solo números y un acuerdo para 7 días.",
    tips.length ? `Para estabilidad financiera:\n• ${tips.join("\n• ")}` : "Compartan solo gastos comunes al inicio si la transparencia total aún cuesta.",
    eco?.weaknessBullets?.[0] || null,
    "Salida útil: café tranquilo + hoja con ingresos, fijos y discrecional. Cierran con una sola decisión."
  ]
    .filter(Boolean)
    .join("\n\n");
}

function replyForAlignment(ctx) {
  const ag = ctx.alignmentGuidance;
  if (!ag) {
    return "Sus percepciones están bastante alineadas. Si hay roce, elijan un tema y describan qué comportamiento observable significaría «mejor» esta semana.";
  }
  return [ag.title, ag.body, "Pasos:", ...ag.steps.map((s, i) => `${i + 1}. ${s}`)].join("\n\n");
}

function replyForResults(ctx) {
  return replyForVerdict(ctx);
}

function replyForAction(ctx) {
  const top = ctx.weakest[0];
  if (!top) {
    return "Cuando los dos completen el test principal podré proponeros un plan semanal más fino. Por ahora, cuéntame qué os preocupa más.";
  }
  return say(
    `Esta semana yo iría a ${top.label} (${top.baselinePct}%).`,
    top.improvementTips?.[0] || null,
    top.suggestedActivities?.[0] ? `Si queréis algo más ligado: ${top.suggestedActivities[0]}.` : null,
    top.weaknessBullets?.[0] || null,
    "El domingo, pregúntense: ¿pasó? ¿ajustamos o celebramos? Siete días bastan para notar si la percepción cambia."
  );
}

function replyForCategoryIntent(intent, ctx) {
  const key = categoryFromIntent(intent);
  const cat = ctx.byCategory.find((c) => c.key === key) || ctx.weakest[0];
  if (!cat) return replyForAction(ctx);
  const band = scoreBand(cat.baselineAvg);
  const me = cat.meScore != null ? Math.round(cat.meScore * 100) : "?";
  const p = cat.partnerScore != null ? Math.round(cat.partnerScore * 100) : "?";
  let tone;
  if (band === "strong") tone = "Aquí veo buenas noticias.";
  else if (band === "mid") tone = "Va en una zona intermedia — ni alarmante, pero conviene afinar.";
  else tone = "Aquí la cosa pide conversación pronto, con calma.";
  const tips = cat.improvementTips?.slice(0, 2).join(" ") || "";
  const dont = (DONT_BY_CATEGORY[cat.key] || [])[0] || "";
  const act = cat.suggestedActivities?.[0] || "";
  return say(
    `${tone} En ${cat.label} estáis al ${cat.baselinePct}% conjunto (tú ${me}%, ${partnerName(ctx)} ${p}%).`,
    cat.gapHint || null,
    cat.weaknessBullets?.[0] || null,
    tips ? `Yo probaría: ${tips}` : null,
    dont ? `Y evitaría ${dont.charAt(0).toLowerCase()}${dont.slice(1)}` : null,
    act ? `Para conectar: ${act}.` : null
  );
}

function replyGeneral(ctx) {
  return say(
    `Hola — soy tu coach en Metriclove para la relación con ${partnerName(ctx)}. He mirado vuestros resultados.`,
    `Ahora mismo veo un ${ctx.overallPct}% conjunto. ${ctx.verdict.summary}`,
    ctx.weakest.length ? `Las zonas más sensibles: ${ctx.weakest.map((c) => c.label).join(", ")}.` : null,
    ctx.strongest.length ? `Y vuestras fortalezas: ${ctx.strongest.map((c) => c.label).join(" y ")}.` : null,
    "Puedo ayudarte con qué va bien, qué duele, qué probar, qué evitar, seguimiento o cómo leer los «No» del test. Solo hablo de pareja.",
    "¿Quieres que empecemos por un panorama general o por algo concreto?"
  );
}

const SUGGESTED_BY_INTENT = {
  out_of_scope: ["¿Cómo lo vemos en general?", "¿Qué evitaríamos ahora?", "¿Qué hacemos esta semana?"],
  verdict: ["¿Qué nos preocupa más?", "¿Dónde vamos bien?", "¿Qué hacemos esta semana?"],
  tracking: ["¿Cómo sabemos si mejoramos?", "¿Cuándo repetir el test?", "¿Qué mirar cada domingo?"],
  dont: ["¿Errores al pelear?", "¿Qué evitar con dinero?", "¿Qué no repetir?"],
  do: ["¿Plan para el fin de semana?", "¿Un primer paso pequeño?", "¿Cómo mejorar lo más débil?"],
  celebrate: ["¿Cómo cuidar lo que funciona?", "¿Qué celebrar esta semana?", "¿Cuáles son nuestras fortalezas?"],
  stats: ["¿Dónde estamos desalineados?", "¿Cuál es la categoría más baja?", "¿Cómo lo vemos en general?"],
  compare: ["¿En qué no pensamos igual?", "¿Cómo alinear expectativas?", "¿Por qué vemos distinto el test?"],
  nos: ["¿Cómo hablar de un No?", "¿Qué significan los No?", "¿Qué hacer con un No del test?"],
  crisis: ["¿Qué hacemos esta semana?", "¿Cómo bajar la intensidad?", "¿Cuál es el primer paso?"],
  dates: ["¿Otra idea sencilla?", "¿Cita sin solo problemas?", "¿Plan según diversión?"],
  communication: ["¿Qué hago si sube el tono?", "¿Cómo pedir perdón bien?", "¿Cómo escuchar mejor?"],
  money: ["¿Primera charla sin pelear?", "¿Cómo repartir gastos?", "¿Qué evitar con dinero?"],
  alignment: ["¿Por dónde empezar a alinear?", "¿Qué es un gesto observable?", "¿Cómo alinear expectativas?"],
  results: ["¿Cómo lo vemos en general?", "¿Qué evitar?", "¿Cómo hacemos seguimiento?"],
  action: ["¿Plan para el fin de semana?", "¿Cómo sabemos si mejoramos?", "¿Qué evitar?"],
  general: ["¿Cómo lo vemos en general?", "¿Qué evitaríamos ahora?", "¿Qué hacemos esta semana?"]
};

function enrichMessageWithHistory(message, history) {
  const trimmed = String(message || "").trim();
  if (!history?.length || trimmed.length > 28) return trimmed;
  const lastCoach = [...history].reverse().find((h) => h.role === "coach" && h.text);
  if (!lastCoach) return trimmed;
  return `${trimmed} (siguiendo: ${String(lastCoach.text).slice(0, 100)})`;
}

function handleCoachMessage(message, ctx, history = []) {
  const contextualMessage = enrichMessageWithHistory(message, history);
  const intent = detectIntent(contextualMessage);
  let reply;

  switch (intent) {
    case "out_of_scope":
      reply = replyOutOfScope(ctx);
      break;
    case "verdict":
      reply = replyForVerdict(ctx);
      break;
    case "tracking":
      reply = replyForTracking(ctx);
      break;
    case "dont":
      reply = replyForDont(ctx);
      break;
    case "do":
      reply = replyForDo(ctx);
      break;
    case "celebrate":
      reply = replyForCelebrate(ctx);
      break;
    case "stats":
      reply = replyForStats(ctx);
      break;
    case "compare":
      reply = replyForCompare(ctx);
      break;
    case "nos":
      reply = replyForNos(ctx);
      break;
    case "crisis":
      reply = replyForCrisis(ctx);
      break;
    case "dates":
      reply = replyForDates(ctx);
      break;
    case "communication":
      reply = replyForCommunication(ctx);
      break;
    case "money":
      reply = replyForMoney(ctx);
      break;
    case "alignment":
      reply = replyForAlignment(ctx);
      break;
    case "results":
      reply = replyForResults(ctx);
      break;
    case "action":
      reply = replyForAction(ctx);
      break;
    case "general":
      reply = replyGeneral(ctx);
      break;
    default:
      reply = replyForCategoryIntent(intent, ctx);
  }

  const suggestedPrompts = SUGGESTED_BY_INTENT[intent] || SUGGESTED_BY_INTENT.general;
  const polished = polishCoachReply(reply.replace(/\*\*/g, ""), ctx, history);

  return {
    intent,
    reply: polished,
    suggestedPrompts,
    contextSummary: {
      overallPct: ctx.overallPct,
      partnerLabel: ctx.partnerLabel,
      focusAreas: ctx.weakest.slice(0, 3).map((c) => c.label),
      verdictTier: ctx.verdict?.tier,
      verdictHeadline: ctx.verdict?.headline
    }
  };
}

module.exports = {
  buildCoachContext,
  handleCoachMessage,
  detectIntent,
  isOutOfScope
};
