"use client";

import { useState, useRef, useEffect } from "react";
import { supabase, authHeaders } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import BetaDiagnosticModal from "@/components/BetaDiagnosticModal";
import Link from "next/link";

/* ═══════════════════════════════════════════
   TYPES
   ═══════════════════════════════════════════ */

interface ContextData {
  nom_atelier: string;
  objectif: string;
  type_accompagnement: string;
  nb_jeunes: string;
  tranches_age: string[];
  type_organisation: string;
  autre_organisation: string;
  connaissance_jeunes: string;
  autre_connaissance: string;      // si connaissance_jeunes === "Autre"
  frequence: string;
  autre_frequence: string;         // si frequence === "Autre"
  objectif_accompagnement: string;
  autre_objectif_accompagnement: string; // si objectif_accompagnement === "Autre"
  volontariat: string;
  heterogeneite: string;
  // Nouvelles thématiques (selon objectif)
  thematique_atelier: string;     // si objectif === "evaluer"
  thematique_passe: string;        // si objectif === "diagnostiquer"
  thematique_avenir: string;       // si objectif === "diagnostiquer"
}

/** Libellé envoyé à l'IA et conservé pour l'admin quand le pro a choisi « Autre ». */
function libelleAvecPrecision(valeur: string, precision: string): string {
  if (valeur !== "Autre") return valeur;
  const p = precision.trim();
  return p ? `Autre : ${p}` : "Autre (non précisé)";
}

