import { redirect } from 'next/navigation';
import { Alert, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { BUSINESS_ERRORS, type BusinessErrorCode } from '@ise/domain';
import { frPromotions } from '@/i18n/promotions';
import { fr } from '@/i18n/fr';
import { ROUTES } from '@/lib/routes';
import { newCorrelationId } from '@/lib/correlation';
import { readFeedback } from '@/lib/collaborate-feedback';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { getPromotionInvitationPreview } from '@/lib/queries/promotions';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader, PRIMARY_BUTTON } from '@/components/collaborate/CollaborateUI';
import { redeemInvitationAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frPromotions.redeem.cta };

/**
 * ISE-070 (suite) — recuperation d'une invitation cote invite.
 *
 * Route MEMBRE (pas publique, `lib/routes.ts`) : la personne doit deja avoir
 * un compte pour que le jeton puisse etre rattache a son `user_id`. Sans
 * session, le middleware la redirige vers `/connexion?redirectTo=...`, qui
 * la ramene ici apres connexion OU creation de compte.
 */
export default async function InvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const feedback = readFeedback(query);

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const correlationId = newCorrelationId();
  const [viewer, preview] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    getPromotionInvitationPreview(token, correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={ROUTES.invitation}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  if (!preview.ok) {
    return shell(
      <ErrorState
        title={frPromotions.redeem.loadErrorTitle}
        description={preview.error.userMessage}
        correlationId={correlationId}
      />,
    );
  }

  const { invitedFirstName, promotionLabel } = preview.data;
  const title = frPromotions.redeem.title.replace('{promotion}', promotionLabel ?? '');
  const errorMessage =
    feedback?.status === 'error'
      ? (BUSINESS_ERRORS[feedback.code as BusinessErrorCode] ?? BUSINESS_ERRORS.unknown)
      : null;

  return shell(
    <div className="flex flex-col gap-8">
      <PageHeader title={title} subtitle={frPromotions.redeem.subtitle} />

      {errorMessage ? (
        <Alert variant="error" title={errorMessage}>
          {fr.common.correlationLabel} : {feedback?.correlationId}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle as="h2">{invitedFirstName ?? title}</CardTitle>
        </CardHeader>
        <p className="text-body-sm text-text-secondary">{frPromotions.redeem.note}</p>
        <form action={redeemInvitationAction} className="mt-5">
          <input type="hidden" name="token" value={token} />
          <button type="submit" className={PRIMARY_BUTTON}>
            {frPromotions.redeem.cta}
          </button>
        </form>
      </Card>
    </div>,
  );
}
