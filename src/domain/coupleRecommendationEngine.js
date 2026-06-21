/**
 * Motor de recomendaciones para test de pareja.
 * Selección determinista por pareja + categoría (misma pareja → mismas sugerencias;
 * categorías distintas → contenido distinto, sin repetir frases genéricas).
 *
 * Inspirado en prácticas de educación de pareja (Gottman: mapas de amor, turning toward,
 * citas con conversación, reglas de conflicto suave).
 */

const { categories } = require("./testModel");

function clamp01(n) {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** Semilla estable a partir de IDs de pareja y categoría. */
function coupleSeed(userIdA, userIdB, categoryKey, salt = 0) {
  const pair = [String(userIdA || ""), String(userIdB || "")].sort().join("|");
  const str = `${pair}::${categoryKey}::${salt}`;
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0);
}

function pickN(pool, seed, count) {
  if (!pool?.length) return [];
  const n = Math.min(count, pool.length);
  const used = new Set();
  const out = [];
  let s = seed;
  while (out.length < n && used.size < pool.length) {
    const idx = s % pool.length;
    s = Math.floor(s / pool.length) + idx + 1;
    if (!used.has(idx)) {
      used.add(idx);
      out.push(pool[idx]);
    }
  }
  return out;
}

function scoreBand(avg) {
  if (avg >= 0.72) return "strong";
  if (avg >= 0.55) return "mid";
  if (avg >= 0.45) return "low";
  return "critical";
}

/** Nota de alineación de percepciones — solo a nivel de plan, una vez. */
function buildAlignmentGuidance(categoriesWithGap) {
  if (!categoriesWithGap.length) return null;
  const labels = categoriesWithGap.map((c) => c.label).join(", ");
  return {
    title: "Antes de mejorar: alinear qué significa «bien»",
    body:
      "En varias áreas ustedes puntúan muy distinto. Eso no significa que uno tenga razón y el otro no: suelen medir cosas distintas con la misma palabra.",
    steps: [
      `Elijan una categoría para empezar (${labels}). Cada uno describe en una frase qué sería «bien» para ustedes esta semana, sin corregir al otro.`,
      "Busquen un comportamiento observable que ambos reconozcan (ej.: «hablamos 10 min sin móvil»), no un sentimiento abstracto.",
      "Acuerden revisar en 7 días si ese comportamiento ocurrió; ajusten la definición antes de exigir más cambios."
    ],
    categoryKeys: categoriesWithGap.map((c) => c.key)
  };
}

const GAP_HINTS = {
  eco: "En dinero, uno puede pensar en ahorro y el otro en disfrute: definan qué «responsable» significa en números concretos.",
  respeto: "El respeto se siente distinto: para uno es tono de voz, para otro es tiempo o atención. Nombren el gesto que cada uno necesita.",
  tolerancia: "La tolerancia no es aguantar todo: acuerden qué hábitos son negociables y cuáles son límites innegociables.",
  confianza: "La confianza puede ser transparencia para uno y espacio para el otro. Pregunten qué acción concreta les daría más calma.",
  comunicacion: "«Comunicarnos bien» puede ser hablar mucho o poco: definan frecuencia, tema y duración que ambos consideren suficiente.",
  diversion: "Diversión no es lo mismo para los dos: uno puede querer aventura y otro calma. Alternen quién propone el plan cada semana.",
  intimidad: "Intimidad incluye tacto, deseo y ritmo: eviten suposiciones; cada uno describe qué le conecta sin presión de actuar ya.",
  convivencia_social: "Socializar puede recargar a uno y drenar al otro: pacten cuántas salidas al mes y señales para retirarse sin culpa.",
  cuidado_personal: "Autocuidado vs pareja: definan bloques innegociables de descanso y cómo avisar cuando uno está al límite.",
  organizacion: "Orden significa cosas distintas: hagan lista visible de 3 tareas con responsable y qué nivel de «orden» esperan."
};

