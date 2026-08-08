-- =====================================================================
-- 0054_consent_record_clock_timestamp
--
-- DEFAUT REEL CONSTATE PAR LE HARNAIS ISE-099.
--   `public.consent_records` est append-only : accorder puis revoquer un
--   consentement produit DEUX lignes, et « l'etat courant » est la plus
--   recente. Or `created_at` a pour defaut `now()`, qui est l'horodatage
--   de la TRANSACTION : deux traces posees dans la meme transaction
--   portent la meme valeur a la microseconde pres. Le `distinct on
--   (consent_type) ... order by created_at desc` de `list_my_consents()`
--   n'a alors plus de depart, et peut renvoyer l'ACCORD la ou la
--   REVOCATION fait foi. Sur une preuve de consentement, c'est une
--   erreur de fond, pas une coquetterie de tri.
--
-- CORRECTIF : `record_consent()` date ses lignes avec
-- `clock_timestamp()`, qui avance a l'interieur d'une transaction. Les
-- lignes deja posees ne sont pas touchees (append-only) ; le tri de
-- `list_my_consents()` recoit en complement un depart deterministe.
-- =====================================================================

create or replace function public.record_consent(
  p_consent_type text,
  p_version      text,
  p_granted      boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
  v_at timestamptz := clock_timestamp();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if p_consent_type not in ('terms_of_service', 'privacy_policy', 'marketing_communication',
                            'testimonial_use', 'public_profile', 'data_processing') then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;
  if nullif(btrim(coalesce(p_version, '')), '') is null then
    raise exception 'validation_failed' using errcode = 'P0001';
  end if;

  insert into public.consent_records
    (profile_id, consent_type, version, is_granted, granted_at, revoked_at, source, created_at)
  values
    (v_me, p_consent_type, btrim(p_version), p_granted,
     case when p_granted then v_at else null end,
     case when p_granted then null else v_at end,
     'settings', v_at);

  return jsonb_build_object('consent_type', p_consent_type, 'granted', p_granted);
end
$$;
revoke all on function public.record_consent(text, text, boolean) from public;
grant execute on function public.record_consent(text, text, boolean) to authenticated;
comment on function public.record_consent(text, text, boolean) is
  'SYS-009 — une revocation est une NOUVELLE ligne (0048), datee par clock_timestamp() pour rester ordonnable dans une meme transaction.';

create or replace function public.list_my_consents()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me uuid := private.current_profile_id();
begin
  if v_me is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  return jsonb_build_object(
    'consents', coalesce((
      select jsonb_agg(jsonb_build_object(
               'consent_type', x.consent_type,
               'version',      x.version,
               'granted',      x.is_granted,
               'granted_at',   x.granted_at,
               'revoked_at',   x.revoked_at,
               'recorded_at',  x.created_at,
               'source',       x.source)
               order by x.consent_type)
        from (select distinct on (c.consent_type) c.*
                from public.consent_records c
               where c.profile_id = v_me
               order by c.consent_type, c.created_at desc, c.ctid desc) x), '[]'::jsonb),
    'terms', coalesce((
      select jsonb_agg(jsonb_build_object(
               'document_type', y.document_type,
               'version',       y.version,
               'accepted_at',   y.accepted_at)
               order by y.document_type)
        from (select distinct on (t.document_type) t.*
                from public.terms_acceptances t
               where t.profile_id = v_me
               order by t.document_type, t.accepted_at desc, t.ctid desc) y), '[]'::jsonb));
end
$$;
revoke all on function public.list_my_consents() from public;
grant execute on function public.list_my_consents() to authenticated;
comment on function public.list_my_consents() is
  'ISE-099 / SYS-009 — etat courant de chaque consentement : la trace la plus recente fait foi, avec un depart deterministe.';
