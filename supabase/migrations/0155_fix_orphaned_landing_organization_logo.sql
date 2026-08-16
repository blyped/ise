-- 0155 — Répare le logo « Banque mondiale » disparu de la section « Ils nous
-- font confiance » (D-216, 16/08/2026).
--
-- CONSTAT DU PORTEUR : « la section "ou travaille les ISE à disparu, alors
-- que le logo Banque mondiale est toujours uploadé. »
--
-- DIAGNOSTIC — `cms_landing_organizations` contenait une seule ligne,
-- publiée, avec un logo valide (bucket `landing-media`, fichier présent,
-- texte alternatif renseigné), mais son `organization_id` pointait vers
-- « La Banque mondiale » (9012dbd2-7005-40c0-9b72-89832f9f510a) — une
-- organisation FUSIONNÉE dans « Banque mondiale »
-- (580bd9e2-87f8-4a1e-87ff-58be658eb57c) par 0143
-- (0143_organizations_merge_known_duplicates, D-194) : sa colonne
-- `merged_into_id` est déjà renseignée depuis cette migration.
--
-- `get_landing_organizations()` (0133) filtre explicitement
-- `org.merged_into_id is null` — bonne pratique, une organisation fusionnée
-- ne doit jamais réapparaître dans une liste publique. Résultat : la ligne
-- ne franchissait plus ce filtre, la fonction renvoyait `[]`, et
-- `OrganizationsSection.tsx` applique la règle « section vide = pas de
-- section » (0133/D-138) : ni cadre, ni titre, ni logo. Le logo restait
-- pourtant bien présent dans la médiathèque CMS, d'où la confusion du
-- porteur — RIEN n'avait été supprimé, la ligne était seulement devenue
-- invisible pour la RPC.
--
-- ORIGINE PROBABLE DE L'ANOMALIE — la ligne a été créée (ou son média mis à
-- jour) le 15/08/2026 à 21:08:13, sur l'organisation FUSIONNÉE plutôt que
-- sur la canonique : la sélection de l'organisation dans l'écran CMS
-- (« Ils nous font confiance ») ne filtre pas les entrées déjà fusionnées
-- de son propre référentiel de recherche, donc un choix ambigu entre
-- « La Banque mondiale » et « Banque mondiale » a pu porter sur la
-- première. Le garde-fou déjà en place dans `set_landing_organization`
-- (0149, D-207 : `raise exception 'organization_merged'` si
-- `merged_into_id is not null`) empêcherait cette même erreur si elle était
-- retentée aujourd'hui via l'écran CMS — cette migration ne le modifie pas,
-- elle répare seulement la ligne déjà écrite avant/pendant son déploiement.
--
-- CORRECTIF — repointer la ligne existante vers l'organisation canonique,
-- exactement le même mécanisme de cascade que 0143/0149 (repoint si la
-- canonique n'a pas déjà sa propre ligne, sinon la ligne orpheline serait
-- supprimée pour ne pas entrer en conflit avec la contrainte d'unicité de
-- `organization_id`). Aucune autre ligne de `cms_landing_organizations`
-- n'était concernée (une seule ligne existait en tout au moment de l'audit).
begin;

update public.cms_landing_organizations lo
set organization_id = '580bd9e2-87f8-4a1e-87ff-58be658eb57c',
    updated_at = now()
where lo.organization_id = '9012dbd2-7005-40c0-9b72-89832f9f510a'
  and not exists (
    select 1 from public.cms_landing_organizations existing
    where existing.organization_id = '580bd9e2-87f8-4a1e-87ff-58be658eb57c'
  );

delete from public.cms_landing_organizations lo
where lo.organization_id = '9012dbd2-7005-40c0-9b72-89832f9f510a';

commit;
