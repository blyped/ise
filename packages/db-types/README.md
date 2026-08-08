# @ise/db-types

Types TypeScript du schéma `public` de Supabase.

## Génération

Le fichier `src/database.types.ts` est **généré**, jamais écrit à la main :

```bash
pnpm --filter @ise/db-types generate
# équivalent :
supabase gen types typescript --project-id "$SUPABASE_PROJECT_ID" --schema public \
  > packages/db-types/src/database.types.ts
```

La CI regénère les types et échoue si le fichier commité diverge du schéma réel : c'est le
garde-fou qui empêche le code de dériver de la base (MASTER PROMPT §77).

## Types métier

`src/tables.ts` expose des alias lisibles (`IseProfile`, `Connection`, …) dérivés du type
généré. Utilisez-les plutôt que `Database['public']['Tables'][…]` dans le code applicatif.
