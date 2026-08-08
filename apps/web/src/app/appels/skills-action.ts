'use server';

import { newCorrelationId } from '@/lib/correlation';
import { searchSkills } from '@/lib/queries/reference';
import type { TokenOption } from '@ise/ui-web';

/**
 * Recherche de competences pour l'assistant d'appel (ISE-050).
 *
 * La recherche est faite EN BASE (`public.search_skills`, 0035) : alias
 * resolus, regroupement par domaine, aucune liste de 543 competences
 * embarquee dans le bundle client.
 */
export async function searchCallSkillsAction(query: string): Promise<TokenOption[]> {
  const correlationId = newCorrelationId();
  const result = await searchSkills(query, 40, correlationId);
  if (!result.ok) return [];
  return result.data.map((skill) => ({
    value: String(skill.skillId),
    label: skill.name,
    group: skill.domainName,
    hint: skill.categoryName,
  }));
}
