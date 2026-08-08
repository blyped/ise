import { redirect } from 'next/navigation';
import { frCalls } from '@/i18n/calls';
import { ROUTES } from '@/lib/routes';
import { CALL_ROUTES } from '@/lib/routes/calls';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { AppShell } from '@/components/layout/AppShell';
import { CallWizardShell } from '@/components/calls/CallWizardShell';
import { NeedForm } from '@/components/calls/NeedForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCalls.wizard.createTitle };

/**
 * ISE-049 — Créer un appel, étape 1.
 *
 * Aucun brouillon n'est créé avant la première soumission : ouvrir un
 * écran ne doit pas produire une ligne en base. Le brouillon naît du
 * premier enregistrement, et l'assistant reprend ensuite sur l'appel.
 */
export default async function NewCallPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const viewer = await loadViewerContext(user.id, user.email ?? '');

  return (
    <AppShell
      currentPath={CALL_ROUTES.list}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      <CallWizardShell
        currentStep={1}
        title={frCalls.wizard.createTitle}
        subtitle={frCalls.wizard.createSubtitle}
      >
        <NeedForm call={null} />
      </CallWizardShell>
    </AppShell>
  );
}
