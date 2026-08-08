import { toBusinessError, type BusinessError } from '@ise/domain';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * ISE-037 — profil d'un autre ISE.
 *
 * Une seule lecture, `public.get_member_profile(uuid)` (migration 0035).
 *
 * POURQUOI UNE RPC ET PAS DES `select` :
 *  - la politique `ise_profiles_select` filtre des LIGNES ; elle ne sait
 *    pas qu'un membre a place sa ville en `connections` et son LinkedIn
 *    en `promotion` ;
 *  - la table `profile_visibility` porte la politique
 *    `profile_visibility_own` : le visiteur ne peut meme pas LIRE les
 *    reglages de la personne consultee pour savoir quoi masquer ;
 *  - masquer cote interface reviendrait a « renvoyer puis masquer », ce
 *    que le MASTER PROMPT §47 interdit explicitement.
 *
 * Consequence concrete : un champ non autorise est ABSENT de la reponse
 * reseau. `visibleFields` dit ce qui a ete autorise, ce qui permet de
 * distinguer « non communique » de « non renseigne » sans deviner.
 */

export type QueryResult<T> = { ok: true; data: T } | { ok: false; error: BusinessError };

export interface ProfileSkillView {
  id: number;
  name: string;
  /** Niveau DECLARATIF (D-75). `null` = non declare. */
  level: 'notion' | 'intermediate' | 'advanced' | 'expert' | null;
  yearsExperience: number | null;
  isPrimary: boolean;
}

export interface NamedRef {
  id: number;
  name: string;
}

export interface ProfileLanguageView {
  code: string;
  name: string;
  proficiency: string | null;
}

export interface ProfileAvailabilityView {
  code: string;
  name: string;
  description: string | null;
}

export interface ProfileExperienceView {
  id: string;
  positionTitle: string;
  organization: string | null;
  sector: string | null;
  jobFunction: string | null;
  country: string | null;
  city: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
}

export interface ProfileEducationView {
  id: string;
  institution: string;
  degree: string | null;
  fieldOfStudy: string | null;
  startYear: number | null;
  endYear: number | null;
}

export interface ProfilePromotionView {
  id: number;
  name: string;
  label: string;
  graduationYear: number | null;
}

/**
 * Contexte relationnel (D-51 : degre 1 uniquement, signaux explicites).
 * Aucune donnee deduite, aucun message prive analyse.
 */
export interface ProfileRelationship {
  isConnected: boolean;
  sharesPromotion: boolean;
  sharesOrganization: boolean;
  sharedOrganizationName: string | null;
  mutualConnectionCount: number;
}

export interface MemberProfileView {
  profileId: string;
  displayName: string;
  verificationStatus: string;
  profileStatus: string;
  claimStatus: string;
  isSelf: boolean;

  headline: string | null;
  bio: string | null;
  avatarPath: string | null;
  currentPosition: string | null;
  currentOrganization: string | null;
  currentCity: string | null;
  currentCountry: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;

  promotion: ProfilePromotionView | null;
  skills: ProfileSkillView[];
  sectors: NamedRef[];
  jobFunctions: NamedRef[];
  expertiseAreas: NamedRef[];
  languages: ProfileLanguageView[];
  tools: NamedRef[];
  experienceCountries: { code: string; name: string }[];
  experiences: ProfileExperienceView[];
  educations: ProfileEducationView[];
  availabilities: ProfileAvailabilityView[];

  relationship: ProfileRelationship;
  /** Cles de champ effectivement autorisees par le proprietaire. */
  visibleFields: string[];
}

/* ------------------------------------------------------------------ */
/* Conversions defensives                                              */
/* ------------------------------------------------------------------ */

type Json = Record<string, unknown>;

const asObject = (value: unknown): Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : {};

const asArray = (value: unknown): Json[] =>
  Array.isArray(value) ? value.map(asObject).filter((item) => Object.keys(item).length > 0) : [];

const str = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const num = (value: unknown): number | null => (typeof value === 'number' ? value : null);
const bool = (value: unknown): boolean => value === true;

const LEVELS = ['notion', 'intermediate', 'advanced', 'expert'] as const;
type Level = (typeof LEVELS)[number];
const level = (value: unknown): Level | null =>
  typeof value === 'string' && (LEVELS as readonly string[]).includes(value)
    ? (value as Level)
    : null;

function toNamedRefs(value: unknown): NamedRef[] {
  return asArray(value).flatMap((item) => {
    const id = num(item['id']);
    const name = str(item['name']);
    return id !== null && name !== null ? [{ id, name }] : [];
  });
}

