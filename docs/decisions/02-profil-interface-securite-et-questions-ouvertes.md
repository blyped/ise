# Journal des décisions — Compétences ISE — Partie 2/8 : Profil, interface, sécurité et questions ouvertes

Sections 7 à 11 du journal des décisions du projet Compétences ISE.
Index général, préambule, convention de statut (ADOPTÉE / PROVISOIRE / OUVERTE)
et décisions de cadrage : [`docs/decisions.md`](../decisions.md).

---

## 7. Profil et onboarding

| # | Décision | Justification |
| --- | --- | --- |
| D-70 | **ADOPTÉE** — Onboarding en **7 étapes**, conformes aux maquettes ISE-008 → ISE-014 : (1) Promotion · (2) Compétences · (3) _(voir ISE-010/011)_ · (4) Secteurs · (5) Localisation · (6) Disponibilité · (7) Finalisation. Les libellés et l'ordre proviennent des noms de fichiers des maquettes (D-01), qui tranchent le conflit 7 / 8 / 9 étapes. | Les maquettes portent explicitement « Étape N » dans leur nom. |
| D-71 | **ADOPTÉE** — Le score de complétion est calculé par `public.calculate_profile_completion(profile_id)`, à pondérations **stockées en base** (`profile_completion_rules`) et non codées en dur. Les 10 sous-pondérations manquantes sont initialisées à une répartition uniforme du reliquat et ajustables par le back-office sans migration. | Le doc 20 ne chiffre que 3 des 13 blocs. Externaliser les poids évite une migration à chaque recalibrage. |
| D-72 | **ADOPTÉE** — Le score de complétion est **privé** : lisible par son propriétaire uniquement (RLS), jamais agrégé en classement, jamais affiché sur un profil tiers. | MASTER PROMPT §17. |
| D-73 | **ADOPTÉE** — Échelle de visibilité unifiée à **4 niveaux** : `private` (moi seul) · `connections` (mes relations) · `members` (tous les membres authentifiés) · `promotion` (ma promotion). Les échelles à 3 et 6 niveaux des autres documents y sont mappées. Aucune visibilité `public` (web ouvert) en V1. | MASTER PROMPT §47 : « les profils sont visibles aux membres autorisés, pas au web public ». |
| D-74 | **ADOPTÉE** — Visibilités par défaut pour les 10 champs non spécifiés : e-mail personnel `private` · téléphone `private` · CV `private` · date de naissance `private` · adresse `private` · employeur actuel `members` · poste `members` · ville `members` · pays `members` · LinkedIn `members`. | MASTER PROMPT §47 : par défaut, le moins exposé. |
| D-75 | **ADOPTÉE** — Le niveau de compétence est **déclaratif** et étiqueté comme tel dans l'interface. Aucune promotion automatique en « validé » ou « certifié », y compris après recommandation. | MASTER PROMPT §18. |

### Arbitrages rendus à la livraison de l'onboarding (ISE-008 → ISE-014) et du profil (ISE-016 → ISE-023)

