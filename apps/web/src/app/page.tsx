import type { Metadata } from 'next';
import { fr } from '@/i18n/fr';
import { publicEnv } from '@/lib/env';
import { ROUTES } from '@/lib/routes';
import { LANDING_SECTION_KEYS, loadLandingData, sectionTitle } from '@/lib/public/landing-data';
import { readPublicViewer } from '@/lib/public/protected-route.server';
import { PublicShell } from './(public)/_components/PublicShell';
import { CarouselSection } from './(public)/_components/sections/CarouselSection';
import { HighlightsSection } from './(public)/_components/sections/HighlightsSection';
import { NetworkSection } from './(public)/_components/sections/NetworkSection';
import { ExpertisesSection } from './(public)/_components/sections/ExpertisesSection';
import { PartnersSection } from './(public)/_components/sections/PartnersSection';
import { FinalCtaSection } from './(public)/_components/sections/FinalCtaSection';

/**
 * PUB-001 — Landing publique (ADDENDUM §2).
 *
 * `/` n'ouvre plus l'ecran de connexion. ISE-001 reste la seule page
 * d'authentification, a `/connexion`.
 *
 * Rendu : Server Component. Les donnees sont lues par `loadLandingData()`,
 * qui porte le cache et son etiquette d'invalidation (ADDENDUM §46). La page
 * elle-meme est dynamique parce qu'elle lit la session pour l'en-tete (§7) ;
 * c'est la lecture des donnees, pas le HTML, qui est mise en cache. Une panne
 * du CMS n'empeche donc pas la page de s'afficher (§47).
 */

/**
 * Le HTML est produit a chaque requete, parce que l'en-tete depend de la
 * session (§7) et que `ProtectedLink` doit rendre la bonne cible **cote
 * serveur** pour fonctionner sans JavaScript (§4). Ce qui est mis en cache,
 * c'est la lecture des donnees — la partie couteuse et la seule que le CMS
 * fait varier.
 */
export const dynamic = 'force-dynamic';

/** ADDENDUM §53 — la seule page indexable de l'application. */
export const metadata: Metadata = (() => {
  const siteUrl = publicEnv().NEXT_PUBLIC_SITE_URL;
  return {
    metadataBase: new URL(siteUrl),
    title: fr.public.seo.title,
    description: fr.public.seo.description,
    alternates: { canonical: ROUTES.home },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'website',
      locale: 'fr_FR',
      url: siteUrl,
      siteName: fr.brand.name,
      title: fr.public.seo.title,
      description: fr.public.seo.description,
    },
    twitter: {
      card: 'summary_large_image',
      title: fr.public.seo.title,
      description: fr.public.seo.description,
    },
  };
})();

export default async function LandingPage() {
  const [viewer, landing] = await Promise.all([readPublicViewer(), loadLandingData()]);

  /*
   * ADDENDUM §8 — les titres de section appartiennent au CMS quand il en
   * publie un (`get_landing_sections()`), a l'i18n sinon. Aujourd'hui les neuf
   * lignes de `cms_sections` sont en brouillon : la projection renvoie un
   * tableau vide, et ce sont donc les titres de `fr.public` qui s'affichent.
   */
  const sections = landing.sections;

  return (
    <PublicShell viewer={viewer}>
      <div className="flex flex-col gap-11 pb-11 max-md:gap-9 max-md:pb-9">
        {/*
          Un seul `h1` par page, et il ne peut pas dependre du CMS : le titre
          du carrousel n'existe que s'il y a une diapositive. Il est visible
          des lecteurs d'ecran et des moteurs, invisible a l'ecran — la
          maquette n'affiche pas de titre de page.
        */}
        <h1 className="sr-only">{fr.public.seo.title}</h1>

        <CarouselSection section={landing.carousel} />
        <HighlightsSection
          news={landing.news}
          featuredProfile={landing.featuredProfile}
          events={landing.events}
          opportunities={landing.opportunities}
          title={sectionTitle(sections, LANDING_SECTION_KEYS.highlights) ?? undefined}
        />
        <NetworkSection
          stats={landing.stats}
          title={sectionTitle(sections, LANDING_SECTION_KEYS.stats) ?? undefined}
        />
        <ExpertisesSection
          section={landing.expertises}
          title={sectionTitle(sections, LANDING_SECTION_KEYS.expertises) ?? undefined}
        />
        <PartnersSection
          section={landing.partners}
          title={sectionTitle(sections, LANDING_SECTION_KEYS.partners) ?? undefined}
        />
        <FinalCtaSection />
      </div>
    </PublicShell>
  );
}
