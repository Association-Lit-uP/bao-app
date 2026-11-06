# Mesure d'impact BAO — feuille de route & état (à jour 2026-06-26)

> Repo : `lit-up-fr/bao-app` (Next.js + Supabase + Airtable + Make + Vercel).
> Branche de travail : `claude/charming-noether-dbppod`. Workflow : code →
> migrations SQL (via MCP Supabase si dispo, sinon SQL fourni à exécuter) →
> merge sur `main` (Vercel déploie).
> Objectif : objectiver l'impact pour les financeurs (Fondation Pierre Bellon)
> + améliorer la BAO via l'observation des usages.

## ✅ Déjà livré (sur `main`)
- Reset mot de passe via Resend (Send Email Hook Supabase).
- Analytics réparé (lecture admin des consultations/favoris — RLS).
- Section Utilisateurs : colonnes « dernière connexion » + « nb de connexions » ;
  édition des profils (admin → non-admins, super-admin → tous).
- Collecte « jeunes accompagnés / an » (fourchette) à l'inscription.
- **Phase 1 tracking** : table `analytics_events` + events `session_start`,
  `pdf_download`, `search`, `barometre_analyse` (résultats du baromètre générés,
  mode photo IA ou manuel), `diagnostic_pro` (auto-diagnostic complété)
  (`lib/analytics.ts`).
- **Phase 4** : tableau de bord d'impact `/admin/impact`.
- **Intégration Airtable (bricks 1 & 2)** : inscription + « j'ai utilisé cet
  outil avec X jeunes » → Airtable.

## Intégration Airtable — LIVE ✅
- Base **« Base de données Professionnels »** : `appaXNMwXTOXWC3Bg`. Rapprochement
  par **email** (champ « Votre adresse email », table Professionnels
  `tblPoDAu8nllhe5oh`).
- Table **« Usages BAO »** : `tblEf39p0LTRPE2TB` (Email, Type d'événement,
  Prénom, Nom, Structure, Poste, Région, Code postal, Catégorie pro,
  Jeunes/an min, Jeunes/an max, Outil utilisé, Nb jeunes (outil), Date).
- **Make** : scénario « Integration Webhooks, Airtable » (id `9446612`, **ACTIF**)
  = Custom webhook → Airtable *Create a Record* (connexion Airtable id `629871`).
  Team Make `201432`, org `1070851`. (URL du webhook = var d'env Vercel, pas
  stockée dans le repo.)
- **BAO** : route `app/api/impact-event/route.ts` relaie vers
  `MAKE_IMPACT_WEBHOOK_URL` (var d'env Vercel, déjà définie). Helper
  `lib/impactSync.ts` (`pushImpactEvent`).
  - event `inscription` → envoyé depuis `lib/auth.ts` (`signUp`).
  - event `usage_outil` → `components/UsageOutilButton.tsx`, sur `FicheModal`
    + `/bao/[slug]`.
- Mappings Make en place : champs inscription + `Outil utilisé`←`fiche_nom`
  + `Nb jeunes (outil)`←`nb_jeunes`. Testé OK (2 lignes de test à supprimer :
  `test-make@lit-up.fr`).

## ▶️ Prochaine étape — Brique 3 : mini-enquêtes (#4/#5/#6 Fondation)
Décisions validées : enquêtes **in-app** (meilleur taux de réponse, la BAO sait
qui a répondu), réponses **synchronisées vers Airtable** via le même tuyau Make.
- **UI** : encart non-bloquant dans « Mon espace » (`app/mon-espace/page.tsx`).
  Baseline une fois à l'arrivée ; relance après ~3-4 semaines + usage
  (≥ 3 consultations). Fermable, jamais bloquant.
- **Questions** (cadre Fondation) :
  - #4 Outillage (baseline + après) : « niveau d'outillage pour remobiliser les
    jeunes les plus en difficulté » (1→5) ; « capacité à mettre en place des
    solutions pour limiter la démobilisation et le décrochage » (1→5).
  - #5 Pratique (après) : « votre pratique a-t-elle évolué grâce à la BAO ? » ;
    « avez-vous remobilisé des jeunes que vous n'auriez pas su accompagner ? »
  - #6 Diffusion (après) : « avez-vous partagé les outils à d'autres pros ?
    à combien ? »
- **Stockage** : nouvelle table Airtable **« Enquêtes BAO »** (échelles),
  alimentée par le même webhook (events `enquete_baseline` / `enquete_relance`)
  + un mapping Make. Côté BAO : table Supabase `impact_surveys` pour savoir qui
  a répondu (éviter de re-solliciter) → **migration à appliquer via MCP Supabase**.

## Reste à faire ensuite
- Nettoyage : supprimer les lignes de test `test-make@lit-up.fr` dans Usages BAO.
- Dashboard : rétention/cohortes une fois les `session_start` accumulés ;
  afficher les résultats d'enquêtes.
- (Plus tard) Héberger les questionnaires **jeunes** (autodétermination) dans la BAO.

## Supabase
- Projet ref : `odadaqpihvcnuprkdchr`. Utiliser le **MCP Supabase**
  (`mcp__supabase__*`) pour inspecter le schéma + appliquer les migrations.
- Fonctions RLS : `public.is_admin()`, `public.is_super_admin()` existent.
  L'admin lit profiles / retours / consultations / favoris / analytics_events /
  diagnostic_analyses. (`analyses` = propres lignes seulement — pas de lecture
  admin ; à ajouter si le dashboard doit l'agréger.)

## Pour reprendre (nouvelle session)
1. Vérifier que le serveur MCP **supabase** est « running » (`/mcp`).
2. Lire ce fichier.
3. Continuer la **brique 3**.
