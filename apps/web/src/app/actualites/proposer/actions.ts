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
 * PROPOSER UNE ACTUALITÉ (0132) — voie MEMBRE.
 *
 * Le cycle est celui des opportunités (`moderate_opportunity`, 0077), et
 * non un second circuit inventé pour l'occasion :
 *     proposer -> file d'attente -> accepter (publie) | refuser (motif).
 *
 * Rien n'est visible avant la décision : `propose_news` écrit
 * `editorial_status = 'submitted'`, que `can_see_news` n'ouvre qu'à
 * l'auteur et aux détenteurs de `content.publish`.
 *
 * L'ORDRE DES DEUX ÉCRITURES COMPTE. L'image est déposée AVANT l'appel
 * RPC, parce que `private.assert_proposed_cover` vérifie que l'objet
 * existe réellement dans le bucket — enregistrer un chemin qui ne pointe
 * nulle part serait pire que ne rien enregistrer. Si la RPC échoue
 * ensuite, le fichier n'est rattaché à rien : on le retire, comme
 * `uploadAvatarAction` le fait déjà.
 */

function trimmed(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function optional(formData: FormData, key: string): string | null {
  const value = trimmed(formData, key);
  return value.length > 0 ? value : null;
}

export async function proposeNewsAction(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireProfile();
  if (!context.ok) return failure(context.message, context.correlationId);

  const { correlationId } = context;
  const profileId = context.profile.id;
  const labels = frContentProposals.member;

  const categoryCode = trimmed(formData, 'categoryCode');
  const title = trimmed(formData, 'title');
  const summary = trimmed(formData, 'summary');
  const coverAlt = trimmed(formData, 'coverAlt');

  const fieldErrors: Record<string, string> = {};
  if (categoryCode.length === 0) fieldErrors['categoryCode'] = frContentProposals.common.required;
  if (title.length < 3) fieldErrors['title'] = frContentProposals.common.required;
  if (summary.length === 0 || summary.length > 400) {
    fieldErrors['summary'] = frContentProposals.common.required;
  }

  // Narrowing explicite plutot que par alias booleen : la variable porte
  // deja le type, il n'y a plus rien a deduire plus bas.
  const rawFile = formData.get('cover');
  const coverFile = rawFile instanceof File && rawFile.size > 0 ? rawFile : null;
  const hasFile = coverFile !== null;

  // Le texte alternatif est exigé DÈS QU'il y a une image, et pas
  // seulement par la base : l'auteur doit le voir avant l'envoi.
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

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('propose_news', {
    p_category_code: categoryCode,
    p_title: title,
    p_summary: summary,
    p_body: optional(formData, 'body'),
    p_event_date: optional(formData, 'eventDate'),
    p_source_url: optional(formData, 'sourceUrl'),
    p_cover_path: coverPath,
    p_cover_alt: coverPath === null ? null : coverAlt,
  });

  if (error) {
    if (coverPath !== null) await removeProposalCover(coverPath);
    return failure(proposalErrorMessage(error, correlationId), correlationId);
  }

  revalidatePath(CONTENT_ROUTES.myProposals);
  redirect(`${CONTENT_ROUTES.myProposals}?envoyee=actualite`);
}