function toView(payload: Json): MemberProfileView {
  const relationship = asObject(payload['relationship']);

  return {
    profileId: str(payload['profile_id']) ?? '',
    displayName: str(payload['display_name']) ?? '',
    verificationStatus: str(payload['verification_status']) ?? 'unverified',
    profileStatus: str(payload['profile_status']) ?? 'referenced',
    claimStatus: str(payload['claim_status']) ?? 'unclaimed',
    isSelf: bool(payload['is_self']),

    headline: str(payload['headline']),
    bio: str(payload['bio']),
    avatarPath: str(payload['avatar_path']),
    currentPosition: str(payload['current_position']),
    currentOrganization: str(payload['current_organization']),
    currentCity: str(payload['current_city']),
    currentCountry: str(payload['current_country']),
    linkedinUrl: str(payload['linkedin_url']),
    websiteUrl: str(payload['website_url']),

    promotion: (() => {
      const raw = asObject(payload['promotion']);
      const id = num(raw['id']);
      const label = str(raw['label']);
      if (id === null) return null;
      return {
        id,
        name: str(raw['name']) ?? '',
        label: label ?? '',
        graduationYear: num(raw['graduation_year']),
      };
    })(),

    skills: asArray(payload['skills']).flatMap((item) => {
      const id = num(item['id']);
      const name = str(item['name']);
      if (id === null || name === null) return [];
      return [
        {
          id,
          name,
          level: level(item['level']),
          yearsExperience: num(item['years_experience']),
          isPrimary: bool(item['is_primary']),
        },
      ];
    }),

    sectors: toNamedRefs(payload['sectors']),
    jobFunctions: toNamedRefs(payload['job_functions']),
    expertiseAreas: toNamedRefs(payload['expertise_areas']),
    tools: toNamedRefs(payload['tools']),

    languages: asArray(payload['languages']).flatMap((item) => {
      const code = str(item['code']);
      const name = str(item['name']);
      return code !== null && name !== null
        ? [{ code, name, proficiency: str(item['proficiency']) }]
        : [];
    }),

    experienceCountries: asArray(payload['experience_countries']).flatMap((item) => {
      const code = str(item['code']);
      const name = str(item['name']);
      return code !== null && name !== null ? [{ code, name }] : [];
    }),

    experiences: asArray(payload['experiences']).flatMap((item) => {
      const id = str(item['id']);
      const title = str(item['position_title']);
      if (id === null || title === null) return [];
      return [
        {
          id,
          positionTitle: title,
          organization: str(item['organization']),
          sector: str(item['sector']),
          jobFunction: str(item['job_function']),
          country: str(item['country']),
          city: str(item['city']),
          startDate: str(item['start_date']),
          endDate: str(item['end_date']),
          isCurrent: bool(item['is_current']),
        },
      ];
    }),

    educations: asArray(payload['educations']).flatMap((item) => {
      const id = str(item['id']);
      const institution = str(item['institution']);
      if (id === null || institution === null) return [];
      return [
        {
          id,
          institution,
          degree: str(item['degree']),
          fieldOfStudy: str(item['field_of_study']),
          startYear: num(item['start_year']),
          endYear: num(item['end_year']),
        },
      ];
    }),

    availabilities: asArray(payload['availabilities']).flatMap((item) => {
      const code = str(item['code']);
      const name = str(item['name']);
      return code !== null && name !== null
        ? [{ code, name, description: str(item['description']) }]
        : [];
    }),

    relationship: {
      isConnected: bool(relationship['is_connected']),
      sharesPromotion: bool(relationship['shares_promotion']),
      sharesOrganization: bool(relationship['shares_organization']),
      sharedOrganizationName: str(relationship['shared_organization_name']),
      mutualConnectionCount: num(relationship['mutual_connection_count']) ?? 0,
    },

    visibleFields: Array.isArray(payload['visible_fields'])
      ? payload['visible_fields'].filter((entry): entry is string => typeof entry === 'string')
      : [],
  };
}

/**
 * `null` couvre indistinctement : profil inexistant, supprime, suspendu,
 * ou **bloque dans un sens ou dans l'autre**. C'est volontaire : la
 * reponse ne doit pas permettre de distinguer « ce profil n'existe pas »
 * de « ce membre vous a bloque ».
 */
export async function loadMemberProfile(
  profileId: string,
  correlationId: string,
): Promise<QueryResult<MemberProfileView | null>> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc('get_member_profile', {
    p_profile_id: profileId,
  });

  if (error) {
    console.error('[ISE] lecture du profil membre en echec', {
      correlationId,
      code: error.code,
    });
    return { ok: false, error: toBusinessError(error, correlationId) };
  }

  if (data === null || data === undefined) return { ok: true, data: null };

  const payload = asObject(data);
  if (typeof payload['profile_id'] !== 'string') return { ok: true, data: null };

  return { ok: true, data: toView(payload) };
}

/**
 * URL signee de l'avatar. Le bucket `avatars` est PRIVE (0027) : aucune
 * URL publique n'existe. La signature est demandee cote serveur, apres
 * que `get_member_profile()` a confirme que la photo est visible — si le
 * champ n'etait pas autorise, `avatarPath` est `null` et on n'arrive
 * meme pas ici. Un echec de signature retombe sur les initiales.
 */
export async function signedAvatarUrl(avatarPath: string | null): Promise<string | undefined> {
  if (avatarPath === null || avatarPath.length === 0) return undefined;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.storage.from('avatars').createSignedUrl(avatarPath, 300);
  if (error || !data?.signedUrl) return undefined;
  return data.signedUrl;
}

/** Format d'identifiant attendu : un uuid, rien d'autre. */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
