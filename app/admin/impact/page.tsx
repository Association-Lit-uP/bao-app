"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

// Objectif financeur (Fondation Pierre Bellon) — encadrants accompagnés, cumul 3 ans.
const OBJECTIF_ENCADRANTS_CUMUL = 740;

export default function AdminImpactPage() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [favoris, setFavoris] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [fiches, setFiches] = useState<any[]>([]);
  const [retours, setRetours] = useState<any[]>([]);
  const [workshopYouth, setWorkshopYouth] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [p, c, f, e, fi, r, diag] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, region, categorie_pro, structure, status, created_at, last_seen_at, login_count, jeunes_par_an_min, jeunes_par_an_max")
            .eq("is_admin", false),
          supabase.from("consultations").select("user_id, fiche_id, consulted_at"),
          supabase.from("favoris").select("user_id, fiche_id"),
          supabase.from("analytics_events").select("user_id, event_type, fiche_id, metadata, occurred_at"),
          supabase.from("fiches").select("id, nom").eq("publie", true),
          supabase.from("retours").select("note"),
          supabase.from("diagnostic_analyses").select("nb_jeunes"),
        ]);
        setProfiles(p.data || []);
        setConsultations(c.data || []);
        setFavoris(f.data || []);
        setEvents(e.data || []);
        setFiches(fi.data || []);
        setRetours(r.data || []);
        if (diag.error) {
          setWorkshopYouth(null);
        } else {
          setWorkshopYouth((diag.data || []).reduce((s: number, x: any) => s + (x.nb_jeunes || 0), 0));
        }
      } catch (err) {
        console.error("Erreur chargement impact:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const m = useMemo(() => {
    const nonAdminIds = new Set(profiles.map((p) => p.id));
    const active = profiles.filter((p) => p.status === "active");
    const pending = profiles.filter((p) => p.status === "en_attente");

    // Portée potentielle : Σ des estimations « jeunes / an » des comptes actifs.
    let jeunesPotentiel = 0;
    let nbRenseigne = 0;
    active.forEach((p) => {
      const mn = p.jeunes_par_an_min;
      const mx = p.jeunes_par_an_max;
      if (mn != null && mx != null) { jeunesPotentiel += (mn + mx) / 2; nbRenseigne++; }
      else if (mx != null) { jeunesPotentiel += mx; nbRenseigne++; }
      else if (mn != null) { jeunesPotentiel += mn; nbRenseigne++; }
    });

    // Usages « vrais utilisateurs » : on exclut l'équipe/admins (consultations
    // dont l'auteur n'est pas un profil non-admin connu).
    const consultNonAdmin = consultations.filter((c) => nonAdminIds.has(c.user_id));
    const favNonAdmin = favoris.filter((f) => nonAdminIds.has(f.user_id));

    const sessions = events.filter((e) => e.event_type === "session_start").length;
    const pdfDownloads = events.filter((e) => e.event_type === "pdf_download").length;
    const barometreAnalyses = events.filter((e) => e.event_type === "barometre_analyse").length;
    const diagnosticsPro = events.filter((e) => e.event_type === "diagnostic_pro").length;

    const thirty = new Date();
    thirty.setDate(thirty.getDate() - 30);
    const actifs30 = new Set(
      consultNonAdmin.filter((c) => new Date(c.consulted_at) > thirty).map((c) => c.user_id)
    ).size;

    // Top outils consultés (vrais utilisateurs).
    const byFiche: Record<string, number> = {};
    consultNonAdmin.forEach((c) => { byFiche[c.fiche_id] = (byFiche[c.fiche_id] || 0) + 1; });
    const ficheName = (id: string) => fiches.find((f) => f.id === id)?.nom || "Outil supprimé";
    const topTools = Object.entries(byFiche)
      .map(([id, n]) => ({ id, nom: ficheName(id), n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 10);

    // Recherches sans résultat → lacunes de contenu.
    const zero: Record<string, number> = {};
    events
      .filter((e) => e.event_type === "search" && e.metadata && e.metadata.results === 0)
      .forEach((e) => {
        const q = (e.metadata.query || "").toString().trim().toLowerCase();
        if (q) zero[q] = (zero[q] || 0) + 1;
      });
    const zeroSearch = Object.entries(zero)
      .map(([q, n]) => ({ q, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 12);

    // Clés les plus souvent à renforcer : alertes du baromètre (score < 50 %)
    // + clés « à travailler » des auto-diagnostics pro. Agrégé depuis les
    // metadata des événements (la table analyses n'est lisible que par son auteur).
    const renforcer: Record<string, number> = {};
    const addCle = (c: unknown) => {
      if (typeof c === "string" && c.trim()) renforcer[c.trim()] = (renforcer[c.trim()] || 0) + 1;
    };
    events.forEach((e) => {
      if (e.event_type === "barometre_analyse" && Array.isArray(e.metadata?.alertes)) {
        e.metadata.alertes.forEach(addCle);
      }
      if (e.event_type === "diagnostic_pro" && Array.isArray(e.metadata?.zones?.travailler)) {
        e.metadata.zones.travailler.forEach(addCle);
      }
    });
    const clesARenforcer = Object.entries(renforcer)
      .map(([nom, n]) => ({ nom, n }))
      .sort((a, b) => b.n - a.n);

    // Tranches d'âge des jeunes concernés, déclarées dans les auto-diagnostics
    // et les analyses du baromètre (même référentiel de tranches).
    const ages: Record<string, number> = {};
    events.forEach((e) => {
      if (
        (e.event_type === "diagnostic_pro" || e.event_type === "barometre_analyse") &&
        Array.isArray(e.metadata?.tranches_age)
      ) {
        e.metadata.tranches_age.forEach((a: unknown) => {
          if (typeof a === "string" && a.trim()) ages[a.trim()] = (ages[a.trim()] || 0) + 1;
        });
      }
    });
    const agesDiagnostics = Object.entries(ages)
      .map(([k, n]) => ({ k, n }))
      .sort((a, b) => b.n - a.n);

    const notes = retours.map((r) => r.note).filter((n: any) => n != null);
    const avgNote = notes.length
      ? Math.round((notes.reduce((a: number, b: number) => a + b, 0) / notes.length) * 10) / 10
      : null;

    const groupBy = (key: string) => {
      const map: Record<string, number> = {};
      profiles.forEach((p) => { const k = p[key] || "Non renseigné"; map[k] = (map[k] || 0) + 1; });
      return Object.entries(map).map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n);
    };

    return {
      total: profiles.length,
      active: active.length,
      pending: pending.length,
      jeunesPotentiel: Math.round(jeunesPotentiel),
      nbRenseigne,
      consultTotal: consultNonAdmin.length,
      favTotal: favNonAdmin.length,
      sessions,
      pdfDownloads,
      barometreAnalyses,
      diagnosticsPro,
      actifs30,
      topTools,
      clesARenforcer,
      agesDiagnostics,
      zeroSearch,
      avgNote,
      regionStats: groupBy("region"),
      catStats: groupBy("categorie_pro"),
    };
  }, [profiles, consultations, favoris, events, fiches, retours]);

  if (loading) {
    return <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>Chargement du tableau de bord d&apos;impact…</div>;
  }

  const objPct = Math.min(100, Math.round((m.total / OBJECTIF_ENCADRANTS_CUMUL) * 100));

  return (
    <div>
      <div style={{ marginBottom: "8px" }}>
        <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#2B3442", marginBottom: "4px" }}>Tableau de bord d&apos;impact</h1>
        <p style={{ fontSize: "14px", color: "#6b7280" }}>
          Mesure de l&apos;impact de la Boîte à Outils auprès des professionnels (encadrants) et, indirectement, des jeunes.
        </p>
      </div>

      {/* KPI principaux */}
      <SectionTitle>Indicateurs clés</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", marginBottom: "28px" }}>
        <StatCard value={m.total} label="Encadrants inscrits" color="#2B3442" emoji="👥" />
        <StatCard value={m.active} label="Actifs (accès validé)" color="#10b981" emoji="✅" />
        <StatCard value={m.actifs30} label="Actifs (30 derniers j.)" color="#00989D" emoji="⚡" />
        <StatCard value={m.jeunesPotentiel.toLocaleString("fr-FR")} label="Jeunes touchés / an (estimé)" color="#6B2468" emoji="🎯" />
        <StatCard value={m.sessions} label="Visites (sessions)" color="#0ea5e9" emoji="🚪" />
        <StatCard value={m.pdfDownloads} label="Fiches PDF téléchargées" color="#f59e0b" emoji="↓" />
        <StatCard value={m.barometreAnalyses} label="Analyses du baromètre" color="#00989D" emoji="📊" />
        <StatCard value={m.diagnosticsPro} label="Auto-diagnostics pro" color="#6B2468" emoji="🧭" />
      </div>

      {/* Portée encadrants vs objectif Fondation */}
      <Card>
        <h3 style={cardTitleStyle}>Portée — encadrants accompagnés</h3>
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "10px" }}>
          <span style={{ fontSize: "30px", fontWeight: 800, color: "#2B3442" }}>{m.total}</span>
          <span style={{ fontSize: "14px", color: "#6b7280" }}>
            inscrits — objectif financeur (cumul 3 ans) : <strong>{OBJECTIF_ENCADRANTS_CUMUL}</strong>
          </span>
        </div>
        <div style={{ height: "12px", background: "#f3f4f6", borderRadius: "6px", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${objPct}%`, background: "#00989D", borderRadius: "6px", transition: "width 0.5s ease" }} />
        </div>
        <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "8px" }}>
          {objPct}% de l&apos;objectif cumulé · {m.pending} en attente de validation
        </div>
      </Card>

      {/* Portée indirecte jeunes */}
      <Card>
        <h3 style={cardTitleStyle}>Portée indirecte — jeunes</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          <div>
            <div style={{ fontSize: "30px", fontWeight: 800, color: "#6B2468" }}>{m.jeunesPotentiel.toLocaleString("fr-FR")}</div>
            <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "2px" }}>
              jeunes / an (capacité estimée déclarée par {m.nbRenseigne} encadrant{m.nbRenseigne > 1 ? "s" : ""} actif{m.nbRenseigne > 1 ? "s" : ""})
            </div>
          </div>
          <div>
            <div style={{ fontSize: "30px", fontWeight: 800, color: "#00989D" }}>
              {workshopYouth == null ? "—" : workshopYouth.toLocaleString("fr-FR")}
            </div>
            <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "2px" }}>
              jeunes concernés par les diagnostics réalisés (réel)
            </div>
          </div>
        </div>
      </Card>

      {/* Adoption / engagement */}
      <Card>
        <h3 style={cardTitleStyle}>Adoption &amp; engagement (hors équipe)</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px" }}>
          <MiniStat value={m.consultTotal} label="Consultations d'outils" />
          <MiniStat value={m.favTotal} label="Mises en favori" />
          <MiniStat value={m.pdfDownloads} label="Téléchargements PDF" />
          <MiniStat value={m.barometreAnalyses} label="Analyses du baromètre" />
          <MiniStat value={m.diagnosticsPro} label="Auto-diagnostics pro" />
          <MiniStat value={m.avgNote == null ? "—" : `${m.avgNote}/5`} label="Note moyenne des outils" />
        </div>
      </Card>

      {/* Répartition */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
        <Card noMargin>
          <h3 style={cardTitleStyle}>Par région</h3>
          {m.regionStats.length === 0 ? <Empty /> : m.regionStats.slice(0, 10).map((r) => (
            <BarRow key={r.k} label={r.k} value={r.n} max={m.regionStats[0].n} color="#6B2468" />
          ))}
        </Card>
        <Card noMargin>
          <h3 style={cardTitleStyle}>Par catégorie professionnelle</h3>
          {m.catStats.length === 0 ? <Empty /> : m.catStats.slice(0, 10).map((c) => (
            <BarRow key={c.k} label={c.k} value={c.n} max={m.catStats[0].n} color="#00989D" />
          ))}
        </Card>
      </div>

      {/* Diagnostics : clés en difficulté + publics concernés */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
        <Card noMargin>
          <h3 style={cardTitleStyle}>🔑 Clés les plus souvent à renforcer</h3>
          <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "-8px", marginBottom: "12px" }}>
            Alertes du baromètre (score sous 50&nbsp;%) et clés «&nbsp;à travailler&nbsp;» des auto-diagnostics pro.
          </p>
          {m.clesARenforcer.length === 0 ? <Empty /> : m.clesARenforcer.slice(0, 10).map((c) => (
            <BarRow key={c.nom} label={c.nom} value={c.n} max={m.clesARenforcer[0].n} color="#dc2626" suffix="fois" />
          ))}
        </Card>
        <Card noMargin>
          <h3 style={cardTitleStyle}>🎯 Tranches d&apos;âge des jeunes concernés</h3>
          <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "-8px", marginBottom: "12px" }}>
            Déclarées par les pros dans les auto-diagnostics et les analyses du baromètre.
          </p>
          {m.agesDiagnostics.length === 0 ? <Empty /> : m.agesDiagnostics.map((a) => (
            <BarRow key={a.k} label={a.k} value={a.n} max={m.agesDiagnostics[0].n} color="#6B2468" suffix="fois" />
          ))}
        </Card>
      </div>

      {/* Top outils + lacunes */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
        <Card noMargin>
          <h3 style={cardTitleStyle}>🔥 Outils les plus consultés</h3>
          {m.topTools.length === 0 ? <Empty /> : m.topTools.map((t, i) => (
            <BarRow key={t.id} label={`${i + 1}. ${t.nom}`} value={t.n} max={m.topTools[0].n} color="#00989D" suffix="consult." />
          ))}
        </Card>
        <Card noMargin>
          <h3 style={cardTitleStyle}>🔎 Recherches sans résultat</h3>
          <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "-8px", marginBottom: "12px" }}>
            Besoins exprimés non couverts → pistes de contenu.
          </p>
          {m.zeroSearch.length === 0 ? (
            <div style={{ fontSize: "13px", color: "#9ca3af", padding: "12px 0" }}>
              Aucune recherche infructueuse enregistrée (les données s&apos;accumulent à l&apos;usage).
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {m.zeroSearch.map((s) => (
                <span key={s.q} style={{ fontSize: "13px", background: "#fef3c7", color: "#92400e", padding: "4px 10px", borderRadius: "12px", fontWeight: 600 }}>
                  {s.q} <span style={{ opacity: 0.6 }}>×{s.n}</span>
                </span>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Note méthodo / à venir */}
      <div style={{ background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: "12px", padding: "16px 20px", fontSize: "13px", color: "#0f766e", lineHeight: 1.6 }}>
        <strong>À venir pour compléter la mesure d&apos;impact :</strong> mini-enquêtes auprès des pros
        (sentiment d&apos;outillage avant/après, évolution des pratiques, diffusion à d&apos;autres
        professionnels — indicateurs #4/#5/#6 de la Fondation) et le suivi du <em>réel</em> par outil
        («&nbsp;j&apos;ai utilisé cet outil avec X jeunes&nbsp;»). Les visites, téléchargements et
        recherches s&apos;enregistrent depuis l&apos;activation du suivi : ces chiffres s&apos;enrichissent avec le temps.
      </div>
    </div>
  );
}

/* ── UI helpers ── */

const cardTitleStyle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 700,
  color: "#2B3442",
  marginBottom: "16px",
  marginTop: 0,
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "12px", fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>
      {children}
    </div>
  );
}

function Card({ children, noMargin }: { children: React.ReactNode; noMargin?: boolean }) {
  return (
    <div style={{ background: "white", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "20px", marginBottom: noMargin ? 0 : "20px" }}>
      {children}
    </div>
  );
}

function StatCard({ value, label, color, emoji }: { value: number | string; label: string; color: string; emoji: string }) {
  return (
    <div style={{ background: "white", borderRadius: "12px", border: "1px solid #e5e7eb", padding: "16px", textAlign: "center" }}>
      <div style={{ fontSize: "18px", marginBottom: "2px" }}>{emoji}</div>
      <div style={{ fontSize: "26px", fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px", fontWeight: 600, lineHeight: 1.3 }}>{label}</div>
    </div>
  );
}

function MiniStat({ value, label }: { value: number | string; label: string }) {
  return (
    <div style={{ background: "#f9fafb", borderRadius: "10px", padding: "14px", textAlign: "center" }}>
      <div style={{ fontSize: "22px", fontWeight: 800, color: "#2B3442" }}>{value}</div>
      <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "2px", fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function BarRow({ label, value, max, color, suffix }: { label: string; value: number; max: number; color: string; suffix?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ marginBottom: "10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#2B3442", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <span style={{ fontSize: "12px", fontWeight: 700, color: "#6b7280", whiteSpace: "nowrap" }}>{value}{suffix ? ` ${suffix}` : ""}</span>
      </div>
      <div style={{ height: "6px", background: "#f3f4f6", borderRadius: "3px" }}>
        <div style={{ height: "100%", background: color, borderRadius: "3px", width: `${pct}%`, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

function Empty() {
  return <div style={{ padding: "16px 0", textAlign: "center", color: "#9ca3af", fontSize: "13px" }}>Pas encore de données</div>;
}
