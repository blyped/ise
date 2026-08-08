# Routage public et retour après authentification

> ADDENDUM AU MASTER PROMPT §2 à §8, §46, §47, §52, §53, §55, §61.
> Périmètre de ce document : la racine publique, la primitive de routage protégé,
> la protection contre les redirections ouvertes, l'en-tête et le pied de page
> publics, la coquille de PUB-001, le cache et le SEO.
> Le modèle de données CMS et les écrans CMS-001 à CMS-010 ne sont pas traités ici.

---

## 1. La racine est publique

`/` ouvre **PUB-001**. Ce n'est plus l'écran de connexion.

`ISE-001` reste la **seule** page d'authentification, à `/connexion` : aucune page
de login parallèle n'a été créée (§6).

| Route                                                                  | Accès                    | Rendu                                                                 |
| ---------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------- |
| `/`                                                                    | public                   | Server Component, `dynamic = 'force-dynamic'`, données mises en cache |
| `/connexion`                                                           | public                   | ISE-001, accepte `redirectTo` et `resourceType`                       |
| `/creer-compte`, `/mot-de-passe-oublie`, `/reinitialiser-mot-de-passe` | public                   | inchangés                                                             |
| `/robots.txt`, `/sitemap.xml`, `/icon.svg`                             | public                   | métadonnées Next                                                      |
| `/api/cms/revalidation-landing`                                        | machine (secret partagé) | invalidation du cache                                                 |
| tout le reste                                                          | session obligatoire      | inchangé                                                              |

`src/lib/routes.ts` porte la liste. `ROUTES.home` a été ajouté à `PUBLIC_ROUTES`,
mais il est traité **à part** dans `isPublicPath` : un préfixe `/` rendrait tout le
site public. C'est le seul piège de ce fichier ; il est commenté sur place.

`src/middleware.ts` :

- laisse passer `/` et les routes publiques ;
- redirige toute autre route sans session vers
  `/connexion?raison=session&redirectTo=<chemin+requête>` ;
- pose `X-Robots-Tag: noindex, nofollow, noarchive` sur **toute** réponse non
  publique, y compris la redirection 307 (§53).

---

## 2. Primitive de routage protégé (§4)

Une seule règle, un seul calcul, deux points d'entrée.

```
src/lib/public/protected-route.ts          protectedHref()          — pur
src/lib/public/protected-route.server.ts   resolveProtectedRoute()  — lit la session
                                           openProtectedResource()  — redirige
```

```ts
protectedHref(target, { authenticated, resourceType });
//  authentifié  → target
//  visiteur     → /connexion?redirectTo=<target>&resourceType=<type>
```

Côté client, `ProtectedLink` applique la même fonction :

```tsx
<ProtectedLink target={route} resourceType="evenement">
  Voir l’événement
</ProtectedLink>
```

Trois propriétés en découlent :

1. **aucune carte ne recalcule la règle.** Une section qui voudrait « faire
   autrement » devrait cesser d'utiliser `ProtectedLink`, ce qui se voit en revue ;
2. **le lien est un vrai `<a href>`.** La cible est calculée au rendu serveur, pas
   au clic : clic-milieu, « ouvrir dans un nouvel onglet » et absence de JavaScript
   suivent exactement le même chemin. Un `onClick` + `router.push` ne l'aurait pas
   permis ;
3. **serveur et client produisent la même URL**, puisqu'ils appellent la même
   fonction pure — aucune divergence d'hydratation possible.

L'état de session est lu **une seule fois** par requête
(`readPublicViewer`) et diffusé par contexte React (`PublicViewerProvider`).

`resourceType` n'accorde **aucun droit**. Elle sert uniquement à ISE-001 pour
annoncer ce que l'on s'apprête à ouvrir. Une valeur inconnue est ignorée.

---

## 3. Protection contre les redirections ouvertes (§5)

`src/lib/public/safe-redirect.ts` — **seul** endroit du code autorisé à
transformer une valeur brute en cible de redirection.

```ts
safeRedirect(value, { source, correlationId }); // → chemin interne, ou /tableau-de-bord
inspectRedirect(value); // → { ok } | { ok: false, refusal }
isSafeRedirect(value); // → boolean
```

