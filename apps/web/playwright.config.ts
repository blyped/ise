import { defineConfig, devices } from '@playwright/test';

/**
 * ADDENDUM §55 — Scenarios de redirection.
 *
 * AVERTISSEMENT : ces tests **n'ont jamais ete executes**. L'environnement de
 * developpement utilise pour les ecrire bloque `*.supabase.co`, donc toute
 * connexion reelle. Ils sont cables dans `.github/workflows/e2e.yml`, qui est
 * le premier endroit ou ils tourneront. Considerez-les comme du code non
 * verifie tant que ce workflow n'est pas passe au vert.
 *
 * Prerequis d'execution (variables d'environnement) :
 *  - `E2E_BASE_URL` (defaut `http://localhost:3000`) ;
 *  - `E2E_MEMBER_EMAIL` et `E2E_MEMBER_PASSWORD` : un compte de test reel,
 *    prefixe `test+` et marque `is_test_account` (D-104) ;
 *  - `E2E_PROTECTED_TARGET` : une route membre existante servant de cible de
 *    redirection (defaut `/tableau-de-bord`).
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'fr-FR',
  },
  projects: [
    {
      name: 'desktop-1440',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    { name: 'mobile-375', use: { ...devices['iPhone SE'] } },
  ],
  webServer: process.env.E2E_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'pnpm start',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
