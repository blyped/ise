/**
 * Normalisation des `FormData` des ecrans de profil.
 *
 * Ce module est importe PAR LE CLIENT ET PAR LE SERVEUR : c'est ce qui
 * garantit que le schema Zod recoit exactement la meme entree des deux
 * cotes (MASTER PROMPT §62). Une divergence ici produirait une validation
 * client permissive et une erreur serveur incomprehensible.
 */

/** Un `select` vide poste `''` : ce n'est pas une valeur, c'est une absence. */
export function blankToUndefined(value: FormDataEntryValue | null): string | undefined {
  if (value === null) return undefined;
  const text = String(value).trim();
  return text.length === 0 ? undefined : text;
}

export function checkboxToBoolean(value: FormDataEntryValue | null): boolean {
  return value === 'on' || value === 'true';
}

export function toHeaderInput(formData: FormData) {
  return {
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    headline: blankToUndefined(formData.get('headline')),
    bio: blankToUndefined(formData.get('bio')),
    currentPosition: blankToUndefined(formData.get('currentPosition')),
    currentOrganizationId: blankToUndefined(formData.get('currentOrganizationId')),
    currentOrganizationRaw: blankToUndefined(formData.get('currentOrganizationRaw')),
    currentCountryCode: blankToUndefined(formData.get('currentCountryCode')),
    currentCity: blankToUndefined(formData.get('currentCity')),
    linkedinUrl: formData.get('linkedinUrl') === null ? '' : String(formData.get('linkedinUrl')),
    websiteUrl: formData.get('websiteUrl') === null ? '' : String(formData.get('websiteUrl')),
  };
}

export function toExperienceInput(formData: FormData) {
  const sectorId = blankToUndefined(formData.get('sectorId'));
  const jobFunctionId = blankToUndefined(formData.get('jobFunctionId'));
  return {
    organizationId: blankToUndefined(formData.get('organizationId')),
    organizationNameRaw: blankToUndefined(formData.get('organizationNameRaw')),
    positionTitle: formData.get('positionTitle'),
    sectorId: sectorId === undefined ? undefined : Number(sectorId),
    jobFunctionId: jobFunctionId === undefined ? undefined : Number(jobFunctionId),
    countryCode: blankToUndefined(formData.get('countryCode')),
    city: blankToUndefined(formData.get('city')),
    startDate: formData.get('startDate') ?? '',
    endDate: blankToUndefined(formData.get('endDate')),
    isCurrent: checkboxToBoolean(formData.get('isCurrent')),
    description: blankToUndefined(formData.get('description')),
    visibility: formData.get('visibility') ?? 'members',
  };
}

export function toEducationInput(formData: FormData) {
  return {
    educationType: formData.get('educationType') ?? 'academic',
    institution: formData.get('institution'),
    degree: formData.get('degree'),
    fieldOfStudy: formData.get('fieldOfStudy') ?? '',
    countryCode: formData.get('countryCode') ?? '',
    city: formData.get('city') ?? '',
    startYear: blankToUndefined(formData.get('startYear')) ?? '',
    endYear: blankToUndefined(formData.get('endYear')) ?? '',
    credentialUrl: formData.get('credentialUrl') ?? '',
    description: formData.get('description') ?? '',
    visibility: formData.get('visibility') ?? 'members',
  };
}

export function toProfileSkillInput(formData: FormData) {
  const years = blankToUndefined(formData.get('yearsExperience'));
  const level = blankToUndefined(formData.get('level'));
  return {
    skillId: formData.get('skillId'),
    level,
    yearsExperience: years === undefined ? undefined : Number(years),
    isPrimary: checkboxToBoolean(formData.get('isPrimary')),
    context: blankToUndefined(formData.get('context')),
  };
}
