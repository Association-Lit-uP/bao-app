/**
 * Génération du PDF d'une fiche.
 *
 * Le PDF est produit par le navigateur lui-même (window.print() dans une iframe
 * cachée, puis « Enregistrer au format PDF »), sans librairie de rendu.
 *
 * Ce que ce module garantit :
 *  - le nom de fichier proposé par le navigateur reprend le nom de l'outil
 *    (les navigateurs se basent sur le titre du document imprimé, et Chrome sur
 *    celui de la page parente : on positionne donc les deux le temps du dialogue)
 *  - les illustrations de la fiche et les images d'étapes du déroulé sont
 *    intégrées
 *  - les liens restent cliquables dans le PDF et leur URL est affichée en clair
 *    (utile une fois la fiche imprimée)
 *  - les ressources complémentaires (PDF du bucket `fiches-pdf`) sont ajoutées
 *    à la suite de la fiche, page par page, grâce à pdf.js. Si un document ne
 *    peut pas être lu (réseau, fichier illisible, trop de pages), il reste
 *    listé avec son URL dans la section « Ressources complémentaires ».
 */

type RessourceEntree = { nom?: string; url?: string };

interface Annexe {
  nom: string;
  url: string;
  /** URLs blob des pages rendues en image (vide si le PDF n'a pas pu être lu) */
  pages: string[];
  /** true si toutes les pages n'ont pas pu être intégrées */
  tronquee: boolean;
}

/** Nombre total de pages d'annexes au-delà duquel on arrête d'intégrer (poids du PDF) */
const MAX_PAGES_ANNEXES = 60;
/** Largeur de rendu d'une page d'annexe, en pixels (environ 195 dpi sur 182 mm utiles) */
const LARGEUR_RENDU_PX = 1400;
const DELAI_TELECHARGEMENT_MS = 20000;
const DELAI_IMAGES_MS = 15000;

let generationEnCours = false;

