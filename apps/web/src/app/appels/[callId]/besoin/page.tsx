import { notFound, redirect } from 'next/navigation';
import { ErrorState } from '@ise/ui-web';
import { frCalls } from '@/i18n/calls';
import { ROUTES } from '@/lib/routes';
import { CALL_ROUTES } from '@/lib/routes/calls';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadNetworkCall } from '@/lib/queries/calls';
import { isUuid } from '@/lib/network-view';
import { AppShell } from '@/components/layout/AppShell';
import { CallWizardShell } from '@/components/calls/CallWizardShell';
import { NeedForm } from '@/components/calls/NeedForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCalls.wizard.createTitle };

/** ISE-049 — étape 1 sur un brouillon existant. */
export default async function EditCallNeedPage({
  params,
}: {
  params: Promise<{ callId: string }>;
}) {
  const { callId } = await params;
  if (!isUuid(callId)) notFound();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const correlationId = newCorrelationId();
  const [viewer, result] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadNetworkCall(callId, correlationId),
  ]);

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={CALL_ROUTES.list}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  if (!result.ok || result.data === null) {
    return shell(
      <ErrorState
        title={frCalls.detail.notFoundTitle}
        description={result.ok ? frCalls.detail.notFoundBody : result.error.userMessage}
        correlationId={correlationId}
      />,
    );
  }

  const call = result.data;
  if (!call.isAuthor || call.status !== 'draft') {
    // Un appel publié ne se réécrit pas par ce chemin : la base le
    // refuserait de toute façon (0040). L'écran ne propose donc rien.
    redirect(`${CALL_ROUTES.list}/${callId}`);
  }

  return shell(
    <CallWizardShell
      currentStep={1}
      title={frCalls.wizard.createTitle}
      subtitle={frCalls.wizard.createSubtitle}
    >
      <NeedForm call={call} />
    </CallWizardShell>,
  );
}
