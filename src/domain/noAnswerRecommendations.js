/**
 * Recomendaciones específicas cuando el usuario marca «No» en una pregunta del test de pareja.
 * Cada pregunta tiene acciones distintas según la puntuación de su categoría.
 */

const TIERS = ["critical", "alert", "improve", "focused"];

function scoreToTier(categoryScorePct) {
  const n = Number(categoryScorePct);
  if (!Number.isFinite(n)) return "improve";
  if (n < 45) return "critical";
  if (n < 60) return "alert";
  if (n < 75) return "improve";
  return "focused";
}

const TIER_LABELS = {
  critical: "prioridad alta",
  alert: "requiere atención",
  improve: "mejorable",
  focused: "punto específico"
};

/** Marco por categoría y nivel de puntuación (por qué suele decir No). */
const CATEGORY_WHY = {
  eco: {
    critical: "En economía hay varias señales rojas; esto refleja desgaste o desconfianza acumulada.",
    alert: "El tema del dinero genera fricción recurrente y esta respuesta lo confirma.",
    improve: "No es un colapso total, pero sí un punto sensible que conviene atender pronto.",
    focused: "El resto de la categoría va mejor; aquí hay un detalle concreto que no encaja."
  },
  respeto: {
    critical: "Percibe falta de respeto de forma repetida; esto erosiona la base emocional.",
    alert: "Hay conductas que se sienten hirientes o poco cuidadosas con frecuencia.",
    improve: "El respeto general es aceptable, pero en este aspecto aún no se siente seguro(a).",
    focused: "Valora el respeto en general; este matiz puntual es lo que le incomoda."
  },
  tolerancia: {
    critical: "Siente poca aceptación de quién es; esto habla de rigidez o presión por cambiar.",
    alert: "Hay diferencias que no se toleran bien y generan tensión cotidiana.",
    improve: "La convivencia es mayormente flexible, salvo en este hábito o preferencia.",
    focused: "Es flexible en casi todo; este detalle de convivencia le pesa."
  },
  confianza: {
    critical: "La seguridad en la relación está debilitada; esto apunta a control o desconfianza.",
    alert: "Hay vigilancia, celos o límites poco claros que afectan la libertad.",
    improve: "Confía en lo esencial, pero en este punto aún no se siente tranquilo(a).",
    focused: "La confianza global es buena; aquí hay una excepción que vale aclarar."
  },
  comunicacion: {
    critical: "No se siente escuchado(a) ni comprendido(a); el diálogo está muy deteriorado.",
    alert: "Evitan o escalan temas importantes; esta respuesta marca un bloqueo claro.",
    improve: "Comunican en varias cosas, pero en este canal emocional aún falla.",
    focused: "La comunicación funciona en general; este tema concreto quedó fuera."
  },
  diversion: {
    critical: "Poca conexión lúdica; esto indica soledad dentro de la pareja.",
    alert: "El tiempo de calidad no alcanza o no satisface lo que necesita.",
    improve: "Se divierten a veces, pero en este aspecto recreativo hay carencia.",
    focused: "Disfrutan juntos en lo general; aquí falta un tipo de plan o frecuencia."
  },
  intimidad: {
    critical: "La intimidad está muy desalineada; hay insatisfacción profunda en este ámbito.",
    alert: "Hay deseo, ritmo o comodidad desencontrados que pesan en el día a día.",
    improve: "La conexión íntima es irregular; este punto necesita conversación sin presión.",
    focused: "La intimidad va bien en conjunto; este matiz específico es lo que falta."
  },
  convivencia_social: {
    critical: "El entorno social/familiar genera conflicto frecuente con la pareja.",
    alert: "Hay roce con familia, amigos o eventos que afecta la armonía.",
    improve: "La convivencia social es mayormente bien; aquí hay un desajuste puntual.",
    focused: "Encajan socialmente en general; este contexto concreto incomoda."
  },
  cuidado_personal: {
    critical: "Hábitos de salud o autocuidado preocupan y afectan la relación.",
    alert: "Sustancias, sueño o estilo de vida generan incomodidad sostenida.",
    improve: "El estilo de vida es aceptable salvo en este hábito visible.",
    focused: "Cuida bien su bienestar en lo general; este detalle le resta."
  },
  organizacion: {
    critical: "La carga del hogar o el desorden generan resentimiento acumulado.",
    alert: "Las responsabilidades no se reparten de forma que se sienta justa.",
    improve: "La organización es mejorable; este quehacer concreto desequilibra.",
    focused: "Son ordenados en lo esencial; aquí hay un pendiente específico."
  }
};

