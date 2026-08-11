-- 0102_performance_advisor_fk_indexes
-- Corrige un sous-ensemble cible des constats `unindexed_foreign_keys` remontes
-- par le Performance Advisor Supabase (71 constats au total).
--
-- Perimetre retenu (jugement, pas de correction aveugle de la liste complete) :
--  - Colonnes de cle etrangere sur des tables et parcours a fort trafic cote
--    membre (relations, introductions, recommandations, recherche enregistree,
--    candidatures, appels reseau, RBAC utilise a chaque verification de
--    permission).
--
-- Explicitement laisse de cote (constats reels mais trafic tres faible,
-- ecrans back-office admin a usage occasionnel) : imports en masse
-- (import_reports/rows/stage_events/value_reviews, deja retire du produit,
-- cf. tache "Retirer l'import en masse du back-office"), dedoublonnage admin
-- (duplicate_candidates, merge_field_resolutions, profile_duplicate_dismissals,
-- profile_admin_notes, admin_profile_notes, promotion_suggestions), CMS
-- editorial (cms_carousel_items, cms_content_overrides, cms_media_assets,
-- cms_partner_campaigns, cms_publication_schedule, cms_sections,
-- cms_featured_profile_*), maintenance_windows, platform_settings,
-- missing_member_suggestions, support_tickets, impact_events,
-- data_quality_issues. Ces tables sont lues/ecrites par un nombre restreint
-- d'administrateurs, a faible cadence : l'index n'apporterait pas de gain
-- mesurable et alourdirait chaque ecriture. A reconsiderer si le volume change.
--
-- `create index concurrently` n'est pas utilisable dans une migration
-- transactionnelle Supabase ; les tables concernees sont de taille modeste
-- (projet en phase de lancement), le cout de verrouillage est negligeable.
-- =====================================================================

-- Relations & introductions (ISE-038 -> ISE-046)
create index if not exists connections_request_idx
  on public.connections (request_id);
create index if not exists introduction_events_actor_idx
  on public.introduction_events (actor_profile_id);
create index if not exists introduction_requests_outcome_declared_by_idx
  on public.introduction_requests (outcome_declared_by);

-- Recommandations
create index if not exists recommendations_request_idx
  on public.recommendations (request_id);
create index if not exists recommendations_skill_idx
  on public.recommendations (skill_id);
create index if not exists recommendation_requests_skill_idx
  on public.recommendation_requests (skill_id);

-- Profils enregistres et alertes de recherche (consultes a chaque session)
create index if not exists saved_profiles_saved_profile_idx
  on public.saved_profiles (saved_profile_id);
create index if not exists search_alerts_profile_idx
  on public.search_alerts (profile_id);
create index if not exists search_alert_seen_results_profile_idx
  on public.search_alert_seen_results (profile_id);

-- Candidatures (opportunites)
create index if not exists application_status_history_actor_idx
  on public.application_status_history (actor_profile_id);
create index if not exists opportunities_source_verified_by_idx
  on public.opportunities (source_verified_by);

-- Appels reseau
create index if not exists network_call_events_actor_idx
  on public.network_call_events (actor_profile_id);
create index if not exists network_call_contributors_response_idx
  on public.network_call_contributors (response_id);

-- Communautes
create index if not exists community_posts_resolved_by_idx
  on public.community_posts (resolved_by_profile_id);

-- Profil : fusion, reclamation, verification (parcours membre)
create index if not exists ise_profiles_merged_into_idx
  on public.ise_profiles (merged_into_profile_id);
create index if not exists profile_claims_reviewed_by_idx
  on public.profile_claims (reviewed_by);
create index if not exists profile_claim_disputes_claim_idx
  on public.profile_claim_disputes (claim_id);
create index if not exists profile_claim_disputes_raised_by_idx
  on public.profile_claim_disputes (raised_by);
create index if not exists profile_claim_disputes_resolved_by_idx
  on public.profile_claim_disputes (resolved_by);
create index if not exists profile_verifications_verified_by_idx
  on public.profile_verifications (verified_by);
create index if not exists educations_country_idx
  on public.educations (country_code);
create index if not exists profile_projects_country_idx
  on public.profile_projects (country_code);
create index if not exists profile_projects_organization_idx
  on public.profile_projects (organization_id);
create index if not exists profile_projects_sector_idx
  on public.profile_projects (sector_id);

-- Mentorat (filtres de recherche pays/secteur)
create index if not exists mentorship_needs_country_idx
  on public.mentorship_needs (country_code);
create index if not exists mentorship_needs_sector_idx
  on public.mentorship_needs (sector_id);

-- Promotions : invitations et gestionnaires (campagnes, SA-011->015)
create index if not exists promotion_invitations_profile_idx
  on public.promotion_invitations (profile_id);
create index if not exists promotion_managers_profile_idx
  on public.promotion_managers (profile_id);

-- Signalements et moderation (consultes par tout membre + moderateurs)
create index if not exists reports_target_owner_idx
  on public.reports (target_owner_profile_id);
create index if not exists report_events_actor_idx
  on public.report_events (actor_profile_id);

-- RBAC : verifie a chaque appel de private.has_permission()
create index if not exists user_roles_granted_by_idx
  on private.user_roles (granted_by);
create index if not exists role_permissions_permission_idx
  on private.role_permissions (permission_id);
