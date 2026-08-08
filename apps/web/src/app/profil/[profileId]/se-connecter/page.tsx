import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Alert, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { frNetwork } from '@/i18n/network';
import { ROUTES } from '@/lib/routes';
import { memberProfileRoute } from '@/lib/routes/search';
import { NETWORK_ROUTES, introductionPathRoute, sentRequestRoute } from '@/lib/routes/network';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { isUuid, loadMemberProfile, signedAvatarUrl } from '@/lib/queries/member-profile';
import { loadConnectionRequests } from '@/lib/queries/network';
import { AppShell } from '@/components/layout/AppShell';
import { ConnectionRequestForm } from './ConnectionRequestForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frNetwork.connect.title };

const ACTION_LINK =
  'inline-flex h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary transition-colors duration-150 hover:border-primary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * ISE-038 — Se connecter a cet ISE.
 *
 * L'ecran ne propose le formulaire QUE lorsque l'envoi peut aboutir. Un
 * profil deja en relation, une demande deja en cours ou son propre profil
 * ferment le formulaire et disent pourquoi : afficher un bouton qui
 * echouera est un bouton decoratif (MASTER PROMPT §113).
 *
 * ECART ASSUME PAR RAPPORT A LA MAQUETTE : le panneau « Pourquoi ce
 * profil ? » de la maquette enumere des correspondances (« expertise
 * commune : suivi-evaluation », « expérience banque/finance »). Seules
 * les correspondances REELLEMENT calculees par la base sont rendues —
 * relation directe, promotion commune, organisation commune, relations
 * communes. Les autres supposeraient un rapprochement de contenus que
 * `get_member_profile()` ne fait pas ; les inventer serait un persona
 * (MASTER PROMPT §78 et §98).
 */
