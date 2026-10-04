/**
 * Copie les fichiers de pdf.js (paquet npm `pdfjs-dist`) dans `public/pdfjs/`.
 *
 * Pourquoi : le bundler de Next.js 14 ne sait pas traiter `import.meta` dans
 * les fichiers de pdf.js (« 'import.meta' cannot be used outside of module
 * code »). On sert donc la librairie telle quelle depuis `public/`, et
 * `lib/generateFichePdf.ts` la charge à la demande avec un `import()` natif
 * du navigateur, hors webpack.
 *
 * Lancé automatiquement par `npm install` (script `postinstall`). Le dossier
 * `public/pdfjs/` est ignoré par Git : il se régénère à chaque installation,
 * ce qui le garde aligné sur la version installée de `pdfjs-dist`.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(racine, "node_modules", "pdfjs-dist");
const destination = join(racine, "public", "pdfjs");

if (!existsSync(source)) {
  console.warn("[copier-pdfjs] pdfjs-dist introuvable dans node_modules, copie ignorée.");
  process.exit(0);
}

rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });

// Librairie et worker : la version « legacy » embarque les polyfills (par
// exemple Map.prototype.getOrInsertComputed) qui manquent aux navigateurs
// d'il y a un ou deux ans, encore courants dans les structures.
cpSync(join(source, "legacy", "build", "pdf.min.mjs"), join(destination, "pdf.min.mjs"));
cpSync(join(source, "legacy", "build", "pdf.worker.min.mjs"), join(destination, "pdf.worker.min.mjs"));

// Décodeurs d'images (JPEG 2000, JBIG2), profils ICC et polices standard,
// nécessaires pour rendre fidèlement certains PDF. Les CMaps (écritures
// asiatiques, 1,7 Mo) ne sont pas copiées.
for (const dossier of ["wasm", "iccs", "standard_fonts"]) {
  cpSync(join(source, dossier), join(destination, dossier), { recursive: true });
}

const { version } = JSON.parse(readFileSync(join(source, "package.json"), "utf8"));
writeFileSync(join(destination, "VERSION"), `${version}\n`);
console.log(`[copier-pdfjs] pdf.js ${version} copié dans public/pdfjs/`);
