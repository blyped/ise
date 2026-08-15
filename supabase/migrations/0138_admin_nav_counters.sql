-- =====================================================================
-- 0138 — COMPTEURS DES FILES D'ATTENTE DU MENU D'ADMINISTRATION
--
-- POURQUOI
--   Le menu du back-office ne disait pas OU il y avait du travail. Une
--   actualite proposee par un ISE (0132), une reclamation de profil, une
--   demande de consortium restaient invisibles tant qu'on n'ouvrait pas
--   l'ecran concerne. `admin_nav_counters()` renvoie, EN UN SEUL
--   ALLER-RETOUR, le nombre d'elements « en attente d'une decision de
--   l'administration » pour chaque entree de menu qui possede une telle
--   file. Le gabarit `AdminShell` l'appelle une fois par rendu.
--
-- REGLE « AUCUNE PASTILLE DECORATIVE » (MASTER PROMPT §113)
--   Une entree sans file d'attente n'a PAS de cle dans le resultat : une
--   pastille eternellement a zero est du bruit. Sont donc absents :
--     · Tableau de bord, Analytics, Parametres, Journal d'audit — aucune
--       decision n'y est en attente, ce sont des lectures ;
--     · Membres & profils — la liste des doublons potentiels n'est pas
--       une file recue mais un calcul de similarite a la demande ;
--     · Profils incomplets — arriere-plan permanent de plusieurs
--       centaines de fiches, pas un flux de nouveautes ;
--     · Registre des dons — un don encaisse n'attend rien de personne ;
--     · Appels au reseau — un appel est publie SANS revue prealable ;
--       sa moderation est reactive et passe par les signalements, deja
--       comptes sous « Moderation » (`admin_list_reports` couvre tous
--       les types de cible, y compris `network_call`). Une pastille sur
--       les appels recompterait les memes signalements deux fois.
--
-- PERMISSIONS
--   Chaque compteur est enferme dans son `private.has_permission()`.
--   Une file hors permission n'est pas renvoyee a zero : elle n'est pas
--   renvoyee DU TOUT — l'appelant ne peut donc pas deduire qu'elle
--   existe. Masquer la pastille cote interface ne protegerait rien ;
--   c'est ici que la decision se prend.
--
--   Contrairement a `admin_dashboard_counters()` (0076), l'absence
--   TOTALE de permission ne leve pas d'erreur : cette fonction alimente
--   un ornement de la navigation present sur tous les ecrans, la refuser
--   transformerait chaque rendu en erreur alors que la garde d'entree du
--   back-office (`requireAdminAccess`) a deja fait son travail. Un objet
--   vide ne revele rien.
--
-- COUT
--   Dix comptages pour neuf files (les promotions en cumulent deux),
--   tous adosses a un index :
--     · news / events          — `idx_news_proposals_pending`,
--                                `idx_events_proposals_pending` (0132),
--                                index partiels taille de la file ;
--     · opportunites           — `opportunities_moderation_idx` (partiel
--                                sur moderation_status = 'pending') ;
--     · signalements           — `reports_status_idx` (partiel ouvert) ;
--     · tickets                — `support_tickets_open_idx` (partiel) +
--                                `support_messages_ticket_idx` pour le
--                                NOT EXISTS ;
--     · reclamations           — `profile_claims_status_idx` ;
--     · suggestions de promo   — `promotion_suggestions_status_idx` ;
--     · publications de commu. — `community_posts_moderation_idx` ;
--     · consortiums et membres manquants — index partiels crees
--       ci-dessous : leurs seuls index existants sont prefixes par
--       `project_id` / `promotion_id`, inutilisables pour un comptage
--       global par statut.
--   Aucun comptage ne parcourt une table entiere ; chacun ne visite que
--   les lignes de sa propre file.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Index manquants pour les deux files comptees globalement pour la
-- premiere fois. Partiels : ils ne pesent que le poids de la file.
-- ---------------------------------------------------------------------
create index if not exists consortium_requests_pending_idx
  on public.consortium_requests (status)
  where status in ('submitted', 'reviewing');

create index if not exists missing_member_suggestions_pending_idx
  on public.missing_member_suggestions (status)
  where status in ('submitted', 'reviewing');


