import Link from 'next/link';
import { Alert } from '@ise/ui-web';
import { fr } from '@/i18n/fr';
import { ROUTES } from '@/lib/routes';
import { REDIRECT_FALLBACK, safeRedirect } from '@/lib/public/safe-redirect';
import { isResourceType } from '@/lib/public/protected-route';
import { AuthCard } from '@/components/layout/AuthCard';
import { SignInForm } from './SignInForm';

export const metadata = { title: fr.auth.signIn.submit };

/**
 * ADDENDUM §6 — ISE-001 reste la seule page d'authentification.
 *
 * Elle accepte desormais :
 *  - `redirectTo` : la ressource demandee avant connexion (nom canonique) ;
 *  - `suivant` : ancien nom, conserve le temps que les liens en circulation
 *    disparaissent ;
 *  - `resourceType` : la nature de la ressource, pour annoncer ce que l'on
 *    s'apprete a ouvrir. Elle n'accorde aucun droit.
 *
 * La valeur est validee **ici** et **de nouveau** a la soumission : la page
 * peut etre rechargee, l'action peut etre appelee directement.
 */
function readRedirectTarget(params: Record<string, string | string[] | undefined>): string {
  const raw = params['redirectTo'] ?? params['suivant'];
  return safeRedirect(raw, { source: 'ISE-001 (page)' });
}

/** ISE-001 — Connexion. */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = readRedirectTarget(params);
  const reason = params['raison'];

  const rawResourceType = params['resourceType'];
  const resourceType = isResourceType(rawResourceType) ? rawResourceType : null;

  // Le message n'apparait que si l'on vient reellement d'une ressource :
  // l'afficher sur une connexion ordinaire serait un mensonge poli.
  const cameFromResource = next !== REDIRECT_FALLBACK || resourceType !== null;
  const resourcePrompt = cameFromResource
    ? resourceType
      ? fr.public.resourcePrompt[resourceType]
      : fr.public.signInPrompt
    : null;

  return (
    <AuthCard
      title={fr.auth.signIn.title}
      subtitle={fr.auth.signIn.subtitle}
      footer={
        <div className="flex flex-col gap-4">
          <div className="rounded-base border border-[#BFDBFE] bg-[#EFF6FF] p-5">
            <p className="text-body-sm text-text-primary font-semibold">
              {fr.auth.signIn.claimTitle}
            </p>
            <p className="text-body-sm text-text-secondary mt-1">{fr.auth.signIn.claimBody}</p>
            {/*
              ISE-005 exige une session : le lien passe par la connexion, qui
              redirigera vers la recherche une fois le compte authentifie.
            */}
            <p className="mt-3">
              <Link
                href={`${ROUTES.signIn}?redirectTo=${encodeURIComponent(ROUTES.claimSearch)}`}
                className="text-body-sm text-primary hover:text-primary-hover focus-visible:outline-active-blue font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {fr.claim.entryLink}
              </Link>
            </p>
          </div>
          <p className="text-body-sm text-text-secondary text-center">
            {fr.auth.signIn.noAccount}{' '}
            <Link
              href={ROUTES.signUp}
              className="text-primary hover:text-primary-hover focus-visible:outline-active-blue font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {fr.auth.signIn.createAccount}
            </Link>
          </p>
        </div>
      }
    >
      {resourcePrompt ? <Alert variant="info" title={resourcePrompt} /> : null}

      {reason === 'session' ? (
        <Alert variant="warning" title={fr.auth.signIn.sessionExpired} />
      ) : null}
      {reason === 'mot-de-passe-modifie' ? (
        <Alert variant="success" title={fr.auth.signIn.passwordUpdated} />
      ) : null}
      {reason === 'lien-invalide' ? (
        <Alert variant="warning" title={fr.auth.signIn.invalidLink} />
      ) : null}

      <SignInForm next={next} />
    </AuthCard>
  );
}
