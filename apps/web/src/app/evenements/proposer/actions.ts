'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { failure, type FormState } from '@/lib/form-state';
import { requireProfile } from '@/lib/profile-guard';
import { CONTENT_ROUTES } from '@/lib/routes/content';
import { frContentProposals } from '@/i18n/content-proposals';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  proposalErrorMessage,
  removeProposalCover,
  uploadProposalCover,
} from '@/lib/queries/content-proposals';

/**
 * PROPOSER UN ÉVÉNEMENT (0132) — voie MEMBRE.
 *
 * Même cycle que la proposition d'actualité, et même raison de le
 * calquer sur `moderate_opportunity` (0077). L'événement entre en
 * `status = 'pending_review'` : il n'apparaît ni dans l'agenda, ni dans
 * le fil, tant que l'administration n'a pas tranché.
 *
 * DEUX EXIGENCES SONT VÉRIFIÉES ICI COMME ELLES LE SERONT À LA
 * VALIDATION — lien de connexion pour un événement en ligne, ville ou
 * lieu pour du présentiel. `propose_event` les impose déjà côté base ;
 * les redire ici permet de les signaler CHAMP PAR CHAMP plutôt que par
 * un message global après un aller-retour serveur.
 */

function trimmed(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function optional(formData: FormData, key: string): string | null {
  const value = trimmed(formData, key);
  return value.length > 0 ? value : null;
}

export async function proposeEventAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const { correlationId } = context;
  const profileId = context.profile.id;
  const labels = frContentProposals.member;

  const eventTypeCode = trimmed(formData, 'eventTypeCode');
  const title = trimmed(formData, 'title');
  const startsAt = trimmed(formData, 'startsAt');
  const endsAt = trimmed(formData, 'endsAt');
  const timezone = trimmed(formData, 'timezone');
  const format = trimmed(formData, 'format') || 'online';
  const city = trimmed(formData, 'city');
  const venueName = trimmed(formData, 'venueName');
  const onlineUrl = trimmed(formData, 'onlineUrl');
  const coverAlt = trimmed(formData, 'coverAlt');

  const fieldErrors: Record<string, string> = {};
  if (eventTypeCode.length === 0) fieldErrors['eventTypeCode'] = frContentProposals.common.required;
  if (title.length < 3) fieldErrors['title'] = frContentProposals.common.required;
  if (startsAt.length === 0) fieldErrors['startsAt'] = frContentProposals.common.required;
  if (timezone.length === 0) fieldErrors['timezone'] = frContentProposals.common.required;
  if (endsAt.length > 0 && endsAt < startsAt) {
    fieldErrors['endsAt'] = labels.fieldEndsAtInvalid;
  }
  if (format !== 'in_person' && onlineUrl.length === 0) {
    fieldErrors['onlineUrl'] = frContentProposals.errors['event_online_url_required'] ?? '';
  }
  if (format !== 'online' && city.length === 0 && venueName.length === 0) {
    fieldErrors['city'] = frContentProposals.errors['event_place_required'] ?? '';
  }

  // Narrowing explicite plutot que par alias booleen : la variable porte
  // deja le type, il n'y a plus rien a deduire plus bas.
  const rawFile = formData.get('cover');
  const coverFile = rawFile instanceof File && rawFile.size > 0 ? rawFile : null;
  const hasFile = coverFile !== null;
  if (hasFile && coverAlt.length < 3) fieldErrors['coverAlt'] = labels.coverAltRequired;

  if (Object.keys(fieldErrors).length > 0) {
    return failure(labels.invalid, correlationId, fieldErrors);
  }

  let coverPath: string | null = null;
  if (coverFile !== null) {
    const uploaded = await uploadProposalCover(profileId, coverFile);
    if (!uploaded.ok) {
      return failure(uploaded.message, correlationId, { cover: uploaded.message });
    }
    coverPath = uploaded.path;
  }

  const countryCode = optional(formData, 'countryCode');

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('propose_event', {
    p_event_type_code: eventTypeCode,
    p_title: title,
    p_description: optional(formData, 'description'),
    p_starts_at: startsAt,
    p_ends_at: endsAt.length > 0 ? endsAt : null,
    p_timezone: timezone,
    p_format: format,
    p_country_code: countryCode === null ? null : countryCode.toUpperCase(),
    p_city: city.length > 0 ? city : null,
    p_venue_name: venueName.length > 0 ? venueName : null,
    p_online_url: onlineUrl.length > 0 ? onlineUrl : null,
    p_cover_path: coverPath,
    p_cover_alt: coverPath === null ? null : coverAlt,
  });

  if (error) {
    if (coverPath !== null) await removeProposalCover(coverPath);
    return failure(proposalErrorMessage(error, correlationId), correlationId);
  }

  revalidatePath(CONTENT_ROUTES.myProposals);
  redirect(`${CONTENT_ROUTES.myProposals}?envoyee=evenement`);
}
