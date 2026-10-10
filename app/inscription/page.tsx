"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signUp, logAuthError, SignUpData } from "@/lib/auth";
import Link from "next/link";
import PasswordInput from "@/components/PasswordInput";

const CATEGORIES_PRO = [
  "Conseiller·ère Mission Locale",
  "Conseiller·ère France Travail",
  "Éducateur·rice spécialisé·e",
  "Animateur·rice jeunesse",
  "Formateur·rice",
  "Coordinateur·rice",
  "Directeur·rice de structure",
  "Travailleur·se social·e",
  "Enseignant·e",
  "Autre",
];

const REGIONS = [
  "Auvergne-Rhône-Alpes",
  "Bourgogne-Franche-Comté",
  "Bretagne",
  "Centre-Val de Loire",
  "Corse",
  "Grand Est",
  "Hauts-de-France",
  "Île-de-France",
  "Normandie",
  "Nouvelle-Aquitaine",
  "Occitanie",
  "Pays de la Loire",
  "Provence-Alpes-Côte d'Azur",
  "Guadeloupe",
  "Guyane",
  "Martinique",
  "Mayotte",
  "La Réunion",
];

const TRANCHES_AGE = [
  "Moins de 25 ans",
  "25-30 ans",
  "30-40 ans",
  "40-50 ans",
  "50-60 ans",
  "Plus de 60 ans",
];

const PUBLICS = [
  "Moins de 14 ans",
  "14-16 ans",
  "16-18 ans",
  "18-25 ans",
  "25-30 ans",
  "Plus de 30 ans",
];

