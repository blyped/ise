import { expect, test } from '@playwright/test';
import {
  ALLOW_ADMIN_WRITES,
  SUPERADMIN_EMAIL,
  SUPERADMIN_PASSWORD,
  hasSuperadminCredentials,
  signInAs,
} from './admin-helpers';

/**
 * SA-027 -> SA-029 — Cycle de vie d'une communaute : liste -> creation ->
 * fiche -> changement de statut. Seul flux CRUD couvert en profondeur
 * pour ce lot de tests (voir le rapport de la tache correspondante :
 * priorite donnee a la LARGEUR plutot qu'a la profondeur —
 * `admin-smoke.spec.ts` couvre le reste des routes /administration/**).
 * Communautes choisies car SA-027/028 tiennent sur un seul ecran par
 * ressource (formulaire de creation court, cycle de vie simple sur la
 * fiche) — le domaine le plus stable a lire dans le code source.
 *
 * ─────────────────────────────────────────────────────────────────
 * AVERTISSEMENT — CE FICHIER ECRIT EN PRODUCTION (C-01)
 * ─────────────────────────────────────────────────────────────────
 * Ce scenario CREE une communaute reelle, visible de tout le reseau des
 * qu'elle est en statut « Active » (statut par defaut du formulaire,
 * `CommunityForm.tsx`). Il n'existe PAS de convention `is_test_account`
 * pour les communautes (D-104, docs/decisions.md, ne couvre que
 * `profiles`) : rien ne permet de marquer cette ligne comme donnee de
 * test au niveau base.
 *
 * Consequences, toutes deliberees :
 *  - DESACTIVE PAR DEFAUT. Ne s'execute que si `E2E_ADMIN_ALLOW_WRITES`
 *    vaut EXACTEMENT `'true'`, EN PLUS d'identifiants superadmin valides.
 *    Sans ca : `skipped`, jamais un faux vert.
 *  - Le nom et le slug sont prefixes `[E2E]` / `e2e-` et horodates
 *    (`Date.now()`) : identifiables sans ambiguite, faciles a retrouver
 *    et purger manuellement si necessaire.
 *  - Le scenario ARCHIVE lui-meme la communaute qu'il vient de creer
 *    (transition `active -> archived`, valide d'apres `STATUS_TARGETS`
 *    dans `communautes/[communityId]/page.tsx`). Ce n'est PAS une
 *    suppression : `admin_create_community` / `admin_set_community_status`
 *    (migration 0099) n'exposent aucune suppression definitive, par
 *    design (tracabilite). Une communaute `[E2E]` archivee reste donc en
 *    base apres chaque execution reelle — c'est le maximum de nettoyage
 *    que ce scenario peut faire depuis l'interface admin.
 *
 * Les libelles ci-dessous viennent de `src/i18n/admin-communities.ts`,
 * qui n'utilise PAS d'accents (a la difference de `src/i18n/admin.ts`) —
 * verifie sur le contenu reel du fichier, pas suppose. Ne pas « corriger »
 * ces chaines vers une orthographe accentuee sans revalider la source.
 */
test.describe('SA-027 -> SA-029 — communautes : liste -> creation -> fiche -> statut', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !hasSuperadminCredentials(),
      'E2E_SUPERADMIN_EMAIL / E2E_SUPERADMIN_PASSWORD absents — voir admin-helpers.ts',
    );
    test.skip(
      !ALLOW_ADMIN_WRITES,
      "E2E_ADMIN_ALLOW_WRITES != 'true' — ecriture en production desactivee par defaut, voir l'avertissement en tete de fichier",
    );
    await signInAs(page, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD);
  });

  test('creer une communaute, la retrouver dans la liste, changer son statut', async ({ page }) => {
    const stamp = Date.now();
    const name = `[E2E] Communaute test ${stamp}`;
    const slug = `e2e-test-${stamp}`;

    // --- Creation (SA-027) ---------------------------------------------
    await page.goto('/administration/communautes/nouvelle');
    await expect(page.getByRole('heading', { name: 'Creer une communaute', level: 1 })).toBeVisible();

    await page.getByLabel('Nom').fill(name);
    await page.getByLabel('Slug').fill(slug);
    await page
      .getByLabel('Description')
      .fill('Communaute creee par le scenario E2E administration (admin-communities.spec.ts). A purger.');
    await page.getByRole('button', { name: 'Creer la communaute' }).click();

    // `createCommunityAction` redirige vers la fiche en cas de succes
    // (communautes/actions.ts) : l'URL contient l'UUID genere en base.
    await expect(page).toHaveURL(/\/administration\/communautes\/[0-9a-f-]{36}$/);
    const communityUrl = page.url();
    await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();

    // --- Liste (SA-027) : la communaute nouvellement creee y figure ----
    await page.goto('/administration/communautes');
    await page.getByLabel('Rechercher').fill(name);
    await page.getByRole('button', { name: 'Filtrer' }).click();
    await expect(page.getByText(name)).toBeVisible();

    // --- Fiche + cycle de vie (SA-028) : active -> archivee -------------
    await page.goto(communityUrl);
    await page.getByRole('button', { name: 'Passer a ce statut : Archivee' }).click();
    await expect(page.getByText('Communaute mise a jour.')).toBeVisible();
    await expect(page.getByText('Archivee')).toBeVisible();
  });
});
