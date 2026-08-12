import { expect, type Page } from '@playwright/test';

/**
 * Utilitaires partages par les scenarios Superadmin (`/administration/**`).
 *
 * AVERTISSEMENT (meme reserve que `helpers.ts`) : ces tests n'ont JAMAIS
 * ete executes. Voir `playwright.config.ts` pour le contexte complet —
 * l'environnement de developpement ou ils ont ete ecrits bloque
 * `*.supabase.co`.
 *
 * ─────────────────────────────────────────────────────────────────────
 * COMPTE DE TEST SUPERADMIN — CE FICHIER NE LE PROVISIONNE PAS.
 * ─────────────────────────────────────────────────────────────────────
 * `docs/decisions.md` (D-104) impose que tout compte de test Auth soit
 * prefixe `test+` et marque `is_test_account`. `docs/decisions.md` (C-01)
 * precise qu'il n'existe qu'UN SEUL projet Supabase, utilise directement
 * comme Production : aucun environnement isole n'existe pour y creer un
 * compte a la volee sans risque.
 *
 * Provisionner un compte superadmin de test (creation du compte Auth
 * `test+admin@...`, marquage `is_test_account`, puis attribution d'un
 * role via `admin_grant_role`) reste donc une operation MANUELLE, a
 * executer une fois par la personne qui possede le projet Supabase — pas
 * par un agent qui ne peut pas verifier en toute confiance l'etat actuel
 * de la base de production (voir le rapport de la tache correspondante :
 * « E2E coverage for Superadmin back-office screens »).
 *
 * Tant que `E2E_SUPERADMIN_EMAIL` / `E2E_SUPERADMIN_PASSWORD` ne sont pas
 * fournis, tous les scenarios qui en dependent se declarent `skipped`
 * plutot que de passer faussement au vert — meme convention que
 * `E2E_MEMBER_EMAIL` / `E2E_MEMBER_PASSWORD` dans `helpers.ts`.
 */
export const SUPERADMIN_EMAIL = process.env.E2E_SUPERADMIN_EMAIL ?? '';
export const SUPERADMIN_PASSWORD = process.env.E2E_SUPERADMIN_PASSWORD ?? '';

export function hasSuperadminCredentials(): boolean {
  return SUPERADMIN_EMAIL.length > 0 && SUPERADMIN_PASSWORD.length > 0;
}

/**
 * Identifiants d'un membre standard, SANS AUCUNE permission
 * d'administration. Reutilise volontairement les memes variables que
 * `helpers.ts` (§55) : ce compte de test existe deja pour les scenarios
 * de redirection publique, et sert ici de deuxieme temoin pour SYS-006
 * (acces refuse) — aucun nouveau compte n'est necessaire pour ce cas.
 *
 * Hypothese posee explicitement : ce compte est un membre ORDINAIRE,
 * sans role d'administration attribue. Si ce n'est plus le cas (le
 * compte a recu un role entre-temps), le scenario correspondant dans
 * `admin-permissions.spec.ts` echouera et devra etre repointe vers un
 * autre compte de test non-admin.
 */
export const MEMBER_EMAIL = process.env.E2E_MEMBER_EMAIL ?? '';
export const MEMBER_PASSWORD = process.env.E2E_MEMBER_PASSWORD ?? '';

export function hasMemberCredentials(): boolean {
  return MEMBER_EMAIL.length > 0 && MEMBER_PASSWORD.length > 0;
}

/**
 * Verrou explicite pour les scenarios qui ECRIVENT en base (creation
 * d'une communaute, changement de statut...). Meme avec des identifiants
 * superadmin valides, ces scenarios restent `skipped` tant que cette
 * variable n'est pas exactement `'true'` : la base cible est la
 * PRODUCTION (C-01, docs/decisions.md), et aucune convention
 * `is_test_account` n'existe pour les communautes / evenements / etc.
 * (D-104 ne couvre que `profiles`). Ecrire ici cree une ressource reelle,
 * potentiellement visible de tout le reseau tant qu'elle n'est pas
 * archivee.
 */
export const ALLOW_ADMIN_WRITES = process.env.E2E_ADMIN_ALLOW_WRITES === 'true';

/**
 * Remplit et soumet ISE-001 avec les identifiants fournis.
 *
 * `getByLabel('Mot de passe')` sans ancrage matcherait AUSSI le bouton
 * « Afficher le mot de passe » (IconButton, aria-label) : violation du
 * mode strict de Playwright constatee a la premiere execution reelle
 * (run #6). L'ancre `^` ne retient que le champ, dont le nom accessible
 * est « Mot de passe (obligatoire) ».
 */
export async function signInAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/connexion');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel(/^Mot de passe/).fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).not.toHaveURL(/\/connexion/);
}

/**
 * Chemins STATIQUES (non parametres, donc atteignables sans donnee
 * prealable) de `/administration/**`, dupliques depuis
 * `src/lib/routes/admin.ts` (ADMIN_ROUTES).
 *
 * Duplication volontaire : comme `helpers.ts`, `e2e/` ne resout aucun
 * alias `@/` et ne depend pas de la compilation de l'appli — les tests
 * restent lisibles et executables meme si le build applicatif echoue.
 * Tenir cette liste synchronisee avec `ADMIN_ROUTES` a chaque nouvelle
 * section `/administration` livree (dernier ajout verifie : SA-049/050
 * « Journal d'audit »).
 *
 * Les routes DYNAMIQUES (`/administration/membres/{id}`,
 * `/administration/communautes/{id}`...) sont volontairement absentes :
 * elles exigent un identifiant reel, et deviner un UUID de production
 * n'est ni fiable ni souhaitable. `admin-communities.spec.ts` couvre une
 * fiche dynamique en la creant elle-meme.
 */
export const ADMIN_STATIC_ROUTES: readonly { path: string; label: string }[] = [
  { path: '/administration', label: 'Tableau de bord (SA-001)' },
  { path: '/administration/membres', label: 'Membres & profils (SA-002)' },
  { path: '/administration/membres/doublons', label: 'Doublons potentiels (SA-005)' },
  { path: '/administration/membres/nouveau', label: 'Nouveau profil référencé (SA-007)' },
  { path: '/administration/reclamations', label: 'Réclamations (SA-006)' },
  { path: '/administration/promotions', label: 'Promotions (SA-008)' },
  { path: '/administration/promotions/nouvelle', label: 'Nouvelle promotion (SA-008)' },
  { path: '/administration/promotions/suggestions', label: 'Promotions signalées absentes (SA-010)' },
  { path: '/administration/appels', label: 'Appels au réseau (SA-016)' },
  { path: '/administration/opportunites', label: 'Opportunités (SA-019)' },
  { path: '/administration/projets', label: 'Projets & consortiums (SA-023)' },
  { path: '/administration/projets/nouveau', label: 'Nouveau projet (SA-023)' },
  { path: '/administration/communautes', label: 'Communautés (SA-027)' },
  { path: '/administration/communautes/nouvelle', label: 'Nouvelle communauté (SA-027)' },
  { path: '/administration/evenements', label: 'Événements (SA-030)' },
  { path: '/administration/evenements/nouveau', label: 'Nouvel événement (SA-030)' },
  { path: '/administration/moderation', label: 'Modération (SA-018)' },
  { path: '/administration/support', label: 'Support (SA-038)' },
  { path: '/administration/profils-incomplets', label: 'Profils incomplets (SA-043)' },
  { path: '/administration/analytics', label: 'Analytics' },
  { path: '/administration/parametres', label: 'Paramètres plateforme' },
  { path: '/administration/audit', label: "Journal d'audit (SA-049/050)" },
];
