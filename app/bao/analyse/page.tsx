"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { supabase, authHeaders } from "@/lib/supabase";
import AppHeader from "@/components/AppHeader";

/* ── Constantes ── */
const CLES = [
  { nom: "Sens", emoji: "🧭", couleur: "#00989D" },
  { nom: "Liberté", emoji: "🕊️", couleur: "#9a4e97" },
  { nom: "Plaisir", emoji: "🎉", couleur: "#FCC33E" },
  { nom: "Action", emoji: "⚡", couleur: "#2B3442" },
  { nom: "Progression", emoji: "📈", couleur: "#FCC33E" },
  { nom: "Utilité", emoji: "🎯", couleur: "#00989D" },
  { nom: "Sécurité", emoji: "🌿", couleur: "#007479" },
  { nom: "Considération", emoji: "💎", couleur: "#6B2468" },
  { nom: "Confiance", emoji: "🤝", couleur: "#6B2468" },
  { nom: "Batterie", emoji: "🔋", couleur: "#4a5568" },
];

const COULEURS_JETONS = {
  ponctuelle: { rose: "Pas vraiment", jaune: "Je ne sais pas", bleu: "Plutôt oui", vert: "Oui tout à fait" },
  parcours: { rose: "Rarement", jaune: "De temps en temps", bleu: "La plupart du temps", vert: "Toujours" },
};

const MATERIELS = ["Jetons", "Gommettes", "Feutres", "Questionnaire individuel", "Autre"];

type TypeEval = "ponctuelle" | "parcours";
type Scores = Record<string, number>; // 0-100

interface Analyse {
  scores: Scores;
  forces: string[];
  neutres: string[];
  attention: string[];
  critiques: string[];
  actions: string[];
}

function getZone(score: number): { label: string; color: string } {
  if (score >= 70) return { label: "Zone de force", color: "#16a34a" };
  if (score >= 50) return { label: "Zone neutre", color: "#ca8a04" };
  if (score >= 30) return { label: "Zone d'attention", color: "#ea580c" };
  return { label: "Zone critique", color: "#dc2626" };
}

function getColorHex(internalKey: "rose" | "jaune" | "bleu" | "vert", customLabel: string): string {
  const defaults = { rose: "#f472b6", jaune: "#fbbf24", bleu: "#2563eb", vert: "#16a34a" };
  const colorMap: Record<string, string> = {
    marron: "#92400e", brun: "#78350f",
    rouge: "#ef4444", "rouge foncé": "#b91c1c",
    orange: "#f97316",
    jaune: "#fbbf24",
    rose: "#f472b6",
    violet: "#7c3aed", mauve: "#a855f7", pourpre: "#9333ea",
    bleu: "#2563eb", "bleu foncé": "#1e40af", "bleu clair": "#60a5fa",
    vert: "#16a34a", "vert foncé": "#166534", "vert clair": "#86efac",
    noir: "#374151",
    blanc: "#d1d5db",
    gris: "#9ca3af",
    turquoise: "#0d9488",
    cyan: "#06b6d4",
  };
  return colorMap[customLabel.toLowerCase().trim()] || defaults[internalKey];
}

function computeAnalyse(scores: Scores): Analyse {
  const forces: string[] = [];
  const neutres: string[] = [];
  const attention: string[] = [];
  const critiques: string[] = [];
  const actions: string[] = [];

  Object.entries(scores).forEach(([cle, score]) => {
    if (score >= 70) forces.push(cle);
    else if (score >= 50) neutres.push(cle);
    else if (score >= 30) attention.push(cle);
    else critiques.push(cle);
  });

  // Règle A : identifier les forces
  if (forces.length > 0) {
    actions.push(`Identifier ce qui a permis les bons résultats sur ${forces.join(", ")} pour le continuer ou le reconduire.`);
  }

  // Règle B : points d'attention
  const alerteB = ["Utilité", "Action", "Progression", "Plaisir", "Batterie"].filter(
    (c) => scores[c] !== undefined && scores[c] < 50
  );
  if (alerteB.length > 0) {
    actions.push(`Réajuster la prochaine séance pour améliorer : ${alerteB.join(", ")}.`);
  }

  // Écart Plaisir / Sens
  if (scores["Plaisir"] !== undefined && scores["Sens"] !== undefined) {
    if (Math.abs(scores["Plaisir"] - scores["Sens"]) > 25) {
      actions.push("Écart important entre Plaisir et Sens : vérifier l'équilibre entre l'aspect ludique et la compréhension des objectifs.");
    }
  }

  // Écart Liberté / Action
  if (scores["Liberté"] !== undefined && scores["Action"] !== undefined) {
    if (Math.abs(scores["Liberté"] - scores["Action"]) > 25) {
      actions.push("Écart important entre Liberté et Action : accompagner davantage le passage à l'action ou permettre plus de choix.");
    }
  }

  // Règle C : réadaptation importante
  const alerteC = ["Sécurité", "Considération", "Liberté", "Sens"].filter(
    (c) => scores[c] !== undefined && scores[c] < 30
  );
  if (alerteC.length > 0) {
    actions.push(`Réadaptation importante du programme nécessaire : ${alerteC.join(", ")} en zone critique.`);
  }

  const sous50 = Object.entries(scores).filter(([, s]) => s < 50);
  if (sous50.length > 3) {
    actions.push(`Plus de 3 clés sous 50% (${sous50.length}) : envisager une refonte significative du programme.`);
  }

  return { scores, forces, neutres, attention, critiques, actions };
}