### Trois portes indépendantes

| #   | Porte                                                 | Ce qu'elle ferme                                                                       |
| --- | ----------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | Analyse lexicale de **chaque couche d'encodage**      | protocoles, `//`, antislash, caractères de contrôle, `..`                              |
| 2   | Analyse WHATWG (`new URL(value, origine-sentinelle)`) | tout ce qu'une expression régulière rate : l'origine résolue doit rester la sentinelle |
| 3   | **Liste blanche** de routes (`MEMBER_ROUTE_PREFIXES`) | les chemins internes inconnus, `/https:/evil.example`, `/administration`               |

Chacune suffirait. Les trois sont posées quand même.

### Principes

- **Liste blanche, jamais liste noire.** Une cible inconnue est refusée.
- **Refus, jamais nettoyage.** On ne « répare » pas une valeur hostile : nettoyer,
  c'est offrir une deuxième chance à l'attaquant.
- **Silencieux côté utilisateur, bruyant côté serveur.** Aucun message
  « redirection refusée » — il ne ferait qu'apprendre à l'attaquant ce qui a été
  détecté. Chaque refus est journalisé avec son motif, sa source, son
  `correlation_id` et un aperçu **neutralisé** (caractères de contrôle échappés,
  120 caractères maximum) pour qu'un `redirectTo` malveillant ne puisse pas
  fabriquer une fausse ligne de journal.
- **Toute valeur invalide renvoie vers `/tableau-de-bord`**, quel que soit le motif.

### Vecteurs couverts par les tests

`src/lib/public/safe-redirect.test.ts` — 62 tests.

| Famille                | Exemples refusés                                                                                                                                                                                                                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Absence / type         | `undefined`, `null`, `''`, tableau (paramètre répété), objet, nombre, booléen, valeur > 512 caractères                                                                                                                                                                                                        |
| Protocole              | `https://evil.example`, `http://`, `ftp://`, `file:///etc/passwd`, `ise-app://`, `javascript:alert(1)`, `JaVaScRiPt:`, `data:text/html,…`, `data:…;base64,…`, `vbscript:`, `blob:https://…`, `https://competences-ise.org/…` (aucune exception « même origine »), `https://competences-ise.org@evil.example/` |
| Protocole-relatif      | `//evil.example`, `///evil.example`, `////evil.example`, `//evil.example?suite=/tableau-de-bord`                                                                                                                                                                                                              |
| Antislash              | `\\/evil.example`, `/\evil.example`, `\/\/evil.example`, `/\/evil.example`, antislash en position quelconque                                                                                                                                                                                                  |
| Encodage               | `%2F%2Fevil.example`, `/%2F%2Fevil.example`, double `/%252F%252F…`, triple `/%25252F%25252F…`, `/%5Cevil.example`, `/%255Cevil.example`, `%6A%61%76%61…%3A` (`javascript:` encodé), `%` malformé, `%zz`, UTF-8 tronqué, empilement au-delà de 5 couches                                                       |
| Caractères de contrôle | tabulation brute et `%09`, `%0d%0a` (injection dans `Location`), `\r\n`, `%00`, `�`, DEL ``, C1 ``, espace de tête ou de queue, chaîne d'espaces                                                                                                                                                              |
| Traversée              | `/../evil`, `/..`, `/tableau-de-bord/../../evil`, `/%2e%2e/%2e%2e/evil`                                                                                                                                                                                                                                       |
| Boucle                 | `/connexion`, `/connexion?redirectTo=%2Fconnexion`, `/connexion/quelque-chose`, `/CONNEXION`, `/Connexion/`, `/creer-compte`, `/mot-de-passe-oublie`, `/reinitialiser-mot-de-passe`, `/deconnexion`, `/auth/callback`, `/session-expiree`                                                                     |
| Hors liste blanche     | `/`, `/?x=1`, `/administration`, `/api/cms/revalidation-landing`, `/.well-known/x`, `/https:/evil.example`, `/tableau-de-bord-externe`, `/messagerie`                                                                                                                                                         |
| Chemin relatif         | `tableau-de-bord`, `./tableau-de-bord`, `evil.example/tableau-de-bord`, `evil.example:8080/x`                                                                                                                                                                                                                 |
| Conservateur assumé    | `/aide?url=https%3A%2F%2Fexemple.org` — la cible resterait interne, mais une couche décodée contient `://`. Aucune route membre n'a besoin de transporter une URL externe dans un `redirectTo`.                                                                                                               |

