-- Evite la collision avec public.admin_list_duplicate_candidates(p_batch_id uuid, ...)
-- herite du chantier d'import en masse abandonne (decision C-06, migration 0080) :
-- meme nom, signature differente. Renommage pour lever toute ambiguite.
alter function public.admin_list_duplicate_candidates(text, integer)
  rename to admin_list_profile_duplicate_candidates;

comment on function public.admin_list_profile_duplicate_candidates(text, integer) is
  'SA-005. Paires de profils probablement en doublon (score >= 60, bareme private.duplicate_match_rules). Exige profiles.moderate. Distinct de admin_list_duplicate_candidates (0080, perimetre import, abandonne C-06).';
