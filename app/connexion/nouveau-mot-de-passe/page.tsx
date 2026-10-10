"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import PasswordInput from "@/components/PasswordInput";

export default function NouveauMotDePassePage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // Supabase gère automatiquement le token dans l'URL
    // On écoute l'événement PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "PASSWORD_RECOVERY") {
          setSessionReady(true);
        }
      }
    );

    // Vérifier aussi si on a déjà une session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => router.push("/connexion"), 3000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Une erreur est survenue";
      setError(msg);
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
            Nouveau mot de passe
          </h1>
        </div>

        <div style={{ padding: "32px" }}>
          {success ? (
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  background: "#f0fdfa",
                  border: "3px solid #00989D",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                  fontSize: "28px",
                }}
              >
                ✓
              </div>
              <h2
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "#2B3442",
                  marginBottom: "12px",
                }}
              >
                Mot de passe mis à jour !
              </h2>
              <p
                style={{
                  fontSize: "15px",
                  color: "#6b7280",
                  lineHeight: "1.6",
                }}
              >
                Redirection vers la page de connexion...
              </p>
            </div>
          ) : !sessionReady ? (
            <div style={{ textAlign: "center" }}>
              <p
                style={{
                  fontSize: "15px",
                  color: "#6b7280",
                  lineHeight: "1.6",
                  marginBottom: "24px",
                }}
              >
                Chargement de la session...
              </p>
              <p
                style={{
                  fontSize: "13px",
                  color: "#9ca3af",
                }}
              >
                Si cette page ne se charge pas, le lien a peut-être expiré.{" "}
                <Link
                  href="/connexion/mot-de-passe-oublie"
                  style={{ color: "#00989D", textDecoration: "underline" }}
                >
                  Demander un nouveau lien
                </Link>
              </p>
            </div>
          ) : (
            <>
              {error && (
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
                    Nouveau mot de passe
                  </label>
                  <PasswordInput
                    style={inputStyle}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    placeholder="8 caractères minimum"
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
                    Confirmer le nouveau mot de passe
                  </label>
                  <PasswordInput
                    style={inputStyle}
                    value={passwordConfirm}
                    onChange={(e) => {
                      setPasswordConfirm(e.target.value);
                      setError("");
                    }}
                    placeholder="Retapez votre mot de passe"
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit(e)}
                  />
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
                  }}
                >
                  {loading ? "Mise à jour..." : "Changer le mot de passe"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
