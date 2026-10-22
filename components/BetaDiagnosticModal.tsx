"use client";

import { Lightbulb, BookOpen, AlertTriangle } from "lucide-react";

interface BetaDiagnosticModalProps {
  onStart: () => void;
  onLater: () => void;
}

/**
 * Avertissement affiché à l'entrée de l'auto-diagnostic (/bao/diagnostic-pro),
 * tant que la fonctionnalité est en version bêta. La page mémorise le choix
 * « J'ai compris » dans le navigateur pour ne pas le redemander.
 */
export default function BetaDiagnosticModal({ onStart, onLater }: BetaDiagnosticModalProps) {
  const bloc: React.CSSProperties = { display: "flex", gap: "14px", alignItems: "flex-start", marginBottom: "16px" };
  const icone: React.CSSProperties = {
    width: "38px", height: "38px", borderRadius: "10px", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
  };
  const titreBloc: React.CSSProperties = { fontSize: "14px", fontWeight: 700, color: "var(--anthracite, #2B3442)", marginBottom: "4px" };
  const texteBloc: React.CSSProperties = { fontSize: "14px", color: "var(--anthracite, #2B3442)", lineHeight: 1.6, margin: 0 };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="beta-diagnostic-titre"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(43, 52, 66, 0.6)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        style={{
          background: "white",
          maxWidth: "620px",
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          borderRadius: "20px",
          padding: "28px 28px 24px",
          boxSizing: "border-box",
          boxShadow: "0 20px 60px rgba(43, 52, 66, 0.25)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "6px" }}>
          <h2 id="beta-diagnostic-titre" style={{ fontSize: "22px", fontWeight: 800, color: "var(--anthracite, #2B3442)", margin: 0, lineHeight: 1.2 }}>
            Auto-diagnostic du pro
          </h2>
          <span style={{ fontSize: "11px", fontWeight: 700, background: "#6B2468", color: "white", padding: "3px 9px", borderRadius: "6px", textTransform: "uppercase", letterSpacing: "0.4px" }}>
            Version bêta
          </span>
        </div>
        <p style={{ fontSize: "14px", color: "var(--muted, #6b7280)", lineHeight: 1.6, margin: "0 0 22px" }}>
          Avant de commencer, trois choses à savoir sur cet outil.
        </p>

        <div style={bloc}>
          <div style={{ ...icone, background: "#e0f3f4", color: "#00989D" }}><Lightbulb size={20} /></div>
          <div>
            <div style={titreBloc}>Ce que fait l&apos;outil</div>
            <p style={texteBloc}>
              Il vous aide à poser de premières hypothèses sur l&apos;engagement d&apos;un jeune ou d&apos;un groupe,
              à partir de vos observations. L&apos;analyse est produite par une intelligence artificielle.
            </p>
          </div>
        </div>

        <div style={bloc}>
          <div style={{ ...icone, background: "#fff4d6", color: "#b7791f" }}><BookOpen size={20} /></div>
          <div>
            <div style={titreBloc}>Sur quoi elle s&apos;appuie</div>
            <p style={texteBloc}>
              Les outils Lit uP, les conseils et postures Lit uP, ainsi que des documents et des sources
              issus de la recherche sur la motivation et le pouvoir d&apos;agir.
            </p>
          </div>
        </div>

        <div style={{ ...bloc, marginBottom: "24px" }}>
          <div style={{ ...icone, background: "#fdecec", color: "#dc2626" }}><AlertTriangle size={20} /></div>
          <div>
            <div style={titreBloc}>Ses limites</div>
            <p style={texteBloc}>
              Elle peut se tromper. Elle sert de guide et d&apos;aide, pas de prescription : votre esprit critique,
              votre regard éducatif et une prise de recul restent nécessaires face à ses conseils.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onLater}
            style={{
              padding: "11px 20px", borderRadius: "24px", border: "2px solid var(--line-strong, #d1d5db)",
              background: "white", color: "var(--anthracite, #2B3442)", fontSize: "14px", fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            Plus tard
          </button>
          <button
            type="button"
            onClick={onStart}
            style={{
              padding: "11px 22px", borderRadius: "24px", border: "none",
              background: "#00989D", color: "white", fontSize: "14px", fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}
          >
            J&apos;ai compris, je commence
          </button>
        </div>
      </div>
    </div>
  );
}
