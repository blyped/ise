import type { BusinessError } from '@ise/domain';
import { criteriaToQueryString, type SearchCriteria } from '@/lib/search-criteria';
import { loadProfileHeader, loadProfileSectors } from '@/lib/queries/profile-sections';
import { loadConnections } from '@/lib/queries/network';
import { runRelevanceSearch, type SearchResultRow } from '@/lib/queries/search';

/**
 * ISE-015 — module « ISE que vous pourriez connaître » du tableau de bord
 * (D-199).
 *
 * Il n'existe pas de RPC « recommande-moi des gens » independante du
 * moteur de recherche (voir docs/decisions.md, D-199, pour l'inventaire
 * des routines ecartees : `list_recommended_mentors` est reservee au
 * mentorat, `profile_match_set` est le moteur PRIVE derriere
 * `match_profiles`, les fonctions `*recommendation*` gerent les
 * temoignages, pas la decouverte). Ce module derive donc des CRITERES
 * RAISONNABLES depuis le profil du membre connecte — meme secteur
 * declare et/ou meme pays de residence — et reutilise `runRelevanceSearch`
 * (donc `public.match_profiles()`, le meme moteur qu'ISE-035), en excluant
 * les profils deja en relation. Aucune donnee de matching n'est recalculee
 * ici : la RPC reste seule a produire le libelle et les raisons (D-42, D-43).
 */

export type QueryResult<T> = { ok: true; data: T } | { ok: false; error: BusinessError };

export interface PeopleYouMayKnow {
  rows: SearchResultRow[];
  /**
   * Chaine de criteres deja serialisee (voir `criteriaToQueryString`), pour
   * que le lien « Voir tout » ouvre `/rechercher/resultats` avec les MEMES
   * criteres que ceux utilises ici — jamais une recherche vide.
   */
  queryString: string;
  /** `true` si ni secteur ni pays n'ont pu etre derives : rien n'a ete demande a la base. */
  noCriteria: boolean;
}

const EMPTY: PeopleYouMayKnow = { rows: [], queryString: '', noCriteria: true };

/**
 * Lecture composite : profil (secteur, pays), relations existantes, puis
 * recherche par pertinence. Chaque lecture intermediaire est individuellement
 * tolerante — une lecture manquee degrade le critere plutot que de faire
 * echouer tout le module (MASTER PROMPT §47) : voir le detail ligne par ligne
 * ci-dessous.
 */
export async function loadPeopleYouMayKnow(
  userId: string,
  profileId: string,
  correlationId: string,
  limit = 4,
): Promise<QueryResult<PeopleYouMayKnow>> {
  const [header, sectors, connections] = await Promise.all([
    loadProfileHeader(userId, correlationId),
    loadProfileSectors(profileId, correlationId),
    // Premiere page seulement (20 relations au plus) : suffisant pour ne
    // pas re-suggerer les relations les plus recentes/actives sur un
    // encart de 3-4 cartes. Une exclusion exhaustive demanderait de
    // paginer l'integralite des relations pour un gain marginal ici
    // (D-199).
    loadConnections(null, null, correlationId),
  ]);

  const countryCode =
    header.ok && header.data !== null ? header.data.currentCountryCode : null;
  const sectorId = sectors.ok && sectors.data.length > 0 ? sectors.data[0]!.sectorId : null;
  const excludeProfileIds = connections.ok
    ? connections.data.rows.map((row) => row.profile.profileId)
    : [];

  if (countryCode === null && sectorId === null) {
    // Rien a demander a la base : ni le secteur ni le pays ne sont connus
    // (profil incomplet, ou les deux lectures ont echoue). Un critere vide
    // renverrait un ensemble non filtre, sans rapport avec « des ISE que
    // vous pourriez connaitre » — on affiche l'etat vide plutot (D-199).
    return { ok: true, data: EMPTY };
  }

  const criteria: SearchCriteria = {
    skillIds: [],
    sectorIds: sectorId !== null ? [sectorId] : [],
    jobFunctionIds: [],
    countryCodes: countryCode !== null ? [countryCode] : [],
    subregionCodes: [],
    promotionIds: [],
    languageCodes: [],
    availabilityTypes: [],
    pageSize: limit,
  };

  const page = await runRelevanceSearch(criteria, null, correlationId, excludeProfileIds);
  if (!page.ok) {
    return { ok: false, error: page.error };
  }

  return {
    ok: true,
    data: {
      rows: page.data.rows,
      queryString: criteriaToQueryString(criteria),
      noCriteria: false,
    },
  };
}
