import { expect, test } from '@playwright/test';
import {
  ADMIN_STATIC_ROUTES,
  SUPERADMIN_EMAIL,
  SUPERADMIN_PASSWORD,
  hasSuperadminCredentials,
  signInAs,
} from './admin-helpers';

/**
 * Couverture de LARGEUR du back-office Superadmin (/administration/**).
 *
 * AVERTISSEMENT : ces tests n'ont jamais ete executes (voir
 * `playwright.config.ts` et `admin-helpers.ts`).
 *
 * OBJECTIF : partant d'une couverture nulle, verifier que CHAQUE route
 * statique livree (ADMIN_STATIC_ROUTES, dupliquee depuis
 * `src/lib/routes/admin.ts`) s'affiche sans erreur serveur. Ce n'est PAS
 * un test d'interaction approfondi par ecran — un filet de securite de
 * non-regression sur le ROUTAGE, pas une verification de chaque champ.
 *
 * Une route sans la permission necessaire redirige vers `/acces-refuse`
 * (SYS-006, D-93, `requireAdminPermission` dans
 * `src/lib/admin/permissions.ts`) : ce n'est PAS un echec ici, c'est le
 * comportement attendu. Le test ne suppose donc AUCUN ensemble precis de
 * permissions accordees au compte `E2E_SUPERADMIN_EMAIL` — il documente
 * ce qui a ete constate, quel que soit le perimetre exact de ce compte.
 * Seul un crash reel (reponse HTTP manquante, statut >= 500, ou une
 * destination inattendue comme un retour a `/connexion` signalant une
 * session perdue en cours de route) fait echouer un test.
 */
test.describe('SA-0XX — routage /administration (largeur)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !hasSuperadminCredentials(),
      'E2E_SUPERADMIN_EMAIL / E2E_SUPERADMIN_PASSWORD absents — voir admin-helpers.ts',
    );
    await signInAs(page, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
  });

  for (const route of ADMIN_STATIC_ROUTES) {
    test(`${route.path} s'affiche sans erreur serveur — ${route.label}`, async ({ page }) => {
      const response = await page.goto(route.path);
      expect(response, `pas de reponse HTTP pour ${route.path}`).not.toBeNull();
      expect(response!.status(), `statut HTTP inattendu pour ${route.path}`).toBeLessThan(500);

      // Deux destinations legitimes : la page admin demandee (permission
      // accordee) ou le refus SYS-006 (permission manquante, /acces-refuse).
      // Toute autre destination — /connexion notamment — signalerait une
      // session perdue en cours de route.
      const url = new URL(page.url());
      const onRequestedRoute = url.pathname === route.path;
      const onAccessDenied = url.pathname === '/acces-refuse';
      expect(
        onRequestedRoute || onAccessDenied,
        `destination inattendue pour ${route.path} : ${url.pathname}`,
      ).toBe(true);

      if (onRequestedRoute) {
        // Rendu complet du gabarit (AdminShell) : preuve que la page n'est
        // pas restee sur une coquille vide ou un etat de chargement fige.
        await expect(page.getByRole('navigation', { name: "Navigation de l'administration" })).toBeVisible();
      }
    });
  }
});

test.describe('SA-001 — tableau de bord : indicateurs reels uniquement', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !hasSuperadminCredentials(),
      'E2E_SUPERADMIN_EMAIL / E2E_SUPERADMIN_PASSWORD absents — voir admin-helpers.ts',
    );
    await signInAs(page, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
  });

  test('le tableau de bord affiche des compteurs numeriques reels', async ({ page }) => {
    await page.goto('/administration');
    await expect(page.getByRole('heading', { name: 'Tableau de bord Superadmin', level: 1 })).toBeVisible();

    // MASTER PROMPT §98 (voir administration/page.tsx) : chaque bloc vient
    // de `admin_dashboard_counters()` (0076), qui compte des lignes reelles
    // — jamais un KPI invente. On ne verifie pas de valeur precise (donnee
    // reelle, changeante en production) : seulement qu'au moins un bloc de
    // compteurs rend un chiffre, preuve que la requete a repondu.
    //
    // Hypothese : le compte E2E_SUPERADMIN_EMAIL detient au moins une des
    // permissions qui alimentent le tableau de bord (profiles.read,
    // profiles.verify, profiles.moderate, support.manage,
    // promotions.manage) — raisonnable pour un compte nomme « superadmin »,
    // mais a ajuster si ce compte de test est deliberement restreint.
    const counters = page.locator('dd.tabular-nums');
    await expect(counters.first()).toBeVisible();
    const firstValue = await counters.first().textContent();
    expect(firstValue?.trim()).toMatch(/^\d+$/);
  });
});
