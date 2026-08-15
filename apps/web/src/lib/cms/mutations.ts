import { toBusinessError, type BusinessError } from '@ise/domain';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { CmsPublishableType, CmsStatus } from './types';

/**
 * ECRITURES DU BACK-OFFICE CMS.
 *
 * DEUX CHEMINS, ET UN SEUL POUR LE STATUT.
 *
 *   * Le BROUILLON s'ecrit directement dans les tables `cms_*` : la RLS
 *     accorde `INSERT` / `UPDATE` a `cms.edit` (ou `cms.partners.manage`,
 *     ou `cms.schedule` selon la table). C'est le chemin normal d'une
 *     edition.
 *
 *   * Le STATUT ne s'ecrit JAMAIS ici. Les triggers
 *     `private.cms_guard_publication_state()` et
 *     `private.cms_guard_schedule_state()` refusent toute ecriture directe
 *     de `status`, `published_snapshot`, `previous_published_snapshot`,
 *     `published_at`, `published_by_profile_id`. Toute transition passe
 *     par `publish_cms_content()`, `transition_cms_content()` ou
 *     `rollback_cms_content()`, qui verifient la permission, verrouillent
 *     la ligne et journalisent (ADDENDUM §30).
 *
 * Ce module n'ouvre donc AUCUN chemin qui contournerait ces fonctions :
 * il n'expose meme pas de moyen d'ecrire `status`.
 */

export type MutationResult<T = void> = { ok: true; data: T } | { ok: false; error: BusinessError };

function failure<T>(raw: unknown, correlationId: string, what: string): MutationResult<T> {
  const code = (raw as { code?: string } | null)?.code;
  console.error('[ISE] ecriture CMS en echec', { correlationId, what, code });
  return { ok: false, error: toBusinessError(raw, correlationId) };
}

/** Profil ISE de la session. Sert a tracer l'auteur d'un brouillon. */
export async function currentProfileId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('ise_profiles')
    .select('id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  const row = (data ?? null) as { id?: unknown } | null;
  return typeof row?.id === 'string' ? row.id : null;
}

/* ------------------------------------------------------------------ */
/* Transitions d'etat — le SEUL chemin (ADDENDUM §30)                 */
/* ------------------------------------------------------------------ */

export async function publishCmsContent(
  entityType: CmsPublishableType,
  id: string,
  correlationId: string,
): Promise<MutationResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('publish_cms_content', {
    p_entity_type: entityType,
    p_id: id,
  });
  if (error) return failure(error, correlationId, 'publish_cms_content');
  return { ok: true, data: undefined };
}

export async function transitionCmsContent(
  entityType: CmsPublishableType,
  id: string,
  toStatus: Exclude<CmsStatus, 'published'>,
  reason: string | null,
  correlationId: string,
): Promise<MutationResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('transition_cms_content', {
    p_entity_type: entityType,
    p_id: id,
    p_to_status: toStatus,
    p_reason: reason,
  });
  if (error) return failure(error, correlationId, 'transition_cms_content');
  return { ok: true, data: undefined };
}

/** ADDENDUM §49 — restaure la derniere version publiee saine. */
export async function rollbackCmsContent(
  entityType: CmsPublishableType,
  id: string,
  correlationId: string,
): Promise<MutationResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('rollback_cms_content', {
    p_entity_type: entityType,
    p_id: id,
  });
  if (error) return failure(error, correlationId, 'rollback_cms_content');
  return { ok: true, data: undefined };
}

/* ------------------------------------------------------------------ */
/* CMS-002 — Carrousel                                                */
/* ------------------------------------------------------------------ */

export interface CarouselDraft {
  title: string;
  subtitle: string | null;
  description: string | null;
  mediaId: string | null;
  mobileMediaId: string | null;
  contentType: string;
  entityType: string | null;
  entityId: string | null;
  ctaLabel: string | null;
  /** 0148 — destination externe (https) du bouton, alternative a entityType/entityId. */
  targetUrl: string | null;
  startAt: string | null;
  endAt: string | null;
  priority: number;
  /** 0109 — 'overlay' | 'below' | 'hidden'. */
  textPosition: string;
  /** 0109 — voile sombre sur le visuel. */
  dimMedia: boolean;
  partnerCampaignId: string | null;
}

