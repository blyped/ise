-- 0109 — Options d'affichage des slides du carrousel (demande du porteur,
-- 2026-08-12) : position des textes et assombrissement du visuel.
--
--  * `text_position` : 'overlay' (textes sur l'image, comportement
--    historique), 'below' (textes sous l'image, sur le bandeau bleu nuit),
--    'hidden' (aucun texte affiche — le titre reste obligatoire en base :
--    il sert a l'administration et aux lecteurs d'ecran).
--  * `dim_media` : applique ou non le voile sombre sur le visuel. Option
--    INDEPENDANTE de la position des textes : la redaction juge elle-meme
--    de la lisibilite.
--
-- Additif pur : valeurs par defaut = comportement actuel, aucun contenu
-- existant ne change d'apparence.

alter table public.cms_carousel_items
  add column if not exists text_position text not null default 'overlay'
    constraint cms_carousel_items_text_position_check
    check (text_position in ('overlay', 'below', 'hidden')),
  add column if not exists dim_media boolean not null default true;

-- Le snapshot de publication (to_jsonb) embarquera automatiquement les
-- nouvelles colonnes ; la lecture publique les expose avec repli sur le
-- comportement historique pour les snapshots publies AVANT cette migration.
create or replace function public.get_landing_carousel()
returns jsonb
language sql
stable security definer
set search_path to ''
as $$
  select case when private.landing_section_hidden('hero_carousel') then '[]'::jsonb
         else coalesce((
           select jsonb_agg(s.item order by s.prio desc, s.id)
           from (
             select c.id, c.priority as prio,
                    jsonb_build_object(
                      'id',            c.id,
                      'title',         c.published_snapshot->>'title',
                      'subtitle',      c.published_snapshot->>'subtitle',
                      'description',   c.published_snapshot->>'description',
                      'content_type',  c.published_snapshot->>'content_type',
                      'entity_type',   c.published_snapshot->>'entity_type',
                      'entity_id',     c.published_snapshot->>'entity_id',
                      'cta_label',     c.published_snapshot->>'cta_label',
                      'priority',      c.priority,
                      'media',         private.landing_media((c.published_snapshot->>'media_id')::uuid),
                      'mobile_media',  private.landing_media((c.published_snapshot->>'mobile_media_id')::uuid),
                      'is_sponsored',  c.is_sponsored,
                      'sponsored_label', pc.sponsored_label,
                      'text_position', coalesce(c.published_snapshot->>'text_position', 'overlay'),
                      'dim_media',     coalesce((c.published_snapshot->>'dim_media')::boolean, true)
                    ) as item
             from public.cms_carousel_items c
             left join public.cms_partner_campaigns pc on pc.id = c.partner_campaign_id
             where c.status = 'published'
               and c.published_snapshot is not null
               and (c.start_at is null or c.start_at <= now())
               and (c.end_at   is null or c.end_at   >  now())
               and (
                 not c.is_sponsored
                 or (pc.id is not null and pc.status = 'published'
                     and pc.start_at <= now() and pc.end_at > now())
               )
           ) s
         ), '[]'::jsonb) end
$$;
