-- =====================================================================
-- 0139 — COMPTEURS D'EXPOSITION DU MENU DU CMS
--
-- POURQUOI
--   Le menu du back-office admin dit desormais ou il y a du travail
--   (0138). Le menu du CMS, lui, ne disait rien. Or le CMS ne juge pas un
--   contenu : il decide de son EXPOSITION sur la vitrine. Le travail qui
--   s'y accumule n'est donc pas une file de decisions recues, c'est un
--   ECART entre ce que le CMS croit avoir expose et ce que la page
--   d'accueil montre reellement. `cms_nav_counters()` renvoie cet ecart,
--   EN UN SEUL ALLER-RETOUR, une cle par entree de menu concernee. Le
--   gabarit `CmsShell` l'appelle une fois par rendu.
--
-- CE QUI EST COMPTE, ET POURQUOI CELA MERITE UNE PASTILLE
--
--   · news / events / opportunities — « exposition demandee, parution
--     refusee ». `landing_visibility` vaut 'hidden' par defaut : le
--     passer a 'visible' est une decision explicite du CMS. Quand la
--     projection ecarte quand meme le contenu, l'ecran ment et personne
--     ne le sait — c'est exactement le bug du porteur corrige en 0137
--     (« j'ai mis sur le landing, mais ca ne s'affiche pas »). Le meme
--     predicat que la projection est reutilise
--     (`private.landing_event_block_reason`,
--     `private.landing_opportunity_block_reason`), donc le compteur ne
--     peut pas diverger de la vitrine. Ces contenus arrivent de
--     l'administration ou d'une proposition de membre validee (0132) :
--     c'est bien « ce qui est soumis depuis un profil ou l'admin » qui
--     finit compte ici, du seul point de vue dont le CMS repond.
--
--   · pillars / organizations — un visuel manquant fait un TROU dans la
--     page. `private.landing_media()` ne renvoie rien pour un media
--     absent, supprime ou hors du bucket `landing-media`, et
--     `get_landing_organizations()` ecarte purement une organisation
--     publiee sans logo : elle est cochee dans le CMS et introuvable sur
--     la vitrine. Rien d'autre ne le signale.
--
--   · featured_profile — 0 ou 1, jamais davantage : soit l'encart « ISE
--     du jour » a quelqu'un a montrer, soit il n'en a pas.
--     `get_landing_featured_profile()` remonte au dernier ISE publie
--     ENCORE eligible ; un jour sans selection n'est donc pas un trou, et
--     compter « pas d'ISE aujourd'hui » aurait affiche une pastille
--     permanente alors que la rotation peut etre pluri-journaliere
--     (0121). Le trou reel, c'est l'absence totale de candidat eligible :
--     la section disparait de la page. Le meme parcours que la projection
--     est rejoue, masquage volontaire de section compris (une section
--     cachee expres n'attend personne).
--
--   · schedule — une programmation en echec. `publish_scheduled_cms_content()`
--     bascule la ligne en 'failed' avec son `last_error` ; seule une main
--     humaine l'en sort. Les echeances « en retard » ne sont PAS comptees :
--     l'ordonnanceur passe toutes les dix minutes, elles se resorbent
--     seules ou deviennent des echecs. Compter un etat transitoire aurait
--     fait clignoter la pastille sans qu'il y ait rien a faire.
--
-- REGLE « AUCUNE PASTILLE DECORATIVE » (MASTER PROMPT §113)
--   Une entree sans file n'a PAS de cle : un compteur toujours nul est du
--   bruit. Sont donc absents, et pour des raisons verifiees une par une :
--
--     · Tableau de bord et Apercu — des lectures. Aucune decision n'y
--       attend, et le tableau de bord porte deja ses propres alertes.
--
--     · Carrousel — les deux seules anomalies possibles sont refermees
--       toutes les dix minutes par l'ordonnanceur `cms_expire_content`
--       (job actif) : la slide dont la fenetre est echue et la slide
--       sponsorisee dont la campagne ne tourne plus y passent en
--       'expired'. Le reste (`draft`, `scheduled`) est un travail en cours
--       assume, pas une file recue.
--
--     · Sections accueil — les neuf lignes de `cms_sections` sont en
--       brouillon PAR CONCEPTION : la vitrine retombe alors sur les
--       titres de `fr.public` (commente dans `apps/web/src/app/page.tsx`).
--       Une pastille y afficherait 9 en permanence pour un etat voulu.
--
--     · Partenaires — une campagne terminee est passee en 'expired' par
--       le meme ordonnanceur ; une campagne qui tourne encore n'attend
--       personne, elle s'arretera d'elle-meme. « Expire dans sept jours »
--       reste une alerte d'information du tableau de bord, ce n'est pas
--       une tache.
--
--     · Mediatheque — la piste « medias sans alternative textuelle » a
--       ete verifiee et ecartee : `cms_media_assets.alt_text` est NOT NULL
--       avec un CHECK d'au moins trois caracteres. Un media sans
--       alternative NE PEUT PAS EXISTER, le compteur serait
--       structurellement nul. Quant aux « originaux sans variante », les
--       treize originaux en base sont dans ce cas et le resteront : les
--       tailles sont produites a la volee par le rendu d'image, pas
--       deposees a la main.
--
--     · File « A la une » — `private.apply_landing_queue()` force
--       `landing_visibility = 'visible'` a l'entree en passage. Un passage
--       EN COURS dont la cible ne parait pas est donc DEJA compte sous son
--       type de contenu ; le compter ici serait le meme probleme deux fois
--       (meme raisonnement que les appels au reseau cote administration).
--       Et un passage A VENIR n'attend rien : il n'a pas commence, et rien
--       ne dit que la cible ne sera pas prete le jour dit — un tel chiffre
--       serait une estimation (MASTER PROMPT §98).
--
-- PERMISSIONS
--   Chaque compteur est enferme dans la permission qui autorise le geste
--   correcteur, pas celle qui ouvre l'ecran :
--     · exposition d'un contenu   -> `cms.publish` (c'est la permission
--       exigee par `set_landing_exposure()` pour changer la visibilite) ;
--     · pilier / organisation     -> `cms.edit` (`set_landing_pillar()`,
--       `set_landing_organization()`) ;
--     · ISE du jour               -> `cms.featured_profile.manage` ;
--     · programmation             -> `cms.schedule` (politique d'ecriture
--       de `cms_publication_schedule`).
--   Une file hors permission n'est pas renvoyee a zero : elle n'est pas
--   renvoyee DU TOUT, l'appelant ne peut donc pas deduire son existence.
--   La verification est ici, en base ; masquer la pastille cote interface
--   ne protegerait rien.
--
--   Comme `admin_nav_counters()`, l'absence totale de permission ne leve
--   pas d'erreur : cette fonction orne une navigation presente sur tous
--   les ecrans, et la garde d'entree (`requireCmsAccess`) a deja fait son
--   travail. Un objet vide ne revele rien.
--
-- COUT
--   Sept comptages, tous adosses a un index et bornes a la matiere
--   reellement exposee :
--     · les trois contenus            — index partiels crees ci-dessous,
--       du poids exact du nombre de contenus marques « visibles » ;
--     · piliers                       — quatre lignes, cle primaire ;
--     · organisations landing         — `cms_landing_organizations_published_idx` ;
--     · ISE du jour                   — `cms_featured_profile_history_date_uidx`,
--       parcours arrete au premier candidat eligible ;
--     · programmations en echec       — index partiel cree ci-dessous.
--   Aucun comptage ne parcourt une table entiere.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- Index manquants. Les index `*_landing_idx` existants ne couvrent que
-- les lignes qui PARAISSENT (visible + publie + non supprime) : ils sont
-- inutilisables ici, puisqu'on cherche precisement leur complement. Ces
-- index-ci portent sur « marque visible », c'est-a-dire sur l'ensemble
-- des contenus que le CMS a decide d'exposer — une poignee de lignes.
-- ---------------------------------------------------------------------
create index if not exists news_landing_exposed_idx
  on public.news (id)
  where landing_visibility = 'visible' and deleted_at is null;

