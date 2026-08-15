-- =============================================================================
-- 0136 — Carte du reseau : seuil d'agregation abaisse de 3 a 1
-- =============================================================================
--
-- Decision du porteur (15/08/2026) : « pour la carte, comment a nommer les pays
-- a partir de 1 ISE ». Tous les pays de presence sont donc nommes, y compris
-- ceux qui ne comptent qu'un seul ISE.
--
-- 0133 posait un seuil k = 3 : un pays a un seul ISE, sur une page publique,
-- peut permettre de deviner de qui il s'agit pour qui connait le reseau. Le
-- porteur a tranche en connaissance de cause. Deux protections restent en
-- place, et ce sont elles qui rendent le choix tenable :
--
--   1. Le consentement individuel prime toujours. Un membre dont la visibilite
--      du champ `country` est `private` reste exclu du comptage, quel que soit
--      le seuil. La clause d'exclusion est conservee mot pour mot.
--   2. Seul un AGREGAT sort : un code pays, un libelle, un nombre. Aucun nom,
--      aucun identifiant, aucune ville. La carte dit « il y a un ISE au Canada »,
--      jamais « c'est cette personne-la ».
--
-- Le seuil reste une VALEUR EXPLICITE projetee dans la reponse (`threshold`)
-- plutot qu'une constante enfouie : la couche applicative la relit et l'affiche,
-- et un futur changement se fait ici seul.
--
-- Rien d'autre ne change : meme signature, meme forme de reponse, memes cles.
-- =============================================================================

create or replace function public.get_landing_country_presence()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $fn$
  with live as (
    select p.id, btrim(p.current_country_code) as code
    from public.ise_profiles p
    where p.deleted_at is null
      and not p.is_test_account
      and p.profile_status in ('referenced', 'active')
      -- Le consentement prime sur le seuil : inchange depuis 0133.
      and not exists (
        select 1 from public.profile_visibility v
        where v.profile_id = p.id
          and v.field_key = 'country'
          and v.visibility = 'private')
  ),
  located as (
    select code from live where code is not null and code <> ''
  ),
  per_country as (
    select code, count(*)::integer as n from located group by code
  ),
  -- 0136 : seuil abaisse de 3 a 1. `hidden` devient structurellement vide,
  -- mais les deux compteurs restent projetes pour ne pas casser les lecteurs
  -- existants et pour qu'un futur relevement du seuil n'exige aucun changement
  -- cote application.
  shown as (select * from per_country where n >= 1),
  hidden as (select * from per_country where n < 1)
  select jsonb_build_object(
    'threshold',        1,
    'total_profiles',   (select count(*) from live),
    'located_profiles', (select count(*) from located),
    'countries',        coalesce((
                          select jsonb_agg(jsonb_build_object(
                                   'code',  s.code,
                                   'name',  coalesce(c.name_fr, s.code),
                                   'count', s.n)
                                 order by s.n desc, coalesce(c.name_fr, s.code))
                          from shown s
                          left join public.countries c on btrim(c.code) = s.code), '[]'::jsonb),
    'hidden_countries', (select count(*) from hidden),
    'hidden_profiles',  (select coalesce(sum(n), 0) from hidden),
    'computed_at',      now())
$fn$;
