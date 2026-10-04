# CLAUDE.md – Guide de collaboration BAO Lit uP

> Document de référence partagé pour toute personne (ou assistant IA) qui
> intervient sur `lit-up-fr/bao-app`. À lire avant la première contribution,
> à relire avant une grosse modif, à mettre à jour après chaque session.
>
> Dernière mise à jour : 3 octobre 2026.

---

## 1. Le projet en une minute

La **Boîte à outils Lit uP** (BAO) est l'application web de l'association
Lit uP (loi 1901). Elle met à disposition des pros de l'accompagnement
(missions locales, écoles de la 2e chance, associations, éducateurs...) des
fiches outils, des parcours guidés et des diagnostics assistés par IA pour
remobiliser les jeunes de 14 à 25 ans.

| | |
|---|---|
| **Prod** | `bao.lit-up.fr` (Vercel, déploiement auto sur `main`) |
| **Repo** | `github.com/lit-up-fr/bao-app` (privé) |
| **Stack** | Next.js 14 App Router · React 18 · TypeScript strict · Tailwind 3 |
| **Backend** | Supabase (Postgres + Auth + RLS), projet `odadaqpihvcnuprkdchr` |
| **IA** | SDK Anthropic (`@anthropic-ai/sdk`), corpus lu depuis Google Drive |
| **Intégrations** | Google Drive, Google Sheets (Apps Script), Make, Airtable, Resend |
| **Langue** | Interface, code, commentaires et commits : **français** |
| **Contact** | contact@lit-up.fr |

**Vocabulaire métier à respecter** (il structure la base de données) :

- **fiche** : un outil pédagogique de la BAO
- **objectif** : ce que le pro cherche à obtenir avec son groupe
- **clé d'engagement** : les 9 leviers de motivation (utilité, appartenance,
  considération, sécurité, progression, plaisir, action, liberté, sens)
- **étape** : position dans le parcours d'accompagnement
- **diagnostic** : auto-évaluation du pro, analysée par l'IA
- **proposition** : outil soumis par un utilisateur, à valider
- **retour** : retour d'expérience terrain sur une fiche

---

## 2. Qui travaille sur ce projet

| Contributeur | Rôle | Identité Git |
|---|---|---|
| Laetitia de Borde | Product owner et développeuse principale | `laetitia.deborde@lit-up.fr` (pro) et `laetitiadeborde@gmail.com` (perso, historique) |
| Claude (Claude Code) | Pair programmeur, migrations, sécurité, analytics | `noreply@anthropic.com` |
| Compte org | Merges de PR | `lit-up-fr` |

**Règle d'identité Git (importante)** : configure ton email **pro** dans le repo,
sinon Vercel bloque le déploiement (voir §8, piège « Deployment was blocked »).

```bash
git config --local user.email "prenom.nom@lit-up.fr"
git config --local user.name "Prénom Nom"
```

Quand plusieurs personnes contribuent en parallèle : une branche par chantier,
et on annonce dans le canal d'équipe ce qu'on touche. Les zones les plus
sensibles aux conflits sont `lib/auth.ts`, `app/admin/layout.tsx` et
`supabase/migrations/`.

---

## 3. Démarrage

### Prérequis
Node.js 20 ou plus, npm 10, un accès Supabase et Vercel du projet.

```bash
git clone https://github.com/lit-up-fr/bao-app.git
cd bao-app
npm install
cp .env.local.example .env.local   # puis renseigne tes vraies clés
npm run dev                        # http://localhost:3000
```

### Variables d'environnement

| Variable | Usage | Sensibilité |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase | publique |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | clé publique Supabase | publique |
| `SUPABASE_SECRET_KEY` | clé service_role, serveur uniquement | **secrète** |
| `ANTHROPIC_API_KEY` | analyses IA | **secrète** |
| `GOOGLE_API_KEY` | lecture du corpus Drive | **secrète** |
| `NEXT_PUBLIC_GOOGLE_CORPUS_FOLDER_ID` | dossier Drive du corpus IA | publique |
| `GOOGLE_APPS_SCRIPT_URL` | webhook « Retours terrain diagnostic » | **secrète** |
| `MAKE_IMPACT_WEBHOOK_URL` | relais impact vers Airtable via Make | **secrète** |

- `.env.local` n'est **jamais** commité (il est dans `.gitignore`).
- Les valeurs de prod vivent dans Vercel (Settings → Environment Variables).
- Sauvegarde ta copie dans le gestionnaire de mots de passe de l'asso, pas
  dans un fichier ni dans un message.
- Toute variable préfixée `NEXT_PUBLIC_` est **visible par le navigateur**.
  Une clé secrète ne prend jamais ce préfixe.

### Commandes

```bash
npm run dev     # serveur de dev
npm run build   # OBLIGATOIRE avant de pousser (voir §8)
npm run start   # build de prod en local
npm run lint    # lint Next.js
```

---

## 4. Carte du code

```
app/
├── layout.tsx              # layout racine (metadata, viewport, polices)
├── page.tsx                # accueil
├── globals.css             # variables CSS de la charte (source de vérité couleurs)
├── manifest.ts             # PWA
├── bao/                    # cœur applicatif
│   ├── page.tsx            # accueil BAO
│   ├── [slug]/             # détail d'une fiche
│   ├── diagnostiquer/      # grille des outils de diagnostic
│   ├── diagnostic-pro/     # questionnaire d'auto-diagnostic
│   ├── analyse/            # analyse photo du baromètre (jetons)
│   └── cles-motivation/    # les 9 clés d'engagement
├── parcours/               # parcours guidés
├── inscription/ connexion/ # auth (magic link, mot de passe, mot de passe oublié)
├── mon-espace/             # tableau de bord utilisateur
├── proposer/               # soumission d'un outil par un pro
├── roulette-questions/     # page publique « La roulette des défis »
├── admin/                  # back-office (voir rôles ci-dessous)
└── api/
    ├── analyze/            # Claude + corpus Drive + cache + quota
    ├── impact-event/       # relais vers Make puis Airtable
    └── admin/save-to-sheet # envoi vers Apps Script

components/                 # composants partagés (AppHeader, Sidebar, FicheCard,
                            # FicheModal, AuthGuard, RichTextEditor, FavoriButton...)
lib/
├── supabase.ts             # client navigateur + types métier + authHeaders()
├── supabase/client.ts      # client @supabase/ssr (navigateur)
├── supabase/server.ts      # client @supabase/ssr (cookies serveur)
├── auth.ts                 # profils, inscription, rôles, côté client
├── auth-server.ts          # getServerAuthContext(), authentification des routes API
├── analytics.ts            # journalisation d'usage (fire & forget)
├── impactSync.ts           # pushImpactEvent() vers Make
└── generateFichePdf.ts     # génération PDF via window.print(), annexes rendues par pdf.js

scripts/
└── copier-pdfjs.mjs        # copie pdf.js dans public/pdfjs/ à l'installation (postinstall)

public/pdfjs/               # généré par le script ci-dessus, ignoré par Git

supabase/
├── migrations/             # migrations SQL horodatées (source de vérité du schéma)
├── functions/              # Edge Functions Deno (send-welcome-email)
└── auth-hooks/             # Send Email Hook (emails Auth via Resend)

docs/                       # notes de conception et feuilles de route
```

