"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type PasswordInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
>;

/**
 * Champ mot de passe avec bouton « œil » pour afficher ou masquer la saisie.
 * Accepte toutes les props d'un <input> natif (style, value, onChange, onKeyDown...).
 * Le style passé est conservé, on réserve seulement la place du bouton à droite.
 */
export default function PasswordInput({ style, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const libelle = visible ? "Masquer le mot de passe" : "Afficher le mot de passe";

  return (
    <div style={{ position: "relative" }}>
      <input
        {...props}
        type={visible ? "text" : "password"}
        style={{ ...style, paddingRight: "44px" }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={libelle}
        title={libelle}
        style={{
          position: "absolute",
          top: "50%",
          right: "10px",
          transform: "translateY(-50%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "28px",
          height: "28px",
          padding: 0,
          border: "none",
          borderRadius: "6px",
          background: "transparent",
          color: "#6b7280",
          cursor: "pointer",
        }}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
