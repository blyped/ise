import { fr } from '@/i18n/fr';
import { ROUTES } from '@/lib/routes';
import { ProtectedLink } from '../ProtectedLink';
import { TrackedLink } from '../analytics/TrackedLink';
import { SectionShell } from './SectionShell';

const PRIMARY =
  'inline-flex min-h-[44px] items-center justify-center rounded-base bg-primary px-7 ' +
  'text-body-sm font-semibold text-primary-foreground transition-colors duration-150 ' +
  'hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-white';

const SECONDARY =
  'inline-flex min-h-[44px] items-center justify-center rounded-base border border-white/30 ' +
  'bg-white/5 px-7 text-body-sm font-semibold text-text-inverse transition-colors duration-150 ' +
  'hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-white';

/**
 * Appel a l'action final de PUB-001.
 *
 * « Reclamer mon profil » vise ISE-005, qui exige une session : il passe donc
 * par la primitive de routage protege plutot que par un lien direct. Les deux
 * boutons sont mesures (§50) : `public_login_click` pour la connexion,
 * `public_claim_profile_click` pour la reclamation — a quoi `ProtectedLink`
 * ajoute `public_to_login` quand le visiteur est anonyme.
 */
export function FinalCtaSection() {
  return (
    <SectionShell>
      <div className="bg-deep-navy rounded-xl px-10 py-11 max-md:px-6 max-md:py-8">
        <h2 className="text-h1 text-text-inverse max-md:text-h3 font-bold">
          {fr.public.finalCta.title}
        </h2>
        <p className="text-body-sm mt-4 text-[#C7D2E5]">{fr.public.finalCta.body}</p>

        <div className="mt-8 flex flex-wrap gap-5 max-md:flex-col">
          <TrackedLink
            href={ROUTES.signIn}
            event="public_login_click"
            sectionKey="final_cta"
            className={PRIMARY}
          >
            {fr.public.finalCta.signIn}
          </TrackedLink>
          <ProtectedLink
            target={ROUTES.claimSearch}
            resourceType="profil"
            className={SECONDARY}
            event="public_claim_profile_click"
            sectionKey="final_cta"
          >
            {fr.public.finalCta.claim}
          </ProtectedLink>
        </div>
      </div>
    </SectionShell>
  );
}