function carouselPayload(draft: CarouselDraft): Record<string, unknown> {
  return {
    title: draft.title,
    subtitle: draft.subtitle,
    description: draft.description,
    media_id: draft.mediaId,
    mobile_media_id: draft.mobileMediaId,
    content_type: draft.contentType,
    entity_type: draft.entityType,
    entity_id: draft.entityId,
    cta_label: draft.ctaLabel,
    target_url: draft.targetUrl,
    start_at: draft.startAt,
    end_at: draft.endAt,
    priority: draft.priority,
    text_position: draft.textPosition,
    dim_media: draft.dimMedia,
    // `is_sponsored` n'est pas un choix libre : la contrainte
    // `cms_carousel_items_sponsored_traceable` impose l'egalite stricte
    // avec la presence d'une campagne. On la respecte a la source.
    is_sponsored: draft.partnerCampaignId !== null,
    partner_campaign_id: draft.partnerCampaignId,
  };
}

export async function createCarouselItem(
  draft: CarouselDraft,
  correlationId: string,
): Promise<MutationResult<string>> {
  const supabase = await createSupabaseServerClient();
  const profileId = await currentProfileId();
  const { data, error } = await supabase
    .from('cms_carousel_items')
    .insert({ ...carouselPayload(draft), created_by_profile_id: profileId })
    .select('id')
    .single();
  if (error) return failure(error, correlationId, 'insert cms_carousel_item');
  const row = (data ?? null) as { id?: unknown } | null;
  return { ok: true, data: typeof row?.id === 'string' ? row.id : '' };
}

export async function updateCarouselItem(
  itemId: string,
  draft: CarouselDraft,
  correlationId: string,
): Promise<MutationResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('cms_carousel_items')
    .update(carouselPayload(draft))
    .eq('id', itemId);
  if (error) return failure(error, correlationId, 'update cms_carousel_item');
  return { ok: true, data: undefined };
}

export async function deleteCarouselItem(
  itemId: string,
  correlationId: string,
): Promise<MutationResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('cms_carousel_items').delete().eq('id', itemId);
  if (error) return failure(error, correlationId, 'delete cms_carousel_item');
  return { ok: true, data: undefined };
}

/**
 * Reordonnancement (§32). Le rang n'est pas une transition d'etat : c'est
 * la colonne `priority`, ecrite par `cms.edit`. Les deux lignes echangent
 * leur priorite, ce qui rend l'operation stable meme si les priorites ne
 * se suivent pas.
 */
export async function swapCarouselPriority(
  first: { id: string; priority: number },
  second: { id: string; priority: number },
  correlationId: string,
): Promise<MutationResult> {
  const supabase = await createSupabaseServerClient();

  // Priorites egales : on les separe explicitement plutot que d'echanger
  // deux valeurs identiques, ce qui ne changerait rien a l'affichage.
  const a = first.priority === second.priority ? second.priority + 1 : second.priority;
  const b = first.priority === second.priority ? second.priority : first.priority;

  const one = await supabase.from('cms_carousel_items').update({ priority: a }).eq('id', first.id);
  if (one.error) return failure(one.error, correlationId, 'reorder cms_carousel_item');
  const two = await supabase.from('cms_carousel_items').update({ priority: b }).eq('id', second.id);
  if (two.error) return failure(two.error, correlationId, 'reorder cms_carousel_item');
  return { ok: true, data: undefined };
}

/* ------------------------------------------------------------------ */
/* CMS-003 — Sections d'accueil                                       */
/* ------------------------------------------------------------------ */

export interface SectionDraft {
  title: string | null;
  subtitle: string | null;
  isEnabled: boolean;
  sourceMode: string;
  maxItems: number;
  ctaLabel: string | null;
  ctaEntityType: string | null;
  ctaEntityId: string | null;
}