### Tables Supabase principales

`profiles`, `fiches`, `objectifs`, `cles`, `etapes`, `parcours`,
`diagnostic_analyses`, `analyses_cache`, `propositions`, `retours`,
`favoris`, `consultations`, `analytics_events`, `auth_error_logs`.

### Rôles admin

Ils sont **cumulables**, stockés dans `profiles.admin_roles` (`text[]`).

| Rôle | Accès |
|---|---|
| `super_admin` | tout (override les autres) |
| `editor` | Fiches, Objectifs, Clés, Parcours, Étapes |
| `moderator` | Utilisateurs, Alertes |
| `pedagogical_reviewer` | Propositions, Analyses IA |
| `analyst` | Analytics, Impact |

Le mapping route → rôles vit dans `app/admin/layout.tsx` (constante `NAV_ITEMS`).
**Ajouter une page admin, c'est aussi l'ajouter là**, sinon elle est invisible
ou accessible à tort. Les champs `is_admin` et `admin_role` (singulier) sont des
vestiges conservés en fallback : on écrit toujours dans `admin_roles`.

---

## 5. Conventions de rédaction (non négociables)

Ces règles valent pour l'interface, les commentaires, les commits et la
documentation.

- **Jamais de tiret cadratin `—` dans le texte français.** Utiliser des
  parenthèses en priorité, sinon virgule, point-virgule ou deux-points.
  Le tiret demi-cadratin `–` reste acceptable pour une incise.
