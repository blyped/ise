-- =====================================================================
-- 0123_featured_profile_public_photo_rule
--
-- ALIGNEMENT DE LA REGLE « PHOTO » DE L'ISE DU JOUR SUR LE PORTRAIT
-- PUBLIC CONSENTI, ET DIAGNOSTIC HONNETE DU VIVIER.
--
-- LE CONSTAT, MESURE ET NON SUPPOSE
--   Sur les 260 profils de la base :
--     * 0 possede un `avatar_path` ;
--     * 0 possede un `public_photo_path` ;
--     * 0 a coche `allow_public_photo` ;
--     * 0 a coche `allow_public_feature` ;
--     * 0 a renseigne `public_summary`.
--
--   La regle active portait `require_avatar = true`. Elle visait
--   `ise_profiles.avatar_path`, c'est-a-dire le bucket PRIVE `avatars`
--   (D-73, D-134) — une colonne qui n'a jamais ete alimentee, et qui de
--   toute facon ne doit JAMAIS servir a publier quoi que ce soit sur la
--   vitrine publique. La regle exigeait donc un objet que la vitrine
--   n'aurait pas eu le droit d'afficher : elle etait incoherente autant
--   qu'inatteignable.
--
--   Depuis 0120, la seule photo publiable est le portrait depose dans le
--   bucket PUBLIC `landing-media` ET couvert par le consentement dedie
--   `allow_public_photo`. C'est sur ce couple que la regle doit porter.
--
-- CE QUE CETTE MIGRATION NE PRETEND PAS FAIRE
--   Corriger la regle NE REND PERSONNE ELIGIBLE AUJOURD'HUI. Le vivier
--   restera a zero tant que des membres n'auront pas rempli leur vitrine
--   publique, parce que `private.featured_profile_eligible()` (livree par
--   0120) exige AUSSI, en dur et hors regles, `allow_public_feature` et un
--   `public_summary` non vide — deux conditions aujourd'hui a zero.
--   Ces deux exigences sont deliberees : elles protegent le consentement.
--   Aucune n'est contournee ici.
--
--   Le vivier vide ne casse rien : `public.get_landing_featured_profile()`
--   renvoie NULL, et la vitrine bascule sur `FeaturedProfileFallback`.
--   Constate dans le code, pas suppose.
--
-- CE QU'ELLE AJOUTE DONC : de quoi COMPRENDRE le vide plutot que de le
-- subir — un rapport chiffre, critere par critere (section 4).
--
-- D-128 : aucun statut editorial n'est touche.
-- D-129 : aucune tache n'est ajoutee, donc rien de nouveau a declarer
--         dans `get_cms_automation_status()`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. La regle porte desormais sur le portrait public consenti
--
--    `require_avatar` n'est pas supprimee : d'autres migrations et le
--    back-office la lisent encore, et une suppression de colonne casserait
--    `to_jsonb(r)` chez les appelants existants. Elle est NEUTRALISEE et
--    documentee comme telle — plus aucune fonction ne la consulte apres
--    cette migration.
-- ---------------------------------------------------------------------

alter table public.cms_featured_profile_rules
  add column if not exists require_public_photo boolean not null default true;

comment on column public.cms_featured_profile_rules.require_public_photo is
  'Exige un portrait publie dans le bucket public ET le consentement dedie allow_public_photo (0123).';

comment on column public.cms_featured_profile_rules.require_avatar is
  'OBSOLETE depuis 0123 : visait avatar_path (bucket prive), jamais alimente et non publiable. Remplacee par require_public_photo. Plus aucune fonction ne lit cette colonne.';

-- La regle active heritait de `true` sur une exigence devenue sans objet.
-- On la met a `false` pour que sa valeur ne mente plus a la lecture.
update public.cms_featured_profile_rules
   set require_avatar = false
 where require_avatar;

-- ---------------------------------------------------------------------
-- 2. Eligibilite : UNE SEULE clause change
--
--    Le corps de `private.featured_profile_eligible()` est celui livre par
--    0120. Le seul remplacement est la ligne « avatar » :
--
--      AVANT : (not r.require_avatar or p.avatar_path is not null)
--      APRES : (not r.require_public_photo
--               or (p.public_photo_path is not null and p.allow_public_photo))
--
--    Tout le reste — consentement de mise en avant, resume public, compte
--    non de test, promotion, expertise ou fonction, signalements ouverts,
--    suspensions, exclusions temporaires (D-122) — est reconduit a
--    l'identique. Le consentement `allow_public_photo` est exige EN PLUS
--    du chemin de la photo : un fichier depose puis un consentement retire
--    doit redevenir inutilisable immediatement.
-- ---------------------------------------------------------------------

