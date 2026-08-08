import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Alert, Badge, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { frNetwork, tn } from '@/i18n/network';
import { ROUTES } from '@/lib/routes';
import { NETWORK_ROUTES, introductionPathRoute, introductionRoute } from '@/lib/routes/network';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { isUuid, loadIntroductionPaths } from '@/lib/queries/network';
import { AppShell } from '@/components/layout/AppShell';
import { IntroductionPathGraph, SELF_NODE } from '@/components/network/IntroductionPathGraph';
import { IntroductionRequestForm } from './IntroductionRequestForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frNetwork.ask.title };

const ACTION_LINK =
  'inline-flex h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary transition-colors duration-150 hover:border-primary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * ISE-044 — Demander une introduction.
 *
 * L'intermediaire n'est pas choisi librement dans un champ : il arrive
 * par l'URL depuis ISE-043, et l'ecran REVERIFIE qu'il figure bien parmi
 * les chemins que la base accepte (D-51). Un intermediaire fabrique a la
 * main dans l'adresse ne donne donc pas de formulaire — et de toute
 * facon `request_introduction()` le refuserait.
 */
export default async function AskIntroductionPage({
  params,
  searchParams,
}: {
  params: Promise<{ profileId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const { profileId } = await params;
  if (!isUuid(profileId)) notFound();

  const query = await searchParams;
  const rawIntermediary = query['intermediaire'];
  const intermediaryId = typeof rawIntermediary === 'string' ? rawIntermediary : '';

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
        title={frNetwork.ask.errorTitle}
        description={result.error.userMessage}
        correlationId={correlationId}
        action={
          <Link href={introductionPathRoute(profileId)} className={ACTION_LINK}>
            {frNetwork.ask.backToPaths}
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
      </div>,
    );
  }

  const { target, paths } = result.data;
  const path = isUuid(intermediaryId)
    ? paths.find((entry) => entry.intermediary.profileId === intermediaryId)
    : undefined;

  const backLink = (
    <p>
      <Link
        href={introductionPathRoute(profileId)}
        className="text-body-sm text-primary hover:text-primary-hover focus-visible:outline-active-blue font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        ← {frNetwork.ask.backToPaths}
      </Link>
    </p>
  );

  if (path === undefined) {
    return shell(
      <div className="flex flex-col gap-8">
        {backLink}
        <Alert variant="error" title={frNetwork.ask.invalidPathTitle}>
          {frNetwork.ask.invalidPathBody}
        </Alert>
        <p>
          <Link href={introductionPathRoute(profileId)} className={ACTION_LINK}>
            {frNetwork.paths.title}
          </Link>
        </p>
      </div>,
    );
  }

  const intermediaryName = path.intermediary.displayName;

  if (path.pendingRequestId !== null) {
    return shell(
      <div className="flex flex-col gap-8">
        {backLink}
        <Alert
          variant="info"
          title={tn(frNetwork.paths.pendingVia, { name: intermediaryName })}
          action={
            <Link href={introductionRoute(path.pendingRequestId)} className={ACTION_LINK}>
              {frNetwork.paths.seeRequest}
            </Link>
          }
        />
      </div>,
    );
  }

  return shell(
    <div className="flex flex-col gap-8">
      {backLink}

      {/* 375 px : le titre nomme l'intermediaire (« Via <nom> »), le
          sous-titre devient la destination.
          1440 px : titre generique + phrase complete. */}
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">
          <span className="lg:hidden">Via {intermediaryName}</span>
          <span className="max-lg:hidden">{frNetwork.ask.title}</span>
        </h1>
        <p className="text-body text-text-secondary max-lg:hidden">
          {tn(frNetwork.ask.subtitle, { name: intermediaryName, target: target.displayName })}
        </p>
        <p className="text-body-sm text-text-secondary lg:hidden">
          Vers {target.displayName} · {frNetwork.pathLabel[path.label] ?? path.label}
        </p>
      </div>

      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-7">
          <Card>
            <CardHeader>
              <CardTitle as="h2">{frNetwork.ask.pathLabel}</CardTitle>
            </CardHeader>
            <IntroductionPathGraph
              nodes={[
                SELF_NODE,
                {
                  name: intermediaryName,
                  caption: path.intermediary.promotionLabel ?? undefined,
                },
                { name: target.displayName, caption: target.promotionLabel ?? undefined },
              ]}
              edges={[
                { label: frNetwork.paths.edgeDirect, established: true },
                { label: frNetwork.paths.edgeTarget, established: true },
              ]}
            />
            <p className="mt-4">
              <Badge tone={path.label === 'recommended' ? 'success' : 'info'}>
                {frNetwork.pathLabel[path.label] ?? path.label}
              </Badge>
            </p>
          </Card>

          <IntroductionRequestForm
            targetProfileId={profileId}
            intermediaryProfileId={path.intermediary.profileId}
            intermediaryName={intermediaryName}
            targetName={target.displayName}
          />
        </div>

        <aside className="flex flex-col gap-7 max-xl:order-first">
          <Card>
            <CardHeader>
              <CardTitle as="h2">
                {tn(frNetwork.ask.sharedTitle, { name: intermediaryName })}
              </CardTitle>
            </CardHeader>
            <ul className="text-body-sm text-text-secondary flex list-disc flex-col gap-2 pl-5">
              {frNetwork.ask.sharedItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="border-border text-body-sm text-text-primary mt-4 border-t pt-4 font-semibold">
              {frNetwork.ask.sharedExcluded}
            </p>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle as="h2">{frNetwork.ask.notAutomaticTitle}</CardTitle>
            </CardHeader>
            <ul className="text-body-sm text-text-secondary flex list-disc flex-col gap-2 pl-5">
              {frNetwork.ask.notAutomaticItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="text-body-sm text-warning mt-4 font-semibold">
              {frNetwork.ask.notAutomaticNote}
            </p>
          </Card>
        </aside>
      </div>
    </div>,
  );
}
