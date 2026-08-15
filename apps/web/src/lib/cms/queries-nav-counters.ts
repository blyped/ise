import { createSupabaseServerClient } from '@/lib/supabase/server';
import { toCmsNavCounters, type CmsNavCounters } from './nav-counters';

/**
 * Ecarts d'exposition comptes dans le menu du CMS (0139).
 *
 * UN SEUL ALLER-RETOUR par rendu du gabarit : `cms_nav_counters()`
 * renvoie tous les ecarts d'un coup, plutot qu'une requete par entree de
 * menu. La fonction est `stable` et chaque comptage s'appuie sur un index
 * qui ne couvre que la matiere exposee.
 *
 * PERMISSIONS : le filtrage est fait EN BASE, pas ici. Un ecart hors
 * permission de l'appelant est absent de la reponse — l'interface ne peut
 * donc pas afficher, ni meme deviner, un compteur qu'elle n'a pas le
 * droit de connaitre.
 *
 * Cette lecture orne la navigation : elle ne doit JAMAIS faire echouer un
 * ecran du CMS. En cas d'erreur, aucun compteur — le menu s'affiche
 * exactement comme avant.
 */
export async function loadCmsNavCounters(): Promise<CmsNavCounters> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('cms_nav_counters', {});

  if (error) {
    console.error('[ISE] lecture des compteurs du menu CMS en echec', { code: error.code });
    return {};
  }
  return toCmsNavCounters(data);
}
