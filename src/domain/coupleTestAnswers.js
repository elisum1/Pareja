/**
 * Normaliza respuestas del test de pareja (solo valores 0/1 por pregunta).
 * Evita fallos silenciosos cuando el cliente envía "0"/"1" como string o booleanos.
 */

function parseAnswersField(raw) {
  let v = raw;
  for (let i = 0; i < 4; i += 1) {
    if (v == null) return {};
    if (typeof v === "string") {
      const s = v.trim();
      if (!s) return {};
      try {
        v = JSON.parse(s);
      } catch {
        return {};
      }
      continue;
    }
    if (typeof v === "object" && !Array.isArray(v)) return v;
    return {};
  }
  return {};
}

/** Devuelve 0, 1 o undefined si no hay respuesta válida. */
function coerceBinary01(v) {
  if (v === 1 || v === true) return 1;
  if (v === 0 || v === false) return 0;
  if (v === "1" || v === "true") return 1;
  if (v === "0" || v === "false") return 0;
  const n = Number(v);
  if (n === 1) return 1;
  if (n === 0 && v !== "" && !Number.isNaN(n)) return 0;
  return undefined;
}

function getBinaryAnswer(answersRaw, questionId) {
  const obj = parseAnswersField(answersRaw);
  const s = String(questionId);
  const n = Number(questionId);
  if (Object.prototype.hasOwnProperty.call(obj, s)) return coerceBinary01(obj[s]);
  if (!Number.isNaN(n) && Object.prototype.hasOwnProperty.call(obj, n)) return coerceBinary01(obj[n]);
  return undefined;
}

/**
 * Construye el mapa definitivo `questionId -> 0|1` para persistir.
 * @param {Record<string, unknown>} bodyAnswers
 * @param {Array<string|number>} questionIds ids válidos del test
 */
function normalizeAnswersForPersist(bodyAnswers, questionIds) {
  const out = {};
  const missing = [];
  const invalidKeys = [];
  const src = bodyAnswers && typeof bodyAnswers === "object" && !Array.isArray(bodyAnswers) ? bodyAnswers : {};
  const allowed = new Set(questionIds.map((id) => String(id)));

  for (const qid of questionIds) {
    const keyStr = String(qid);
    let raw = undefined;
    if (Object.prototype.hasOwnProperty.call(src, keyStr)) raw = src[keyStr];
    else {
      const n = Number(qid);
      if (!Number.isNaN(n) && Object.prototype.hasOwnProperty.call(src, n)) raw = src[n];
    }
    const v = coerceBinary01(raw);
    if (v === undefined) missing.push(keyStr);
    else out[keyStr] = v;
  }

  for (const k of Object.keys(src)) {
    if (!allowed.has(k)) invalidKeys.push(k);
  }

  return { answers: out, missing, invalidKeys };
}

module.exports = {
  parseAnswersField,
  coerceBinary01,
  getBinaryAnswer,
  normalizeAnswersForPersist
};
