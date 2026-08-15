-- =====================================================================
-- 0146_landing_media_organizations_usage
--
-- Correctif remonte par le porteur : la mediatheque du CMS (CMS-008)
-- propose un emplacement « Emplacement sur la vitrine » a l'import d'un
-- media (`CMS_MEDIA_USAGES`), mais cette liste s'arretait a quatre
-- prefixes (`carousel`, `partners`, `news`, `sections`) — le meme
-- quatuor que `private.is_landing_media_path()` (0068) autorisait a
-- l'ecriture. Aucun prefixe dedie n'existait pour les logos
-- d'organisations de la section « Ils nous font confiance »
-- (`cms_landing_organizations.media_id`, 0133) : un redacteur qui
-- televersait un logo devait choisir « Sections » par defaut, un
-- emplacement qui ne dit pas ce que le fichier est reellement.
--
-- CETTE MIGRATION AJOUTE UN SIXIEME PREFIXE, `organizations/`, A LA
-- LISTE BLANCHE DE `private.is_landing_media_path()` — le seul endroit
-- qui compte reellement : la politique `ise_landing_media_insert` (0068)
-- et sa jumelle `ise_landing_media_insert_editorial` (0132) refusent tout
-- depot hors des prefixes que cette fonction reconnait. Elargir la liste
-- TypeScript sans elargir cette fonction aurait fait echouer le depot au
-- premier essai — l'erreur inverse de 0068 (voir son commentaire dans
-- 0120), mais la meme lecon : la liste TypeScript n'est qu'un miroir de
-- cette regle, jamais la regle elle-meme.
--
-- Le prefixe `membres/` (0120, depot du portrait consenti d'un membre)
-- N'EST PAS ajoute a `CMS_MEDIA_USAGES` : ce cinquieme prefixe reste
-- reserve au depot member-self-service, jamais un choix propose au
-- redacteur CMS.
-- =====================================================================

create or replace function private.is_landing_media_path(p_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select private.storage_segment(p_name, 1)
           in ('carousel', 'partners', 'news', 'sections', 'membres', 'organizations')
     and private.storage_segment(p_name, 2) is not null
$$;

-- D-126 : ne jamais compter sur un defaut d'ACL, poser le privilege a
-- chaque redefinition de la fonction (meme lecon qu'en 0062, 0067, 0068,
-- 0120).
revoke all on function private.is_landing_media_path(text) from public, anon;
grant execute on function private.is_landing_media_path(text) to authenticated;

comment on function private.is_landing_media_path(text) is
  'Vrai si le chemin d''objet est range sous l''un des six usages de la vitrine (carousel, partners, news, sections, membres, organizations). Un depot hors de ces prefixes est refuse par la politique d''ecriture.';
