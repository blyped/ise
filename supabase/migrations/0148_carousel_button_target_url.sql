-- 0148 — Bouton de slide carrousel : destination interne OU externe.
--
-- Demande du porteur (ticket, 2026-08-15), deux volets :
--
--  1. « Le bouton n'apparait pas sur la page d'accueil. » `cta_label` est
--     deja projete par `get_landing_carousel()` depuis 0109 : ce n'est pas
--     un bug de projection (meme classe que `events.description` en 0144 ou
--     `opportunities.summary` en 0137), mais un bug de RENDU. Le composant
--     public (`LandingCarousel.tsx`) masquait le bouton des que la ressource
--     interne (`entity_type`/`entity_id`) etait absente ou ne resolvait
--     aucune route — meme quand `cta_label` etait rempli. Corrige cote
--     frontend (voir D-202) ; documente ici parce que le vrai correctif
--     exigeait aussi une destination externe possible (volet 2).
--
--  2. « On ne peut pas choisir la destination du bouton (interne/externe). »
--     Le lien interne existe deja par `entity_type` + `entity_id`
--     (ADDENDUM §10, jamais une URL stockee). Ce qui manquait est
--     l'alternative EXTERNE. `cms_partner_campaigns.target_url` (0057)
--     resout exactement ce besoin pour les campagnes partenaires : meme
--     colonne, meme contrainte, reprises ici a l'identique plutot que
--     d'inventer un second mecanisme.

alter table public.cms_carousel_items
  add column if not exists target_url text
    constraint cms_carousel_items_target_url_https
    check (target_url is null or target_url ~ '^https://');

-- Le snapshot de publication (to_jsonb) embarque automatiquement la
-- nouvelle colonne (meme note que 0109) ; la lecture publique l'expose,
-- avec repli implicite sur `null` pour les instantanes publies avant
-- cette migration.
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
                      'target_url',    c.published_snapshot->>'target_url',
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
