const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const buildDir = path.join(root, "build");

fs.mkdirSync(buildDir, { recursive: true });
fs.writeFileSync(
  path.join(buildDir, "README.txt"),
  "Carpeta generada por npm run build (marcador para plataformas que exigen un directorio de publicación).\n"
);
