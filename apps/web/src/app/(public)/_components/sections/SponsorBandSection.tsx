import type { LandingPartnerCampaign, LandingSection } from '@/lib/public/landing-data';
import { SponsorBand } from '../SponsorBand';

/**
 * 0133 — enveloppe serveur du bandeau sponsorise (bas de la page d'accueil).
 *
 * Trois decisions tiennent dans ce fichier :
 *
 *  1. **Aucune image n'est fabriquee par le code.** Une campagne 'footer'
 *     sans visuel Desktop ni visuel Mobile n'est pas un bandeau : elle est
 *     ecartee. Le CMS peut donc enregistrer une campagne avant d'avoir son
 *     image, sans qu'un rectangle vide n'apparaisse sur la vitrine.
 *
 *  2. **Pas de section fantome.** Sans aucun bandeau diffusable, le composant
 *     ne rend RIEN : ni cadre, ni titre, ni etat vide. Le bas de page reste
 *     exactement ce qu'il etait avant 0133. C'est aussi ce qui se passe quand
 *     la projection est en panne : `section.items` est alors vide, et une
 *     bande d'erreur en pied de page n'apprendrait rien a personne.
 *
 *  3. **La periode de diffusion est deja tranchee en base.**
 *     `get_landing_partners()` filtre sur `start_at <= now() < end_at` : la
 *     liste recue est la liste diffusable, il n'y a rien a re-filtrer ici.
 */
export function SponsorBandSection({
  section,
}: {
  section: LandingSection<LandingPartnerCampaign>;
}) {
  const banners = section.items.filter(
    (campaign) => campaign.media !== null || campaign.mobileMedia !== null,
  );
  if (banners.length === 0) return null;

  return <SponsorBand campaigns={banners} />;
}
