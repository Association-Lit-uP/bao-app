# BAO Lit uP : état des lieux conformité (RGPD, propriété intellectuelle, CGU, modèle économique)

> Document de transmission pour Gabriela, qui reprend le chantier conformité.
> Périmètre : uniquement l'application web « Boîte à outils Lit uP » (`bao.lit-up.fr`).
> Source : lecture du code, des migrations SQL et de la documentation du repo
> `bao-app`, état au 30 septembre 2026. Ce qui ne se voit pas dans le repo
> (contrats, hébergement, dépôts INPI) est signalé « à vérifier ».
> Échéance visée : fin octobre 2026, webinaire de lancement.

---

## 1. Fiche d'identité de l'outil

| | |
|---|---|
| Nom | Boîte à outils Lit uP (BAO) |
| Éditeur | Association Lit uP (loi 1901), contact@lit-up.fr |
| Public | Professionnels de l'accompagnement des jeunes de 14 à 25 ans (missions locales, E2C, associations, éducateurs, enseignants) |
| Accès | Gratuit, compte nominatif, validé manuellement par l'équipe Lit uP (statut `en_attente`, `active`, `suspended`, `refused`) |
| Contenu | 30 à 40 fiches outils, 9 clés d'engagement, parcours guidés, diagnostics assistés par IA, page publique « La roulette des défis » |
| Hébergement | Vercel (application) et Supabase (base de données, authentification, fichiers) |
| Financeur cité dans le code | Fondation Pierre Bellon (objectif d'encadrants accompagnés sur 3 ans) |

---

## 2. RGPD

### 2.1 Données collectées et traitements (base pour le registre)

| Traitement | Données | Où | Finalité | Remarques |
|---|---|---|---|---|
| Compte et profil | email, mot de passe (haché par Supabase Auth), prénom, nom, téléphone (facultatif), structure, poste, code postal, catégorie professionnelle, région, tranche d'âge, public accompagné, fourchette de jeunes accompagnés par an, consentement newsletter, dates d'acceptation CGU et confidentialité, statut, rôles admin, photo de profil, date de dernière connexion, nombre de connexions | table `profiles`, bucket `avatars` | Gestion des comptes, validation des accès, mesure d'impact | La photo de profil est dans un bucket public : toute personne qui a l'URL peut la voir |
| Usage | consultations de fiches, favoris, événements `session_start`, `pdf_download`, `search` (le texte de la recherche est stocké avec l'identifiant utilisateur) | tables `consultations`, `favoris`, `analytics_events` | Statistiques d'usage, tableau de bord d'impact `/admin/impact` | Les événements sont conservés après suppression du compte, avec l'identifiant utilisateur mis à NULL (anonymisation) |
| Contributions | retours d'expérience (texte, note), propositions d'outils (titre, description, contexte, objectifs, public, format, durée, lien) | tables `retours`, `propositions` | Enrichissement de la BAO | Le code demande prénom, nom, structure, poste et photo de l'auteur pour afficher les retours aux autres utilisateurs. Un admin peut masquer un retour (`is_visible`). Les retours visibles sont lisibles par la policy « Read retours » ouverte à `public` |
| Diagnostics IA | email de l'utilisateur, nom de l'atelier, type d'organisation, nombre de jeunes, précisions par clé (texte libre), commentaire libre, texte complet de l'analyse, contexte brut complet, photo du baromètre (pour l'analyse photo) | tables `diagnostic_analyses` (lecture admin), `analyses` (espace perso), `analyses_cache` (hash SHA-256 et texte), Google Sheet « Analyses validées » | Aide au diagnostic, relecture pédagogique par des admins, amélioration de l'IA | **Point d'attention** : les champs libres peuvent contenir des informations sur des jeunes, donc potentiellement des données de mineurs, envoyées à Anthropic et conservées. Aucune consigne dans l'interface ne le déconseille aujourd'hui. La photo est envoyée à Anthropic, elle n'est pas stockée côté BAO d'après le code |
| Journaux d'erreur | email saisi, message d'erreur, type (inscription ou connexion) | table `auth_error_logs` | Alertes admin | Contient des emails de personnes qui n'ont pas de compte (inscriptions échouées). Pas de purge |
| Emails transactionnels | email, prénom | Resend | Confirmation d'accès, réinitialisation de mot de passe | Domaine `noreply@lit-up.fr` |
| Page publique « roulette des défis » | aucune donnée collectée, pas de compte, `noindex` | | | Rien à déclarer |

Quota : 50 analyses IA par utilisateur et par mois.

### 2.2 Sous-traitants et flux sortants

| Prestataire | Rôle | Données qui y transitent | À faire |
|---|---|---|---|
| Vercel | hébergement de l'application, logs serveur | tout le trafic, adresses IP | DPA et région d'hébergement à vérifier |
| Supabase | base de données, authentification, stockage | toutes les données ci-dessus | DPA et région du projet à vérifier |
| Anthropic | analyses IA (Claude) | photo du baromètre, contexte d'atelier, précisions et commentaires libres. L'email de l'utilisateur n'est pas dans le prompt d'après le code | DPA, conditions d'usage des données (entraînement ou non) à vérifier |
| Google Drive et Docs | lecture du corpus IA (documents Lit uP) | aucune donnée utilisateur (lecture seule du corpus) | rien |
| Google Sheets (Apps Script) | feuille « Analyses validées » | email de l'utilisateur, contexte de l'atelier, texte de l'analyse, notes des admins relecteurs | à inscrire dans la politique, durée de conservation à fixer |
| Google Fonts | polices chargées depuis les serveurs Google à chaque page | adresse IP de chaque visiteur | Recommandation : héberger les polices dans l'application (chantier technique léger), ce qui supprime le flux |
| Make puis Airtable | mesure d'impact (bases « Base de données Professionnels », tables « Professionnels », « Usages BAO », bientôt « Enquêtes BAO ») | à l'inscription : email, prénom, nom, structure, poste, région, code postal, catégorie pro, fourchette de jeunes par an ; à chaque usage déclaré : email, outil, nombre de jeunes ; à venir : réponses aux enquêtes d'impact | DPA Make et Airtable, durée de conservation, procédure de suppression (voir 2.4) |
| Resend | envoi des emails | email, prénom | DPA à vérifier |
| GitHub | code source (dépôt privé) | aucune donnée utilisateur | rien |

La plupart de ces prestataires sont américains : le mécanisme de transfert (clauses contractuelles types ou Data Privacy Framework) est à documenter pour chacun.

### 2.3 Ce qui est déjà en place (à valoriser dans la politique)

- Case à cocher obligatoire à l'inscription : « J'accepte les conditions générales d'utilisation et la politique de confidentialité », horodatée en base (`cgu_accepted_at`, `privacy_accepted_at`).
- Consentement newsletter distinct, non pré-coché : « Je souhaite recevoir les actualités de Lit uP (nouveaux outils, formations, événements) ».
- Aucun traceur tiers (pas de Google Analytics, pas de pixel publicitaire). La session est stockée dans le navigateur (localStorage), pas de cookie de suivi. A priori pas de bandeau cookies nécessaire, sous réserve du point Google Fonts.
- Accès aux données des autres utilisateurs réservé aux administrateurs, contrôlé en base (RLS activé sur toutes les tables) et côté serveur pour les routes API.
- Protection contre l'auto-attribution de droits admin (trigger en base).
- Suppression définitive d'un compte par l'admin : profil, favoris, consultations et retours supprimés, événements d'usage anonymisés.
- Messages d'erreur génériques côté navigateur, secrets hors du code.
- Minimisation raisonnable : le nombre de jeunes accompagnés est demandé en fourchette, pas de données sur les jeunes eux-mêmes dans le modèle de données.

### 2.4 Manques à combler avant fin octobre

1. **Les pages `/cgu` et `/confidentialite` n'existent pas.** Les liens de la case à cocher de l'inscription renvoient une page introuvable. Le consentement recueilli aujourd'hui porte sur des documents inexistants. Priorité absolue : rédiger les deux textes, puis les intégrer (deux pages statiques à créer côté développement).
2. **Pas de mentions légales** (éditeur, siège, numéro RNA ou SIREN, directeur de publication, hébergeurs). Aucun lien légal dans le pied de page de l'accueil.
3. **Pas de suppression de compte en libre-service** ni d'export de ses données. Prévoir au minimum la procédure par email dans la politique, idéalement un bouton dans « Mon espace ».
4. **Durées de conservation non définies** : comptes en attente ou refusés, comptes inactifs, journaux d'erreur avec emails de non-inscrits, analyses IA et cache, données Airtable et Google Sheet. À fixer, puis à mettre en œuvre (purges).
5. **Suppression non propagée** : supprimer un compte dans la BAO ne supprime rien dans Airtable, ni dans le Google Sheet « Analyses validées », ni chez Resend. La table `diagnostic_analyses` conserve l'email. Une procédure manuelle de suppression complète est à écrire.
6. **Champs libres du diagnostic** : ajouter une consigne dans l'interface (« ne saisissez ni nom ni information permettant d'identifier un jeune ») et une clause dans les CGU. Même consigne pour la zone de dépôt photo (pas de visage).
7. **Google Fonts** : héberger les polices localement pour supprimer le transfert d'adresses IP vers Google.
8. **Registre des traitements** à formaliser à partir du tableau 2.1, y compris les enquêtes d'impact à venir.
9. **Analyse d'impact (AIPD)** : probablement non requise, mais la décision est à motiver par écrit (IA, risque de données de mineurs dans les champs libres).
10. **Contrats de sous-traitance (DPA)** à rassembler pour chaque prestataire du tableau 2.2.
11. **Newsletter** : le consentement est stocké dans la BAO mais aucun outil d'envoi n'y est branché. Vérifier la cohérence avec l'outil d'emailing de l'association et le mécanisme de désinscription.
12. **Sécurité (déjà identifié dans le repo)** : les rôles admin restreints ne sont pas appliqués en base (un admin restreint a en base les droits d'un admin complet). À corriger avant de déléguer un rôle admin à une personne extérieure, au titre de la limitation des accès.
13. **Enquêtes d'impact (chantier en cours)** : les réponses seront envoyées à Airtable. À inclure dès maintenant dans la politique de confidentialité (finalité : évaluation pour le financeur).

---

## 3. Propriété intellectuelle

### 3.1 État des lieux

- **Code source** : licence MIT (fichier `LICENSE`, « Copyright (c) 2026 lit-up-fr »), dépôt privé. Une licence MIT autorise quiconque à réutiliser, modifier et vendre le code. À confirmer que c'est un choix délibéré ; sinon, retirer le fichier ou changer de licence.
- **Contenu pédagogique** (fiches, 9 clés, parcours, défis de la roulette) : **aucune licence indiquée nulle part**, ni dans l'application, ni dans les PDF, ni en base. L'application promet pourtant l'ouverture : « Gratuite, ouverte, faite pour être partagée » (accueil), « Accès libre, gratuit, à partager » (pied de page), « faite pour être partagée » (pied de page de chaque PDF). Cette promesse n'a aucun cadre juridique aujourd'hui.
- **Origine des fiches** : le guide de bienvenue indique que les outils sont « créés par Lit uP ou identifiés comme pertinents ». Chaque fiche a un champ `source` (affiché dans la fiche et le PDF) et un indicateur `source_a_valider`. Avant d'apposer une licence Creative Commons, il faut un audit fiche par fiche : lesquelles sont des créations Lit uP, lesquelles reprennent un tiers, et avec quels droits.
- **Cadre scientifique** : la théorie de l'autodétermination est correctement attribuée à Deci et Ryan (références bibliographiques sur la page des clés), avec la mention « Adaptation par Lit uP ».
- **Contributions des utilisateurs** : aucune clause sur les retours d'expérience ni sur les propositions d'outils. Une proposition peut devenir une fiche publiée. Il faut une clause de licence sur les contributions dans les CGU, avec la question du crédit de l'auteur.
- **Marque et signes** : « Lit uP », le logo, « Boîte à outils Lit uP », « les 9 clés d'engagement ». Rien dans le repo n'indique un dépôt INPI. À vérifier.
- **Roulette des défis** : les 12 défis sont écrits dans le code, sur une page publique sans compte, sans mention d'auteur ni de licence.
- **Preuve d'antériorité** : l'historique Git date le code et les textes de l'interface, mais **pas les fiches**, qui vivent dans la base Supabase. Pour une enveloppe e-Soleau, prévoir un export daté des fiches (PDF et données) en plus du code.

### 3.2 Décisions à prendre

| Question | Options | Lien avec le reste |
|---|---|---|
| Licence des fiches | CC BY-SA (réutilisation commerciale permise) ou CC BY-NC-SA (interdite) | La clause NC est le levier si le modèle économique inclut des prestations payantes ou si on veut empêcher la revente par des organismes privés |
| Où l'afficher | fiche détail, modale, pied de page du PDF (remplacer « faite pour être partagée » par la mention de licence), page CGU | Intégration technique légère |
| Licence du code | garder MIT, passer en licence à réciprocité (AGPL), ou rester tout droits réservés | Décision de l'association |
| Contributions | licence accordée à Lit uP sur les retours et propositions, crédit de l'auteur ou non | Clause CGU |
| Accès technique au contenu | vérifier si les fiches sont lisibles sans compte via l'API Supabase (les migrations parlent de « lecture libre » sur `fiches`, `cles`, `parcours`, policies créées dans le dashboard). Si le contenu doit être réservé aux comptes validés, la règle en base doit l'imposer | Cohérence entre la promesse d'ouverture et le gate par validation |

---

## 4. CGU et mise en conformité de l'outil

### 4.1 Ce que les CGU doivent couvrir (spécificités de la BAO)

- **Objet et accès** : outil gratuit, réservé aux professionnels de l'accompagnement, compte nominatif, validation par Lit uP sous 48 h environ, droit de refuser ou suspendre un compte (les quatre statuts existent en base).
- **Gratuité** : le guide de bienvenue promet un accès « gratuit, illimité dans le temps, partageable à tout acteur de l'éducation intéressé ». À reformuler contractuellement (Lit uP se réserve la possibilité de faire évoluer le service) sans trahir l'esprit.
- **Contributions** : licence, modération (un admin peut masquer ou supprimer un retour), responsabilité de l'auteur, affichage du nom auprès des autres utilisateurs.
- **Fonctions d'IA** : nature de l'aide (assistée par IA, pas un avis expert, vérification humaine obligatoire, ce que l'interface fait déjà en repassant en saisie manuelle après l'analyse photo), quota mensuel, relecture des analyses par des admins pédagogiques qui voient l'email de l'auteur, interdiction de saisir des données identifiantes sur les jeunes.
- **Propriété intellectuelle** : licence du contenu, marque, ce que l'utilisateur peut faire (imprimer, partager, adapter selon la licence choisie).
- **Données personnelles** : renvoi vers la politique de confidentialité.
- **Charte d'engagement** : voir section 5.
- **Mentions légales** séparées : éditeur, siège, RNA ou SIREN, directeur de publication, hébergeurs (Vercel et Supabase), contact.

### 4.2 Travaux techniques à prévoir (charge faible, à planifier avec Laetitia)

1. Créer les pages `/cgu`, `/confidentialite`, `/mentions-legales` (pages statiques).
2. Ajouter un pied de page avec ces liens sur l'accueil, la connexion, l'inscription et la BAO.
3. Dater les CGU et redemander l'acceptation en cas de changement majeur (le champ `cgu_accepted_at` existe déjà).
4. Suppression de compte et demande d'export depuis « Mon espace », ou au minimum le lien vers la procédure.
5. Héberger les polices localement.
6. Consignes « pas de données identifiantes » sur les champs libres du diagnostic et la zone photo.
7. Mention de licence sur les fiches et dans le pied de page des PDF.
8. Purges périodiques selon les durées de conservation décidées.

---

## 5. Modèle économique, charte d'engagement et contreparties

### 5.1 Ce que l'application dit ou fait déjà

- **Promesse publique** : « Gratuite, ouverte, faite pour être partagée » et « Accès libre, gratuit, à partager » sur l'accueil.
- **Charte implicite déjà affichée** dans le guide de bienvenue : « Nous comptons sur vous pour contribuer ! 1. Envoyez vos commentaires à la lecture des déroulés. 2. Partagez vos retours d'expérience après utilisation. 3. Proposez des outils qui vous semblent pertinents. 4. Partagez la BAO à vos collègues. » C'est aujourd'hui la seule contrepartie demandée, et elle n'est pas contractuelle.
- **Contrepartie « données d'impact »** : les données demandées à l'inscription (structure, catégorie, région, jeunes par an), le bouton « J'ai utilisé cet outil avec X jeunes », et les mini-enquêtes à venir servent à objectiver l'impact pour le financeur. Cette contrepartie n'est pas dite à l'utilisateur au moment où il s'inscrit.
- **Consentement newsletter** : base pour communiquer sur les formations et événements de Lit uP, donc un pont possible vers l'offre payante de l'association.
- **Pas de notion d'organisation** dans le modèle de données : la structure est un texte libre saisi par chaque personne. Une convention de mise à disposition par structure n'a donc pas de support technique aujourd'hui.

### 5.2 Questions à trancher

1. **Formaliser la charte d'engagement** : contenu (contribuer par des retours, répondre aux enquêtes d'impact, citer Lit uP, partager dans le secteur éducatif, ne pas revendre) et forme (section des CGU, ou case à cocher séparée à l'inscription, le mécanisme d'horodatage existe déjà).
2. **Cohérence entre la promesse « gratuit, illimité » et le modèle économique** : si des prestations payantes ou une mise à disposition facturée à des organismes privés sont envisagées, choisir la clause NC de la licence et ajuster la formulation des CGU.
3. **Convention par structure** : faut-il une convention pour les organisations qui déploient la BAO auprès de toute une équipe ? Si oui, prévoir le support technique (rattachement des comptes à une structure).
4. **Ce qui est dit aux utilisateurs sur la mesure d'impact** : le rendre explicite à l'inscription (finalité, transmission au financeur sous forme agrégée ou non).

---

## 6. Points impossibles à vérifier depuis le repo (à demander)

- Régions d'hébergement des projets Supabase et Vercel.
- Existence de dépôts INPI (marque, logo) et de contrats ou DPA avec les prestataires.
- Informations pour les mentions légales : siège, RNA ou SIREN, directeur de publication.
- Outil d'emailing utilisé pour la newsletter et son mécanisme de désinscription.
- Durée de rétention des exécutions Make (les payloads des webhooks y restent visibles un certain temps).
- Conditions d'utilisation des données par Anthropic pour l'API (entraînement ou non).

---

## 7. Proposition de séquencement pour tenir fin octobre

| Semaine | Contenu |
|---|---|
| 1 | Décisions : licence des fiches, licence du code, charte d'engagement, durées de conservation. Audit des sources des fiches |
| 2 | Rédaction : CGU, politique de confidentialité, mentions légales, charte, registre des traitements. Collecte des DPA |
| 3 | Intégration dans l'application (section 4.2) et purges Airtable et Google Sheet |
| 4 | Relecture croisée, mise en production, dépôt e-Soleau (export daté des fiches et du code) |