- Français clair et accessible, sans jargon ni anglicismes inutiles.
- **Vouvoiement pour les pros** (c'est le public de la BAO), tutoiement
  chaleureux si un contenu s'adresse directement aux jeunes.
- Éviter le mot « vulnérabilité » pour parler des jeunes en situation complexe.
- Le nom de l'association s'écrit **« Lit uP »**, sans « + », avec ce casing exact.
- Apostrophes : dans le JSX, utiliser `&apos;` (l'échappement `\'` casse le
  parseur SWC). Dans les strings JS, préférer les doubles quotes ou les backticks.

---

## 6. Conventions de code

### Charte graphique

La **source de vérité des couleurs, ce sont les variables CSS de
`app/globals.css`** (`--canard`, `--jaune`, `--anthracite`, `--prune`,
`--blanc`), plus les variables dérivées par étape (`--step-*`) et par clé
d'engagement (`--key-*`).

| Couleur | Hex | Usage |
|---|---|---|
| Anthracite | `#2B3442` | texte principal |
| Canard (teal) | `#00989D` | primaire, CTA, focus |
| Jaune | `#FCC33E` | accent, super admin, étapes finales |
| Prune | `#6B2468` | statuts spéciaux, rare |
| Blanc cassé | `#F6F6F8` | fond de page |

Typo : **Source Sans 3** (corps et titres), **Caveat** (accroches manuscrites).

**Icônes d'application** (famille visuelle sur l'écran d'accueil) : fond teal
`#00989D` plein cadre, pictogramme blanc, accent jaune `#FCC33D`. Le picto
respecte la zone de sécurité, les mêmes fichiers servant en `any` et en
`maskable`.

**Pages publiques événementielles** (celles qu'on atteint par un QR code) :
autonomes, sans lien vers le reste de l'app, `noindex, nofollow`, mobile-first,
`prefers-reduced-motion` respecté. Univers Archipel : fond crème `#FBF6EA`,
teal `#00989D`, jaune `#FCC33E`, texte `#2B3442`, touche violet `#6B2468`.
Référence : `app/roulette-questions/`. Les QR codes imprimés pointent sur une
URL de redirection déclarée dans `next.config.js` (par exemple
`/roulette-defis`), jamais sur la page finale : on peut ainsi changer la cible
sans réimprimer.

**État réel du style dans le repo** : le projet utilise très majoritairement
des **styles inline avec hex en dur** plutôt que les classes Tailwind
personnalisées (les tokens `canard`, `jaune`, `litup-*` définis dans les
configs Tailwind ne sont quasiment pas utilisés). C'est un héritage des
scripts `fix-*.sh` de la phase 2, où les classes custom ne compilaient pas.
Ne pars pas du principe qu'une classe `bg-canard` fonctionnera : vérifie, ou
reste sur `style={{ color: "#00989D" }}` comme le reste du fichier que tu
modifies. Si tu veux nettoyer cette dette, fais-en un chantier dédié (§10),
pas un effet de bord.

### React et Next.js

- **App Router uniquement**, pas de `pages/`.
- Aujourd'hui, 49 des 51 composants sont des **client components**
  (`"use client"` en tête). L'app est donc essentiellement client-side, avec
  `AuthGuard` pour protéger les pages. Reste cohérent avec la page que tu
  modifies plutôt que d'introduire un server component isolé au milieu.
- Pattern page + client : quand une page a besoin d'interactivité lourde,
  on sort la logique dans un fichier `xxx-client.tsx` à côté
  (`app/roulette-questions/roulette-client.tsx` est la référence).
- Icônes : **`lucide-react`** partout. Les emojis dans l'UI ont été migrés en
  mai 2026, ne les réintroduis pas (sauf champ emoji éditorial des clés).
- Alias d'import : `@/` pointe sur la racine (`@/lib/auth`, `@/components/...`).
- Les PDF sont générés via `window.print()` et une feuille de style dédiée
  (`lib/generateFichePdf.ts`), pas via une librairie de rendu. Le document
  imprimé intègre les illustrations et images d'étapes, garde les liens
  cliquables en affichant leur URL entre parenthèses, et ajoute à la suite de
  la fiche les pages des ressources complémentaires (`pdfs_complementaires`),
  rendues en images par pdf.js. Le nom de fichier proposé par le navigateur
  est le nom de l'outil : on positionne le titre de l'iframe **et** celui de
  la page parente le temps du dialogue d'impression (Chrome lit le second).
- pdf.js n'est pas empaqueté par webpack : `scripts/copier-pdfjs.mjs` copie le
  build `legacy` de `pdfjs-dist` dans `public/pdfjs/` à l'installation, et le
  code le charge à la demande par un `import()` natif marqué
  `/* webpackIgnore: true */` (voir §8, piège « pdf.js et Next.js »).

### Routes API

Trois règles pour toute route sous `app/api/` :

1. **L'identité ne vient jamais du corps de la requête.** On appelle
   `getServerAuthContext(req)` (`lib/auth-server.ts`), qui valide la session
   (Bearer token, avec fallback cookies) et renvoie `user`, `isAdmin`, `isActive`.
2. **Le client appelle avec `authHeaders()`** (`lib/supabase.ts`), qui ajoute
   l'en-tête `Authorization: Bearer <access_token>`. Les sessions sont en
   localStorage, elles ne voyagent pas toutes seules en cookie.
3. **Ne jamais renvoyer le détail d'une erreur interne** au navigateur. On log
   côté serveur (`console.error`), on renvoie un message générique.

Les routes best-effort (analytics, impact) ne doivent jamais bloquer l'UX :
elles avalent leurs erreurs et renvoient un statut non bloquant.

### Analyse photo et prompts Claude

- Les clés couleur internes sont **toujours** `rose`, `jaune`, `bleu`, `vert`
  (positions 1 à 4, poids 0, 33, 66, 100). Les libellés affichés et les noms
  envoyés à Claude peuvent différer (le pro déclare ses propres couleurs), mais
  on remappe toujours vers ces quatre clés avant de calculer les scores.
- Le contexte physique décrit à Claude dépend du matériel déclaré (jetons posés
  sur les cartes, gommettes sur un post-it de n'importe quelle couleur, feutres
  sur une feuille à côté). Ne réintroduis pas de matériel en dur dans le prompt
  (`contextePhysique`, `app/bao/analyse/page.tsx`).
- Quand le pro utilise des couleurs personnalisées, les libellés `c1` à `c4`
  sont construits depuis `customColorLabels` et injectés dans le prompt **et**
  dans le gabarit JSON attendu.
- Après analyse, on ne va **pas** directement aux résultats : on bascule en
  saisie manuelle pré-remplie (bandeau « Résultats détectés par l'IA », état
  `aiAnalyzed`). Le comptage automatique de jetons n'est pas assez fiable, la
  vérification humaine est obligatoire.
- `APPARTENANCE`, sur certaines versions des cartes, vaut `CONFIANCE`.

### Supabase et migrations

Toute modification de schéma s'écrit dans un fichier de
`supabase/migrations/`, horodaté en UTC. C'est la source de vérité du schéma,
même quand l'application se fait ailleurs.

```bash
supabase migration new nom_explicite      # ou fichier créé à la main :
date -u +"%Y%m%d%H%M%S"                   # -> {timestamp}_nom.sql
```

**Application : par le SQL Editor du dashboard, pas par `supabase db push`.**
L'historique des migrations est incomplet (`is_admin()`, `diagnostic_analyses`,
`analyses_cache` et plusieurs policies ont été créés directement dans le
dashboard). Un `db push` rejouerait d'anciennes migrations et échouerait, par
exemple sur un `CREATE POLICY` sans `DROP ... IF EXISTS`
(`supabase/migrations/20260527195812_security_warnings_fix.sql`). C'est une
dette connue (§10) : tant qu'elle n'est pas résorbée, on colle le SQL dans
l'éditeur et on garde le fichier au repo.

**Écris toujours des migrations idempotentes** : `CREATE OR REPLACE`,
`DROP ... IF EXISTS` avant chaque `CREATE POLICY`, `ALTER TABLE IF EXISTS`,
`CREATE TABLE IF NOT EXISTS`. Elles doivent pouvoir être rejouées sans casser.

Après application, lancer les advisors et corriger ce qui remonte :

```bash
supabase db advisors --type security --linked
supabase db advisors --type performance --linked
```

Les **edge functions** se déploient à part, hors Vercel :
`supabase functions deploy <nom>`.

**Checklist obligatoire pour toute nouvelle table :**

1. `CREATE TABLE`
2. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
3. `GRANT` explicites (les defaults du projet sont restrictifs, sans GRANT
   même `service_role` peut recevoir un `42501 permission denied`)
4. au moins une `CREATE POLICY` par opération nécessaire
5. les index qui vont avec

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ma_table TO authenticated;
GRANT ALL ON public.ma_table TO service_role;
```

Conventions observées dans les migrations existantes (à reprendre) :

- un en-tête de commentaire qui explique **pourquoi** la migration existe
- `DROP POLICY IF EXISTS` avant chaque `CREATE POLICY` (migrations rejouables)
- `(select auth.uid())` plutôt que `auth.uid()` dans les policies : c'est un
  gain de perf mesuré (l'expression est évaluée une fois, pas par ligne)
- helpers SQL en `SECURITY DEFINER` avec `SET search_path` explicite, pour
  éviter la récursion infinie des policies sur `profiles`
- après application, on relance les advisors et on corrige ce qui remonte

`supabase/migrations/` est la source de vérité du schéma. Si tu fais un
correctif à chaud en prod, écris quand même la migration correspondante.

---

## 7. Git, branches et revue

- Branche par défaut : `main`. **Tout push sur `main` déclenche un déploiement
  Vercel en production.** On ne pousse donc pas directement sur `main`.
- Une branche par chantier : `feat/nom-court`, `fix/nom-court`, ou
  `claude/...` pour les sessions Claude Code.
- Commits en français, préfixés par type :
  `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `style:`,
  avec portée quand c'est utile : `fix(auth):`, `feat(impact):`, `fix(sécurité):`.
  Le message décrit l'effet pour l'utilisateur, pas le fichier touché.
- Pull request pour toute modification qui touche l'auth, la sécurité, le
  schéma Supabase ou une route API. Le reste peut passer en direct sur une
  branche puis merge, mais la PR reste le format par défaut quand on est
  plusieurs.
- **Ne jamais amender ni force-pusher un commit déjà sur `main`** (y compris
  pour « corriger » l'auteur d'un commit).
- Avant de pousser : `npm run build` en local. C'est la règle qui évite le plus
  d'allers-retours (voir §8).
- **Délégation validée** : Claude peut créer la PR et la merger lui-même dans
  `main` quand Laetitia le lui demande (c'est ce qui a été fait pour les PR #5
  et #6). Ça ne change pas la règle : on passe par une PR, jamais par un push
  direct sur `main`.

---

## 8. Pièges connus (ne pas les refaire)

### Build

**`next build` est plus strict que `next dev`.** Vercel bloque ce que le dev
tolère. Lance toujours `npm run build` avant de pousser. Erreurs récurrentes :

- champ utilisé dans un `setState` mais absent de l'interface TypeScript
- props obligatoires manquantes (typique : `<AppHeader />` sans `searchQuery`
  et `onSearchChange`)
- **imports non utilisés** (icônes `lucide-react` laissées après un refactor) :
  `@typescript-eslint/no-unused-vars` fait échouer le build de prod
- jointures Supabase typées strictement : caster avec
  `.returns<TypeAttendu[]>()` après le `.select()`
- itération directe sur une `Map` : passer par `Array.from(map.values())`
- le `target` du `tsconfig.json` est `ES2020` (il l'a été passé de ES2017 pour
  supporter le flag regex `s`). Ne le baisse pas.

**Cache Next.js corrompu** : si le build échoue avec une erreur incompréhensible
du type `Cannot find module for page: /_document` ou `PageNotFoundError`, fais
`rm -rf .next && npm run build`.

### Fichiers de configuration en double (dette active)

Le repo contient **deux configs Next et deux configs Tailwind** :

| Fichier | Statut | Contenu |
|---|---|---|
| `next.config.js` | **actif** | `reactStrictMode`, redirect `/roulette-defis` |
| `next.config.mjs` | **ignoré** | `images.remotePatterns` pour Supabase |
| `tailwind.config.js` | **actif** | tokens `canard`, `jaune`, `anthracite`, `prune` |
| `tailwind.config.ts` | **ignoré** | tokens `litup-*` et safelist |

Next.js et Tailwind résolvent le `.js` en premier et ignorent l'autre fichier
en silence. Conséquence concrète : la config d'images distantes Supabase n'est
pas appliquée (sans effet aujourd'hui, `next/image` n'est pas utilisé), et les
tokens `litup-*` n'existent pas au runtime. **Si tu modifies une config,
modifie le `.js`**, et vérifie que ton changement est bien pris en compte.
Le nettoyage de ces doublons est un chantier ouvert (§10).

Piège voisin : une page qui appelle `redirect()` et qui est prérendue en
statique renvoie un 307 **sans header `Location`**, donc la redirection ne
fonctionne qu'avec JavaScript activé. Déclare-la dans `redirects()` de
`next.config.js`, comme c'est fait pour `/roulette-defis` vers
`/roulette-questions`.

### Vercel « Deployment was blocked »

Symptôme : le commit poussé remonte en échec GitHub, sans aucune erreur de
build. Cause : l'email Git du commit n'est pas rattaché au compte Vercel
propriétaire (Vercel Hobby ne gère pas les contributeurs externes sur un repo
privé). Correctif : `git config --local user.email "prenom.nom@lit-up.fr"`,
puis un commit vide (`git commit --allow-empty -m "trigger redeploy"`) pour
relancer un build avec le bon auteur. On n'amende pas l'historique.

### Auth et sécurité

- **Le profil est créé par un trigger serveur**, pas par un `INSERT` client.
  À l'inscription, on passe les données de profil en métadonnées
  (`raw_user_meta_data`) et le trigger `on_auth_user_created` fait le reste.
  Un `INSERT` direct est bloqué par le RLS quand la confirmation d'email est
  active (il n'y a pas encore de session).
- **Le gate d'accès, c'est la validation admin, et elle seule** :
  `profiles.status = 'active'`. La **confirmation d'email Supabase Auth est
  désactivée** (Authentication puis Sign In / Providers, onglet Supabase Auth,
  section User Signups, et non dans la fenêtre du provider Email). Elle faisait
  doublon avec la validation admin et bloquait des comptes pourtant validés.
  **Ne la réactive pas** sans avoir d'abord déployé l'edge function
  `send-welcome-email`, qui confirme l'email au moment de l'approbation et qui
  n'a jamais été déployée à ce jour.
  Pour rattraper d'anciens comptes `active` restés non confirmés :
  `UPDATE auth.users SET email_confirmed_at = now()` filtré sur
  `profiles.status = 'active'` et `email_confirmed_at IS NULL`, voir
  `supabase/migrations/20260619120000_confirm_email_for_active_users.sql`.
- **Escalade de privilèges** : un utilisateur ne doit jamais pouvoir modifier
  son propre `admin_roles` ni son `status`. La policy RLS « Update profiles »
  autorise la modification de sa propre ligne sans restriction de colonne : le
  verrou est donc le trigger `trg_prevent_profile_priv_esc` (fonction
  `prevent_profile_privilege_escalation`), qui bloque `is_admin`, `admin_role`,
  `admin_roles` et `status` pour les non-admins. Les routes API revérifient
  côté serveur. Une vérification uniquement dans l'UI ne protège rien.
- **Les rôles admin ne sont pas encore appliqués en base** : le RLS ne teste
  que `is_admin()`, le détail des rôles ne vit que côté client
  (`app/admin/layout.tsx`). Un admin « restreint » a donc, en base, les droits
  d'un admin complet. À corriger avant de déléguer un rôle restreint (§10).
- Il n'y a **pas de `middleware.ts`** : la protection est par route, pas
  globale (§10).
- Les emails d'authentification passent par le **Send Email Hook** Supabase
  vers Resend (`supabase/auth-hooks/send_auth_email.sql`).

### RLS

- Un helper SQL en `SECURITY INVOKER` appelé depuis une policy sur la même
  table provoque une récursion infinie (`stack depth limit exceeded`, 54001).
  Les helpers doivent être `SECURITY DEFINER`, `STABLE`, avec `SET search_path`
  explicite et un `GRANT EXECUTE ... TO authenticated`.
- Ajouter une seconde clé étrangère vers `profiles` sur une table qui en avait
  déjà une casse **silencieusement** tous les `.select("...profiles(...)")`
  existants (`PGRST201 Could not embed`). Correctif : nommer la contrainte
  dans la requête, `profiles!ma_table_user_id_fkey(...)`. À tester
  immédiatement après ce genre de migration.

### Mobile

- Débordement horizontal : `body { overflow-x: hidden }` est déjà posé en
  garde-fou, mais la vraie correction est locale : padding responsive
  (`px-4 sm:px-6`), `min-w-0` sur les enfants `flex-1` qui portent du texte
  long, `whitespace-normal` sur les badges.
- Le `viewport` est déclaré dans `app/layout.tsx` (export `viewport`). Ne le
  supprime pas, sinon la page s'affiche dézoomée sur mobile.
- Safari iOS met en cache l'`apple-touch-icon` : après déploiement, recharger
  la page puis refaire « Sur l'écran d'accueil ». Si l'aperçu reste gris,
  fermer complètement Safari et recommencer.
- Teste en mobile (DevTools, device toolbar) avant de pousser une modif d'UI.

### Intégrations externes

- **Apps Script** : toujours `redirect: "follow"` dans les `fetch` POST.
  Avec `redirect: "manual"`, la réponse devient `opaqueredirect` et devient
  illisible (symptôme : l'envoi « réussit » mais la réponse est perdue).
- **Make et Airtable** : le rapprochement se fait par **email**. L'URL du
  webhook Make reste une variable d'environnement Vercel, jamais dans le repo.
  Si `MAKE_IMPACT_WEBHOOK_URL` n'est pas définie, la route `/api/impact-event`
  est un no-op assumé (on peut déployer sans rien casser).
- **Analyses IA** : quota de 50 analyses par utilisateur et par mois, plus un
  cache de déduplication SHA-256 (`analyses_cache`). La route `/api/analyze`
  a `maxDuration = 60` car la lecture du corpus Drive est lente. Elle sert à la
  fois `/bao/analyse` (baromètre jetons, scores 0 à 100) et
  `/bao/diagnostic-pro` (zones par clé) : un changement de prompt impacte les
  deux.

### Analyse photo du baromètre

- **Claude renvoie parfois du texte avant le JSON** : `JSON.parse(brut)` lève
  `SyntaxError: Unexpected token 'I', "I'll caref"...`. Correctif : extraire le
  bloc avec `text.match(/\{[\s\S]*\}/)` (`handlePhotoAnalyze`,
  `app/bao/analyse/page.tsx`).
- **Vérifier `response.ok` avant de parser** : sur une erreur 500 l'API renvoie
  `{error: "..."}`, `data.content` est alors `undefined` et le message affiché
  masque le vrai message serveur. Correctif :
  `if (!response.ok) throw new Error(data.error || ...)` juste après
  `response.json()`.
- **Couleurs en dur dans le prompt** : le prompt annonçait toujours « rose,
  jaune, bleu, vert » même quand le pro avait déclaré « marron » et « rouge ».
  Claude voyait les bonnes couleurs sur la photo mais ne savait pas les mapper.
  Correctif : construire `c1` à `c4` depuis `customColorLabels`.

### Formulaire des fiches (admin)

- **Modifications perdues à l'enregistrement** (symptôme : un lien ajouté
  dans un champ de texte riche disparaît après « Enregistrer ») :
  `RichTextEditor` ne remontait son contenu au formulaire qu'au `blur`. Or
  sur Safari (et Firefox sur Mac), cliquer sur un `<button>` ne retire pas le
  focus de la zone éditable, donc le `blur` n'arrive jamais avant la
  sauvegarde. Correctif : `onInput={emit}` plus un `emit()` après chaque
  commande de la barre d'outils (lien, gras, couleur...). Ne jamais se reposer
  sur le seul `blur` pour synchroniser un champ.
- Un échec d'upload vers Storage (`fiches-images`, `fiches-pdf`) n'était
  visible que dans la console : il s'affiche maintenant sous le bouton
  d'ajout (`uploadError`). Un `update` Supabase bloqué par le RLS ne renvoie
  pas d'erreur non plus (zéro ligne modifiée) : en cas de doute, vérifier la
  ligne dans le Table Editor.
- La page `/bao` charge les fiches au montage. Revenir dessus par le bouton
  « Précédent » peut restaurer la page depuis le cache du navigateur (bfcache)
  sans recharger : on écoute `pageshow` avec `persisted` pour relancer le
  chargement. Un onglet BAO resté ouvert pendant l'édition dans l'admin
  doit, lui, être rechargé à la main.

### PDF des fiches et pdf.js

- **pdf.js et Next.js** : `import("pdfjs-dist")` fait échouer `next build`
  (`'import.meta' cannot be used outside of module code`), même en import
  dynamique dans un client component. Correctif : ne pas passer par webpack.
  `scripts/copier-pdfjs.mjs` copie la librairie dans `public/pdfjs/`
  (`postinstall`) et `lib/generateFichePdf.ts` la charge par
  `import(/* webpackIgnore: true */ url)` avec `url` dans une variable (un
  littéral ferait échouer la résolution TypeScript).
- **Build `legacy` obligatoire** : le build standard de pdf.js 6 appelle
  `Map.prototype.getOrInsertComputed`, absent des navigateurs d'avant fin 2025
  (symptôme : `TypeError: getOrInsertComputed is not a function` et la
  ressource n'est pas intégrée). Le build `legacy/build/` embarque le polyfill.
- **Nom du fichier PDF** : Chrome nomme le PDF d'après le titre de la page
  parente, pas celui de l'iframe imprimée. Il faut changer `document.title`
  avant `print()` et le restaurer après (`afterprint` plus délai de secours).
- Les PDF des ressources complémentaires sont lus par `fetch` depuis le bucket
  public `fiches-pdf` (CORS ouvert). Une URL externe sans CORS, un fichier
  illisible ou plus de 60 pages cumulées : la ressource reste listée avec son
  URL, sans bloquer la génération.
- `.gitignore` ignore tout dossier nommé `build/` : ne pas nommer ainsi un
  dossier de `public/`.

### Supabase : CLI et migrations

- **`supabase db push` n'est pas utilisable** tant que l'historique des
  migrations n'est pas réaligné (§6). Appliquer par le SQL Editor.
- **`supabase functions deploy` renvoie 403** « account does not have the
  necessary privileges » : il manque un rôle Owner ou Administrator sur
  l'organisation Supabase. Ce n'est ni Docker ni le code.
- Dans un trigger sur `profiles`, comparer les colonnes via
  `to_jsonb(NEW)->>'col'` plutôt que `NEW.col` : si une colonne est absente
  (`admin_roles` par exemple), `NEW.col` casse **tous** les UPDATE.

### Git et environnement local

- Un prompt qui affiche `|MERGING` signale un `git merge` interrompu en local
  (souvent des conflits), invisible depuis GitHub. Vérifier `git status` puis
  `git merge --abort` pour revenir propre.
- « Toujours rien en prod » alors que le code est poussé : la branche n'est
  probablement pas mergée dans `main`, et Vercel ne déploie `bao.lit-up.fr` que
  depuis `main`. Vérifier le merge avant de chercher un bug.
- Après un rebuild, tuer l'ancien `next start` encore actif, sinon on teste
  l'ancien build et on conclut à tort que le correctif ne marche pas.
- Copier du code depuis la vue **rendue** de GitHub insère des artefacts
  markdown (un lien devient `[www.lit-up.fr](https://www.lit-up.fr)` en plein
  HTML). Copier depuis la vue **Raw**.
- Le PAT GitHub n'est stocké nulle part dans le repo (trousseau macOS). Pour le
  renouveler : « Regenerate token » (même nom, mêmes droits), puis
  `git credential-osxkeychain erase` et coller la nouvelle valeur au prochain
  `git push`.

---

## 9. Sécurité : les règles dures

1. Aucun secret dans le repo, ni dans un commit, ni dans un commentaire, ni
   dans un message d'erreur renvoyé au navigateur.
2. `SUPABASE_SECRET_KEY` (service_role) **uniquement** côté serveur. Si tu la
   vois dans un fichier qui finit dans le bundle client, c'est un incident.
3. Toute nouvelle table a RLS activé, des GRANT explicites et des policies.
   Pas d'exception « on verra plus tard ».
4. Toute route API authentifie côté serveur et revérifie les droits. L'UI ne
   protège rien.
5. Si une clé a fuité : on la régénère dans Supabase ou Anthropic, on met à
   jour Vercel, on ne se contente pas de supprimer le fichier.
6. RGPD : la base contient des données de professionnels (email, structure,
   région, code postal). On ne les exporte pas hors des outils de l'asso, et
   on ne les colle pas dans un service tiers.

---

## 10. État du projet et chantiers ouverts

### Livré

- Infrastructure (Vercel, Supabase, tables, RLS)
- Contenu : fiches, objectifs, clés d'engagement, parcours
- Authentification : inscription avec validation admin, mot de passe,
  réinitialisation via Resend
- Back-office admin complet avec rôles cumulables
- Diagnostic pro et analyse photo du baromètre, assistés par Claude
- PDF des fiches, favoris, retours d'expérience, propositions d'outils
- Analytics (`analytics_events`) et tableau de bord d'impact (`/admin/impact`)
- Synchronisation d'impact vers Airtable via Make (inscription, usage d'outil)
- PWA (manifest, icônes, installation)
- Page publique « La roulette des défis »

### Étapes à venir

Les sujets ci-dessous ont été cadrés ensemble et sont tracés dans le repo
(principalement `docs/mesure-impact-roadmap.md`). Ils sont classés par ordre
de priorité, pas par date.

#### Priorité 1 : brique 3 de la mesure d'impact (mini-enquêtes)

C'est le chantier en cours. Objectif : répondre aux indicateurs #4, #5 et #6
du cadre de la Fondation, donc objectiver l'effet de la BAO sur la pratique
des pros, pas seulement son usage.

Décisions déjà prises (ne pas les rouvrir sans raison) :

- Enquêtes **in-app** plutôt que par email : meilleur taux de réponse, et la
  BAO sait qui a déjà répondu.
- **Encart non bloquant et fermable** dans `/mon-espace`. Baseline une fois à
  l'arrivée, relance après 3 à 4 semaines **et** au moins 3 consultations.
- Trois blocs de questions :
  - #4 Outillage (baseline puis après, échelles 1 à 5) : niveau d'outillage
    pour remobiliser les jeunes les plus en difficulté, capacité à limiter la
    démobilisation et le décrochage.
  - #5 Pratique (après) : la pratique a-t-elle évolué grâce à la BAO, des
    jeunes ont-ils été remobilisés qu'on n'aurait pas su accompagner avant.
  - #6 Diffusion (après) : les outils ont-ils été partagés à d'autres pros,
    et à combien.
- **Stockage double** : table Supabase `impact_surveys` (savoir qui a répondu,
  pour ne pas re-solliciter) et table Airtable « Enquêtes BAO » alimentée par
  le même webhook Make, via les events `enquete_baseline` et `enquete_relance`.

Reste à produire : la migration `impact_surveys`, le composant d'encart, la
table Airtable et son mapping Make.

#### Priorité 2 : finir le tuyau d'impact

- Supprimer les lignes de test `test-make@lit-up.fr` dans la table Airtable
  « Usages BAO ».
- Rétention et cohortes dans `/admin/impact`, une fois assez d'événements
  `session_start` accumulés.
- Afficher les résultats d'enquêtes dans le tableau de bord d'impact.
- Trancher sur la table `analyses` : aujourd'hui chaque utilisateur ne lit que
  ses propres lignes. Si le dashboard doit les agréger, il faut ajouter une
  policy de lecture admin (les autres tables l'ont déjà).

#### Priorité 3 : mise en ligne

- Finaliser le domaine personnalisé `bao.lit-up.fr`.

#### Sécurité, à traiter avant d'ouvrir des accès

- **Porter les rôles admin dans le RLS.** Le RLS ne teste aujourd'hui que
  `is_admin()` : un rôle restreint ne l'est pas en base. À faire **avant** de
  déléguer un rôle admin restreint à quelqu'un.
- **Réaligner l'historique des migrations** avec ce qui existe réellement en
  base, pour pouvoir revenir à `supabase db push` (§6 et §8).
- **Ajouter un `middleware.ts`** pour protéger les routes côté serveur.
  Défense en profondeur, pas urgent.

#### Petits chantiers identifiés

- Vérifier le parcours d'inscription de bout en bout avec un compte de test :
  approuver depuis `/admin/utilisateurs`, puis se connecter (doit passer sans
  lien de confirmation).
- Brancher la carte « Auto-diagnostic du pro » sur `/bao/diagnostic-pro` :
  elle affiche aujourd'hui une `alert()` « en cours de développement »
  (`handleAutoDiagnostic`, `app/bao/diagnostiquer/page.tsx`). Décider au
  passage si on garde le badge « en cours de développement ».
- Fusionner `next.config.js` et `next.config.mjs` (§8), en vérifiant si
  `next/image` est utilisé avec des URL Supabase.
- Supprimer la branche `claude/charming-noether-dbppod`, entièrement intégrée
  dans `main` : `git branch -D` puis `git push origin --delete`.
- Afficher des conseils de prise de vue dans la zone de dépôt photo (de dessus,
  jetons écartés, bonne luminosité). Priorité basse.
- Obtenir un rôle Owner ou Administrator sur le projet Supabase pour pouvoir
  déployer les edge functions. Priorité basse.

#### Plus tard, ou à trancher

- **Réactiver ou non la confirmation d'email Auth**, et donc déployer
  `send-welcome-email` (§8). Décideur : l'Owner du projet Supabase.
- **Migrer le PAT GitHub classic vers un token fine-grained** limité au seul
  repo `lit-up-fr/bao-app`, plus sûr que le scope `repo` complet.
  Décideur : Laetitia.
- Héberger dans la BAO les **questionnaires jeunes** (autodétermination).
- Sort des sections **Parcours** et **Étapes** de l'admin : elles sont
  marquées `deprecated: true` dans `NAV_ITEMS` (`app/admin/layout.tsx`) et
  affichées à part. À garder, masquer ou supprimer, la décision n'est pas prise.
- Mettre à jour les cases à cocher du `README.md` : les phases 2 (contenu),
  3 (authentification) et 4 (dashboard admin) sont livrées mais encore
  affichées comme non faites.
- **Ressources complémentaires dans le PDF** : elles sont intégrées en images
  de page (texte non sélectionnable, fichier plus lourd). Si ça devient
  gênant, l'alternative est une génération côté serveur (Chromium headless
  plus fusion des PDF avec `pdf-lib`), plus lourde à héberger sur Vercel
  Hobby. Décideur : Laetitia, selon les retours des pros.

> Cette liste vient du repo et des conversations de travail déjà dépouillées.
> Si un sujet est décidé ailleurs, reporte-le ici : c'est le rôle de cette
> section, et la §13 dit comment.

### Dette technique identifiée

| Sujet | Impact | Difficulté |
|---|---|---|
| Configs Next et Tailwind en double (§8) | confusion, config morte | faible |
| Styles inline hex plutôt que tokens Tailwind | maintenance de la charte | moyenne |
| Scripts `fix-*.sh` et `setup-frontend.sh` à la racine | héritage de la phase 2, plus exécutables tels quels | faible (archivage) |
| `MODE_DEMPLOI_PHASE_1.md` obsolète | décrit une installation par archive zip | faible |
| Aucun test automatisé | régressions détectées en prod | élevée |
| Pas de hook pre-commit `npm run build` | builds cassés poussés | faible |
| `is_admin` et `admin_role` (singulier) encore lus en fallback | double source de vérité | moyenne |
| Historique de migrations incomplet (objets créés dans le dashboard) | `supabase db push` inutilisable | élevée |
| Rôles admin non appliqués dans le RLS | un rôle restreint ne l'est pas en base | moyenne |
| `/bao/diagnostic-pro` sans lien entrant | page livrée mais inatteignable | faible |
| Edge function `send-welcome-email` jamais déployée | code mort tant que la confirmation d'email est désactivée | faible |

Avant de t'attaquer à une ligne de ce tableau, annonce-le : plusieurs de ces
chantiers touchent tous les fichiers et génèrent des conflits massifs.

---

## 11. Historique des modifications

Vue d'ensemble par jalon. L'historique complet et faisant foi est dans Git :

```bash
git log --pretty=format:'%ad | %an | %s' --date=short
```

| Date | Qui | Jalon |
|---|---|---|
| 13-14 mai 2026 | Laetitia | Fondations V6 : fiches, modales, consultations, avatar et profil éditable, génération PDF (migrée de html2pdf.js vers `window.print()`) |
| 18 mai 2026 | Laetitia | Questionnaire diagnostic pro, validation IA côté admin, rôles admin multiples (`admin_roles[]`) |
| 25 mai 2026 | Laetitia | Migration des emojis vers les icônes Lucide, refonte visuelle de la sidebar admin |
| 27 mai 2026 | Laetitia | 4 migrations Supabase : correctifs sécurité et performance RLS (initplan, index, vues) |
| 4 juin 2026 | Claude | Analyse photo du baromètre : prompt adapté au matériel déclaré, vraies couleurs transmises à Claude, extraction JSON robuste, bascule en saisie manuelle pré-remplie, vérification du quota |
| 7 juin 2026 | Laetitia et Claude | Création du profil par trigger serveur (correctif inscription), alertes admin sur erreurs d'auth, suppression d'utilisateur, correctifs mobile |
| 10-11 juin 2026 | Claude | Durcissement sécurité (commits `a8e5988` et `1184f85`) : authentification serveur des routes API, trigger anti-escalade de privilèges, RLS sur `diagnostic_analyses` et `analyses_cache`, edge function `send-welcome-email` durcie, masquage des détails d'erreur |
| 19 juin 2026 | Claude | Déblocage des connexions : confirmation d'email Auth désactivée dans Supabase, et migration de rattrapage pour les comptes déjà validés |
| 25-26 juin 2026 | Claude | Fondation analytics (`analytics_events`), tableau de bord d'impact, suivi des connexions, collecte « jeunes accompagnés par an », synchronisation Airtable via Make (bricks 1 et 2) |
| 19 août 2026 | Laetitia | PWA (PR #5) : manifest `app/manifest.ts`, icônes, métadonnées d'installation. Sans service worker ni notifications push, décision assumée |
| 11 septembre 2026 | Laetitia | Page publique « La roulette des défis » (PR #6, `/roulette-questions`), avec la redirection `/roulette-defis` pour les QR codes |
| 22 septembre 2026 | Claude | Ce document de collaboration, avec les conventions, les pièges et les étapes à venir |
| 3 octobre 2026 | Claude | PDF des fiches : nom de fichier au nom de l'outil, illustrations et images d'étapes, liens cliquables avec URL, ressources complémentaires jointes à la suite (pdf.js servi depuis `public/pdfjs/`) |

**Convention** : on ajoute une ligne ici quand un jalon est mergé sur `main`
(une fonctionnalité visible, une migration de schéma, un correctif de
sécurité). Pas pour chaque commit, Git s'en charge déjà.

---

## 12. Travailler avec Claude sur ce projet

Ce fichier est lu automatiquement par Claude Code au démarrage d'une session
dans ce repo.

> **Règle de fin de conversation (elle s'applique à toute personne et à toute
> session, sans qu'on ait à la redemander).** Avant de clore un échange de
> travail, Claude fait le tri de ce qui a été appris et met à jour ce fichier.
> Le mode opératoire est en §13.

Quelques attentes de travail explicites :

- Annoncer une **estimation de temps** en début de réponse.
- Aller droit au but, découper en étapes numérotées.
- **Avant une grosse refonte d'interface** (page entière, changement de
  hiérarchie visuelle), livrer d'abord un **mockup HTML statique autonome**
  avec plusieurs options comparées, et faire valider avant de coder.
- Utiliser des questions à choix cliquables (`AskUserQuestion`) quand plusieurs
  options sont proposées, plutôt que de demander de taper une lettre.
- En Claude Code : édition directe des fichiers, pas de fichiers versionnés
  `-vX` (c'est Git qui porte l'historique). Récap court à chaque commit.
- Vérifier la syntaxe et lancer `npm run build` avant de proposer un commit.
- Ne jamais proposer de pause à l'utilisatrice, quelle que soit l'heure.

---

## 13. Faire vivre ce document

Ce fichier n'a de valeur que s'il reste vrai.

### La règle

**À la fin de chaque conversation de travail sur ce projet, quelle que soit la
personne et quel que soit l'outil (Claude Code, Claude Desktop, claude.ai),
Claude alimente ce fichier avec ce que la conversation a appris.**

C'est un réflexe attendu, pas une faveur à demander. Claude le fait de
lui-même, sans attendre qu'on le lui rappelle, et sans demander la permission
d'en parler : il propose le contenu, la personne valide.

Ce qui est à retenir :

- une décision tranchée, et le pourquoi en une ligne
- une étape à venir, avec sa priorité si elle a été dite
- une question restée ouverte, et qui la tranchera
- un piège rencontré, avec le correctif exact
- une convention nouvelle ou modifiée
- un jalon livré et mergé

Ce qui n'est **pas** à retenir : le détail du déroulé, les essais
infructueux sans enseignement, les reformulations de ce qui est déjà écrit
ici, et tout ce qui n'a pas été réellement dit dans la conversation. Dans le
doute, on n'écrit pas : un document gonflé d'approximations est pire qu'un
document court.

### Le mode opératoire

**En Claude Code, avec le repo sous la main** : Claude édite directement la
bonne section, montre le diff, et propose le commit. Pas de fichier annexe,
pas de note à reporter à la main.

**Hors Claude Code** (Claude Desktop, claude.ai, où le repo n'est pas
accessible en écriture) : Claude produit un bloc markdown collable et dit dans
quelle section le ranger. La personne le reporte dans le fichier.

**Si rien n'est à retenir**, Claude le dit en une phrase et on passe à autre
chose. Une conversation sur trois n'apprend rien de durable, c'est normal.

### Où ranger quoi

| Ce qui sort de la conversation | Section |
|---|---|
| Décisions, étapes à venir, questions à trancher | §10 |
| Piège rencontré et son correctif | §8 |
| Convention de rédaction ou de code | §5 ou §6 |
| Jalon livré et mergé sur `main` | §11 |
| Nouvelle table, route API ou rôle admin | §4 |
| Dette technique créée ou résorbée | §10 |

### Cas particulier : la mise à jour dans une PR

Quand ta modification touche le code, mets ce fichier à jour **dans la même
PR** que le changement, notamment quand tu :

- ajoutes une table, une route API ou un rôle admin (§4)
- changes une convention ou un pattern (§5, §6)
- tombes sur un piège qui t'a coûté plus de trente minutes (§8)
- termines un jalon (§11)
- crées ou résorbes une dette technique (§10)

En cas de contradiction entre ce document et le code, **le code fait foi** :
corrige alors le document dans la foulée.

### Les prompts de relance

À utiliser quand la règle ci-dessus n'a pas été appliquée d'elle-même, ou
depuis un outil qui ne lit pas ce fichier.

```
Récap pour le CLAUDE.md de lit-up-fr/bao-app.

Relis notre conversation et sors uniquement ce qui mérite d'être écrit dans le
CLAUDE.md du repo. Ne reprends que ce qui a été dit ici : n'invente rien et ne
complète pas avec ce que tu sais du projet par ailleurs.

Rends-moi un bloc markdown collable, avec seulement les rubriques qui ont
quelque chose à dire :

- Décisions prises : ce qui est tranché, avec le pourquoi en une ligne.
- Étapes à venir : ce qui reste à faire, avec la priorité si on l'a dite.
- À trancher : les questions restées ouvertes, et qui décide.
- Pièges : ce qui nous a coûté du temps, et le correctif exact.
- Conventions : toute règle nouvelle ou modifiée.

Forme : français, phrases courtes, pas de tiret cadratin, chemins de fichiers
et noms de tables exacts. Saute les rubriques vides. Si rien n'est à retenir,
réponds simplement « rien à ajouter ».
```

Version courte, pour les petites sessions :

```
Récap CLAUDE.md : sors de cette conversation les décisions prises, les étapes
à venir, les questions à trancher et les pièges rencontrés, en markdown
collable. Rien que ce qui a été dit ici. Pas de tiret cadratin. Si rien :
« rien à ajouter ».
```

Où ranger ce qui en sort : les décisions et les étapes dans §10, les pièges
dans §8, les conventions dans §5 ou §6, les jalons livrés dans §11.