Propriétés vérifiées sur l'ensemble des vecteurs :

- le retour commence toujours par `/`, jamais par `//`, ne contient jamais `:` ni
  `evil.example` ;
- la fonction est **idempotente** : `safeRedirect(safeRedirect(x)) === safeRedirect(x)` ;
- elle ne lève **jamais**, y compris sur `NaN`, `Symbol`, une fonction, une `Date`,
  un substitut isolé `\uD800` ou `%ED%A0%80`.

### Deux points de contrôle, pas un

`redirectTo` est validé **à l'affichage** d'ISE-001 _et_ **à la soumission** du
formulaire. La page peut être rechargée ; la Server Action peut être appelée
directement avec un `FormData` fabriqué. Elle ne tient rien pour acquis.

### Exception documentée : `/auth/callback`

Ce point d'entrée n'utilise **pas** `safeRedirect`, qui refuse les écrans
d'authentification pour éviter les boucles — or la récupération de mot de passe
doit précisément aboutir sur `/reinitialiser-mot-de-passe`. Il applique donc une
liste blanche stricte de deux valeurs : `/tableau-de-bord` et
`/reinitialiser-mot-de-passe`. Toute autre valeur retombe sur le tableau de bord.

### Nom du paramètre

`redirectTo` est le nom canonique (§4). `suivant`, employé avant l'addendum, reste
**accepté en lecture** par ISE-001 le temps que les liens en circulation
disparaissent ; il n'est plus émis nulle part.

---

## 4. En-tête et pied de page publics (§7)

`src/app/(public)/_components/PublicHeader.tsx`.

- Visiteur : Logo · Accueil · Le réseau · Actualités · Événements · Opportunités ·
  Partenaires · **Connexion**.
- Membre connecté : l'entrée « Connexion » devient **avatar + « Mon espace »**,
  qui mène au tableau de bord.

Accessibilité :

- navigation au clavier de bout en bout, focus visible fourni par les tokens
  (`:focus-visible` global, `docs` D-91) ;
- déclencheur mobile avec `aria-expanded` et `aria-controls`, libellé qui change
  entre « Ouvrir le menu » et « Fermer le menu » ;
- `Échap` ferme le panneau et **rend le focus au bouton** ;
- le panneau mobile reste dans le flux : il pousse le contenu au lieu de le
  recouvrir. Pas de piège à focus à gérer, pas de défilement à bloquer ;
- lien d'évitement « Aller au contenu principal » en première tabulation ;
- cibles tactiles à 44 px minimum sous 768 px.

### Arbitrage : où mènent les entrées de navigation

L'addendum ne définit **qu'un seul** écran public, PUB-001. Les écrans membres
correspondants (ISE-092 → ISE-096, Actualités et Événements) ne sont pas
développés. Fabriquer `/actualites` produirait une page 404 après connexion.

Les entrées « Le réseau », « Actualités », « Événements », « Opportunités » et
« Partenaires » pointent donc vers des **ancres de sections réellement rendues**
de PUB-001 (`#le-reseau`, `#actualites`, `#evenements`, `#opportunites`,
`#partenaires`). Ces ancres existent **même quand la section est vide** : la
section « À la une du réseau » rend une colonne par type de contenu, dans l'ordre
des deux maquettes, et pose les ancres même en état vide.

Le jour où ISE-092 → ISE-096 existent, la bascule est locale :
`entityRoute()` cesse de renvoyer `null` pour `event` et `news`, et
`PUBLIC_NAV_ITEMS` remplace deux ancres par deux routes.

---

## 5. Coquille de PUB-001 (§8, §23, §54)

```
src/app/page.tsx                                    PUB-001
src/app/(public)/_components/PublicShell.tsx        en-tête + pied + contexte
src/app/(public)/_components/LandingCarousel.tsx    §9, §52
src/app/(public)/_components/sections/…             une section par bloc
src/lib/public/landing-data.ts                      interface par section
src/lib/public/entity-routes.ts                     §10 — entity_type + entity_id
```