/* ── Composant Radar SVG ── */
function RadarChart({ scores }: { scores: Scores }) {
  const keys = CLES.filter((c) => scores[c.nom] !== undefined);
  const n = keys.length;
  if (n < 3) return null;

  const cx = 250, cy = 250, maxR = 160;
  const angleStep = (2 * Math.PI) / n;

  function polarToXY(angle: number, radius: number) {
    return {
      x: cx + radius * Math.sin(angle),
      y: cy - radius * Math.cos(angle),
    };
  }

  // Grilles concentriques (30, 50, 70, 100%)
  const gridLevels = [
    { pct: 30, color: "#fecaca", label: "" },
    { pct: 50, color: "#fed7aa", label: "" },
    { pct: 70, color: "#fef08a", label: "" },
    { pct: 100, color: "#e0f3f4", label: "" },
  ];

  function gridPath(pct: number) {
    return keys.map((_, i) => {
      const p = polarToXY(i * angleStep, maxR * (pct / 100));
      return `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`;
    }).join(" ") + " Z";
  }

  const dataPath = keys.map((k, i) => {
    const score = scores[k.nom] || 0;
    const p = polarToXY(i * angleStep, maxR * (score / 100));
    return `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`;
  }).join(" ") + " Z";

  return (
    <svg viewBox="0 0 500 500" style={{ width: "100%", maxWidth: "500px", margin: "0 auto", display: "block" }}>
      {/* Zone backgrounds (drawn in reverse order so smallest is on top) */}
      {[...gridLevels].reverse().map((g) => (
        <path key={g.pct} d={gridPath(g.pct)} fill={g.color} fillOpacity={0.3} stroke="none" />
      ))}

      {/* Grid lines */}
      {gridLevels.map((g) => (
        <path key={`line-${g.pct}`} d={gridPath(g.pct)} fill="none" stroke="#d1d5db" strokeWidth={0.5} strokeDasharray={g.pct === 100 ? "none" : "4 2"} />
      ))}

      {/* Spokes */}
      {keys.map((_, i) => {
        const p = polarToXY(i * angleStep, maxR);
        return <line key={`spoke-${i}`} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#d1d5db" strokeWidth={0.5} />;
      })}

      {/* Data area */}
      <path d={dataPath} fill="rgba(0, 152, 157, 0.25)" stroke="#00989D" strokeWidth={2.5} />

      {/* Data points */}
      {keys.map((k, i) => {
        const score = scores[k.nom] || 0;
        const p = polarToXY(i * angleStep, maxR * (score / 100));
        return <circle key={`pt-${i}`} cx={p.x} cy={p.y} r={4} fill="#00989D" stroke="white" strokeWidth={2} />;
      })}

      {/* Labels */}
      {keys.map((k, i) => {
        const p = polarToXY(i * angleStep, maxR + 35);
        return (
          <text
            key={`label-${i}`}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ fontSize: "11px", fontWeight: 700, fill: "#2B3442" }}
          >
            {k.emoji} {k.nom}
          </text>
        );
      })}

      {/* Zone legend - bottom right */}
      <g transform={`translate(${cx + maxR - 20}, ${cy + maxR + 25})`}>
        <rect x={-5} y={-8} width={130} height={60} rx={6} fill="white" fillOpacity={0.9} stroke="#d1d5db" strokeWidth={0.5} />
        <circle cx={8} cy={4} r={4} fill="#16a34a" /><text x={18} y={8} style={{ fontSize: "9px", fill: "#16a34a" }}>Force (&gt;70%)</text>
        <circle cx={8} cy={18} r={4} fill="#ca8a04" /><text x={18} y={22} style={{ fontSize: "9px", fill: "#ca8a04" }}>Neutre (50-70%)</text>
        <circle cx={8} cy={32} r={4} fill="#ea580c" /><text x={18} y={36} style={{ fontSize: "9px", fill: "#ea580c" }}>Attention (30-50%)</text>
        <circle cx={8} cy={46} r={4} fill="#dc2626" /><text x={18} y={50} style={{ fontSize: "9px", fill: "#dc2626" }}>Critique (&lt;30%)</text>
      </g>
    </svg>
  );
}