export async function updateSection(
  sectionId: string,
  draft: SectionDraft,
  correlationId: string,
): Promise<MutationResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('cms_sections')
    .update({
      title: draft.title,
      subtitle: draft.subtitle,
      is_enabled: draft.isEnabled,
      source_mode: draft.sourceMode,
      max_items: draft.maxItems,
      cta_label: draft.ctaLabel,
      cta_entity_type: draft.ctaEntityType,
      cta_entity_id: draft.ctaEntityId,
    })
    .eq('id', sectionId);
  if (error) return failure(error, correlationId, 'update cms_section');
  return { ok: true, data: undefined };
}

export async function swapSectionOrder(
  first: { id: string; displayOrder: number },
  second: { id: string; displayOrder: number },
  correlationId: string,
): Promise<MutationResult> {
  const supabase = await createSupabaseServerClient();
  const a =
    first.displayOrder === second.displayOrder ? second.displayOrder + 1 : second.displayOrder;
  const b = first.displayOrder === second.displayOrder ? second.displayOrder : first.displayOrder;

  const one = await supabase.from('cms_sections').update({ display_order: a }).eq('id', first.id);
  if (one.error) return failure(one.error, correlationId, 'reorder cms_section');
  const two = await supabase.from('cms_sections').update({ display_order: b }).eq('id', second.id);
  if (two.error) return failure(two.error, correlationId, 'reorder cms_section');
  return { ok: true, data: undefined };
}

/* ------------------------------------------------------------------ */
/* CMS-004 / CMS-005 — Exposition d'un contenu metier (D-128)         */
/* ------------------------------------------------------------------ */

export async function setLandingExposure(
  entityType: 'news' | 'event' | 'opportunity',
  entityId: string,
  landingVisibility: 'hidden' | 'visible' | null,
  landingPriority: number | null,
  correlationId: string,
): Promise<MutationResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('set_landing_exposure', {
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_landing_visibility: landingVisibility,
    p_landing_priority: landingPriority,
  });
  if (error) return failure(error, correlationId, 'set_landing_exposure');
  return { ok: true, data: undefined };
}

/**
 * 0113 — visuel de couverture d'un evenement ou d'une opportunite, tire de
 * la mediatheque publique. `set_landing_cover_media` valide seule le media
 * (bucket public, alt_text) ; ce module ne fait que transmettre.
 */
export async function setLandingCoverMedia(
  entityType: 'event' | 'opportunity',
  entityId: string,
  mediaId: string | null,
  correlationId: string,
): Promise<MutationResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('set_landing_cover_media', {
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_media_id: mediaId,
  });
  if (error) return failure(error, correlationId, 'set_landing_cover_media');
  return { ok: true, data: undefined };
}

/**
 * 0117 — visuel de couverture d'une actualite, tire de la mediatheque
 * publique, et son reglage `cover_has_text` (le titre est-il deja
 * incruste dans l'image ?). `set_news_cover_media` valide seule le media
 * (bucket public, alt_text) ; ce module ne fait que transmettre.
 *
 * `hasText = null` laisse le reglage existant inchange en base (utile
 * quand seul le visuel change) ; `mediaId = null` retire explicitement
 * la couverture.
 */
export async function setNewsCoverMedia(
  newsId: string,
  mediaId: string | null,
  hasText: boolean | null,
  correlationId: string,
): Promise<MutationResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('set_news_cover_media', {
    p_news_id: newsId,
    p_media_id: mediaId,
    p_has_text: hasText,
  });
  if (error) return failure(error, correlationId, 'set_news_cover_media');
  return { ok: true, data: undefined };
}

/**
 * CMS-011 (0114, etendu par 0129) — titre, corps, image, legende
 * optionnelle et lien d'un pilier de « Un reseau concu pour etre utile ».
 * `linkTarget` est deja une valeur de la liste blanche base ('search' |
 * 'calls' | 'projects' | 'opportunities' | 'applications') ou `null` : la
 * validation finale reste cote base (`set_landing_pillar`), ce wrapper ne
 * fait que transporter l'appel. `title` / `body` a `null` remettent le
 * pilier sur sa valeur d'origine (i18n).
 */
