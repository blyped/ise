import { AVAILABILITY_ROUTES, PROFILE_ROUTES } from '@/lib/routes/onboarding';

/**
 * ISE-030 / ISE-031 — chaque bloc de `profile_completion_rules` pointe
 * vers l'ecran d'edition REEL qui permet de le completer. Aucun bouton
 * decoratif : un bloc inconnu renvoie vers la vue d'ensemble du profil.
 */
export function profileBlockRoute(blockKey: string): string {
  switch (blockKey) {
    case 'identity':
    case 'photo':
    case 'bio':
    case 'current_situation':
      return PROFILE_ROUTES.header;
    case 'skills':
      return PROFILE_ROUTES.skills;
    case 'experiences':
      return PROFILE_ROUTES.experiences;
    case 'education':
      return PROFILE_ROUTES.educations;
    case 'sectors':
      return PROFILE_ROUTES.positioning;
    case 'experience_countries':
    case 'languages':
    case 'tools':
      return PROFILE_ROUTES.languagesZones;
    case 'availability':
    case 'network_contribution':
      return AVAILABILITY_ROUTES.edit;
    default:
      return PROFILE_ROUTES.overview;
  }
}

/**
 * Poids reel du bloc -> etiquette d'impact. Le seuil est documente ici :
 * `weight >= 10` sur 100 = « Fort », `>= 5` = « Moyen », sinon « Utile ».
 * Jamais un classement entre membres (D-72, MASTER PROMPT §17).
 */
export function impactLevel(weight: number): 'strong' | 'medium' | 'light' {
  if (weight >= 10) return 'strong';
  if (weight >= 5) return 'medium';
  return 'light';
}