export default function InscriptionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState(1);

  const [form, setForm] = useState<SignUpData & { password: string; password_confirm: string }>({
    email: "",
    password: "",
    password_confirm: "",
    prenom: "",
    nom: "",
    telephone: "",
    structure: "",
    poste: "",
    code_postal: "",
    categorie_pro: "",
    categorie_pro_autre: "",
    region: "",
    tranche_age: "",
    public_accompagne: "",
    newsletter_consent: false,
  });

  const [cguAccepted, setCguAccepted] = useState(false);
  // Estimation du nombre de jeunes accompagnés par an (fourchette)
  const [jeunesMin, setJeunesMin] = useState("");
  const [jeunesMax, setJeunesMax] = useState("");

  function updateForm(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError("");
  }

  function validateStep1() {
    if (!form.prenom.trim()) return "Le prénom est requis";
    if (!form.nom.trim()) return "Le nom est requis";
    if (!form.email.trim()) return "L'email est requis";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      return "Format d'email invalide";
    if (form.password.length < 8)
      return "Le mot de passe doit contenir au moins 8 caractères";
    if (form.password !== form.password_confirm)
      return "Les mots de passe ne correspondent pas";
    return null;
  }

  function validateStep2() {
    if (!form.categorie_pro) return "La catégorie professionnelle est requise";
    if (form.categorie_pro === "Autre" && !form.categorie_pro_autre?.trim())
      return "Précisez votre catégorie professionnelle";
    if (!form.structure?.trim()) return "La structure est requise";
    if (!jeunesMin.trim() || !jeunesMax.trim())
      return "Indiquez une estimation du nombre de jeunes accompagnés par an";
    const jMin = parseInt(jeunesMin, 10);
    const jMax = parseInt(jeunesMax, 10);
    if (isNaN(jMin) || isNaN(jMax) || jMin < 0 || jMax < 0)
      return "Le nombre de jeunes doit être un nombre positif";
    if (jMin > jMax)
      return "La fourchette basse ne peut pas dépasser la fourchette haute";
    return null;
  }

  function validateStep3() {
    if (!cguAccepted)
      return "Vous devez accepter les conditions d'utilisation";
    return null;
  }

  function handleNext() {
    if (step === 1) {
      const err = validateStep1();
      if (err) {
        setError(err);
        return;
      }
      setStep(2);
    } else if (step === 2) {
      const err = validateStep2();
      if (err) {
        setError(err);
        return;
      }
      setStep(3);
    }
  }

  async function handleSubmit() {
    const err = validateStep3();
    if (err) {
      setError(err);
      return;
    }

    setLoading(true);
    setError("");

    try {
      await signUp({
        email: form.email,
        password: form.password,
        prenom: form.prenom.trim(),
        nom: form.nom.trim(),
        telephone: form.telephone?.trim() || undefined,
        structure: form.structure?.trim() || undefined,
        poste: form.poste?.trim() || undefined,
        code_postal: form.code_postal?.trim() || undefined,
        categorie_pro: form.categorie_pro,
        categorie_pro_autre:
          form.categorie_pro === "Autre"
            ? form.categorie_pro_autre?.trim()
            : undefined,
        region: form.region || undefined,
        tranche_age: form.tranche_age || undefined,
        public_accompagne: form.public_accompagne || undefined,
        jeunes_par_an_min: jeunesMin ? parseInt(jeunesMin, 10) : undefined,
        jeunes_par_an_max: jeunesMax ? parseInt(jeunesMax, 10) : undefined,
        newsletter_consent: form.newsletter_consent,
      });

      router.push("/inscription/confirmation");
    } catch (e: unknown) {
      // Les erreurs Supabase (AuthError, PostgrestError) ne sont pas toujours des
      // instances de Error : on extrait le message dès qu'il est disponible pour
      // ne pas masquer la vraie cause derrière un message générique.
      let msg = "Une erreur est survenue";
      if (e instanceof Error) {
        msg = e.message;
      } else if (
        e &&
        typeof e === "object" &&
        "message" in e &&
        typeof (e as { message: unknown }).message === "string"
      ) {
        msg = (e as { message: string }).message;
      }

      // Journalise l'erreur pour les alertes admin (ne bloque pas si ça échoue).
      logAuthError("signup", form.email, msg);

      if (/already registered|already been registered/i.test(msg)) {
        setError("Un compte existe déjà avec cet email");
      } else if (/email rate limit|rate limit exceeded/i.test(msg)) {
        setError(
          "Trop de demandes d'inscription pour le moment. Merci de réessayer dans quelques minutes."
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
    padding: "10px 14px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    fontSize: "15px",
    outline: "none",
    transition: "border-color 0.2s",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "14px",
    fontWeight: 600,
    color: "#2B3442",
    marginBottom: "6px",
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
          maxWidth: "560px",
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
            padding: "28px 32px",
            textAlign: "center",
          }}
        >
          <Link href="/">
            <img
              src="/logo-litup-white.png"
              alt="Lit uP"
              style={{ height: "40px", marginBottom: "12px", cursor: "pointer" }}
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
            Accéder à la Boîte à Outils
          </h1>
          <p
            style={{
              color: "rgba(255,255,255,0.7)",
              fontSize: "14px",
              marginTop: "6px",
            }}
          >
            Créez votre compte professionnel
          </p>
        </div>

        {/* Progress bar */}
        <div style={{ display: "flex", gap: "4px", padding: "0 32px", marginTop: "20px" }}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: "4px",
                borderRadius: "2px",
                background: s <= step ? "#00989D" : "#e5e7eb",
                transition: "background 0.3s",
              }}
            />
          ))}
        </div>
        <p
          style={{
            textAlign: "center",
            fontSize: "13px",
            color: "#6b7280",
            marginTop: "8px",
          }}
        >
          Étape {step} sur 3 :{" "}
          {step === 1
            ? "Identité"
            : step === 2
            ? "Profil professionnel"
            : "Validation"}
        </p>

        {/* Form */}
        <div style={{ padding: "20px 32px 32px" }}>
          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                padding: "12px 16px",
                color: "#dc2626",
                fontSize: "14px",
                marginBottom: "16px",
              }}
            >
              {error}
            </div>
          )}

          {/* ÉTAPE 1 : Identité */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>
                    Prénom <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    style={inputStyle}
                    value={form.prenom}
                    onChange={(e) => updateForm("prenom", e.target.value)}
                    placeholder="Votre prénom"
                  />
                </div>
                <div>
                  <label style={labelStyle}>
                    Nom <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    style={inputStyle}
                    value={form.nom}
                    onChange={(e) => updateForm("nom", e.target.value)}
                    placeholder="Votre nom"
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>
                  Email professionnel <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="email"
                  style={inputStyle}
                  value={form.email}
                  onChange={(e) => updateForm("email", e.target.value)}
                  placeholder="prenom.nom@structure.fr"
                />
              </div>

              <div>
                <label style={labelStyle}>Téléphone</label>
                <input
                  type="tel"
                  style={inputStyle}
                  value={form.telephone}
                  onChange={(e) => updateForm("telephone", e.target.value)}
                  placeholder="06 00 00 00 00"
                />
              </div>

              <div>
                <label style={labelStyle}>
                  Mot de passe <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <PasswordInput
                  style={inputStyle}
                  value={form.password}
                  onChange={(e) => updateForm("password", e.target.value)}
                  placeholder="8 caractères minimum"
                />
              </div>

              <div>
                <label style={labelStyle}>
                  Confirmer le mot de passe{" "}
                  <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <PasswordInput
                  style={inputStyle}
                  value={form.password_confirm}
                  onChange={(e) =>
                    updateForm("password_confirm", e.target.value)
                  }
                  placeholder="Retapez votre mot de passe"
                />
              </div>
            </div>
          )}

          {/* ÉTAPE 2 : Profil pro */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={labelStyle}>
                  Catégorie professionnelle{" "}
                  <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select
                  style={{ ...inputStyle, cursor: "pointer" }}
                  value={form.categorie_pro}
                  onChange={(e) => updateForm("categorie_pro", e.target.value)}
                >
                  <option value="">Sélectionnez...</option>
                  {CATEGORIES_PRO.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {form.categorie_pro === "Autre" && (
                <div>
                  <label style={labelStyle}>
                    Précisez <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <input
                    style={inputStyle}
                    value={form.categorie_pro_autre}
                    onChange={(e) =>
                      updateForm("categorie_pro_autre", e.target.value)
                    }
                    placeholder="Votre fonction"
                  />
                </div>
              )}

              <div>
                <label style={labelStyle}>
                  Structure / Organisme{" "}
                  <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  style={inputStyle}
                  value={form.structure}
                  onChange={(e) => updateForm("structure", e.target.value)}
                  placeholder="Nom de votre structure"
                />
              </div>

              <div>
                <label style={labelStyle}>Poste</label>
                <input
                  style={inputStyle}
                  value={form.poste}
                  onChange={(e) => updateForm("poste", e.target.value)}
                  placeholder="Intitulé de poste"
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                }}
              >
                <div>
                  <label style={labelStyle}>Région</label>
                  <select
                    style={{ ...inputStyle, cursor: "pointer" }}
                    value={form.region}
                    onChange={(e) => updateForm("region", e.target.value)}
                  >
                    <option value="">Sélectionnez...</option>
                    {REGIONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Code postal</label>
                  <input
                    style={inputStyle}
                    value={form.code_postal}
                    onChange={(e) => updateForm("code_postal", e.target.value)}
                    placeholder="83000"
                    maxLength={5}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Tranche d'âge</label>
                <select
                  style={{ ...inputStyle, cursor: "pointer" }}
                  value={form.tranche_age}
                  onChange={(e) => updateForm("tranche_age", e.target.value)}
                >
                  <option value="">Sélectionnez...</option>
                  {TRANCHES_AGE.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Public accompagné (plusieurs choix possibles)</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                  {PUBLICS.map((p) => {
                    const selected = (form.public_accompagne || "").split(", ").filter(Boolean);
                    const isChecked = selected.includes(p);
                    return (
                      <label
                        key={p}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          cursor: "pointer",
                          fontSize: "14px",
                          color: "#374151",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          background: isChecked ? "#f0fdfa" : "transparent",
                          border: isChecked ? "1px solid #99f6e4" : "1px solid transparent",
                          transition: "all 0.15s",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            const newSelected = isChecked
                              ? selected.filter((s) => s !== p)
                              : [...selected, p];
                            updateForm("public_accompagne", newSelected.join(", "));
                          }}
                          style={{ width: "16px", height: "16px", accentColor: "#00989D" }}
                        />
                        {p}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={labelStyle}>
                  Nombre de jeunes accompagnés par an (estimation){" "}
                  <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "14px", color: "#6b7280" }}>entre</span>
                  <input
                    type="number"
                    min={0}
                    style={{ ...inputStyle, width: "110px" }}
                    value={jeunesMin}
                    onChange={(e) => {
                      setJeunesMin(e.target.value);
                      setError("");
                    }}
                    placeholder="20"
                  />
                  <span style={{ fontSize: "14px", color: "#6b7280" }}>et</span>
                  <input
                    type="number"
                    min={0}
                    style={{ ...inputStyle, width: "110px" }}
                    value={jeunesMax}
                    onChange={(e) => {
                      setJeunesMax(e.target.value);
                      setError("");
                    }}
                    placeholder="50"
                  />
                  <span style={{ fontSize: "14px", color: "#6b7280" }}>jeunes / an</span>
                </div>
                <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "6px" }}>
                  Une estimation suffit. Cela nous aide à mesurer la portée de la Boîte à Outils auprès des jeunes.
                </p>
              </div>
            </div>
          )}

          {/* ÉTAPE 3 : Validation */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Récapitulatif */}
              <div
                style={{
                  background: "#f9fafb",
                  borderRadius: "10px",
                  padding: "20px",
                }}
              >
                <h3
                  style={{
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "#2B3442",
                    marginBottom: "12px",
                  }}
                >
                  Récapitulatif
                </h3>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                    fontSize: "14px",
                  }}
                >
                  <span style={{ color: "#6b7280" }}>Nom :</span>
                  <span style={{ color: "#2B3442", fontWeight: 500 }}>
                    {form.prenom} {form.nom}
                  </span>
                  <span style={{ color: "#6b7280" }}>Email :</span>
                  <span style={{ color: "#2B3442", fontWeight: 500 }}>
                    {form.email}
                  </span>
                  <span style={{ color: "#6b7280" }}>Structure :</span>
                  <span style={{ color: "#2B3442", fontWeight: 500 }}>
                    {form.structure}
                  </span>
                  <span style={{ color: "#6b7280" }}>Catégorie :</span>
                  <span style={{ color: "#2B3442", fontWeight: 500 }}>
                    {form.categorie_pro === "Autre"
                      ? form.categorie_pro_autre
                      : form.categorie_pro}
                  </span>
                  {form.region && (
                    <>
                      <span style={{ color: "#6b7280" }}>Région :</span>
                      <span style={{ color: "#2B3442", fontWeight: 500 }}>
                        {form.region}
                      </span>
                    </>
                  )}
                  {(jeunesMin || jeunesMax) && (
                    <>
                      <span style={{ color: "#6b7280" }}>Jeunes / an :</span>
                      <span style={{ color: "#2B3442", fontWeight: 500 }}>
                        entre {jeunesMin || "?"} et {jeunesMax || "?"}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* CGU */}
              <label
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "flex-start",
                  cursor: "pointer",
                  fontSize: "14px",
                  color: "#374151",
                }}
              >
                <input
                  type="checkbox"
                  checked={cguAccepted}
                  onChange={(e) => {
                    setCguAccepted(e.target.checked);
                    setError("");
                  }}
                  style={{ marginTop: "3px", width: "18px", height: "18px" }}
                />
                <span>
                  J'accepte les{" "}
                  <a
                    href="/cgu"
                    target="_blank"
                    style={{ color: "#00989D", textDecoration: "underline" }}
                  >
                    conditions générales d'utilisation
                  </a>{" "}
                  et la{" "}
                  <a
                    href="/confidentialite"
                    target="_blank"
                    style={{ color: "#00989D", textDecoration: "underline" }}
                  >
                    politique de confidentialité
                  </a>
                  .
                </span>
              </label>

              {/* Newsletter */}
              <label
                style={{
                  display: "flex",
                  gap: "10px",
                  alignItems: "flex-start",
                  cursor: "pointer",
                  fontSize: "14px",
                  color: "#374151",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.newsletter_consent}
                  onChange={(e) =>
                    updateForm("newsletter_consent", e.target.checked)
                  }
                  style={{ marginTop: "3px", width: "18px", height: "18px" }}
                />
                <span>
                  Je souhaite recevoir les actualités de Lit uP (nouveaux
                  outils, formations, événements).
                </span>
              </label>

              <div
                style={{
                  background: "#f0fdfa",
                  border: "1px solid #99f6e4",
                  borderRadius: "8px",
                  padding: "14px 16px",
                  fontSize: "13px",
                  color: "#0f766e",
                  lineHeight: "1.5",
                }}
              >
                Votre demande sera examinée par l'équipe Lit uP. Vous recevrez
                un email de confirmation une fois votre accès validé
                (généralement sous 48h).
              </div>
            </div>
          )}

          {/* Boutons navigation */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: "24px",
              gap: "12px",
            }}
          >
            {step > 1 ? (
              <button
                onClick={() => {
                  setStep(step - 1);
                  setError("");
                }}
                style={{
                  padding: "12px 24px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  background: "white",
                  color: "#374151",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Retour
              </button>
            ) : (
              <div />
            )}

            {step < 3 ? (
              <button
                onClick={handleNext}
                style={{
                  padding: "12px 32px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#00989D",
                  color: "white",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Suivant
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                style={{
                  padding: "12px 32px",
                  borderRadius: "8px",
                  border: "none",
                  background: loading ? "#9ca3af" : "#00989D",
                  color: "white",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                }}
              >
                {loading ? "Envoi en cours..." : "Créer mon compte"}
              </button>
            )}
          </div>

          {/* Lien connexion */}
          <p
            style={{
              textAlign: "center",
              marginTop: "20px",
              fontSize: "14px",
              color: "#6b7280",
            }}
          >
            Déjà un compte ?{" "}
            <Link
              href="/connexion"
              style={{ color: "#00989D", fontWeight: 600, textDecoration: "none" }}
            >
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