const WEAKNESS_BY_BAND = {
  eco: {
    critical: "El dinero concentra tensión: eviten charlas improvisadas; usen agenda fija y datos, no culpas.",
    low: "Los acuerdos financieros se sienten frágiles: un repaso semanal corto suele prevenir peleas grandes.",
    mid: "Va aceptable, pero un gasto o deuda sin hablar puede reactivar desconfianza.",
    strong: "Buena base; mantengan transparencia en compras grandes aunque el día a día vaya bien."
  },
  respeto: {
    critical: "Hay señales de desgaste en el trato: prioricen seguridad emocional antes de debatir quién tiene razón.",
    low: "El tono en discusiones pesa más de lo que parece: practiquen pausa antes de responder.",
    mid: "En general se cuidan; vigilen microdescalificaciones en momentos de estrés.",
    strong: "Se valoran mutuamente; sigan elogiando hechos concretos, no solo «te quiero»."
  },
  tolerancia: {
    critical: "Mucha rigidez o presión por cambiar: negocien espacio y tiempos antes de exigir adaptación.",
    low: "Hábitos cotidianos generan roce: eligen un solo hábito a probar una semana, no diez.",
    mid: "Flexibles en lo esencial; un tema puntual merece conversación sin generalizar.",
    strong: "Buena aceptación de diferencias; sigan curiosidad ante lo que al otro le importa."
  },
  confianza: {
    critical: "La seguridad en la relación está baja: acuerdos cortos (7 días) y hechos observables, no promesas eternas.",
    low: "Celos o silencios pendientes: nombre un tema incómodo con turnos y sin multitarea.",
    mid: "Confían en lo básico; aclaren un límite que aún genera duda.",
    strong: "Base sólida; la transparencia voluntaria refuerza más que la vigilancia."
  },
  comunicacion: {
    critical: "El diálogo está bloqueado: mensajes escritos cortos antes de hablar cara a cara pueden desbloquear.",
    low: "Evitan temas o escalan rápido: una conversación a la vez, con temporizador de 15 min.",
    mid: "Se entienden en muchas cosas; practiquen reformular («lo que escuché es…») en temas sensibles.",
    strong: "Comunicación fluida; reserven 10 min diarios sin pantallas para no perder el hábito."
  },
  diversion: {
    critical: "Poca conexión lúdica: prioricen una salida sin agenda esta semana, aunque sea breve.",
    low: "El tiempo libre no alcanza o no coincide: microplanes de 90 min valen más que esperar el fin de semana perfecto.",
    mid: "Se divierten a ratos; alternen quién elige la actividad para equilibrar gustos.",
    strong: "Buen humor compartido; un ritual semanal (café, caminata) mantiene la chispa."
  },
  intimidad: {
    critical: "Desalineación profunda: conversación sin presión de actuar; consentimiento y ritmo por encima de frecuencia.",
    low: "Deseo o tacto desencontrados: check-in breve («¿qué te gustaría esta semana?») sin culpas.",
    mid: "Conexión irregular; planifiquen tiempo a solas sin pantallas ni listas de tareas.",
    strong: "Buena intimidad; sigan nombrando gustos sin asumir que el otro adivina."
  },
  convivencia_social: {
    critical: "Familia o amigos generan conflicto frecuente: límites escritos y quién «lidera» cada evento.",
    low: "Eventos sociales agotan a uno de los dos: pacten señal discreta para irse y cuántas salidas al mes.",
    mid: "Encajan en lo social salvo excepciones; definan un evento que uno evita y por qué.",
    strong: "Buen equilibrio social; sigan alternando planes con amigos y familia."
  },
  cuidado_personal: {
    critical: "Hábitos de salud o estrés afectan la pareja: cada uno nombra un cambio pequeño y un apoyo concreto del otro.",
    low: "Sueño, sustancias o sobrecarga pesan: bloqueen autocuidado en calendario como cita innegociable.",
    mid: "Estilo de vida aceptable; un hábito visible (caminar, horario) puede mejorar el ánimo de ambos.",
    strong: "Se cuidan bien; compartan qué los recarga para sostenerlo en épocas duras."
  },
  organizacion: {
    critical: "La carga del hogar genera resentimiento: reparto visible de 3 tareas con día y responsable.",
    low: "Desorden o tareas desiguales: sprint de 25 min en un solo espacio juntos, sin sermón.",
    mid: "Organización mejorable; un recordatorio compartido evita «yo siempre lo hago».",
    strong: "Buen funcionamiento doméstico; revisen calendario los domingos 10 min."
  }
};

