"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, getProfileByUserId, logAuthError } from "@/lib/auth";
import Link from "next/link";
import PasswordInput from "@/components/PasswordInput";

export default function ConnexionPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Veuillez remplir tous les champs");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const authData = await signIn(email, password);

      // Vérifier le profil en utilisant directement le user id retourné
      const profile = await getProfileByUserId(authData.user.id);

      if (!profile) {
        setError("Profil introuvable. Contactez l'équipe Lit uP.");
        return;
      }

      if (profile.is_admin) {
        router.push("/admin");
      } else if (profile.status === "active") {
        router.push("/bao");
      } else if (profile.status === "en_attente") {
        router.push("/connexion/en-attente");
      } else if (profile.status === "suspended") {
        setError(
          "Votre accès a été suspendu. Contactez l'équipe Lit uP pour plus d'informations."
        );
      } else if (profile.status === "refused") {
        setError(
          "Votre demande d'accès n'a pas été acceptée. Contactez l'équipe Lit uP pour plus d'informations."
        );
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erreur de connexion";
      // Journalise l'erreur pour les alertes admin (ne bloque pas si ça échoue).
      logAuthError("login", email, msg);
      if (msg.includes("Invalid login")) {
        setError("invalid_login");
      } else if (msg.toLowerCase().includes("email not confirmed")) {
        setError(
          "Votre compte est en attente de validation par l'équipe Lit uP. Vous recevrez un email dès qu'il sera activé."
        );
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 14px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    fontSize: "15px",
    outline: "none",
    transition: "border-color 0.2s",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f0fdfa 0%, #f0f4ff 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 16px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "white",
          borderRadius: "16px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            background: "#2B3442",
            padding: "32px 32px 28px",
            textAlign: "center",
          }}
        >
          <Link href="/">
            <img
              src="/logo-litup-white.png"
              alt="Lit uP"
              style={{ height: "40px", marginBottom: "14px", cursor: "pointer" }}
            />
          </Link>
          <h1
            style={{
              color: "white",
              fontSize: "22px",
              fontWeight: 700,
              margin: 0,
            }}
          >
            Connexion
          </h1>
          <p
            style={{
              color: "rgba(255,255,255,0.7)",
              fontSize: "14px",
              marginTop: "6px",
            }}
          >
            Accédez à la Boîte à Outils
          </p>
        </div>

        {/* Form */}
        <div style={{ padding: "32px" }}>
          {error && error !== "invalid_login" && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                padding: "12px 16px",
                color: "#dc2626",
                fontSize: "14px",
                marginBottom: "20px",
              }}
            >
              {error}
            </div>
          )}

          {error === "invalid_login" && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "12px",
                padding: "16px 20px",
                marginBottom: "20px",
              }}
            >
              <div style={{ color: "#dc2626", fontSize: "14px", fontWeight: 600, marginBottom: "8px" }}>
                Email ou mot de passe incorrect
              </div>
              <p style={{ color: "#6b7280", fontSize: "13px", margin: "0 0 12px 0", lineHeight: "1.5" }}>
                Vérifiez vos identifiants. Si vous n'avez pas encore de compte, créez-en un pour accéder à la Boîte à Outils.
              </p>
              <Link
                href="/inscription"
                style={{
                  display: "inline-block",
                  padding: "8px 20px",
                  borderRadius: "8px",
                  background: "#00989D",
                  color: "white",
                  fontSize: "13px",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                Créer un compte
              </Link>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#2B3442",
                  marginBottom: "6px",
                }}
              >
                Email
              </label>
              <input
                type="email"
                style={inputStyle}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError("");
                }}
                placeholder="votre@email.fr"
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#2B3442",
                  marginBottom: "6px",
                }}
              >
                Mot de passe
              </label>
              <PasswordInput
                style={inputStyle}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder="Votre mot de passe"
                onKeyDown={(e) => e.key === "Enter" && handleSubmit(e)}
              />
              <Link
                href="/connexion/mot-de-passe-oublie"
                style={{
                  display: "block",
                  marginTop: "6px",
                  fontSize: "13px",
                  color: "#00989D",
                  textDecoration: "none",
                  textAlign: "right",
                }}
              >
                Mot de passe oublié ?
              </Link>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border: "none",
                background: loading ? "#9ca3af" : "#00989D",
                color: "white",
                fontSize: "16px",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                marginTop: "4px",
              }}
            >
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </div>

          <p
            style={{
              textAlign: "center",
              marginTop: "24px",
              fontSize: "14px",
              color: "#6b7280",
            }}
          >
            Pas encore de compte ?{" "}
            <Link
              href="/inscription"
              style={{
                color: "#00989D",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
