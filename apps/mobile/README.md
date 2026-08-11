# @ise/mobile

Application mobile Compétences ISE (Expo / React Native / TypeScript). Première tranche
« Phase Mobile » : scaffolding, authentification Supabase, coquille de navigation à 5
destinations (D-94). Voir `docs/decisions.md` C-02 et D-90 → D-96 pour le contexte design, et
`docs/screen-traceability-matrix.md` (colonne « Route Mobile », encore à définir pour la plupart
des écrans) pour ce qui reste à câbler.

## Ce qui est livré dans cette tranche

- Scaffold Expo + TypeScript strict, rattaché au workspace pnpm (`@ise/domain`,
  `@ise/validation`, `@ise/design-tokens`, `@ise/db-types` importés tels quels — aucun n'a été
  modifié pour l'occasion, conformément à C-02).
- Authentification Supabase (`src/lib/supabase/client.ts`) : email/mot de passe (ISE-001),
  session persistée de façon chiffrée (`src/lib/supabase/secure-store-adapter.ts` — clé AES dans
  le Keychain/Keystore via `expo-secure-store`, valeur chiffrée dans `AsyncStorage`, jamais de
  jeton en clair sur le disque).
- Garde d'authentification (`src/lib/auth/AuthProvider.tsx` + `src/navigation/RootNavigator.tsx`)
  : équivalent mobile de `apps/web/src/middleware.ts` (D-155) — aucun écran membre n'est monté
  tant qu'aucune session valide n'est lue.
- Navigation à 5 destinations (D-94) : Accueil, Réseau, action centrale (+), Opportunités, Moi
  (`src/navigation/AppTabs.tsx`), avec écrans d'attente conformes à D-93 (chargement, vide,
  erreur avec référence de corrélation).
- Accueil (`src/screens/home/HomeScreen.tsx`) : lit le profil du membre connecté
  (`ise_profiles` + RPC `my_profile_completion`), portage direct de
  `apps/web/src/lib/queries/profile.ts::loadMemberContext` — mêmes colonnes explicites, même
  respect de la confidentialité du score de complétion (D-72).

## Ce qui n'y est pas (volontairement)

- ISE-002 (créer un compte), ISE-003/004 (mot de passe oublié/réinitialiser), Google OAuth : le
  web les couvre déjà ; le mobile les reprendra dans une tranche suivante.
- Contenu réel des onglets Réseau, Opportunités et de l'action centrale : coquilles navigables
  avec état vide pour l'instant.
- Police Geist (D-91) : les jetons typographiques sont réutilisés tels quels, mais aucun
  chargement de police (`expo-font`) n'est encore branché — la police système fait office de
  repli le temps de choisir la méthode de distribution (fichiers statiques vs
  `@expo-google-fonts`).
- Icônes de la barre d'onglets : libellés texte uniquement pour l'instant, pas de dépendance
  d'icônes ajoutée dans cette tranche.
- Liens profonds (`app.json` ne déclare pas encore de schéma de deep link exploité) : le paramètre
  `redirectTo` du web (D-155) n'a pas d'équivalent mobile tant qu'aucun écran n'a besoin d'un lien
  entrant (ex. notification push).

## Démarrage

```bash
# Depuis la racine du monorepo (Node 22+, pnpm 9)
pnpm install

cp apps/mobile/.env.example apps/mobile/.env.local   # puis renseigner les variables
# Mêmes valeurs de projet Supabase que apps/web/.env.local (URL + clé publiable/anon).

pnpm --filter @ise/mobile start
```

Les fichiers source ont été typecheckés (`tsc --noEmit`, zéro erreur) contre les vraies
définitions de types des dépendances déclarées (installation `npm` de vérification, hors du
workspace pnpm réel). Le CLI Expo lui-même (`expo-doctor`, `expo start`, build Metro) n'a en
revanche pas pu être exécuté dans l'environnement qui a produit cette tranche — pas de simulateur
ni d'exécution interactive disponibles. Avant la première exécution réelle, lancer :

```bash
pnpm --filter @ise/mobile exec expo install --fix
```

qui réaligne les versions sur le SDK Expo réellement disponible au moment de l'installation.

## Variables d'environnement

Voir `.env.example`. Le préfixe `EXPO_PUBLIC_` est l'équivalent mobile de `NEXT_PUBLIC_` côté web
(remplacement statique par Metro à la compilation) — mêmes règles D-100/§76 : aucune clé
`service_role` n'y figure jamais.
