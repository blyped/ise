import { createSupabaseServerClient } from '@/lib/supabase/server';
import { toAdminNavCounters, type AdminNavCounters } from './nav-counters';

/**
 * Compteurs des files d'attente du menu d'administration (0138).
 *
 * UN SEUL ALLER-RETOUR par rendu du gabarit : `admin_nav_counters()`
 * renvoie toutes les files d'un coup, plutot qu'une requete par entree
 * de menu. La fonction est `stable` et chaque comptage s'appuie sur un
 * index de sa propre file.
 *
 * PERMISSIONS : le filtrage est fait EN BASE, pas ici. Une file hors
 * permission de l'appelant est absente de la reponse — l'interface ne
 * peut donc pas afficher, ni meme deviner, un compteur qu'elle n'a pas
 * le droit de connaitre.
 *
 * Cette lecture orne la navigation : elle ne doit JAMAIS faire echouer
 * un ecran d'administration. En cas d'erreur, aucun compteur — le menu
 * s'affiche exactement comme avant.
 */
export async function loadAdminNavCounters(): Promise<AdminNavCounters> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('admin_nav_counters', {});

  if (error) {
    console.error('[ISE] lecture des compteurs du menu admin en echec', { code: error.code });
    return {};
  }
  return toAdminNavCounters(data);
}
