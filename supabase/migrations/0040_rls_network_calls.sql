-- =====================================================================
-- 0040_rls_network_calls
-- Ouverture des politiques RLS du lot « Appels au reseau » (0007).
--
-- Principe : un appel n'est visible que par son AUDIENCE REELLE, jamais
-- par « tout membre authentifie ». L'audience se compose de trois filtres
-- cumulatifs :
--   1. le niveau de visibilite D-73 (`members` / `connections` / `promotion`
--      / `private`) ;
--   2. le ciblage explicite (`network_call_audience_profiles` et
--      `network_call_audience_promotions`) : s'il existe au moins une ligne
--      de ciblage, l'appel n'est visible QUE par les cibles ;
--   3. le blocage (`profile_blocks`), evalue AVANT tout niveau de
--      visibilite (D-73) : un bloqueur disparait integralement.
--
-- Ecriture : l'auteur ecrit son appel TANT QU'IL EST EN BROUILLON. Aucune
-- politique UPDATE ne touche un appel publie : `publish_network_call`,
-- `transition_network_call`, `close_network_call` et
-- `expire_stale_network_calls` sont les seuls chemins de transition
-- (MASTER PROMPT §53, §100 ; db-conventions §7).
--
-- Reference : MASTER PROMPT §11, §15, §17, §47, §53, §80 ; D-31, D-72, D-73.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------