export async function setLandingPillar(
  pillarKey: 'connecter' | 'entraider' | 'collaborer' | 'impacter',
  mediaId: string | null,
  caption: string | null,
  linkTarget: string | null,
  title: string | null,
  body: string | null,
  correlationId: string,
): Promise<MutationResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('set_landing_pillar', {
    p_pillar_key: pillarKey,
    p_media_id: mediaId,
    p_caption: caption,
    p_link_target: linkTarget,
    p_title: title,
    p_body: body,
  });
  if (error) return failure(error, correlationId, 'set_landing_pillar');
  return { ok: true, data: undefined };
}

export async function setNewsFeatured(
  newsId: string,
  isFeatured: boolean,
  correlationId: string,
): Promise<MutationResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('set_news_featured', {
    p_news_id: newsId,
    p_is_featured: isFeatured,
  });
  if (error) return failure(error, correlationId, 'set_news_featured');
  return { ok: true, data: undefined };
}

/**
 * Epinglage editorial d'un contenu dans une section (§43).
 * Primitive generique : `pin` passe devant la source automatique, puis
 * expire de lui-meme. L'expiration est traitee par `expire_cms_content()`.
 */
export async function pinEntityInSection(
  sectionKey: string,
  entityType: string,
  entityId: string,
  endsAt: string | null,
  reason: string | null,
  correlationId: string,
): Promise<MutationResult> {
  const supabase = await createSupabaseServerClient();
  const profileId = await currentProfileId();
  const { error } = await supabase.from('cms_content_overrides').insert({
    section_key: sectionKey,
    override_kind: 'pin',
    entity_type: entityType,
    entity_id: entityId,
    ends_at: endsAt,
    reason,
    created_by_profile_id: profileId,
  });
  if (error) return failure(error, correlationId, 'insert cms_content_override');
  return { ok: true, data: undefined };
}

export async function unpinEntityInSection(
  sectionKey: string,
  entityId: string,
  correlationId: string,
): Promise<MutationResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('cms_content_overrides')
    .delete()
    .eq('section_key', sectionKey)
    .eq('override_kind', 'pin')
    .eq('entity_id', entityId);
  if (error) return failure(error, correlationId, 'delete cms_content_override');
  return { ok: true, data: undefined };
}

/* ------------------------------------------------------------------ */
/* CMS-006 — ISE du jour                                              */
/* ------------------------------------------------------------------ */

export async function overrideFeaturedProfile(
  profileId: string,
  startsAt: string | null,
  endsAt: string | null,
  reason: string | null,
  correlationId: string,
): Promise<MutationResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('override_featured_profile', {
    p_profile_id: profileId,
    p_starts_at: startsAt,
    p_ends_at: endsAt,
    p_reason: reason,
  });
  if (error) return failure(error, correlationId, 'override_featured_profile');
  return { ok: true, data: undefined };
}

export async function excludeProfileFromFeatured(
  profileId: string,
  until: string | null,
  reason: string | null,
  correlationId: string,
): Promise<MutationResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('exclude_profile_from_featured', {
    p_profile_id: profileId,
    p_until: until,
    p_reason: reason,
  });
  if (error) return failure(error, correlationId, 'exclude_profile_from_featured');
  return { ok: true, data: undefined };
}

export async function setFeaturedAutomation(
  enabled: boolean,
  reason: string | null,
  correlationId: string,
): Promise<MutationResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('set_featured_profile_automation', {
    p_enabled: enabled,
    p_reason: reason,
  });
  if (error) return failure(error, correlationId, 'set_featured_profile_automation');
  return { ok: true, data: undefined };
}

/**
 * D-165 — visuel de la médiathèque publique et accroche courte pour une
 * mise en avant donnée. `mediaId` doit référencer un original du bucket
 * `landing-media` doté d'un texte alternatif ; la base revalide les deux
 * (`set_featured_profile_showcase`), ce module ne fait que transmettre.
 */
export async function setFeaturedProfileShowcase(
  featuredDate: string,
  mediaId: string | null,
  tagline: string | null,
  correlationId: string,
): Promise<MutationResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('set_featured_profile_showcase', {
    p_featured_date: featuredDate,
    p_media_id: mediaId,
    p_tagline: tagline,
  });
  if (error) return failure(error, correlationId, 'set_featured_profile_showcase');
  return { ok: true, data: undefined };
}

