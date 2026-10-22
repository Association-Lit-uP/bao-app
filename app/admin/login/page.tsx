"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { logAuthError } from "@/lib/auth";
import PasswordInput from "@/components/PasswordInput";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      logAuthError("login", email, authError.message);
      setError("Email ou mot de passe incorrect.");
      setLoading(false);
      return;
    }

    router.push("/admin");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--blanc)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: "20px",
          border: "2px solid var(--line)",
          padding: "48px 40px",
          maxWidth: "420px",
          width: "100%",
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-litup.png"
            alt="Lit uP"
            style={{ height: "40px", width: "auto", margin: "0 auto 16px" }}
          />
          <h1
            style={{
              fontSize: "24px",
              fontWeight: 800,
              color: "var(--anthracite)",
              letterSpacing: "-0.02em",
            }}
          >
            Tableau de bord
          </h1>
          <p style={{ fontSize: "14px", color: "var(--muted)", marginTop: "4px" }}>
            Connectez-vous pour gérer la boîte à outils
          </p>
        </div>

        {/* Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--muted)",
                marginBottom: "6px",
              }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.fr"
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "2px solid var(--line-strong)",
                borderRadius: "12px",
                fontSize: "15px",
                fontFamily: "inherit",
                color: "var(--anthracite)",
                outline: "none",
                transition: "border-color 0.2s",
                boxSizing: "border-box",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--canard)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--line-strong)"; }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--muted)",
                marginBottom: "6px",
              }}
            >
              Mot de passe
            </label>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: "100%",
                padding: "12px 16px",
                border: "2px solid var(--line-strong)",
                borderRadius: "12px",
                fontSize: "15px",
                fontFamily: "inherit",
                color: "var(--anthracite)",
                outline: "none",
                transition: "border-color 0.2s",
                boxSizing: "border-box",
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--canard)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "var(--line-strong)"; }}
            />
          </div>

          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "10px",
                padding: "10px 14px",
                fontSize: "13px",
                color: "#dc2626",
                fontWeight: 500,
              }}
            >
              {error}
            </div>
          )}

          <button
            onClick={handleLogin}
            disabled={loading || !email || !password}
            style={{
              width: "100%",
              padding: "14px",
              background: loading ? "var(--muted)" : "var(--canard)",
              color: "white",
              border: "none",
              borderRadius: "12px",
              fontSize: "15px",
              fontWeight: 700,
              fontFamily: "inherit",
              cursor: loading ? "wait" : "pointer",
              transition: "all 0.2s",
              marginTop: "8px",
            }}
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </div>

        {/* Back link */}
        <div style={{ textAlign: "center", marginTop: "24px" }}>
          <a
            href="/"
            style={{
              fontSize: "13px",
              color: "var(--muted)",
              textDecoration: "none",
            }}
          >
            ← Retour à la boîte à outils
          </a>
        </div>
      </div>
    </div>
  );
}
