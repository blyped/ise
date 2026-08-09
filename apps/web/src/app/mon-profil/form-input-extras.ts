import { blankToUndefined } from './form-input';

/**
 * Normalisation des `FormData` des ecrans ISE-024 -> ISE-033.
 *
 * Comme `form-input.ts`, ce module est importe PAR LE CLIENT ET PAR LE
 * SERVEUR : le schema Zod recoit exactement la meme entree des deux
 * cotes (MASTER PROMPT §62).
 */

function toIdList(formData: FormData, name: string): number[] {
  return formData
    .getAll(name)
    .map((value) => Number(String(value)))
    .filter((value) => Number.isFinite(value));
}

/* ISE-024 — positionnement. */
export function toPositioningInput(formData: FormData) {
  const primary = blankToUndefined(formData.get('primarySectorId'));
  return {
    sectorIds: toIdList(formData, 'sectorIds'),
    primarySectorId: primary === undefined ? undefined : Number(primary),
    functionIds: toIdList(formData, 'functionIds'),
    expertiseAreaIds: toIdList(formData, 'expertiseAreaIds'),
  };
}

/* ISE-026 — projet. */
export function toProjectInput(formData: FormData) {
  const sectorId = blankToUndefined(formData.get('sectorId'));
  return {
    title: formData.get('title') ?? '',
    organizationNameRaw: blankToUndefined(formData.get('organizationNameRaw')),
    role: blankToUndefined(formData.get('role')),
    sectorId: sectorId === undefined ? undefined : Number(sectorId),
    countryCode: blankToUndefined(formData.get('countryCode')),
    startDate: blankToUndefined(formData.get('startDate')),
    endDate: blankToUndefined(formData.get('endDate')),
    summary: blankToUndefined(formData.get('summary')),
    outcome: blankToUndefined(formData.get('outcome')),
    linkUrl: blankToUndefined(formData.get('linkUrl')),
    visibility: formData.get('visibility') ?? 'members',
  };
}

/*
 * ISE-027 — les trois listes sont postees en champs repetes
 * `code:valeur` (ex. `fr:native`, `12:advanced`) : un format stable,
 * decode identiquement ici pour le client et le serveur.
 */
export function toLanguagesInput(formData: FormData) {
  return {
    entries: formData.getAll('languageEntries').map((raw) => {
      const [languageCode = '', proficiency = ''] = String(raw).split(':');
      return { languageCode, proficiency };
    }),
  };
}

export function toGeographiesInput(formData: FormData) {
  return { countryCodes: formData.getAll('countryCodes').map((raw) => String(raw)) };
}

export function toToolsInput(formData: FormData) {
  return {
    entries: formData.getAll('toolEntries').map((raw) => {
      const [toolId = '', proficiency = ''] = String(raw).split(':');
      return {
        toolId: Number(toolId),
        proficiency: proficiency === '' ? undefined : proficiency,
      };
    }),
  };
}

/* ISE-029 — demande de recommandation. */
export function toRecommendationRequestInput(formData: FormData) {
  const skillId = blankToUndefined(formData.get('skillId'));
  return {
    recipientProfileId: formData.get('recipientProfileId') ?? '',
    skillId: skillId === undefined ? undefined : Number(skillId),
    relationship: formData.get('relationship') ?? '',
    context: blankToUndefined(formData.get('context')),
    message: formData.get('message') ?? '',
  };
}

/* ISE-028 — acceptation (= redaction) d'une demande recue. */
export function toRecommendationAcceptInput(formData: FormData) {
  const skillId = blankToUndefined(formData.get('skillId'));
  return {
    requestId: formData.get('requestId') ?? '',
    relationshipContext: formData.get('relationshipContext') ?? '',
    engagementContext: blankToUndefined(formData.get('engagementContext')),
    skillId: skillId === undefined ? undefined : Number(skillId),
    body: formData.get('body') ?? '',
    visibility: formData.get('visibility') ?? 'members',
  };
}

/* ISE-033 — disponibilite. */
export function toAvailabilityInput(formData: FormData) {
  const maxPerMonth = blankToUndefined(formData.get('maxPerMonth'));
  const idealDelayDays = blankToUndefined(formData.get('idealDelayDays'));
  return {
    activeTypes: formData.getAll('activeTypes').map((raw) => String(raw)),
    maxPerMonth: maxPerMonth === undefined ? undefined : Number(maxPerMonth),
    idealDelayDays: idealDelayDays === undefined ? undefined : Number(idealDelayDays),
    preferredChannel: blankToUndefined(formData.get('preferredChannel')),
    visibility: formData.get('visibility') ?? 'members',
    notes: blankToUndefined(formData.get('notes')),
  };
}