Sections, dans l'ordre des maquettes Desktop 1440 et Mobile 375 :

1. carrousel ;
2. « À la une du réseau » — 4 colonnes par type : actualité · ISE du jour ·
   événement · opportunité ;
3. « Un réseau conçu pour être utile » — 4 piliers ;
4. « Le réseau en quelques chiffres » ;
5. « Explorer les expertises » ;
6. « Entreprises & partenaires » ;
7. appel à l'action final.

### Responsive réel, pas une réduction

| Bloc               | Desktop 1440                        | Mobile 375                                                                |
| ------------------ | ----------------------------------- | ------------------------------------------------------------------------- |
| Navigation         | 6 entrées en ligne                  | repliée derrière un déclencheur ; « Connexion » reste visible             |
| Carrousel          | titre `display`, description longue | titre `h1`, description resserrée, média mobile dédié (`mobile_media_id`) |
| À la une           | 4 colonnes                          | 1 colonne, même ordre de priorité                                         |
| Chiffres           | 4 colonnes, libellés longs          | 4 colonnes compactes, **libellés courts** (`short_label`)                 |
| Titre des chiffres | « Le réseau en quelques chiffres »  | « Le réseau en chiffres »                                                 |
| Expertises         | pastilles alignées qui se replient  | pastilles empilées en pleine largeur                                      |
| Partenaires        | bouton à droite du texte            | bouton pleine largeur sous le texte                                       |

### Aucune donnée métier codée en dur

`fr.public` ne contient que des libellés d'interface et du discours de marque.
Les quatre piliers (Connecter / Entraider / Collaborer / Impacter) sont du
**discours de marque**, au même titre que `fr.brand.pillars` : ils ne décrivent
aucune donnée.

Les nombres des maquettes — **1842, 37, 29, 126** — n'apparaissent nulle part dans
le dépôt. Ils sont illustratifs (§23). Tant que `get_landing_stats()` n'existe pas,
la section affiche : « Les chiffres du réseau ne sont pas encore calculés. »

### État vide honnête

Chaque section a son état vide, qui dit **ce qui manque** et **d'où viendra la
donnée**. Aucun contenu de remplissage, aucune carte fantôme, aucun persona.

---

## 6. Couche de données (§8, §42, §44, §45)

`src/lib/public/landing-data.ts` expose une interface par section :

```ts
LandingSlide · LandingHighlight · LandingStat · LandingExpertise · LandingPartnerCampaign
LandingSection<TItem> = { status: 'ok' | 'indisponible'; items; reason? }
```

Fonctions d'agrégation attendues côté base, regroupées dans `LANDING_FUNCTIONS` —
un seul fichier à reprendre le jour de leur livraison :

```
get_landing_carousel · get_landing_highlights · get_landing_stats
get_landing_expertises · get_landing_partners
```

Comportement :

- le client est **anonyme et sans cookie** : la landing ne lit que des fonctions
  explicitement _public-safe_ (§44, §45), jamais une table métier ;
- chaque réponse est validée par un schéma Zod. Une ligne invalide est **écartée**,
  elle n'invalide pas la section ;
- `PGRST202` (fonction absente) est l'**état nominal** tant que la couche CMS n'est
  pas livrée, pas une anomalie : la section passe en `indisponible` ;
- aucune erreur ne remonte à la page. `loadLandingData()` ne rejette jamais.

### Liens d'entité (§10)

Le CMS ne stocke pas d'URL interne : il stocke `entity_type` + `entity_id`.
`entityRoute()` calcule la route, à un seul endroit. Une entité dont l'écran membre
n'existe pas encore (`event`, `news`) renvoie `null` : la carte est alors rendue
**sans action**, plutôt qu'avec un lien mort.

---

## 7. Cache et fiabilité (§46, §47)

- `loadLandingData()` est enveloppée dans `unstable_cache`, étiquette
  `pub-001-landing`, revalidation 300 s.