const TIPS_POOL = {
  eco: {
    critical: [
      "Sesión financiera de 20 min con regla: solo números, sin culpas. Cierren con un solo acuerdo para 7 días.",
      "Tabla de ingresos, gastos fijos y discrecional de cada uno. Busquen equidad percibida, no solo matemática.",
      "Congelen compras grandes >X monto hasta la próxima reunión de dinero."
    ],
    low: [
      "App o hoja compartida solo para gastos comunes; revisen cada viernes.",
      "Cada uno propone una meta de ahorro pequeña del mes y la comparten en cena tranquila.",
      "Antes de hablar de dinero, cada uno dice cómo se siente (1–10) y qué necesita para sentirse seguro."
    ],
    mid: [
      "Un solo hábito de gasto a corregir en 14 días; midan si ambos lo notan.",
      "Turnos para pagar facturas o compras grandes; evita sensación de carga desigual.",
      "Celebrar un logro financiero pequeño (deuda pagada, meta cumplida) antes de pedir más cambios."
    ],
    strong: [
      "Chequeo trimestral de metas a largo plazo sin tocar el día a día.",
      "Mantengan tope de conversación para compras impulsivas; lo que funciona, no lo toquen.",
      "Un «fondo sorpresa» simbólico para caprichos mutuos sin justificar cada gasto."
    ]
  },
  respeto: {
    critical: [
      "Palabra de pausa obligatoria: si hay grito, se suspende la charla 30 min sin perseguir.",
      "Cada uno escribe 3 cualidades que aún valora del otro y las lee sin debate.",
      "Regla: primero trato civil, luego contenido del problema."
    ],
    low: [
      "Elogio específico semanal («me gustó cuando hiciste…»), no genérico.",
      "En discusión, una señal física acordada (mano al corazón) para bajar el tono.",
      "Eviten generalizar («siempre / nunca»); un ejemplo reciente y una petición concreta."
    ],
    mid: [
      "Revisen cómo hablan del otro frente a familia o amigos; alineen narrativa.",
      "Pregunten qué gesto de respeto les haría falta esta semana.",
      "Practiquen disculpa en dos partes: reconocer impacto + qué harán distinto."
    ],
    strong: [
      "Sigan modelando admiración pública discreta entre ustedes.",
      "Microgestos diarios (saludo al llegar, despedida con contacto) anclan respeto.",
      "Si surge roce, reparación rápida en 24 h evita acumular resentimiento."
    ]
  },
  tolerancia: {
    critical: [
      "Lista de «negociable / no negociable» por cada uno; respeten los no negociables.",
      "Espacios físicos o horarios donde cada uno puede ser como es sin comentarios.",
      "Terapia o mediación si la presión por cambiar es constante."
    ],
    low: [
      "Juego «un sí por día»: propuesta pequeña fuera de zona cómoda del otro.",
      "Charla con observaciones («noto que…») sin juicio de carácter.",
      "Plan B cuando no coinciden gustos (película, comida, salida)."
    ],
    mid: [
      "Un hábito molesto a tolerar una semana a cambio de que el otro haga lo mismo.",
      "Pregunten qué diferencia admiran del otro, no solo qué les irrita.",
      "Acuerden «hora libre de críticas» en la convivencia diaria."
    ],
    strong: [
      "Curiosidad ante diferencias: preguntar «¿por qué te importa?» antes de juzgar.",
      "Celebrar que no son clones; la complementariedad es recurso.",
      "Revisar si algún hábito tolerado se volvió resentimiento; ajustar a tiempo."
    ]
  },
  confianza: {
    critical: [
      "Acuerdos de 7 días con comportamientos observables (avisos, horarios, transparencia mínima).",
      "Una confesión menor cada uno; el otro solo valida, no soluciona en el acto.",
      "Eviten revisar teléfono o redes como prueba; sustituyan por diálogo programado."
    ],
    low: [
      "Canal claro para mensajes importantes (evitar malentendidos solo por chat).",
      "Preguntar intención antes de concluir («¿qué quisiste decir con…?»).",
      "Revisar un límite de privacidad/espacio que dé seguridad a ambos."
    ],
    mid: [
      "Compartir una preocupación que antes no contaban; practicar respuesta calmada.",
      "Celos: ejemplos concretos y qué aviso anticipado ayudaría.",
      "Ritual de «nada grave pendiente» los domingos, 5 min."
    ],
    strong: [
      "Transparencia por comodidad, no por miedo.",
      "Seguir cumpliendo lo pequeño; la confianza se erosiona con detalles, no solo traiciones grandes.",
      "Agradecer cuando el otro es vulnerable; refuerza apertura futura."
    ]
  },
  comunicacion: {
    critical: [
      "Escribir el tema difícil en papel; leerlo en voz baja con turnos de 3 min.",
      "Regla de una conversación a la vez; si surge otro tema, anótalo para después.",
      "Si sube el tono, pausa de 20 min mínimo con hora de retoma acordada."
    ],
    low: [
      "10 min diarios sin pantallas: energía del 1 al 10 y por qué.",
      "Escucha activa: uno habla 3 min, el otro solo reformula.",
      "Yo + petición pequeña, sin lista de fallos del otro."
    ],
    mid: [
      "Tema sensible en caminata lado a lado (más fácil que cara a cara fijo).",
      "Preguntas Gottman: «¿Qué te preocupa hoy?» «¿En qué puedo apoyarte?»",
      "Acordar cómo pedir perdón según lo que cada uno necesita escuchar."
    ],
    strong: [
      "Mantengan ritual de check-in; la comunicación se pierde en la rutina.",
      "Celebrar conversaciones difíciles bien llevadas, no solo resultados.",
      "Un mensaje de gratitud escrito a la semana refuerza el canal."
    ]
  },
  diversion: {
    critical: [
      "Salida obligatoria de 90 min sin móviles esta semana; eligen juntos algo mínimo viable.",
      "Lista de 5 cosas que les hicieron reír; repitan una.",
      "Revisar si carga laboral/familiar está matando el ocio; ajustar antes de culparse."
    ],
    low: [
      "Alternar quién propone el plan cada fin de semana.",
      "Presupuesto realista para salir; creatividad low-cost cuenta (picnic, atardecer).",
      "Ritual tonto semanal: playlist compartida, café dominical, juego de mesa."
    ],
    mid: [
      "Cita con «conversación profunda»: 8 preguntas de sueños o metas (estilo Eight Dates).",
      "Probar actividad nueva para ambos (clase de cocina, bici, museo interactivo).",
      "Bloquear en calendario «tiempo pareja» como si fuera reunión de trabajo."
    ],
    strong: [
      "Una aventura al mes fuera de la rutina (pueblo cercano, ruta gastronómica).",
      "Turning toward: responder con interés a propuestas pequeñas del otro.",
      "Fotos o notas de momentos divertidos; recordarlos en días grises."
    ]
  },
  intimidad: {
    critical: [
      "Conversación sobre ritmos y deseos sin presión de actuar esa noche.",
      "Abrazo largo (60 s) como ritual de conexión sin expectativas extra.",
      "Si hay dolor o bloqueo, priorizar salud/consentimiento sobre frecuencia."
    ],
    low: [
      "Check-in breve: «¿qué tipo de cercanía te apetece esta semana?»",
      "Planificar cita con tiempo reservado solo para ustedes, sin agenda apretada.",
      "Otras vías de cariño (mensajes, tacto no sexual) mientras alinean deseo."
    ],
    mid: [
      "«No hoy» con cariño explícito; reduce presión y mantiene vínculo.",
      "Explorar sensaciones y preferencias con curiosidad, no examen.",
      "Desconectar dispositivos en dormitorio una noche por semana."
    ],
    strong: [
      "Seguir nombrando gustos; lo que funciona puede evolucionar.",
      "Pequeñas sorpresas de conexión (nota, baño preparado, masaje corto).",
      "Revisar estrés externo antes de interpretar falta de deseo como rechazo."
    ]
  },
  convivencia_social: {
    critical: [
      "Límites escritos con familia/amigos: duración visitas, temas prohibidos, quién comunica.",
      "Un evento donde uno lidera y el otro apoya; rotar la próxima vez.",
      "Si hay conflicto grave, unificar mensaje en pareja antes de responder al entorno."
    ],
    low: [
      "Cuántas salidas sociales al mes se sienten bien para cada uno.",
      "Señales discretas para retirarse sin drama.",
      "Tiempo a solas después de eventos sociales largos para recargar."
    ],
    mid: [
      "Alternar eventos «su gente / mi gente» con equilibrio trimestral.",
      "Acordar cuándo decir que no a una invitación sin culpa.",
      "Debrief 10 min post-evento: ¿qué funcionó, qué ajustar?"
    ],
    strong: [
      "Seguir presentándose como equipo frente al entorno.",
      "Agradecer al otro cuando apoya en contexto incómodo.",
      "Un plan social que ambos anticipen con ilusión cada mes."
    ]
  },
  cuidado_personal: {
    critical: [
      "Cada uno nombra un cambio de hábito pequeño y cómo el otro puede apoyar sin controlar.",
      "Bloques de sueño o descanso innegociables en calendario compartido.",
      "Si hay sustancias o salud mental, buscar ayuda profesional como equipo."
    ],
    low: [
      "2 huecos semanales de autocuidado innegociables cada uno.",
      "Compartir qué recarga vs. qué drena; ajustar cargas domésticas.",
      "Caminata o deporte juntos 1×/semana sin competir."
    ],
    mid: [
      "Avisar cuando están al límite antes de explotar en la pareja.",
      "Celebrar logros de salud del otro como propios.",
      "Revisar si el estrés laboral está siendo «descargado» en casa."
    ],
    strong: [
      "Mantener hábitos que los hacen mejor pareja, no solo mejor persona.",
      "Vacaciones o días off planificados antes del burnout.",
      "Modelar autocuidado para que el otro también se permita pausa."
    ]
  },
  organizacion: {
    critical: [
      "Tablero visible: 3 tareas, responsable, día. Revisión domingo 10 min.",
      "Mini sprint 25 min en un solo espacio; sin repasar toda la casa.",
      "Si el desorden es síntoma de sobrecarga, reducir compromisos antes de limpiar más."
    ],
    low: [
      "Recordatorios compartidos para facturas y compras.",
      "Cada uno «dueño» de una zona de la casa por un mes.",
      "Lista de compras común en app; evita «pensé que tú lo harías»."
    ],
    mid: [
      "Acordar estándar mínimo de orden (no perfección).",
      "Delegar una tarea que uno odia a cambio de otra.",
      "Preparar ropa o mochilas la noche anterior juntos."
    ],
    strong: [
      "Mantener ritual dominical de calendario + tareas.",
      "Agradecer tareas invisibles (logística, recordatorios).",
      "Un reset estacional (armario, papeles) como date de productividad."
    ]
  }
};