-- Le membre courant appartient-il a cette promotion ?
-- SECURITY DEFINER (motif A) : lit `ise_profiles` et `promotion_memberships`
-- sans declencher leurs propres politiques. Renvoie un booleen.
create or replace function private.is_in_promotion(p_promotion bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_promotion is not null
     and private.current_profile_id() is not null
     and (
       exists (
         select 1 from public.ise_profiles p
         where p.id = private.current_profile_id()
           and p.promotion_id = p_promotion
       )
       or exists (
         select 1 from public.promotion_memberships m
         where m.promotion_id = p_promotion
           and m.profile_id = private.current_profile_id()
           and m.membership_status in ('active', 'verified')
       )
     )
$$;
revoke all on function private.is_in_promotion(bigint) from public, anon;
grant execute on function private.is_in_promotion(bigint) to authenticated;
comment on function private.is_in_promotion(bigint) is
  'Appartenance du membre courant a une promotion (colonne canonique ou adhesion active). Booleen.';

-- Suis-je l'auteur de cet appel ?
create or replace function private.is_network_call_author(p_call uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_call is not null
     and private.current_profile_id() is not null
     and exists (
       select 1 from public.network_calls c
       where c.id = p_call
         and c.author_profile_id = private.current_profile_id()
         and c.deleted_at is null
     )
$$;
revoke all on function private.is_network_call_author(uuid) from public, anon;
grant execute on function private.is_network_call_author(uuid) to authenticated;
comment on function private.is_network_call_author(uuid) is
  'Auteur d''un appel au reseau. SECURITY DEFINER motif A : evite la recursion de politique sur network_calls.';

-- Cet appel est-il dans mon perimetre ?
create or replace function private.can_see_network_call(p_call uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_call is not null
     and private.current_profile_id() is not null
     and exists (
       select 1
       from public.network_calls c
       where c.id = p_call
         and (
           -- L'auteur voit toujours son appel, y compris en brouillon.
           c.author_profile_id = private.current_profile_id()
           -- La moderation voit tout : c'est l'objet meme de la permission.
           or private.has_permission('calls.moderate')
           or (
             c.deleted_at is null
             -- Blocage evalue AVANT tout niveau de visibilite (D-73).
             and not private.is_blocked_between(c.author_profile_id, private.current_profile_id())
             -- Ni brouillon, ni annule, ni retire par la moderation.
             and c.status in ('active', 'paused', 'resolved', 'closed', 'expired')
             and private.is_active_member()
             -- 1. Niveau de visibilite D-73.
             and (
               case c.visibility
                 when 'members'     then true
                 when 'connections' then private.is_connected_to(c.author_profile_id)
                 when 'promotion'   then private.shares_promotion_with(c.author_profile_id)
                 else false                       -- 'private' : personne d'autre
               end
             )
             -- 2. Ciblage explicite : s'il existe, il restreint.
             and (
               (
                 not exists (select 1 from public.network_call_audience_profiles ap
                             where ap.call_id = c.id)
                 and not exists (select 1 from public.network_call_audience_promotions aq
                                 where aq.call_id = c.id)
               )
               or exists (select 1 from public.network_call_audience_profiles ap
                          where ap.call_id = c.id
                            and ap.profile_id = private.current_profile_id())
               or exists (select 1 from public.network_call_audience_promotions aq
                          where aq.call_id = c.id
                            and private.is_in_promotion(aq.promotion_id))
             )
           )
         )
     )
$$;
revoke all on function private.can_see_network_call(uuid) from public, anon;
grant execute on function private.can_see_network_call(uuid) to authenticated;
comment on function private.can_see_network_call(uuid) is
  'Audience reelle d''un appel au reseau : visibilite D-73 + ciblage explicite + blocage. Booleen.';

-- ---------------------------------------------------------------------
-- network_calls
-- ---------------------------------------------------------------------
drop policy if exists network_calls_select on public.network_calls;
create policy network_calls_select on public.network_calls
  for select to authenticated
  using (private.can_see_network_call(id));

drop policy if exists network_calls_insert_own on public.network_calls;
create policy network_calls_insert_own on public.network_calls
  for insert to authenticated
  with check (
    author_profile_id = private.current_profile_id()
    and private.is_active_member()
    and status = 'draft'
  );

-- Le brouillon seul est modifiable directement. `status = 'draft'` figure
-- dans USING **et** dans WITH CHECK : la ligne doit etre un brouillon avant
-- et apres, donc aucune transition d'etat ne passe par cette politique.
drop policy if exists network_calls_update_draft on public.network_calls;
create policy network_calls_update_draft on public.network_calls
  for update to authenticated
  using (author_profile_id = private.current_profile_id() and status = 'draft')
  with check (author_profile_id = private.current_profile_id() and status = 'draft');

drop policy if exists network_calls_delete_draft on public.network_calls;
create policy network_calls_delete_draft on public.network_calls
  for delete to authenticated
  using (author_profile_id = private.current_profile_id() and status = 'draft');

drop policy if exists network_calls_moderate on public.network_calls;
create policy network_calls_moderate on public.network_calls
  for update to authenticated
  using (private.has_permission('calls.moderate'))
  with check (private.has_permission('calls.moderate'));

-- ---------------------------------------------------------------------
-- Criteres et ciblage : lisibles avec l'appel, ecrits par son auteur.
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['network_call_skills', 'network_call_tools',
                           'network_call_languages', 'network_call_countries',
                           'network_call_help_types',
                           'network_call_audience_promotions',
                           'network_call_audience_profiles'] loop
    execute format($p$
      drop policy if exists %1$I on public.%2$I;
      create policy %1$I on public.%2$I
        for select to authenticated
        using (private.can_see_network_call(call_id));
    $p$, t || '_select', t);

    execute format($p$
      drop policy if exists %1$I on public.%2$I;
      create policy %1$I on public.%2$I
        for all to authenticated
        using (private.is_network_call_author(call_id))
        with check (private.is_network_call_author(call_id));
    $p$, t || '_write_author', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------
-- network_call_matches
--
-- Le score de pertinence ne doit atteindre AUCUN client (MASTER PROMPT §15,
-- D-72) : la RLS filtre des lignes, pas des colonnes, donc `score` et
-- `component_scores` sont proteges par un PRIVILEGE DE COLONNE, technique
-- de 0028. Le controle `security_baseline_violations()` est etendu en 0050
-- pour que toute reapparition fasse echouer la CI.
-- ---------------------------------------------------------------------
do $$
declare
  v_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into v_cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'network_call_matches'
    and column_name not in ('score', 'component_scores');
  revoke select, insert, update on public.network_call_matches from authenticated;
  execute format('grant select (%s) on public.network_call_matches to authenticated', v_cols);
end
$$;

comment on column public.network_call_matches.score is
  'Score PRIVE (MASTER PROMPT §15, D-72). Privilege de colonne retire a `authenticated`.';

drop policy if exists network_call_matches_select on public.network_call_matches;
create policy network_call_matches_select on public.network_call_matches
  for select to authenticated
  using (
    profile_id = private.current_profile_id()
    or private.is_network_call_author(call_id)
  );

-- ---------------------------------------------------------------------
-- Reponses a un appel
-- ---------------------------------------------------------------------
drop policy if exists network_call_responses_select on public.network_call_responses;
create policy network_call_responses_select on public.network_call_responses
  for select to authenticated
  using (
    author_profile_id = private.current_profile_id()
    or private.is_network_call_author(call_id)
    or private.has_permission('calls.moderate')
  );

drop policy if exists network_call_responses_create on public.network_call_responses;
create policy network_call_responses_create on public.network_call_responses
  for insert to authenticated
  with check (
    author_profile_id = private.current_profile_id()
    and private.is_active_member()
    and private.can_see_network_call(call_id)
    and status = 'new'
  );

-- Le repondeur corrige sa reponse tant qu'elle n'a pas ete triee.
drop policy if exists network_call_responses_update_own on public.network_call_responses;
create policy network_call_responses_update_own on public.network_call_responses
  for update to authenticated
  using (author_profile_id = private.current_profile_id() and status = 'new')
  with check (author_profile_id = private.current_profile_id() and status = 'new');

-- Le triage des reponses appartient a l'auteur de l'appel : c'est son plan
-- de travail, pas une machine d'etats reglementaire (aucune fonction
-- atomique n'existe pour `network_call_responses.status`).
drop policy if exists network_call_responses_triage on public.network_call_responses;
create policy network_call_responses_triage on public.network_call_responses
  for update to authenticated
  using (private.is_network_call_author(call_id))
  with check (private.is_network_call_author(call_id));

drop policy if exists network_call_responses_delete_own on public.network_call_responses;
create policy network_call_responses_delete_own on public.network_call_responses
  for delete to authenticated
  using (author_profile_id = private.current_profile_id() and status = 'new');

-- ---------------------------------------------------------------------
-- Recommandations portees par une reponse
--
-- La personne recommandee ne sait pas qu'elle l'a ete tant que rien n'a
-- ete fait : elle n'accede a la ligne qu'a partir de `contacted`.
-- ---------------------------------------------------------------------
drop policy if exists network_call_recommendations_involved on public.network_call_recommendations;
create policy network_call_recommendations_involved on public.network_call_recommendations
  for select to authenticated
  using (
    recommender_profile_id = private.current_profile_id()
    or private.is_network_call_author(call_id)
    or (recommended_profile_id = private.current_profile_id()
        and status in ('contacted', 'introduction_requested', 'retained'))
  );

drop policy if exists network_call_recommendations_create on public.network_call_recommendations;
create policy network_call_recommendations_create on public.network_call_recommendations
  for insert to authenticated
  with check (
    recommender_profile_id = private.current_profile_id()
    and private.is_active_member()
    and private.can_see_network_call(call_id)
    and status = 'proposed'
    -- Aucune sollicitation ne franchit un blocage, dans un sens ou dans l'autre.
    and (recommended_profile_id is null
         or not private.is_blocked_between(recommender_profile_id, recommended_profile_id))
  );

drop policy if exists network_call_recommendations_follow on public.network_call_recommendations;
create policy network_call_recommendations_follow on public.network_call_recommendations
  for update to authenticated
  using (private.is_network_call_author(call_id))
  with check (private.is_network_call_author(call_id));

-- ---------------------------------------------------------------------
-- Contributeurs et journal d'evenements : ecrits par les fonctions
-- atomiques uniquement (close_network_call, transition_network_call).
-- Aucune politique d'ecriture cliente.
-- ---------------------------------------------------------------------
drop policy if exists network_call_contributors_select on public.network_call_contributors;
create policy network_call_contributors_select on public.network_call_contributors
  for select to authenticated
  using (
    profile_id = private.current_profile_id()
    or private.is_network_call_author(call_id)
  );

drop policy if exists network_call_events_select on public.network_call_events;
create policy network_call_events_select on public.network_call_events
  for select to authenticated
  using (
    private.is_network_call_author(call_id)
    or private.has_permission('calls.moderate')
  );

-- ---------------------------------------------------------------------
-- Appels enregistres : donnee strictement personnelle (D-72).
-- ---------------------------------------------------------------------
drop policy if exists saved_network_calls_own on public.saved_network_calls;
create policy saved_network_calls_own on public.saved_network_calls
  for all to authenticated
  using (profile_id = private.current_profile_id())
  with check (profile_id = private.current_profile_id()
              and private.can_see_network_call(call_id));
