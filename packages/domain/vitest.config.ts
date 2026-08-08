import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Les tests du domaine sont purs : aucune horloge, aucun reseau, aucun aleatoire.
    restoreMocks: true,
    clearMocks: true,
  },
});