/** Salidas y planes concretos por categoría (rotación determinista). */
const ACTIVITIES_POOL = {
  eco: [
    "Café tranquilo + revisión de gastos del mes en papel (30 min máx).",
    "Mercado local: planifiquen menú semanal y presupuesto antes de comprar.",
    "Paseo por librería o cowork: cada uno anota una meta financiera en una tarjeta.",
    "Noche «sin compras»: cena casera y celebran un ahorro conseguido, por pequeño que sea."
  ],
  respeto: [
    "Cena donde solo hablen de cosas que admiran del otro (sin «peros»).",
    "Caminata de 40 min con regla: cero críticas, solo curiosidad.",
    "Escribir cartas cortas de gratitud y leerlas en un parque.",
    "Museo o galería: comenten obras sin corregir gustos del otro."
  ],
  tolerancia: [
    "Cada uno elige un plato o restaurante que el otro no probaría normalmente.",
    "Tarde de hobbies separados y luego comparten en 5 min qué disfrutaron.",
    "Mercado de barrio explorando algo nuevo juntos.",
    "Película que uno elige y el otro solo acompaña con buena actitud."
  ],
  confianza: [
    "Paseo largo lado a lado para un tema pendiente (no en casa).",
    "Café sin móviles: cada uno comparte una preocupación menor.",
    "Ruta en bici o kayak donde deben coordinar (literal y metafórico).",
    "Atardecer en mirador: solo escuchar, sin multitarea."
  ],
  comunicacion: [
    "Eight Dates lite: cena con 3 preguntas profundas (sueños, miedos, metas).",
    "Caminata urbana por barrio artístico comentando lo que ven (calienta el diálogo).",
    "Biblioteca o sala tranquila: leer en voz baja un texto que importe a cada uno.",
    "Brunch largo con regla de un tema difícil y temporizador de 20 min."
  ],
  diversion: [
    "Escape room o juego de mesa en café especializado.",
    "Ruta gastronómica de 3 paradas pequeñas en el centro.",
    "Senderismo fácil con snack sorpresa que uno preparó.",
    "Concierto acústico, mercado nocturno o feria local sin agenda apretada.",
    "Clase de cocina o cerámica para dos (algo que ninguno domine).",
    "Picnic al amanecer o atardecer con playlist compartida."
  ],
  intimidad: [
    "Hotel o staycation de una noche sin obligación de planes sociales.",
    "Baño preparado + música y teléfonos en otra habitación.",
    "Cena a ciegas (uno cocina, ambos visten algo que al otro le gusta).",
    "Paseo nocturno de la mano sin rumbo fijo, sin hablar de tareas."
  ],
  convivencia_social: [
    "Cena doble con amigos que los haga sentir cómodos a ambos.",
    "Plan «familia acotada»: visita corta con hora de salida acordada.",
    "Evento cultural donde puedan salir antes sin culpa si uno se agota.",
    "Brunch solo los dos después de un evento social intenso (debrief)."
  ],
  cuidado_personal: [
    "Spa o baños termales medio día (descanso sin pantallas).",
    "Caminata en parque grande + estiramiento juntos al final.",
    "Mañana deporte individual y almuerzo celebrando el esfuerzo.",
    "Tarde de siesta permitida y cena ligera sin tareas pendientes."
  ],
  organizacion: [
    "Date de productividad: café + sprint 25 min ordenando un cajón, luego premio.",
    "Feria o tienda de organización: eligen un solo producto útil juntos.",
    "Domingo de meal prep con música y lista de tareas visible.",
    "Paseo al contenedor de reciclaje y luego café como «cierre» del reset."
  ]
};

