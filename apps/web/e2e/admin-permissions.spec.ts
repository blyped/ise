import { expect, test } from '@playwright/test';
import { MEMBER_EMAIL, MEMBER_PASSWORD, hasMemberCredentials, signInAs } from './admin-helpers';

/**
 * SYS-006 — Etat « unauthorized » du back-office Superadmin (D-93,
 * docs/decisions.md : « SYS-006 pour `unauthorized` », convention
 * transverse appliquee a tous les ecrans pilotes par des donnees).
 *
 * AVERTISSEMENT : jamais execute (voir `playwright.config.ts`).
 *
 * Deux scenarios, AUCUN ne necessite de compte superadmin :
 *
 *  1. Visiteur ANONYME sur `/administration` : `src/middleware.ts`
 *     l'intercepte AVANT meme le layout admin (aucune session = route
 *     non publique => redirection `/connexion?raison=session&redirectTo=...`),
 *     exactement comme n'importe quelle route membre protegee.
 *
 *  2. Membre AUTHENTIFIE mais SANS AUCUNE permission d'administration :
 *     le middleware laisse passer (une session existe), mais
 *     `requireAdminAccess()` (`src/lib/admin/permissions.ts`, appelee par
 *     `administration/layout.tsx`) constate `permissions.size === 0` et
 *     redirige vers `/acces-refuse`. Masquer le menu ne suffirait pas :
 *     la garde est serveur, avant tout rendu de page.
 *
 * Le second scenario reutilise EXACTEMENT le compte `E2E_MEMBER_EMAIL` /
 * `E2E_MEMBER_PASSWORD` deja etabli par `helpers.ts` pour les scenarios
 * §55 : un membre de test ordinaire, sans role d'administration. Aucun
 * nouveau compte n'est provisionne pour ce fichier (voir admin-helpers.ts
 * pour le detail de cette hypothese).
 */
test.describe('SYS-006 — acces refuse au back-office (D-93)', () => {
  test('un visiteur anonyme est renvoye vers la connexion, pas vers le back-office', async ({ page }) => {
    await page.goto('/administration');
    await expect(page).toHaveURL(/\/connexion\?.*redirectTo=%2Fadministration/);
  });

  test('un visiteur anonyme sur une sous-route est aussi renvoye vers la connexion', async ({ page }) => {
    await page.goto('/administration/membres');
    await expect(page).toHaveURL(/\/connexion/);
    // La cible est preservee pour y revenir apres connexion (ADDENDUM §4).
    await expect(page).toHaveURL(/redirectTo=%2Fadministration%2Fmembres/);
  });

  test('un membre sans permission d’administration est renvoye vers /acces-refuse', async ({ page }) => {
    test.skip(!hasMemberCredentials(), 'E2E_MEMBER_EMAIL / E2E_MEMBER_PASSWORD absents');
    await signInAs(page, MEMBER_EMAIL, MEMBER_PASSWORD);

    await page.goto('/administration');
    await expect(page).toHaveURL(/\/acces-refuse$/);
  });

  test('un membre sans permission ne peut pas non plus atteindre une sous-route admin', async ({ page }) => {
    test.skip(!hasMemberCredentials(), 'E2E_MEMBER_EMAIL / E2E_MEMBER_PASSWORD absents');
    await signInAs(page, MEMBER_EMAIL, MEMBER_PASSWORD);

    await page.goto('/administration/communautes');
    await expect(page).toHaveURL(/\/acces-refuse$/);
  });
});
