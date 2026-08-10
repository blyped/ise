# �tat d'impl�mentation � Comp�tences ISE

**R��crit le 8 ao�t 2026, actualis� le 9 ao�t 2026 (tranches ISE-024?033, ISE-073?083 et SYS-003/004/007/010), � partir de mesures, pas de d�clarations.** Chaque chiffre de ce document
a �t� relev� sur le d�p�t (`find`, `pnpm test`, `pnpm build`) ou sur la base r�elle (requ�tes SQL
sur le projet Supabase). Format impos� par le MASTER PROMPT �106. Un module n'est jamais d�clar�
termin� sans satisfaire la Definition of Done (�107, �108).

L�gende : ? termin� � ?? partiel � ? non d�marr� � ?? sans objet

---

## 0. Les faits mesur�s

| Mesure                                                     | Valeur relev�e                                                                                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Routes web (`page.tsx`)                                    | **177** (+ `auth/callback`, `api/cms/revalidation-landing`) = **179**                                                                 |
| dont routes publiques                                      | 6 (`/`, `/connexion`, `/creer-compte`, `/mot-de-passe-oublie`, `/reinitialiser-mot-de-passe`, + `/auth/callback`)                     |
| dont routes membre authentifi�es                           | 158                                                                                                                                   |
| dont routes CMS (`/cms/**`)                                | 13                                                                                                                                    |
| �crans couverts par une route r�elle                       | **121 sur 199**                                                                                                                       |
| Migrations dans le d�p�t                                   | **82** fichiers (`0001` ? `0085`, **`0069`, `0078`, `0079` n'ont jamais �t� attribu�s**)                                              |
| Migrations en base (`schema_migrations`)                   | **82** � aucune entr�e orpheline, aucun fichier orphelin                                                                              |
| Num�ros de migration en double                             | **aucun**                                                                                                                             |
| Harnais de tests SQL                                       | **34** (`supabase/tests/rls/` 32 + `supabase/tests/search/` 2)                                                                        |
| Num�ros de harnais en double                               | `0001` et `0002` � mais dans **deux r�pertoires distincts**, donc sans collision r�elle                                               |
| Tables `public`                                            | **202**                                                                                                                               |
| Tables `private` / `analytics`                             | 24 / 4 (+ 1 vue mat�rialis�e `analytics.promotion_metrics`)                                                                           |
| Tables `public` sans RLS activ�e                           | **0**                                                                                                                                 |
| Politiques RLS (sch�ma `public`)                           | **440**                                                                                                                               |
| Tables `public` sans aucune politique                      | **3** � `domain_events`, `notification_deliveries`, `profile_search_documents` (volontaire)                                           |
| Fonctions `public` / `private`                             | 289 / 115                                                                                                                             |
| Fonctions ex�cutables par `anon`                           | **10**, exactement la liste blanche de D-125                                                                                          |
| Buckets Storage                                            | 9 � 8 priv�s (0027) + `landing-media` public (0068, D-134)                                                                            |
| T�ches `cron.job`                                          | **4**, toutes `active` (`cms_expire_content`, `cms_publish_scheduled`, `cms_select_featured_profile`, `cms_publish_featured_profile`) |
| `private.security_baseline_violations()`                   | **0 ligne** ?                                                                                                                        |
| `private.storage_baseline_violations()`                    | **0 ligne** ?                                                                                                                        |
| Tests unitaires (`pnpm test`)                              | **460** � `@ise/domain` 137, `@ise/validation` 124, `@ise/web` 199                                                                    |
| `pnpm typecheck`                                           | ? 7 t�ches, 0 erreur                                                                                                                 |
| `pnpm build`                                               | ? 1 t�che, 0 erreur                                                                                                                  |
| `pnpm format:check`                                        | ? � All matched files use Prettier code style! �                                                                                     |
| Comptes dans `auth.users`                                  | **0**                                                                                                                                 |
| Profils dans `ise_profiles`                                | **0**                                                                                                                                 |
| Contenus CMS saisis (`news`, `events`, `cms_media_assets`) | **0 / 0 / 0**                                                                                                                         |

---

## 1. Vue d'ensemble par module (MASTER PROMPT �106)

| Module                                            | �crans                 | Backend     | RLS | Tests                                 | Web          | Mobile | Risques                                                                                                                                                                                                                                                                                               | Statut |
| ------------------------------------------------- | ---------------------- | ----------- | --- | ------------------------------------- | ------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Fondations (design system, monorepo, CI)          | �                      | ?          | ??  | ? 411 unitaires                      | ?           | ?     | Aucun test E2E n'a jamais �t� ex�cut� (bac � sable sans acc�s `*.supabase.co`)                                                                                                                                                                                                                        | ??     |
| �crans syst�me                                    | SYS-001?010            | ??          | ??  | ?                                    | ? 10/10     | ?     | SYS-003/004 ne s'affichent que sur une `maintenance_window` r�ellement d�clar�e ; SYS-010 est un bandeau global (`role=status`) ; aucun test E2E                                                                                                                                                      | ??     |
| Identit� � acc�s, r�clamation, onboarding         | ISE-001?015            | ?          | ?  | ?? SQL 0002                           | ? 15/15     | ?     | Aucun compte r�el n'a jamais �t� cr�� ; aucun test E2E                                                                                                                                                                                                                                                | ??     |
| Profil & disponibilit�                            | ISE-016?033            | ?          | ?  | ? SQL 0003 (30 cas), 0032 (19 cas)   | ? 18/18     | ?     | D�p�t de photo et de CV non ouvert (D-117) ; aucune notification de demande de recommandation c�bl�e ; aucun test E2E                                                                                                                                                                                 | ??     |
| Recherche & d�couverte                            | ISE-034?037            | ?          | ?  | ? SQL 0001�0002 (search)             | ? 4/4       | ?     | Annuaire vide : la recherche fonctionne mais ne renvoie rien ; aucun test E2E                                                                                                                                                                                                                         | ??     |
| Relations & introductions                         | ISE-038?046            | ?          | ?  | ? SQL 0004                           | ? 9/9       | ?     | Filtres d'ISE-040 non livr�s (F-05) ; aucune notification c�bl�e ; aucun test E2E                                                                                                                                                                                                                     | ??     |
| Appels au r�seau                                  | ISE-047?054            | ?          | ?  | ? SQL 0005, 0019                     | ? 8/8       | ?     | Ciblage nominatif absent ; aucune notification ; aucun test E2E                                                                                                                                                                                                                                       | ??     |
| Opportunit�s                                      | ISE-055?066            | ?          | ?  | ? SQL 0006, 0020                     | ? 12/12     | ?     | Mod�ration SA-020 livr�e (`/administration/opportunites`) ; d�p�t de CV non ouvert ; aucun test E2E                                                                                                                                                                                                   | ??     |
| Promotions                                        | ISE-067?071            | ?          | ?  | ? SQL 0024                           | ? 5/5       | ?     | Aucune donn�e d'annuaire : les espaces promotion sont vides                                                                                                                                                                                                                                           | ??     |
| Stages                                            | ISE-072?077            | ?          | ?  | ? SQL 0007, 0025                     | ? 6/6       | ?     | �crans ISE-073?077 livr�s (d�tail, candidature, relecture, suivi, r�sultat) ; aucun test E2E ; aucune offre r�elle en base                                                                                                                                                                            | ??     |
| Mentorat                                          | ISE-078?083            | ?          | ?  | ? SQL 0008, 0026                     | ? 6/6       | ?     | �crans ISE-078?083 livr�s (`/mentorat` et sous-routes) ; carte `/collaborer` r�activ�e ; aucun mentor r�el en base ; aucun test E2E                                                                                                                                                                   | ??     |
| Communaut�s                                       | ISE-084?087            | ?          | ?  | ? SQL 0009, 0027                     | ? 4/4       | ?     | Cr�ation de communaut� non ouverte (C-k) ; pi�ces jointes non ouvertes (C-i)                                                                                                                                                                                                                          | ??     |
| Projets & consortiums                             | ISE-088?091            | ?          | ?  | ? SQL 0010, 0028                     | ? 4/4       | ?     | Assistant de cr�ation de projet non livr� (P-f)                                                                                                                                                                                                                                                       | ??     |
| Actualit�s & �v�nements                           | ISE-092?096            | ?          | ?  | ? SQL 0011, 0029                     | ? 5/5       | ?     | 0 actualit� et 0 �v�nement en base ; proposition d'actualit� non ouverte (N-i)                                                                                                                                                                                                                        | ??     |
| Messagerie                                        | ISE-097                | ?          | ?  | ? SQL 0012, 0016                     | ? 3 routes  | ?     | **Realtime non v�rifi� contre la base r�elle** ; aucun message n'a jamais transit�                                                                                                                                                                                                                    | ??     |
| Notifications & param�tres                        | ISE-098?099            | ?          | ?  | ? SQL 0013, 0017                     | ? 7 routes  | ?     | **33 types seed�s, aucun consommateur d'�v�nement, aucun envoi.** Le centre de notifications lit une table vide                                                                                                                                                                                       | ??     |
| Aide & support                                    | ISE-100                | ?          | ?  | ? SQL 0014, 0018                     | ? 5 routes  | ?     | Aucun SLA affich� (D-85) ; aucun agent de support n'existe                                                                                                                                                                                                                                            | ??     |
| Site public (landing)                             | PUB-001                | ?          | ?  | ? SQL 0021, 0023 � 141 unitaires web | ? 1/1       | ??     | **Toutes les sections rendent leur �tat vide** : 0 m�dia, 0 actualit�, 0 �v�nement, 0 partenaire, statistiques � z�ro                                                                                                                                                                                 | ??     |
| CMS (back-office du site public)                  | CMS-001?010            | ?          | ?  | ? SQL 0021, 0022                     | ? 13 routes | ??     | Variantes d'image non g�n�r�es (D-133/D-140) ; aucun contenu n'a �t� saisi                                                                                                                                                                                                                            | ??     |
| Superadmin — cœur (revue, modération, support)    | SA-001→020, SA-038→039, SA-011→015 | ✅ | ✅ | ✅ SQL 0030 (72 cas)    | 🟡 27/50     | 🟡     | Lot cœur livré sous `/administration` (0076+0077+0092+0093) : tableau de bord, membres & rôles, réclamations, promotions (délégués, invitations, campagnes d'invitation), appels, opportunités, modération, support. Restent : suivis/bilans (SA-021→033) ; SA-034→037 couverts par SA-018/CMS (decision C-07) | 🟡     |
| Profils incomplets (SA-043)                       | SA-043                 | ? | ?  | ?                                    | ?           | ??     | Import en masse (SA-040/041/042/044/045) abandonn� (d�cision C-06) : le recensement Excel a �t� import� directement en migration (0088), 255 profils. SA-043 d�plac� vers `/administration/profils-incomplets`.                                                                                    | ?     |
| Analytics                                         | SA-046?047             | ??          | ?  | ?                                    | ?           | ??     | Sch�ma `analytics` pos�, 4 tables + 1 vue mat�rialis�e, **aucun agr�gat calcul� sur des donn�es r�elles**                                                                                                                                                                                             | ?     |
| OPS � supervision technique (**abandonn�**, C-05) | OPS-001?028            | ?          | ?  | ?                                    | ?? 0/28      | ??     | Abandonn� par d�cision du porteur (C-05) : supervision via Supabase/Vercel                                                                                                                                                                                                                            | ??     |
| Application mobile                                | toutes s�ries          | ??          | ??  | ?                                    | ??           | ?     | `apps/mobile` n'est pas cr��                                                                                                                                                                                                                                                                          | ?     |

---

## 2. Base de donn�es

**82 migrations** dans le d�p�t (`0001` ? `0085`, les num�ros `0069`, `0078` et `0079` n'ont
jamais �t� attribu�s), **82 entr�es** en base. Aucun fichier sans entr�e, aucune entr�e sans fichier, aucun num�ro en
double. Le contr�le d'�quivalence d�p�t ? base est d�taill� dans `docs/migration-integrity.md` :
**54 migrations conformes, 20 divergentes** apr�s normalisation � les �carts observ�s portent sur
des libell�s de `comment on` et des formes de code �quivalentes, mais ils prouvent que des
fichiers ont �t� �dit�s apr�s application, ce que le README du dossier interdit.

- **202 tables** dans `public`, **24** dans `private`, **4** dans `analytics`, 1 vue mat�rialis�e.
- **RLS activ�e et forc�e sur les 202 tables** de `public` ; **440 politiques**.
- **3 tables sans politique** � `domain_events`, `notification_deliveries`,
  `profile_search_documents` � ferm�es volontairement (voir `docs/rls.md`).
- Le r�le `anon` n'a **aucun** privil�ge de table. Il ex�cute exactement **10 fonctions**
  (`get_landing_*` � 9 + `record_public_landing_event`), la liste blanche de D-125, v�rifi�e
  m�caniquement par le contr�le `anon_function_grant`.
- Aucune fonction `SECURITY DEFINER` sans `search_path` fig�.
- `private.security_baseline_violations()` et `private.storage_baseline_violations()` renvoient
  **0 ligne**.
- **4 t�ches `pg_cron` r�ellement planifi�es et actives** (D-129).

### R�f�rentiels seed�s

| R�f�rentiel                          | Volume (relev� en base) |
| ------------------------------------ | ----------------------- |
| Pays (ISO 3166-1, libell�s fran�ais) | 249                     |
| Comp�tences                          | 543                     |
| Cat�gories / domaines de comp�tences | 92 / 18                 |
| Alias de comp�tences                 | 125                     |
| Secteurs                             | 35                      |
| Fonctions professionnelles           | 36                      |
| Promotions ISE                       | 72                      |
| Types de notification                | 33                      |
| Sections CMS (seed de 0057)          | 9                       |

---

## 3. Code applicatif

- `packages/design-tokens` � palette, typographie, espacement, rayons, ombres, grille, points de
  rupture ; variables CSS Tailwind v4 et preset partag�.
- `packages/domain` � moteur de matching d�terministe et explicable, machines d'�tats, matrice
  r�les � permissions, r�gles de visibilit�. **137 tests**.
- `packages/validation` � sch�mas Zod (auth, onboarding, profil, sections de profil,
  positionnement / projets / langues / recommandations / disponibilit� (`profile-extras`),
  r�seau). **124 tests**.
- `packages/ui-web` � composants accessibles avec leurs �tats.
- `packages/db-types`, `packages/config`.
- `apps/web` � Next.js, App Router, **179 routes**. En-t�tes de s�curit�, middleware de session,
  aucune cl� `service_role` c�t� client. **199 tests** (landing, redirections s�res, rendu,
  fiabilit�, m�tadonn�es d'image CMS, conflits de programmation, statuts de collaboration).
- `apps/mobile` � **n'existe pas**.

---

## 4. Ce qui n'existe pas encore

Cette section est la partie utile du document. Elle ne contient que des manques constat�s.

### Aucune donn�e r�elle nulle part

- **`auth.users` contient 0 ligne.** Aucun compte n'a jamais �t� cr��. Le parcours
  ISE-001 ? ISE-002 ? ISE-005 ? ISE-007 ? ISE-008�014 n'a jamais �t� d�roul� de bout en bout
  contre la base r�elle. Tous les �crans membre sont donc livr�s **sans avoir jamais �t� vus
  fonctionner avec une session**.
- **`ise_profiles` contient 0 ligne.** L'annuaire n'a pas �t� import�. La recherche, le matching,
  les promotions, les introductions et les appels au r�seau fonctionnent tous sur un ensemble
  vide. Aucun profil de d�monstration n'a �t� cr�� (MASTER PROMPT �78).
- **0 actualit�, 0 �v�nement, 0 opportunit�, 0 m�dia CMS, 0 �v�nement de domaine.** La landing
  publique rend int�gralement ses �tats vides, et le CMS liste des tables vides.

### Aucun test de bout en bout

- **Aucun test E2E n'a jamais �t� ex�cut�.** `apps/web/e2e/public-redirect.spec.ts` existe et est
  c�bl� dans `.github/workflows/e2e.yml`, mais n'a jamais tourn� (le bac � sable n'a pas d'acc�s
  � `*.supabase.co`). C'est le maillon manquant de la Definition of Done sur **toutes** les
  tranches d�clar�es livr�es.
- Les 411 tests unitaires ne touchent jamais la base. Les 31 harnais SQL touchent la base mais
  jamais l'interface.

### Modules entiers sans interface

- **Superadmin : le c�ur est livr�** (`/administration`, migrations 0076 + 0077, harnais 0030 �
  72 cas, 0 �chec) : tableau de bord � compteurs r�els, membres & profils (statuts, r�les
  `roles.manage` jamais sur soi-m�me, notes administratives en `private`), **revue des
  opportunités, signalements et support, ainsi que les campagnes d'invitation de promotion
  (SA-011→015, migrations 0092+0093). Restent sans écran : SA-021→037 (suivis, bilans,
  projets/communautés/événements/contenus — la partie éditoriale est couverte par le CMS).
  (cr�ation de profil r�f�renc�), SA-011?015 (campagnes d'invitation), SA-021?037 (suivis, bilans,
  projets/communaut�s/�v�nements/contenus � la partie �ditoriale est couverte par le CMS).
- **OPS (OPS-001 ? OPS-028) : abandonn�** par d�cision du porteur (C-05). Aucune table de supervision, d'incident ou
  d'astreinte. Le module n'a pas commenc�.
- **Mentorat (ISE-078 ? ISE-083) : livr� le 2026-08-09.** `/mentorat` (accueil), `/mentorat/besoin`,
  `/mentorat/mentors` (+ fiche et demande), `/mentorat/demandes` (accepter / autre format D-54 /
  d�cliner sans motif), `/mentorat/[mentorshipId]` (+ `/bilan`), `/mentorat/devenir-mentor`.
  La carte � Mentorat � de `/collaborer` est redevenue cliquable.
- **Stages (ISE-073 ? ISE-077) : livr� le 2026-08-09.** `/stages/[offerId]` (+ `/candidature`,
  `/relecture`), `/stages/candidatures` (+ d�tail et `/resultat`) ; l'onglet � Mes candidatures �
  de `/stages` est r�tabli. Les sept Server Actions de `stages/actions.ts` sont d�sormais toutes
  branch�es sur des �crans r�els.
- **Profil (ISE-024 ? ISE-033) : 10 �crans manquants** � secteurs/fonctions/expertises, projets
  et r�alisations, langues et zones d'exp�rience, recommandations, compl�tion, disponibilit�.

### Rien n'est envoy� � personne

- **Aucune Edge Function, aucune file d'attente, aucun worker.** Les �v�nements de domaine sont
  bien �crits dans `public.domain_events`, **aucun consommateur ne les lit**. Personne n'est
  pr�venu d'une invitation re�ue, d'un appel publi�, d'une candidature ou d'un message.
- Les **33 types de notification** sont seed�s ; `notification_deliveries` n'a aucune politique
  RLS et aucune ligne.
- Les **alertes de recherche enregistr�es** (ISE-036) sont persist�es ; le service qui les
  d�clenche n'existe pas � l'�cran le dit et n'annonce aucun d�lai.
- **Aucune expiration automatique** : `connection_requests.expires_at` (30 j) et
  `introduction_requests.expires_at` (14 j) sont pos�s, aucune t�che ne fait passer les lignes en
  `expired`. Les 4 t�ches `pg_cron` actives sont **toutes** des t�ches CMS.

### Fichiers

- Les 8 buckets priv�s de `0027` existent avec leurs politiques ; **aucun �cran ne d�pose ni ne
  relit de fichier**. `verification-documents`, `profile-documents` (CV), `avatars`,
  `message-attachments`, `support-attachments`, `project-assets` et `admin-imports` sont vides et
  sans parcours. Seul `landing-media` a un parcours de d�p�t (CMS-008), et il n'a rien re�u.
- Les **variantes d'image** (Desktop / Mobile / vignette) ne sont pas g�n�r�es : aucun encodeur
  c�t� serveur (D-133, amend� par D-140).

### Int�grit� documentaire

- **20 migrations sur 74 divergent** entre le fichier du d�p�t et le SQL r�ellement appliqu�
  (voir `docs/migration-integrity.md`). Les �carts constat�s sont non structurels, mais la r�gle
  � aucun fichier ne doit jamais �tre modifi� apr�s son application � n'a pas �t� respect�e.
- La migration `0067_cms_backoffice_api.sql` est enregistr�e en base sous le nom
  **`cms_backoffice_api`**, sans son pr�fixe num�rique. C'est la seule entr�e non pr�fix�e.
- Le num�ro **`0069` n'existe pas** : ni fichier, ni entr�e en base. Trou assum�.

---

## 5. Prochaines �tapes, par ordre de priorit�

1. **Cr�er un premier compte r�el** et d�rouler ISE-001 ? ISE-014 contre la base. Tant que
   `auth.users` est vide, aucune tranche ne peut pr�tendre � la Definition of Done.
2. **Ex�cuter les tests E2E** depuis un environnement ayant acc�s � `*.supabase.co`, puis �crire
   ceux des parcours critiques (r�clamation, onboarding, recherche, connexion, candidature).
3. ~~Livrer un back-office minimal de revue~~ � **fait** : `/administration/reclamations` arbitre
   les r�clamations (SA-004/SA-006, fonctions atomiques `approve_profile_claim` /
   `reject_profile_claim`, harnais 0030).
4. ~~Importer un jeu d'annuaire r�el~~ � **fait le 2026-08-09, autrement** : le recensement Excel
   (275 r�ponses, 255 profils apr�s d�doublonnage) a �t� import� directement en migration
   (`0088_import_ise_census`), en contournant le module SA-040 ? SA-042. D�cision C-06 (docs/decisions.md) :
   ce module est abandonn�, plus aucun �tat vide � combler par ce biais.
5. **Brancher un consommateur d'�v�nements de domaine** (notifications in-app d'abord) : sinon les
   19 modules livr�s sont muets.
6. ~~Livrer les �crans manquants de Stages (5) et de Mentorat (6)~~ � **fait le 2026-08-09**
   (ISE-073 ? ISE-083, harnais 0025/0026 rejou�s verts).
7. **Livrer ISE-024 ? ISE-033**, SYS-003, SYS-004, SYS-007, SYS-010.
8. **R�aligner les 20 migrations divergentes** � non pas en �ditant les fichiers, mais en
   d�cidant explicitement quelle version fait foi et en consignant la d�cision.
9. Compléter le chantier **Superadmin** : le cœur (SA-001→020, SA-038→039, SA-011→015) est livré ; restent SA-021→033. SA-034→037 couverts par l'existant (décision C-07). OPS est abandonné (C-05).
10. Cr�er `apps/mobile`.