function escapeHtml(valeur: unknown): string {
  return String(valeur ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Décode les entités qu'un éditeur de texte riche écrit dans un attribut href */
function decodeEntites(valeur: string): string {
  return valeur
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function urlComparable(url: string): string {
  return url.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "").toLowerCase();
}

/** Nom de fichier proposé par le navigateur : le nom de l'outil, sans caractères interdits */
function titrePourFichier(nom: string): string {
  return nom.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim() || "Fiche";
}

function parseListe(valeur: unknown): any[] {
  if (Array.isArray(valeur)) return valeur;
  if (typeof valeur === "string" && valeur.trim()) {
    try {
      const parsed = JSON.parse(valeur);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Nettoie le HTML de l'éditeur pour l'impression. Les liens sont conservés
 * (cliquables dans le PDF) et suivis de leur URL entre parenthèses, sauf quand
 * le texte du lien est déjà l'URL.
 */
function strip(html: string): string {
  if (!html) return "";
  const liens: string[] = [];
  const avecJetons = html.replace(
    /<a\s+[^>]*?href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_m, href: string, contenu: string) => {
      const url = decodeEntites(href).trim();
      const texte = contenu.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
      if (!url || /^(javascript|data):/i.test(url)) return texte;
      const texteEstUrl = !texte || urlComparable(decodeEntites(texte)) === urlComparable(url);
      const hrefAttr = escapeHtml(url);
      const markup = texteEstUrl
        ? `<a class="lien" href="${hrefAttr}">${escapeHtml(url)}</a>`
        : `<a class="lien" href="${hrefAttr}">${texte}</a> <span class="lien-url">(${escapeHtml(url)})</span>`;
      liens.push(markup);
      return `\u0000${liens.length - 1}\u0000`;
    }
  );
  const nettoye = avecJetons
    .replace(/<br\s*\/?>/gi, "<br>")
    .replace(/<\/p>/gi, "<br>")
    .replace(/<(?!br|strong|em|\/strong|\/em|\/li|li|ul|\/ul|ol|\/ol)[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/—/g, " :")
    .trim();
  return nettoye.replace(/\u0000(\d+)\u0000/g, (_m, i) => liens[Number(i)] || "");
}

/* ------------------------------------------------------------------ */
/* Ressources complémentaires : lecture des PDF et rendu en images     */
/* ------------------------------------------------------------------ */

async function telechargerPdf(url: string): Promise<Uint8Array | null> {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), DELAI_TELECHARGEMENT_MS);
  try {
    const reponse = await fetch(url, { signal: controleur.signal, mode: "cors" });
    if (!reponse.ok) return null;
    const octets = new Uint8Array(await reponse.arrayBuffer());
    // Signature d'un fichier PDF : « %PDF- »
    const entete = String.fromCharCode(...Array.from(octets.slice(0, 5)));
    return entete === "%PDF-" ? octets : null;
  } catch {
    return null;
  } finally {
    clearTimeout(minuteur);
  }
}

/**
 * pdf.js est servi depuis `public/pdfjs/` (copie faite par
 * `scripts/copier-pdfjs.mjs` à l'installation) et chargé par un `import()`
 * natif du navigateur : le bundler de Next.js ne sait pas traiter
 * `import.meta` dans les fichiers de pdf.js. Le `webpackIgnore` ci-dessous
 * est indispensable, sinon webpack tente de l'empaqueter et le build échoue.
 */
const PDFJS_BASE = "/pdfjs/";
type PdfJs = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfJs> | null = null;

function chargerPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    const url = `${PDFJS_BASE}pdf.min.mjs`;
    pdfjsPromise = import(/* webpackIgnore: true */ url).then((module: PdfJs) => {
      module.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}pdf.worker.min.mjs`;
      return module;
    });
    pdfjsPromise.catch(() => { pdfjsPromise = null; });
  }
  return pdfjsPromise;
}

async function rendrePagesPdf(octets: Uint8Array, budgetPages: number): Promise<{ pages: string[]; total: number }> {
  const pdfjs = await chargerPdfJs();
  const tache = pdfjs.getDocument({
    data: octets,
    wasmUrl: `${PDFJS_BASE}wasm/`,
    iccUrl: `${PDFJS_BASE}iccs/`,
    standardFontDataUrl: `${PDFJS_BASE}standard_fonts/`,
  });
  const document_ = await tache.promise;
  const total = document_.numPages;
  const pages: string[] = [];
  const canvas = document.createElement("canvas");
  try {
    const nombre = Math.min(total, budgetPages);
    for (let i = 1; i <= nombre; i++) {
      const page = await document_.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: LARGEUR_RENDU_PX / base.width });
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport, background: "#ffffff" }).promise;
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      page.cleanup();
      if (!blob) break;
      pages.push(URL.createObjectURL(blob));
    }
  } finally {
    canvas.width = 0;
    canvas.height = 0;
    await tache.destroy();
  }
  return { pages, total };
}

async function preparerAnnexes(ressources: RessourceEntree[]): Promise<Annexe[]> {
  const annexes: Annexe[] = [];
  let budget = MAX_PAGES_ANNEXES;
  for (let i = 0; i < ressources.length; i++) {
    const ressource = ressources[i];
    const url = typeof ressource?.url === "string" ? ressource.url.trim() : "";
    if (!url) continue;
    const nom = (ressource.nom || "").trim() || `Document ${i + 1}`;
    const annexe: Annexe = { nom, url, pages: [], tronquee: false };
    annexes.push(annexe);
    if (budget <= 0) {
      annexe.tronquee = true;
      continue;
    }
    try {
      const octets = await telechargerPdf(url);
      if (!octets) continue;
      const { pages, total } = await rendrePagesPdf(octets, budget);
      annexe.pages = pages;
      annexe.tronquee = pages.length < total;
      budget -= pages.length;
    } catch (erreur) {
      console.warn("Ressource complémentaire non intégrée au PDF :", url, erreur);
    }
  }
  return annexes;
}

async function attendreImages(doc: Document): Promise<void> {
  await Promise.all(
    Array.from(doc.images).map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve();
          const fin = () => resolve();
          img.addEventListener("load", fin, { once: true });
          img.addEventListener("error", fin, { once: true });
          setTimeout(fin, DELAI_IMAGES_MS);
        })
    )
  );
}

/* ------------------------------------------------------------------ */
/* Point d'entrée                                                      */
/* ------------------------------------------------------------------ */

export async function generateFichePdf(fiche: any, cles?: { nom: string; emoji?: string }[]) {
  if (generationEnCours) return;
  generationEnCours = true;
  try {
    await genererEtImprimer(fiche, cles);
  } finally {
    generationEnCours = false;
  }
}

async function genererEtImprimer(fiche: any, clesParam?: { nom: string; emoji?: string }[]) {
  console.log("PDF generation started", fiche.nom);

  const duree = fiche.duree_libre || (fiche.duree_min && fiche.duree_max && fiche.duree_min !== fiche.duree_max
    ? `${fiche.duree_min} – ${fiche.duree_max} min`
    : fiche.duree_min ? `${fiche.duree_min} min` : "");

  const deroule = parseListe(fiche.deroule);
  const conseils = parseListe(fiche.conseils);
  const variantes = parseListe(fiche.variantes);
  const materielListe = parseListe(fiche.materiel_liste);
  const objectifs = parseListe(fiche.objectifs);
  const cles = Array.isArray(clesParam) ? clesParam : parseListe(fiche.cles);
  const illustrations: string[] = parseListe(fiche.illustrations).filter((u) => typeof u === "string" && u.trim());
  const ressources: RessourceEntree[] = parseListe(fiche.pdfs_complementaires).filter((r) => r && typeof r === "object");

  // Les ressources complémentaires sont lues et rendues avant de construire le document
  const annexes = await preparerAnnexes(ressources);

  // === DATA PREP ===
  const infoItems: { label: string; value: string }[] = [];
  if (duree) infoItems.push({ label: "DURÉE", value: duree });
  if (fiche.format) infoItems.push({ label: "FORMAT", value: fiche.format });
  if (fiche.participants) infoItems.push({ label: "PARTICIPANTS", value: fiche.participants });
  const materiel = fiche.materiel_niveau || fiche.materiel;
  if (materiel) infoItems.push({ label: "MATÉRIEL", value: materiel });

  const infoGridHtml = infoItems.length ? infoItems.map((item) => `
    <td class="info-cell" valign="middle">
      <div class="info-label">${item.label}</div>
      <div class="info-value">${item.value}</div>
    </td>
  `).join("") : "";

  const metaParts: string[] = [];
  const pourQui = fiche.public_cible || fiche.pour_qui;
  if (pourQui) metaParts.push(`<span class="meta-label">POUR QUI ?</span> ${pourQui}`);
  if (fiche.source) metaParts.push(`<span class="meta-label">SOURCE</span> ${fiche.source}`);
  const metaRow = metaParts.join("&nbsp;&nbsp;&nbsp;");

  const illustrationsHtml = illustrations.length ? `
    <div class="illustrations">
      ${illustrations.map((url, i) => `<img class="illustration" src="${escapeHtml(url)}" alt="Illustration ${i + 1}">`).join("\n")}
    </div>` : "";

  const clesHtml = cles.length ? cles.map((c: any) => `<span class="cle-badge">${c.emoji || "🔑"} ${c.nom}</span>`).join("") : "";

  const objectifsHtml = objectifs.map((obj: any) => {
    const titre = typeof obj === "string" ? obj : (obj.titre || obj.title || obj.objectif || obj.text || "");
    const detail = typeof obj === "string" ? "" : (obj.détail || obj.detail || obj.description || "");
    return titre ? `
      <div class="objectif-item">
        <div class="objectif-title">→ <strong>${strip(titre)}</strong></div>
        ${detail ? `<div class="objectif-detail">${strip(detail)}</div>` : ""}
      </div>` : "";
  }).filter(Boolean).join("\n");

  const derouleHtml = deroule.map((s: any, i: number) => {
    const titre = s.titre || s.title || `Étape ${i + 1}`;
    const dureeS = s.duree || s.durée || "";
    const actions = Array.isArray(s.actions) ? s.actions : [];
    const actionsHtml = actions.map((a: any) => {
      const text = typeof a === "string" ? a : (a.text || "");
      return text ? `<li>${strip(text)}</li>` : "";
    }).filter(Boolean).join("\n");
    const imageHtml = typeof s.image_url === "string" && s.image_url.trim()
      ? `<img class="etape-image" src="${escapeHtml(s.image_url.trim())}" alt="Illustration de l'étape ${i + 1}">`
      : "";

    return `
      <div class="etape-card">
        <div class="etape-header">
          <div class="etape-num">${i + 1}</div>
          <div class="etape-title">${strip(titre)}</div>
          ${dureeS ? `<div class="etape-duree">${dureeS}</div>` : ""}
        </div>
        ${actionsHtml ? `<ul class="etape-actions">${actionsHtml}</ul>` : ""}
        ${imageHtml}
      </div>`;
  }).join("\n");

  const conseilsHtml = conseils.map((c: any) => {
    const text = typeof c === "string" ? c : (c.text || c.conseil || c.titre || "");
    return text ? `<li>→ ${strip(text)}</li>` : "";
  }).filter(Boolean).join("\n");

  const variantesHtml = variantes.map((v: any) => {
    const text = typeof v === "string" ? v : (v.text || v.variante || v.titre || "");
    return text ? `<li>· ${strip(text)}</li>` : "";
  }).filter(Boolean).join("\n");

  const materielHtml = materielListe.map((m: any) => {
    const text = typeof m === "string" ? m : (m.item || m.titre || "");
    return text ? `<li>${strip(text)}</li>` : "";
  }).filter(Boolean).join("\n");

  // Liste des ressources complémentaires (toujours présente, avec l'URL de chaque document)
  const ressourcesHtml = annexes.length ? annexes.map((a) => `
    <li class="ressource-item">
      <a class="lien" href="${escapeHtml(a.url)}"><strong>${escapeHtml(a.nom)}</strong></a>
      <span class="ressource-etat">${a.pages.length ? "(jointe à la suite de cette fiche)" : "(à télécharger en ligne)"}</span>
      <div class="lien-url">${escapeHtml(a.url)}</div>
    </li>`).join("\n") : "";

  // Pages des ressources complémentaires, ajoutées après la fiche
  const annexesHtml = annexes.filter((a) => a.pages.length).map((a) => `
    <section class="annexe">
      <div class="annexe-header">
        <span class="annexe-label">RESSOURCE COMPLÉMENTAIRE</span>
        <span class="annexe-nom">${escapeHtml(a.nom)}</span>
        <a class="annexe-url" href="${escapeHtml(a.url)}">${escapeHtml(a.url)}</a>
      </div>
      ${a.pages.map((src, i) => `<img class="annexe-page" src="${src}" alt="${escapeHtml(a.nom)}, page ${i + 1}">`).join("\n")}
      ${a.tronquee ? `<p class="annexe-note">Document tronqué dans ce PDF : la version complète est disponible à l'adresse ci-dessus.</p>` : ""}
    </section>`).join("\n");

  const ficheNom = fiche.nom || "Fiche";
  const titreFichier = titrePourFichier(ficheNom);

  // === FULL HTML DOCUMENT (for iframe print) ===
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(titreFichier)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,400;0,600;0,700;0,800;1,400;1,600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Source Sans 3', 'Source Sans Pro', system-ui, sans-serif;
      color: #2B3442;
      line-height: 1.55;
      font-size: 14px;
      max-width: 700px;
      margin: 0 auto;
      padding: 0 10px;
    }

    @media print {
      @page {
        size: A4;
        margin: 12mm 14mm 16mm 14mm;
      }
      body {
        max-width: 100%;
        padding: 0;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }

    /* ===== LIENS ===== */
    a.lien { color: #007479; text-decoration: underline; text-underline-offset: 2px; }
    .lien-url { font-size: 0.85em; color: #6b7280; word-break: break-all; }

    /* ===== HEADER ===== */
    .pdf-header {
      background: linear-gradient(135deg, #00989D 0%, #007479 100%);
      color: white;
      padding: 20px 28px;
      margin: 0 -10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      min-height: 60px;
    }
    .pdf-header-logo svg { height: 36px; width: auto; display: block; }
    .pdf-header-right {
      font-size: 12px; font-style: italic; opacity: 0.85; text-align: right;
    }

    /* ===== BADGE ÉTAPE ===== */
    .etape-badge-wrap { margin: 18px 0 8px; }
    .etape-badge {
      display: inline-block; background: #FCC33E; color: #2B3442;
      font-size: 12px; font-weight: 700; padding: 5px 16px; border-radius: 20px;
    }

    /* ===== TITRE ===== */
    .pdf-title {
      font-size: 28px; font-weight: 800; letter-spacing: -0.025em;
      line-height: 1.1; margin: 0 0 4px; color: #2B3442;
    }
    .pdf-source { font-size: 13px; font-style: italic; color: #6b7280; margin: 0 0 14px; }

    /* ===== GRILLE INFOS ===== */
    .info-table {
      width: 100%; border-collapse: collapse;
      border: 1.5px solid #e5e7eb; border-radius: 6px; margin-bottom: 8px;
    }
    .info-cell { padding: 10px 14px; border-right: 1.5px solid #e5e7eb; }
    .info-cell:last-child { border-right: none; }
    .info-label { font-size: 9px; font-weight: 700; color: #6b7280; letter-spacing: 0.06em; margin-bottom: 3px; }
    .info-value { font-size: 13px; font-weight: 700; color: #2B3442; }

    /* ===== META ===== */
    .meta-row { margin-bottom: 14px; font-size: 12px; }
    .meta-label { font-size: 9px; font-weight: 700; color: #6b7280; letter-spacing: 0.06em; margin-right: 6px; }

    /* ===== ILLUSTRATIONS ===== */
    .illustrations {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(45%, 1fr));
      gap: 8px; margin: 0 0 16px;
    }
    .illustration {
      display: block; width: 100%; max-height: 75mm; object-fit: contain;
      border: 1px solid #e5e7eb; border-radius: 8px; background: #fff;
      break-inside: avoid;
    }

    /* ===== ENCADRÉ INTENTION (bleu) ===== */
    .box-intention {
      background: #e0f3f4; border-left: 4px solid #00989D;
      padding: 14px 18px; border-radius: 0 8px 8px 0; margin: 14px 0;
      break-inside: avoid;
    }
    .box-intention-inner { display: flex; gap: 12px; align-items: flex-start; }
    .box-icon { font-size: 24px; flex-shrink: 0; margin-top: 2px; }
    .box-intention .box-label {
      font-size: 10px; font-weight: 700; letter-spacing: 0.08em; color: #007479; margin-bottom: 4px;
    }
    .box-intention .box-text { font-size: 13px; line-height: 1.6; color: #2B3442; }

    /* ===== ENCADRÉ POURQUOI (jaune) ===== */
    .box-pourquoi {
      background: #fff7df; border-left: 4px solid #e0a920;
      padding: 14px 18px; border-radius: 0 8px 8px 0; margin: 0 0 18px;
      break-inside: avoid;
    }
    .box-pourquoi-inner { display: flex; gap: 12px; align-items: flex-start; }
    .box-pourquoi .box-label {
      font-size: 10px; font-weight: 700; letter-spacing: 0.08em; color: #856100; margin-bottom: 4px;
    }
    .box-pourquoi .box-text { font-size: 13px; line-height: 1.6; color: #2B3442; }

    /* ===== SECTIONS ===== */
    .section-heading {
      margin: 22px 0 12px; font-size: 18px; font-weight: 800;
      color: #2B3442; letter-spacing: -0.01em;
      break-after: avoid;
    }
    .section-heading .section-icon { margin-right: 8px; }

    /* ===== MATÉRIEL ===== */
    .materiel-list {
      background: #F6F6F8; border-radius: 10px;
      padding: 4px 0; list-style: none; margin: 0;
    }
    .materiel-list li {
      padding: 8px 16px; border-bottom: 1px solid #e5e7eb;
      font-size: 13px; line-height: 1.5;
    }
    .materiel-list li:last-child { border-bottom: none; }
    .materiel-list li::before { content: "•"; color: #00989D; font-weight: 700; margin-right: 8px; }

    /* ===== OBJECTIFS ===== */
    .objectif-item { margin-bottom: 10px; break-inside: avoid; }
    .objectif-title { font-size: 13px; color: #00989D; }
    .objectif-title strong { color: #007479; }
    .objectif-detail { font-size: 12px; color: #2B3442; padding-left: 18px; line-height: 1.5; }

    /* ===== DÉROULÉ ===== */
    .etape-card {
      background: #F6F6F8; border-radius: 10px;
      padding: 14px 18px; margin-bottom: 12px;
      break-inside: avoid;
    }
    .etape-header {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: 10px; padding-bottom: 10px;
      border-bottom: 1px solid #e5e7eb;
    }
    .etape-num {
      display: inline-flex; align-items: center; justify-content: center;
      width: 26px; height: 26px; border-radius: 50%;
      background: #00989D; color: white;
      font-size: 13px; font-weight: 800; flex-shrink: 0;
    }
    .etape-title { font-size: 14px; font-weight: 700; color: #2B3442; flex-grow: 1; }
    .etape-duree {
      font-size: 11px; font-weight: 700; background: #FCC33E; color: #2B3442;
      padding: 4px 12px; border-radius: 12px; white-space: nowrap;
    }
    .etape-actions { margin: 0; padding: 0; list-style: none; }
    .etape-actions li {
      font-size: 12px; line-height: 1.55; padding: 3px 0 3px 16px;
      position: relative; color: #2B3442;
    }
    .etape-actions li::before {
      content: "•"; position: absolute; left: 4px; color: #00989D; font-weight: 700;
    }
    .etape-image {
      display: block; width: 100%; max-height: 100mm; object-fit: contain;
      margin-top: 10px; border-radius: 8px; border: 1px solid #e5e7eb; background: #fff;
      break-inside: avoid;
    }

    /* ===== CONSEILS ===== */
    .conseils-box { background: #F6F6F8; border-radius: 10px; padding: 14px 18px; }
    .conseils-list { margin: 0; padding: 0; list-style: none; }
    .conseils-list li { font-size: 12px; line-height: 1.55; padding: 4px 0; color: #2B3442; }

    /* ===== VARIANTES ===== */
    .variantes-box {
      background: #f5e9f3; border-left: 4px solid #6B2468;
      border-radius: 0 10px 10px 0; padding: 14px 18px;
      break-inside: avoid;
    }
    .variantes-list { margin: 0; padding: 0; list-style: none; }
    .variantes-list li { font-size: 12px; line-height: 1.55; padding: 4px 0; color: #2B3442; }

    /* ===== CLÉS ===== */
    .cles-wrap { margin: 10px 0; }
    .cle-badge {
      display: inline-block; background: #00989D; color: white;
      font-size: 10px; font-weight: 700;
      padding: 3px 10px; border-radius: 10px; margin: 0 4px 4px 0;
    }

    /* ===== RESSOURCES COMPLÉMENTAIRES (liste) ===== */
    .ressources-list {
      background: #F6F6F8; border-radius: 10px; padding: 4px 0; list-style: none; margin: 0;
    }
    .ressource-item {
      padding: 8px 16px; border-bottom: 1px solid #e5e7eb; font-size: 13px; line-height: 1.5;
    }
    .ressource-item:last-child { border-bottom: none; }
    .ressource-item a.lien strong { color: #007479; }
    .ressource-etat { font-size: 11px; color: #6b7280; margin-left: 6px; }

    /* ===== CLOSING + FOOTER ===== */
    .pdf-closing {
      margin-top: 28px; padding-top: 12px;
      border-top: 1px dashed #d1d5db;
      text-align: center; font-size: 11px; font-style: italic; color: #00989D;
    }
    .pdf-footer {
      margin-top: 12px; font-size: 9px; color: #9ca3af;
      border-top: 1px solid #e5e7eb; padding-top: 8px; text-align: center;
    }
    .pdf-footer .footer-center { color: #00989D; font-style: italic; }

    /* ===== ANNEXES (pages des ressources complémentaires) ===== */
    .annexe { break-before: page; }
    .annexe-header {
      display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px;
      font-size: 11px; color: #6b7280; margin-bottom: 6px;
      padding-bottom: 6px; border-bottom: 1px solid #e5e7eb;
    }
    .annexe-label { font-size: 9px; font-weight: 700; letter-spacing: 0.06em; color: #007479; }
    .annexe-nom { font-weight: 700; color: #2B3442; }
    .annexe-url { color: #6b7280; text-decoration: none; word-break: break-all; }
    .annexe-page {
      display: block; width: 100%; max-height: 250mm; object-fit: contain;
      margin: 0 auto; break-inside: avoid;
    }
    .annexe-page + .annexe-page { break-before: page; }
    .annexe-note { font-size: 11px; font-style: italic; color: #6b7280; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="pdf-header">
    <div class="pdf-header-logo"><svg viewBox="0 0 1080 396" xmlns="http://www.w3.org/2000/svg" style="height:36px;width:auto;display:block;"><g fill="#FFFFFF"><path d="M0,291.03V85.95h78.7v197.38c0,29.08,11.55,45.34,32.08,45.34c4.28,0,8.56-0.43,14.12-0.86v65.02c-11.98,2.14-18.82,2.99-28.66,2.99C16.68,395.83,0,336.37,0,291.03z"/><path d="M155.26,390.69V196.58h78.7v194.11H155.26z"/><path d="M432.43,326.96v62.87c-14.54,3.43-36.36,5.99-52.61,5.99c-84.26,0-100.09-63.73-100.09-110.36v-162.4l72.29-37.21h6.42v65.44l67.15-0.43v59.88h-67.15v76c0,29.52,15.83,44.06,41.06,44.06C409.33,330.81,421.73,329.53,432.43,326.96z"/><path d="M697.61,85.8h79.13v304.9h-79.13v-24.38c-15.83,17.54-40.63,29.52-66.73,29.52c-44.05,0-80.41-26.52-80.41-85.12V172.55h78.7V293.6c0,23.1,12.41,36.36,31.65,36.36c12.83,0,26.52-6.42,36.78-16.68V85.8z"/><path d="M1080,114.2c0,69.29-45.34,114.2-104.37,114.2c-23.1,0-44.91-8.12-60.74-20.96v183.32h-78.7V5.13h79.13v15.4C931.15,8.12,952.96,0,975.63,0C1034.66,0,1080,44.91,1080,114.2z M1004.72,114.2c0-32.08-22.24-51.76-50.47-51.76c-13.26,0-27.38,5.13-38.92,12.83v77.85c11.55,7.7,25.67,12.83,38.92,12.83C982.48,165.96,1004.72,146.28,1004.72,114.2z"/></g><path fill="#FCC33D" d="M147.5,128.95c0-25.98,21.14-43.15,47.12-43.15c25.98,0,46.68,17.17,46.68,43.15c0,25.98-21.14,43.6-46.68,43.6C168.64,172.55,147.5,154.93,147.5,128.95z"/></svg></div>
    <div class="pdf-header-right">Boîte à outils · Fiche pédagogique</div>
  </div>

  ${fiche.etape_nom ? `<div class="etape-badge-wrap"><span class="etape-badge">${fiche.etape_code || ""} · ${fiche.etape_nom}</span></div>` : '<div style="margin-top:16px"></div>'}

  <h1 class="pdf-title">${fiche.emoji ? fiche.emoji + " " : ""}${ficheNom}</h1>
  ${fiche.source ? `<p class="pdf-source">Source : ${fiche.source}</p>` : ""}
  ${infoGridHtml ? `<table class="info-table"><tr>${infoGridHtml}</tr></table>` : ""}
  ${metaRow ? `<div class="meta-row">${metaRow}</div>` : ""}
  ${illustrationsHtml}

  ${fiche.intention ? `
    <div class="box-intention"><div class="box-intention-inner">
      <div class="box-icon">💡</div>
      <div><div class="box-label">L'INTENTION</div><div class="box-text">${strip(fiche.intention)}</div></div>
    </div></div>
  ` : ""}

  ${fiche.pourquoi ? `
    <div class="box-pourquoi"><div class="box-pourquoi-inner">
      <div class="box-icon">⚙</div>
      <div><div class="box-label">POURQUOI CET OUTIL FONCTIONNE</div><div class="box-text">${strip(fiche.pourquoi)}</div></div>
    </div></div>
  ` : ""}

  ${materielHtml ? `<div class="section-heading"><span class="section-icon">🧳</span>Ce dont vous avez besoin</div><ul class="materiel-list">${materielHtml}</ul>` : ""}
  ${objectifsHtml ? `<div class="section-heading"><span class="section-icon">🎯</span>Objectifs pédagogiques</div>${objectifsHtml}` : ""}
  ${clesHtml ? `<div class="cles-wrap">${clesHtml}</div>` : ""}
  ${derouleHtml ? `<div class="section-heading"><span class="section-icon">👣</span>Le déroulé, étape par étape</div>${derouleHtml}` : ""}
  ${conseilsHtml ? `<div class="section-heading"><span class="section-icon">💬</span>Conseils pour bien animer</div><div class="conseils-box"><ul class="conseils-list">${conseilsHtml}</ul></div>` : ""}
  ${variantesHtml ? `<div class="section-heading"><span class="section-icon">🔄</span>Variantes possibles</div><div class="variantes-box"><ul class="variantes-list">${variantesHtml}</ul></div>` : ""}
  ${ressourcesHtml ? `<div class="section-heading"><span class="section-icon">📎</span>Ressources complémentaires</div><ul class="ressources-list">${ressourcesHtml}</ul>` : ""}

  <div class="pdf-closing">Fiche issue de la Boîte à outils Lit uP, ressources pour l'engagement des jeunes.</div>
  <div class="pdf-footer">Lit uP · ${ficheNom} <span class="footer-center">· faite pour être partagée</span></div>

  ${annexesHtml}
</body>
</html>`;

  // === PRINT via hidden iframe ===
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:800px;height:600px;border:none;opacity:0;";

  let nettoye = false;
  const nettoyer = () => {
    if (nettoye) return;
    nettoye = true;
    try { document.body.removeChild(iframe); } catch {}
    annexes.forEach((a) => a.pages.forEach((url) => URL.revokeObjectURL(url)));
  };

  try {
    // Use srcdoc + onload for reliable resource loading (fonts, images)
    await new Promise<void>((resolve, reject) => {
      iframe.onload = () => resolve();
      iframe.onerror = () => reject(new Error("Iframe failed to load"));
      iframe.srcdoc = html;
      document.body.appendChild(iframe);
    });

    const w = iframe.contentWindow;
    if (!w) throw new Error("Iframe window unavailable");

    // Fonts and images must be loaded before the print dialog opens
    await (w.document.fonts?.ready || Promise.resolve());
    await attendreImages(w.document);
    // Two animation frames to ensure paint is complete
    await new Promise<void>((r) => w.requestAnimationFrame(() => w.requestAnimationFrame(() => setTimeout(r, 150))));

    // Nom de fichier : Chrome reprend le titre de la page parente, les autres
    // navigateurs celui du document imprimé. On positionne les deux le temps
    // du dialogue, puis on restaure le titre de l'application.
    const titreInitial = document.title;
    let titreRestaure = false;
    const restaurerTitre = () => {
      if (titreRestaure) return;
      titreRestaure = true;
      if (document.title === titreFichier) document.title = titreInitial;
    };
    document.title = titreFichier;
    w.addEventListener("afterprint", () => {
      restaurerTitre();
      // Laisser le temps au navigateur de finir d'utiliser le document imprimé
      setTimeout(nettoyer, 1000);
    }, { once: true });

    try {
      w.print();
    } catch (erreur) {
      restaurerTitre();
      throw erreur;
    }
    // Sur ordinateur, print() est bloquant : on arrive ici après la fermeture
    // du dialogue. Sur mobile il rend la main tout de suite, d'où les délais.
    setTimeout(restaurerTitre, 1500);
    setTimeout(nettoyer, 60000);
  } catch (erreur) {
    nettoyer();
    throw erreur;
  }
}