/* ── Page principale ── */
export default function AnalysePage() {
  const [searchQuery, setSearchQuery] = useState("");

  // Étape 1 : Infos
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [nomAtelier, setNomAtelier] = useState("");
  const [dateAtelier, setDateAtelier] = useState("");
  const [nbJeunes, setNbJeunes] = useState("");
  const [typeEval, setTypeEval] = useState<TypeEval>("ponctuelle");
  const [materiel, setMateriel] = useState("Jetons");
  const [codeRespect, setCodeRespect] = useState(true);
  const [customColorLabels, setCustomColorLabels] = useState<Record<string, string>>({
    rose: "", jaune: "", bleu: "", vert: "",
  });
  const [aiAnalyzed, setAiAnalyzed] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Étape 2 : Scores
  const [mode, setMode] = useState<"photo" | "manuel">("manuel");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiError, setAiError] = useState("");
  const [manualScores, setManualScores] = useState<Record<string, { rose: number; jaune: number; bleu: number; vert: number }>>(() => {
    const init: Record<string, { rose: number; jaune: number; bleu: number; vert: number }> = {};
    CLES.forEach((c) => { init[c.nom] = { rose: 0, jaune: 0, bleu: 0, vert: 0 }; });
    return init;
  });

  // Étape 3 : Résultats
  const [analyse, setAnalyse] = useState<Analyse | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setUserId(session.user.id);
    });
  }, []);

  const legende = COULEURS_JETONS[typeEval];

  function getAlertes(scores: Scores): string[] {
    return Object.entries(scores).filter(([, s]) => s < 50).map(([cle]) => cle);
  }

  async function saveAnalyse(analyseData: Analyse) {
    if (!userId) {
      setAiError("Vous devez être connecté pour sauvegarder. Rendez-vous dans Mon espace pour vous connecter.");
      return;
    }
    if (saved) return;
    setSaving(true);
    setAiError("");
    const alertes = getAlertes(analyseData.scores);
    const payload = {
      user_id: userId,
      nom_atelier: nomAtelier.trim() || null,
      date_atelier: dateAtelier || null,
      nb_jeunes: nbJeunes ? parseInt(nbJeunes) : null,
      type_eval: typeEval,
      materiel: materiel,
      scores: analyseData.scores,
      scores_detail: manualScores,
      alertes: alertes,
    };
    console.log("Sauvegarde analyse:", payload);
    const { data, error } = await supabase.from("analyses").insert(payload).select("id").single();
    if (error) {
      console.error("Erreur sauvegarde:", error);
      setAiError(`Erreur de sauvegarde : ${error.message}`);
    } else {
      console.log("Analyse sauvegardée:", data);
      setSaved(true);
    }
    setSaving(false);
  }

  function computeScoresFromManual(): Scores {
    const scores: Scores = {};
    Object.entries(manualScores).forEach(([cle, counts]) => {
      const total = counts.rose + counts.jaune + counts.bleu + counts.vert;
      if (total === 0) return;
      // Pondération fixe par position : rose(1er)=0, jaune(2e)=33, bleu(3e)=66, vert(4e)=100
      // Les couleurs physiques peuvent changer mais l'ordre des colonnes reste le même
      const weighted = (counts.rose * 0 + counts.jaune * 33 + counts.bleu * 66 + counts.vert * 100) / total;
      scores[cle] = Math.round(weighted);
    });
    return scores;
  }

  function generateTextReport(a: Analyse): string {
    const dateStr = dateAtelier ? new Date(dateAtelier).toLocaleDateString("fr-FR") : null;
    const header = [
      "BILAN DU BAROMÈTRE DE L'ENGAGEMENT",
      [nomAtelier, dateStr, nbJeunes ? `${nbJeunes} jeunes` : null, typeEval === "ponctuelle" ? "Évaluation ponctuelle" : "Évaluation de parcours"]
        .filter(Boolean).join(" — "),
    ].filter(Boolean).join("\n");

    const lignesScores = CLES
      .filter((c) => a.scores[c.nom] !== undefined)
      .map((c) => {
        const s = a.scores[c.nom];
        const zone = s >= 70 ? "Force" : s >= 50 ? "Neutre" : s >= 30 ? "Attention" : "Critique";
        return `  ${c.emoji} ${c.nom} : ${s}% (${zone})`;
      })
      .join("\n");

    const sections: string[] = [header, `\nSCORES PAR CLÉ\n${lignesScores}`];

    if (a.forces.length > 0)
      sections.push(`\nPOINTS FORTS (≥ 70%)\n  ${a.forces.map((f) => CLES.find((c) => c.nom === f)?.emoji + " " + f).join(", ")}`);
    if (a.neutres.length > 0)
      sections.push(`ZONES NEUTRES (50-69%)\n  ${a.neutres.map((f) => CLES.find((c) => c.nom === f)?.emoji + " " + f).join(", ")}`);
    if (a.attention.length > 0)
      sections.push(`ZONES D'ATTENTION (30-49%)\n  ${a.attention.map((f) => CLES.find((c) => c.nom === f)?.emoji + " " + f).join(", ")}`);
    if (a.critiques.length > 0)
      sections.push(`ZONES CRITIQUES (< 30%)\n  ${a.critiques.map((f) => CLES.find((c) => c.nom === f)?.emoji + " " + f).join(", ")}`);
    if (a.actions.length > 0)
      sections.push(`\nPISTES D'ACTION\n${a.actions.map((act) => `  - ${act}`).join("\n")}`);

    return sections.join("\n");
  }

  function handleCopyReport() {
    if (!analyse) return;
    navigator.clipboard.writeText(generateTextReport(analyse)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  function handleManualSubmit() {
    const scores = computeScoresFromManual();
    if (Object.keys(scores).length < 3) {
      setAiError("Renseignez au moins 3 clés pour générer le radar.");
      return;
    }
    setAiError("");
    setAnalyse(computeAnalyse(scores));
    setStep(3);
  }

  const handleImageChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }, []);

  function compressImage(dataUrl: string, maxSizeMB: number = 4): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        const maxDim = 2048;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.85;
        let result = canvas.toDataURL("image/jpeg", quality);
        while (result.length * 0.75 > maxSizeMB * 1024 * 1024 && quality > 0.3) {
          quality -= 0.1;
          result = canvas.toDataURL("image/jpeg", quality);
        }
        resolve(result);
      };
      img.src = dataUrl;
    });
  }

  async function handlePhotoAnalyze() {
    if (!imageFile || !imagePreview) return;
    setAnalyzing(true);
    setAiError("");

    try {
      const compressed = await compressImage(imagePreview);
      const base64 = compressed.split(",")[1];
      const mediaType = "image/jpeg";

      // Utiliser les noms de couleurs réels visibles sur la photo
      const c1 = (!codeRespect && customColorLabels.rose) ? customColorLabels.rose : "rose";
      const c2 = (!codeRespect && customColorLabels.jaune) ? customColorLabels.jaune : "jaune";
      const c3 = (!codeRespect && customColorLabels.bleu) ? customColorLabels.bleu : "bleu";
      const c4 = (!codeRespect && customColorLabels.vert) ? customColorLabels.vert : "vert";
      const jsonTemplate = `{"Sens":{"${c1}":0,"${c2}":0,"${c3}":0,"${c4}":0},"Liberté":{"${c1}":0,"${c2}":0,"${c3}":0,"${c4}":0},"Plaisir":{"${c1}":0,"${c2}":0,"${c3}":0,"${c4}":0},"Action":{"${c1}":0,"${c2}":0,"${c3}":0,"${c4}":0},"Progression":{"${c1}":0,"${c2}":0,"${c3}":0,"${c4}":0},"Utilité":{"${c1}":0,"${c2}":0,"${c3}":0,"${c4}":0},"Sécurité":{"${c1}":0,"${c2}":0,"${c3}":0,"${c4}":0},"Considération":{"${c1}":0,"${c2}":0,"${c3}":0,"${c4}":0},"Confiance":{"${c1}":0,"${c2}":0,"${c3}":0,"${c4}":0},"Batterie":{"${c1}":0,"${c2}":0,"${c3}":0,"${c4}":0}}`;

      const contextePhysique = (() => {
        const m = materiel.toLowerCase();
        const unite = m.replace(/s$/, "");
        const couleurs = `${c1}, ${c2}, ${c3}, ${c4}`;
        const nb = nbJeunes || "?";
        if (m === "jetons") return `- Il y a 10 cartes blanches disposées en grille avec un titre en majuscules (SENS, LIBERTÉ, PLAISIR, ACTION, PROGRESSION, UTILITÉ, SÉCURITÉ, CONSIDÉRATION, CONFIANCE, BATTERIE).
- Sur chaque carte sont posés directement des jetons ronds colorés (${couleurs}).
- Il y a ${nb} participants. Chaque participant a déposé 1 jeton par carte.
- Compte les jetons de chaque couleur directement sur chaque carte.`;
        if (m === "gommettes") return `- Il y a 10 cartes blanches disposées en grille avec un titre en majuscules (SENS, LIBERTÉ, PLAISIR, ACTION, PROGRESSION, UTILITÉ, SÉCURITÉ, CONSIDÉRATION, CONFIANCE, BATTERIE).
- Sur chaque carte est posé un post-it (de n'importe quelle couleur).
- Sur chaque post-it se trouvent de petites gommettes rondes colorées (${couleurs}).
- Il y a ${nb} participants. Chaque participant a collé 1 gommette par post-it.
- Compte les gommettes de chaque couleur sur le post-it de chaque carte. Ignore la couleur du post-it lui-même.`;
        if (m === "feutres") return `- Il y a 10 cartes blanches disposées en grille avec un titre en majuscules (SENS, LIBERTÉ, PLAISIR, ACTION, PROGRESSION, UTILITÉ, SÉCURITÉ, CONSIDÉRATION, CONFIANCE, BATTERIE).
- À côté de chaque carte se trouve une feuille blanche avec des marques de feutres (croix ou ronds) de différentes couleurs (${couleurs}).
- Il y a ${nb} participants. Chaque participant a tracé 1 marque par feuille.
- Compte les marques de feutres de chaque couleur sur la feuille associée à chaque carte.`;
        return `- Il y a 10 cartes ou zones avec un titre (SENS, LIBERTÉ, PLAISIR, ACTION, PROGRESSION, UTILITÉ, SÉCURITÉ, CONSIDÉRATION, CONFIANCE, BATTERIE).
- Pour chaque carte/zone, des indicateurs de 4 couleurs (${couleurs}) représentent les réponses de ${nb} participants.
- Compte le nombre d'indicateurs de chaque couleur pour chaque carte/zone.`;
      })();

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 2000,
          messages: [{
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64 },
              },
              {
                type: "text",
                text: `Tu dois analyser un baromètre de l'engagement (matériel : ${materiel}).

CONTEXTE PHYSIQUE :
${contextePhysique}

INSTRUCTIONS :
1. Identifie chaque carte par son titre visible.
2. Pour chaque carte, compte soigneusement le nombre d'éléments de chaque couleur.
3. Si une carte est partiellement masquée, fais de ton mieux avec ce qui est visible.

Réponds UNIQUEMENT en JSON valide, sans texte avant ni après, sans backticks, avec ce format exact :
${jsonTemplate}`
              },
            ],
          }],
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Erreur serveur ${response.status}`);
      const text = data.content?.map((c: any) => c.text || "").join("") || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("Aucun JSON trouvé dans la réponse");
      const rawParsed = JSON.parse(jsonMatch[0]) as Record<string, Record<string, number>>;

      // Remapper les clés couleur personnalisées → clés internes (rose/jaune/bleu/vert = positions 1-4)
      const parsed: Record<string, { rose: number; jaune: number; bleu: number; vert: number }> = {};
      Object.entries(rawParsed).forEach(([cle, counts]) => {
        parsed[cle] = {
          rose: counts[c1] ?? 0,
          jaune: counts[c2] ?? 0,
          bleu: counts[c3] ?? 0,
          vert: counts[c4] ?? 0,
        };
      });

      // Convertir en scores
      setManualScores(parsed);
      const scores: Scores = {};
      Object.entries(parsed).forEach(([cle, counts]) => {
        const total = counts.rose + counts.jaune + counts.bleu + counts.vert;
        if (total === 0) return;
        const weighted = (counts.rose * 0 + counts.jaune * 33 + counts.bleu * 66 + counts.vert * 100) / total;
        scores[cle] = Math.round(weighted);
      });

      if (Object.keys(scores).length < 3) {
        setAiError("L'analyse n'a pas pu identifier suffisamment de données. Essayez la saisie manuelle.");
        setAnalyzing(false);
        return;
      }

      // Basculer en mode manuel pré-rempli pour vérification avant de générer l'analyse
      setMode("manuel");
      setAiAnalyzed(true);
    } catch (err) {
      console.error("Erreur analyse IA:", err);
      setAiError("Erreur lors de l'analyse. Vérifiez la qualité de l'image ou essayez la saisie manuelle.");
    } finally {
      setAnalyzing(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "10px 14px", border: "2px solid var(--line-strong)", borderRadius: "10px",
    fontSize: "14px", fontFamily: "inherit", color: "var(--anthracite)", outline: "none", boxSizing: "border-box", background: "white",
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--blanc)" }}>
      <AppHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      <div className="fiche-content" style={{ maxWidth: "760px", margin: "0 auto", padding: "40px 28px 80px" }}>
        <button onClick={() => window.history.back()} style={{ color: "var(--canard)", textDecoration: "none", fontSize: "14px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px", marginBottom: "28px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
          ← Retour
        </button>

        <div style={{ marginBottom: "32px" }}>
          <h1 style={{ fontSize: "32px", fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.1, color: "var(--anthracite)", margin: "0 0 8px" }}>
            📊 Analyser les résultats
          </h1>
          <p style={{ fontSize: "15px", lineHeight: 1.6, color: "var(--muted)", margin: 0 }}>
            Décryptez les résultats du baromètre de l'engagement pour identifier les leviers de motivation à renforcer et les points d'attention à traiter.
          </p>
        </div>

        {/* Bandeau intro : outils de diagnostic */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--anthracite)", marginBottom: "16px" }}>
            Pour analyser les résultats, il faut avoir au préalable réalisé un diagnostic de la motivation grâce à l&apos;un de ces outils.
          </div>

          {/* Bloc bleu : Diagnostic AVEC les jeunes */}
          <div style={{ background: "#f0fafa", border: "2px solid #00989D", borderRadius: "16px", padding: "20px 24px", marginBottom: "16px" }}>
            <div style={{ fontSize: "14px", fontWeight: 800, color: "#00989D", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              👥 Diagnostic AVEC les jeunes
            </div>
            <div style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "12px" }}>
              Recueillir leur ressenti directement, c&apos;est le plus pertinent et le plus fiable.
            </div>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <Link href="/bao/debriefing-d-atelier-avec-les-cles-de-la-motivation?from=analyse" style={{ fontSize: "13px", fontWeight: 600, color: "var(--canard)", textDecoration: "none", padding: "8px 14px", background: "white", borderRadius: "10px", border: "1.5px solid var(--line)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                🎯 Débriefing en collectif
              </Link>
              <Link href="/bao/questionnaire-post-atelier-barometre-de-la-motivation?from=analyse" style={{ fontSize: "13px", fontWeight: 600, color: "var(--canard)", textDecoration: "none", padding: "8px 14px", background: "white", borderRadius: "10px", border: "1.5px solid var(--line)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                📋 Questionnaire
              </Link>
              <Link href="/bao/entretien-individuel-cles-dengagement?from=analyse" style={{ fontSize: "13px", fontWeight: 600, color: "var(--canard)", textDecoration: "none", padding: "8px 14px", background: "white", borderRadius: "10px", border: "1.5px solid var(--line)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                💬 Entretien individuel
              </Link>
            </div>
          </div>

          {/* Bloc violet : Auto-diagnostic */}
          <div style={{ background: "#f7f0f7", border: "2px solid #6B2468", borderRadius: "16px", padding: "20px 24px" }}>
            <div style={{ fontSize: "14px", fontWeight: 800, color: "#6B2468", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              📋 Auto-diagnostic
            </div>
            <div style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "12px" }}>
              Trouver des premières pistes, avant de solliciter les jeunes directement, à partir de tes propres observations.
            </div>
            <button
              onClick={() => alert("🚧 Cette fonctionnalité est en cours de développement.\n\nElle te permettra bientôt de trouver des premières pistes à partir de tes propres observations, avant de solliciter les jeunes directement.")}
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#9ca3af",
                padding: "8px 14px",
                background: "#f3f4f6",
                borderRadius: "10px",
                border: "1.5px dashed #d1d5db",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              📋 Auto-diagnostic du pro
              <span style={{ fontSize: "10px", fontWeight: 700, background: "#6B2468", color: "white", padding: "2px 6px", borderRadius: "6px", marginLeft: "4px" }}>
                EN COURS
              </span>
            </button>
          </div>
        </div>

        {/* Stepper */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "32px" }}>
          {[1, 2, 3].map((s) => (
            <div key={s} style={{ flex: 1, height: "4px", borderRadius: "2px", background: step >= s ? "var(--canard)" : "var(--line)", transition: "background 0.3s" }} />
          ))}
        </div>

        {/* ═══ ÉTAPE 1 : Infos ═══ */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--anthracite)" }}>Informations sur la séance</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={labelStyle}>Nom de l'atelier</label>
                <input type="text" value={nomAtelier} onChange={(e) => setNomAtelier(e.target.value)} placeholder="Ex : Brise-glace Antisava" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" value={dateAtelier} onChange={(e) => setDateAtelier(e.target.value)} style={inputStyle} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={labelStyle}>Nombre de jeunes</label>
                <input type="number" value={nbJeunes} onChange={(e) => setNbJeunes(e.target.value)} placeholder="8" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Matériel utilisé</label>
                <select value={materiel} onChange={(e) => setMateriel(e.target.value)} style={inputStyle}>
                  {MATERIELS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Type d'évaluation</label>
              <div style={{ display: "flex", gap: "12px" }}>
                {(["ponctuelle", "parcours"] as TypeEval[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeEval(t)}
                    style={{
                      flex: 1, padding: "12px", borderRadius: "12px", cursor: "pointer", fontFamily: "inherit",
                      border: `2px solid ${typeEval === t ? "var(--canard)" : "var(--line)"}`,
                      background: typeEval === t ? "#e0f3f4" : "white",
                      color: "var(--anthracite)", fontWeight: 600, fontSize: "14px",
                    }}
                  >
                    {t === "ponctuelle" ? "🎯 Évaluer un atelier" : "📅 Évaluer un parcours"}
                  </button>
                ))}
              </div>
            </div>

            {/* Légende couleurs */}
            <div style={{ padding: "16px 20px", borderRadius: "12px", background: "white", border: "2px solid var(--line)" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--muted)", marginBottom: "10px" }}>
                Légende des couleurs
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
                {Object.entries(legende).map(([couleur, label]) => (
                  <div key={couleur} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
                    <span style={{ width: "12px", height: "12px", borderRadius: "50%", flexShrink: 0, background: couleur === "rose" ? "#f472b6" : couleur === "jaune" ? "#fbbf24" : couleur === "bleu" ? "#60a5fa" : "#4ade80" }} />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px", color: "var(--anthracite)" }}>
                <input type="checkbox" checked={codeRespect} onChange={(e) => setCodeRespect(e.target.checked)} />
                Le code couleur a été respecté par les participants
              </label>
            </div>

            {!codeRespect && (
              <div style={{ padding: "16px 20px", borderRadius: "12px", background: "#fff7ed", border: "2px solid #fed7aa" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#ea580c", marginBottom: "10px" }}>
                  Indiquez quelle couleur a été utilisée pour chaque niveau
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
                  {Object.entries(legende).map(([couleurOrigine, label]) => (
                    <div key={couleurOrigine} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--anthracite)", flex: 1 }}>{label}</span>
                      <span style={{ fontSize: "12px", color: "var(--muted)" }}>→</span>
                      <input
                        type="text"
                        value={customColorLabels[couleurOrigine] || ""}
                        onChange={(e) => setCustomColorLabels((prev) => ({ ...prev, [couleurOrigine]: e.target.value }))}
                        placeholder={couleurOrigine}
                        style={{ ...inputStyle, width: "120px", padding: "6px 10px", fontSize: "13px" }}
                      />
                    </div>
                  ))}
                </div>
                <p style={{ fontSize: "12px", color: "var(--muted)", margin: "8px 0 0", fontStyle: "italic" }}>
                  Ex : si les participants ont utilisé du noir à la place du rose, écrivez « noir » en face de « {legende.rose} »
                </p>
              </div>
            )}

            <button
              onClick={() => setStep(2)}
              style={{ padding: "12px 28px", background: "var(--canard)", color: "white", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", alignSelf: "flex-start" }}
            >
              Continuer →
            </button>
          </div>
        )}

        {/* ═══ ÉTAPE 2 : Saisie ═══ */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--anthracite)" }}>Saisir les résultats</div>

            {/* Mode toggle */}
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => setMode("manuel")} style={{ flex: 1, padding: "10px", borderRadius: "10px", border: `2px solid ${mode === "manuel" ? "var(--canard)" : "var(--line)"}`, background: mode === "manuel" ? "#e0f3f4" : "white", fontFamily: "inherit", fontWeight: 600, fontSize: "13px", cursor: "pointer", color: "var(--anthracite)" }}>
                ✏️ Saisie manuelle
              </button>
              <button onClick={() => setMode("photo")} style={{ flex: 1, padding: "10px", borderRadius: "10px", border: `2px solid ${mode === "photo" ? "var(--canard)" : "var(--line)"}`, background: mode === "photo" ? "#e0f3f4" : "white", fontFamily: "inherit", fontWeight: 600, fontSize: "13px", cursor: "pointer", color: "var(--anthracite)" }}>
                📸 Analyser une photo
              </button>
            </div>

            {mode === "manuel" ? (
              <>
                {aiAnalyzed && (
                  <div style={{ background: "#eff6ff", border: "2px solid #bfdbfe", borderRadius: "12px", padding: "12px 16px", fontSize: "13px", color: "#1d4ed8", display: "flex", gap: "10px", alignItems: "flex-start" }}>
                    <span style={{ fontSize: "18px", flexShrink: 0 }}>🤖</span>
                    <div>
                      <strong>Résultats détectés par l'IA</strong> — Vérifiez et corrigez les comptes ci-dessous si nécessaire (notamment pour distinguer les couleurs proches), puis cliquez sur "Générer l'analyse".
                    </div>
                  </div>
                )}

                <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
                  Pour chaque clé, indiquez le nombre de {materiel.toLowerCase()} de chaque couleur.
                </p>

                {/* Header */}
                <div style={{ display: "grid", gridTemplateColumns: "140px repeat(4, 1fr)", gap: "6px", alignItems: "center" }}>
                  <div />
                  {(["rose", "jaune", "bleu", "vert"] as const).map((key) => {
                    const label = (!codeRespect && customColorLabels[key]) ? customColorLabels[key] : key;
                    const hex = getColorHex(key, label);
                    return (
                      <div key={key} style={{ textAlign: "center", fontSize: "11px", fontWeight: 700, color: hex, display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                        <span style={{ display: "inline-block", width: "12px", height: "12px", borderRadius: "50%", background: hex, flexShrink: 0 }} />
                        {label.charAt(0).toUpperCase() + label.slice(1)}
                      </div>
                    );
                  })}
                </div>

                {CLES.map((cle) => (
                  <div key={cle.nom} style={{ display: "grid", gridTemplateColumns: "140px repeat(4, 1fr)", gap: "6px", alignItems: "center" }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--anthracite)", display: "flex", alignItems: "center", gap: "4px" }}>
                      {cle.emoji} {cle.nom}
                    </div>
                    {(["rose", "jaune", "bleu", "vert"] as const).map((couleur) => (
                      <input
                        key={couleur}
                        type="number"
                        min={0}
                        value={manualScores[cle.nom]?.[couleur] || ""}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setManualScores((prev) => ({ ...prev, [cle.nom]: { ...prev[cle.nom], [couleur]: val } }));
                        }}
                        style={{ ...inputStyle, textAlign: "center", padding: "8px 4px", fontSize: "15px", fontWeight: 700 }}
                      />
                    ))}
                  </div>
                ))}

                {aiError && <div style={{ color: "#dc2626", fontSize: "13px" }}>{aiError}</div>}

                <div style={{ display: "flex", gap: "12px" }}>
                  <button onClick={() => { setStep(1); setAiAnalyzed(false); }} style={{ padding: "10px 20px", background: "white", border: "2px solid var(--line-strong)", borderRadius: "12px", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "var(--anthracite)" }}>
                    ← Retour
                  </button>
                  <button onClick={handleManualSubmit} style={{ padding: "10px 28px", background: "var(--canard)", color: "white", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    Générer l'analyse →
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
                  Prenez en photo le baromètre (jetons, gommettes ou résultats papier). L'IA analysera l'image pour compter les résultats.
                </p>

                <label
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file && (file.type.startsWith("image/") || file.type === "application/pdf")) {
                      setImageFile(file);
                      const reader = new FileReader();
                      reader.onload = () => setImagePreview(reader.result as string);
                      reader.readAsDataURL(file);
                    }
                  }}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "12px",
                    padding: "40px 20px",
                    border: `2px dashed ${dragOver ? "var(--canard)" : "var(--line-strong)"}`,
                    borderRadius: "14px",
                    cursor: "pointer",
                    background: dragOver ? "#f0fafa" : "white",
                    transition: "all 0.2s",
                  }}
                >
                  {imagePreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imagePreview} alt="Aperçu" style={{ maxHeight: "280px", borderRadius: "10px", objectFit: "contain" }} />
                  ) : (
                    <>
                      <span style={{ fontSize: "40px" }}>{dragOver ? "📥" : "📸"}</span>
                      <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--anthracite)" }}>
                        {dragOver ? "Déposez le fichier ici" : "Cliquez ou glissez-déposez une photo"}
                      </span>
                      <span style={{ fontSize: "12px", color: "var(--muted)" }}>JPG, PNG ou PDF</span>
                    </>
                  )}
                  <input type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={handleImageChange} />
                </label>

                {aiError && <div style={{ color: "#dc2626", fontSize: "13px" }}>{aiError}</div>}

                <div style={{ display: "flex", gap: "12px" }}>
                  <button onClick={() => setStep(1)} style={{ padding: "10px 20px", background: "white", border: "2px solid var(--line-strong)", borderRadius: "12px", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "var(--anthracite)" }}>
                    ← Retour
                  </button>
                  <button
                    onClick={handlePhotoAnalyze}
                    disabled={!imageFile || analyzing}
                    style={{ padding: "10px 28px", background: analyzing ? "var(--muted)" : "var(--canard)", color: "white", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 700, cursor: analyzing ? "wait" : "pointer", fontFamily: "inherit" }}
                  >
                    {analyzing ? "Analyse en cours…" : "Analyser la photo →"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ ÉTAPE 3 : Résultats ═══ */}
        {step === 3 && analyse && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <div style={{ fontSize: "22px", fontWeight: 800, color: "var(--anthracite)" }}>
                  {nomAtelier || "Résultats du baromètre"}
                </div>
                <div style={{ fontSize: "13px", color: "var(--muted)" }}>
                  {dateAtelier && `${new Date(dateAtelier).toLocaleDateString("fr-FR")} · `}{nbJeunes && `${nbJeunes} jeunes · `}{typeEval === "ponctuelle" ? "Évaluation ponctuelle" : "Évaluation de parcours"}
                </div>
              </div>
              <button onClick={() => { setStep(2); setAnalyse(null); }} style={{ padding: "8px 16px", background: "white", border: "2px solid var(--line-strong)", borderRadius: "10px", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", color: "var(--anthracite)" }}>
                ← Modifier les données
              </button>
            </div>

            {/* Radar */}
            <div style={{ background: "white", borderRadius: "16px", border: "2px solid var(--line)", padding: "24px" }}>
              <RadarChart scores={analyse.scores} />
            </div>

            {/* Scores détaillés */}
            <div style={{ background: "white", borderRadius: "14px", border: "2px solid var(--line)", padding: "4px 0" }}>
              {CLES.filter((c) => analyse.scores[c.nom] !== undefined).map((cle, i) => {
                const score = analyse.scores[cle.nom];
                const zone = getZone(score);
                return (
                  <div key={cle.nom} style={{ padding: "12px 18px", borderBottom: i < CLES.length - 1 ? "1px solid var(--line)" : "none", display: "flex", alignItems: "center", gap: "12px" }}>
                    <span style={{ fontSize: "20px" }}>{cle.emoji}</span>
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--anthracite)", flex: 1 }}>{cle.nom}</span>
                    <div style={{ width: "100px", height: "8px", borderRadius: "4px", background: "var(--line)", position: "relative", overflow: "hidden" }}>
                      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${score}%`, borderRadius: "4px", background: zone.color, transition: "width 0.5s" }} />
                    </div>
                    <span style={{ fontSize: "14px", fontWeight: 800, color: zone.color, minWidth: "40px", textAlign: "right" }}>{score}%</span>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: zone.color, minWidth: "100px" }}>{zone.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Synthèse */}
            {analyse.forces.length > 0 && (
              <div style={{ padding: "16px 20px", borderRadius: "12px", background: "#f0fdf4", borderLeft: "4px solid #16a34a" }}>
                <div style={{ fontSize: "14px", fontWeight: 800, color: "#16a34a", marginBottom: "6px" }}>🌟 Points forts</div>
                <div style={{ fontSize: "14px", color: "var(--anthracite)", lineHeight: 1.5 }}>
                  {analyse.forces.map((f) => CLES.find((c) => c.nom === f)?.emoji + " " + f).join(", ")}
                </div>
              </div>
            )}

            {analyse.attention.length > 0 && (
              <div style={{ padding: "16px 20px", borderRadius: "12px", background: "#fff7ed", borderLeft: "4px solid #ea580c" }}>
                <div style={{ fontSize: "14px", fontWeight: 800, color: "#ea580c", marginBottom: "6px" }}>⚠️ Points d'attention</div>
                <div style={{ fontSize: "14px", color: "var(--anthracite)", lineHeight: 1.5 }}>
                  {analyse.attention.map((f) => CLES.find((c) => c.nom === f)?.emoji + " " + f).join(", ")}
                </div>
              </div>
            )}

            {analyse.critiques.length > 0 && (
              <div style={{ padding: "16px 20px", borderRadius: "12px", background: "#fef2f2", borderLeft: "4px solid #dc2626" }}>
                <div style={{ fontSize: "14px", fontWeight: 800, color: "#dc2626", marginBottom: "6px" }}>🚨 Zones critiques</div>
                <div style={{ fontSize: "14px", color: "var(--anthracite)", lineHeight: 1.5 }}>
                  {analyse.critiques.map((f) => CLES.find((c) => c.nom === f)?.emoji + " " + f).join(", ")}
                </div>
              </div>
            )}

            {/* Actions */}
            {analyse.actions.length > 0 && (
              <div style={{ padding: "20px 24px", borderRadius: "14px", background: "#e0f3f4", borderLeft: "4px solid var(--canard)" }}>
                <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--canard-dark)", marginBottom: "12px" }}>🎯 Actions à mettre en place</div>
                {analyse.actions.map((action, i) => (
                  <div key={i} style={{ fontSize: "14px", color: "var(--anthracite)", lineHeight: 1.5, padding: "6px 0 6px 20px", position: "relative" }}>
                    <span style={{ position: "absolute", left: "4px", top: "12px", width: "6px", height: "6px", borderRadius: "50%", background: "var(--canard)" }} />
                    {action}
                  </div>
                ))}
              </div>
            )}

            {/* Sauvegarder + Copier + Liens */}
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button
                onClick={handleCopyReport}
                style={{
                  padding: "11px 20px", background: copied ? "#16a34a" : "white",
                  color: copied ? "white" : "var(--canard)", borderRadius: "24px",
                  border: `2px solid ${copied ? "#16a34a" : "var(--canard)"}`,
                  fontSize: "13px", fontWeight: 700, cursor: "pointer",
                  fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: "8px",
                  transition: "all 0.2s",
                }}
              >
                {copied ? "✓ Bilan copié !" : "📋 Copier le bilan"}
              </button>
              {userId && (
                <button
                  onClick={() => analyse && saveAnalyse(analyse)}
                  disabled={saved || saving}
                  style={{
                    padding: "11px 20px", background: saved ? "#16a34a" : saving ? "var(--muted)" : "var(--anthracite)",
                    color: "white", borderRadius: "24px", border: "none",
                    fontSize: "13px", fontWeight: 700, cursor: saved ? "default" : "pointer",
                    fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: "8px",
                  }}
                >
                  {saved ? "✓ Sauvegardé dans Mon espace" : saving ? "Sauvegarde…" : "💾 Sauvegarder l'analyse"}
                </button>
              )}
              {!userId && (
                <Link href="/mon-espace" style={{
                  padding: "11px 20px", background: "var(--anthracite)", color: "white", borderRadius: "24px",
                  fontSize: "13px", fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px",
                }}>
                  🔐 Se connecter pour sauvegarder
                </Link>
              )}
              <Link href={`/bao?mode=cles&alertes=${encodeURIComponent((analyse ? Object.entries(analyse.scores).filter(([, s]) => s < 50).map(([c]) => c).join(",") : ""))}&atelier=${encodeURIComponent(nomAtelier || "")}`} style={{
                padding: "11px 20px", background: "var(--canard)", color: "white", borderRadius: "24px",
                fontSize: "13px", fontWeight: 700, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "8px",
              }}>
                🔑 Trouver les outils adaptés
              </Link>
              <Link href="/bao/cles-motivation" style={{
                padding: "11px 20px", background: "white", color: "var(--canard)", borderRadius: "24px",
                fontSize: "13px", fontWeight: 700, textDecoration: "none", border: "2px solid var(--canard)",
                display: "inline-flex", alignItems: "center", gap: "8px",
              }}>
                📖 Comprendre les clés
              </Link>
            </div>
            {aiError && <div style={{ color: "#dc2626", fontSize: "13px", marginTop: "8px" }}>{aiError}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "13px", fontWeight: 700, color: "var(--anthracite)", marginBottom: "6px",
};
