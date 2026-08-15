-- 0137b — correctif de 0137.
--
-- `create function` accorde EXECUTE a PUBLIC par defaut, donc a `anon` et
-- `authenticated`. `private.security_baseline_violations()` l'a signale :
-- seules les projections `public-safe` de la liste blanche ont le droit
-- d'etre appelables par un visiteur anonyme. Ces deux predicats sont des
-- rouages internes, appeles uniquement depuis des fonctions SECURITY
-- DEFINER qui s'executent avec les droits du proprietaire : personne
-- d'autre n'a besoin de les invoquer.

begin;

revoke all on function private.landing_event_block_reason(
  text, timestamptz, text, text, timestamptz, timestamptz, boolean) from public, anon, authenticated;

revoke all on function private.landing_opportunity_block_reason(
  text, text, text, text, timestamptz, timestamptz, boolean) from public, anon, authenticated;

commit;