| # | Décision | Justification |
| --- | --- | --- |
| D-110 | **ADOPTÉE** — Numérotation définitive des 7 étapes : (1) Vérification · (2) Promotion · (3) Compétences · (4) Secteurs · (5) Localisation · (6) Disponibilité · (7) Finalisation. Routes : `/bienvenue/<etape>`, point d'entrée `/bienvenue`. | Deux rails coexistent dans les maquettes : celui d'ISE-008 et d'ISE-010 (Bienvenue / Promotion / Situation actuelle / Compétences / Ce que vous recherchez / Comment vous pouvez aider / Confidentialité) et celui d'ISE-009 et ISE-011→014. Les **noms de fichiers** tranchent (D-01) : `ISE-011_Secteurs_Etape_4`, `ISE-012_…_Etape_5`, `ISE-013_…_Etape_6`, `ISE-014_…_Etape_7` fixent quatre positions sur sept, et le rail d'ISE-009→014 est le seul compatible avec elles. L'en-tête « Étape 4 sur 7 » d'ISE-010 est donc écarté. |
| D-111 | **ADOPTÉE** — L'étape 1 « Vérification » **n'envoie aucun code**. Elle affiche l'état réel lu en base (adresse du compte et sa confirmation, profil associé, promotion enregistrée, statut de vérification) et demande une confirmation explicite. | Prolongement direct de D-03 : l'adresse est déjà confirmée par Supabase Auth et l'association a déjà été vérifiée à la réclamation. Un second code vérifierait une seconde fois la même chose (MASTER PROMPT §27 et §113). |
| D-112 | **ADOPTÉE** — La progression d'onboarding est persistée dans `public.profile_onboarding_progress` (migration 0035), une ligne par profil, politique « propriétaire uniquement ». Les **saisies** restent dans leurs tables métier : cette table ne porte que le curseur (`current_step`, `furthest_step`, `skipped_steps`). | Exigence « aucun état d'onboarding stocké uniquement côté client ». Séparer le curseur des données évite de dupliquer la donnée de profil et rend le retour en arrière non destructif. |
| D-113 | **ADOPTÉE** — ISE-009 alimente une table **dédiée** `public.promotion_suggestions` (0035), et non `missing_member_suggestions`. | `missing_member_suggestions` (0003) porte un **membre** manquant **dans** une promotion existante : `promotion_id NOT NULL`, `first_name`/`last_name NOT NULL`. Elle ne peut structurellement pas porter une promotion absente du référentiel. Le champ demandé par la maquette (libellé, établissement, pays, année approximative, commentaire) impose une table propre. |
| D-114 | **ADOPTÉE** — Le « niveau de disponibilité » d'ISE-013 (Faible / Modérée / Élevée) est enregistré comme un **plafond mensuel déclaré** (`profile_availabilities.max_per_month` = 1 / 3 / 8), constante unique dans `@ise/validation`. | Aucune colonne ne porte un « niveau » ; `max_per_month` est la seule qui exprime la même intention. Le plafond reste indicatif : il ne vaut jamais obligation d'accepter (MASTER PROMPT §20). |
| D-115 | **ADOPTÉE** — Le commutateur binaire « Afficher ma ville sur mon profil » (ISE-012) est remplacé par un choix à **4 niveaux** (D-73), enregistré dans `profile_visibility` pour les champs `city` et `country`. | Un interrupteur ne sait pas exprimer « ma promotion seulement », qui est un des quatre niveaux de l'échelle unifiée. Le choix est appliqué par la base, pas par l'affichage. |
| D-116 | **ADOPTÉE** — Écarts de contenu assumés, faute de donnée réelle : le bloc « Suggestions pour vous » d'ISE-010, « Secteurs fréquents dans le réseau » d'ISE-011, « Votre profil dans le réseau » d'ISE-016, et les compteurs « projets / recommandations » d'ISE-023 ne sont **pas rendus**. Le référentiel complet regroupé par domaine les remplace, et ISE-023 n'affiche que le décompte d'expériences, calculé sur des données réelles, avec sa règle de calcul écrite à l'écran. | Ces blocs supposent un annuaire peuplé. Les remplir sans données produirait des personas et des indicateurs inventés (MASTER PROMPT §78 et §98). |
| D-117 | **ADOPTÉE** — Le dépôt de photo de profil (ISE-017) n'est pas ouvert : l'écran l'annonce au lieu d'afficher un bouton « Changer la photo ». `educations` reçoit en revanche les colonnes `education_type`, `city` et `credential_url` (migration 0036) pour qu'ISE-021 n'affiche aucun champ sans destination. | Un bouton sans téléversement serait décoratif (MASTER PROMPT §113). Entre « masquer un champ de la maquette » et « ajouter la colonne manquante », la seconde option est retenue quand la donnée a une valeur métier durable. |
| D-118 | **ADOPTÉE** — Le référentiel `introduction_requests.outcome` reçoit une sixième valeur, `referred_to_other_contact` (migration 0039). Elle porte l'option « Introduction complémentaire — la cible vous a orienté vers un autre contact » d'ISE-046. La contrainte `CHECK` de 0006 est remplacée, 0006 n'est pas éditée. | Aucune des cinq valeurs d'origine ne portait ce fait, qui est pourtant distinct : l'échange a eu lieu **et** a produit une réorientation. Le ranger sous `exchange_held` perdrait l'information ; retirer l'option de la maquette perdrait la fonction. Même arbitrage qu'en D-117 : quand la donnée a une valeur métier durable, on ajoute la colonne (ou la valeur) plutôt que de masquer le champ. |
| D-119 | **ADOPTÉE** — Le classement des intermédiaires d'ISE-043 produit un **libellé qualitatif** (`recommended` ≥ 3 signaux · `relevant` = 2 · `possible` = 1) et **jamais** un score. Les signaux comptés sont exactement les quatre de D-51 : relation directe confirmée des deux côtés, organisation commune avec la cible, promotion commune avec la cible, disponibilité déclarée « introduction ». Les raisons retenues sont renvoyées avec chaque proposition. | Transposition de D-42 et D-43 au chemin d'introduction : le MASTER PROMPT §15 interdit d'exposer un score, et §16 interdit un matching opaque. Un décompte de signaux explicites est vérifiable par l'utilisateur, un score ne l'est pas. |
| D-120 | **ADOPTÉE** — « Ignorer » une invitation (ISE-041) n'écrit **rien** : aucune fonction, aucun statut, aucune trace. La demande reste `pending` jusqu'à son expiration (30 jours, Q-04). | D-55 : aucun statut ne franchit une étape non constatée. « Ignoré » n'est pas un événement — c'est l'absence d'événement. Un bouton qui l'enregistrerait fabriquerait une donnée. |