create index if not exists events_landing_exposed_idx
  on public.events (id)
  where landing_visibility = 'visible' and deleted_at is null;

create index if not exists opportunities_landing_exposed_idx
  on public.opportunities (id)
  where landing_visibility = 'visible' and deleted_at is null;

create index if not exists cms_publication_schedule_failed_idx
  on public.cms_publication_schedule (updated_at desc)
  where status = 'failed';


-- ---------------------------------------------------------------------
-- cms_nav_counters — un aller-retour, une cle par entree autorisee
-- ---------------------------------------------------------------------
create or replace function public.cms_nav_counters()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb := '{}'::jsonb;
  v_day constant date := (now() at time zone 'utc')::date;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- Exposition demandee, parution refusee. Le predicat est celui de la
  -- projection : le compteur ne peut pas contredire la vitrine.
  if private.has_permission('cms.publish') then
    v := v || jsonb_build_object('news', (
      select count(*) from public.news n
       where n.deleted_at is null
         and n.landing_visibility = 'visible'
         and (n.editorial_status is distinct from 'published'
              or n.visibility is distinct from 'members'
              or n.published_at is null
              or n.published_at > now()
              or n.duplicate_of_news_id is not null
              or private.landing_is_excluded('news', 'news', n.id))));

    v := v || jsonb_build_object('events', (
      select count(*) from public.events e
       where e.deleted_at is null
         and e.landing_visibility = 'visible'
         and private.landing_event_block_reason(
               e.status, e.cancelled_at, e.visibility, e.landing_visibility,
               e.starts_at, e.ends_at,
               private.landing_is_excluded('events', 'event', e.id)) is not null));

    v := v || jsonb_build_object('opportunities', (
      select count(*) from public.opportunities o
       where o.deleted_at is null
         and o.landing_visibility = 'visible'
         and private.landing_opportunity_block_reason(
               o.status, o.visibility, o.landing_visibility, o.moderation_status,
               o.published_at, o.deadline,
               private.landing_is_excluded('opportunities', 'opportunity', o.id))
             is not null));
  end if;

  -- Visuels manquants : un trou dans la page d'accueil. `landing_media()`
  -- ne renvoie rien pour un media absent, supprime ou hors bucket public.
  if private.has_permission('cms.edit') then
    v := v || jsonb_build_object('pillars', (
      select count(*) from public.cms_pillars p
       where private.landing_media(p.media_id) is null));

    -- Une organisation cochee « publiee » mais sans logo affichable est
    -- ecartee sans un mot par `get_landing_organizations()`.
    v := v || jsonb_build_object('organizations', (
      select count(*) from public.cms_landing_organizations lo
       join public.organizations org on org.id = lo.organization_id
       where lo.is_published
         and coalesce(private.landing_media(lo.media_id),
                      private.landing_media_by_path(org.logo_path)) is null));
  end if;

  -- ISE du jour : 0 ou 1. Le trou n'est pas « aucune selection
  -- aujourd'hui » (la projection remonte au dernier ISE encore eligible),
  -- c'est « plus aucun candidat eligible du tout » — la section quitte
  -- alors la page. Une section masquee volontairement n'attend personne.
  if private.has_permission('cms.featured_profile.manage') then
    v := v || jsonb_build_object('featured_profile',
      case
        when private.landing_section_hidden('featured_profile') then 0
        when exists (select 1 from public.cms_featured_profile_history h
                      where h.status = 'published'
                        and h.featured_date <= v_day
                        and private.featured_profile_eligible(h.profile_id, v_day))
          then 0
        else 1
      end);
  end if;

  -- Programmations en echec : `last_error` est renseigne, l'ordonnanceur
  -- ne les reprendra pas.
  if private.has_permission('cms.schedule') then
    v := v || jsonb_build_object('schedule', (
      select count(*) from public.cms_publication_schedule s
       where s.status = 'failed'));
  end if;

  return v;
end
$$;

revoke all on function public.cms_nav_counters() from public, anon;
grant execute on function public.cms_nav_counters() to authenticated;

comment on function public.cms_nav_counters() is
  'Compteurs d''ECART D''EXPOSITION du menu du CMS, une cle par entree de menu concernee : contenu marque visible que la vitrine ecarte, visuel manquant, encart ISE du jour sans candidat eligible, programmation en echec. '
  'Un seul aller-retour par rendu du gabarit. Chaque cle est conditionnee par la permission du geste correcteur (cms.publish, cms.edit, cms.featured_profile.manage, cms.schedule) : une file hors permission est absente du resultat, pas renvoyee a zero. '
  'Les predicats sont ceux des projections landing (0137) : le menu ne peut pas contredire la page d''accueil.';

commit;