export interface FeaturedRulesDraft {
  minDaysBetweenFeatures: number;
  requireClaimedProfile: boolean;
  /** Portrait public consenti exigé (0123), et non plus l'avatar privé. */
  requirePublicPhoto: boolean;
  requirePromotion: boolean;
  requireExpertiseOrPosition: boolean;
  balanceDimension: string;
}

export async function updateFeaturedRules(
  draft: FeaturedRulesDraft,
  correlationId: string,
): Promise<MutationResult> {
  const supabase = await createSupabaseServerClient();
  const profileId = await currentProfileId();
  const { error } = await supabase
    .from('cms_featured_profile_rules')
    .update({
      min_days_between_features: draft.minDaysBetweenFeatures,
      require_claimed_profile: draft.requireClaimedProfile,
      require_public_photo: draft.requirePublicPhoto,
      require_promotion: draft.requirePromotion,
      require_expertise_or_position: draft.requireExpertiseOrPosition,
      balance_dimension: draft.balanceDimension,
      updated_by_profile_id: profileId,
    })
    .eq('is_active', true);
  if (error) return failure(error, correlationId, 'update cms_featured_profile_rules');
  return { ok: true, data: undefined };
}

/* ------------------------------------------------------------------ */
/* CMS-007 — Partenaires                                              */
/* ------------------------------------------------------------------ */

export interface CampaignDraft {
  organizationId: string;
  campaignName: string;
  placement: string;
  title: string | null;
  description: string | null;
  mediaId: string | null;
  mobileMediaId: string | null;
  ctaLabel: string | null;
  targetEntityType: string | null;
  targetEntityId: string | null;
  targetUrl: string | null;
  sponsoredLabel: string;
  startAt: string;
  endAt: string;
}

function campaignPayload(draft: CampaignDraft): Record<string, unknown> {
  return {
    organization_id: draft.organizationId,
    campaign_name: draft.campaignName,
    placement: draft.placement,
    title: draft.title,
    description: draft.description,
    media_id: draft.mediaId,
    mobile_media_id: draft.mobileMediaId,
    cta_label: draft.ctaLabel,
    target_entity_type: draft.targetEntityType,
    target_entity_id: draft.targetEntityId,
    target_url: draft.targetUrl,
    sponsored_label: draft.sponsoredLabel,
    start_at: draft.startAt,
    end_at: draft.endAt,
  };
}

export async function createCampaign(
  draft: CampaignDraft,
  correlationId: string,
): Promise<MutationResult<string>> {
  const supabase = await createSupabaseServerClient();
  const profileId = await currentProfileId();
  const { data, error } = await supabase
    .from('cms_partner_campaigns')
    .insert({ ...campaignPayload(draft), created_by_profile_id: profileId })
    .select('id')
    .single();
  if (error) return failure(error, correlationId, 'insert cms_partner_campaign');
  const row = (data ?? null) as { id?: unknown } | null;
  return { ok: true, data: typeof row?.id === 'string' ? row.id : '' };
}

export async function updateCampaign(
  campaignId: string,
  draft: CampaignDraft,
  correlationId: string,
): Promise<MutationResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('cms_partner_campaigns')
    .update(campaignPayload(draft))
    .eq('id', campaignId);
  if (error) return failure(error, correlationId, 'update cms_partner_campaign');
  return { ok: true, data: undefined };
}

export async function deleteCampaign(
  campaignId: string,
  correlationId: string,
): Promise<MutationResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('cms_partner_campaigns').delete().eq('id', campaignId);
  if (error) return failure(error, correlationId, 'delete cms_partner_campaign');
  return { ok: true, data: undefined };
}

/* ------------------------------------------------------------------ */
/* CMS-008 — Mediatheque                                              */
/* ------------------------------------------------------------------ */

export interface MediaRecord {
  storagePath: string;
  filename: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  altText: string;
  credit: string | null;
}

/**
 * Bucket de destination de la mediatheque : `landing-media`, PUBLIC (0068).
 *
 * C'est le seul bucket public de la plateforme, et il ne contient que du
 * materiel editorial destine a la vitrine. Ce qui est depose ici est, par
 * definition, destine a etre vu de tous. Rien d'autre n'y entre : ni avatar,
 * ni piece jointe, ni document de profil.
 */
