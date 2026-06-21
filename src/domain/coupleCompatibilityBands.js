/**
 * Clasificación de compatibilidad en pareja (resultado comparativo entre dos usuarios vinculados).
 */
function getCoupleCompatibilityBand(pct) {
  if (pct == null || Number.isNaN(Number(pct))) {
    return { key: "unknown", label: "Compatibilidad", description: "" };
  }

  const n = Math.round(Number(pct));

  if (n >= 90) {
    return {
      key: "excellent",
      label: "Excelente compatibilidad",
      description: "Muy alta coincidencia entre ustedes en lo que midió el test."
    };
  }
  if (n >= 80) {
    return {
      key: "good",
      label: "Buena compatibilidad",
      description: "Van bien en conjunto; conviene cuidar los detalles que aún marquen diferencia."
    };
  }
  if (n >= 70) {
    return {
      key: "improve",
      label: "Puede mejorar",
      description: "Hay margen claro para conversar y alinear expectativas en varias áreas."
    };
  }
  if (n >= 60) {
    return {
      key: "alert",
      label: "Está en alerta",
      description: "Conviene atender pronto las categorías con mayor brecha entre ustedes."
    };
  }
  if (n >= 50) {
    return {
      key: "work",
      label: "Hay que trabajar mucho",
      description: "Hay mucha desigualdad en cómo perciben la relación; prioricen diálogo y acuerdos concretos."
    };
  }

  return {
    key: "bad",
    label: "Mala relación",
    description:
      "La percepción comparativa es baja; vale la pena evaluar con honestidad si quieren reconstruir la base."
  };
}

function formatCoupleCompatibilitySummary(pct) {
  const band = getCoupleCompatibilityBand(pct);
  if (band.key === "unknown") return "Compatibilidad pendiente de calcular.";
  return `Su compatibilidad general es del ${Math.round(Number(pct))}%: ${band.label}. ${band.description}`;
}

module.exports = { getCoupleCompatibilityBand, formatCoupleCompatibilitySummary };
