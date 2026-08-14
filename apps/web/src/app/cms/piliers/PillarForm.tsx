'use client';

import { useState } from 'react';
import { t } from '@/i18n/fr';
import { frCms } from '@/i18n/cms';
import type { CmsMediaOption, CmsPillarLinkTarget } from '@/lib/cms/types';
import { CMS_INPUT_CLASS, CMS_TEXTAREA_CLASS, CmsField, CmsForm } from '../_components/CmsForm';
import type { CmsAction } from '../_components/ActionButton';

const LINK_TARGET_KEYS: readonly CmsPillarLinkTarget[] = [
  'search',
  'calls',
  'projects',
  'opportunities',
  'applications',
];

/**
 * Bornes reprises telles quelles des contraintes CHECK de 0129
 * (`cms_pillars_title_check`, `cms_pillars_body_check`). Le navigateur
 * empeche de depasser, la base refuse quand meme si on l'a contourne : la
 * limite n'est pas qu'une politesse d'affichage.
 */
const TITLE_MAX = 60;
const BODY_MAX = 280;
/** Legende : limite historique du formulaire (0114), inchangee. */
const CAPTION_MAX = 280;

/**
 * Compteur de caracteres restants, meme forme que sur les champs libres du
 * profil (PublicShowcaseForm) : annonce aux lecteurs d'ecran seulement a
 * l'approche de la limite, une annonce a chaque frappe serait inutilisable.
 */
function CharacterCounter({ used, max }: { used: number; max: number }) {
  const remaining = max - used;
  return (
    <p
      className="text-caption text-text-muted self-end"
      aria-live={remaining <= 40 ? 'polite' : 'off'}
    >
      {/* 0 et 1 prennent le singulier en francais : « 0 caractere restant ». */}
      {t(remaining <= 1 ? frCms.pillars.charactersLeft : frCms.pillars.charactersLeftPlural, {
        count: remaining,
      })}
    </p>
  );
}

export interface PillarFormProps {
  action: CmsAction;
  pillarKey: string;
  currentTitle: string | null;
  currentBody: string | null;
  currentMediaId: string | null;
  currentCaption: string | null;
  currentLinkTarget: string | null;
  mediaOptions: readonly CmsMediaOption[];
  canEdit: boolean;
}

/**
 * CMS-011 (0114, etendu par 0129) — formulaire d'UN pilier : titre, texte,
 * visuel, legende optionnelle, lien. Repris du patron `CoverMediaForm`
 * (media puise dans la mediatheque publique, jamais un chemin recopie a la
 * main), avec quatre champs de plus puisque tout voyage ensemble dans un
 * seul appel a `set_landing_pillar`.
 *
 * Titre et texte se comportent comme la legende : champ libre, borne
 * annoncee, compteur de caracteres restants. La difference est dite dans
 * l'aide du champ — vider la legende la supprime, vider le titre ou le
 * texte remet la valeur d'origine, parce qu'un encart sans titre serait
 * une carte vide sur la page d'accueil.
 */
export function PillarForm({
  action,
  pillarKey,
  currentTitle,
  currentBody,
  currentMediaId,
  currentCaption,
  currentLinkTarget,
  mediaOptions,
  canEdit,
}: PillarFormProps) {
  const [titleLength, setTitleLength] = useState((currentTitle ?? '').length);
  const [bodyLength, setBodyLength] = useState((currentBody ?? '').length);
  const [captionLength, setCaptionLength] = useState((currentCaption ?? '').length);

  return (
    <CmsForm
      action={action}
      submitLabel={frCms.pillars.submit}
      disabled={!canEdit}
      disabledReason={frCms.common.forbidden}
    >
      {(errors) => (
        <>
          <input type="hidden" name="pillarKey" value={pillarKey} />

          <CmsField
            name="title"
            label={frCms.pillars.fieldTitle}
            hint={frCms.pillars.fieldTitleHint}
            error={errors['title']}
          >
            {(props) => (
              <div className="flex flex-col gap-2">
                <input
                  {...props}
                  type="text"
                  maxLength={TITLE_MAX}
                  defaultValue={currentTitle ?? ''}
                  className={CMS_INPUT_CLASS}
                  onChange={(event) => setTitleLength(event.currentTarget.value.length)}
                />
                <CharacterCounter used={titleLength} max={TITLE_MAX} />
              </div>
            )}
          </CmsField>

          <CmsField
            name="body"
            label={frCms.pillars.fieldBody}
            hint={frCms.pillars.fieldBodyHint}
            error={errors['body']}
          >
            {(props) => (
              <div className="flex flex-col gap-2">
                <textarea
                  {...props}
                  rows={3}
                  maxLength={BODY_MAX}
                  defaultValue={currentBody ?? ''}
                  className={CMS_TEXTAREA_CLASS}
                  onChange={(event) => setBodyLength(event.currentTarget.value.length)}
                />
                <CharacterCounter used={bodyLength} max={BODY_MAX} />
              </div>
            )}
          </CmsField>

          <CmsField
            name="mediaId"
            label={frCms.pillars.fieldMedia}
            hint={frCms.pillars.fieldMediaHint}
            error={errors['mediaId']}
          >
            {(props) => (
              <select {...props} defaultValue={currentMediaId ?? ''} className={CMS_INPUT_CLASS}>
                <option value="">{frCms.pillars.fieldMediaNone}</option>
                {mediaOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.filename} — {option.altText}
                  </option>
                ))}
              </select>
            )}
          </CmsField>

          <CmsField
            name="caption"
            label={frCms.pillars.fieldCaption}
            hint={frCms.pillars.fieldCaptionHint}
            error={errors['caption']}
          >
            {(props) => (
              <div className="flex flex-col gap-2">
                <textarea
                  {...props}
                  rows={2}
                  maxLength={CAPTION_MAX}
                  defaultValue={currentCaption ?? ''}
                  className={CMS_TEXTAREA_CLASS}
                  onChange={(event) => setCaptionLength(event.currentTarget.value.length)}
                />
                <CharacterCounter used={captionLength} max={CAPTION_MAX} />
              </div>
            )}
          </CmsField>

          <CmsField
            name="linkTarget"
            label={frCms.pillars.fieldLink}
            error={errors['linkTarget']}
          >
            {(props) => (
              <select
                {...props}
                defaultValue={currentLinkTarget ?? ''}
                className={CMS_INPUT_CLASS}
              >
                <option value="">{frCms.pillars.fieldLinkNone}</option>
                {LINK_TARGET_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {frCms.pillars.linkOptions[key] ?? key}
                  </option>
                ))}
              </select>
            )}
          </CmsField>
        </>
      )}
    </CmsForm>
  );
}