export default async function ConnectPage({ params }: { params: Promise<{ profileId: string }> }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const { profileId } = await params;
  if (!isUuid(profileId)) notFound();

  const correlationId = newCorrelationId();
  const [viewer, profileResult, sentResult, receivedResult] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadMemberProfile(profileId, correlationId),
    loadConnectionRequests('sent', 'pending', null, correlationId),
    loadConnectionRequests('received', 'pending', null, correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={NETWORK_ROUTES.connections}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  if (!profileResult.ok) {
    return shell(
      <ErrorState
        title={frNetwork.connect.errorTitle}
        description={profileResult.error.userMessage}
        correlationId={correlationId}
        action={
          <Link href={memberProfileRoute(profileId)} className={ACTION_LINK}>
            {frNetwork.connect.backToProfile}
          </Link>
        }
      />,
    );
  }

  if (profileResult.data === null) {
    return shell(
      <div className="flex flex-col gap-6">
        <h1 className="text-h1 text-text-primary font-bold">{frNetwork.connect.notFoundTitle}</h1>
        <p className="text-body text-text-secondary">{frNetwork.connect.notFoundBody}</p>
        <p>
          <Link href={NETWORK_ROUTES.connections} className={ACTION_LINK}>
            {frNetwork.connections.title}
          </Link>
        </p>
      </div>,
    );
  }

  const profile = profileResult.data;
  const avatarUrl = await signedAvatarUrl(profile.avatarPath);

  const pendingSent = sentResult.ok
    ? sentResult.data.rows.find((row) => row.profile.profileId === profileId)
    : undefined;
  const pendingReceived = receivedResult.ok
    ? receivedResult.data.rows.find((row) => row.profile.profileId === profileId)
    : undefined;

  const blockedReason: { title: string; body: string; action: React.ReactNode } | null =
    profile.isSelf
      ? {
          title: frNetwork.connect.selfTitle,
          body: frNetwork.connect.selfBody,
          action: (
            <Link href={memberProfileRoute(profileId)} className={ACTION_LINK}>
              {frNetwork.connect.backToProfile}
            </Link>
          ),
        }
      : profile.relationship.isConnected
        ? {
            title: frNetwork.connect.alreadyConnectedTitle,
            body: frNetwork.connect.alreadyConnectedBody,
            action: (
              <Link href={NETWORK_ROUTES.connections} className={ACTION_LINK}>
                {frNetwork.connections.title}
              </Link>
            ),
          }
        : pendingSent !== undefined
          ? {
              title: frNetwork.connect.pendingTitle,
              body: frNetwork.connect.pendingBody,
              action: (
                <Link href={sentRequestRoute(pendingSent.requestId)} className={ACTION_LINK}>
                  {frNetwork.sent.title}
                </Link>
              ),
            }
          : pendingReceived !== undefined
            ? {
                title: frNetwork.connect.pendingTitle,
                body: frNetwork.connect.pendingBody,
                action: (
                  <Link href={NETWORK_ROUTES.invitations} className={ACTION_LINK}>
                    {frNetwork.invitations.title}
                  </Link>
                ),
              }
            : null;

  /* ---- Signaux relationnels REELS, tels que composes par la base ---- */
  const relation = profile.relationship;
  const commonItems: string[] = [];
  if (relation.sharesPromotion && profile.promotion !== null) {
    commonItems.push(`Même promotion : ${profile.promotion.label}`);
  }
  if (relation.sharesOrganization && relation.sharedOrganizationName !== null) {
    commonItems.push(`Même organisation : ${relation.sharedOrganizationName}`);
  }
  if (relation.mutualConnectionCount > 0) {
    commonItems.push(
      relation.mutualConnectionCount === 1
        ? '1 relation en commun'
        : `${relation.mutualConnectionCount} relations en commun`,
    );
  }

  const identity = [profile.promotion?.label ?? null, profile.currentPosition]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' · ');
  const location = [profile.currentCity, profile.currentCountry]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(', ');

  return shell(
    <div className="flex flex-col gap-8">
      <p>
        <Link
          href={memberProfileRoute(profileId)}
          className="text-body-sm text-primary hover:text-primary-hover focus-visible:outline-active-blue font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          ← {frNetwork.connect.backToProfile}
        </Link>
      </p>

      {/* 375 px : titre court, sous-titre masque — l'utilisateur arrive
          depuis le profil, il sait qui il sollicite.
          1024 px et plus : titre complet et intention explicitee. */}
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">
          <span className="lg:hidden">{frNetwork.connect.titleShort}</span>
          <span className="max-lg:hidden">{frNetwork.connect.title}</span>
        </h1>
        <p className="text-body text-text-secondary max-md:hidden">{frNetwork.connect.subtitle}</p>
      </div>

      {/* 375 px : une colonne, le formulaire d'abord, les reperes ensuite.
          1440 px : rail lateral persistant a droite. */}
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-7">
          <Card>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-5">
              {avatarUrl !== undefined ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt=""
                  width={64}
                  height={64}
                  className="h-16 w-16 shrink-0 rounded-full object-cover"
                />
              ) : null}
              <div className="min-w-0">
                <p className="text-h4 text-text-primary font-semibold">{profile.displayName}</p>
                {identity.length > 0 ? (
                  <p className="text-body-sm text-text-secondary mt-1">{identity}</p>
                ) : null}
                {location.length > 0 ? (
                  <p className="text-caption text-text-muted mt-1">{location}</p>
                ) : null}
                {profile.availabilities.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {profile.availabilities.map((availability) => (
                      <li
                        key={availability.code}
                        className="text-caption text-success rounded-full border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-1"
                      >
                        {availability.name}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </div>
          </Card>

          {blockedReason !== null ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{blockedReason.title}</CardTitle>
              </CardHeader>
              <p className="text-body-sm text-text-secondary">{blockedReason.body}</p>
              <p className="mt-5">{blockedReason.action}</p>
            </Card>
          ) : (
            <ConnectionRequestForm profileId={profileId} />
          )}
        </div>

        <aside className="flex flex-col gap-7 max-xl:order-first">
          {commonItems.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">Ce qui vous relie</CardTitle>
              </CardHeader>
              <ul className="flex flex-col gap-2">
                {commonItems.map((item) => (
                  <li key={item} className="text-body-sm text-text-secondary">
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-caption text-text-muted mt-4">
                Éléments issus de données structurées de profil. Aucun message privé n’est analysé.
              </p>
            </Card>
          ) : null}

          {!profile.isSelf && !relation.isConnected ? (
            <Card>
              <CardHeader>
                <CardTitle as="h2">{frNetwork.connect.introductionTitle}</CardTitle>
              </CardHeader>
              <p className="text-body-sm text-text-secondary">
                {frNetwork.connect.introductionBody}
              </p>
              <p className="mt-5">
                <Link href={introductionPathRoute(profileId)} className={ACTION_LINK}>
                  {frNetwork.connect.introductionAction}
                </Link>
              </p>
            </Card>
          ) : null}

          <Alert variant="info" title={frNetwork.connect.respectTitle}>
            {frNetwork.connect.respectBody}
          </Alert>

          {!sentResult.ok || !receivedResult.ok ? (
            <Alert variant="warning" title="Vos demandes en cours n’ont pas pu être vérifiées.">
              {frNetwork.common.correlationLabel} : {correlationId}
            </Alert>
          ) : null}
        </aside>
      </div>
    </div>,
  );
}
