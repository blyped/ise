import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Alert, Badge, Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { frNetwork, tn } from '@/i18n/network';
import { ROUTES } from '@/lib/routes';
import { memberProfileRoute } from '@/lib/routes/search';
import {
  NETWORK_ROUTES,
  connectRoute,
  introductionRoute,
  requestIntroductionRoute,
} from '@/lib/routes/network';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import {
  formatDate,
  identityLine,
  isUuid,
  loadIntroductionPaths,
  locationLine,
  type IntroductionPath,
} from '@/lib/queries/network';
import { AppShell } from '@/components/layout/AppShell';
import { ProfileSummary } from '@/components/network/ProfileSummary';
import { IntroductionPathGraph, SELF_NODE } from '@/components/network/IntroductionPathGraph';

export const dynamic = 'force-dynamic';
export const metadata = { title: frNetwork.paths.title };

const ACTION_LINK =
  'inline-flex h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary transition-colors duration-150 hover:border-primary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

const PRIMARY_LINK =
  'inline-flex h-[48px] items-center justify-center rounded-base bg-primary px-7 text-body font-semibold text-white transition-colors duration-150 hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

function LabelBadge({ label }: { label: IntroductionPath['label'] }) {
  const tone = label === 'recommended' ? 'success' : label === 'relevant' ? 'info' : 'neutral';
  return <Badge tone={tone}>{frNetwork.pathLabel[label] ?? label}</Badge>;
}

/**
 * ISE-043 — Chemin d'introduction.
 *
 * D-51, applique de bout en bout : la base ne renvoie que des
 * intermediaires qui sont A LA FOIS une relation directe du membre
 * courant ET une relation directe de la personne visee. Aucun chemin a
 * deux intermediaires n'existe, et le composant de graphe ne sait meme
 * pas en dessiner un.
 *
 * MASTER PROMPT §15 : aucun score n'arrive jusqu'ici. Le classement est
 * porte par un LIBELLE (« Recommandé » / « Pertinent » / « Possible »)
 * et par la liste des signaux explicites qui l'ont produit — chaque
 * proposition porte donc au moins une raison affichable (D-43).
 *
 * ECART ASSUME : la maquette affiche « collaboration 2023 » sur l'arête
 * entre l'intermediaire et la cible. Le contexte de cette relation est
 * bien lu (`connections.context`), mais il n'est rendu que sous forme de
 * libelle de referentiel, jamais reformule en phrase : la plateforme ne
 * sait pas si une « collaboration » a eu lieu, elle sait qu'un contexte
 * a ete declare a l'acceptation de la relation.
 */
