/**
 * Alias metier lisibles. Ces types sont ecrits a la main pour les tranches
 * verticales en cours et seront remplaces, table par table, par les types
 * generes des que `pnpm --filter @ise/db-types generate` aura ete execute.
 *
 * Ils refletent exactement les migrations 0001 a 0006.
 */
export type VisibilityLevel = 'private' | 'connections' | 'promotion' | 'members';
export type ProfileType = 'graduate' | 'student';
export type ProfileStatus = 'referenced' | 'active' | 'suspended' | 'archived';
export type ClaimStatus = 'unclaimed' | 'claim_pending' | 'claimed';
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type SkillLevel = 'notion' | 'intermediate' | 'advanced' | 'expert';
export type LanguageProficiency = 'basic' | 'intermediate' | 'professional' | 'fluent' | 'native';

export interface IseProfile {
  id: string;
  user_id: string | null;
  promotion_id: number | null;
  first_name: string;
  middle_names: string | null;
  last_name: string;
  display_name: string;
  normalized_name: string | null;
  profile_type: ProfileType;
  student_number: string | null;
  headline: string | null;
  bio: string | null;
  avatar_path: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  current_position: string | null;
  current_organization_id: string | null;
  current_organization_raw: string | null;
  current_country_code: string | null;
  current_city: string | null;
  profile_status: ProfileStatus;
  claim_status: ClaimStatus;
  verification_status: VerificationStatus;
  verification_level: string | null;
  profile_completion: number;
  onboarding_completed_at: string | null;
  claimed_at: string | null;
  verified_at: string | null;
  last_confirmed_at: string | null;
  last_active_at: string | null;
  is_test_account: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Promotion {
  id: number;
  program_code: string;
  graduation_year: number;
  name: string;
  description: string | null;
  estimated_size: number | null;
  cover_image_path: string | null;
  status: 'active' | 'archived';
}

export interface Skill {
  id: number;
  category_id: number;
  code: string | null;
  name: string;
  slug: string;
  description: string | null;
  source: 'doc20' | 'doc19' | 'admin' | 'import';
  is_active: boolean;
}

export interface Sector {
  id: number;
  parent_id: number | null;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface Country {
  code: string;
  name_fr: string;
  name_en: string | null;
  subregion_code: string | null;
  is_active: boolean;
}

export interface AvailabilityType {
  code: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface Connection {
  profile_a_id: string;
  profile_b_id: string;
  request_id: string | null;
  connected_at: string;
  context: string | null;
}

export interface ConnectionRequest {
  id: string;
  requester_profile_id: string;
  addressee_profile_id: string;
  message: string | null;
  context: string | null;
  status: 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'expired';
  responded_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface IntroductionRequest {
  id: string;
  requester_profile_id: string;
  intermediary_profile_id: string;
  target_profile_id: string;
  purpose: string;
  message_to_intermediary: string;
  message_to_target: string | null;
  status:
    | 'requested'
    | 'intermediary_accepted'
    | 'intermediary_declined'
    | 'withdrawn'
    | 'expired'
    | 'introduced'
    | 'target_responded'
    | 'completed'
    | 'no_outcome';
  outcome: string | null;
  expires_at: string;
  created_at: string;
}
