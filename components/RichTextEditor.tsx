"use client";

import { useRef, useCallback, useEffect } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  rows?: number;
}

const LIT_UP_COLORS = [
  { label: "Teal", color: "#00989D" },
  { label: "Anthracite", color: "#2B3442" },
  { label: "Jaune", color: "#FCC33E" },
  { label: "Violet", color: "#6B2468" },
  { label: "Noir", color: "#000000" },
];

export default function RichTextEditor({ value, onChange, placeholder, rows = 4 }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const lastValueRef = useRef(value);

  useEffect(() => {
    if (!editorRef.current) return;
    if (value !== lastValueRef.current || !initializedRef.current) {
      if (!initializedRef.current || (editorRef.current.innerHTML !== value && !document.activeElement?.closest("[contenteditable]"))) {
        editorRef.current.innerHTML = value || "";
        initializedRef.current = true;
        lastValueRef.current = value;
      }
    }
  }, [value]);

  /**
   * Transmet le contenu courant au parent. Appelé à chaque saisie, après
   * chaque commande de la barre d'outils et au blur. Ne pas se contenter du
   * blur : sur Safari, cliquer sur « Enregistrer » ne retire pas le focus de
   * la zone éditable, et les dernières modifications étaient perdues.
   */
  const emit = useCallback(() => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    lastValueRef.current = html;
    onChange(html);
  }, [onChange]);

  const exec = useCallback((command: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, val);
    emit();
  }, [emit]);

  const insertTextAtCursor = useCallback((text: string) => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.setEndAfter(textNode);
      sel.removeAllRanges();
      sel.addRange(range);
    }
    emit();
  }, [emit]);

  const insertLink = useCallback(() => {
    const sel = window.getSelection();
    const selectedText = sel && sel.rangeCount > 0 ? sel.toString() : "";

    const url = prompt("URL du lien :", "https://");
    if (!url || url === "https://") return;

    const text = selectedText || prompt("Texte du lien :", url);
    if (!text) return;

    editorRef.current?.focus();

    if (selectedText) {
      // Du texte est sélectionné : on le transforme en lien
      document.execCommand("insertHTML", false, `<a href="${url}" target="_blank" rel="noopener">${selectedText}</a>`);
    } else {
      // Pas de sélection : on insère un nouveau lien
      document.execCommand("insertHTML", false, `<a href="${url}" target="_blank" rel="noopener">${text}</a>&nbsp;`);
    }
    emit();
  }, [emit]);

  const removeLink = useCallback(() => {
    editorRef.current?.focus();
    document.execCommand("unlink", false);
    emit();
  }, [emit]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  }, []);

  const btnStyle: React.CSSProperties = {
    height: "28px",
    border: "1.5px solid var(--line-strong)",
    borderRadius: "6px",
    background: "white",
    color: "var(--anthracite)",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "inherit",
    transition: "all 0.1s",
    flexShrink: 0,
    padding: "0 8px",
    gap: "4px",
  };

  const separatorStyle: React.CSSProperties = {
    width: "1px",
    height: "20px",
    background: "var(--line-strong)",
    margin: "0 4px",
    flexShrink: 0,
  };

  return (
    <div style={{ border: "2px solid var(--line-strong)", borderRadius: "10px", overflow: "hidden", background: "white" }}>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "3px",
          padding: "6px 10px",
          borderBottom: "1.5px solid var(--line)",
          background: "var(--blanc)",
          flexWrap: "wrap",
        }}
      >
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("bold"); }} style={btnStyle} title="Gras">
          <strong>G</strong>
        </button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("italic"); }} style={btnStyle} title="Italique">
          <em style={{ fontStyle: "italic" }}>I</em>
        </button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); exec("underline"); }} style={btnStyle} title="Souligner">
          <span style={{ textDecoration: "underline" }}>S</span>
        </button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); insertTextAtCursor("\u00B7"); }} style={{ ...btnStyle, fontSize: "18px", fontWeight: 800 }} title="Point médian (ex: un·e)">
          ·
        </button>

        <div style={separatorStyle} />

        <button type="button" onMouseDown={(e) => { e.preventDefault(); insertLink(); }} style={{ ...btnStyle, color: "var(--canard)" }} title="Insérer un lien (ouvre dans un nouvel onglet)">
          🔗 Lien
        </button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); removeLink(); }} style={{ ...btnStyle, color: "var(--muted)", fontSize: "11px" }} title="Supprimer le lien">
          ✕ Lien
        </button>

        <div style={separatorStyle} />

        {LIT_UP_COLORS.map((c) => (
          <button
            key={c.color}
            type="button"
            onMouseDown={(e) => { e.preventDefault(); exec("foreColor", c.color); }}
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              border: "2px solid var(--line)",
              background: c.color,
              cursor: "pointer",
              flexShrink: 0,
            }}
            title={`Couleur : ${c.label}`}
          />
        ))}

        <div style={separatorStyle} />

        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); exec("removeFormat"); }}
          style={{ ...btnStyle, color: "var(--muted)" }}
          title="Effacer la mise en forme"
        >
          Effacer
        </button>
      </div>

      {/* Editable area */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={emit}
        onPaste={handlePaste}
        style={{
          padding: "10px 14px",
          minHeight: `${rows * 24}px`,
          fontSize: "14px",
          fontFamily: "inherit",
          color: "var(--anthracite)",
          lineHeight: 1.6,
          outline: "none",
          overflowY: "auto",
          maxHeight: "400px",
        }}
        data-placeholder={placeholder}
      />

      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: var(--muted);
          font-style: italic;
          pointer-events: none;
        }
        [contenteditable] a {
          color: var(--canard);
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