/**
 * Acciones concretas por pregunta y nivel.
 * issue: qué no percibe | actions: qué hacer según puntuación de la categoría
 */
const QUESTION_GUIDANCE = {
  "eco:1": {
    issue: "responsabilidad en el manejo del dinero",
    actions: {
      critical: "Agenden una reunión financiera semanal de 20 min con reglas: sin culpas, solo números. Definan un tope de gasto discrecional individual y revísenlo cada viernes.",
      alert: "Pidan transparencia básica: extracto o app compartida solo para gastos comunes. Acuerden quién paga qué y un día fijo para revisar pendientes.",
      improve: "Identifiquen un solo hábito de gasto que preocupa y pacten un experimento de 2 semanas para corregirlo.",
      focused: "Conversen solo sobre este hábito puntual: qué comportamiento esperan y qué señal concreta demostraría responsabilidad."
    }
  },
  "eco:2": {
    issue: "cumplimiento de acuerdos financieros establecidos",
    actions: {
      critical: "Reescriban el acuerdo en 3 reglas simples por escrito. Si se rompe una, se reprograma en 48 h sin drama ni castigo.",
      alert: "Definan consecuencias suaves y realistas cuando no se cumpla (por ejemplo, revisión conjunta, sin multas emocionales).",
      improve: "Pregunten qué parte del acuerdo se siente injusta y ajústenlo una vez con datos claros.",
      focused: "Aclaren si fue un olvido puntual o un patrón; si fue puntual, un recordatorio compartido suele bastar."
    }
  },
  "eco:3": {
    issue: "transparencia sobre ingresos, gastos, inversiones o deudas",
    actions: {
      critical: "Compartan un panorama financiero completo en una sola sesión con fecha límite. Sin presión de resolver todo: primero verdad, luego plan.",
      alert: "Establezcan qué información es obligatoria compartir (deudas, ahorros, gastos grandes) y cada cuánto actualizarla.",
      improve: "Abran un tema que aún ocultan (un gasto, una deuda menor) y validen la reacción del otro sin atacar.",
      focused: "Si fue un solo dato no compartido, expliquen por qué costó decirlo y acuerden cómo pedirlo la próxima vez."
    }
  },
  "eco:4": {
    issue: "equidad en cómo se maneja el dinero para ambos",
    actions: {
      critical: "Hagan una tabla: aportes, gastos fijos y beneficios de cada uno. Busquen equidad percibida, no solo matemática.",
      alert: "Negocien un reparto provisional por un mes y midan si ambos se sienten más justamente tratados.",
      improve: "Identifiquen un gasto que uno siente desbalanceado y propongan un ajuste pequeño y visible.",
      focused: "Conversen sobre este gasto o decisión concreta y si representa un patrón o fue excepcional."
    }
  },
  "eco:5": {
    issue: "calma al hablar de dinero",
    actions: {
      critical: "Regla de pausa: si la tensión sube, cortan y retoman en 24 h con una agenda de 3 puntos máximo.",
      alert: "Practiquen hablar de dinero con temporizador de 15 min y tema único por sesión.",
      improve: "Antes de hablar de dinero, cada uno dice cómo se siente (1–10) y qué necesita para sentirse seguro(a).",
      focused: "Repasen la última charla sobre dinero: qué frase encendió la tensión y cómo reformularla."
    }
  },
  "respeto:1": {
    issue: "admiración genuina y sentirse fan de su pareja",
    actions: {
      critical: "Cada uno escribe 3 cualidades que aún valora del otro y las lee en voz alta sin debate. Retomen admiración antes de exigir cambios.",
      alert: "Ritual semanal: un elogio específico y público (solo entre ustedes) sobre algo que hizo bien.",
      improve: "Pregunten qué acción concreta les haría sentir más admirados(as) esta semana.",
      focused: "Si la admiración falla en un ámbito puntual, nómbralo sin generalizar al resto de la relación."
    }
  },
  "respeto:2": {
    issue: "discusión sin insultos, gritos ni descalificaciones",
    actions: {
      critical: "Acuerden palabra de pausa obligatoria y consecuencia: si hay grito o insulto, se suspende la charla 30 min.",
      alert: "Practiquen reformular: «Cuando X, me siento Y, necesito Z» sin atacar carácter.",
      improve: "Revisen la última discusión fuerte: qué límite se cruzó y cómo evitarlo la próxima vez.",
      focused: "Si fue un episodio aislado, pidan disculpas específicas y reparen antes de seguir el tema."
    }
  },
  "respeto:3": {
    issue: "respeto a opiniones, decisiones y límites personales",
    actions: {
      critical: "Listeen 3 límites no negociables de cada uno y comprométanse a no presionar en esos puntos este mes.",
      alert: "Antes de opinar sobre una decisión del otro, pregunten: «¿Buscas consejo o solo que te escuche?»",
      improve: "Identifiquen una decisión reciente donde no se sintió respetado(a) y negocien cómo apoyar sin controlar.",
      focused: "Aclaren un límite concreto que se sintió violado y cómo señalarlo antes de que escale."
    }
  },
  "respeto:4": {
    issue: "protección frente a burlas, humillación o manipulación",
    actions: {
      critical: "Si hay manipulación o humillación repetida, busquen mediación externa (terapia de pareja). Acuerden cero tolerancia a burlas en público.",
      alert: "Definan frases prohibidas en pelea y qué hacer si se dicen (pausa y reparación).",
      improve: "Conversen sobre una burla o comentario que dolió y pacten alternativas de humor sin herir.",
      focused: "Si fue un comentario puntual, reparen en el momento: reconocer el daño y no repetir."
    }
  },
  "respeto:5": {
    issue: "seguridad física y emocional en el trato diario",
    actions: {
      critical: "Evalúen si hay conductas que cruzan líneas de seguridad. Si las hay, plan de contención inmediato y apoyo profesional.",
      alert: "Acuerden señales de «Necesito espacio» y respétalas sin perseguir ni castigar.",
      improve: "Pregunten qué gesto o tono les hace sentir más cuidados(as) en el día a día.",
      focused: "Repasen un momento donde no se sintió seguro(a) y qué habría ayudado distinto."
    }
  },
  "tolerancia:1": {
    issue: "aceptación de sus creencias religiosas",
    actions: {
      critical: "Conversación estructurada: cada uno explica qué necesita respetar (rituales, días, símbolos) sin intentar convencer.",
      alert: "Acuerden espacios y momentos donde cada creencia se vive sin interferencia del otro.",
      improve: "Identifiquen un comentario o gesto que hirió y pidan alternativa de respeto explícita.",
      focused: "Si el roce es en un evento concreto, planifiquen cómo acompañarse sin presión."
    }
  },
  "tolerancia:2": {
    issue: "aceptación de gustos personales sin intentar cambiarlos",
    actions: {
      critical: "Regla: no criticar hobbies del otro durante 30 días. Tiempo protegido para actividades individuales.",
      alert: "Negocien horas «Sin juicio» para música, deportes o hobbies de cada uno.",
      improve: "Pregunten qué comentario sobre sus gustos se sintió como presión y eviten repetirlo.",
      focused: "Un gesto de curiosidad genuina sobre el hobby del otro puede reparar sin que tengan que compartirlo."
    }
  },
  "tolerancia:3": {
    issue: "aceptación de hábitos cotidianos y rutinas",
    actions: {
      critical: "Mapeen rutinas innegociables de cada uno y adapten convivencia sin exigir clonarse.",
      alert: "Elijan 2 hábitos molestos y negocien ajuste mínimo viable (no perfección).",
      improve: "Hablen del hábito concreto usando «Noto que…» en lugar de «Siempre haces…».",
      focused: "Si es un hábito menor, humor y flexibilidad suelen bastar si hay buena voluntad."
    }
  },
  "tolerancia:4": {
    issue: "tolerancia a modales al comer",
    actions: {
      critical: "Conversen con honestidad sin burla. Acuerden reglas básicas en mesa (tiempos, ruidos, temas) o espacios distintos si hace falta.",
      alert: "Elijan 1–2 conductas en la mesa a ajustar por 2 semanas y evalúen.",
      improve: "Pidan feedback suave antes de corregir en público o frente a otros.",
      focused: "Si es un detalle puntual, una petición directa y amable suele resolverlo."
    }
  },
  "tolerancia:5": {
    issue: "tolerancia a la forma de dormir",
    actions: {
      critical: "Exploren soluciones prácticas: horarios, cama aparte algunas noches, reglas de luz/ruido. El descanso afecta todo.",
      alert: "Prueben un experimento de 1 semana con ajustes de sueño medibles.",
      improve: "Negocien un compromiso concreto (temperatura, dispositivos, horario).",
      focused: "Un solo ajuste (almohada, hora, ruido) puede aliviar sin drama."
    }
  },
  "confianza:1": {
    issue: "libertad para llamar o escribir sin sentirse vigilado(a)",
    actions: {
      critical: "Acuerden cero revisión de llamadas. Si la ansiedad es alta, terapia individual para manejar celos antes de exigir control.",
      alert: "Definan qué comunicación opcional comparten (horarios, viajes) sin justificar cada contacto.",
      improve: "Si hubo episodio de control, reparen con disculpa específica y nueva regla escrita.",
      focused: "Aclaren si fue un comentario puntual de celos y cómo pedir tranquilidad sin vigilar."
    }
  },
  "confianza:2": {
    issue: "hablar con otras personas sin celos molestos después",
    actions: {
      critical: "Límite claro: amistades legítimas no se negocian. Sesión para separar inseguridad real de control.",
      alert: "Cada uno nombra 2 amistades importantes y pacta respeto explícito hacia ellas.",
      improve: "Después de socializar, un check-in breve de tranquilidad sin interrogatorio.",
      focused: "Si fue un episodio aislado, reparen y acuerden cómo comunicar salidas sociales."
    }
  },
  "confianza:3": {
    issue: "asistir a eventos o lugares sin reclamos posteriores",
    actions: {
      critical: "Lista de eventos y lugares permitidos sin veto. Lo que no está en la lista se conversa con anticipación; no se castiga después.",
      alert: "Antes de eventos, acuerden hora de regreso y check-in simple (un mensaje).",
      improve: "Repasen el último reclamo: qué temor había detrás y cómo tranquilizar sin prohibir.",
      focused: "Si fue un solo evento, hablen del miedo específico, no de prohibir salir."
    }
  },
  "confianza:4": {
    issue: "confianza de que no controla amistades ni actividades fuera de la relación",
    actions: {
      critical: "Terapia o mediación si hay control sistemático. Regla: actividades individuales son derecho, no privilegio.",
      alert: "Calendario compartido solo para compromisos de pareja, no para vigilar tiempo libre.",
      improve: "Pregunten qué actividad individual se sintió cuestionada y validen su derecho a tenerla.",
      focused: "Una conversación honesta sobre un plan fuera de pareja puede bastar si hay buena fe."
    }
  },
  "confianza:5": {
    issue: "confianza sin revisar teléfono o redes",
    actions: {
      critical: "Prohibición explícita de revisar dispositivos. Si la confianza está rota, reconstrucción con terapeuta, no con espionaje.",
      alert: "Si hay ansiedad, acuerden señales de tranquilidad que no invadan privacidad.",
      improve: "Si hubo revisión, pidan disculpa y asuman un compromiso verificable de no repetir.",
      focused: "Si fue sospecha puntual, hablen del temor sin convertirlo en vigilancia."
    }
  },
  "confianza:6": {
    issue: "transparencia en redes o revisión de cuentas",
    actions: {
      critical: "Diferencien confianza de vigilancia. Si se pide acceso, debe ser voluntario y recíproco, nunca por forcejeo.",
      alert: "Acuerden qué nivel de transparencia digital es cómodo para ambos sin presión.",
      improve: "Si fue por pedir revisión sin aviso, respeten privacidad y abran diálogo sobre inseguridades.",
      focused: "Si hubo un malentendido puntual, aclaren expectativas sobre privacidad digital."
    }
  },
  "comunicacion:1": {
    issue: "sentirse escuchado(a) con atención",
    actions: {
      critical: "Turnos de 5 min sin interrumpir y reformulación obligatoria antes de responder. Practiquen 3 veces por semana.",
      alert: "Regla: apagar pantallas cuando uno pide «Necesito que me escuches».",
      improve: "Pregunten «¿Quieres solución o solo escucha?» antes de aconsejar.",
      focused: "Si falló en un tema concreto, reprogramen esa charla con reglas de escucha."
    }
  },
  "comunicacion:2": {
    issue: "expresar emociones sin miedo a burlas o reacciones negativas",
    actions: {
      critical: "Cero burla ante vulnerabilidad. Si se rompe, pausa y reparación antes de seguir.",
      alert: "Validen la emoción primero («Tiene sentido que sientas…») antes de debatir hechos.",
      improve: "Compartan una emoción pequeña esta semana y observen la reacción del otro.",
      focused: "Si hubo una respuesta hiriente puntual, reparen y pidan cómo quieren ser recibidos."
    }
  },
  "comunicacion:3": {
    issue: "hablar desacuerdos sin que escalen a discusión fuerte",
    actions: {
      critical: "Agenda de conflictos: máximo 1 tema, 20 min, palabra de pausa obligatoria.",
      alert: "Practiquen bajar volumen: si sube, cortan 15 min.",
      improve: "Identifiquen el tema que siempre escala y preparen reglas antes de abrirlo.",
      focused: "Si fue un episodio aislado, analicen qué detonó y cómo frenar antes."
    }
  },
  "comunicacion:4": {
    issue: "llegar a acuerdos comunes al comunicarse",
    actions: {
      critical: "Cuando no hay acuerdo, pacten «Lo mínimo aceptable» temporal por 2 semanas y revísenlo.",
      alert: "Cierren conversaciones con resumen escrito: «Acordamos X; pendiente Y».",
      improve: "Si suelen quedar en limbo, definan quién propone siguiente paso concreto.",
      focused: "En el tema puntual sin acuerdo, busquen una microacción que ambos puedan aceptar."
    }
  },
  "comunicacion:5": {
    issue: "comunicar problemas a la pareja antes que a otros",
    actions: {
      critical: "Regla: problema de pareja se habla primero entre ustedes (salvo violencia o abuso). Terapia si hay evitación crónica.",
      alert: "Ventana de 48 h: si algo molesta, se menciona a la pareja antes de contarlo afuera.",
      improve: "Pregunten qué los frena de abrir un tema y qué necesitan para sentirse seguros.",
      focused: "Si contaron afuera primero una vez, expliquen por qué y cómo prefieren hacerlo después."
    }
  },
  "comunicacion:6": {
    issue: "compartir alegrías y éxitos primero con la pareja",
    actions: {
      critical: "Ritual: noticias buenas se comparten en las primeras 24 h. Si fallan, reparen sin culpa.",
      alert: "Mensaje o llamada breve al lograr algo: «Quería que lo supieras primero».",
      improve: "Pregunten si se sintieron excluidos de una buena noticia y cómo incluirlos mejor.",
      focused: "Si fue un olvido puntual, un gesto de celebración tardía igual cuenta."
    }
  },
  "comunicacion:7": {
    issue: "compartir tristezas primero con la pareja",
    actions: {
      critical: "Acuerden que vulnerabilidad triste va primero a la pareja cuando sea posible. Espacio seguro sin arreglar de inmediato.",
      alert: "Frase de apertura: «Necesito contarte algo difícil. ¿Tienes espacio?»",
      improve: "Si guardaron tristeza, expliquen qué los detuvo sin culpar.",
      focused: "Si fue una ocasión puntual, reconecten con un momento de escucha sin distracciones."
    }
  },
  "diversion:1": {
    issue: "suficiencia de actividades recreativas mensuales",
    actions: {
      critical: "Planifiquen 2 salidas obligatorias al mes en calendario compartido. Alternan quién propone.",
      alert: "Suban de 1 a 2 planes recreativos este mes y evalúen satisfacción al final.",
      improve: "Pregunten qué tipo de plan extra necesitan (casa, calle, con amigos, solo pareja).",
      focused: "Si falta un plan puntual, resérvenlo este fin de semana sin excusas."
    }
  },
  "diversion:2": {
    issue: "satisfacción con las actividades que propone la pareja",
    actions: {
      critical: "Lista de 10 ideas que a cada uno le gustan; crucen y elijan 3 para el mes.",
      alert: "Alternen propuestas: uno elige, el otro solo acompaña con buena actitud 1 vez al mes.",
      improve: "Feedback amable tras un plan: qué gustó y qué ajustar, sin cancelar futuros.",
      focused: "Si no gustó un plan concreto, digan qué variante sí funcionaría."
    }
  },
  "diversion:3": {
    issue: "disfrutar en pareja sin depender siempre de terceros",
    actions: {
      critical: "Una cita solo ustedes cada 10 días mínimo, aunque sea caminata y café.",
      alert: "Bloqueen 2 horas «Solo nosotros» en agenda semanal.",
      improve: "Prueben una actividad en casa que no requiera invitados.",
      focused: "Si extrañan tiempo a solas, reprogramen una tarde simple esta semana."
    }
  },
  "diversion:4": {
    issue: "suficiente tiempo de calidad juntos",
    actions: {
      critical: "Auditen el tiempo real juntos frente a pantallas. Meta: 5 h semanales de calidad medible.",
      alert: "Ritual diario de 20 min sin móvil (cena, paseo, charla).",
      improve: "Identifiquen qué les roba tiempo y muevan una cita de pareja a prioridad fija.",
      focused: "Un bloque extra de 1 h esta semana puede reparar sensación de abandono."
    }
  },
  "intimidad:1": {
    issue: "satisfacción sexual",
    actions: {
      critical: "Conversación con terapeuta sexual o de pareja. Hablen deseos y límites sin presión de acto inmediato.",
      alert: "Check-in íntimo quincenal: qué funcionó, qué no, sin culpas.",
      improve: "Una charla honesta sobre ritmo y preferencias con turnos y sin interrupciones.",
      focused: "Si es un aspecto puntual, pregunten qué cambio pequeño mejoraría la experiencia."
    }
  },
  "intimidad:2": {
    issue: "frecuencia de la intimidad",
    actions: {
      critical: "Negocien rango de frecuencia aceptable para ambos por un mes, revisable sin castigo.",
      alert: "Calendario flexible de conexión íntima con espacio para «No hoy» sin resentimiento.",
      improve: "Hablen de expectativas reales frente a ideales, sin compararse con estándares externos.",
      focused: "Si la frecuencia falló solo un periodo, revisen estrés o salud antes de culpar."
    }
  },
  "intimidad:3": {
    issue: "sentirse deseado(a)",
    actions: {
      critical: "Plan de reconexión: gestos diarios de deseo no sexuales y tiempo íntimo sin presión de rendimiento.",
      alert: "Ritual de 60 s de contacto físico afectuoso diario.",
      improve: "Pregunten qué gesto concreto les hace sentir deseados (palabras, abrazo, detalle).",
      focused: "Un cumplido o gesto explícito hoy puede reparar sensación puntual."
    }
  },
  "intimidad:4": {
    issue: "interés en complacer y adaptarse a necesidades íntimas",
    actions: {
      critical: "Conversación guiada sobre gustos con lista «Me gusta / me incomoda / quiero probar».",
      alert: "Turnos de iniciativa: cada uno propone una noche centrada en el placer del otro.",
      improve: "Feedback suave tras intimidad: una cosa que funcionó, una a ajustar.",
      focused: "Si falló en un aspecto concreto, nómbralo con respeto y propongan alternativa."
    }
  },
  "intimidad:5": {
    issue: "comodidad para hablar de temas íntimos",
    actions: {
      critical: "Terapia si hay vergüenza o bloqueo total. Empiecen por escribir preguntas en papel antes de hablar.",
      alert: "Charla íntima con temporizador y regla de no burla.",
      improve: "Abran un tema pequeño (ritmo, ambiente, inicio) sin exigir cambio inmediato.",
      focused: "Si costó hablar de un tema puntual, agradezcan la honestidad y validen."
    }
  },
  "convivencia_social:1": {
    issue: "relación de la pareja con sus familiares",
    actions: {
      critical: "Límites claros con familia: visitas, duración, temas prohibidos. Un frente común ante familiares.",
      alert: "Antes de eventos familiares, alineen expectativas y señales de «Necesito salir».",
      improve: "Conversen qué conducta con familia molestó y cómo apoyarse mutuamente.",
      focused: "Si fue un evento puntual, debrief amable al día siguiente."
    }
  },
  "convivencia_social:2": {
    issue: "relación de la pareja con sus amistades",
    actions: {
      critical: "Respeto a amistades clave de cada uno sin veto. Si hay conflicto, mediación entre pareja primero.",
      alert: "Alternen planes con amigos del otro con actitud de apoyo mínimo acordado.",
      improve: "Pregunten qué interacción social reciente incomodó y por qué.",
      focused: "Una salida con amigos puede reparar si hay buena actitud y límites claros."
    }
  },
  "convivencia_social:3": {
    issue: "respeto al tiempo con familia y amistades",
    actions: {
      critical: "Calendario: tiempo social individual protegido sin reclamos. Pareja no monopoliza agenda.",
      alert: "Antes de planear en pareja, consulten compromisos sociales previos del otro.",
      improve: "Si se sintió presionado a cancelar planes, reparen y protejan próxima salida.",
      focused: "Si fue un solo conflicto de agenda, acuerden cómo avisar con anticipación."
    }
  },
  "convivencia_social:4": {
    issue: "acompañamiento en eventos sociales importantes",
    actions: {
      critical: "Lista de eventos no negociables para acompañar. Si no puede uno, plan B sin culpa ni castigo.",
      alert: "Confirmen con 1 semana de anticipación asistencia a eventos importantes.",
      improve: "Si faltó apoyo en un evento, hablen de qué significó y cómo estar presente después.",
      focused: "Si no pudo asistir una vez, compensen con presencia simbólica (mensaje, llamada, detalle)."
    }
  },
  "convivencia_social:5": {
    issue: "reparto equilibrado de responsabilidades o quehaceres del hogar",
    actions: {
      critical: "Reparto visible de tareas del hogar con responsable y día. Revisión semanal sin culpas.",
      alert: "Cada uno elige 2 tareas fijas y las cumple una semana antes de renegociar.",
      improve: "Hablen de qué tarea del hogar genera más desgaste y cómo repartirla mejor.",
      focused: "Si fue un pendiente puntual, acuerden recordatorio amable y apoyo mutuo."
    }
  },
  "cuidado_personal:1": {
    issue: "manejo de alcohol, tabaco u otras sustancias",
    actions: {
      critical: "Conversación seria sobre límites y salud. Si hay dependencia, apoyo profesional. Acuerdos de consumo visibles.",
      alert: "Definan reglas de consumo en casa, eventos y conducción. Revisión mensual.",
      improve: "Hablen de un episodio concreto que preocupó y qué cambio piden.",
      focused: "Si fue un exceso puntual, acuerden cómo cuidarse mutuamente la próxima vez."
    }
  },
  "cuidado_personal:2": {
    issue: "estilo de vida (alimentación, sueño, ejercicio) y su impacto en la relación",
    actions: {
      critical: "Plan de salud conjunto pequeño: sueño, comida o movimiento — una meta compartida 30 días.",
      alert: "Identifiquen un hábito que drena energía a la pareja y ajusten con apoyo, no sermón.",
      improve: "Pregunten cómo pueden apoyarse en un hábito sin controlar.",
      focused: "Un cambio menor (dormir más, caminar juntos) puede aliviar el roce puntual."
    }
  },
  "cuidado_personal:3": {
    issue: "higiene y apariencia personal adecuada",
    actions: {
      critical: "Conversación directa y respetuosa sobre higiene. Acuerden mínimos que ambos necesitan para sentirse cómodos.",
      alert: "Feedback con cariño: «Me ayudaría si…» sin humillar.",
      improve: "Si algo molestó, díganlo en privado con ejemplo concreto.",
      focused: "Una petición amable sobre un detalle suele bastar si hay buena voluntad."
    }
  },
  "organizacion:1": {
    issue: "organización en la vida diaria",
    actions: {
      critical: "Mini sprint de orden 25 min semanal juntos. Sistemas simples (cestos, listas) antes de culpar.",
      alert: "Cada uno organiza un espacio que afecta al otro y muestran resultado.",
      improve: "Identifiquen un caos puntual (mesa, ropa, facturas) y asignen responsable.",
      focused: "Un recordatorio amable sobre un pendiente concreto puede alcanzar."
    }
  }
};