---

## 8. Notifications, messagerie, paramètres

| # | Décision | Justification |
| --- | --- | --- |
| D-80 | **ADOPTÉE** — La matrice canaux × événements de référence est celle du **doc 34** (spécification finale), complétée par les événements que seul le doc 14 mentionne. Règle transverse : _in-app pour toute interaction importante · e-mail pour les actions significatives et les digests · push uniquement pour l'utile et le temporel_. | MASTER PROMPT §35 ; les deux matrices se contredisaient sur Messages/e-mail, Appels/push et Opportunités. |
| D-81 | **ADOPTÉE** — « Action requise » est une **priorité** (`priority`), pas une catégorie. Catégories conservées : Relations, Introductions, Appels, Opportunités, Mentorat, Communautés, Projets, Messages, Actualités, Système. | Le doc 14 en fait une priorité, le doc 34 une catégorie ; en faire une catégorie ferait perdre les catégories « Connexions » et « Actualités ». |
| D-82 | **ADOPTÉE** — Archivage des conversations **par participant** : `conversation_participants.archived_at`. Pas d'archivage global. | Archiver globalement ferait disparaître la conversation chez l'autre membre. |
| D-83 | **ADOPTÉE** — États d'un message : `pending` (local, non persisté serveur) → `sent` (ACK serveur) → `failed`. L'interface n'affiche jamais « envoyé » avant l'accusé de réception serveur. Realtime limité aux conversations ouvertes et au compteur de non-lus. | MASTER PROMPT §34 et §45. |
| D-84 | **PROVISOIRE** — Pièces jointes : 10 Mo par fichier, 3 fichiers par message, types autorisés `pdf, docx, xlsx, pptx, png, jpg, webp`. Exécutables et archives interdits. Nouvelles conversations : 20 par jour et par membre. | Les documents donnent « 10–20 Mo » à titre indicatif et aucun quota. Valeurs prudentes, centralisées dans `packages/config`. |
| D-85 | **PROVISOIRE** — Aucun SLA de support n'est affiché à l'utilisateur, faute de valeur métier documentée. Les tickets portent uniquement les 3 niveaux d'urgence documentés (Standard / Important / Sécurité), l'urgence n'étant pas librement choisie par le demandeur. | MASTER PROMPT §98 : pas de KPI inventé. Un délai affiché sans engagement réel serait un faux KPI. |

---

## 9. Design system et états d'interface

| # | Décision | Justification |
| --- | --- | --- |
| D-90 | **ADOPTÉE** — **Pas de couleur dédiée par module métier.** La couleur ne porte jamais seule une information : tout état est doublé d'un libellé et/ou d'une icône. | Le doc 35 §21 l'interdit explicitement, le doc 4 §34 le proposait. Le doc 35 prime (D-02) et rejoint le MASTER PROMPT §55. |
| D-91 | **ADOPTÉE** — Typographie **Geist**, fallback **Inter**. Topbar 68 px. Rayon de base 10 px. Échelle d'espacement à 11 tokens. Valeurs issues du doc 35. | Le doc 35 est la version la plus récente du design system. |
| D-92 | **ADOPTÉE** — `--color-primary-hover` (nommé sans valeur dans les documents) = `#1D4ED8` (Active Blue de la palette du MASTER PROMPT §13). | Cohérence avec la palette officielle. |
| D-93 | **ADOPTÉE** — Convention transverse des états, appliquée à **tous** les écrans pilotés par des données (aucun document ne spécifiait `loading` ni `error`) : squelette calqué sur la mise en page réelle pour `loading` · `EmptyState` avec action de sortie pour `empty` · `ErrorState` avec `correlation_id` et bouton « Réessayer » pour `error` · `SYS-006` pour `unauthorized` · `OfflineState` sur mobile. Jamais de page blanche. | MASTER PROMPT §61 et §43. |
| D-94 | **ADOPTÉE** — Navigation mobile : **5 destinations** — Accueil · Réseau · action centrale (+) · Opportunités · Moi. | MASTER PROMPT §90 (« éviter plus de 5 destinations ») ; le doc 35 se contredisait entre 4 et 5. |
| D-95 | **ADOPTÉE** — Ordre de la sidebar web : celui du MASTER PROMPT §89, qui tranche l'inversion Collaborer / Communautés entre les docs 35 et 4. | D-01. |
| D-96 | **ADOPTÉE** — Grille web : 12 colonnes, gouttière 24 px (≥ 1024 px) / 16 px (< 1024 px), sidebar 248 px, largeur de contenu max 1160 px. Points de rupture : 375 · 768 · 1024 · 1440. | Aucune grille en colonnes n'était définie ; ces valeurs sont compatibles avec les max-widths documentées. |

