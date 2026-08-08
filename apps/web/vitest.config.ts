import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Tests unitaires de l'application Web.
 *
 * Perimetre volontairement etroit : les modules **purs** de `src/lib`, au
 * premier rang desquels `safeRedirect` (ADDENDUM §5). Les composants et les
 * Server Actions relevent des tests E2E (`apps/web/e2e`), pas de Vitest.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
    clearMocks: true,
  },
});
