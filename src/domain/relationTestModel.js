const relationTests = {
  amigos: {
    title: "Test de amigos",
    subtitle: "Mismas preguntas base, resultado guardado en sección Amigos."
  },
  conocidos: {
    title: "Test de conocidos",
    subtitle: "Mismas preguntas base, resultado guardado en sección Conocidos."
  },
  familia: {
    title: "Test de familia",
    subtitle: "Mismas preguntas base, resultado guardado en sección Familia."
  }
};

function getRelationTest(type) {
  return relationTests[type] ?? null;
}

module.exports = { relationTests, getRelationTest };
