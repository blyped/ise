-- 0149 — Nettoyage, dédoublonnage et harmonisation du référentiel organizations
-- (tâche #197), + ajout/complétion de « Optimum Conseil ».
--
-- Constat du porteur, 15/08/2026, mot pour mot : « j'ai vu la liste des
-- organisations, c'est clairement une fouille. il y a nettement des
-- doublons. analyse, supprime les doublons et harmonise et optimise cette
-- liste. ajoute Optimum conseil à cette liste. »
--
-- ÉTAT DE DÉPART (avant cette migration) : 200 lignes, 179 actives
-- (merged_into_id is null), 21 déjà fusionnées par 0143
-- (0143_organizations_merge_known_duplicates, D-194/§52, réserve résolue
-- sur le doublon de heuristiques 0140/0142). Les 179 lignes actives ont été
-- relues intégralement (requête triée par normalized_name, avec comptage des
-- profils liés via ise_profiles.current_organization_id) avant d'écrire quoi
-- que ce soit ci-dessous.
--
-- MÉTHODE DE DÉTECTION — la même prudence que 0142 et 0143 : une fusion
-- n'est faite que sur IDENTITÉ RÉELLE manifeste, jamais sur ressemblance de
-- secteur/taille. Trois classes de cas retenues cette fois-ci, aucune ne
-- relevant de l'expansion d'acronyme spéculative que 0142 interdisait déjà :
--   (a) SIGLE AUTO-DÉCLARÉ — la ligne canonique porte déjà l'acronyme entre
--       parenthèses (ex. « ... (DGTCP) ») et une autre ligne ne contient que
--       ce même sigle seul : aucune supposition, l'acronyme est écrit dans
--       le nom cible lui-même.
--   (b) TRADUCTION LITTÉRALE FR/EN d'un organe des Nations unies dont il
--       n'existe qu'UN SEUL exemplaire au monde (« Commission Économique des
--       Nations unies pour l'Afrique (CEA) » = « United Nations Economic
--       Commission for Africa ») — à la différence de CEDEAO/ECOWAS ou UEMOA
--       (ci-dessous, volontairement NON fusionnés) qui chapeautent PLUSIEURS
--       organes distincts (Commission, banque, cour de justice...), donc une
--       ambiguïté réelle sur l'organe visé.
--   (c) SOUS-SERVICE/CABINET DE LA MÊME ENTITÉ — repéré cette fois entre
--       DEUX LIGNES DISTINCTES (pas dans le même texte libre avec un « — »,
--       déjà traité par 0142) : un séparateur « / » ou une parenthèse
--       « (Cabinet du Ministre) » avait échappé au découpage sur « — »
--       strict de 0142/0142_fix. Même principe que 0142 : un cabinet
--       ministériel n'est pas un employeur distinct du ministère.
-- Un seul cas de faute de frappe évidente (mot manquant, sans changement de
-- sens) est fusionné : « Institut National Statistique » → « Institut
-- National de la Statistique ».
--
-- DÉLIBÉRÉMENT NON FUSIONNÉS (cas douteux, voir docs/decisions.md D-207) —
-- toutes ces lignes restent deux entrées séparées : KPMG / KPMG CIV, MTN /
-- MTN CI (filiale nationale distincte, même principe que Deloitte
-- France/Mazars CI déjà séparés), Orange / Orange Côte d'Ivoire / Orange
-- Mali / Orange Money Côte d'Ivoire / Orange Bank Africa (filiales et
-- coentreprises distinctes du groupe), Société Générale / Société générale
-- côte d'ivoire (cas déjà documenté par l'en-tête de 0143, siège vs filiale),
-- UEMOA / Commission de l'UEMOA, ECOWAS / Commission de la CEDEAO (l'union
-- chapeaute plusieurs organes, lequel est visé n'est pas certain),
-- Ministère de l'Agriculture (générique) / Ministère de l'Agriculture,
-- Burkina Faso (pays différent probable mais texte trop court pour trancher
-- côté CI), Trésor Public (relation avec la DGTCP non confirmée), Voodoo
-- communication / VOODOO Group (agence vs. holding, incertain), Institut
-- National de la Statistique (générique) / ... (Côte d'Ivoire) (peut désigner
-- l'INS de plusieurs pays francophones).
--
-- MÉCANIQUE DE FUSION — strictement identique à 0143 : `merged_into_id`
-- pointe vers l'organisation canonique retenue, les profils et les entrées
-- de la section « Ils nous font confiance » (`cms_landing_organizations`)
-- sont repointés (aucun profil ni logo n'était en réalité concerné : les 8
-- lignes fusionnées ci-dessous comptaient 0 profil rattaché au moment de
-- l'audit — un reliquat des deux passes de seeding 0140/0142, voir réserve
-- de D-194 — et aucune n'était attachée à un logo publié), les alias sont
-- conservés dans `organization_aliases`, rien n'est supprimé.
--
-- HARMONISATION COSMÉTIQUE — casse/espaces/accents/typos évidents corrigés
-- sur des lignes NON fusionnées, sans changer le sens : tout-majuscules mis
-- en casse normale (ex. « ALLIANZ » → « Allianz »), deux fautes de frappe
-- corrigées dans le nom lui-même (« Investissemnt » → « Investissement »,
-- « lAfique » → « l'Afrique »). `normalized_name` étant une colonne générée
-- (`generated always as (public.normalize_text(canonical_name))`), aucune
-- mise à jour séparée n'est nécessaire ni possible.
--
-- OPTIMUM CONSEIL — déjà présente (id 07de7361-b97a-4488-b63f-b1f320d86371,
-- 1 profil rattaché), vraisemblablement ajoutée par le porteur lui-même
-- depuis la picklist du formulaire de profil avant cette migration : aucune
-- création nécessaire. Complétée avec `organization_type = 'consulting'`
-- (valeur de la liste blanche déjà en place, D-52/0002 — fait factuel connu,
-- pas une supposition) et `country_code = 'CI'` (déduit du domaine de
-- production `ise.optimumconseil.ci`, pas inventé). `city` laissée `null` :
-- aucune source fiable en base pour l'affirmer.

begin;

-- ---------------------------------------------------------------------
-- 1) Fusions (merged_into_id), mécanique identique à 0143
-- ---------------------------------------------------------------------
create temporary table tmp_org_merge_0149 (dup_id uuid primary key, canonical_id uuid not null) on commit drop;

insert into tmp_org_merge_0149 (dup_id, canonical_id) values
  -- (a) sigle auto-déclaré
  ('a64477cd-6bad-4224-a4c1-d5718bfc183c', 'dbaadb9c-2c14-4aa8-b378-89e69a04719b'), -- DGTCP -> Direction Générale du Trésor et de la Comptabilité Publique (DGTCP)
  -- ANARE-CI : le texte libre fusionné lui-même joint le sigle et le nom complet ("ANARE-CI __Autorité nationale de régulation...")
  ('3a2cc3e1-8c58-4862-8fb7-e4b78f1a8cff', '6be4b76b-0b7b-472b-b715-89ec1ec1e407'), -- ANARE-CI __Autorité nationale de régulation... -> ANARE-CI
  -- (b) traduction littérale FR/EN d'un organe onusien unique
  ('49f096e9-25fa-409e-80e0-91c825dae050', '893e3632-d162-4281-b661-17f1eec71e1d'), -- United Nations Economic Commission for Africa -> Commission Économique des Nations unies pour l'Afrique (CEA)
  -- (c) cabinet/sous-service de la même entité, séparateur non " — "
  ('92fe9578-b638-40da-80f0-cdc2f16725b6', '9621239f-65a6-42a5-aa86-3a1c8537e620'), -- Ministère du Plan et du Développement (Cabinet du Ministre) -> Ministère du Plan et du Développement
  ('5f85ad57-fcc0-49a2-9f88-1e6ab7be39a6', '9621239f-65a6-42a5-aa86-3a1c8537e620'), -- MINISTERE DU PLAN ET DU DEVELOPPEMENT/COTE D'IVOIRE -> Ministère du Plan et du Développement
  ('a0ffb2f4-b00c-4f47-aa7f-a98a4b3be6a8', '9621239f-65a6-42a5-aa86-3a1c8537e620'), -- Cabinet du Ministre du Plan et du Développement -> Ministère du Plan et du Développement
  ('9255da17-4c5a-4fba-8236-9c21c7c720a0', 'debf5642-ea53-454b-a372-a9da91b35e14'), -- Cabinet du Ministre du Commerce et de l'Industrie -> Ministère du Commerce et de l'Industrie
  -- faute de frappe évidente (mot manquant, même sens)
  ('04fefa1e-c998-424a-9368-5ab964e786df', 'd76ae57c-67b2-41c7-b2f9-8475f3205d8b'); -- Institut National Statistique -> Institut National de la Statistique

do $$
begin
  if exists (
    select 1 from tmp_org_merge_0149 m
    where m.canonical_id in (select dup_id from tmp_org_merge_0149)
  ) then
    raise exception 'organizations_merge_chain_detected';
  end if;
end $$;

update public.ise_profiles p
set current_organization_id = m.canonical_id
from tmp_org_merge_0149 m
where p.current_organization_id = m.dup_id;

update public.cms_landing_organizations lo
set organization_id = m.canonical_id
from tmp_org_merge_0149 m
where lo.organization_id = m.dup_id
  and not exists (
    select 1 from public.cms_landing_organizations existing
    where existing.organization_id = m.canonical_id
  );

delete from public.cms_landing_organizations lo
using tmp_org_merge_0149 m
where lo.organization_id = m.dup_id;

insert into public.organization_aliases (organization_id, alias, source)
select m.canonical_id, o.canonical_name, 'admin'
from tmp_org_merge_0149 m
join public.organizations o on o.id = m.dup_id
where not exists (
  select 1 from public.organization_aliases a
  where a.organization_id = m.canonical_id and a.alias = o.canonical_name
);

update public.organizations o
set merged_into_id = m.canonical_id,
    updated_at = now()
from tmp_org_merge_0149 m
where o.id = m.dup_id;

-- ---------------------------------------------------------------------
-- 2) Harmonisation cosmétique de lignes NON fusionnées (casse/typo)
-- ---------------------------------------------------------------------
update public.organizations set canonical_name = 'Afrique Pesage', updated_at = now() where id = 'ee41957f-dd33-40be-9b9a-ea04eeff210a';
update public.organizations set canonical_name = 'AFRITAC de l''Ouest', updated_at = now() where id = '22175ed8-38df-4ec3-a8c3-bce392c6a59a';
update public.organizations set canonical_name = 'Allianz', updated_at = now() where id = '9dd7b880-02cf-4d00-a1cb-709bbf475c96';
update public.organizations set canonical_name = 'Atlantic Financial Group SA', updated_at = now() where id = '0f13d477-dca5-43cb-bad7-deda5a3291a9';
update public.organizations set canonical_name = 'Canal+ International', updated_at = now() where id = '4a74d2ea-a6b6-4d6f-9767-4fd711bb8d27';
update public.organizations set canonical_name = 'Cofina Côte d''Ivoire', updated_at = now() where id = '7ab179b8-4e3e-4ab4-a805-2302f49cef15';
update public.organizations set canonical_name = 'Endeavour Mining', updated_at = now() where id = 'c52197d5-9664-4b67-bdac-91e652832d08';
update public.organizations set canonical_name = 'Engie Digital', updated_at = now() where id = '45d411cf-0da1-450a-81b2-f0bae3790220';
update public.organizations set canonical_name = 'Family Health International 360', updated_at = now() where id = '551cafca-1bb0-4ac8-a081-1af80cd0c533';
update public.organizations set canonical_name = 'Gorée Institute', updated_at = now() where id = '1388e22e-dafa-4211-ba53-5e51a0ed3154';
update public.organizations set canonical_name = 'Ministère des Marchés Publics', updated_at = now() where id = 'eb01fe69-9876-4d26-8cb9-85469a4bf15c';
update public.organizations set canonical_name = 'Ministère d''État, Ministère de l''Agriculture et du Développement Rural', updated_at = now() where id = 'cde48f86-ea33-47d0-8c9a-4db619542f9d';
update public.organizations set canonical_name = 'Office Ivoirien des Chargeurs', updated_at = now() where id = 'd1067447-6e8f-4f6e-a967-83be3268926b';
update public.organizations set canonical_name = 'ONG Plan International Burkina Faso', updated_at = now() where id = 'a1ae1cc2-73a3-4c9e-970f-7bab9b63c60d';
update public.organizations set canonical_name = 'Orabank CI', updated_at = now() where id = '44cccdc6-92d7-46a8-9f6e-1da08a24d72a';
update public.organizations set canonical_name = 'Sanlam Assurance Vie CI', updated_at = now() where id = 'a56bc0e7-b669-4be4-b4d5-483fe8634352';
update public.organizations set canonical_name = 'Sanlam Pan Africa', updated_at = now() where id = 'bea6e3af-11fa-4012-9380-70effcef2b15';
update public.organizations set canonical_name = 'Société Nationale d''Assurances et de Réassurances', updated_at = now() where id = 'bbf93dc6-3037-41df-bfb1-11f06c0e2666';
update public.organizations set canonical_name = 'Université Laval', updated_at = now() where id = '9da53faf-9aa1-4c36-89ee-ec0c72636564';
update public.organizations set canonical_name = 'Agence Côte d''Ivoire PME', updated_at = now() where id = '77beba56-5c25-4153-a4e0-4010618d7fa7';
update public.organizations set canonical_name = 'Banque Nationale d''Investissement', updated_at = now() where id = '003d88c7-4895-47ea-b104-851b74a4fb67';
update public.organizations set canonical_name = 'Agence Monétaire de l''Afrique de l''Ouest', updated_at = now() where id = '408a4a9e-4700-4127-a32b-7e7b00eb4984';

-- ---------------------------------------------------------------------
-- 3) Optimum Conseil — déjà présente, complétée (pas de doublon créé)
-- ---------------------------------------------------------------------
update public.organizations
set organization_type = 'consulting',
    country_code = 'CI',
    updated_at = now()