function buildCategoryRecommendation(ctx) {
  const {
    categoryKey,
    label,
    baselineAvg,
    diff,
    meScore,
    partnerScore,
    seedBase,
    suppressGapHint = false
  } = ctx;

  const band = scoreBand(baselineAvg);
  const seed = coupleSeed(seedBase.a, seedBase.b, categoryKey, 1);

  const weaknessBullets = [];
  const w = WEAKNESS_BY_BAND[categoryKey]?.[band] || WEAKNESS_BY_BAND.eco[band];
  if (w) weaknessBullets.push(w);

  if (band === "critical" || band === "low") {
    weaknessBullets.push(
      pickN(
        [
          "Un cambio pequeño esta semana suele pesar más que un plan perfecto para el año.",
          "Eviten charlas cuando estén con hambre, sueño o alcohol; reprogramen."
        ],
        seed + 3,
        1
      )[0]
    );
  }

  const tips = pickN(TIPS_POOL[categoryKey]?.[band] || TIPS_POOL.eco.mid, seed + 7, 3);
  const activities = pickN(ACTIVITIES_POOL[categoryKey] || ACTIVITIES_POOL.diversion, seed + 11, 3);

  let gapHint = null;
  if (!suppressGapHint && diff != null && diff > 0.25) {
    gapHint = GAP_HINTS[categoryKey] || GAP_HINTS.comunicacion;
  }

  return {
    key: categoryKey,
    label,
    meScore,
    partnerScore,
    baselineAvg,
    baselinePct: Math.round(baselineAvg * 100),
    gapBetweenUs: diff != null ? Math.round(diff * 1000) / 1000 : null,
    gapHint,
    severity: band === "critical" || band === "low" ? "low" : band === "mid" ? "mid" : "high",
    weaknessBullets,
    improvementTips: tips,
    suggestedActivities: activities,
    trackingPct: Math.round(baselineAvg * 100)
  };
}