- **Invalidation ciblée** après publication CMS :
  - Server Action `revalidateLanding()` — `src/lib/public/revalidate-landing.ts` ;
  - Route Handler `POST /api/cms/revalidation-landing`, en-tête
    `x-ise-revalidation-secret`, comparaison à temps constant. Sans
    `CMS_REVALIDATION_SECRET` configuré, la route répond **503** : elle n'est jamais
    ouverte par défaut. `GET` n'est pas exposé — une invalidation est un effet de bord.
  - Le CMS ne l'appelle pas encore. Le point existe pour qu'il n'ait rien à inventer.
- **Dernière version valide** : une lecture réussie est mémorisée. Si toutes les
  sections deviennent indisponibles, c'est cette version qui est resservie, avec
  `servedFromLastKnownGood: true`. La landing ne dépend pas du CMS en temps réel.

### Arbitrage : pourquoi la page est `force-dynamic`

L'en-tête dépend de la session (§7) et `ProtectedLink` doit rendre la bonne cible
**côté serveur** pour fonctionner sans JavaScript (§4). Le HTML est donc produit à
chaque requête. Ce qui est mis en cache, c'est la **lecture des données** — la
partie coûteuse, et la seule que le CMS fait varier. Une page statique aurait
imposé soit un en-tête faux pour les membres, soit des liens protégés calculés
côté client, c'est-à-dire cassés sans JavaScript.

---

## 8. Carrousel (§52)

`src/app/(public)/_components/LandingCarousel.tsx`.

| Exigence                          | Mise en œuvre                                                                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `aria-roledescription="carousel"` | sur la région, avec `aria-label`                                                                                                                                                     |
| Diapositives                      | `role="group"`, `aria-roledescription="diapositive"`, `aria-label="N sur M"`                                                                                                         |
| Navigation clavier                | boutons natifs + `ArrowLeft` / `ArrowRight` sur la région                                                                                                                            |
| Contrôles visibles                | précédent · suivant · lecture/pause · pastilles avec `aria-current`                                                                                                                  |
| Mise en pause                     | bouton dédié (`aria-pressed`), + suspension au survol et au focus                                                                                                                    |
| `prefers-reduced-motion`          | le défilement ne démarre pas ; un changement en cours de session l'arrête                                                                                                            |
| Textes accessibles                | libellés en `sr-only` sur tous les contrôles                                                                                                                                         |
| `alt`                             | `image_alt` porté par la donnée ; `alt=""` si l'image est décorative                                                                                                                 |
| Annonce du changement             | région `aria-live="polite"` — passée à `off` pendant le défilement automatique, sinon le lecteur d'écran serait interrompu toutes les 7 secondes                                     |
| **Sans JavaScript**               | la première diapositive est visible : l'état initial du rendu serveur est déjà « diapositive 1 affichée ». Les autres portent `hidden`, donc sortent aussi de l'ordre de tabulation. |

---

## 9. SEO (§53)

| Élément                            | Où                                                                                                                                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `metadata`, `title`, `description` | `src/app/page.tsx`                                                                                                                                                                       |
| OpenGraph + Twitter Card           | idem                                                                                                                                                                                     |
| `canonical`                        | `alternates.canonical: '/'` avec `metadataBase` = `NEXT_PUBLIC_SITE_URL`                                                                                                                 |
| Favicon                            | `src/app/icon.svg` (convention Next)                                                                                                                                                     |
| `robots.txt`                       | `src/app/robots.ts` — `Allow: /`, `Disallow` sur tous les préfixes membres et d'authentification, sans barre finale (`Disallow: /tableau-de-bord/` ne couvrirait pas `/tableau-de-bord`) |
| `sitemap.xml`                      | `src/app/sitemap.ts` — **uniquement** `/`. Le plan du site n'est pas un annuaire des URL protégées                                                                                       |
| `h1`                               | un seul, en `sr-only` : le titre du carrousel dépend du CMS et peut ne pas exister                                                                                                       |

**Les routes privées ne sont pas indexables**, et cela repose sur trois mécanismes
indépendants :

1. le layout racine porte `robots: { index: false, follow: false }` ; seule PUB-001
   le surcharge ;
2. `src/middleware.ts` pose `X-Robots-Tag: noindex, nofollow, noarchive` sur toute
   réponse non publique, y compris les redirections et les réponses non HTML, qui
   ne peuvent pas porter de balise `<meta>` ;
