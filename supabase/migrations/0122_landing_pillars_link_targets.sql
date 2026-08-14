-- =====================================================================
-- 0122_landing_pillars_link_targets
--
-- Rend cliquables les QUATRE piliers de « Un reseau concu pour etre
-- utile » (NetworkSection.tsx). 0114 avait pose le mecanisme complet
-- (colonne link_target + liste blanche + ecran /cms/piliers) mais n'avait
-- cable qu'un seul pilier : « Connecter -> search », repris de D-164. Les
-- trois autres sont restes a NULL, donc du texte seul. Cette migration
-- pose leur cible reelle.
--
-- POURQUOI UNE MIGRATION ET PAS UN CLIC DANS LE CMS
--   La cible d'un pilier n'est pas une preference d'affichage : c'est la
--   promesse du pilier. Elle doit exister des le premier deploiement d'un
--   environnement neuf, comme « Connecter -> search » existe depuis 0114.
--   L'administrateur reste libre de la changer ensuite dans /cms/piliers
--   (la liste blanche ne bouge pas) : d'ou le garde-fou `link_target is
--   null` ci-dessous, qui ne pose une valeur que la ou personne n'a encore
--   choisi. Rejouer cette migration ne reecrit donc jamais un choix
--   d'administrateur.
--
-- CHOIX DES CIBLES, ET LEUR JUSTIFICATION
--   Chaque cible est deduite du libelle REEL du pilier (fr.public.pillars,
--   i18n) et pointe vers un ecran membre qui existe. Aucune destination
--   approximative : rien de decoratif (MASTER PROMPT §113).
--
--   * « Entraider — Demandez ou apportez une aide ciblee. »
--       -> 'calls' = /appels (ISE-047, Appels au reseau). C'est le seul
--          endroit de la plateforme ou l'on demande de l'aide ET ou l'on
--          repond a la demande d'un autre. La phrase du pilier est la
--          definition meme d'un appel au reseau.
--
--   * « Collaborer — Montez missions, projets et consortiums. »
--       -> 'projects' = /projets (ISE-088, Espace Projets & Consortiums).
--          Correspondance litterale : le fil d'Ariane des maquettes place
--          deja cet ecran sous « Collaborer » (cf. routes/projects.ts).
--
--   * « Impacter — Mesurez les resultats professionnels facilites. »
--       -> 'applications' = /candidatures (ISE-063). C'est la que les
--          resultats professionnels sont declares et suivis, jusqu'a
--          l'ecran « Resultat final d'une candidature et impact »
--          (ISE-066) : le pilier parle de mesure d'impact, cet ecran est
--          celui de la mesure. /opportunites, l'autre candidat, montre des
--          offres a saisir — c'est l'amont, pas le resultat. La liste
--          blanche de 0114 documentait deja ce rattachement
--          (« 'applications' -> /candidatures (Impacter) »).
--
--   « Connecter -> search » (/rechercher, ISE-034) reste inchange.
--
-- CE QUE CETTE MIGRATION NE FAIT PAS
--   * elle n'elargit pas la liste blanche : les cinq cles de 0114
--     suffisent, chacune des quatre cibles retenues en fait partie ;
--   * elle ne pose AUCUNE image. Le mecanisme existe (cms_pillars.media_id
--     -> get_landing_pillars().image -> NetworkSection), mais un visuel de
--     pilier est un fichier reel a televerser dans la mediatheque, puis a
--     choisir dans /cms/piliers. Inventer un media ici reviendrait a
--     fabriquer un contenu que personne n'a valide ;
--   * elle ne touche ni au titre ni au corps des piliers (discours de
--     marque, fr.public.pillars).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Cablage des trois piliers restes sans cible.
-- ---------------------------------------------------------------------
update public.cms_pillars
   set link_target = 'calls', updated_at = now()
 where pillar_key = 'entraider' and link_target is null;

update public.cms_pillars
   set link_target = 'projects', updated_at = now()
 where pillar_key = 'collaborer' and link_target is null;

update public.cms_pillars
   set link_target = 'applications', updated_at = now()
 where pillar_key = 'impacter' and link_target is null;

-- ---------------------------------------------------------------------
-- 2. Verification : les quatre piliers ont une cible, et cette cible
--    appartient a la liste blanche de 0114 (la contrainte CHECK le
--    garantit deja, on verifie ici l'intention : plus aucun NULL).
-- ---------------------------------------------------------------------
do $verify$
declare
  v_sans_cible integer;
  v_total      integer;
begin
  select count(*) into v_total from public.cms_pillars;
  if v_total <> 4 then
    raise exception '0122: cms_pillars devrait contenir 4 lignes, en contient %', v_total;
  end if;

  select count(*) into v_sans_cible
  from public.cms_pillars
  where link_target is null;
  if v_sans_cible <> 0 then
    raise exception '0122: % pilier(s) restent sans cible cliquable', v_sans_cible;
  end if;

  if not exists (
    select 1 from public.cms_pillars
    where pillar_key = 'connecter' and link_target = 'search') then
    raise exception '0122: le pilier Connecter doit rester cable vers ''search'' (D-164)';
  end if;

  select count(*) into v_sans_cible from private.security_baseline_violations();
  if v_sans_cible <> 0 then
    raise exception '0122: security_baseline_violations() renvoie % ligne(s)', v_sans_cible;
  end if;

  select count(*) into v_sans_cible from private.storage_baseline_violations();
  if v_sans_cible <> 0 then
    raise exception '0122: storage_baseline_violations() renvoie % ligne(s)', v_sans_cible;
  end if;
end
$verify$;