---

## 10. Sécurité et exploitation

| # | Décision | Justification |
| --- | --- | --- |
| D-100 | **ADOPTÉE** — La clé `service_role` n'est présente que dans les secrets serveur (Vercel, Edge Functions). Aucun accès client ne l'utilise. Les mutations sensibles passent par des fonctions SQL atomiques ou des Server Actions authentifiées. | MASTER PROMPT §11 et §76. |
| D-101 | **ADOPTÉE** — Toute fonction `SECURITY DEFINER` déclare `SET search_path = ''` et qualifie chaque objet. Chaque usage est justifié dans `docs/rls.md`. | MASTER PROMPT §72. |
| D-102 | **ADOPTÉE** — Toute erreur renvoyée au client porte un `correlation_id` et un message métier en français. Aucune trace technique, aucun nom de table, aucun SQL exposé. | MASTER PROMPT §43 et §99. |
| D-103 | **ADOPTÉE** — Limitation de débit applicative sur : création de compte, réinitialisation de mot de passe, demandes de connexion, demandes d'introduction, création d'appels, messages vers un nouveau contact. Compteurs en base (`private.rate_limit_counters`), fenêtre glissante. | MASTER PROMPT §64 et §71. |
| D-104 | **ADOPTÉE** — Les comptes de test Auth sont préfixés `test+` et marqués `is_test_account`. Aucun compte Auth n'est créé pour représenter un profil importé, en aucun environnement. | MASTER PROMPT §6, §78 et §113. |
| D-105 | **ADOPTÉE** — L'approbation automatique d'une réclamation par e-mail historique (ISE-007) exige que l'adresse du compte soit **confirmée** (`auth.users.email_confirmed_at`) _et_ égale à `private.profile_contacts.primary_email_norm`. Une adresse non confirmée ne prouve rien. | Sans cette condition, créer un compte avec l'adresse historique d'un tiers suffirait à s'emparer de son profil : la « vérification » deviendrait une porte d'entrée. MASTER PROMPT §7 et §71. |
| D-106 | **ADOPTÉE** — `public.search_claimable_profiles()` et `public.get_claimable_profile()` ne sont appelables que par un compte **non encore rattaché** à un profil, ou par un porteur de `profiles.verify`. | Un membre déjà rattaché n'a aucun motif légitime d'énumérer l'annuaire non réclamé avec ses indices de coordonnées ; l'annuaire des membres relève d'ISE-034 et de ses propres règles de visibilité (D-73, MASTER PROMPT §47). |
| D-107 | **ADOPTÉE** — L'indice d'e-mail historique est **construit en base** au format `a•••@d•••.tld` (`private.mask_email_hint`). L'adresse complète ne quitte jamais le serveur, ni le téléphone, ni l'adresse postale, ni la date de naissance. | MASTER PROMPT §47 : « ne jamais renvoyer puis masquer ». Un masquage côté interface laisserait la donnée dans la réponse réseau. |

---

## 11. Questions ouvertes soumises au métier

Ces points n'empêchent pas d'avancer (une valeur par défaut est appliquée et signalée ci-dessus),
mais méritent une confirmation.

| # | Question | Valeur appliquée par défaut |
| --- | --- | --- |
| Q-01 | Pondérations de matching D-41 : faut-il les recalibrer une fois l'annuaire réel importé ? | Valeurs D-41, isolées dans une constante unique. |
| Q-02 | Délai d'expiration automatique d'un appel au réseau sans activité. | 60 jours, puis passage en `expired`. |
| Q-03 | Délai d'expiration d'une demande d'introduction sans réponse de l'intermédiaire. | 14 jours. |
| Q-04 | Délai d'expiration d'une demande de connexion. | 30 jours. |
| Q-05 | Les ~150 compétences issues du doc 19 (D-61) doivent-elles être conservées, fusionnées ou retirées ? | Conservées, marquées `source='doc19'`. |
| Q-06 | Faut-il afficher un délai de réponse du support (D-85) ? | Non affiché tant qu'aucun engagement réel n'existe. |
| Q-07 | Groupes de discussion : V1 limités aux projets, ou pas de groupes du tout en V1 ? | Limités aux projets et communautés (doc 34). |
| Q-08 | Ouverture d'un second projet Supabase de staging (cf. C-01). | Non pour l'instant ; migrations rejouables prêtes. |

---
