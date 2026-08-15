-- Correctif interne a 0120_public_photo_consent (meme livraison).
-- Supabase interdit desormais le DELETE direct sur `storage.objects` via le
-- declencheur `storage.protect_delete()`, qui n'autorise l'operation que si
-- le reglage `storage.allow_delete_query` vaut 'true'. Sans cela, la
-- revocation du consentement echouait purement et simplement.
-- Le fichier de reference dans le depot est
-- supabase/migrations/0120_public_photo_consent.sql, qui porte deja ce corps.
create or replace function private.purge_member_public_photo(p_path text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_path is null or btrim(p_path) = '' then
    return;
  end if;

  -- Reglage pose en LOCAL (troisieme argument `true`) : il retombe a la fin
  -- de la transaction et n'ouvre rien au-dela de ce retrait precis.
  --
  -- Ce que ce DELETE fait et ne fait pas : il retire l'objet du SERVICE —
  -- l'URL publique repond 404 immediatement, car le endpoint public resout
  -- l'objet par cette ligne. Il n'efface PAS les octets dans S3 :
  -- PostgreSQL n'y a aucun acces. Le retrait demande par le membre appelle
  -- en plus l'API Storage cote application, qui efface reellement le
  -- fichier ; le retrait declenche par une suppression de compte laisse des
  -- octets orphelins, et un nettoyage Storage periodique reste a brancher.
  perform set_config('storage.allow_delete_query', 'true', true);

  delete from storage.objects
   where bucket_id = 'landing-media'
     and name = p_path;

  perform set_config('storage.allow_delete_query', 'false', true);
end
$$;

revoke all on function private.purge_member_public_photo(text) from public, anon, authenticated;

comment on function private.purge_member_public_photo(text) is
  'Retire du service l''objet portrait d''un membre (suppression de la ligne storage.objects, autorisee en local par storage.allow_delete_query). Les octets S3 ne sont PAS effaces : la base n''y a pas acces. Appelee par le declencheur de retrait.';

do $verify$
declare
  v_n integer;
begin
  select count(*) into v_n from private.security_baseline_violations();
  if v_n <> 0 then
    raise exception '0120b: security_baseline_violations() renvoie % ligne(s)', v_n;
  end if;
  select count(*) into v_n from private.storage_baseline_violations();
  if v_n <> 0 then
    raise exception '0120b: storage_baseline_violations() renvoie % ligne(s)', v_n;
  end if;
end
$verify$;
