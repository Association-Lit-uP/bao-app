"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  getFiches,
  getCles,
  getEtapes,
  getObjectifs,
  getObjectifsFichesMap,
  getObjectifsByFiche,
  getClesByFiche,
  getEtapeById,
  type Fiche,
  type Cle,
  type Etape,
  type Objectif,
} from "@/lib/supabase";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { logEvent } from "@/lib/analytics";
import AppHeader from "@/components/AppHeader";
import Sidebar, { DUREE_TRANCHES, parseDureeLibreToMinutes } from "@/components/Sidebar";
import FicheCard from "@/components/FicheCard";
import FicheModal from "@/components/FicheModal";
import WelcomeModal from "@/components/WelcomeModal";
import { Search } from "lucide-react";

interface FicheWithMeta extends Fiche {
  fichesCles: Cle[];
  etape: Etape | null;
}

type ViewMode = "objectifs" | "cles";

export default function BaoPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [fiches, setFiches] = useState<FicheWithMeta[]>([]);
  const [cles, setCles] = useState<Cle[]>([]);
  const [etapes, setEtapes] = useState<Etape[]>([]);
  const [objectifs, setObjectifs] = useState<Objectif[]>([]);
  const [objectifsFichesMap, setObjectifsFichesMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFormats, setActiveFormats] = useState<string[]>([]);
  const [activeDurees, setActiveDurees] = useState<number[]>([]);
  const [activMateriels, setActivMateriels] = useState<string[]>([]);
  const [activeCles, setActiveCles] = useState<string[]>([]);
  const [activeObjectifIds, setActiveObjectifIds] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<"name" | "duration">("name");

  const [activeObjectif, setActiveObjectif] = useState<Objectif | null>(null);
  const [objectifsVisible, setObjectifsVisible] = useState(true);
  const [showDiagnosticOverlay, setShowDiagnosticOverlay] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("objectifs");

  const [selectedFiche, setSelectedFiche] = useState<FicheWithMeta | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);

  const { userId, favorisIds, updateFavori, isAdmin } = useCurrentUser();

  const [alertesCles, setAlertesCles] = useState<string[]>([]);
  const [alerteAtelier, setAlerteAtelier] = useState("");

  // Lire le mode et les alertes depuis l'URL
  useEffect(() => {
    const mode = searchParams.get("mode");
    const alertes = searchParams.get("alertes");
    const atelier = searchParams.get("atelier");
    if (mode === "cles") {
      setViewMode("cles");
      setObjectifsVisible(true);
    }
    if (alertes) {
      const cleNames = alertes.split(",").filter(Boolean);
      setAlertesCles(cleNames);
      // Auto-sélectionner les clés en alerte
      // On doit attendre que les clés soient chargées
      setViewMode("cles");
      setObjectifsVisible(true);
    }
    if (atelier) setAlerteAtelier(decodeURIComponent(atelier));
  }, [searchParams]);

  useEffect(() => {
    try {
      const seen = sessionStorage.getItem("bao_welcome_seen");
      if (!seen) setShowWelcome(true);
    } catch {}
  }, []);

  function closeWelcome() {
    setShowWelcome(false);
    try { sessionStorage.setItem("bao_welcome_seen", "1"); } catch {}
  }

  const loadData = useCallback(async () => {
    try {
      const [fichesData, clesData, etapesData, objectifsData, objFichesMap] = await Promise.all([
        getFiches(), getCles(), getEtapes(), getObjectifs(), getObjectifsFichesMap(),
      ]);
      const fichesWithMeta = await Promise.all(
        fichesData.map(async (f) => {
          const [ficheCles, etape] = await Promise.all([
            getClesByFiche(f.id),
            f.etape_id ? getEtapeById(f.etape_id) : Promise.resolve(null),
          ]);
          return { ...f, fichesCles: ficheCles, etape };
        })
      );
      setFiches(fichesWithMeta);
      setCles(clesData);
      setEtapes(etapesData);
      setObjectifs(objectifsData);
      setObjectifsFichesMap(objFichesMap);

      // Auto-sélectionner les clés en alerte depuis l'URL
      const alertesParam = new URLSearchParams(window.location.search).get("alertes");
      if (alertesParam && clesData.length > 0) {
        const cleNames = alertesParam.split(",").filter(Boolean);
        const matchedIds = clesData
          .filter((c: any) => cleNames.some((name) => c.nom.toLowerCase().includes(name.toLowerCase())))
          .map((c: any) => c.id);
        if (matchedIds.length > 0) setActiveCles(matchedIds);
      }
    } catch (err) {
      console.error("Erreur chargement données:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Au retour par le bouton « Précédent », le navigateur peut restaurer la page
  // depuis son cache (bfcache) sans rejouer les effets : on recharge alors les
  // données pour voir les fiches modifiées entre-temps dans l'admin.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) loadData(); };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [loadData]);

  /* ── Objectif selection (mode objectifs) ── */
  const selectObjectif = (obj: Objectif) => {
    if (obj.ordre === 1) {
      setShowDiagnosticOverlay(true);
      return;
    }
    setActiveObjectif(activeObjectif?.id === obj.id ? null : obj);
  };
  const clearObjectif = () => setActiveObjectif(null);

  const activeFicheIdsByObjectif = useMemo(() => {
    if (!activeObjectif) return null;
    return objectifsFichesMap[activeObjectif.id] || [];
  }, [activeObjectif, objectifsFichesMap]);

  /* ── Objectif filter (mode cles, sidebar) ── */
  const activeFicheIdsByObjectifFilter = useMemo(() => {
    if (activeObjectifIds.length === 0) return null;
    const ids = new Set<string>();
    activeObjectifIds.forEach((objId) => {
      (objectifsFichesMap[objId] || []).forEach((fId) => ids.add(fId));
    });
    return Array.from(ids);
  }, [activeObjectifIds, objectifsFichesMap]);

  /* ── Diagnostic overlay actions ── */
  /** Choix "Faire le diagnostic" : redirige directement vers /bao/diagnostiquer
   *  qui présente les 3 outils + l'auto-diag en grille 2×2 avec leur contexte d'usage.
   *  (La modale intermédiaire "Avec les jeunes / Auto-diagnostic" a été supprimée :
   *   elle était redondante avec la grille de la nouvelle page.) */
  const handleDiagFaireLeTest = () => {
    setShowDiagnosticOverlay(false);
    router.push("/bao/diagnostiquer");
  };
  const handleDiagTrouverOutils = () => {
    setActiveObjectif(null);
    setActiveCles([]);
    setActiveObjectifIds([]);
    setViewMode("cles");
    setObjectifsVisible(true);
    setShowDiagnosticOverlay(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const handleBackToObjectifs = () => {
    setViewMode("objectifs");
    setActiveCles([]);
    setActiveObjectifIds([]);
  };

  /* ── Derived filter data ── */
  const formats = useMemo(() => {
    const s = new Set<string>();
    fiches.forEach((f) => {
      if (!f.format) return;
      const fmt = f.format.toLowerCase();
      if (fmt.includes("collectif")) s.add("Collectif");
      if (fmt.includes("individuel")) s.add("Individuel");
    });
    return Array.from(s).sort();
  }, [fiches]);

  const materiels = useMemo(() => {
    const s = new Set<string>();
    fiches.forEach((f) => { if (f.materiel) s.add(f.materiel); });
    return Array.from(s).sort();
  }, [fiches]);

  const fichesCountByObjectif = useMemo(() => {
    const c: Record<string, number> = {};
    const publishedIds = new Set(fiches.map((f) => f.id));
    objectifs.forEach((obj) => {
      const ids = objectifsFichesMap[obj.id] || [];
      c[obj.id] = ids.filter((id) => publishedIds.has(id)).length;
    });
    return c;
  }, [objectifs, objectifsFichesMap, fiches]);

  const fichesCountByCle = useMemo(() => {
    const c: Record<string, number> = {};
    fiches.forEach((f) => f.fichesCles.forEach((k) => { c[k.id] = (c[k.id] || 0) + 1; }));
    return c;
  }, [fiches]);

  /* ── Filtering ── */
  const filtered = useMemo(() => {
    let r = fiches.filter((f) => {
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || f.nom.toLowerCase().includes(q) || (f.intention || "").toLowerCase().includes(q) || (f.pourquoi || "").toLowerCase().includes(q) || (f.materiel || "").toLowerCase().includes(q) || (f.source || "").toLowerCase().includes(q) || JSON.stringify(f.objectifs || "").toLowerCase().includes(q) || JSON.stringify(f.deroule || "").toLowerCase().includes(q) || JSON.stringify(f.conseils || "").toLowerCase().includes(q) || JSON.stringify(f.variantes || "").toLowerCase().includes(q) || f.fichesCles.some((c) => c.nom.toLowerCase().includes(q));
      let matchFormat = true;
      if (activeFormats.length > 0) {
        if (!f.format) { matchFormat = false; }
        else { const fmt = f.format.toLowerCase(); matchFormat = activeFormats.some((af) => fmt.includes(af.toLowerCase())); }
      }
      // Mode objectifs : filtre par objectif sélectionné en haut
      const matchObjectifCard = activeFicheIdsByObjectif === null || activeFicheIdsByObjectif.includes(f.id);
      // Mode cles : filtre par objectif dans la sidebar
      const matchObjectifSidebar = activeFicheIdsByObjectifFilter === null || activeFicheIdsByObjectifFilter.includes(f.id);
      // Clés : en mode cles, filtre par clé sélectionnée en haut
      const matchCle = activeCles.length === 0 || f.fichesCles.some((c) => activeCles.includes(c.id));
      const matchMateriel = activMateriels.length === 0 || (f.materiel && activMateriels.includes(f.materiel));
      let matchDuree = true;
      if (activeDurees.length > 0) {
        const dureeVal = f.duree_min || parseDureeLibreToMinutes(f.duree_libre) || 0;
        if (dureeVal === 0) { matchDuree = false; }
        else { matchDuree = activeDurees.some((idx) => { const t = DUREE_TRANCHES[idx]; return dureeVal >= t.min && dureeVal <= t.max; }); }
      }
      return matchSearch && matchFormat && matchObjectifCard && matchObjectifSidebar && matchCle && matchMateriel && matchDuree;
    });
    if (sortBy === "duration") {
      r = [...r].sort((a, b) => {
        const da = a.duree_min || parseDureeLibreToMinutes(a.duree_libre) || 999;
        const db = b.duree_min || parseDureeLibreToMinutes(b.duree_libre) || 999;
        return da - db;
      });
    } else { r = [...r].sort((a, b) => a.nom.localeCompare(b.nom)); }
    return r;
  }, [fiches, searchQuery, activeFormats, activeFicheIdsByObjectif, activeFicheIdsByObjectifFilter, activeCles, activMateriels, activeDurees, sortBy]);

  /* ── Journalisation des recherches (débounce) : requête + nb de résultats ── */
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) return;
    const t = setTimeout(() => {
      logEvent("search", { metadata: { query: q, results: filtered.length } });
    }, 1200);
    return () => clearTimeout(t);
  }, [searchQuery, filtered.length]);

  /* ── Toggle helpers ── */
  const toggleFormat = (f: string) => setActiveFormats((p) => p.includes(f) ? p.filter((x) => x !== f) : [...p, f]);
  const toggleDuree = (idx: number) => setActiveDurees((p) => p.includes(idx) ? p.filter((x) => x !== idx) : [...p, idx]);
  const toggleMateriel = (m: string) => setActivMateriels((p) => p.includes(m) ? p.filter((x) => x !== m) : [...p, m]);
  const toggleCle = (id: string) => setActiveCles((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const toggleObjectifFilter = (id: string) => setActiveObjectifIds((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const resetFilters = () => {
    setActiveFormats([]); setActiveDurees([]); setActivMateriels([]); setActiveCles([]);
    setActiveObjectifIds([]); setSearchQuery(""); clearObjectif();
  };

  return (
    <>
      <style>{`
        /* Le wrapper du héro est transparent en desktop : emoji, corps et CTA
           restent des enfants directs du flex du bouton (rendu inchangé). */
        .bao-hero-top { display: contents; }

        @media (max-width: 768px) {
          .bao-main-grid { grid-template-columns: 1fr !important; }
          .bao-results { padding: 16px !important; padding-bottom: 100px !important; }
          .bao-results-grid { grid-template-columns: 1fr !important; }
          .bao-top-header { flex-direction: column !important; align-items: flex-start !important; gap: 8px !important; }
          .bao-top-grid { grid-template-columns: repeat(3, 1fr) !important; gap: 8px !important; }
          .bao-top-section { padding: 16px !important; }
          .bao-results-header { flex-direction: column !important; gap: 8px !important; }
          .bao-active-bar { flex-wrap: wrap !important; padding: 12px 16px !important; }
          .diag-overlay-inner { max-width: 95vw !important; padding: 28px 20px !important; }
          .diag-cards-grid { grid-template-columns: 1fr !important; gap: 12px !important; }
          .diag-cards-grid > button,
          .diag-cards-grid > div { padding: 20px 16px !important; flex-direction: row !important; text-align: left !important; }
          .diag-cards-grid > button > span:first-child,
          .diag-cards-grid > div > span:first-child { font-size: 28px !important; }

          /* ── Héro diagnostic : empilé sur mobile ── */
          .bao-hero { flex-direction: column !important; align-items: stretch !important; gap: 16px !important; padding: 18px 18px 20px !important; }
          .bao-hero-top { display: flex !important; align-items: center !important; gap: 14px !important; }
          .bao-hero-emoji { font-size: 40px !important; }
          .bao-hero-cta { width: 100% !important; padding: 13px 18px !important; font-size: 15px !important; }
        }
        @media (max-width: 480px) {
          .bao-top-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .bao-hero-desc { font-size: 12px !important; }
        }
      `}</style>

      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--blanc)" }}>
        <AppHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} onOpenGuide={() => setShowWelcome(true)} />

        {/* ═══ Top section: Objectifs (default) or Clés de motivation ═══ */}
        {objectifsVisible && (
          <div className="bao-top-section" style={{ borderBottom: "2px solid var(--line)", background: "white", padding: "20px 28px 24px" }}>
            <div className="bao-top-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", maxWidth: "1500px", margin: "0 auto 16px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
                {viewMode === "objectifs" ? (
                  <>
                    <span style={{ fontSize: "20px", fontWeight: 800, color: "var(--anthracite)" }}>Mes objectifs</span>
                    <em style={{ fontFamily: "'Caveat', cursive", fontSize: "18px", color: "var(--jaune-accent)", fontStyle: "italic" }}>— que souhaitez-vous faire ?</em>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: "20px", fontWeight: 800, color: "var(--anthracite)" }}>Clés de motivation</span>
                    <em style={{ fontFamily: "'Caveat', cursive", fontSize: "18px", color: "var(--jaune-accent)", fontStyle: "italic" }}>— sur quel levier agir ?</em>
                    <Link href="/bao/cles-motivation" style={{ fontSize: "12px", fontWeight: 600, color: "var(--canard)", textDecoration: "none", padding: "3px 10px", border: "1.5px solid var(--canard)", borderRadius: "12px", whiteSpace: "nowrap" }}>
                      En savoir plus →
                    </Link>
                  </>
                )}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                {viewMode === "cles" && (
                  <button onClick={handleBackToObjectifs} style={{ background: "var(--canard)", border: "none", borderRadius: "16px", padding: "6px 14px", fontSize: "13px", fontWeight: 600, cursor: "pointer", color: "white", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                    ← Retour aux objectifs
                  </button>
                )}
                {viewMode === "objectifs" && activeObjectif && (
                  <button onClick={clearObjectif} style={{ background: "var(--canard)", border: "none", borderRadius: "16px", padding: "6px 14px", fontSize: "13px", fontWeight: 600, cursor: "pointer", color: "white", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                    ✕ Tous les outils
                  </button>
                )}
                {viewMode === "cles" && activeCles.length > 0 && (
                  <button onClick={() => setActiveCles([])} style={{ background: "var(--canard)", border: "none", borderRadius: "16px", padding: "6px 14px", fontSize: "13px", fontWeight: 600, cursor: "pointer", color: "white", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                    ✕ Toutes les clés
                  </button>
                )}
                <button onClick={() => setObjectifsVisible(false)} style={{ background: "transparent", border: "1.5px solid var(--line)", borderRadius: "16px", padding: "6px 14px", fontSize: "13px", fontWeight: 600, cursor: "pointer", color: "var(--muted)", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                  Masquer ▲
                </button>
              </div>
            </div>

            {viewMode === "objectifs" ? (
              /* ── Objectif 1 (héro) + Objectifs 2-7 en grille ── */
              (() => {
                const obj1 = objectifs.find((o) => o.ordre === 1);
                const autresObjs = objectifs.filter((o) => o.ordre !== 1);
                const obj1Count = obj1 ? (fichesCountByObjectif[obj1.id] || 0) : 0;
                const obj1Active = obj1 ? (activeObjectif?.id === obj1.id) : false;

                return (
                  <div style={{ maxWidth: "1500px", margin: "0 auto" }}>
                    {/* 🎯 BLOC HERO : objectif 1 (diagnostic) */}
                    {obj1 && (
                      <button
                        onClick={() => selectObjectif(obj1)}
                        className="bao-hero"
                        style={{
                          width: "100%",
                          background: obj1Active
                            ? "linear-gradient(135deg, var(--canard) 0%, #007a7e 100%)"
                            : "linear-gradient(135deg, var(--canard) 0%, #007a7e 100%)",
                          color: "white",
                          border: "none",
                          borderRadius: "16px",
                          padding: "22px 28px",
                          marginBottom: "14px",
                          cursor: "pointer",
                          fontFamily: "inherit",
                          textAlign: "left",
                          transition: "all 0.2s",
                          display: "flex",
                          alignItems: "center",
                          gap: "20px",
                          boxShadow: "0 4px 14px rgba(0, 152, 157, 0.2)",
                          position: "relative",
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                          (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 20px rgba(0, 152, 157, 0.28)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                          (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 14px rgba(0, 152, 157, 0.2)";
                        }}
                      >
                        {/* Wrapper transparent en desktop (display:contents), empilé en mobile */}
                        <div className="bao-hero-top">
                          <span className="bao-hero-emoji" style={{ fontSize: "52px", lineHeight: 1, flexShrink: 0 }}>{obj1.emoji || "🔍"}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "1px", opacity: 0.85, marginBottom: "4px" }}>
                              ÉTAPE 1 — POINT DE DÉPART
                            </div>
                            <div style={{ fontSize: "20px", fontWeight: 800, marginBottom: "4px", letterSpacing: "-0.01em" }}>
                              {obj1.nom}
                            </div>
                            <div className="bao-hero-desc" style={{ fontSize: "13px", opacity: 0.95, lineHeight: 1.4 }}>
                              Avant tout, identifiez les leviers et freins de motivation de votre groupe. Toute la BAO s&apos;articule autour de ce diagnostic.
                            </div>
                          </div>
                        </div>
                        <div className="bao-hero-cta" style={{
                          background: "white",
                          color: "var(--canard)",
                          padding: "10px 18px",
                          borderRadius: "10px",
                          fontSize: "14px",
                          fontWeight: 800,
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          whiteSpace: "nowrap",
                        }}>
                          {obj1Active ? "✓ Sélectionné" : "Diagnostiquer →"}
                          {!obj1Active && (
                            <span style={{
                              background: "var(--canard)",
                              color: "white",
                              fontSize: "10px",
                              fontWeight: 700,
                              padding: "2px 7px",
                              borderRadius: "10px",
                              minWidth: "20px",
                              textAlign: "center",
                            }}>{obj1Count}</span>
                          )}
                        </div>
                      </button>
                    )}

                    {/* Séparateur "Ou explorez par objectif" */}
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                      margin: "14px 0 12px",
                      color: "var(--muted)",
                      fontSize: "11px",
                      fontWeight: 700,
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                    }}>
                      <div style={{ flex: 1, height: "1px", background: "var(--line)" }} />
                      <span>Ou explorez par objectif</span>
                      <div style={{ flex: 1, height: "1px", background: "var(--line)" }} />
                    </div>

                    {/* Grille des autres objectifs (2 à 7) */}
                    <div className="bao-top-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${autresObjs.length}, 1fr)`, gap: "10px" }}>
                      {autresObjs.map((obj) => {
                        const isActive = activeObjectif?.id === obj.id;
                        const count = fichesCountByObjectif[obj.id] || 0;
                        return (
                          <button key={obj.id} onClick={() => selectObjectif(obj)} style={{
                            background: isActive ? "var(--canard)" : "white",
                            color: isActive ? "white" : "var(--anthracite)",
                            border: `2px solid ${isActive ? "var(--canard)" : "var(--line)"}`,
                            borderRadius: "14px", padding: "14px 14px 12px", cursor: "pointer",
                            textAlign: "center", fontFamily: "inherit", transition: "all 0.2s",
                            position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
                          }}
                            onMouseEnter={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.borderColor = "var(--canard)"; (e.currentTarget as HTMLElement).style.background = "#f0fafa"; } }}
                            onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.borderColor = "var(--line)"; (e.currentTarget as HTMLElement).style.background = "white"; } }}
                          >
                            <span style={{ position: "absolute", top: "8px", right: "8px", background: isActive ? "white" : "var(--canard)", color: isActive ? "var(--canard)" : "white", fontSize: "10px", fontWeight: 700, width: "20px", height: "20px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>{count}</span>
                            <span style={{ fontSize: "28px", lineHeight: 1 }}>{obj.emoji || "📋"}</span>
                            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.6 }}>{obj.mot_cle}</span>
                            <span style={{ fontSize: "12px", fontWeight: 600, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{obj.nom}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()
            ) : (
              /* ── Cartes Clés de motivation ── */
              <div className="bao-top-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "10px", maxWidth: "1500px", margin: "0 auto" }}>
                {cles.map((cle) => {
                  const isActive = activeCles.includes(cle.id);
                  const count = fichesCountByCle[cle.id] || 0;
                  return (
                    <button key={cle.id} onClick={() => toggleCle(cle.id)} style={{
                      background: isActive ? (cle.couleur_hex || "var(--canard)") : "white",
                      color: isActive ? "white" : "var(--anthracite)",
                      border: `2px solid ${isActive ? (cle.couleur_hex || "var(--canard)") : "var(--line)"}`,
                      borderRadius: "14px", padding: "14px 14px 12px", cursor: "pointer",
                      textAlign: "center", fontFamily: "inherit", transition: "all 0.2s",
                      position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px",
                    }}
                      onMouseEnter={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.borderColor = cle.couleur_hex || "var(--canard)"; (e.currentTarget as HTMLElement).style.background = "#f8f8fa"; } }}
                      onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.borderColor = "var(--line)"; (e.currentTarget as HTMLElement).style.background = "white"; } }}
                    >
                      <span style={{ position: "absolute", top: "8px", right: "8px", background: isActive ? "white" : (cle.couleur_hex || "var(--canard)"), color: isActive ? (cle.couleur_hex || "var(--canard)") : "white", fontSize: "10px", fontWeight: 700, width: "20px", height: "20px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>{count}</span>
                      <span style={{ fontSize: "28px", lineHeight: 1 }}>{cle.emoji || "🔑"}</span>
                      <span style={{ fontSize: "13px", fontWeight: 700, lineHeight: 1.3 }}>
                        {cle.nom.split(" (")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Bouton réafficher */}
        {!objectifsVisible && (
          <div style={{ borderBottom: "2px solid var(--line)", background: "white", padding: "8px 28px" }}>
            <button onClick={() => setObjectifsVisible(true)} style={{ background: "transparent", border: "none", fontFamily: "inherit", fontSize: "13px", fontWeight: 600, cursor: "pointer", color: "var(--canard)", padding: "4px 0" }}>
              + Afficher {viewMode === "objectifs" ? "les objectifs" : "les clés de motivation"}
            </button>
          </div>
        )}

        {/* Barre objectif actif (mode objectifs) */}
        {viewMode === "objectifs" && activeObjectif && (
          <div className="bao-active-bar" style={{ background: "var(--canard)", color: "white", padding: "12px 28px", display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "22px" }}>{activeObjectif.emoji}</span>
            <div style={{ flexGrow: 1 }}>
              <div style={{ fontWeight: 700, fontSize: "14px" }}>{activeObjectif.nom}</div>
              {activeObjectif.description && <div style={{ fontSize: "12px", opacity: 0.8, marginTop: "2px" }}>{activeObjectif.description}</div>}
            </div>
            <button onClick={clearObjectif} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "white", padding: "6px 14px", borderRadius: "14px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
              ✕ Tout afficher
            </button>
          </div>
        )}

        {/* Bandeau alertes diagnostic */}
        {alertesCles.length > 0 && viewMode === "cles" && (
          <div style={{ background: "#fff7ed", borderBottom: "2px solid #fed7aa", padding: "12px 28px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "16px" }}>⚠️</span>
            <div style={{ flexGrow: 1, fontSize: "14px", color: "var(--anthracite)" }}>
              <strong>Clés à renforcer{alerteAtelier ? ` pour "${alerteAtelier}"` : ""} :</strong>{" "}
              {alertesCles.map((nom, i) => {
                const cleData = cles.find((c) => c.nom.toLowerCase().includes(nom.toLowerCase()));
                return (
                  <span key={nom}>
                    {i > 0 && ", "}
                    {cleData?.emoji || "🔑"} {nom}
                  </span>
                );
              })}
            </div>
            <button onClick={() => { setAlertesCles([]); setAlerteAtelier(""); setActiveCles([]); }} style={{ background: "rgba(234, 88, 12, 0.15)", border: "none", color: "#ea580c", padding: "4px 12px", borderRadius: "12px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
              ✕ Fermer
            </button>
          </div>
        )}

        <div className="bao-main-grid" style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 0, maxWidth: "1500px", margin: "0 auto", flexGrow: 1, width: "100%" }}>
          <Sidebar
            formats={formats}
            activeFormats={activeFormats}
            onToggleFormat={toggleFormat}
            activeDurees={activeDurees}
            onToggleDuree={toggleDuree}
            materiels={materiels}
            activMateriels={activMateriels}
            onToggleMateriel={toggleMateriel}
            cles={cles}
            activeCles={activeCles}
            onToggleCle={toggleCle}
            objectifs={objectifs}
            activeObjectifs={activeObjectifIds}
            onToggleObjectif={toggleObjectifFilter}
            fichesCountByObjectif={fichesCountByObjectif}
            viewMode={viewMode}
            onReset={resetFilters}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />

          <section className="bao-results" style={{ padding: "28px 32px 80px" }}>
            <div className="bao-results-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
              <div style={{ fontSize: "26px", fontWeight: 800, letterSpacing: "-0.02em", color: "var(--anthracite)" }}>
                <strong style={{ color: "var(--canard)", fontWeight: 800 }}>{loading ? "—" : filtered.length}</strong> outils
                <span style={{ fontFamily: "'Caveat', cursive", fontWeight: 500, color: "var(--jaune-accent)", fontSize: "22px", marginLeft: "6px" }}>pour avancer.</span>
              </div>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "name" | "duration")} style={{ fontSize: "13px", fontFamily: "inherit", fontWeight: 600, padding: "7px 14px", border: "2px solid var(--line-strong)", background: "white", color: "var(--anthracite)", cursor: "pointer", borderRadius: "18px" }}>
                <option value="name">Trier par nom</option>
                <option value="duration">Trier par durée</option>
              </select>
            </div>

            {loading ? (
              <div className="bao-results-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{ background: "white", border: "2px solid var(--line)", borderRadius: "16px", padding: "22px", minHeight: "260px" }}>
                    <div style={{ height: "4px", background: "#e0e0e0", borderRadius: "2px", marginBottom: "16px" }} />
                    <div style={{ height: "20px", background: "#e0e0e0", borderRadius: "4px", width: "60%", marginBottom: "8px" }} />
                    <div style={{ height: "14px", background: "#f0f0f0", borderRadius: "4px", width: "80%" }} />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: "80px 40px", textAlign: "center", background: "white", border: "2px dashed var(--line)", borderRadius: "16px", fontSize: "20px", color: "var(--muted)" }}>
                <span style={{ color: "var(--jaune-accent)", fontSize: "28px", display: "block", fontFamily: "'Caveat', cursive", marginBottom: "8px" }}>Hmm…</span>
                Aucun outil ne correspond à ces filtres.
              </div>
            ) : (
              <div className="bao-results-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" }}>
                {filtered.map((fiche) => (
                  <FicheCard
                    key={fiche.id}
                    fiche={fiche}
                    cles={fiche.fichesCles}
                    etape={fiche.etape}
                    onClick={() => setSelectedFiche(fiche)}
                    userId={userId}
                    isFavori={favorisIds.includes(fiche.id)}
                    onFavoriToggle={updateFavori}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        {selectedFiche && (
          <FicheModalWrapper fiche={selectedFiche} cles={selectedFiche.fichesCles} etape={selectedFiche.etape} onClose={() => setSelectedFiche(null)} userId={userId} isAdmin={isAdmin} />
        )}
        {showWelcome && <WelcomeModal onClose={closeWelcome} />}

        {/* ═══ Diagnostic Overlay ═══ */}
        {showDiagnosticOverlay && (
          <div onClick={() => setShowDiagnosticOverlay(false)} style={{ position: "fixed", inset: 0, background: "rgba(43, 52, 66, 0.6)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
            <div className="diag-overlay-inner" onClick={(e) => e.stopPropagation()} style={{ background: "white", maxWidth: "780px", width: "100%", borderRadius: "20px", padding: "40px 36px", position: "relative", animation: "modalIn 0.3s ease", maxHeight: "90vh", overflowY: "auto" }}>
              <button onClick={() => setShowDiagnosticOverlay(false)} style={{ position: "absolute", top: "16px", right: "16px", background: "var(--blanc)", border: "none", fontSize: "22px", cursor: "pointer", color: "var(--anthracite)", width: "36px", height: "36px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              <div style={{ textAlign: "center", marginBottom: "28px" }}>
                <Search size={36} strokeWidth={2} color="var(--canard)" style={{ display: "inline-block" }} />
                <h2 style={{ fontSize: "24px", fontWeight: 800, color: "var(--anthracite)", margin: "12px 0 6px", letterSpacing: "-0.02em" }}>Diagnostiquer la motivation</h2>
                <p style={{ fontSize: "15px", color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>Identifiez les leviers et freins de motivation de votre groupe ou d'un jeune</p>
              </div>
              <div className="diag-cards-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
                <button onClick={handleDiagFaireLeTest} style={{ background: "white", border: "2px solid var(--line)", borderRadius: "16px", padding: "28px 20px", cursor: "pointer", fontFamily: "inherit", textAlign: "center", transition: "all 0.2s", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--canard)"; (e.currentTarget as HTMLElement).style.background = "#f0fafa"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--line)"; (e.currentTarget as HTMLElement).style.background = "white"; }}>
                  <span style={{ fontSize: "32px" }}>🧭</span>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--anthracite)", lineHeight: 1.3 }}>Faire le diagnostic</span>
                  <span style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.4 }}>Utilisez un outil pour identifier les leviers et freins de motivation</span>
                </button>
                <Link href="/bao/analyse" onClick={() => setShowDiagnosticOverlay(false)} style={{ background: "white", border: "2px solid var(--line)", borderRadius: "16px", padding: "28px 20px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", cursor: "pointer", transition: "all 0.2s", textDecoration: "none", color: "inherit" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--canard)"; (e.currentTarget as HTMLElement).style.background = "#f0fafa"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--line)"; (e.currentTarget as HTMLElement).style.background = "white"; }}>
                  <span style={{ fontSize: "32px" }}>📊</span>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--anthracite)", lineHeight: 1.3 }}>Analyser les résultats</span>
                  <span style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.4 }}>Décryptez les résultats et comprenez les dynamiques de votre groupe</span>
                </Link>
                <button onClick={handleDiagTrouverOutils} style={{ background: "white", border: "2px solid var(--line)", borderRadius: "16px", padding: "28px 20px", cursor: "pointer", fontFamily: "inherit", textAlign: "center", transition: "all 0.2s", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--canard)"; (e.currentTarget as HTMLElement).style.background = "#f0fafa"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--line)"; (e.currentTarget as HTMLElement).style.background = "white"; }}>
                  <span style={{ fontSize: "32px" }}>🔑</span>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: "var(--anthracite)", lineHeight: 1.3 }}>Trouver les bons outils</span>
                  <span style={{ fontSize: "13px", color: "var(--muted)", lineHeight: 1.4 }}>Explorez les outils adaptés à chaque clé de motivation</span>
                </button>
              </div>
              <div style={{ textAlign: "center", marginTop: "20px" }}>
                <Link href="/bao/cles-motivation" onClick={() => setShowDiagnosticOverlay(false)} style={{ fontSize: "13px", fontWeight: 600, color: "var(--canard)", textDecoration: "none" }}>
                  🔑 Comprendre les 9 clés de la motivation →
                </Link>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}

/* Wrapper qui charge les objectifs BAO pour la fiche sélectionnée */
function FicheModalWrapper({ fiche, cles, etape, onClose, userId, isAdmin }: {
  fiche: FicheWithMeta; cles: Cle[]; etape: Etape | null; onClose: () => void; userId: string | null; isAdmin: boolean;
}) {
  const [objectifsBao, setObjectifsBao] = useState<Objectif[]>([]);
  useEffect(() => { getObjectifsByFiche(fiche.id).then(setObjectifsBao); }, [fiche.id]);
  return (
    <FicheModal fiche={fiche} cles={cles} etape={etape} onClose={onClose} userId={userId} isAdmin={isAdmin} objectifsBao={objectifsBao} />
  );
}