3. `robots.txt` les déclare `Disallow`.

---

## 10. Tests

### Unitaires — Vitest

`apps/web/vitest.config.ts`, `pnpm --filter @ise/web test`.
62 tests sur `safeRedirect` (tableau du §3 ci-dessus).

### E2E — Playwright (§55)

`apps/web/e2e/public-redirect.spec.ts`, `apps/web/playwright.config.ts`.

> **Ces tests n'ont jamais été exécutés.** L'environnement de développement dans
> lequel ils ont été écrits bloque `*.supabase.co` : aucune connexion réelle n'y
> est possible, donc aucun des trois scénarios n'a pu être joué une seule fois.
> Considérez-les comme du code non vérifié tant que le workflow n'est pas passé
> au vert.

Scénarios écrits :

1. **clic anonyme** — `/` → clic sur un contenu métier → `/connexion?redirectTo=…`
   → message « Connectez-vous pour accéder à cette ressource. » → connexion →
   ressource ;
2. **clic authentifié** — connexion → `/` → « Mon espace » visible → clic → ressource
   directe, sans détour par ISE-001 ;
3. **redirection invalide** — `/connexion?redirectTo=https://evil.example` et sept
   autres vecteurs → tous aboutissent à `/tableau-de-bord`, sur l'origine attendue.

Plus deux contrôles de garde : la racine n'affiche pas ISE-001, et `X-Robots-Tag`
est présent sur les routes privées, absent sur la landing.

Câblage : `.github/workflows/e2e.yml`, **séparé de `ci.yml`** pour ne pas bloquer la
chaîne principale tant qu'il n'a pas tourné. Déclenché à la main et une fois par
nuit. Sans les secrets `E2E_MEMBER_EMAIL` / `E2E_MEMBER_PASSWORD`, les scénarios qui
exigent une session se déclarent `skipped` plutôt que de passer faussement au vert.

Les liens protégés portent `data-protected-target` : les tests s'appuient dessus
plutôt que sur un libellé métier, puisque le contenu de la landing vient du CMS.

---

## 11. Ce qui n'est pas fait

> **Révisé le 8 août 2026.** Quatre des cinq points ci-dessous étaient périmés : ils décrivaient
> l'état du lot au moment de sa livraison, pas l'état du dépôt. Corrigé par la mesure.

- ~~Les fonctions `get_landing_*()` n'existent pas encore.~~ **Faux depuis `0061` et `0063` :**
  les neuf projections `get_landing_*` et `record_public_landing_event` existent en base et sont
  exécutables par `anon` — ce sont exactement les dix fonctions de la liste blanche D-125.
  Ce qui reste vrai : **toutes les sections rendent leur état vide**, parce qu'**aucun contenu
  n'a été saisi** (0 média, 0 actualité, 0 événement, 0 partenaire, statistiques à zéro).
- ~~`event` et `news` n'ont pas de route membre.~~ **Faux :** `/actualites`, `/actualites/[newsId]`,
  `/evenements`, `/evenements/[eventId]` et `/evenements/[eventId]/apres` sont livrés
  (ISE-092 → ISE-096). `entityRoute()` renvoie donc une cible. Elles restent **authentifiées** :
  la vitrine publique n'y envoie pas un visiteur anonyme (D-153).
- ~~Les événements d'analytics du §50 ne sont pas émis.~~ **Faux :** `LandingTracker`,
  `ImpressionTracker`, `TrackedLink` et `PartnerExternalLink` appellent
  `record_public_landing_event` sur des faits observés. Aucun événement n'est encore **enregistré**
  en base, faute de trafic.
- ~~Le CMS n'appelle pas encore `/api/cms/revalidation-landing`.~~ **Ce n'est plus un manque, c'est
  une décision :** D-132 acte que le back-office appelle directement la Server Action
  `revalidateLanding()` ; le Route Handler reste en place pour les appelants externes.
- **Toujours vrai — les scénarios E2E n'ont jamais été exécutés** (voir §10). Le bac à sable n'a
  pas d'accès à `*.supabase.co`. C'est le seul point de cette liste qui reste ouvert, et c'est le
  plus lourd : PUB-001 n'a jamais été chargée dans un navigateur contre la base réelle.
