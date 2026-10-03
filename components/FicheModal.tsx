"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Fiche, Cle, Etape, Objectif } from "@/lib/supabase";
import { formatDuree, slugify } from "@/lib/supabase";
import { generateFichePdf } from "@/lib/generateFichePdf";
import { logEvent } from "@/lib/analytics";
import UsageOutilButton from "@/components/UsageOutilButton";
import RetoursSection from "@/components/RetoursSection";
import Link from "next/link";

interface FicheModalProps {
  fiche: Fiche;
  cles: Cle[];
  etape: Etape | null;
  onClose: () => void;
  userId?: string | null;
  isAdmin?: boolean;
  objectifsBao?: Objectif[];
}

function parseJSON(val: any): any {
  if (!val) return null;
  if (typeof val === "object") return val;
  try {
    return JSON.parse(val);
  } catch {
    return val;
  }
}

export default function FicheModal({ fiche, cles, etape, onClose, userId, isAdmin, objectifsBao }: FicheModalProps) {
  const [pdfEnCours, setPdfEnCours] = useState(false);

  async function handleTelechargerPdf() {
    if (pdfEnCours) return;
    setPdfEnCours(true);
    logEvent("pdf_download", { ficheId: fiche.id });
    try {
      await generateFichePdf(fiche, cles.map((c: any) => ({ nom: c.nom, emoji: c.emoji })));
    } catch (err) {
      console.error("Erreur génération PDF :", err);
    } finally {
      setPdfEnCours(false);
    }
  }

  // Enregistrer la consultation à l'ouverture de la modale
  useEffect(() => {
    if (userId && fiche?.id) {
      supabase.from("consultations").insert({
        user_id: userId,
        fiche_id: fiche.id,
        consulted_at: new Date().toISOString(),
      }).then(() => {});
    }
  }, [userId, fiche?.id]);
  const duree = formatDuree(fiche);
  const stepColor = etape?.couleur_hex || "var(--canard)";
  const objectifs = parseJSON(fiche.objectifs);
  const materielListe = parseJSON(fiche.materiel_liste);
  const deroule = parseJSON(fiche.deroule);
  const conseils = parseJSON(fiche.conseils);
  const variantes = parseJSON(fiche.variantes);
  const illustrationsList: string[] = Array.isArray((fiche as any).illustrations) ? (fiche as any).illustrations : [];
  const pdfsComp: { nom: string; url: string }[] = Array.isArray((fiche as any).pdfs_complementaires) ? (fiche as any).pdfs_complementaires : [];

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://odadaqpihvcnuprkdchr.supabase.co";
  const pdfUrl = fiche.pdf_url
    ? fiche.pdf_url.startsWith("http")
      ? fiche.pdf_url
      : `${SUPABASE_URL}/storage/v1/object/public/fiches-pdf/${fiche.pdf_url.replace(/^\/?(pdfs\/)?/, "")}`
    : null;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(43, 52, 66, 0.6)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px",
      }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          maxWidth: "720px",
          width: "100%",
          maxHeight: "88vh",
          overflowY: "auto",
          position: "relative",
          padding: "40px 44px 44px",
          animation: "modalIn 0.3s ease",
          borderRadius: "20px",
        }}
      >
        {/* Close + Fullscreen + Edit buttons */}
        <div style={{ position: "absolute", top: "16px", right: "16px", display: "flex", gap: "8px" }}>
          {isAdmin && (
            <Link
              href={`/admin/fiches/${fiche.id}/edit`}
              style={{
                background: "var(--blanc)",
                border: "none",
                fontSize: "14px",
                cursor: "pointer",
                color: "var(--canard)",
                lineHeight: 1,
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none",
              }}
              title="Modifier cette fiche"
            >
              ✏️
            </Link>
          )}
          <Link
            href={`/bao/${fiche.slug || slugify(fiche.nom)}`}
            style={{
              background: "var(--blanc)",
              border: "none",
              fontSize: "16px",
              cursor: "pointer",
              color: "var(--anthracite)",
              lineHeight: 1,
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textDecoration: "none",
            }}
            title="Ouvrir en plein écran"
          >
            ⛶
          </Link>
          <button
            onClick={onClose}
            style={{
              background: "var(--blanc)",
              border: "none",
              fontSize: "22px",
              cursor: "pointer",
              color: "var(--anthracite)",
              lineHeight: 1,
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        {/* Emoji + Title */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: "14px", marginBottom: "20px" }}>
          <span style={{ fontSize: "40px", lineHeight: 1, flexShrink: 0 }}>
            {(fiche as any).emoji || "🔧"}
          </span>
          <h1
            style={{
              fontSize: "36px",
              fontWeight: 800,
              letterSpacing: "-0.025em",
              lineHeight: 1.1,
              color: "var(--anthracite)",
              margin: 0,
            }}
          >
            {fiche.nom}
          </h1>
        </div>

        {/* Metadata grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "16px 24px",
            margin: "20px 0 24px",
            padding: "20px 24px",
            background: "var(--blanc)",
            borderRadius: "14px",
          }}
        >
          {duree && (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={labelStyle}>Durée</span>
              <span style={valueStyle}>{duree}</span>
            </div>
          )}
          {fiche.format && (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={labelStyle}>Format</span>
              <span style={valueStyle}>{fiche.format}</span>
            </div>
          )}
          {fiche.materiel && (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={labelStyle}>Matériel</span>
              <span style={valueStyle}>{fiche.materiel}</span>
            </div>
          )}
          {fiche.participants && (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={labelStyle}>Participants</span>
              <span style={valueStyle}>{fiche.participants}</span>
            </div>
          )}
          {fiche.pour_qui && (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={labelStyle}>Pour qui</span>
              <span style={valueStyle}>{fiche.pour_qui}</span>
            </div>
          )}
          {fiche.source && (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={labelStyle}>Source</span>
              <span style={valueStyle}>{fiche.source}</span>
            </div>
          )}
        </div>

        {/* Illustrations carrousel */}
        {illustrationsList.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "8px" }}>
              {illustrationsList.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={url}
                  alt={`Illustration ${i + 1}`}
                  style={{
                    height: "200px",
                    borderRadius: "12px",
                    objectFit: "cover",
                    flexShrink: 0,
                    border: "2px solid var(--line)",
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Objectifs BAO */}
        {objectifsBao && objectifsBao.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <div style={sectionLabelStyle}>Objectifs</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {objectifsBao.map((obj) => (
                <span
                  key={obj.id}
                  style={{
                    fontSize: "12px",
                    padding: "4px 10px",
                    borderRadius: "10px",
                    color: "var(--canard-dark)",
                    fontWeight: 600,
                    background: "#e0f3f4",
                    border: "1px solid var(--canard)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span>{obj.emoji}</span> {obj.mot_cle || obj.nom}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Clés */}
        {cles.length > 0 && (
          <div style={{ marginBottom: "20px" }}>
            <div style={sectionLabelStyle}>Clés d&apos;engagement</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {cles.map((cle) => (
                <span
                  key={cle.id}
                  style={{
                    fontSize: "10px",
                    padding: "3px 8px",
                    borderRadius: "10px",
                    color: "white",
                    fontWeight: 600,
                    letterSpacing: "0.02em",
                    background: cle.couleur_hex || "var(--canard)",
                  }}
                >
                  {cle.nom}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Detail sections */}
        <div style={{ marginTop: "24px" }}>
          {/* Intention */}
          {fiche.intention && (
            <div style={{ marginTop: "32px" }}>
              <div style={{ padding: "18px 20px 18px 22px", borderRadius: "12px", background: "#e0f3f4", position: "relative", paddingLeft: "28px" }}>
                <div style={{ position: "absolute", left: 0, top: "8px", bottom: "8px", width: "4px", borderRadius: "2px", background: "var(--canard)" }} />
                <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px", color: "var(--canard-dark)" }}>
                  L&apos;intention
                </div>
                <div style={{ fontSize: "15px", lineHeight: 1.55, color: "var(--anthracite)", fontStyle: "italic" }} dangerouslySetInnerHTML={{ __html: fiche.intention }} />
              </div>
            </div>
          )}

          {/* Pourquoi */}
          {fiche.pourquoi && (
            <div style={{ marginTop: "12px" }}>
              <div style={{ padding: "18px 20px 18px 28px", borderRadius: "12px", background: "#fff7df", position: "relative" }}>
                <div style={{ position: "absolute", left: 0, top: "8px", bottom: "8px", width: "4px", borderRadius: "2px", background: "var(--jaune-dark)" }} />
                <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px", color: "var(--jaune-accent)" }}>
                  Pourquoi cet outil fonctionne
                </div>
                <div style={{ fontSize: "15px", lineHeight: 1.55, color: "var(--anthracite)" }} dangerouslySetInnerHTML={{ __html: fiche.pourquoi }} />
              </div>
            </div>
          )}

          {/* Matériel liste */}
          {materielListe && Array.isArray(materielListe) && materielListe.length > 0 && (
            <div style={{ marginTop: "32px" }}>
              <SectionHeading text="Ce dont vous avez besoin" />
              <div style={{ background: "var(--blanc)", borderRadius: "12px", padding: "4px 0" }}>
                {materielListe.map((item: any, i: number) => {
                  const text = typeof item === "string" ? item : item.item || item.titre || Object.values(item).join(" – ");
                  return (
                    <div key={i} style={{ padding: "11px 18px", borderBottom: i < materielListe.length - 1 ? "1px solid var(--line)" : "none", fontSize: "15px", display: "flex", gap: "10px", alignItems: "baseline", lineHeight: 1.45 }}>
                      <span style={{ color: "var(--canard)", fontWeight: 700, flexShrink: 0 }}>•</span>
                      <span dangerouslySetInnerHTML={{ __html: text }} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Objectifs pédagogiques */}
          {objectifs && Array.isArray(objectifs) && objectifs.length > 0 && (
            <div style={{ marginTop: "32px" }}>
              <SectionHeading text="Objectifs pédagogiques" />
              {objectifs.map((obj: any, i: number) => {
                const title = typeof obj === "string" ? obj : obj.titre || obj.title || obj.objectif;
                const detail = typeof obj === "object" ? (obj.détail || obj.detail || obj.description) : null;
                return (
                  <div key={i} style={{ marginBottom: "14px" }}>
                    <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--canard-dark)", marginBottom: "4px", display: "flex", alignItems: "baseline", gap: "8px" }}>
                      <span style={{ color: "var(--canard)", fontWeight: 800 }}>→</span>
                      <span dangerouslySetInnerHTML={{ __html: title }} />
                    </div>
                    {detail && (
                      <div style={{ fontSize: "14px", color: "var(--anthracite)", lineHeight: 1.5, paddingLeft: "20px" }} dangerouslySetInnerHTML={{ __html: detail }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Déroulé */}
          {deroule && Array.isArray(deroule) && deroule.length > 0 && (
            <div style={{ marginTop: "32px" }}>
              <SectionHeading text="Le déroulé, étape par étape" />
              {deroule.map((step: any, i: number) => (
                <div key={i} style={{ background: "var(--blanc)", borderRadius: "12px", padding: "18px 22px 18px 24px", marginBottom: "14px", position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", left: 0, top: "12px", bottom: "12px", width: "5px", background: stepColor, borderRadius: "2px" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px", paddingBottom: "12px", borderBottom: "1px solid var(--line)" }}>
                    <span style={{ width: "28px", height: "28px", borderRadius: "50%", background: stepColor, color: "white", fontWeight: 800, fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {step.étape || step.etape || i + 1}
                    </span>
                    <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--anthracite)", flexGrow: 1 }}>
                      {step.titre || step.title || `Étape ${i + 1}`}
                    </span>
                    {(step.durée || step.duree) && (
                      <span style={{ fontSize: "12px", fontWeight: 700, background: stepColor, color: "white", padding: "4px 10px", borderRadius: "10px", whiteSpace: "nowrap" }}>
                        {step.durée || step.duree}
                      </span>
                    )}
                  </div>
                  {step.actions && Array.isArray(step.actions) && (
                    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                      {step.actions.map((a: string, j: number) => (
                        <li key={j} style={{ padding: "5px 0 5px 18px", fontSize: "14px", color: "var(--anthracite)", lineHeight: 1.5, position: "relative" }}>
                          <span style={{ position: "absolute", left: "4px", top: "12px", width: "5px", height: "5px", borderRadius: "50%", background: stepColor }} />
                          <span dangerouslySetInnerHTML={{ __html: a }} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {step.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={step.image_url}
                      alt={`Illustration ${step.titre || `étape ${i + 1}`}`}
                      style={{
                        width: "100%",
                        maxHeight: "300px",
                        objectFit: "contain",
                        borderRadius: "10px",
                        marginTop: "14px",
                        border: "1px solid var(--line)",
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Conseils */}
          {conseils && Array.isArray(conseils) && conseils.length > 0 && (
            <div style={{ marginTop: "32px" }}>
              <SectionHeading text="Conseils pour bien animer" />
              <div style={{ padding: "16px 20px", borderRadius: "12px", background: "#f5e9f3", borderLeft: "4px solid var(--prune)" }}>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {conseils.map((c: any, i: number) => {
                    const text = typeof c === "string" ? c : c.conseil || c.titre || c.text || Object.values(c).join(" – ");
                    return (
                      <li key={i} style={{ fontSize: "14px", color: "var(--anthracite)", lineHeight: 1.5, padding: "4px 0 4px 20px", position: "relative" }}>
                        <span style={{ position: "absolute", left: 0, fontWeight: 700, color: "var(--prune)" }}>→</span>
                        <span dangerouslySetInnerHTML={{ __html: text }} />
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}

          {/* Variantes */}
          {variantes && Array.isArray(variantes) && variantes.length > 0 && (
            <div style={{ marginTop: "32px" }}>
              <SectionHeading text="Variantes possibles" />
              <div style={{ padding: "16px 20px", borderRadius: "12px", background: "#fff7df", borderLeft: "4px solid var(--jaune-accent)" }}>
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {variantes.map((v: any, i: number) => {
                    const text = typeof v === "string" ? v : v.variante || v.titre || v.text || Object.values(v).join(" – ");
                    return (
                      <li key={i} style={{ fontSize: "14px", color: "var(--anthracite)", lineHeight: 1.5, padding: "4px 0 4px 20px", position: "relative" }}>
                        <span style={{ position: "absolute", left: 0, fontWeight: 900, color: "var(--jaune-accent)", fontSize: "18px", lineHeight: 1, top: "4px" }}>·</span>
                        <span dangerouslySetInnerHTML={{ __html: text }} />
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* PDFs complémentaires */}
        {pdfsComp.length > 0 && (
          <div style={{ marginTop: "32px" }}>
            <SectionHeading text="Ressources complémentaires" />
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {pdfsComp.map((pdf, i) => (
                <a
                  key={i}
                  href={pdf.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "12px 16px",
                    background: "var(--blanc)",
                    borderRadius: "10px",
                    textDecoration: "none",
                    transition: "background 0.15s",
                    border: "1px solid var(--line)",
                  }}
                >
                  <span style={{ fontSize: "20px" }}>📄</span>
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--anthracite)", flex: 1 }}>
                    {pdf.nom || `Document ${i + 1}`}
                  </span>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--canard)" }}>
                    Télécharger ↓
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* CTA buttons */}
        <div style={{ marginTop: "28px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <div role="button" tabIndex={0}
              aria-busy={pdfEnCours}
              onClick={(e) => { e.stopPropagation(); handleTelechargerPdf(); }}
              style={{
                padding: "11px 20px",
                border: "2px solid var(--canard)",
                background: "var(--canard)",
                color: "white",
                fontFamily: "inherit",
                fontSize: "13px",
                fontWeight: 700,
                cursor: pdfEnCours ? "wait" : "pointer",
                opacity: pdfEnCours ? 0.7 : 1,
                borderRadius: "24px",
                transition: "all 0.2s",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                letterSpacing: "0.02em",
              }}
            >
              {pdfEnCours ? "Préparation du PDF…" : "↓ Télécharger la fiche PDF"}
            </div>
          <UsageOutilButton ficheNom={fiche.nom} ficheSlug={fiche.slug} userId={userId || null} />
        </div>

        {/* Source */}
        {fiche.source && (
          <div style={{ marginTop: "32px", paddingTop: "20px", borderTop: "1px dashed var(--line-strong)", fontSize: "13px", color: "var(--muted)" }}>
            <strong>Source :</strong> {fiche.source}
          </div>
        )}

        {/* Retours d'expérience */}
        <RetoursSection
          ficheId={fiche.id}
          userId={userId || null}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--muted)",
};

const valueStyle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 600,
  color: "var(--anthracite)",
  lineHeight: 1.4,
};

const sectionLabelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--muted)",
  margin: "20px 0 10px",
};

function SectionHeading({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
      <span style={{ fontSize: "20px", fontWeight: 800, color: "var(--anthracite)", letterSpacing: "-0.015em", lineHeight: 1.1 }}>
        {text}
      </span>
    </div>
  );
}