const GENERIC_ACTIONS = {
  critical: "Traten esta señal como urgente: conversación dedicada esta semana, acuerdo escrito y revisión en 14 días.",
  alert: "Agenden 30 minutos para este tema sin interrupciones. Cada uno dice qué necesita y un paso concreto para la próxima semana.",
  improve: "Conviertan este punto en una microacción medible (quién, qué, cuándo) y revísenla el domingo.",
  focused: "Aunque la categoría va bien, atiendan este punto: una charla honesta y un ajuste pequeño evitan que crezca."
};

function buildQuestionOrderMap(questions) {
  const order = new Map();
  const count = {};
  for (const q of questions) {
    const ck = q.category_key;
    count[ck] = (count[ck] || 0) + 1;
    order.set(q.id, count[ck]);
    if (q.question_order != null) order.set(q.id, Number(q.question_order));
  }
  return order;
}

function gapNote(gapPct, includeGapNote = false) {
  if (!includeGapNote || gapPct == null || gapPct < 25) return "";
  return " Además, ustedes perciben esta categoría de forma muy distinta: definan qué señal concreta significaría «mejor» para cada uno esta semana.";
}

/**
 * @param {{
 *   categoryKey: string,
 *   questionOrder: number,
 *   categoryScorePct?: number,
 *   combinedScorePct?: number,
 *   gapPct?: number | null
 * }} ctx
 */
function getNoAnswerRecommendation(ctx) {
  const tier = scoreToTier(ctx.categoryScorePct);
  const key = `${ctx.categoryKey}:${ctx.questionOrder}`;
  const guidance = QUESTION_GUIDANCE[key];
  const whyFrame = CATEGORY_WHY[ctx.categoryKey]?.[tier] || CATEGORY_WHY.eco.improve;

  const whyNo = guidance
    ? `No percibe suficiente ${guidance.issue}. ${whyFrame}`
    : whyFrame;

  const baseAction = guidance?.actions?.[tier] || GENERIC_ACTIONS[tier];
  const recommendation = `${baseAction}${gapNote(ctx.gapPct, ctx.includeGapNote === true)}`;

  return {
    tier,
    tierLabel: TIER_LABELS[tier],
    whyNo,
    recommendation,
    improvementHint: `${whyNo} ${recommendation}`
  };
}

module.exports = {
  getNoAnswerRecommendation,
  buildQuestionOrderMap,
  scoreToTier,
  TIERS
};
