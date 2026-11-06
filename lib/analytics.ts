import { supabase } from "./supabase";

// Types d'événements d'usage journalisés dans public.analytics_events.
//   - barometre_analyse : résultats du baromètre générés sur /bao/analyse
//     (metadata : mode photo_ia/manuel, matériel, type d'évaluation, nb jeunes)
//   - diagnostic_pro    : auto-diagnostic complété sur /bao/diagnostic-pro
//     (metadata : objectif, statut de l'analyse IA ok/quota/erreur, nb jeunes)
export type AnalyticsEventType =
  | "session_start"
  | "pdf_download"
  | "search"
  | "barometre_analyse"
  | "diagnostic_pro";

/**
 * Journalise un événement d'usage. « Fire & forget » : ne lève jamais et ne
 * bloque jamais l'UX (un échec analytics ne doit pas impacter l'utilisateur).
 * Réservé aux utilisateurs connectés (le RLS impose user_id = auth.uid()).
 */
export async function logEvent(
  eventType: AnalyticsEventType,
  opts?: { ficheId?: string | null; metadata?: Record<string, unknown> }
): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;

    await supabase.from("analytics_events").insert({
      user_id: session.user.id,
      event_type: eventType,
      fiche_id: opts?.ficheId ?? null,
      metadata: opts?.metadata ?? null,
    });
  } catch (e) {
    console.error("logEvent:", eventType, e);
  }
}

/**
 * Journalise un début de session, une seule fois par session de navigation
 * (dédoublonné via sessionStorage). Sert à mesurer les visites / la rétention.
 */
export async function logSessionStartOnce(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const KEY = "bao_session_logged";
    if (sessionStorage.getItem(KEY)) return;
    sessionStorage.setItem(KEY, "1");
    await logEvent("session_start");
  } catch {
    /* sessionStorage indisponible (navigation privée stricte) : on ignore */
  }
}