-- ---------------------------------------------------------------------
-- admin_nav_counters — un aller-retour, une cle par file autorisee
-- ---------------------------------------------------------------------
create or replace function public.admin_nav_counters()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb := '{}'::jsonb;
  v_open_tickets constant text[] :=
    array['open', 'acknowledged', 'in_progress', 'waiting_user'];
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- Reclamations de profil a instruire (SA-006).
  if private.has_permission('profiles.verify') then
    v := v || jsonb_build_object('claims', (
      select count(*) from public.profile_claims c
       where c.status in ('submitted', 'under_review')));
  end if;

  -- Promotions : « ma promotion n'existe pas » (ISE-009) et membres
  -- signales manquants. Les deux attendent la meme decision humaine et
  -- vivent sous la meme entree de menu : un seul total.
  if private.has_permission('promotions.manage') then
    v := v || jsonb_build_object('promotions',
      (select count(*) from public.promotion_suggestions s
        where s.status in ('submitted', 'under_review'))
      + (select count(*) from public.missing_member_suggestions m
          where m.status in ('submitted', 'reviewing')));
  end if;

  -- Opportunites en attente de moderation (SA-019).
  if private.has_permission('opportunities.manage') then
    v := v || jsonb_build_object('opportunities', (
      select count(*) from public.opportunities o
       where o.deleted_at is null
         and o.moderation_status = 'pending'));
  end if;

  -- Demandes de participation en consortium a examiner (SA-025).
  if private.has_permission('projects.manage') then
    v := v || jsonb_build_object('projects', (
      select count(*) from public.consortium_requests cr
       where cr.status in ('submitted', 'reviewing')));
  end if;

  -- Publications de communaute en pre-approbation (SA-029). Le statut
  -- 'flagged' n'est produit par aucune fonction : le compter ajouterait
  -- une lecture pour un zero certain.
  if private.has_permission('communities.manage') then
    v := v || jsonb_build_object('communities', (
      select count(*) from public.community_posts p
       where p.deleted_at is null
         and p.status = 'pending_review'));
  end if;

  -- Evenements proposes par les ISE (0132).
  if private.has_permission('events.manage') then
    v := v || jsonb_build_object('events', (
      select count(*) from public.events e
       where e.deleted_at is null
         and e.created_by_profile_id is not null
         and e.status = 'pending_review'));
  end if;

  -- Actualites proposees par les ISE (0132) — la demande d'origine.
  if private.has_permission('content.publish') then
    v := v || jsonb_build_object('news', (
      select count(*) from public.news n
       where n.deleted_at is null
         and n.submitted_by_profile_id is not null
         and n.editorial_status = 'submitted'));
  end if;

  -- Signalements ouverts, tous types de cible confondus (SA-018).
  if private.has_permission('profiles.moderate') then
    v := v || jsonb_build_object('moderation', (
      select count(*) from public.reports r
       where r.status in ('open', 'reviewing')));
  end if;

  -- Tickets encore ouverts qui n'ont recu AUCUNE reponse publique d'un
  -- agent : meme definition que `unanswered_count` de
  -- `admin_support_dashboard` (0131), donc meme chiffre que le filtre
  -- « Sans reponse » de l'ecran SA-038. Un ticket deja repondu n'attend
  -- plus l'administration.
  if private.has_permission('support.manage') then
    v := v || jsonb_build_object('support', (
      select count(*) from public.support_tickets t
       where t.status = any (v_open_tickets)
         and not exists (select 1 from public.support_messages m
                          where m.ticket_id = t.id
                            and m.author_kind = 'agent'
                            and m.is_internal_note = false)));
  end if;

  return v;
end
$$;

revoke all on function public.admin_nav_counters() from public, anon;
grant execute on function public.admin_nav_counters() to authenticated;

comment on function public.admin_nav_counters() is
  'Compteurs des files en attente d''une decision de l''administration, une cle par entree de menu concernee. '
  'Un seul aller-retour par rendu du gabarit. Chaque cle est conditionnee par la permission qui donne acces a la file : '
  'une file hors permission est absente du resultat, pas renvoyee a zero. Aucun chiffre estime (MASTER PROMPT §98).';
