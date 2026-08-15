-- Corrective follow-up to 0142_organizations_seed_from_profiles.
--
-- The first attempt deduplicated on the FULL current_organization_raw value.
-- That was wrong: a large share of the free-text answers follow an
-- "Organisation — Direction — Service" convention (e.g. "BCEAO — Direction
-- des Opérations de Marché"), and deduping on the full string created 150
-- bogus "organizations" that are really an existing organization plus its
-- internal department, not a distinct employer. This statement removes
-- exactly those 150 rows (identified by their shared insertion timestamp,
-- none of which is referenced by any ise_profiles.current_organization_id —
-- verified below before deleting) so the corrected migration can reinsert
-- cleanly.
delete from public.organizations o
where o.created_at = '2026-08-15 10:11:34.051202+00'::timestamptz
  and o.merged_into_id is null
  and not exists (
    select 1 from public.ise_profiles p where p.current_organization_id = o.id
  )
  and not exists (
    select 1 from public.cms_landing_organizations lo where lo.organization_id = o.id
  );
