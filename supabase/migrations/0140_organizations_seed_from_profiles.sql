-- ============================================================================
-- 0140 — RÉFÉRENTIEL DES ORGANISATIONS : PEUPLEMENT DEPUIS LES EMPLOYEURS
--        DÉCLARÉS PAR LES ISE.
--
-- Demande du porteur, mot pour mot : « Les organisations sont les structures
-- et institutions des ISE dans la base de données. Les compter sans doublons
-- et les mettre. »
--
-- CONSTAT. `public.organizations` était vide (0 ligne), alors que 256 des 260
-- profils portent un employeur en texte libre dans
-- `ise_profiles.current_organization_raw`, et qu'AUCUN ne portait de
-- `current_organization_id`. Conséquence visible : le compteur
-- « organisations » de « Le réseau en quelques chiffres » affichait 0, parce
-- que `get_landing_stats()` compte `count(distinct current_organization_id)`
-- — un décompte juste sur une colonne que personne n'avait jamais remplie.
--
-- CE QUE CETTE MIGRATION FAIT, ET CE QU'ELLE NE FAIT PAS.
--
--   * Elle PEUPLE le référentiel et rattache chaque profil à sa structure.
--   * Elle NE PUBLIE RIEN. Les lignes créées ont `is_verified = false`, et
--     `cms_landing_organizations` n'est pas touchée. Peupler le référentiel
--     n'est pas publier : le choix de ce qui paraît sur la page d'accueil
--     reste éditorial, c'est la décision déjà prise en 0133. Un employeur
--     saisi par un membre ne devient pas un logo de vitrine parce qu'il a été
--     saisi.
--
-- RÈGLE DE DÉDOUBLONNAGE (`private.organization_dedupe_key`). Quatre étapes,
-- dans cet ordre, appliquées à la chaîne brute :
--
--   1. TÊTE DE CHAÎNE. Le recensement a été saisi sous la forme
--      « Structure — Direction — Service » (cadratin). Seule la portion qui
--      précède le premier séparateur hiérarchique (— – __) est retenue : une
--      direction n'est pas une organisation.
--   2. SIGLE ENTRE PARENTHÈSES. « Banque Centrale des États de l'Afrique de
--      l'Ouest (BCEAO) » et « BCEAO » désignent la même institution ; le sigle
--      capitalisé, quand il est présent, devient la clé. Une liste
--      d'exclusion (RCI, CI, SA, SAS, SARL, GIE, CIV, SIEGE) écarte les
--      parenthèses qui ne sont pas des sigles d'organisation — sans elle,
--      « Cabinet du Premier Ministre (RCI) » serait rangé sous « RCI ».
--   3. POINTS SUPPRIMÉS avant normalisation : c'est ce qui fait tomber
--      « B.C.E.A.O. » et « BCEAO » sur la même clé. `public.normalize_text()`
--      seule ne le ferait pas — elle produirait « b c e a o ».
--   4. NORMALISATION COMMUNE : `public.normalize_text()` (minuscules, sans
--      accents, ponctuation réduite à l'espace), puis retrait de l'article
--      initial (La / Le / Les / L').
--
-- CE QUE LA RÈGLE NE SAIT PAS FAIRE, ET QUI EST DONC ÉCRIT À LA MAIN. Aucune
-- normalisation ne devine que « FMI » et « Fonds Monétaire International »
-- sont la même institution, ni que « THE WORLD BANK », « World Bank Group »
-- et « Banque mondiale » n'en font qu'une. Ces rapprochements-là sont une
-- connaissance du monde, pas une propriété de la chaîne de caractères : ils
-- sont donc énumérés explicitement ci-dessous, un par un, et chacun est
-- vérifiable. On ne rapproche PAS deux instituts nationaux de la statistique
-- de pays différents sous prétexte qu'ils portent un nom voisin :
-- sous-compter serait ici une erreur plus grave que sur-compter.
--
-- RÉSULTAT ATTENDU : 166 structures distinctes pour 249 profils rattachés.
-- Les 7 réponses restantes (« Aucune », « Sans emploi », « R.A.S », « Au
-- chômage », « INDÉPENDANT »…) ne désignent pas une organisation et sont
-- écartées par `private.organization_is_employer()`. Elles ne sont pas
-- perdues : le texte brut reste dans `current_organization_raw`.
--
-- OÙ VIT LA CLÉ. `organizations.normalized_name` est une colonne GÉNÉRÉE
-- (`normalize_text(canonical_name)`) : elle ne peut pas porter la clé de
-- dédoublonnage, qui n'est pas la normalisation du nom affiché — « bceao »
-- n'est pas la normalisation de « Banque Centrale des États de l'Afrique de
-- l'Ouest (BCEAO) ». La clé est donc enregistrée là où le modèle l'attend
-- déjà : dans `organization_aliases`, avec chaque variante d'écriture
-- rencontrée. C'est exactement la table que `admin_normalize_import_batch()`
-- interroge en second rideau : le prochain import, ou la prochaine saisie,
-- retombera sur la bonne organisation sans repasser par la file de revue.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. La règle, en fonction — pour qu'elle soit rejouable et vérifiable.
-- ---------------------------------------------------------------------------

create or replace function private.organization_dedupe_key(p_raw text)
returns text
language sql
immutable
set search_path to ''
as $fn$
  with h as (
    select btrim(regexp_replace(
             split_part(
               replace(replace(replace(coalesce(p_raw, ''), '—', '|'), '–', '|'), '__', '|'),
               '|', 1),
             '[[:space:],;:/\-]+$', '')) as head
  ),
  a as (
    select head,
           coalesce(
             nullif((regexp_match(head, '\(([A-Z0-9][A-Z0-9&.\-]{1,12})\)'))[1], ''),
             nullif((regexp_match(head, '^([A-Z0-9][A-Z0-9&.\-]{1,12})[[:space:]]*\('))[1], ''),
             head) as candidate
    from h
  )
  select public.normalize_text(
           regexp_replace(
             replace(
               case
                 when upper(replace(candidate, '.', ''))
                      in ('RCI', 'CI', 'SA', 'SAS', 'SARL', 'GIE', 'CIV', 'SIEGE')
                 then head
                 else candidate
               end,
               '.', ''),
             '^(La|Le|Les|L)[[:space:]'']+', '', 'i'))
  from a
$fn$;

comment on function private.organization_dedupe_key(text) is
  '0140 — Clé de dédoublonnage d''un employeur saisi en texte libre : tête de '
  'chaîne avant le premier séparateur hiérarchique, sigle entre parenthèses '
  'quand il y en a un, points supprimés, puis normalize_text() et retrait de '
  'l''article initial.';

create or replace function private.organization_is_employer(p_raw text)
returns boolean
language sql
immutable
set search_path to ''
as $fn$
  select private.organization_dedupe_key(p_raw) is not null
     and private.organization_dedupe_key(p_raw) not in (
           'aucune', 'aucun', 'sans emploi', 'sans emploi actuellement',
           'sans emploi pour le moment', 'au chomage et open to work',
           'chomage', 'en recherche d emploi', 'ras', 'neant', 'nean',
           'independant', 'sans', 'autre', 'retraite', 'na', 'none', 'nil')
$fn$;

comment on function private.organization_is_employer(text) is
  '0140 — Vrai lorsque la réponse désigne réellement une structure. « Aucune », '
  '« Sans emploi », « R.A.S », « INDÉPENDANT » sont des réponses honnêtes à la '
  'question posée, mais ce ne sont pas des organisations : elles n''entrent pas '
  'au référentiel et ne comptent pas dans le chiffre public.';

-- ---------------------------------------------------------------------------
-- 2. Rapprochements écrits à la main (sigle <-> raison sociale).
-- ---------------------------------------------------------------------------

create temporary table _org_fusion (
  alias_key  text primary key,
  canon_key  text not null,
  canon_name text
) on commit drop;

insert into _org_fusion (alias_key, canon_key, canon_name) values
  ('bceao',                                             'bceao', 'Banque Centrale des États de l’Afrique de l’Ouest (BCEAO)'),
  ('bceao siege',                                       'bceao', null),
  ('banque centrale des etats de l afrique de l ouest', 'bceao', null),
  ('banque africaine de developpement', 'banque africaine de developpement', 'Banque Africaine de Développement (BAD)'),
  ('bad',                               'banque africaine de developpement', null),
  ('afdb',                              'banque africaine de developpement', null),
  ('banque mondiale',  'banque mondiale', 'Banque mondiale'),
  ('the world bank',   'banque mondiale', null),
  ('world bank',       'banque mondiale', null),
  ('world bank group', 'banque mondiale', null),
  ('fonds monetaire international', 'fonds monetaire international', 'Fonds Monétaire International (FMI)'),
  ('fmi',                           'fonds monetaire international', null),
  ('agence francaise de developpement', 'agence francaise de developpement', 'Agence Française de Développement (AFD)'),
  ('afd',                               'agence francaise de developpement', null),
  ('orange cote d ivoire', 'orange cote d ivoire', 'Orange Côte d’Ivoire'),
  ('orange ci',            'orange cote d ivoire', null),
  ('commission de l uemoa', 'commission de l uemoa', 'Commission de l’UEMOA'),
  ('commission uemoa',      'commission de l uemoa', null),
  ('uemoa',                 'commission de l uemoa', null),
  ('commission cedeao', 'commission cedeao', 'Commission de la CEDEAO'),
  ('ecowas',            'commission cedeao', null),
  ('inseed', 'inseed', 'Institut National de la Statistique et des Études Économiques et Démographiques (INSEED)'),
  ('institut national de la statistique et des etudes economiques et demographiques', 'inseed', null),
  ('commission economique des nations unies pour l afrique', 'commission economique des nations unies pour l afrique', 'Commission Économique des Nations unies pour l’Afrique (CEA)'),
  ('cea',                                                    'commission economique des nations unies pour l afrique', null),
  ('united nations economic commission for africa',          'commission economique des nations unies pour l afrique', null),
  ('kpmg',     'kpmg', 'KPMG'),
  ('kpmg civ', 'kpmg', null),
  ('institut national de la statistique du cameroun', 'institut national de la statistique du cameroun', 'Institut National de la Statistique du Cameroun'),
  ('ins cameroun',                                    'institut national de la statistique du cameroun', null),
  ('institut national de la statistique', 'institut national de la statistique', 'Institut National de la Statistique'),
  ('institut national statistique',       'institut national de la statistique', null),
  ('institut national de la statistique de cote d ivoire', 'institut national de la statistique de cote d ivoire', 'Institut National de la Statistique (Côte d’Ivoire)'),
  ('institut national de la statistique cote d ivoire',    'institut national de la statistique de cote d ivoire', null),
  ('institut national de la statistique et de la demographie', 'institut national de la statistique et de la demographie', 'Institut National de la Statistique et de la Démographie (INSD)'),
  ('institut national de la statistique et de demographie',    'institut national de la statistique et de la demographie', null),
  ('institut national de la statistique et de la demigraphie', 'institut national de la statistique et de la demographie', null),
  ('insd',                                                     'institut national de la statistique et de la demographie', null),
  ('compagnie ivoirienne d electricite',     'compagnie ivoirienne d electricite', 'Compagnie Ivoirienne d’Électricité (CIE)'),
  ('compagnie ivoirienne d electricite cie', 'compagnie ivoirienne d electricite', null),
  ('sunu assurances vie cote d ivoire', 'sunu assurances vie cote d ivoire', 'SUNU Assurances Vie Côte d’Ivoire'),
  ('sunu assurance vie ci',             'sunu assurances vie cote d ivoire', null),
  ('sunu assurance vie cote d ivoire',  'sunu assurances vie cote d ivoire', null),
  ('sunu assurances vie ci',            'sunu assurances vie cote d ivoire', null),
  ('direction generale du tresor et de la comptabilite publique', 'direction generale du tresor et de la comptabilite publique', 'Direction Générale du Trésor et de la Comptabilité Publique (DGTCP)'),
  ('dgtcp',                                                       'direction generale du tresor et de la comptabilite publique', null),
  ('tresor public',                                               'direction generale du tresor et de la comptabilite publique', null),
  ('direction generale du portefeuille de l etat', 'direction generale du portefeuille de l etat', 'Direction Générale du Portefeuille de l’État (DGPE)'),
  ('dgpe',                                         'direction generale du portefeuille de l etat', null),
  ('ministere du commerce et de l industrie',           'ministere du commerce et de l industrie', 'Ministère du Commerce et de l’Industrie'),
  ('cabinet du ministre du commerce et de l industrie', 'ministere du commerce et de l industrie', null),
  ('ministere du plan et du developpement',                     'ministere du plan et du developpement', 'Ministère du Plan et du Développement'),
  ('cabinet du ministre du plan et du developpement',           'ministere du plan et du developpement', null),
  ('ministere du plan et du developpement cabinet du ministre', 'ministere du plan et du developpement', null),
  ('ministere du plan et du developpement cote d ivoire',       'ministere du plan et du developpement', null),
  ('voodoo group',         'voodoo group', 'VOODOO Group'),
  ('voodoo communication', 'voodoo group', null),
  ('entrepreneurial solutions partners', 'entrepreneurial solutions partners', 'Entrepreneurial Solutions Partners (ESPartners)'),
  ('espartners',                         'entrepreneurial solutions partners', null),
  ('ifc',            'ifc', 'International Finance Corporation (IFC)'),
  ('ifc world bank', 'ifc', null);

-- ---------------------------------------------------------------------------
-- 3. Recensement des structures réellement présentes sur les profils.
-- ---------------------------------------------------------------------------

create temporary table _org_seed on commit drop as
select p.id as profile_id,
       btrim(regexp_replace(
         split_part(
           replace(replace(replace(btrim(p.current_organization_raw), '—', '|'), '–', '|'), '__', '|'),
           '|', 1),
         '[[:space:],;:/\-]+$', '')) as head,
       private.organization_dedupe_key(p.current_organization_raw) as raw_key,
       private.organization_dedupe_key(p.current_organization_raw) as canon_key
from public.ise_profiles p
where nullif(btrim(p.current_organization_raw), '') is not null
  and private.organization_is_employer(p.current_organization_raw);

update _org_seed s
   set canon_key = f.canon_key
  from _org_fusion f
 where f.alias_key = s.raw_key;

-- Nom canonique : celui écrit à la main quand il existe, sinon la variante la
-- plus informative rencontrée — on préfère une graphie mixte à une graphie
-- tout en capitales, puis la plus longue, à défaut la première par ordre
-- alphabétique. Rien n'est inventé : le nom retenu a été saisi par un ISE.
create temporary table _org_group on commit drop as
select s.canon_key,
       coalesce(
         (select f.canon_name from _org_fusion f
           where f.canon_key = s.canon_key and f.canon_name is not null limit 1),
         (select s2.head from _org_seed s2
           where s2.canon_key = s.canon_key
           order by (s2.head = upper(s2.head)) asc, length(s2.head) desc, s2.head asc
           limit 1)
       ) as canonical_name
from _org_seed s
group by s.canon_key;

alter table _org_group add column norm_name text;
update _org_group set norm_name = public.normalize_text(canonical_name);

-- ---------------------------------------------------------------------------
-- 4. Écriture du référentiel. `is_verified = false` : une structure recensée
--    n'est pas une structure validée.
-- ---------------------------------------------------------------------------

insert into public.organizations (canonical_name, slug, is_verified)
select g.canonical_name,
       left(regexp_replace(g.canon_key, '[^a-z0-9]+', '-', 'g'), 80),
       false
from _org_group g
where g.canonical_name is not null
  and not exists (select 1 from public.organizations o where o.normalized_name = g.norm_name)
on conflict (slug) do nothing;

-- Table de correspondance clé de dédoublonnage -> organisation.
create temporary table _org_link on commit drop as
select g.canon_key, g.norm_name, o.id as organization_id
from _org_group g
join public.organizations o on o.normalized_name = g.norm_name;

-- 4a. La clé de dédoublonnage elle-même, quand elle diffère de la
--     normalisation du nom affiché (« bceao » face à « banque centrale des
--     etats de l afrique de l ouest bceao »).
insert into public.organization_aliases (organization_id, alias, source)
select l.organization_id, l.canon_key, 'import'
from _org_link l
where l.canon_key is distinct from l.norm_name
on conflict (normalized_alias) do nothing;

-- 4b. Chaque graphie réellement rencontrée sur un profil, pour que la
--     prochaine saisie identique retombe dessus sans revue humaine.
insert into public.organization_aliases (organization_id, alias, source)
select l.organization_id, min(s.head), 'import'
from _org_seed s
join _org_link l on l.canon_key = s.canon_key
where public.normalize_text(s.head) is distinct from l.norm_name
group by l.organization_id, public.normalize_text(s.head)
on conflict (normalized_alias) do nothing;

-- ---------------------------------------------------------------------------
-- 5. Rattachement des profils. C'est cette colonne, et elle seule, que
--    `get_landing_stats()` compte.
-- ---------------------------------------------------------------------------

update public.ise_profiles p
   set current_organization_id = l.organization_id
  from _org_seed s
  join _org_link l on l.canon_key = s.canon_key
 where p.id = s.profile_id
   and p.current_organization_id is distinct from l.organization_id;

-- ---------------------------------------------------------------------------
-- 6. Garde-fou : la migration échoue plutôt que de laisser un profil
--    silencieusement non rattaché à cause d'une collision d'alias.
-- ---------------------------------------------------------------------------

do $check$
declare
  v_manquants integer;
begin
  select count(*) into v_manquants
  from _org_seed s
  where not exists (select 1 from _org_link l where l.canon_key = s.canon_key);
  if v_manquants > 0 then
    raise exception '0140 : % profils n''ont pas pu être rattachés à une organisation', v_manquants;
  end if;
end
$check$;
