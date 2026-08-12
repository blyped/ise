import { expect, type Page } from '@playwright/test';

/**
 * Utilitaires partages par les scenarios §55.
 *
 * Ces tests n'ont jamais ete executes (voir `playwright.config.ts`).
 */

export const MEMBER_EMAIL = process.env.E2E_MEMBER_EMAIL ?? '';
export const MEMBER_PASSWORD = process.env.E2E_MEMBER_PASSWORD ?? '';

/** Route membre servant de ressource cible. */
export const PROTECTED_TARGET = process.env.E2E_PROTECTED_TARGET ?? '/tableau-de-bord';

export function hasMemberCredentials(): boolean {
  return MEMBER_EMAIL.length > 0 && MEMBER_PASSWORD.length > 0;
}

/**
 * Premier lien protege de la landing, quel qu'il soit.
 *
 * `ProtectedLink` marque chaque lien avec `data-protected-target`, ce qui
 * evite de dependre d'un libelle metier — la landing est alimentee par le CMS,
 * ses titres changent.
 */
export function protectedLinks(page: Page) {
  return page.locator('[data-protected-target]');
}

/**
 * Remplit et soumet ISE-001.
 *
 * `/^Mot de passe/` et non `'Mot de passe'` : le libelle nu matcherait
 * aussi le bouton « Afficher le mot de passe » (violation du mode strict,
 * voir admin-helpers.ts).
 */
export async function signIn(page: Page): Promise<void> {
  await page.getByLabel('Adresse e-mail').fill(MEMBER_EMAIL);
  await page.getByLabel(/^Mot de passe/).fill(MEMBER_PASSWORD);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).not.toHaveURL(/\/connexion/);
}
