-- 0140 (suite) — Ces deux fonctions sont des outils de normalisation internes.
-- Postgres accorde EXECUTE a PUBLIC par defaut : la ligne de base de securite
-- le refuse pour toute fonction de `private` hors liste blanche des
-- projections publiques. On retire donc le droit a tout le monde.
revoke execute on function private.organization_dedupe_key(text) from public, anon, authenticated;
revoke execute on function private.organization_is_employer(text) from public, anon, authenticated;