export default async function IntroductionPathsPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const { profileId } = await params;
  if (!isUuid(profileId)) notFound();

  const correlationId = newCorrelationId();
  const [viewer, result] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadIntroductionPaths(profileId, correlationId),
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

  if (!result.ok) {
    return shell(
      <ErrorState
        title={frNetwork.paths.errorTitle}
        description={result.error.userMessage}
        correlationId={correlationId}
        action={
          <Link href={memberProfileRoute(profileId)} className={ACTION_LINK}>
            {frNetwork.paths.backToProfile}
          </Link>
        }
      />,
    );
  }

  if (result.data === null) {
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

  const { target, alreadyConnected, paths } = result.data;
  const [best, ...others] = paths;

  const header = (
    <div className="flex flex-col gap-8">
      <p>
        <Link
          href={memberProfileRoute(profileId)}
          className="text-body-sm text-primary hover:text-primary-hover focus-visible:outline-active-blue font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          ← {frNetwork.paths.backToProfile}
        </Link>
      </p>

      {/* 375 px : le titre devient l'objectif (« Vers <nom> ») et le
          sous-titre cede la place au decompte reel de chemins.
          1440 px : titre generique + intention complete. */}
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">
          <span className="lg:hidden">Vers {target.displayName}</span>
          <span className="max-lg:hidden">{frNetwork.paths.title}</span>
        </h1>
        <p className="text-body text-text-secondary max-lg:hidden">
          {tn(frNetwork.paths.subtitle, { name: target.displayName })}
        </p>
        <p className="text-body-sm text-text-secondary lg:hidden">
          {paths.length === 1
            ? tn(frNetwork.paths.countFound, { count: 1 })
            : tn(frNetwork.paths.countFoundPlural, { count: paths.length })}
        </p>
      </div>

      <Card>
        <p className="text-caption text-text-muted mb-3 uppercase tracking-wide">
          {frNetwork.paths.targetLabel}
        </p>
        <ProfileSummary
          card={target}
          trailing={
            paths.length > 0 ? (
              <span className="text-caption text-text-muted">
                {paths.length === 1
                  ? tn(frNetwork.paths.countFound, { count: 1 })
                  : tn(frNetwork.paths.countFoundPlural, { count: paths.length })}
              </span>
            ) : null
          }
        />
      </Card>
    </div>
  );

  if (alreadyConnected) {
    return shell(
      <div className="flex flex-col gap-8">
        {header}
        <Alert variant="info" title={frNetwork.paths.alreadyConnectedTitle}>
          {frNetwork.paths.alreadyConnectedBody}
        </Alert>
        <p>
          <Link href={memberProfileRoute(profileId)} className={ACTION_LINK}>
            {frNetwork.paths.backToProfile}
          </Link>
        </p>
      </div>,
    );
  }

  const pathCard = (path: IntroductionPath, featured: boolean) => {
    const name = path.intermediary.displayName;
    const identity = identityLine(path.intermediary);
    const location = locationLine(path.intermediary);

    return (
      <Card key={path.intermediary.profileId} padding={featured ? 'md' : 'sm'}>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
            <div className="min-w-0">
              <p className="text-body text-text-primary font-semibold">{name}</p>
              {identity.length > 0 ? (
                <p className="text-body-sm text-text-secondary mt-1">{identity}</p>
              ) : null}
              {location.length > 0 ? (
                <p className="text-caption text-text-muted mt-1">{location}</p>
              ) : null}
            </div>
            <LabelBadge label={path.label} />
          </div>

          {featured ? (
            <IntroductionPathGraph
              nodes={[
                SELF_NODE,
                { name, caption: path.intermediary.promotionLabel ?? undefined },
                { name: target.displayName, caption: target.promotionLabel ?? undefined },
              ]}
              edges={[
                { label: frNetwork.paths.edgeDirect, established: true },
                { label: frNetwork.paths.edgeTarget, established: true },
              ]}
            />
          ) : null}

          <div>
            <p className="text-caption text-text-muted uppercase tracking-wide">
              {frNetwork.paths.reasonsTitle}
            </p>
            <ul className="text-body-sm text-text-secondary mt-2 flex list-disc flex-col gap-1 pl-5">
              {path.reasons.map((reason) => (
                <li key={reason}>{frNetwork.reason[reason] ?? reason}</li>
              ))}
            </ul>
          </div>

          <dl className="text-caption text-text-muted flex flex-col gap-1">
            {path.connectedSince !== null ? (
              <div>{tn(frNetwork.paths.linkSince, { date: formatDate(path.connectedSince) })}</div>
            ) : null}
            {path.targetLinkSince !== null ? (
              <div>
                {tn(frNetwork.paths.targetLinkSince, {
                  date: formatDate(path.targetLinkSince),
                })}
                {path.targetLinkContext !== null
                  ? ` — ${frNetwork.context[path.targetLinkContext] ?? path.targetLinkContext}`
                  : ''}
              </div>
            ) : null}
          </dl>

          {/* Une demande deja en cours ne propose PAS un second envoi :
              la base la refuserait (`request_already_sent`). */}
          {path.pendingRequestId !== null ? (
            <div className="flex flex-col gap-2">
              <p className="text-body-sm text-text-secondary">
                {tn(frNetwork.paths.pendingVia, { name })}
              </p>
              <Link href={introductionRoute(path.pendingRequestId)} className={ACTION_LINK}>
                {frNetwork.paths.seeRequest}
              </Link>
            </div>
          ) : (
            <Link
              href={requestIntroductionRoute(profileId, path.intermediary.profileId)}
              className={
                featured ? `${PRIMARY_LINK} max-md:w-full` : `${ACTION_LINK} max-md:w-full`
              }
            >
              {tn(frNetwork.paths.askVia, { name })}
            </Link>
          )}
        </div>
      </Card>
    );
  };

  return shell(
    <div className="flex flex-col gap-8">
      {header}

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-7">
          {best === undefined ? (
            <EmptyState
              title={frNetwork.paths.emptyTitle}
              description={frNetwork.paths.emptyBody}
              action={
                <Link href={connectRoute(profileId)} className={ACTION_LINK}>
                  {frNetwork.paths.emptyAction}
                </Link>
              }
            />
          ) : (
            <>
              <section aria-label={frNetwork.paths.bestTitle} className="flex flex-col gap-4">
                <h2 className="text-h3 text-text-primary font-semibold">
                  {frNetwork.paths.bestTitle}
                </h2>
                {pathCard(best, true)}
              </section>

              {others.length > 0 ? (
                <section aria-label={frNetwork.paths.othersTitle} className="flex flex-col gap-4">
                  <h2 className="text-h3 text-text-primary font-semibold">
                    {frNetwork.paths.othersTitle}
                  </h2>
                  <ul className="flex flex-col gap-4">
                    {others.map((path) => (
                      <li key={path.intermediary.profileId}>{pathCard(path, false)}</li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </>
          )}
        </div>

        <aside className="flex flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frNetwork.paths.howTitle}</CardTitle>
            </CardHeader>
            <p className="text-body-sm text-text-secondary">{frNetwork.paths.howBody}</p>
            <p className="text-body-sm text-text-primary mt-3 font-semibold">
              {frNetwork.paths.howLimit}
            </p>
          </Card>

          <Alert variant="warning" title={frNetwork.paths.respectTitle}>
            {frNetwork.paths.respectBody}
          </Alert>

          <Alert variant="info" title={frNetwork.paths.privacyTitle}>
            {frNetwork.paths.privacyBody}
          </Alert>
        </aside>
      </div>
    </div>,
  );
}