export const CMS_MEDIA_BUCKET = 'landing-media';

/**
 * Depose les octets dans `landing-media`.
 *
 * `upsert: false` : un chemin est bati sur un UUID, une collision signalerait
 * un defaut, pas un remplacement voulu. La politique
 * `ise_landing_media_insert` exige `cms.media.manage` ET un premier segment
 * parmi les quatre usages : un chemin mal forme est refuse par la base, pas
 * seulement par cette fonction.
 */
export async function uploadMediaObject(
  storagePath: string,
  bytes: Uint8Array,
  mimeType: string,
  correlationId: string,
): Promise<MutationResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.storage
    .from(CMS_MEDIA_BUCKET)
    .upload(storagePath, bytes, { contentType: mimeType, upsert: false });
  if (error) return failure(error, correlationId, `storage upload ${CMS_MEDIA_BUCKET}`);
  return { ok: true, data: undefined };
}

export async function recordMediaAsset(
  record: MediaRecord,
  correlationId: string,
): Promise<MutationResult<string>> {
  const supabase = await createSupabaseServerClient();
  const profileId = await currentProfileId();
  const { data, error } = await supabase
    .from('cms_media_assets')
    .insert({
      // Explicite plutot que laisse au defaut de la colonne : la valeur qui
      // pilote la construction de l'URL publique doit etre lisible ici.
      bucket_id: CMS_MEDIA_BUCKET,
      storage_path: record.storagePath,
      filename: record.filename,
      mime_type: record.mimeType,
      width: record.width,
      height: record.height,
      size_bytes: record.sizeBytes,
      alt_text: record.altText,
      credit: record.credit,
      variant_kind: 'original',
      created_by_profile_id: profileId,
    })
    .select('id')
    .single();
  if (error) return failure(error, correlationId, 'insert cms_media_asset');
  const row = (data ?? null) as { id?: unknown } | null;
  return { ok: true, data: typeof row?.id === 'string' ? row.id : '' };
}

export async function updateMediaMetadata(
  mediaId: string,
  altText: string,
  credit: string | null,
  correlationId: string,
): Promise<MutationResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('cms_media_assets')
    .update({ alt_text: altText, credit })
    .eq('id', mediaId);
  if (error) return failure(error, correlationId, 'update cms_media_asset');
  return { ok: true, data: undefined };
}

/**
 * Suppression logique. Les octets restent dans le bucket : un media
 * reference par un contenu publie continuerait sinon a manquer sur la
 * landing sans que personne ne s'en apercoive.
 */
export async function softDeleteMediaAsset(
  mediaId: string,
  correlationId: string,
): Promise<MutationResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('cms_media_assets')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', mediaId);
  if (error) return failure(error, correlationId, 'soft delete cms_media_asset');
  return { ok: true, data: undefined };
}

/* ------------------------------------------------------------------ */
/* CMS-009 — Programmation                                            */
/* ------------------------------------------------------------------ */

export async function createScheduleOrder(
  entityType: string,
  entityId: string,
  publishAt: string | null,
  unpublishAt: string | null,
  correlationId: string,
): Promise<MutationResult> {
  const supabase = await createSupabaseServerClient();
  const profileId = await currentProfileId();
  const { error } = await supabase.from('cms_publication_schedule').insert({
    entity_type: entityType,
    entity_id: entityId,
    publish_at: publishAt,
    unpublish_at: unpublishAt,
    created_by_profile_id: profileId,
  });
  if (error) return failure(error, correlationId, 'insert cms_publication_schedule');
  return { ok: true, data: undefined };
}

/**
 * Annulation d'un ordre. `cancelled` est le seul statut que le trigger
 * `cms_guard_schedule_state()` laisse ecrire depuis un client : declarer
 * un ordre `applied` a la main resterait refuse.
 */
export async function cancelScheduleOrder(
  orderId: string,
  correlationId: string,
): Promise<MutationResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('cms_publication_schedule')
    .update({ status: 'cancelled' })
    .eq('id', orderId)
    .eq('status', 'pending');
  if (error) return failure(error, correlationId, 'cancel cms_publication_schedule');
  return { ok: true, data: undefined };
}