/**
 * @param {{ userIdA: string, userIdB: string, myResults: object, partnerResults: object, partnerLabel: string }} input
 */
function buildEnrichedFollowUpCategories(input) {
  const { userIdA, userIdB, myResults, partnerResults } = input;
  const seedBase = { a: userIdA, b: userIdB };
  const byKey = (arr, k) => (Array.isArray(arr) ? arr.find((x) => x.key === k) : null);

  const gapCategories = [];
  const combined = categories.map((cat) => {
    const me = byKey(myResults?.byCategory, cat.key);
    const p = byKey(partnerResults?.byCategory, cat.key);
    const meScore = me ? Number(me.score) : null;
    const partnerScore = p ? Number(p.score) : null;
    const baselineAvg =
      meScore != null && partnerScore != null ? (meScore + partnerScore) / 2 : meScore ?? partnerScore ?? 0;
    const diff = meScore != null && partnerScore != null ? Math.abs(meScore - partnerScore) : null;
    if (diff != null && diff > 0.25) {
      gapCategories.push({ key: cat.key, label: cat.label, diff });
    }
    return buildCategoryRecommendation({
      categoryKey: cat.key,
      label: cat.label,
      baselineAvg,
      diff,
      meScore,
      partnerScore,
      seedBase,
      suppressGapHint: true
    });
  });

  const alignmentGuidance = buildAlignmentGuidance(
    gapCategories.sort((a, b) => b.diff - a.diff).slice(0, 3)
  );

  if (alignmentGuidance && gapCategories.length) {
    const topGapKey = gapCategories[0].key;
    const topCat = combined.find((c) => c.key === topGapKey);
    if (topCat) {
      topCat.gapHint = GAP_HINTS[topGapKey] || GAP_HINTS.comunicacion;
    }
  }

  return { combined, alignmentGuidance };
}

function tipsForCategoryRich(categoryKey, score, seedPair = null) {
  const band = scoreBand(score);
  const seed = seedPair
    ? coupleSeed(seedPair.a, seedPair.b, categoryKey, 99)
    : coupleSeed("default", categoryKey, categoryKey, 99);
  return pickN(TIPS_POOL[categoryKey]?.[band] || TIPS_POOL.eco.mid, seed, 2);
}

module.exports = {
  buildEnrichedFollowUpCategories,
  buildAlignmentGuidance,
  tipsForCategoryRich,
  coupleSeed,
  pickN,
  scoreBand
};
