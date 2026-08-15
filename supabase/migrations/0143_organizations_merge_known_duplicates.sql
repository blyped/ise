-- 0143 — Fusion des doublons connus du référentiel organizations (D-194 réserve).
-- Décision explicite du porteur du projet, 15/08/2026 : trancher le doublon
-- signalé par l'audit QA (0140/0142, heuristiques de dédup différentes).
--
-- Portée volontairement conservatrice : seules les variantes NON AMBIGUËS de
-- la MÊME entité (typo, casse, acronyme manquant/présent, traduction
-- FR/EN de la même institution) sont fusionnées. Les cas ambigus
-- (ex. "Société Générale" vs "Société générale côte d'ivoire", qui peuvent
-- désigner le siège vs une filiale locale distincte) sont volontairement
-- laissés en l'état, pour arbitrage manuel ultérieur dans /cms/organisations.
--
-- Mécanique : `merged_into_id` pointe vers l'organisation canonique retenue ;
-- les profils et les alias sont repointés ; rien n'est supprimé (traçabilité).
-- Déjà appliquée en base (execute_sql direct) ; versionnée ici pour que le
-- dépôt reflète fidèlement l'état de la base (même discipline que 0133/0135/
-- 0106-0109/0120/0137b/0140/0142_fix).

begin;

create temporary table tmp_org_merge (dup_id uuid primary key, canonical_id uuid not null) on commit drop;

insert into tmp_org_merge (dup_id, canonical_id) values
  ('6153c45e-9d09-4fa3-ab17-b10f8c04f7b9', '811e18b4-9c00-4509-8efb-9322d605c6f4'),
  ('3edee26c-ed64-48c6-947c-fa6291e016e8', '811e18b4-9c00-4509-8efb-9322d605c6f4'),
  ('b4491b5e-a1c5-418a-988e-33d7fc588d42', '811e18b4-9c00-4509-8efb-9322d605c6f4'),
  ('116dc962-67ed-47c5-9a2a-7fc435d43b80', 'e0b5298d-e169-4798-a4f4-2d59a127849f'),
  ('f819fe34-f9c9-478e-880f-e42fd9540254', 'e0b5298d-e169-4798-a4f4-2d59a127849f'),
  ('88fe73ce-f699-425c-ac59-0e0a21a8500f', '9aa0eaeb-a295-4790-b5af-c815497b33e1'),
  ('3b966c05-4469-446d-9952-4b6493847a13', '9aa0eaeb-a295-4790-b5af-c815497b33e1'),
  ('10b7b9b0-5c1b-4382-b7e7-2ad1b2fb4163', '5ff4903a-9a8b-47c6-abc8-25d305ce5fa5'),
  ('2300847c-6f78-415e-b5ef-ddfa7ace5df3', '580bd9e2-87f8-4a1e-87ff-58be658eb57c'),
  ('9012dbd2-7005-40c0-9b72-89832f9f510a', '580bd9e2-87f8-4a1e-87ff-58be658eb57c'),
  ('822328a8-6bb3-4c30-aa49-0362e62d83b3', '580bd9e2-87f8-4a1e-87ff-58be658eb57c'),
  ('49e44d46-8421-4154-9ed8-5c94468502a6', '580bd9e2-87f8-4a1e-87ff-58be658eb57c'),
  ('2db58f52-4c1b-4a59-866c-fb03f329202b', 'fe7e55e2-e207-4713-a551-48feab113ea3'),
  ('692e7129-a894-4015-ad24-deb03ad52a3d', '3d15accb-9140-46c7-92a3-5db7df68c077'),
  ('9e20c28b-69f6-4de2-b5c6-ee23a67cffe3', '069be59d-952c-46b6-a1ed-3536835f2102'),
  ('ddeef4da-ee19-4475-9827-a94a0d378af1', '0b38d869-5841-47ee-adb8-932948112e20'),
  ('3cda7ced-f5df-4203-8ab0-e33b1552f9fc', '5fb6a01f-cdcb-4d12-a4e3-aa3186f8085c'),
  ('b01e3687-c73c-4eb8-9580-46d7e44851b0', 'f5d39c96-ab2c-4c20-b164-dfa6186f4848'),
  ('ac662d4f-fb13-40f1-8b78-ef34b30d1df6', 'f5d39c96-ab2c-4c20-b164-dfa6186f4848'),
  ('e1fdbab3-ee5d-4f4c-856c-2cae03744146', '4a4e73a7-d7af-42e9-a166-fc25d6d10131'),
  ('47763cbe-377b-47c2-ba4a-961c99dbeb5a', '0b897081-95e1-4cb2-8e59-966c2c0ce36f');

do $$
begin
  if exists (
    select 1 from tmp_org_merge m
    where m.canonical_id in (select dup_id from tmp_org_merge)
  ) then
    raise exception 'organizations_merge_chain_detected';
  end if;
end $$;

update public.ise_profiles p
set current_organization_id = m.canonical_id
from tmp_org_merge m
where p.current_organization_id = m.dup_id;

update public.cms_landing_organizations lo
set organization_id = m.canonical_id
from tmp_org_merge m
where lo.organization_id = m.dup_id
  and not exists (
    select 1 from public.cms_landing_organizations existing
    where existing.organization_id = m.canonical_id
  );

delete from public.cms_landing_organizations lo
using tmp_org_merge m
where lo.organization_id = m.dup_id;

insert into public.organization_aliases (organization_id, alias, source)
select m.canonical_id, o.canonical_name, 'admin'
from tmp_org_merge m
join public.organizations o on o.id = m.dup_id
where not exists (
  select 1 from public.organization_aliases a
  where a.organization_id = m.canonical_id and a.alias = o.canonical_name
);

update public.organizations o
set merged_into_id = m.canonical_id,
    updated_at = now()
from tmp_org_merge m
where o.id = m.dup_id;

commit;