where id = '07de7361-b97a-4488-b63f-b1f320d86371'
  and canonical_name = 'Optimum Conseil';

-- ---------------------------------------------------------------------
-- 4) Durcissement défensif de la section « Ils nous font confiance » et de
--    la médiathèque CMS : une organisation fusionnée ne doit plus jamais
--    pouvoir être choisie pour un logo, même directement en base.
-- ---------------------------------------------------------------------
create or replace function public.set_landing_organization(
  p_organization_id uuid,
  p_media_id uuid default null,
  p_display_order integer default null,
  p_is_published boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bucket  text;
  v_alt     text;
  v_deleted timestamptz;
  v_order   integer := coalesce(p_display_order, 0);
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not private.has_permission('cms.edit') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if not exists (select 1 from public.organizations o where o.id = p_organization_id) then
    raise exception 'unknown_organization' using errcode = 'P0002';
  end if;

  -- 0149 : une organisation fusionnee (doublon connu, D-194/D-207) n'est
  -- jamais une cible valide, meme pour un appel direct de cette fonction.
  if exists (
    select 1 from public.organizations o
    where o.id = p_organization_id and o.merged_into_id is not null
  ) then
    raise exception 'organization_merged' using errcode = 'P0001';
  end if;

  if v_order < 0 or v_order > 999 then
    raise exception 'invalid_display_order' using errcode = 'P0001';
  end if;

  if p_media_id is not null then
    select m.bucket_id, m.alt_text, m.deleted_at
      into v_bucket, v_alt, v_deleted
      from public.cms_media_assets m
     where m.id = p_media_id;
    if v_bucket is null or v_deleted is not null then
      raise exception 'invalid_media' using errcode = 'P0001';
    end if;
    if v_bucket <> 'landing-media' or char_length(btrim(coalesce(v_alt, ''))) < 3 then
      raise exception 'invalid_media' using errcode = 'P0001';
    end if;
  end if;

  insert into public.cms_landing_organizations
    (organization_id, media_id, display_order, is_published, updated_at)
  values
    (p_organization_id, p_media_id, v_order, coalesce(p_is_published, false), now())
  on conflict (organization_id) do update
    set media_id      = excluded.media_id,
        display_order = excluded.display_order,
        is_published  = excluded.is_published,
        updated_at    = now();

  perform private.log_audit(
    p_action      => 'cms.landing_organization',
    p_object_type => 'organization',
    p_object_id   => p_organization_id::text,
    p_context     => jsonb_build_object(
                       'media_id', p_media_id,
                       'display_order', v_order,
                       'is_published', coalesce(p_is_published, false)));

  return jsonb_build_object(
    'organization_id', p_organization_id,
    'media_id', p_media_id,
    'display_order', v_order,
    'is_published', coalesce(p_is_published, false));
end
$$;

revoke all on function public.set_landing_organization(uuid, uuid, integer, boolean) from public, anon;
grant execute on function public.set_landing_organization(uuid, uuid, integer, boolean) to authenticated, service_role;

comment on function public.set_landing_organization(uuid, uuid, integer, boolean) is
  'CMS-013 (0133). Ajoute ou met a jour une organisation de la section « logos » de la page d''accueil. Exige cms.edit. Le media doit appartenir a la mediatheque publique et porter une alternative textuelle. Refuse une organisation fusionnee (merged_into_id non nul, 0149).';

create or replace function public.get_landing_organizations()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select jsonb_agg(row_to_json(t)::jsonb order by t.display_order, t.organization_name)
    from (
      select lo.organization_id,
             org.canonical_name as organization_name,
             lo.display_order,
             coalesce(private.landing_media(lo.media_id),
                      private.landing_media_by_path(org.logo_path)) as logo
      from public.cms_landing_organizations lo
      join public.organizations org on org.id = lo.organization_id
      where lo.is_published
        and org.merged_into_id is null
        and coalesce(private.landing_media(lo.media_id),
                     private.landing_media_by_path(org.logo_path)) is not null
    ) t
  ), '[]'::jsonb)
$$;

revoke all on function public.get_landing_organizations() from public;
grant execute on function public.get_landing_organizations() to anon, authenticated, service_role;

comment on function public.get_landing_organizations() is
  'PUB-001 (0133). Logos des organisations retenues par l''administration. Aucun texte, aucun chiffre : le nom ne sert que d''alternative textuelle. Une ligne sans logo affichable n''est pas projetee. Une organisation fusionnee est exclue par construction (0149).';

commit;
