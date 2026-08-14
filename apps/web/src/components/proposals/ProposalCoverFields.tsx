'use client';

import { Card, CardHeader, CardTitle, Field } from '@ise/ui-web';
import { frContentProposals } from '@/i18n/content-proposals';
import { FIELD } from '@/components/collab/styles';
import { PROPOSAL_COVER_ACCEPT } from '@/lib/content-proposals';

/**
 * LE BLOC « VISUEL » DES DEUX FORMULAIRES DE PROPOSITION (0132).
 *
 * C'est le point explicite de la demande du porteur : « leur donner la
 * possibilité d'ajouter les images en même temps pour que je n'aie pas à
 * faire toutes les images à la validation ». Le fichier part donc AVEC le
 * texte, dans le même envoi.
 *
 * Il vit ici, hors des deux routes, parce qu'actualités et événements le
 * partagent : même bucket, mêmes bornes, même texte alternatif
 * obligatoire. Le dupliquer aurait garanti la divergence.
 *
 * LE TEXTE ALTERNATIF N'EST PAS DÉCORATIF. `assert_proposed_cover` (0132)
 * refuse un chemin dont l'alternative fait moins de trois caractères, et
 * une image sans alternative est invisible pour qui ne la voit pas. Le
 * champ est donc exigé côté écran comme côté base.
 */
export function ProposalCoverFields({
  fileError,
  altError,
}: {
  fileError: string | undefined;
  altError: string | undefined;
}) {
  const labels = frContentProposals.member;

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">{labels.coverTitle}</CardTitle>
      </CardHeader>

      <p className="text-body-sm text-text-secondary">{labels.coverIntro}</p>

      <div className="mt-5 flex flex-col gap-5">
        <Field label={labels.coverFileLabel} hint={labels.coverFileHint} error={fileError}>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              name="cover"
              type="file"
              accept={PROPOSAL_COVER_ACCEPT}
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              className="text-body-sm text-text-primary file:border-border file:bg-surface-muted file:text-body-sm file:mr-4 file:rounded-md file:border file:px-4 file:py-2"
            />
          )}
        </Field>

        <Field label={labels.coverAltLabel} hint={labels.coverAltHint} error={altError}>
          {({ id, describedBy, invalid }) => (
            <input
              id={id}
              name="coverAlt"
              type="text"
              maxLength={200}
              aria-invalid={invalid}
              {...(describedBy ? { 'aria-describedby': describedBy } : {})}
              className={FIELD}
            />
          )}
        </Field>
      </div>
    </Card>
  );
}
