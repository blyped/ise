import { expect, test } from '@playwright/test';
import { PROTECTED_TARGET, hasMemberCredentials, protectedLinks, signIn } from './helpers';

/**
 * ADDENDUM §55 — Les trois scenarios exiges.
 *
 * AVERTISSEMENT : **ces tests n'ont jamais ete executes.** L'environnement de
 * developpement ou ils ont ete ecrits bloque `*.supabase.co` : aucune
 * connexion reelle n'y est possible. Ils sont cables dans
 * `.github/workflows/e2e.yml`, qui est le premier endroit ou ils tourneront.
 */

test.describe('PUB-001 — racine publique', () => {
  test('la racine ouvre la landing, pas l’ecran de connexion (§2)', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('link', { name: 'Connexion' })).toBeVisible();
    // ISE-001 n'est pas rendu a la racine : aucun champ de mot de passe.
    await expect(page.getByLabel('Mot de passe')).toHaveCount(0);
  });

  test('la landing est indexable, les routes privees ne le sont pas (§53)', async ({
    page,
    request,
  }) => {
    const landing = await request.get('/');
    expect(landing.headers()['x-robots-tag']).toBeUndefined();

    const privatePage = await request.get('/tableau-de-bord', { maxRedirects: 0 });
    expect(privatePage.headers()['x-robots-tag']).toContain('noindex');

    await page.goto('/');
    const robots = await request.get('/robots.txt');
    expect(await robots.text()).toContain('Disallow: /tableau-de-bord');
  });
});

test.describe('§55.1 — clic anonyme puis connexion', () => {
  test('un clic sur un contenu metier mene a ISE-001 puis a la ressource', async ({ page }) => {
    test.skip(!hasMemberCredentials(), 'E2E_MEMBER_EMAIL / E2E_MEMBER_PASSWORD absents');

    await page.goto('/');

    const link = protectedLinks(page).first();
    test.skip((await protectedLinks(page).count()) === 0, 'Aucun contenu publie sur la landing');

    const target = await link.getAttribute('data-protected-target');
    expect(target).not.toBeNull();

    await link.click();

    // La cible est transportee telle quelle, encodee, dans `redirectTo`.
    await expect(page).toHaveURL(
      new RegExp(
        `/connexion\\?.*redirectTo=${encodeURIComponent(encodeURIComponent(target ?? ''))}`,
      ),
    );
    await expect(page.getByText(/Connectez-vous pour accéder/)).toBeVisible();

    await signIn(page);
    await expect(page).toHaveURL(new RegExp(`${target}$`));
  });
});

test.describe('§55.2 — clic authentifie', () => {
  test('un membre connecte atteint la ressource directement', async ({ page }) => {
    test.skip(!hasMemberCredentials(), 'E2E_MEMBER_EMAIL / E2E_MEMBER_PASSWORD absents');

    await page.goto('/connexion');
    await signIn(page);

    await page.goto('/');
    // ADDENDUM §7 : l'entree « Connexion » a cede la place a « Mon espace ».
    await expect(page.getByRole('link', { name: 'Mon espace' })).toBeVisible();

    const link = protectedLinks(page).first();
    test.skip((await protectedLinks(page).count()) === 0, 'Aucun contenu publie sur la landing');

    const target = await link.getAttribute('data-protected-target');
    await link.click();

    await expect(page).toHaveURL(new RegExp(`${target}$`));
    // Aucun detour par ISE-001.
    await expect(page).not.toHaveURL(/\/connexion/);
  });
});

test.describe('§55.3 — redirection invalide refusee', () => {
  test('redirectTo=https://evil.example n’emmene nulle part hors du domaine', async ({ page }) => {
    test.skip(!hasMemberCredentials(), 'E2E_MEMBER_EMAIL / E2E_MEMBER_PASSWORD absents');

    await page.goto('/connexion?redirectTo=https://evil.example');
    await signIn(page);

    await expect(page).toHaveURL(/\/tableau-de-bord$/);
    expect(new URL(page.url()).hostname).not.toBe('evil.example');
  });

  const vecteurs = [
    'https://evil.example',
    '//evil.example',
    '/%2F%2Fevil.example',
    '/%252F%252Fevil.example',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    '/connexion',
    '',
  ];

  for (const vecteur of vecteurs) {
    test(`refuse redirectTo=${vecteur || '(vide)'}`, async ({ page }) => {
      test.skip(!hasMemberCredentials(), 'E2E_MEMBER_EMAIL / E2E_MEMBER_PASSWORD absents');

      await page.goto(`/connexion?redirectTo=${encodeURIComponent(vecteur)}`);
      await signIn(page);

      const url = new URL(page.url());
      const expectedOrigin = new URL(process.env.E2E_BASE_URL ?? 'http://localhost:3000').origin;
      expect(url.origin).toBe(expectedOrigin);
      expect(url.hostname).not.toContain('evil.example');
      expect(url.pathname).toBe('/tableau-de-bord');
    });
  }

  test('une cible interne legitime est bien suivie', async ({ page }) => {
    test.skip(!hasMemberCredentials(), 'E2E_MEMBER_EMAIL / E2E_MEMBER_PASSWORD absents');

    await page.goto(`/connexion?redirectTo=${encodeURIComponent(PROTECTED_TARGET)}`);
    await signIn(page);
    await expect(page).toHaveURL(new RegExp(`${PROTECTED_TARGET}$`));
  });
});
