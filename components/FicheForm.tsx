"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, type Cle, type Etape, slugify } from "@/lib/supabase";
import RichTextEditor from "@/components/RichTextEditor";

interface ObjectifItem { titre: string; detail: string }
interface DerouleStep { titre: string; duree: string; actions: string[]; image_url?: string }
interface PdfItem { nom: string; url: string }

interface FicheFormProps { ficheId?: string }

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://odadaqpihvcnuprkdchr.supabase.co";

function getPublicUrl(bucket: string, path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

export default function FicheForm({ ficheId }: FicheFormProps) {
  const router = useRouter();
  const isEdit = !!ficheId;

  const [etapes, setEtapes] = useState<Etape[]>([]);
  const [allCles, setAllCles] = useState<Cle[]>([]);
  const [selectedCles, setSelectedCles] = useState<string[]>([]);
  const [allObjectifs, setAllObjectifs] = useState<{id: string; nom: string; emoji: string | null; ordre: number}[]>([]);
  const [selectedObjectifs, setSelectedObjectifs] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  // Erreur d'envoi de fichier (image ou PDF), affichée près du bouton concerné :
  // sans ça, un échec d'upload n'était visible que dans la console.
  const [uploadError, setUploadError] = useState("");

  const [nom, setNom] = useState("");
  const [etapeId, setEtapeId] = useState("");
  const [dureeMin, setDureeMin] = useState("");
  const [dureeMax, setDureeMax] = useState("");
  const [dureeLibre, setDureeLibre] = useState("");
  const [format, setFormat] = useState("");
  const [participants, setParticipants] = useState("");
  const [materiel, setMateriel] = useState("");
  const [pourQui, setPourQui] = useState("");
  const [publicProPair, setPublicProPair] = useState("");
  const [typeOutil, setTypeOutil] = useState("");
  const [intention, setIntention] = useState("");
  const [pourquoi, setPourquoi] = useState("");
  const [source, setSource] = useState("");
  const [publie, setPublie] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [emoji, setEmoji] = useState("");

  const [objectifs, setObjectifs] = useState<ObjectifItem[]>([]);
  const [materielListe, setMaterielListe] = useState<string[]>([]);
  const [deroule, setDeroule] = useState<DerouleStep[]>([]);
  const [conseils, setConseils] = useState<string[]>([]);
  const [variantes, setVariantes] = useState<string[]>([]);

  // Nouvelles colonnes
  const [illustrations, setIllustrations] = useState<string[]>([]);
  const [pdfsComplementaires, setPdfsComplementaires] = useState<PdfItem[]>([]);

  useEffect(() => {
    async function loadData() {
      const [{ data: etapesData }, { data: clesData }, { data: objectifsData }] = await Promise.all([
        supabase.from("etapes_parcours").select("*").order("ordre"),
        supabase.from("cles").select("*").order("ordre"),
        supabase.from("objectifs").select("id, nom, emoji, ordre").order("ordre"),
      ]);
      setEtapes(etapesData || []);
      setAllCles(clesData || []);
      setAllObjectifs(objectifsData || []);

      if (ficheId) {
        const { data: fiche } = await supabase.from("fiches").select("*").eq("id", ficheId).single();
        if (fiche) {
          setNom(fiche.nom || "");
          setEtapeId(fiche.etape_id || "");
          setDureeMin(fiche.duree_min?.toString() || "");
          setDureeMax(fiche.duree_max?.toString() || "");
          setDureeLibre(fiche.duree_libre || "");
          setFormat(fiche.format || "");
          setParticipants(fiche.participants || "");
          setMateriel(fiche.materiel || "");
          setPourQui(fiche.pour_qui || "");
          setPublicProPair(fiche.public_pro_pair || "");
          setTypeOutil(fiche.type_outil || "");
          setIntention(fiche.intention || "");
          setPourquoi(fiche.pourquoi || "");
          setSource(fiche.source || "");
          setPublie(fiche.publie || false);
          setPdfUrl(fiche.pdf_url || "");
          setEmoji(fiche.emoji || "");

          setObjectifs(parseObjectifs(fiche.objectifs));
          setMaterielListe(parseStringList(fiche.materiel_liste));
          setDeroule(parseDeroule(fiche.deroule));
          setConseils(parseStringList(fiche.conseils));
          setVariantes(parseStringList(fiche.variantes));

          // Nouvelles colonnes
          setIllustrations(Array.isArray(fiche.illustrations) ? fiche.illustrations : []);
          setPdfsComplementaires(Array.isArray(fiche.pdfs_complementaires) ? fiche.pdfs_complementaires : []);
        }

        const { data: ficheCles } = await supabase.from("fiches_cles").select("cle_id").eq("fiche_id", ficheId);
        if (ficheCles) setSelectedCles(ficheCles.map((fc: any) => fc.cle_id));

        const { data: ficheObjectifs } = await supabase.from("objectifs_fiches").select("objectif_id").eq("fiche_id", ficheId);
        if (ficheObjectifs) setSelectedObjectifs(ficheObjectifs.map((fo: any) => fo.objectif_id));
      }
    }
    loadData();
  }, [ficheId]);

  /* ── Parsers ── */
  function parseObjectifs(val: any): ObjectifItem[] {
    const arr = parseAny(val);
    if (!Array.isArray(arr)) return [];
    return arr.map((item: any) => {
      if (typeof item === "string") return { titre: item, detail: "" };
      return { titre: item.titre || item.title || item.objectif || "", detail: item.detail || item.description || "" };
    });
  }

  function parseStringList(val: any): string[] {
    const arr = parseAny(val);
    if (!Array.isArray(arr)) return [];
    return arr.map((item: any) => {
      if (typeof item === "string") return item;
      return item.item || item.titre || item.conseil || item.variante || item.text || Object.values(item).join(" - ");
    });
  }

  function parseDeroule(val: any): DerouleStep[] {
    const arr = parseAny(val);
    if (!Array.isArray(arr)) return [];
    return arr.map((step: any) => ({
      titre: step.titre || step.title || "",
      duree: step.duree || step.duree || "",
      actions: Array.isArray(step.actions) ? step.actions : [],
      image_url: step.image_url || undefined,
    }));
  }

  function parseAny(val: any): any {
    if (!val) return null;
    if (typeof val === "object") return val;
    try { return JSON.parse(val); } catch { return null; }
  }

  /* ── Serializers (return [] instead of null to respect NOT NULL constraints) ── */
  function serializeObjectifs(): any {
    const filtered = objectifs.filter((o) => o.titre.trim());
    if (filtered.length === 0) return [];
    return filtered.map((o) => o.detail.trim() ? { titre: o.titre, detail: o.detail } : o.titre);
  }

  function serializeStringList(list: string[]): any {
    const filtered = list.filter((s) => s.trim());
    return filtered.length > 0 ? filtered : [];
  }

  function serializeDeroule(): any {
    const filtered = deroule.filter((s) => s.titre.trim());
    if (filtered.length === 0) return [];
    return filtered.map((s, i) => ({
      etape: i + 1,
      titre: s.titre,
      duree: s.duree || undefined,
      actions: s.actions.filter((a) => a.trim()),
      image_url: s.image_url || undefined,
    }));
  }

  /* ── Upload helpers ── */
  async function uploadImage(file: File, folder: string): Promise<string | null> {
    const ext = file.name.split(".").pop() || "jpg";
    const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("fiches-images").upload(fileName, file, { upsert: true });
    if (error) {
      console.error("Upload image error:", error);
      setUploadError(`Image « ${file.name} » non envoyée : ${error.message}`);
      return null;
    }
    return getPublicUrl("fiches-images", fileName);
  }

  async function uploadPdf(file: File): Promise<string | null> {
    const slug = slugify(nom || "fiche");
    const safeName = slugify(file.name.replace(".pdf", "")) + ".pdf";
    const fileName = `${slug}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from("fiches-pdf").upload(fileName, file, { upsert: true });
    if (error) {
      console.error("Upload PDF error:", error);
      setUploadError(`PDF « ${file.name} » non envoyé : ${error.message}`);
      return null;
    }
    return getPublicUrl("fiches-pdf", fileName);
  }

  async function handleIllustrationUpload(files: FileList) {
    setUploading(true);
    setUploadError("");
    const slug = slugify(nom || "fiche");
    const newUrls: string[] = [];
    for (const file of Array.from(files)) {
      const url = await uploadImage(file, slug);
      if (url) newUrls.push(url);
    }
    setIllustrations((prev) => [...prev, ...newUrls]);
    setUploading(false);
    if (newUrls.length > 0) {
      setSuccess(`${newUrls.length} illustration(s) ajoutee(s)`);
      setTimeout(() => setSuccess(""), 3000);
    }
  }

  async function handleStepImageUpload(file: File, stepIndex: number) {
    setUploading(true);
    setUploadError("");
    const slug = slugify(nom || "fiche");
    const url = await uploadImage(file, `${slug}/deroule`);
    if (url) {
      const copy = [...deroule];
      copy[stepIndex].image_url = url;
      setDeroule(copy);
    }
    setUploading(false);
  }

  async function handlePdfComplementaireUpload(file: File) {
    setUploading(true);
    setUploadError("");
    const url = await uploadPdf(file);
    if (url) {
      setPdfsComplementaires((prev) => [...prev, { nom: file.name.replace(".pdf", ""), url }]);
      setSuccess("PDF ajouté");
      setTimeout(() => setSuccess(""), 3000);
    }
    setUploading(false);
  }

  function toggleCle(cleId: string) {
    setSelectedCles((prev) => prev.includes(cleId) ? prev.filter((id) => id !== cleId) : [...prev, cleId]);
  }

  async function handlePdfUpload(file: File) {
    setUploading(true);
    setError("");
    const slug = slugify(nom || "fiche");
    const fileName = `${slug}.pdf`;
    const { error: uploadError } = await supabase.storage.from("fiches-pdf").upload(fileName, file, { upsert: true });
    if (uploadError) { setError("Erreur upload PDF : " + uploadError.message); setUploading(false); return; }
    setPdfUrl(`/pdfs/${fileName}`);
    setUploading(false);
    setSuccess("PDF principal uploadé.");
    setTimeout(() => setSuccess(""), 3000);
  }

  async function handleSubmit() {
    if (!nom.trim()) { setError("Le nom est obligatoire."); return; }
    setSaving(true);
    setError("");

    const ficheData = {
      nom: nom.trim(), slug: slugify(nom),
      etape_id: etapeId || null,
      duree_min: dureeMin ? parseInt(dureeMin) : null,
      duree_max: dureeMax ? parseInt(dureeMax) : null,
      duree_libre: dureeLibre || null,
      format: format || null, participants: participants || null,
      materiel: materiel || null, pour_qui: pourQui || null,
      public_pro_pair: publicProPair || null, type_outil: typeOutil || null,
      intention: intention || null, pourquoi: pourquoi || null,
      objectifs: serializeObjectifs(),
      materiel_liste: serializeStringList(materielListe),
      deroule: serializeDeroule(),
      conseils: serializeStringList(conseils),
      variantes: serializeStringList(variantes),
      source: source || null, publie, pdf_url: pdfUrl || null,
      emoji: emoji || null,
      illustrations: illustrations.length > 0 ? illustrations : [],
      pdfs_complementaires: pdfsComplementaires.length > 0 ? pdfsComplementaires : [],
    };

    let savedId = ficheId;
    if (isEdit) {
      const { error } = await supabase.from("fiches").update(ficheData).eq("id", ficheId);
      if (error) { setError("Erreur : " + error.message); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from("fiches").insert(ficheData).select("id").single();
      if (error) { setError("Erreur : " + error.message); setSaving(false); return; }
      savedId = data.id;
    }

    // Sync clés associations
    if (savedId) {
      await supabase.from("fiches_cles").delete().eq("fiche_id", savedId);
      if (selectedCles.length > 0) {
        await supabase.from("fiches_cles").insert(
          selectedCles.map((cleId, i) => ({ fiche_id: savedId, cle_id: cleId, ordre: i + 1 }))
        );
      }
    }

    // Sync objectifs associations
    if (savedId) {
      await supabase.from("objectifs_fiches").delete().eq("fiche_id", savedId);
      if (selectedObjectifs.length > 0) {
        await supabase.from("objectifs_fiches").insert(
          selectedObjectifs.map((objId, i) => ({ fiche_id: savedId, objectif_id: objId, ordre: i + 1 }))
        );
      }
    }

    setSaving(false);
    router.push("/admin/fiches");
  }

  /* ═══ RENDU ═══ */
  return (
    <div style={{ maxWidth: "800px" }}>
      <h1 style={{ fontSize: "28px", fontWeight: 800, color: "var(--anthracite)", marginBottom: "28px" }}>
        {isEdit ? "Modifier la fiche" : "Nouvelle fiche"}
      </h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

        {/* ═══ Informations principales ═══ */}
        <SectionTitle text="Informations principales" />
        <Field label="Nom de la fiche *">
          <input type="text" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Ex: Brise-glace Antisava" style={inputStyle} />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "16px", alignItems: "end" }}>
          <Field label="Emoji">
            <input type="text" value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🔧" style={{ ...inputStyle, fontSize: "28px", textAlign: "center", padding: "6px" }} maxLength={4} />
          </Field>
          <div style={{ fontSize: "12px", color: "var(--muted)", paddingBottom: "12px" }}>
            Choisissez un emoji pour illustrer l'outil (visible sur la carte). Exemples : 🤪 🎯 💬 🃏 🎨 🧭 🔥 💡 📝
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <Field label="Etape du parcours">
            <select value={etapeId} onChange={(e) => setEtapeId(e.target.value)} style={inputStyle}>
              <option value="">-- Aucune --</option>
              {etapes.map((e) => <option key={e.id} value={e.id}>{e.code} - {e.nom}</option>)}
            </select>
          </Field>
          <Field label="Public vise">
            <select value={publicProPair} onChange={(e) => setPublicProPair(e.target.value)} style={inputStyle}>
              <option value="">-- Non specifie --</option>
              <option value="PRO">PRO</option>
              <option value="PAIR">PAIR</option>
              <option value="PRO - PAIR">PRO - PAIR</option>
            </select>
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
          <Field label="Duree min (min)">
            <input type="number" value={dureeMin} onChange={(e) => setDureeMin(e.target.value)} placeholder="30" style={inputStyle} />
          </Field>
          <Field label="Duree max (min)">
            <input type="number" value={dureeMax} onChange={(e) => setDureeMax(e.target.value)} placeholder="60" style={inputStyle} />
          </Field>
          <Field label="Duree libre">
            <input type="text" value={dureeLibre} onChange={(e) => setDureeLibre(e.target.value)} placeholder="Ex: 1h30 a 2h" style={inputStyle} />
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <Field label="Format">
            <input type="text" value={format} onChange={(e) => setFormat(e.target.value)} placeholder="Ex: Collectif" style={inputStyle} />
          </Field>
          <Field label="Participants">
            <input type="text" value={participants} onChange={(e) => setParticipants(e.target.value)} placeholder="Ex: 8 a 15" style={inputStyle} />
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <Field label="Materiel (resume)">
            <input type="text" value={materiel} onChange={(e) => setMateriel(e.target.value)} placeholder="Ex: Materiel de base" style={inputStyle} />
          </Field>
          <Field label="Source">
            <input type="text" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Ex: Inspire de..." style={inputStyle} />
          </Field>
        </div>

        {/* ═══ Illustrations (carrousel) ═══ */}
        <SectionTitle text="Illustrations" />
        <p style={{ fontSize: "13px", color: "var(--muted)", marginTop: "-8px" }}>
          Images affichees en carrousel en haut de la fiche. Formats acceptes : JPG, PNG, WebP.
        </p>

        {illustrations.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "10px" }}>
            {illustrations.map((url, i) => (
              <div key={i} style={{ position: "relative", borderRadius: "10px", overflow: "hidden", border: "2px solid var(--line)", aspectRatio: "4/3" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Illustration ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button
                  onClick={() => setIllustrations(illustrations.filter((_, j) => j !== i))}
                  style={{ position: "absolute", top: "4px", right: "4px", width: "24px", height: "24px", borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "white", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        )}

        <label style={{ ...addBtn, display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
          {uploading ? "Upload en cours..." : "+ Ajouter des illustrations"}
          <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { if (e.target.files) handleIllustrationUpload(e.target.files); }} />
        </label>
        {uploadError && <div style={uploadErrorStyle}>{uploadError}</div>}

        {/* ═══ Objectifs BAO (catégories) ═══ */}
        <SectionTitle text="Objectifs BAO (catégories)" />
        <p style={{ fontSize: "13px", color: "var(--muted)", marginTop: "-8px", marginBottom: "8px" }}>
          Dans quelle(s) catégorie(s) cette fiche apparaît-elle sur la BAO ?
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {allObjectifs.map((obj) => {
            const selected = selectedObjectifs.includes(obj.id);
            return (
              <button
                key={obj.id}
                type="button"
                onClick={() => setSelectedObjectifs((prev) => prev.includes(obj.id) ? prev.filter((id) => id !== obj.id) : [...prev, obj.id])}
                style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "8px 12px", background: selected ? "#e0f7f7" : "white",
                  border: `1.5px solid ${selected ? "var(--canard)" : "var(--line)"}`,
                  borderRadius: "10px", cursor: "pointer", fontFamily: "inherit",
                  textAlign: "left", fontSize: "13px", color: "var(--anthracite)", transition: "all 0.15s",
                }}
              >
                <span style={{
                  width: "18px", height: "18px", borderRadius: "4px", flexShrink: 0,
                  border: selected ? "none" : "2px solid var(--line-strong)",
                  background: selected ? "var(--canard)" : "white",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "white", fontSize: "11px", fontWeight: 700,
                }}>
                  {selected ? "✓" : ""}
                </span>
                <span style={{ fontSize: "18px" }}>{obj.emoji || "📋"}</span>
                <span style={{ fontWeight: 600 }}>{obj.nom}</span>
              </button>
            );
          })}
        </div>

        {/* ═══ Contenu pedagogique ═══ */}
        <SectionTitle text="Contenu pedagogique" />
        <Field label="Intention">
          <RichTextEditor value={intention} onChange={setIntention} placeholder="La phrase d'accroche..." rows={2} />
        </Field>
        <Field label="Pourquoi cet outil fonctionne">
          <RichTextEditor value={pourquoi} onChange={setPourquoi} placeholder="Explication pedagogique..." rows={3} />
        </Field>

        {/* ═══ Objectifs pédagogiques ═══ */}
        <SectionTitle text="Objectifs pedagogiques" />
        {objectifs.map((obj, i) => (
          <div key={i} style={{ background: "white", border: "2px solid var(--line)", borderRadius: "12px", padding: "14px", position: "relative" }}>
            <button onClick={() => setObjectifs(objectifs.filter((_, j) => j !== i))} style={removeBtn} title="Supprimer">x</button>
            <Field label={`Objectif ${i + 1}`}>
              <input type="text" value={obj.titre} onChange={(e) => { const copy = [...objectifs]; copy[i].titre = e.target.value; setObjectifs(copy); }} placeholder="Titre de l'objectif" style={inputStyle} />
            </Field>
            <div style={{ marginTop: "8px" }}>
              <Field label="Detail (optionnel)">
                <input type="text" value={obj.detail} onChange={(e) => { const copy = [...objectifs]; copy[i].detail = e.target.value; setObjectifs(copy); }} placeholder="Precision supplementaire..." style={inputStyle} />
              </Field>
            </div>
          </div>
        ))}
        <button onClick={() => setObjectifs([...objectifs, { titre: "", detail: "" }])} style={addBtn}>+ Ajouter un objectif</button>

        {/* ═══ Materiel liste ═══ */}
        <SectionTitle text="Liste materiel detaillee" />
        <SimpleList items={materielListe} onChange={setMaterielListe} placeholder="Ex: Post-its de couleur" itemLabel="materiel" />

        {/* ═══ Deroule (avec images par etape) ═══ */}
        <SectionTitle text="Deroule" />
        {deroule.map((step, i) => (
          <div key={i} style={{ background: "white", border: "2px solid var(--line)", borderRadius: "12px", padding: "16px", position: "relative" }}>
            <button onClick={() => setDeroule(deroule.filter((_, j) => j !== i))} style={removeBtn} title="Supprimer">x</button>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <span style={{ width: "28px", height: "28px", borderRadius: "50%", background: "var(--canard)", color: "white", fontWeight: 800, fontSize: "13px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
              <input type="text" value={step.titre} onChange={(e) => { const copy = [...deroule]; copy[i].titre = e.target.value; setDeroule(copy); }} placeholder="Titre de l'etape" style={{ ...inputStyle, fontWeight: 700 }} />
              <input type="text" value={step.duree} onChange={(e) => { const copy = [...deroule]; copy[i].duree = e.target.value; setDeroule(copy); }} placeholder="Duree" style={{ ...inputStyle, maxWidth: "120px" }} />
            </div>

            {/* Actions */}
            <div style={{ paddingLeft: "38px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Actions</div>
              {step.actions.map((action, j) => (
                <div key={j} style={{ display: "flex", gap: "8px", marginBottom: "6px", alignItems: "flex-start" }}>
                  <div style={{ flex: 1 }}>
                    <RichTextEditor value={action} onChange={(val) => { const copy = [...deroule]; copy[i].actions[j] = val; setDeroule(copy); }} placeholder={`Action ${j + 1}`} rows={1} />
                  </div>
                  <button onClick={() => { const copy = [...deroule]; copy[i].actions = copy[i].actions.filter((_, k) => k !== j); setDeroule(copy); }} style={{ ...removeBtn, position: "relative", top: 0, right: 0, width: "32px", height: "32px", fontSize: "14px", marginTop: "6px" }}>x</button>
                </div>
              ))}
              <button onClick={() => { const copy = [...deroule]; copy[i].actions = [...copy[i].actions, ""]; setDeroule(copy); }} style={{ ...addBtn, fontSize: "12px", padding: "4px 12px" }}>+ Action</button>
            </div>

            {/* Image pour cette etape */}
            <div style={{ paddingLeft: "38px", marginTop: "12px", paddingTop: "12px", borderTop: "1px dashed var(--line)" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--muted)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Illustration de l'etape</div>
              {step.image_url ? (
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={step.image_url} alt={`Etape ${i + 1}`} style={{ width: "120px", height: "80px", objectFit: "cover", borderRadius: "8px", border: "2px solid var(--line)" }} />
                  <button onClick={() => { const copy = [...deroule]; copy[i].image_url = undefined; setDeroule(copy); }} style={{ fontSize: "12px", color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>Supprimer</button>
                </div>
              ) : (
                <label style={{ ...addBtn, fontSize: "12px", padding: "4px 12px", cursor: "pointer", display: "inline-flex" }}>
                  + Image
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) handleStepImageUpload(file, i); }} />
                </label>
              )}
            </div>
          </div>
        ))}
        <button onClick={() => setDeroule([...deroule, { titre: "", duree: "", actions: [""] }])} style={addBtn}>+ Ajouter une etape</button>

        {/* ═══ Conseils ═══ */}
        <SectionTitle text="Conseils pour bien animer" />
        <SimpleList items={conseils} onChange={setConseils} placeholder="Ex: Rester attentif aux dynamiques..." itemLabel="conseil" />

        {/* ═══ Variantes ═══ */}
        <SectionTitle text="Variantes possibles" />
        <SimpleList items={variantes} onChange={setVariantes} placeholder="Ex: Version courte (30 min)..." itemLabel="variante" />

        {/* ═══ Cles d'engagement ═══ */}
        <SectionTitle text="Cles d'engagement" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {allCles.map((cle) => {
            const active = selectedCles.includes(cle.id);
            return (
              <button key={cle.id} type="button" onClick={() => toggleCle(cle.id)} style={{
                padding: "6px 14px", borderRadius: "14px", fontSize: "13px", fontWeight: 600,
                border: `2px solid ${active ? (cle.couleur_hex || "var(--canard)") : "var(--line)"}`,
                background: active ? (cle.couleur_hex || "var(--canard)") : "white",
                color: active ? "white" : "var(--anthracite)",
                cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
              }}>
                {cle.nom.split(" (")[0]}
              </button>
            );
          })}
        </div>

        {/* ═══ PDF principal ═══ */}
        <SectionTitle text="Fiche PDF (principale)" />
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <label style={{ padding: "10px 20px", background: "white", border: "2px dashed var(--line-strong)", borderRadius: "12px", fontSize: "14px", fontWeight: 600, color: "var(--anthracite)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px" }}>
            {uploading ? "Upload en cours..." : "Choisir un PDF"}
            <input type="file" accept=".pdf" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) handlePdfUpload(file); }} />
          </label>
          {pdfUrl && <span style={{ fontSize: "13px", color: "var(--canard)", fontWeight: 600 }}>OK {pdfUrl.split("/").pop()}</span>}
        </div>

        {/* ═══ PDFs complementaires ═══ */}
        <SectionTitle text="Ressources PDF complementaires" />
        <p style={{ fontSize: "13px", color: "var(--muted)", marginTop: "-8px" }}>
          Documents a imprimer, supports de jeu, fiches participant, etc.
        </p>

        {pdfsComplementaires.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {pdfsComplementaires.map((pdf, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px", background: "white", border: "2px solid var(--line)", borderRadius: "10px" }}>
                <span style={{ fontSize: "18px" }}>PDF</span>
                <input
                  type="text"
                  value={pdf.nom}
                  onChange={(e) => { const copy = [...pdfsComplementaires]; copy[i].nom = e.target.value; setPdfsComplementaires(copy); }}
                  placeholder="Nom du document"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <a href={pdf.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "12px", color: "var(--canard)", fontWeight: 600, whiteSpace: "nowrap" }}>Voir</a>
                <button onClick={() => setPdfsComplementaires(pdfsComplementaires.filter((_, j) => j !== i))} style={{ ...removeBtn, position: "relative", top: 0, right: 0, width: "28px", height: "28px", fontSize: "12px" }}>x</button>
              </div>
            ))}
          </div>
        )}

        <label style={{ ...addBtn, display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
          {uploading ? "Upload en cours..." : "+ Ajouter un PDF complementaire"}
          <input type="file" accept=".pdf" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) handlePdfComplementaireUpload(file); }} />
        </label>
        {uploadError && <div style={uploadErrorStyle}>{uploadError}</div>}

        {/* ═══ Publication ═══ */}
        <SectionTitle text="Publication" />
        <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }}>
          <div onClick={() => setPublie(!publie)} style={{ width: "44px", height: "24px", borderRadius: "12px", background: publie ? "var(--canard)" : "var(--line-strong)", position: "relative", transition: "background 0.2s", cursor: "pointer" }}>
            <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "white", position: "absolute", top: "2px", left: publie ? "22px" : "2px", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
          </div>
          <span style={{ fontSize: "14px", fontWeight: 600, color: publie ? "var(--canard-dark)" : "var(--muted)" }}>
            {publie ? "Publie (visible sur le site)" : "Brouillon (non visible)"}
          </span>
        </label>

        {/* ═══ Messages ═══ */}
        {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "12px", padding: "12px 16px", fontSize: "14px", color: "#dc2626" }}>Erreur : {error}</div>}
        {success && <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "12px", padding: "12px 16px", fontSize: "14px", color: "#16a34a" }}>{success}</div>}

        {/* ═══ Actions ═══ */}
        <div style={{ display: "flex", gap: "12px", paddingTop: "16px", borderTop: "2px solid var(--line)" }}>
          <button onClick={handleSubmit} disabled={saving} style={{ padding: "12px 28px", background: saving ? "var(--muted)" : "var(--canard)", color: "white", border: "none", borderRadius: "12px", fontSize: "15px", fontWeight: 700, fontFamily: "inherit", cursor: saving ? "wait" : "pointer" }}>
            {saving ? "Enregistrement..." : isEdit ? "Enregistrer" : "Creer la fiche"}
          </button>
          <button onClick={() => router.push("/admin/fiches")} style={{ padding: "12px 28px", background: "white", color: "var(--anthracite)", border: "2px solid var(--line-strong)", borderRadius: "12px", fontSize: "15px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══ SOUS-COMPOSANTS ═══ */

function SimpleList({ items, onChange, placeholder, itemLabel }: { items: string[]; onChange: (items: string[]) => void; placeholder: string; itemLabel: string }) {
  return (
    <>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <RichTextEditor value={item} onChange={(val) => { const copy = [...items]; copy[i] = val; onChange(copy); }} placeholder={placeholder} rows={1} />
          </div>
          <button onClick={() => onChange(items.filter((_, j) => j !== i))} style={{ ...removeBtn, position: "relative", top: 0, right: 0, width: "32px", height: "32px", fontSize: "14px", marginTop: "6px" }}>x</button>
        </div>
      ))}
      <button onClick={() => onChange([...items, ""])} style={addBtn}>+ Ajouter un {itemLabel}</button>
    </>
  );
}

function SectionTitle({ text }: { text: string }) {
  return <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--anthracite)", marginTop: "8px", paddingTop: "16px", borderTop: "2px solid var(--line)" }}>{text}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "var(--anthracite)", marginBottom: "6px" }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", border: "2px solid var(--line-strong)", borderRadius: "10px",
  fontSize: "14px", fontFamily: "inherit", color: "var(--anthracite)", outline: "none",
  boxSizing: "border-box", transition: "border-color 0.2s", background: "white",
};

const uploadErrorStyle: React.CSSProperties = {
  background: "#fef2f2",
  border: "1px solid #fecaca",
  borderRadius: "10px",
  padding: "10px 14px",
  fontSize: "13px",
  color: "#dc2626",
};

const addBtn: React.CSSProperties = {
  padding: "8px 16px", background: "white", border: "2px dashed var(--line-strong)", borderRadius: "10px",
  fontSize: "13px", fontWeight: 600, color: "var(--canard)", cursor: "pointer", fontFamily: "inherit",
  transition: "all 0.15s", alignSelf: "flex-start",
};

const removeBtn: React.CSSProperties = {
  position: "absolute", top: "10px", right: "10px", width: "28px", height: "28px", borderRadius: "50%",
  background: "var(--blanc)", border: "1px solid var(--line)", fontSize: "12px", color: "var(--muted)",
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit",
  flexShrink: 0,
};
