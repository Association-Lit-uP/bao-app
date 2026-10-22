"use client";

// app/bao/diagnostiquer/page.tsx (v3)
// Page de cadrage des outils de diagnostic motivation.
// Récupère depuis Supabase toutes les fiches marquées `is_diagnostic_tool = true`
// et les affiche dans une grille 2×2 avec leur contexte d'usage,
// + une 4ème carte "Auto-diagnostic" (hardcodée, badge BÊTA) qui mène à /bao/diagnostic-pro.
//
// 🆕 v3 : clic sur une carte ouvre la FicheModal (comme dans la BAO classique)
// au lieu d'une route /bao/fiche/[slug] inexistante.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getFiches,
  getClesByFiche,
  getEtapeById,
  getObjectifsByFiche,
  type Fiche,
  type Cle,
  type Etape,
  type Objectif,
} from "@/lib/supabase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import AppHeader from "@/components/AppHeader";
import FicheModal from "@/components/FicheModal";
import { Search, BarChart3, Clock, Users, User, type LucideIcon } from "lucide-react";

interface FicheWithMeta extends Fiche {
  fichesCles: Cle[];
  etape: Etape | null;
}

export default function DiagnostiquerPage() {
  const router = useRouter();
  const { userId, isAdmin } = useCurrentUser();
  const [tools, setTools] = useState<FicheWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFiche, setSelectedFiche] = useState<FicheWithMeta | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const allFiches = await getFiches();
        // Filtrer les fiches de diagnostic publiées
        const diagFiches = allFiches.filter((f: any) => f.is_diagnostic_tool === true && f.publie === true);

        // Trier par diagnostic_tool_order (NULL en dernier), puis par nom
        diagFiches.sort((a: any, b: any) => {
          const oa = a.diagnostic_tool_order;
          const ob = b.diagnostic_tool_order;
          if (oa == null && ob == null) return a.nom.localeCompare(b.nom);
          if (oa == null) return 1;
          if (ob == null) return -1;
          return oa - ob;
        });

        // Charger les relations (clés + étape) pour chaque fiche, comme dans bao/page.tsx
        const fichesWithMeta: FicheWithMeta[] = await Promise.all(
          diagFiches.map(async (f) => {
            const [ficheCles, etape] = await Promise.all([
              getClesByFiche(f.id),
              f.etape_id ? getEtapeById(f.etape_id) : Promise.resolve(null),
            ]);
            return { ...f, fichesCles: ficheCles, etape };
          })
        );
        setTools(fichesWithMeta);
      } catch (e) {
        console.error("Erreur chargement outils diagnostic:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // L'auto-diagnostic est ouvert en version bêta : la page affiche son propre avertissement
  function handleAutoDiagnostic() {
    router.push("/bao/diagnostic-pro");
  }

  return (
    <>
      <AppHeader searchQuery="" onSearchChange={() => {}} />
      <main style={{ background: "var(--blanc)", minHeight: "calc(100vh - 64px)", padding: "32px 28px" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
          {/* Breadcrumb */}
          <div style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "14px" }}>
            <Link href="/bao" style={{ color: "var(--canard)", textDecoration: "none", fontWeight: 600 }}>← BAO</Link>
            <span style={{ margin: "0 8px", color: "var(--muted)" }}>›</span>
            <span style={{ color: "var(--canard)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "5px" }}>
              <Search size={13} strokeWidth={2.5} /> Diagnostiquer la motivation
            </span>
          </div>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <h1 style={{ fontSize: "30px", fontWeight: 800, color: "var(--anthracite)", marginBottom: "8px", letterSpacing: "-0.02em" }}>
              Comment diagnostiquer la motivation ?
            </h1>
            <p style={{ fontSize: "15px", color: "var(--muted)", maxWidth: "640px", margin: "0 auto", lineHeight: 1.5 }}>
              {tools.length > 0
                ? `${tools.length + 1} outils complémentaires. Choisissez celui qui convient à votre contexte.`
                : "Choisissez l'approche qui convient à votre contexte."
              }
            </p>
          </div>

          {/* État de chargement */}
          {loading && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)" }}>
              Chargement des outils…
            </div>
          )}

          {/* État vide */}
          {!loading && tools.length === 0 && (
            <div style={{ background: "#fff8e1", border: "1.5px solid #FCC33E", borderRadius: "12px", padding: "20px 24px", marginBottom: "24px" }}>
              <strong style={{ color: "var(--anthracite)" }}>⚠️ Aucun outil de diagnostic trouvé.</strong>
              <p style={{ fontSize: "13px", color: "var(--anthracite)", marginTop: "6px" }}>
                Va dans l&apos;admin et coche &quot;Outil de diagnostic&quot; sur les fiches concernées
                (débriefing, questionnaire, entretien).
              </p>
            </div>
          )}

          {/* Grille 2×2 */}
          {!loading && (
            <div className="diag-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "18px", marginBottom: "28px" }}>
              {tools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} onOpen={() => setSelectedFiche(tool)} />
              ))}
              {/* 4ème carte hardcodée : Auto-diagnostic */}
              <AutoDiagCard onClick={handleAutoDiagnostic} />
            </div>
          )}

          {/* Bandeau d'analyse */}
          <Link
            href="/bao/analyse"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              background: "linear-gradient(135deg, #FCC33E 0%, #f0a500 100%)",
              borderRadius: "14px",
              padding: "20px 28px",
              color: "var(--anthracite)",
              textDecoration: "none",
              boxShadow: "0 4px 14px rgba(252, 195, 62, 0.2)",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 18px rgba(252, 195, 62, 0.28)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 14px rgba(252, 195, 62, 0.2)";
            }}
          >
            <BarChart3 size={36} strokeWidth={2} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "16px", fontWeight: 800, marginBottom: "3px" }}>
                Diagnostic déjà réalisé ?
              </div>
              <div style={{ fontSize: "13px", opacity: 0.85, lineHeight: 1.4 }}>
                Saisissez les résultats pour obtenir une analyse personnalisée et des pistes d&apos;outils adaptés à votre groupe.
              </div>
            </div>
            <div style={{
              background: "var(--anthracite)",
              color: "white",
              padding: "10px 22px",
              borderRadius: "10px",
              fontSize: "14px",
              fontWeight: 700,
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}>
              Analyser →
            </div>
          </Link>
        </div>

        {/* Responsive : 1 colonne sur mobile */}
        <style>{`
          @media (max-width: 720px) {
            .diag-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>

        {/* 🆕 Modale fiche outil (comme dans la BAO classique) */}
        {selectedFiche && (
          <FicheModalWrapper
            fiche={selectedFiche}
            cles={selectedFiche.fichesCles}
            etape={selectedFiche.etape}
            onClose={() => setSelectedFiche(null)}
            userId={userId}
            isAdmin={isAdmin}
          />
        )}
      </main>
    </>
  );
}

/* ═══════════════════════════════════════════
   COMPOSANTS
   ═══════════════════════════════════════════ */

/** Wrapper qui charge les objectifs BAO de la fiche puis affiche la modale.
 *  Identique au pattern utilisé dans app/bao/page.tsx. */
function FicheModalWrapper({ fiche, cles, etape, onClose, userId, isAdmin }: {
  fiche: FicheWithMeta;
  cles: Cle[];
  etape: Etape | null;
  onClose: () => void;
  userId: string | null;
  isAdmin: boolean;
}) {
  const [objectifsBao, setObjectifsBao] = useState<Objectif[]>([]);
  useEffect(() => {
    getObjectifsByFiche(fiche.id).then(setObjectifsBao);
  }, [fiche.id]);
  return (
    <FicheModal
      fiche={fiche}
      cles={cles}
      etape={etape}
      onClose={onClose}
      userId={userId}
      isAdmin={isAdmin}
      objectifsBao={objectifsBao}
    />
  );
}

function ToolCard({ tool, onOpen }: { tool: FicheWithMeta; onOpen: () => void }) {
  const t = tool as any;
  // Construit les chips à partir des champs disponibles
  const chips: Array<{ icon: LucideIcon; label: string }> = [];
  if (t.duree_libre) chips.push({ icon: Clock, label: t.duree_libre });
  if (t.format) {
    if (t.format.toLowerCase().includes("collectif")) chips.push({ icon: Users, label: "Collectif" });
    else if (t.format.toLowerCase().includes("individuel")) chips.push({ icon: User, label: "Individuel" });
  }

  return (
    <div
      onClick={onOpen}
      style={{
        background: "white",
        border: "2px solid var(--line)",
        borderRadius: "16px",
        padding: "22px 22px",
        cursor: "pointer",
        transition: "all 0.2s",
        display: "flex",
        flexDirection: "column",
        minHeight: "260px",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--canard)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 16px rgba(0, 152, 157, 0.1)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--line)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLElement).style.boxShadow = "none";
      }}
    >
      {/* En-tête avec emoji + titre */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "14px" }}>
        <div style={{
          width: "52px", height: "52px",
          background: "#f0fafa",
          borderRadius: "14px",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "28px", flexShrink: 0,
        }}>
          {t.emoji || "🔍"}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "17px", fontWeight: 800, color: "var(--anthracite)", lineHeight: 1.2, marginBottom: "3px" }}>
            {tool.nom}
          </div>
          {t.intention && (
            <div style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.4 }}>
              {t.intention}
            </div>
          )}
        </div>
      </div>

      {/* Chips contextuels */}
      {chips.length > 0 && (
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
          {chips.map((chip, i) => {
            const Icon = chip.icon;
            return (
              <span key={i} style={{
                background: "#f6f6f8",
                color: "#374151",
                padding: "3px 9px",
                borderRadius: "6px",
                fontSize: "11px",
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}>
                <Icon size={11} strokeWidth={2.5} /> {chip.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Quand l'utiliser */}
      <div style={{
        background: "#f9fafb",
        borderRadius: "10px",
        padding: "10px 14px",
        marginBottom: "14px",
        flex: 1,
      }}>
        <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--canard)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
          Quand l&apos;utiliser
        </div>
        <div style={{ fontSize: "12.5px", color: "var(--anthracite)", lineHeight: 1.5 }}>
          {t.contexte_usage_diagnostic || "Contexte d'usage à renseigner via l'admin."}
        </div>
      </div>

      {/* CTA */}
      <div style={{
        background: "var(--canard)",
        color: "white",
        padding: "8px 14px",
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: 700,
        alignSelf: "flex-start",
      }}>
        Ouvrir la fiche →
      </div>
    </div>
  );
}

function AutoDiagCard({ onClick }: { onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "#fafafa",
        border: "2px dashed #6B2468",
        borderRadius: "16px",
        padding: "22px 22px",
        cursor: "pointer",
        transition: "all 0.2s",
        display: "flex",
        flexDirection: "column",
        minHeight: "260px",
        opacity: 0.88,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.opacity = "1";
        (e.currentTarget as HTMLElement).style.background = "#f7f0f7";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.opacity = "0.88";
        (e.currentTarget as HTMLElement).style.background = "#fafafa";
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "14px" }}>
        <div style={{
          width: "52px", height: "52px",
          background: "#f7f0f7",
          borderRadius: "14px",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "28px", flexShrink: 0,
        }}>
          🤔
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "17px", fontWeight: 800, color: "#6B2468", lineHeight: 1.2 }}>
              Auto-diagnostic du pro
            </span>
            <span style={{
              fontSize: "9px", fontWeight: 700,
              background: "#6B2468", color: "white",
              padding: "2px 6px", borderRadius: "5px",
              textTransform: "uppercase", letterSpacing: "0.3px",
            }}>Bêta</span>
          </div>
          <div style={{ fontSize: "12px", color: "var(--muted)", lineHeight: 1.4 }}>
            Analyse à partir de vos observations
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
        <span style={{ background: "#f6f6f8", color: "#374151", padding: "3px 9px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
          <Clock size={11} strokeWidth={2.5} /> 10-15 min
        </span>
        <span style={{ background: "#f6f6f8", color: "#374151", padding: "3px 9px", borderRadius: "6px", fontSize: "11px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
          <User size={11} strokeWidth={2.5} /> Pro seul·e
        </span>
      </div>

      <div style={{
        background: "#f7f0f7",
        borderRadius: "10px",
        padding: "10px 14px",
        marginBottom: "14px",
        flex: 1,
      }}>
        <div style={{ fontSize: "10px", fontWeight: 700, color: "#6B2468", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
          Quand l&apos;utiliser
        </div>
        <div style={{ fontSize: "12.5px", color: "var(--anthracite)", lineHeight: 1.5 }}>
          Pour poser des premières hypothèses avant de solliciter directement les jeunes, ou quand ils ne sont pas disponibles.
        </div>
      </div>

      <div style={{
        background: "#6B2468",
        color: "white",
        padding: "8px 16px",
        borderRadius: "8px",
        fontSize: "13px",
        fontWeight: 700,
        alignSelf: "flex-start",
      }}>
        Commencer l&apos;auto-diagnostic →
      </div>
    </div>
  );
}