create or replace function private.featured_profile_eligible(
  p_profile_id uuid,
  p_for_date   date default null)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  with d as (select coalesce(p_for_date, (now() at time zone 'utc')::date) as day),
       rules as (select * from public.cms_featured_profile_rules where is_active limit 1)
  select exists (
    select 1
    from public.ise_profiles p, d, rules r
    where p.id = p_profile_id
      and p.deleted_at is null
      and p.profile_status = 'active'
      and p.allow_public_feature
      and p.public_summary is not null
      and char_length(btrim(p.public_summary)) > 0
      and char_length(btrim(coalesce(nullif(btrim(p.display_name), ''),
                                     p.first_name || ' ' || p.last_name))) > 0
      and not p.is_test_account
      and (not r.require_claimed_profile or p.claim_status = 'claimed')
      and (not r.require_promotion       or p.promotion_id is not null)
      -- 0123 — portrait PUBLIC consenti, et non plus l'avatar prive.
      and (not r.require_public_photo
           or (p.public_photo_path is not null and p.allow_public_photo))
      and (not r.require_expertise_or_position
           or p.current_position is not null
           or exists (select 1 from public.profile_expertise_areas pea where pea.profile_id = p.id))
      and not exists (
        select 1 from public.reports rep
        where rep.target_type = 'profile' and rep.target_id = p.id
          and rep.status in ('open', 'reviewing'))
      and not exists (
        select 1 from public.moderation_actions ma
        where ma.target_type = 'profile' and ma.target_id = p.id
          and ma.action_type in ('temporary_suspension', 'account_suspension')
          and (ma.suspension_until is null or ma.suspension_until > now()))
      and not exists (
        select 1 from public.cms_content_overrides o
        where o.section_key = 'featured_profile' and o.override_kind = 'exclude'
          and o.entity_type = 'profile' and o.entity_id = p.id
          and o.starts_at <= now() and (o.ends_at is null or o.ends_at > now()))
  )
$$;

comment on function private.featured_profile_eligible(uuid, date) is
  'Eligibilite d''un profil a l''ISE du jour. Depuis 0123, la regle photo porte sur le portrait public consenti (public_photo_path + allow_public_photo), plus sur avatar_path.';

revoke all on function private.featured_profile_eligible(uuid, date) from public, anon, authenticated;
grant execute on function private.featured_profile_eligible(uuid, date) to service_role;

-- ---------------------------------------------------------------------
-- 3. Mise a jour de la regle active
--
--    On ne force PAS `require_public_photo` a false pour « debloquer » le
--    vivier. Le porteur veut une photo dans l'encart : desactiver
--    l'exigence produirait des mises en avant sans visuel, ce qui n'est
--    pas ce qui a ete demande. La valeur reste `true` (defaut de colonne),
--    et le rapport de la section 4 dit pourquoi le vivier est vide.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 4. Rapport d'eligibilite
--
--    « 0 profil eligible » n'est pas une information exploitable : le
--    porteur ne peut pas savoir s'il manque des consentements, des
--    resumes ou des photos. Ce rapport compte, critere par critere,
--    combien de profils franchissent chaque etape — donc ce qu'il faut
--    aller chercher pour que la selection automatique se remette a
--    produire.
--
--    Les criteres sont evalues INDEPENDAMMENT les uns des autres sur le
--    socle « profil actif, non supprime, non de test » : on veut savoir
--    ce que chaque exigence coute, pas construire un entonnoir dont
--    l'ordre serait arbitraire.
-- ---------------------------------------------------------------------

create or replace function public.get_featured_profile_eligibility_report()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  v_rules public.cms_featured_profile_rules%rowtype;
  v_day   date := (now() at time zone 'utc')::date;
  v       jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  if not (private.has_permission('cms.read') or private.has_permission('ops.read')) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_rules from public.cms_featured_profile_rules where is_active limit 1;

  select jsonb_build_object(
           'read_at', now(),
           'day',     v_day,
           'rules', jsonb_build_object(
             'require_claimed_profile',       coalesce(v_rules.require_claimed_profile, false),
             'require_promotion',             coalesce(v_rules.require_promotion, false),
             'require_public_photo',          coalesce(v_rules.require_public_photo, false),
             'require_expertise_or_position', coalesce(v_rules.require_expertise_or_position, false),
             'rotation_interval_days',        coalesce(v_rules.rotation_interval_days, 1),
             'is_automation_enabled',         coalesce(v_rules.is_automation_enabled, false)),
           'criteria', (
             select jsonb_build_object(
               'base',                  count(*),
               'allow_public_feature',  count(*) filter (where p.allow_public_feature),
               'public_summary',        count(*) filter (
                                          where p.public_summary is not null
                                            and char_length(btrim(p.public_summary)) > 0),
               'public_photo',          count(*) filter (
                                          where p.public_photo_path is not null
                                            and p.allow_public_photo),
               'claimed',               count(*) filter (where p.claim_status = 'claimed'),
               'promotion',             count(*) filter (where p.promotion_id is not null),
               'expertise_or_position', count(*) filter (
                                          where p.current_position is not null
                                             or exists (select 1
                                                          from public.profile_expertise_areas pea
                                                         where pea.profile_id = p.id)))
               from public.ise_profiles p
              where p.deleted_at is null
                and p.profile_status = 'active'
                and not p.is_test_account),
           'eligible_count', (
             select count(*) from public.ise_profiles p
              where p.deleted_at is null
                and private.featured_profile_eligible(p.id, v_day)))
    into v;

  return v;
end
$$;

comment on function public.get_featured_profile_eligibility_report() is
  'Compte, critere par critere, combien de profils franchissent chaque exigence de l''ISE du jour. Explique un vivier vide au lieu de le constater (0123).';

revoke all on function public.get_featured_profile_eligibility_report() from public, anon;
grant execute on function public.get_featured_profile_eligibility_report() to authenticated, service_role;
