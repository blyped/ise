import { EmptyState } from '@ise/ui-web';
import { fr } from '@/i18n/fr';
import { frPublic } from '@/i18n/public';
import type { LandingSection, LandingSlide } from '@/lib/public/landing-data';
import { LandingCarousel } from '../LandingCarousel';
import { SectionShell } from './SectionShell';

/**
 * Zone haute de PUB-001.
 *
 * Le carrousel n'est rendu que s'il a du contenu : un carrousel vide avec des
 * fleches inertes serait un decor. A defaut, l'etat vide dit ce qui manque et
 * pourquoi (MASTER PROMPT §113), et une projection en panne le dit autrement
 * qu'une absence de publication (ADDENDUM §47).
 */
export function CarouselSection({ section }: { section: LandingSection<LandingSlide> }) {
  const unavailable = section.status === 'indisponible';

  // Hero pleine largeur (demande du porteur, 2026-08-12) : avec du contenu,
  // le carrousel sort du gabarit de section et occupe tout l'ecran sous le
  // menu — aucune gouttiere, aucun arrondi. L'etat vide, lui, reste un
  // message editorial : il garde l'enveloppe classique.
  if (section.items.length > 0) {
    return <LandingCarousel slides={section.items} />;
  }

  return (
    <SectionShell className="pt-9 max-md:pt-6">
      <EmptyState
        title={unavailable ? frPublic.degraded.sectionUnavailable : fr.public.carousel.emptyTitle}
        description={
          unavailable ? frPublic.degraded.sectionUnavailableBody : fr.public.carousel.emptyBody
        }
      />
    </SectionShell>
  );
}