interface CleResult {
  id: string;
  nom: string;
  emoji: string;
  besoin: string;
  color: string;
  q1: number | null;
  q2: number | null;
  precision: string;
  zone: "appui" | "explorer" | "travailler";
  contribution: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

/* ═══════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════ */

const CLES = [
  { id: "sens", nom: "Sens", emoji: "🗺️", besoin: "Autonomie", color: "#E67E22" },
  { id: "liberte", nom: "Liberté", emoji: "🗽", besoin: "Autonomie", color: "#E67E22" },
  { id: "plaisir", nom: "Plaisir", emoji: "🎢", besoin: "Autonomie", color: "#E67E22" },
  { id: "action", nom: "Action", emoji: "🥾", besoin: "Compétence", color: "#00989D" },
  { id: "progression", nom: "Progression", emoji: "🏗️", besoin: "Compétence", color: "#00989D" },
  { id: "utilite", nom: "Utilité", emoji: "👐", besoin: "Compétence", color: "#00989D" },
  { id: "securite", nom: "Sécurité", emoji: "💝", besoin: "Appartenance", color: "#6B2468" },
  { id: "consideration", nom: "Considération", emoji: "🙌", besoin: "Appartenance", color: "#6B2468" },
  { id: "confiance", nom: "Confiance", emoji: "👯", besoin: "Appartenance", color: "#6B2468" },
];

const ECHELLE = [
  { value: 1, label: "Pas du tout" },
  { value: 2, label: "Plutôt non" },
  { value: 3, label: "En partie" },
  { value: 4, label: "Plutôt oui" },
  { value: 5, label: "Tout à fait" },
  { value: 0, label: "Je ne sais pas" },
];

const PRECISION_PLACEHOLDERS: Record<string, string> = {
  sens: "Donnez plus d'informations sur le contexte, sur ce qui freine ou nourrit le sens. Qu'est-ce qui, selon vous, fait sens (ou ne fait pas sens) pour les jeunes ?",
  liberte: "Donnez plus d'informations sur le contexte, sur ce qui freine ou nourrit la liberté. Quels choix les jeunes peuvent-ils faire ? Quels choix leur manquent ?",
  plaisir: "Donnez plus d'informations sur le contexte, sur ce qui freine ou nourrit le plaisir. Qu'est-ce qui génère de l'énergie positive ? Qu'est-ce qui plombe l'ambiance ?",
  action: "Donnez plus d'informations sur le contexte, sur ce qui freine ou nourrit l'action. Quels types d'actions concrètes les jeunes réalisent-ils ?",
  progression: "Donnez plus d'informations sur le contexte, sur ce qui freine ou nourrit la progression. Comment les progrès et les apprentissages sont-ils rendus visibles ?",
  utilite: "Donnez plus d'informations sur le contexte, sur ce qui freine ou nourrit le sentiment d'utilité. Quels rôles ou responsabilités sont confiés aux jeunes ?",
  securite: "Donnez plus d'informations sur le contexte, sur ce qui freine ou nourrit la sécurité. Qu'est-ce qui favorise (ou freine) la confiance dans le groupe ?",
  consideration: "Donnez plus d'informations sur le contexte, sur ce qui freine ou nourrit la considération. Comment prenez-vous en compte les singularités de chacun·e ?",
  confiance: "Donnez plus d'informations sur le contexte, sur ce qui freine ou nourrit la confiance. Qu'est-ce qui fait (ou ne fait pas) collectif dans le groupe ?",
};

/* ═══════════════════════════════════════════
   QUESTIONS (4 variants)
   ═══════════════════════════════════════════ */

function getQuestions(isCollectif: boolean, isDiagnostiquer: boolean) {
  // Shorthand
  const C = isCollectif;
  const D = isDiagnostiquer;

  // Subject
  const S = C ? "Les jeunes" : "Le·la jeune";

  // Verb helpers for present vs past
  function v(present: string, past: string) { return D ? present : past; }

  return [
    // SENS
    { cle: "sens", q: C
      ? `${S} ${v("arrivent", "ont fait le lien")} ${D ? "à faire le lien entre" : "entre"} les activités proposées et ${C ? "leurs" : "ses"} objectifs personnels`
      : `${S} ${v("arrive", "a fait le lien")} ${D ? "à faire le lien entre" : "entre"} les activités proposées et ses objectifs personnels`
    },
    { cle: "sens", q: C
      ? `Le sujet ou la thématique abordée ${v("suscite", "a suscité")} un réel intérêt chez les jeunes`
      : `Le sujet ou la thématique abordée ${v("suscite", "a suscité")} un réel intérêt chez le·la jeune`
    },
    // LIBERTÉ
    { cle: "liberte", q: C
      ? `Les avis et préférences des jeunes ${v("sont régulièrement sollicités et pris en compte", "ont été sollicités et pris en compte")}`
      : `Les avis et préférences du·de la jeune ${v("sont régulièrement sollicités et pris en compte", "ont été sollicités et pris en compte")}`
    },
    { cle: "liberte", q: C
      ? `Les jeunes ${v("ont", "ont eu")} des espaces où ils ${v("décident", "décidaient")} eux-mêmes (thèmes, méthodes, rythme, choix entre plusieurs activités)`
      : `Le·la jeune ${v("a", "a eu")} des espaces où il·elle ${v("décide", "décidait")} (thèmes, méthodes, rythme, choix entre plusieurs activités)`
    },
    // PLAISIR
    { cle: "plaisir", q: C
      ? `Les jeunes ${v("semblent passer", "ont semblé passer")} un bon moment pendant les séances`
      : `Le·la jeune ${v("semble passer", "a semblé passer")} un bon moment pendant les séances`
    },
    { cle: "plaisir", q: D
      ? `L'ambiance ${C ? "générale est" : "des séances est"} détendue et positive`
      : `L'ambiance ${C ? "générale était" : "des séances était"} détendue et positive`
    },
    // ACTION
    { cle: "action", q: C
      ? `Les jeunes ${v("sont acteurs", "ont été acteurs")} pendant les séances et ne ${v("sont", "sont")} pas seulement auditeurs ou spectateurs : ils ${v("expérimentent, testent, produisent", "ont expérimenté, testé, produit")} pendant ou en dehors des séances`
      : `Le·la jeune ${v("est acteur·rice", "a été acteur·rice")} et pas seulement spectateur·rice : il·elle ${v("expérimente, teste, produit", "a expérimenté, testé, produit")} pendant ou en dehors des séances`
    },
    { cle: "action", q: D
      ? `L'accompagnement propose des défis ou challenges adaptés au niveau de ${C ? "chacun·e" : "son niveau"}`
      : `L'accompagnement a proposé des défis ou challenges adaptés au niveau de ${C ? "chacun·e" : "son niveau"}`
    },
    // PROGRESSION
    { cle: "progression", q: C
      ? `Les jeunes ${v("ont", "ont eu")} le sentiment d'apprendre et de progresser`
      : `Le·la jeune ${v("a", "a eu")} le sentiment d'apprendre et de progresser`
    },
    { cle: "progression", q: D
      ? `Les petites victoires et les progrès sont rendus visibles et valorisés`
      : `Les petites victoires et les progrès ont été rendus visibles et valorisés`
    },
    // UTILITÉ
    { cle: "utilite", q: D
      ? `Des responsabilités ou des rôles sont confiés ${C ? "aux jeunes" : "au·à la jeune"}`
      : `Des responsabilités ou des rôles ont été confiés ${C ? "aux jeunes" : "au·à la jeune"}`
    },
    { cle: "utilite", q: C
      ? `Les jeunes ${v("ont", "ont eu")} l'occasion d'aider ou de transmettre à d'autres`
      : `Le·la jeune ${v("a", "a eu")} l'occasion d'aider ou de transmettre à d'autres`
    },
    // SÉCURITÉ
    { cle: "securite", q: C
      ? `Les jeunes ${v("se sentent", "se sont sentis")} en confiance pour oser, essayer, se tromper`
      : `Le·la jeune ${v("se sent", "s'est senti·e")} en confiance pour oser, essayer, se tromper`
    },
    { cle: "securite", q: C
      ? `Les jeunes ${v("osent", "ont osé")} poser des questions ou exprimer un désaccord`
      : `Le·la jeune ${v("ose", "a osé")} poser des questions ou exprimer un désaccord`
    },
    // CONSIDÉRATION
    { cle: "consideration", q: D
      ? `Chaque jeune est reconnu·e dans ce qu'il·elle apporte de singulier`
      : (C ? `Chaque jeune a été reconnu·e dans ce qu'il·elle apportait de singulier` : `Le·la jeune a été reconnu·e dans ce qu'il·elle apportait de singulier`)
    },
    { cle: "consideration", q: D
      ? `L'accompagnement s'adapte au rythme et aux besoins de ${C ? "chacun·e" : "du·de la jeune"}`
      : `L'accompagnement s'est adapté au rythme et aux besoins de ${C ? "chacun·e" : "du·de la jeune"}`
    },
    // CONFIANCE
    { cle: "confiance", q: C
      ? `Les jeunes ${v("se sentent faire partie", "se sont sentis faire partie")} d'un collectif, d'un groupe`
      : `Le·la jeune ${v("se sent soutenu·e et entouré·e", "s'est senti·e soutenu·e et entouré·e")} dans son parcours`
    },
    { cle: "confiance", q: C
      ? `Les jeunes ${v("se soutiennent", "se sont soutenus")} entre eux spontanément`
      : (D ? `Un lien de confiance existe dans la relation d'accompagnement` : `Un lien de confiance s'est installé dans la relation d'accompagnement`)
    },
  ];
}

/* ═══════════════════════════════════════════
   CLASSIFY SCORES INTO ZONES
   ═══════════════════════════════════════════ */

function classifyZone(q1: number | null, q2: number | null): "appui" | "explorer" | "travailler" {
  const vals = [q1, q2].filter(v => v !== null && v !== 0) as number[];
  if (vals.length === 0) return "explorer"; // all "je ne sais pas"
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  if (avg >= 3.5) return "appui";
  if (avg >= 2.5) return "explorer";
  return "travailler";
}

/* ═══════════════════════════════════════════
   MINI MARKDOWN RENDERER (sécurisé)
   ═══════════════════════════════════════════ */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Convertit un texte markdown simple en HTML sécurisé.
 * Supporte : ## titres, **gras**, *italique*, listes "- ", paragraphes, sauts de ligne.
 * Échappe d'abord les caractères dangereux pour éviter toute injection HTML.
 */
function renderMarkdown(text: string): string {
  if (!text) return "";

  // 1. Échapper tout le HTML d'abord (sécurité)
  let html = escapeHtml(text);

  // 2. Titres (## et ###, ordre important : du plus long au plus court)
  html = html.replace(/^#### (.+)$/gm, '<h4 style="font-size:13px;font-weight:700;color:var(--anthracite,#2B3442);margin:14px 0 6px;">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3 style="font-size:14px;font-weight:700;color:var(--canard-dark,#007479);margin:18px 0 8px;">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h3 style="font-size:15px;font-weight:800;color:var(--anthracite,#2B3442);margin:20px 0 10px;border-bottom:2px solid var(--canard-light,#e0f3f4);padding-bottom:4px;">$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2 style="font-size:17px;font-weight:800;color:var(--anthracite,#2B3442);margin:24px 0 12px;">$1</h2>');

  // 3. Séparateurs ---
  html = html.replace(/^---+$/gm, '<hr style="border:none;border-top:1px solid var(--line,#e5e5e5);margin:16px 0;" />');

  // 4. Gras **texte**
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong style="color:var(--anthracite,#2B3442);">$1</strong>');

  // 5. Italique *texte* (en évitant les listes)
  html = html.replace(/(^|[^*])\*([^*\n]+)\*([^*]|$)/g, '$1<em>$2</em>$3');

  // 5bis. Italique _texte_ (style alternatif fréquemment utilisé par l'IA)
  // On évite de matcher les underscores au milieu des mots (snake_case)
  // On accepte AUSSI les fins de balises HTML (>) comme préfixe car après le rendu
  // les sauts de ligne deviennent <br/> et les listes <li>, ce qui peut précéder un _italique_
  html = html.replace(/(^|[\s,;:!?(>])_([^_\n]+)_(?=[\s,;:!?).<]|$)/g, '$1<em>$2</em>');

  // 6. Listes "- "
  html = html.replace(/^- (.+)$/gm, '<li style="margin-bottom:6px;">$1</li>');
  // Envelopper les <li> consécutifs dans <ul>
  html = html.replace(/((?:<li[^>]*>.*?<\/li>\s*)+)/gs, '<ul style="margin:8px 0 12px 20px;padding-left:8px;list-style:disc;">$1</ul>');

  // 7. Paragraphes (double saut de ligne)
  html = html.replace(/\n\n+/g, '</p><p style="margin:0 0 12px;">');
  html = '<p style="margin:0 0 12px;">' + html + '</p>';

  // 8. Sauts de ligne simples → <br/>
  html = html.replace(/\n/g, '<br/>');

  // 9. Nettoyer les <p> autour des <h2>, <h3>, <ul>, <hr>
  html = html.replace(/<p[^>]*>\s*(<(?:h2|h3|ul|hr)[^>]*>)/g, '$1');
  html = html.replace(/(<\/(?:h2|h3|ul)>)\s*<br\/>/g, '$1');
  html = html.replace(/(<hr[^>]*\/>)\s*<br\/>/g, '$1');
  html = html.replace(/<p[^>]*>\s*<\/p>/g, '');

  return html;
}

/* ═══════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════ */

// Clé localStorage : l'avertissement « version bêta » a été lu sur ce navigateur
const BETA_VU_KEY = "bao_diagnostic_pro_beta_vu";

export default function DiagnosticProPage() {
  const [step, setStep] = useState(0); // 0=contexte, 1=évaluation, 2=résultats
  const [ctx, setCtx] = useState<ContextData>({
    nom_atelier: "", objectif: "", type_accompagnement: "", nb_jeunes: "", tranches_age: [],
    type_organisation: "", autre_organisation: "", connaissance_jeunes: "", autre_connaissance: "",
    frequence: "", autre_frequence: "", objectif_accompagnement: "", autre_objectif_accompagnement: "",
    volontariat: "", heterogeneite: "",
    thematique_atelier: "", thematique_passe: "", thematique_avenir: "",
  });
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [precisions, setPrecisions] = useState<Record<string, string>>({});
  const [showPrecision, setShowPrecision] = useState<Record<string, boolean>>({});
  const [champLibre, setChampLibre] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CleResult[]>([]);
  const [analysisText, setAnalysisText] = useState("");
  const [contributions, setContributions] = useState<Record<string, string>>({});
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // États pour la sauvegarde explicite (bouton "Sauvegarder l'analyse")
  const [savedAnalysisId, setSavedAnalysisId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Avertissement « version bêta » : affiché à l'entrée de la page, mémorisé par navigateur
  const router = useRouter();
  const [showBeta, setShowBeta] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(BETA_VU_KEY) !== "1") setShowBeta(true);
    } catch {
      setShowBeta(true);
    }
  }, []);
  function accepterBeta() {
    setShowBeta(false);
    try { localStorage.setItem(BETA_VU_KEY, "1"); } catch {}
  }
  function reporterBeta() {
    router.push("/bao/diagnostiquer");
  }

  const isCollectif = ctx.type_accompagnement === "collectif" || ctx.type_accompagnement === "les_deux";
  const isDiagnostiquer = ctx.objectif === "diagnostiquer";
  const questions = getQuestions(isCollectif, isDiagnostiquer);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  // Scroll automatique vers le haut au changement d'étape
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  // Validation
  const canStep0 = ctx.objectif && ctx.type_accompagnement && ctx.tranches_age.length > 0 && ctx.type_organisation && ctx.volontariat;
  const canStep1 = Object.keys(answers).length === questions.length;

  function toggleAge(age: string) {
    setCtx(p => ({ ...p, tranches_age: p.tranches_age.includes(age) ? p.tranches_age.filter(a => a !== age) : [...p.tranches_age, age] }));
  }

  /* ── Compute results ── */
  function computeResults(): CleResult[] {
    return CLES.map(cle => {
      const qs = questions.map((q, i) => ({ ...q, idx: i })).filter(q => q.cle === cle.id);
      const q1 = answers[qs[0]?.idx] ?? null;
      const q2 = answers[qs[1]?.idx] ?? null;
      const zone = classifyZone(q1, q2);
      return { ...cle, q1, q2, precision: precisions[cle.id] || "", zone, contribution: "" };
    });
  }

  /* ── Submit ── */
  async function handleSubmit() {
    setLoading(true);
    setSavedAnalysisId(null); // reset à chaque nouveau diagnostic
    setSaveError("");
    const res = computeResults();
    setResults(res);

    const appui = res.filter(r => r.zone === "appui");
    const explorer = res.filter(r => r.zone === "explorer");
    const travailler = res.filter(r => r.zone === "travailler");

    const precisionsText = res.filter(r => r.precision).map(r => `${r.emoji} ${r.nom} : "${r.precision}"`).join("\n");

    const prompt = `Un professionnel vient de remplir un diagnostic de l'engagement (cadre Lit uP). Voici les données :

ATELIER : ${ctx.nom_atelier || "(sans nom)"}
OBJECTIF : ${ctx.objectif === "diagnostiquer" ? "Diagnostiquer et développer l'engagement" : "Évaluer et améliorer un atelier/accompagnement"}
TYPE : ${ctx.type_accompagnement}
NOMBRE DE JEUNES : ${ctx.nb_jeunes || "non précisé"}
TRANCHES D'ÂGE : ${ctx.tranches_age.join(", ")}
ORGANISATION : ${ctx.type_organisation}${ctx.autre_organisation ? ` (${ctx.autre_organisation})` : ""}
CONNAISSANCE DES JEUNES : ${ctx.connaissance_jeunes ? libelleAvecPrecision(ctx.connaissance_jeunes, ctx.autre_connaissance) : "non précisé"}
FRÉQUENCE : ${ctx.frequence ? libelleAvecPrecision(ctx.frequence, ctx.autre_frequence) : "non précisée"}
OBJECTIF ACCOMPAGNEMENT : ${ctx.objectif_accompagnement ? libelleAvecPrecision(ctx.objectif_accompagnement, ctx.autre_objectif_accompagnement) : "non précisé"}
VOLONTARIAT : ${ctx.volontariat}
HÉTÉROGÉNÉITÉ MOTIVATION : ${ctx.heterogeneite || "non précisé"}
${ctx.objectif === "evaluer" && ctx.thematique_atelier ? `THÉMATIQUE DE L'ATELIER ÉVALUÉ : ${ctx.thematique_atelier}` : ""}
${ctx.objectif === "diagnostiquer" && ctx.thematique_passe ? `THÉMATIQUE DE L'ATELIER PASSÉ : ${ctx.thematique_passe}` : ""}
${ctx.objectif === "diagnostiquer" && ctx.thematique_avenir ? `THÉMATIQUE DE L'ATELIER À VENIR (à préparer) : ${ctx.thematique_avenir}` : ""}

RÉSULTATS PAR CLÉ :
🟢 Points d'appui : ${appui.map(r => `${r.emoji} ${r.nom}`).join(", ") || "aucun identifié"}
🟡 À explorer : ${explorer.map(r => `${r.emoji} ${r.nom}`).join(", ") || "aucun"}
🔴 À travailler : ${travailler.map(r => `${r.emoji} ${r.nom}`).join(", ") || "aucun"}

DÉTAIL DES RÉPONSES :
${res.map(r => {
  const labels = ["", "Pas du tout", "Plutôt non", "En partie", "Plutôt oui", "Tout à fait"];
  const v1 = r.q1 === 0 ? "Je ne sais pas" : (r.q1 ? labels[r.q1] : "non répondu");
  const v2 = r.q2 === 0 ? "Je ne sais pas" : (r.q2 ? labels[r.q2] : "non répondu");
  return `${r.emoji} ${r.nom} (${r.besoin}) : Q1=${v1}, Q2=${v2} → ${r.zone}`;
}).join("\n")}

${precisionsText ? `PRÉCISIONS DU PROFESSIONNEL PAR CLÉ :\n${precisionsText}` : ""}

${champLibre ? `COMMENTAIRE LIBRE :\n"${champLibre}"` : ""}

Génère une analyse personnalisée en respectant strictement la posture définie dans tes instructions système : équilibre questions / pistes concrètes (au moins 1-2 actions concrètes par clé à travailler), encourage à demander aux jeunes leurs idées, cite UNIQUEMENT les outils BAO qui figurent dans ta liste, et propose un diagnostic AVEC les jeunes si beaucoup d'incertitudes. Réponds en français, paragraphes courts, ton professionnel et chaleureux.`;

    try {
      // Récupérer l'utilisateur pour le tracker dans le quota mensuel + tagger l'analyse pour la relecture admin
      const { data: userDataPre } = await supabase.auth.getUser();
      const userIdForApi = userDataPre?.user?.id;
      const userEmailForApi = userDataPre?.user?.email;

      const apiRes = await fetch("/api/analyze", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          // ⚠️ Plus besoin de `system` ici : la route /api/analyze construit
          // un system prompt enrichi avec corpus Drive + liste outils BAO
          // dès qu'elle voit `diagnosticContext`.
          diagnosticContext: {
            source: "diagnostic_pro",
            zones: {
              appui: appui.map(r => r.nom),
              explorer: explorer.map(r => r.nom),
              travailler: travailler.map(r => r.nom),
            },
            type_organisation: ctx.type_organisation + (ctx.autre_organisation ? ` (${ctx.autre_organisation})` : ""),
            contexte: ctx.type_accompagnement,
            nom_atelier: ctx.nom_atelier || undefined,
            nb_jeunes: parseInt(ctx.nb_jeunes) || undefined,
            objectif: ctx.objectif,
            volontariat: ctx.volontariat,
            heterogeneite: ctx.heterogeneite || undefined,
            thematique_atelier: ctx.thematique_atelier || undefined,
            thematique_passe: ctx.thematique_passe || undefined,
            thematique_avenir: ctx.thematique_avenir || undefined,
            // 🆕 Champs supplémentaires du formulaire pour traçabilité admin complète
            tranches_age: ctx.tranches_age,
            type_organisation_raw: ctx.type_organisation,
            autre_organisation: ctx.autre_organisation || undefined,
            connaissance_jeunes: ctx.connaissance_jeunes ? libelleAvecPrecision(ctx.connaissance_jeunes, ctx.autre_connaissance) : undefined,
            frequence: ctx.frequence ? libelleAvecPrecision(ctx.frequence, ctx.autre_frequence) : undefined,
            objectif_accompagnement: ctx.objectif_accompagnement ? libelleAvecPrecision(ctx.objectif_accompagnement, ctx.autre_objectif_accompagnement) : undefined,
            precisions: precisions,
            commentaire_libre: champLibre,
            user_id: userIdForApi,
            user_email: userEmailForApi,
          },
        }),
      });
      if (apiRes.ok) {
        const data = await apiRes.json();
        const text = data.text || data.content?.[0]?.text || "Analyse indisponible.";
        setAnalysisText(text);
        setChatMessages([{ role: "assistant", content: text }]);
      } else if (apiRes.status === 429) {
        // Quota mensuel atteint
        const errData = await apiRes.json().catch(() => ({}));
        setAnalysisText(`⚠️ ${errData.error || "Quota mensuel atteint. Réessaie le mois prochain."}`);
      } else {
        setAnalysisText("Erreur lors de l'analyse. Veuillez réessayer.");
      }
      // ⚠️ Plus de sauvegarde silencieuse : l'utilisateur clique sur
      // "💾 Sauvegarder l'analyse" pour la retrouver dans Mon Espace.
    } catch {
      setAnalysisText("Erreur de connexion.");
    }
    setLoading(false);
    setStep(2);
  }

  /* ── Sauvegarde explicite vers Supabase (bouton "Sauvegarder l'analyse") ── */
  async function saveAnalysisToSupabase() {
    if (savedAnalysisId || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        setSaveError("Vous devez être connecté pour sauvegarder. Rendez-vous dans Mon espace.");
        setSaving(false);
        return;
      }
      const alertes = results.filter(r => r.zone === "travailler").map(r => r.nom);

      // Convertir les zones en scores 0-100 (compatible avec Mon Espace et la page détail)
      // appui → 80, explorer → 50, travailler → 30
      const zoneToScore = (zone: "appui" | "explorer" | "travailler"): number => {
        if (zone === "appui") return 80;
        if (zone === "explorer") return 50;
        return 30;
      };
      const scoresNumeric: Record<string, number> = Object.fromEntries(
        results.map(r => [r.nom, zoneToScore(r.zone)])
      );

      const payload = {
        user_id: userData.user.id,
        nom_atelier: ctx.nom_atelier || null,
        date_atelier: null,
        nb_jeunes: parseInt(ctx.nb_jeunes) || null,
        type_eval: "diagnostic_pro", // ⚠️ "type_eval" (pas "type_evaluation") pour cohérence avec Mon Espace
        materiel: null,
        scores: scoresNumeric, // ⚠️ scores en nombres 0-100, comme /bao/analyse
        scores_detail: Object.fromEntries(results.map(r => [r.nom, { q1: r.q1, q2: r.q2, zone: r.zone }])), // détail dans scores_detail
        alertes: alertes,
        analysis_text: analysisText || null, // 🆕 texte de l'analyse IA pour réaffichage dans Mon Espace
      };
      const { data, error } = await supabase.from("analyses").insert(payload).select("id").single();
      if (error) {
        console.error("Erreur sauvegarde:", error);
        setSaveError(`Erreur : ${error.message}`);
      } else if (data) {
        setSavedAnalysisId(data.id);
      }
    } catch (e: any) {
      setSaveError(`Erreur : ${e.message || "inconnue"}`);
    }
    setSaving(false);
  }

  /* ── Chat ── */
  async function handleChat() {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setChatLoading(true);
    try {
      const history = [...chatMessages, { role: "user" as const, content: userMsg }];
      const apiRes = await fetch("/api/analyze", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          messages: history,
          system: `Expert engagement jeunes (Lit uP). Contexte : ${ctx.type_accompagnement}, ${ctx.type_organisation}, âges ${ctx.tranches_age.join(", ")}, volontariat: ${ctx.volontariat}. Clés fortes : ${results.filter(r => r.zone === "appui").map(r => r.nom).join(", ")}. Clés à travailler : ${results.filter(r => r.zone === "travailler").map(r => r.nom).join(", ")}. Réponds en français, concis et utile. Commence par les forces.`
        }),
      });
      if (apiRes.ok) {
        const data = await apiRes.json();
        const text = data.content?.[0]?.text || data.text || "Erreur.";
        setChatMessages(prev => [...prev, { role: "assistant", content: text }]);
      }
    } catch {
      setChatMessages(prev => [...prev, { role: "assistant", content: "Erreur de connexion." }]);
    }
    setChatLoading(false);
  }

  /* ═══════════════════════════════════════════
     STYLES
     ═══════════════════════════════════════════ */

  const S = {
    page: { minHeight: "100vh", background: "var(--bg)", fontFamily: "'Source Sans 3', system-ui, sans-serif" } as React.CSSProperties,
    wrap: { maxWidth: "740px", margin: "0 auto", padding: "32px 20px 60px" } as React.CSSProperties,
    stepper: { display: "flex", gap: "4px", marginBottom: "32px" } as React.CSSProperties,
    dot: (active: boolean, done: boolean) => ({ flex: 1, height: "4px", borderRadius: "2px", background: done || active ? "var(--canard)" : "var(--line-strong)", opacity: active ? 1 : done ? 0.6 : 0.3 }) as React.CSSProperties,
    title: { fontSize: "28px", fontWeight: 800, color: "var(--anthracite)", letterSpacing: "-0.02em", marginBottom: "8px" } as React.CSSProperties,
    sub: { fontSize: "15px", color: "var(--muted)", marginBottom: "28px", lineHeight: 1.5 } as React.CSSProperties,
    field: { marginBottom: "20px" } as React.CSSProperties,
    autre: { marginTop: "8px", width: "100%", padding: "8px 12px", borderRadius: "8px", border: "2px solid var(--line-strong)", fontFamily: "inherit", fontSize: "13px", boxSizing: "border-box" } as React.CSSProperties,
    beta: { fontSize: "11px", fontWeight: 700, background: "#6B2468", color: "white", padding: "3px 9px", borderRadius: "6px", textTransform: "uppercase", letterSpacing: "0.4px", verticalAlign: "middle", marginLeft: "10px" } as React.CSSProperties,
    label: { fontSize: "13px", fontWeight: 700, color: "var(--anthracite)", marginBottom: "8px", display: "block" } as React.CSSProperties,
    rg: { display: "flex", flexWrap: "wrap" as const, gap: "8px" } as React.CSSProperties,
    rb: (on: boolean) => ({ padding: "8px 16px", borderRadius: "20px", fontSize: "13px", fontWeight: 600, cursor: "pointer", border: on ? "2px solid var(--canard)" : "2px solid var(--line-strong)", background: on ? "var(--canard)" : "white", color: on ? "white" : "var(--anthracite)", transition: "all 0.15s" }) as React.CSSProperties,
    cb: (on: boolean) => ({ padding: "8px 14px", borderRadius: "18px", fontSize: "12px", fontWeight: 600, cursor: "pointer", border: on ? "2px solid var(--canard)" : "2px solid var(--line-strong)", background: on ? "var(--canard-light)" : "white", color: on ? "var(--canard-dark)" : "var(--anthracite)" }) as React.CSSProperties,
    nav: { display: "flex", justifyContent: "space-between", marginTop: "32px", gap: "12px" } as React.CSSProperties,
    btn1: { padding: "12px 28px", borderRadius: "24px", fontSize: "14px", fontWeight: 700, cursor: "pointer", border: "none", background: "var(--canard)", color: "white" } as React.CSSProperties,
    btn2: { padding: "12px 28px", borderRadius: "24px", fontSize: "14px", fontWeight: 700, cursor: "pointer", border: "2px solid var(--line-strong)", background: "transparent", color: "var(--anthracite)" } as React.CSSProperties,
    dis: { opacity: 0.4, cursor: "not-allowed" } as React.CSSProperties,
    qCard: { background: "white", borderRadius: "12px", padding: "18px 20px", marginBottom: "12px", border: "1px solid var(--line)" } as React.CSSProperties,
    qText: { fontSize: "14px", fontWeight: 600, color: "var(--anthracite)", marginBottom: "12px", lineHeight: 1.4 } as React.CSSProperties,
    scaleRow: { display: "flex", gap: "6px", flexWrap: "wrap" as const } as React.CSSProperties,
    scaleBtn: (on: boolean, isNsp: boolean) => ({ padding: "8px 10px", borderRadius: "8px", fontSize: "11px", fontWeight: 600, textAlign: "center" as const, cursor: "pointer", border: on ? "2px solid var(--canard)" : "1px solid var(--line-strong)", background: on ? (isNsp ? "#e5e7eb" : "var(--canard)") : "white", color: on ? (isNsp ? "var(--anthracite)" : "white") : (isNsp ? "#9ca3af" : "var(--muted)"), flex: isNsp ? "none" : 1, opacity: isNsp && !on ? 0.6 : 1 }) as React.CSSProperties,
    precisionBtn: { fontSize: "12px", color: "var(--canard)", cursor: "pointer", background: "none", border: "none", fontFamily: "inherit", fontWeight: 600, marginTop: "8px", padding: 0 } as React.CSSProperties,
    precisionTa: { width: "100%", minHeight: "80px", padding: "10px", borderRadius: "8px", border: "1px solid var(--line-strong)", fontFamily: "inherit", fontSize: "12px", resize: "vertical" as const, lineHeight: 1.5, marginTop: "8px" } as React.CSSProperties,
    card: { background: "white", borderRadius: "16px", padding: "24px", marginBottom: "16px", border: "1px solid var(--line)" } as React.CSSProperties,
    zoneCard: (zone: string) => ({
      background: "white", borderRadius: "14px", padding: "16px 20px", marginBottom: "10px",
      borderLeft: `4px solid ${zone === "appui" ? "#059669" : zone === "explorer" ? "#d97706" : "#dc2626"}`,
      border: `1px solid ${zone === "appui" ? "#d1fae5" : zone === "explorer" ? "#fef3c7" : "#fee2e2"}`,
    }) as React.CSSProperties,
    chatBox: { background: "white", borderRadius: "16px", border: "1px solid var(--line)", overflow: "hidden" } as React.CSSProperties,
    chatMsgs: { maxHeight: "400px", overflowY: "auto" as const, padding: "20px" } as React.CSSProperties,
    bubble: (isUser: boolean) => ({ maxWidth: "85%", padding: "12px 16px", borderRadius: "14px", marginBottom: "10px", fontSize: "13px", lineHeight: 1.6, marginLeft: isUser ? "auto" : 0, marginRight: isUser ? 0 : "auto", background: isUser ? "var(--canard)" : "var(--bg)", color: isUser ? "white" : "var(--anthracite)", whiteSpace: "pre-wrap" as const }) as React.CSSProperties,
    chatIn: { display: "flex", gap: "8px", padding: "12px 16px", borderTop: "1px solid var(--line)", background: "var(--bg)" } as React.CSSProperties,
    contributionBox: { marginTop: "10px", padding: "12px", background: "#f0fdf4", borderRadius: "8px", border: "1px solid #d1fae5" } as React.CSSProperties,
  };

  const stepLabels = ["Contexte", "Évaluation des 9 clés", "Résultats"];

  /* ═══════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════ */

  return (
    <div style={S.page}>
      {/* Keyframe global pour l'animation spinner */}
      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .analysis-content ul {
          margin: 8px 0 12px 20px !important;
          padding-left: 8px !important;
        }
        .analysis-content li {
          margin-bottom: 6px;
        }
        .analysis-content p {
          margin: 0 0 12px !important;
        }
        .analysis-content strong {
          font-weight: 700;
        }
      `}</style>
      <AppHeader searchQuery="" onSearchChange={() => {}} />
      {showBeta && <BetaDiagnosticModal onStart={accepterBeta} onLater={reporterBeta} />}
      <div style={S.wrap}>
        <div style={{ marginBottom: "20px" }}>
          <Link href="/bao" style={{ fontSize: "13px", color: "var(--canard)", textDecoration: "none", fontWeight: 600 }}>← Retour à la boîte à outils</Link>
        </div>

        {/* Stepper */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "12px", color: "var(--muted)", fontWeight: 600 }}>
          {stepLabels.map((l, i) => <span key={i} style={{ color: i === step ? "var(--canard)" : undefined, fontWeight: i === step ? 800 : 600 }}>{l}</span>)}
        </div>
        <div style={S.stepper}>
          {stepLabels.map((_, i) => <div key={i} style={S.dot(i === step, i < step)} />)}
        </div>

        {/* ═══════ STEP 0 : CONTEXTE ═══════ */}
        {step === 0 && (
          <div>
            <h1 style={S.title}>Diagnostic de l&apos;engagement<span style={S.beta}>Bêta</span></h1>
            <p style={S.sub}>Cet outil vous aide à identifier les leviers de motivation activés (ou non) dans votre accompagnement, en vous appuyant sur les 9 clés de l'engagement Lit uP.</p>

            {/* Nom de l'atelier (pour retrouver l'analyse dans Mon espace) */}
            <div style={S.field}>
              <label style={S.label}>Nom de l'atelier ou du groupe</label>
              <input
                type="text"
                value={ctx.nom_atelier}
                onChange={e => setCtx(p => ({ ...p, nom_atelier: e.target.value }))}
                placeholder="Ex : Groupe Speak uP - ML Hyères - Mai 2026"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  border: "2px solid var(--line-strong)",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontFamily: "inherit",
                  outline: "none",
                  boxSizing: "border-box",
                  background: "white",
                }}
              />
            </div>

            {/* Q1: Objectif */}
            <div style={S.field}>
              <label style={S.label}>Quel est votre objectif ? *</label>
              <div style={S.rg}>
                {[["evaluer", "Évaluer et améliorer un atelier ou un accompagnement que j'ai réalisé"], ["diagnostiquer", "Diagnostiquer et développer l'engagement d'un groupe ou d'une personne que j'accompagne actuellement"]].map(([v, l]) => (
                  <div key={v} style={{ ...S.rb(ctx.objectif === v), fontSize: "12px", padding: "10px 16px", maxWidth: "100%" }} onClick={() => setCtx(p => ({ ...p, objectif: v }))}>{l}</div>
                ))}
              </div>
            </div>

            {/* Thématique(s) conditionnelle(s) selon l'objectif */}
            {ctx.objectif === "evaluer" && (
              <div style={S.field}>
                <label style={S.label}>Thématique de cet atelier ou accompagnement</label>
                <input
                  type="text"
                  value={ctx.thematique_atelier}
                  onChange={e => setCtx(p => ({ ...p, thematique_atelier: e.target.value }))}
                  placeholder="Ex : Estime de soi, Orientation professionnelle, Expression orale…"
                  style={{
                    width: "100%", padding: "10px 14px",
                    border: "2px solid var(--line-strong)", borderRadius: "10px",
                    fontSize: "14px", fontFamily: "inherit", outline: "none",
                    boxSizing: "border-box", background: "white",
                  }}
                />
                <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "6px", marginBottom: 0 }}>
                  (optionnel) Permet d'adapter les exemples de l'analyse à votre contexte
                </p>
              </div>
            )}

            {ctx.objectif === "diagnostiquer" && (
              <>
                <div style={S.field}>
                  <label style={S.label}>Thématique de l'atelier passé (sur lequel vous évaluez l'engagement)</label>
                  <input
                    type="text"
                    value={ctx.thematique_passe}
                    onChange={e => setCtx(p => ({ ...p, thematique_passe: e.target.value }))}
                    placeholder="Ex : Atelier découverte des métiers"
                    style={{
                      width: "100%", padding: "10px 14px",
                      border: "2px solid var(--line-strong)", borderRadius: "10px",
                      fontSize: "14px", fontFamily: "inherit", outline: "none",
                      boxSizing: "border-box", background: "white",
                    }}
                  />
                </div>

                <div style={S.field}>
                  <label style={S.label}>Thématique de l'atelier à venir (que vous voulez préparer)</label>
                  <input
                    type="text"
                    value={ctx.thematique_avenir}
                    onChange={e => setCtx(p => ({ ...p, thematique_avenir: e.target.value }))}
                    placeholder="Ex : Préparation aux entretiens"
                    style={{
                      width: "100%", padding: "10px 14px",
                      border: "2px solid var(--line-strong)", borderRadius: "10px",
                      fontSize: "14px", fontFamily: "inherit", outline: "none",
                      boxSizing: "border-box", background: "white",
                    }}
                  />
                  <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "6px", marginBottom: 0 }}>
                    (optionnel) Permet d'adapter les recommandations à votre prochain atelier
                  </p>
                </div>
              </>
            )}

            {/* Q2: Type */}
            <div style={S.field}>
              <label style={S.label}>Type d'accompagnement *</label>
              <div style={S.rg}>
                {[["individuel", "Individuel"], ["collectif", "Collectif"], ["les_deux", "Les deux"]].map(([v, l]) => (
                  <div key={v} style={S.rb(ctx.type_accompagnement === v)} onClick={() => setCtx(p => ({ ...p, type_accompagnement: v }))}>{l}</div>
                ))}
              </div>
            </div>

            {/* Q3: Nombre (conditionnel) */}
            {isCollectif && (
              <div style={S.field}>
                <label style={S.label}>Nombre de jeunes dans le groupe</label>
                <div style={S.rg}>
                  {[["2-5", "2-5"], ["6-10", "6-10"], ["11-15", "11-15"], ["15+", "Plus de 15"]].map(([v, l]) => (
                    <div key={v} style={S.rb(ctx.nb_jeunes === v)} onClick={() => setCtx(p => ({ ...p, nb_jeunes: v }))}>{l}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Q4: Âge (multi) */}
            <div style={S.field}>
              <label style={S.label}>Tranche(s) d'âge * (choix multiple)</label>
              <div style={S.rg}>
                {["Moins de 14 ans", "14-16 ans", "16-18 ans", "18-25 ans", "Plus de 25 ans"].map(age => (
                  <div key={age} style={S.cb(ctx.tranches_age.includes(age))} onClick={() => toggleAge(age)}>{age}</div>
                ))}
              </div>
            </div>

            {/* Q5: Organisation */}
            <div style={S.field}>
              <label style={S.label}>Type d'organisation *</label>
              <div style={{ ...S.rg, flexDirection: "column" }}>
                {[
                  "Service Public de l'Emploi (Mission locale, France Travail, Cap Emploi…)",
                  "École de la Deuxième Chance, EPIDE ou autre dispositif d'insertion",
                  "Dispositif de persévérance scolaire (MLDS, micro-lycée, micro-collège, etc.)",
                  "Établissement scolaire",
                  "Association d'éducation",
                  "Formation professionnelle",
                  "Autre",
                ].map(org => (
                  <div key={org} style={{ ...S.rb(ctx.type_organisation === org), textAlign: "left" as const }} onClick={() => setCtx(p => ({ ...p, type_organisation: org }))}>{org === "Autre" ? "Autre (précisez)" : org}</div>
                ))}
              </div>
              {ctx.type_organisation === "Autre" && (
                <input type="text" placeholder="Précisez le type d'organisation" value={ctx.autre_organisation} onChange={e => setCtx(p => ({ ...p, autre_organisation: e.target.value }))} style={S.autre} />
              )}
            </div>

            {/* Q6: Connaissance */}
            <div style={S.field}>
              <label style={S.label}>Quel est votre niveau de connaissance de ce(s) jeune(s) ?</label>
              <div style={{ ...S.rg, flexDirection: "column" }}>
                {[
                  "Je ne les connais pas encore (ou très peu)",
                  "Je commence à les connaître (quelques rencontres)",
                  "Je les connais bien (plusieurs semaines/mois d'accompagnement)",
                  "Je les connais très bien (accompagnement long, relation de confiance installée)",
                  "Autre",
                ].map(c => (
                  <div key={c} style={{ ...S.rb(ctx.connaissance_jeunes === c), textAlign: "left" as const }} onClick={() => setCtx(p => ({ ...p, connaissance_jeunes: c }))}>{c === "Autre" ? "Autre (précisez)" : c}</div>
                ))}
              </div>
              {ctx.connaissance_jeunes === "Autre" && (
                <input type="text" placeholder="Précisez votre niveau de connaissance de ce(s) jeune(s)" value={ctx.autre_connaissance} onChange={e => setCtx(p => ({ ...p, autre_connaissance: e.target.value }))} style={S.autre} />
              )}
            </div>

            {/* Q7: Fréquence */}
            <div style={S.field}>
              <label style={S.label}>À quelle fréquence rencontrez-vous ce(s) jeune(s) ?</label>
              <div style={S.rg}>
                {["Quotidienne ou plusieurs fois par semaine", "Hebdomadaire", "Bimensuelle", "Mensuelle", "Ponctuelle (quelques rencontres espacées)", "Rencontre unique", "Autre"].map(f => (
                  <div key={f} style={S.rb(ctx.frequence === f)} onClick={() => setCtx(p => ({ ...p, frequence: f }))}>{f === "Autre" ? "Autre (précisez)" : f}</div>
                ))}
              </div>
              {ctx.frequence === "Autre" && (
                <input type="text" placeholder="Précisez la fréquence des rencontres" value={ctx.autre_frequence} onChange={e => setCtx(p => ({ ...p, autre_frequence: e.target.value }))} style={S.autre} />
              )}
            </div>

            {/* Q8: Objectif accompagnement */}
            <div style={S.field}>
              <label style={S.label}>Objectif principal de l'accompagnement</label>
              <div style={S.rg}>
                {["Remobilisation", "Insertion professionnelle", "Projet de vie", "Cohésion de groupe", "Développement personnel", "Autre"].map(o => (
                  <div key={o} style={S.rb(ctx.objectif_accompagnement === o)} onClick={() => setCtx(p => ({ ...p, objectif_accompagnement: o }))}>{o === "Autre" ? "Autre (précisez)" : o}</div>
                ))}
              </div>
              {ctx.objectif_accompagnement === "Autre" && (
                <input type="text" placeholder="Précisez l'objectif principal de l'accompagnement" value={ctx.autre_objectif_accompagnement} onChange={e => setCtx(p => ({ ...p, autre_objectif_accompagnement: e.target.value }))} style={S.autre} />
              )}
            </div>

            {/* Q9: Volontariat */}
            <div style={S.field}>
              <label style={S.label}>Le(s) jeune(s) participe(nt) à cet accompagnement : *</label>
              <div style={{ ...S.rg, flexDirection: "column" }}>
                {[
                  "De manière totalement volontaire",
                  "Sur prescription, mais avec une marge de choix (peut arrêter)",
                  "De manière obligatoire ou fortement contrainte",
                ].map(v => (
                  <div key={v} style={{ ...S.rb(ctx.volontariat === v), textAlign: "left" as const }} onClick={() => setCtx(p => ({ ...p, volontariat: v }))}>{v}</div>
                ))}
              </div>
            </div>

            {/* Q10: Hétérogénéité (conditionnel) */}
            {isCollectif ? (
              <div style={S.field}>
                <label style={S.label}>Comment décririez-vous le niveau de motivation au sein du groupe ?</label>
                <div style={{ ...S.rg, flexDirection: "column" }}>
                  {[
                    "Plutôt homogène : la plupart des jeunes ont un niveau de motivation similaire",
                    "Hétérogène : certains sont très engagés, d'autres beaucoup moins",
                    "Très hétérogène : il y a un vrai écart entre les jeunes les plus et les moins motivés",
                  ].map(h => (
                    <div key={h} style={{ ...S.rb(ctx.heterogeneite === h), textAlign: "left" as const }} onClick={() => setCtx(p => ({ ...p, heterogeneite: h }))}>{h}</div>
                  ))}
                </div>
              </div>
            ) : ctx.type_accompagnement === "individuel" ? (
              <div style={S.field}>
                <label style={S.label}>Comment décririez-vous le niveau de motivation du·de la jeune actuellement ?</label>
                <div style={{ ...S.rg, flexDirection: "column" }}>
                  {[
                    "Plutôt motivé·e et engagé·e",
                    "Motivation fluctuante selon les séances",
                    "Peu motivé·e, difficulté à s'engager",
                  ].map(h => (
                    <div key={h} style={{ ...S.rb(ctx.heterogeneite === h), textAlign: "left" as const }} onClick={() => setCtx(p => ({ ...p, heterogeneite: h }))}>{h}</div>
                  ))}
                </div>
              </div>
            ) : null}

            <div style={S.nav}>
              <div />
              <button style={{ ...S.btn1, ...(canStep0 ? {} : S.dis) }} disabled={!canStep0} onClick={() => setStep(1)}>Suivant →</button>
            </div>
          </div>
        )}

        {/* ═══════ STEP 1 : ÉVALUATION ═══════ */}
        {step === 1 && (
          <div>
            <h1 style={S.title}>Évaluation des 9 clés</h1>
            <p style={S.sub}>Pour chaque affirmation, indiquez dans quelle mesure elle correspond à la réalité de votre accompagnement.</p>

            {CLES.map(cle => {
              const qs = questions.map((q, i) => ({ ...q, idx: i })).filter(q => q.cle === cle.id);
              return (
                <div key={cle.id} style={{ marginBottom: "24px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 800, color: cle.color, marginBottom: "8px" }}>
                    {cle.emoji} {cle.nom} <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: "11px" }}>({cle.besoin})</span>
                  </div>
                  {qs.map(q => (
                    <div key={q.idx} style={S.qCard}>
                      <div style={S.qText}>{q.q}</div>
                      <div style={S.scaleRow}>
                        {ECHELLE.map(e => (
                          <div key={e.value} style={S.scaleBtn(answers[q.idx] === e.value, e.value === 0)} onClick={() => setAnswers(p => ({ ...p, [q.idx]: e.value }))}>
                            {e.label}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {/* Precision button */}
                  {!showPrecision[cle.id] ? (
                    <button style={S.precisionBtn} onClick={() => setShowPrecision(p => ({ ...p, [cle.id]: true }))}>
                      + Ajouter une précision
                    </button>
                  ) : (
                    <textarea
                      style={S.precisionTa}
                      placeholder={PRECISION_PLACEHOLDERS[cle.id]}
                      value={precisions[cle.id] || ""}
                      onChange={e => setPrecisions(p => ({ ...p, [cle.id]: e.target.value }))}
                    />
                  )}
                </div>
              );
            })}

            {/* Champ libre final */}
            <div style={{ marginTop: "24px", paddingTop: "20px", borderTop: "1px dashed var(--line-strong)" }}>
              <label style={{ ...S.label, fontSize: "14px" }}>Autre chose à préciser ?</label>
              <textarea
                style={{ ...S.precisionTa, minHeight: "100px" }}
                placeholder="Une situation particulière, une question, un doute ?"
                value={champLibre}
                onChange={e => setChampLibre(e.target.value)}
              />
            </div>

            <div style={S.nav}>
              <button style={S.btn2} onClick={() => setStep(0)}>← Retour</button>
              <button style={{ ...S.btn1, ...(canStep1 && !loading ? {} : S.dis) }} disabled={!canStep1 || loading} onClick={handleSubmit}>
                {loading ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        width: "14px",
                        height: "14px",
                        border: "2px solid rgba(255,255,255,0.3)",
                        borderTopColor: "white",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                    Analyse en cours…
                  </span>
                ) : (
                  "🔍 Lancer le diagnostic"
                )}
              </button>
            </div>

            {/* Bloc d'attente pédagogique pendant la génération */}
            {loading && (
              <div
                style={{
                  marginTop: "20px",
                  padding: "20px 24px",
                  borderRadius: "14px",
                  background: "#fef9e7",
                  borderLeft: "4px solid #FCC33E",
                  fontSize: "13px",
                  color: "var(--anthracite, #2B3442)",
                  lineHeight: 1.6,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: "16px",
                      height: "16px",
                      border: "2px solid rgba(0,152,157,0.2)",
                      borderTopColor: "#00989D",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite",
                    }}
                  />
                  Diagnostic en cours…
                </div>
                <div style={{ opacity: 0.8, fontSize: "12px" }}>
                  Elle s'appuie sur le corpus pédagogique Lit uP et les outils de la BAO pour vous proposer des pistes adaptées. Cela peut prendre 20 à 40 secondes.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════ STEP 2 : RÉSULTATS ═══════ */}
        {step === 2 && (
          <div>
            <h1 style={S.title}>Résultats du diagnostic</h1>

            {/* Points d'appui */}
            {results.filter(r => r.zone === "appui").length > 0 && (
              <div style={S.card}>
                <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#059669", marginBottom: "14px" }}>🟢 Vos points d'appui</h2>
                <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "14px" }}>Ces clés sont des forces dans votre accompagnement. Cultivez-les !</p>
                {results.filter(r => r.zone === "appui").map(r => (
                  <div key={r.id}>
                    <div style={S.zoneCard("appui")}>
                      <div style={{ fontSize: "14px", fontWeight: 700 }}>{r.emoji} {r.nom} <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 400 }}>({r.besoin})</span></div>
                    </div>
                    <div style={S.contributionBox}>
                      <p style={{ fontSize: "12px", color: "#059669", fontWeight: 600, marginBottom: "6px" }}>💡 Qu'est-ce qui, selon vous, a permis cela ? Votre retour aidera d'autres professionnels.</p>
                      <textarea
                        style={{ ...S.precisionTa, minHeight: "60px", background: "white" }}
                        placeholder={`Qu'est-ce qui nourrit ${r.nom.toLowerCase()} dans votre accompagnement ?`}
                        value={contributions[r.id] || ""}
                        onChange={e => setContributions(p => ({ ...p, [r.id]: e.target.value }))}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* À explorer */}
            {results.filter(r => r.zone === "explorer").length > 0 && (
              <div style={S.card}>
                <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#d97706", marginBottom: "14px" }}>🟡 À explorer</h2>
                <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "14px" }}>Ces clés sont dans une zone intermédiaire ou floue. Elles méritent une observation plus attentive.</p>
                {results.filter(r => r.zone === "explorer").map(r => (
                  <div key={r.id} style={S.zoneCard("explorer")}>
                    <div style={{ fontSize: "14px", fontWeight: 700 }}>{r.emoji} {r.nom} <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 400 }}>({r.besoin})</span></div>
                  </div>
                ))}
              </div>
            )}

            {/* À travailler */}
            {results.filter(r => r.zone === "travailler").length > 0 && (
              <div style={S.card}>
                <h2 style={{ fontSize: "16px", fontWeight: 800, color: "#dc2626", marginBottom: "14px" }}>🔴 À travailler</h2>
                <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "14px" }}>Ces clés sont identifiées comme des axes d'amélioration. L'analyse ci-dessous propose des pistes concrètes.</p>
                {results.filter(r => r.zone === "travailler").map(r => (
                  <div key={r.id} style={S.zoneCard("travailler")}>
                    <div style={{ fontSize: "14px", fontWeight: 700 }}>{r.emoji} {r.nom} <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: 400 }}>({r.besoin})</span></div>
                  </div>
                ))}
              </div>
            )}

            {/* Analyse IA */}
            {analysisText && (
              <div style={S.card}>
                <h2 style={{ fontSize: "16px", fontWeight: 800, color: "var(--anthracite)", marginBottom: "6px" }}>💡 Analyse personnalisée</h2>
                <p style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.5, margin: "0 0 16px" }}>
                  Analyse générée par une IA en version bêta : elle peut se tromper. Lisez-la avec votre regard de professionnel et gardez votre esprit critique.
                </p>
                <div
                  className="analysis-content"
                  style={{ fontSize: "14px", lineHeight: 1.7, color: "var(--anthracite)" }}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(analysisText) }}
                />

                {/* Boutons : Sauvegarder + Trouver les outils adaptés */}
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "20px" }}>
                  <button
                    onClick={saveAnalysisToSupabase}
                    disabled={!!savedAnalysisId || saving}
                    style={{
                      padding: "11px 20px",
                      background: savedAnalysisId ? "#16a34a" : saving ? "var(--muted, #9ca3af)" : "var(--anthracite, #2B3442)",
                      color: "white",
                      borderRadius: "24px",
                      border: "none",
                      fontSize: "13px",
                      fontWeight: 700,
                      cursor: savedAnalysisId ? "default" : (saving ? "wait" : "pointer"),
                      fontFamily: "inherit",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    {savedAnalysisId
                      ? "✓ Sauvegardé dans Mon espace"
                      : saving
                      ? "Sauvegarde…"
                      : "💾 Sauvegarder l'analyse"}
                  </button>

                  <Link
                    href={`/bao?mode=cles&alertes=${encodeURIComponent(results.filter(r => r.zone === "travailler").map(r => r.nom).join(","))}&atelier=${encodeURIComponent(ctx.nom_atelier || "")}`}
                    style={{
                      padding: "11px 20px",
                      background: "var(--canard, #00989D)",
                      color: "white",
                      borderRadius: "24px",
                      fontSize: "13px",
                      fontWeight: 700,
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    🔑 Trouver les outils adaptés
                  </Link>
                </div>
                {saveError && (
                  <div style={{ color: "#dc2626", fontSize: "13px", marginTop: "8px" }}>
                    {saveError}
                  </div>
                )}
              </div>
            )}

            {/* Chat */}
            <div style={S.chatBox}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
                <h2 style={{ fontSize: "16px", fontWeight: 800, color: "var(--anthracite)", margin: 0 }}>💬 Approfondir avec l'IA</h2>
                <p style={{ fontSize: "12px", color: "var(--muted)", margin: "4px 0 0" }}>Posez vos questions pour creuser le diagnostic</p>
              </div>
              <div style={S.chatMsgs}>
                {chatMessages.slice(1).map((m, i) => <div key={i} style={S.bubble(m.role === "user")}>{m.content}</div>)}
                {chatLoading && <div style={{ ...S.bubble(false), opacity: 0.6 }}>En train de réfléchir...</div>}
                <div ref={chatEndRef} />
              </div>
              <div style={S.chatIn}>
                <input type="text" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleChat()}
                  placeholder="Comment améliorer la clé Sens ?" style={{ flex: 1, padding: "10px 14px", borderRadius: "20px", border: "2px solid var(--line-strong)", fontFamily: "inherit", fontSize: "13px" }} />
                <button onClick={handleChat} disabled={chatLoading || !chatInput.trim()} style={{ ...S.btn1, padding: "10px 20px" }}>Envoyer</button>
              </div>
            </div>

            {/* Restart */}
            <div style={{ marginTop: "24px", textAlign: "center" }}>
              <button style={S.btn2} onClick={() => { setStep(0); setAnswers({}); setPrecisions({}); setShowPrecision({}); setChampLibre(""); setResults([]); setAnalysisText(""); setChatMessages([]); setContributions({}); }}>
                🔄 Refaire un diagnostic
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
