import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, EmptyState, ErrorState } from '@ise/ui-web';
import { frMessaging } from '@/i18n/messaging';
import { ROUTES } from '@/lib/routes';
import { MESSAGING_ROUTES } from '@/lib/routes/messaging';
import { SEARCH_ROUTES } from '@/lib/routes/search';
import { newCorrelationId } from '@/lib/correlation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadMemberProfile } from '@/lib/queries/member-profile';
import { AppShell } from '@/components/layout/AppShell';
import { ComposeForm } from './ComposeForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frMessaging.compose.title };

const LINK =
  'inline-flex min-h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * ISE-097 — ouvrir une conversation avec un membre.
 *
 * Le destinataire est TOUJOURS designe par l'URL (`?profil=`) : il n'y a
 * pas de champ « à qui écrire » libre. Ouvrir une conversation part
 * d'un profil, d'un appel ou d'une opportunite — jamais d'un annuaire
 * ouvert que l'on parcourrait depuis la messagerie (anti-prospection,
 * DIGEST E2 §A.9).
 *
 * Le motif de prise de contact est OBLIGATOIRE : c'est ce qui evite les
 * « Bonjour, pouvez-vous m'aider ? » sans contexte [34 §34-35].
 */
export default async function ComposePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(ROUTES.sessionExpired);

  const params = await searchParams;
  const rawTarget = params['profil'];
  const targetProfileId = typeof rawTarget === 'string' ? rawTarget : '';

  const correlationId = newCorrelationId();
  const [viewer, target] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    targetProfileId.length > 0
      ? loadMemberProfile(targetProfileId, correlationId)
      : Promise.resolve(null),
  ]);

  const shell = (children: React.ReactNode) => (
    <AppShell
      currentPath={MESSAGING_ROUTES.inbox}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      {children}
    </AppShell>
  );

  if (target === null) {
    return shell(
      <div className="flex flex-col gap-7">
        <h1 className="text-h1 text-text-primary font-bold">{frMessaging.compose.title}</h1>
        <EmptyState
          title={frMessaging.compose.missingRecipient}
          description="Ouvrez une conversation depuis le profil d’un membre, un appel au réseau ou une opportunité : le contexte est conservé."
          action={
            <Link href={SEARCH_ROUTES.find} className={LINK}>
              {frMessaging.inbox.emptyAction}
            </Link>
          }
        />
      </div>,
    );
  }

  if (!target.ok || target.data === null) {
    return shell(
      <div className="flex flex-col gap-7">
        <h1 className="text-h1 text-text-primary font-bold">{frMessaging.compose.title}</h1>
        <ErrorState
          title={frMessaging.thread.errorTitle}
          description={
            target.ok
              ? 'Ce profil n’existe pas ou ne vous est pas accessible.'
              : target.error.userMessage
          }
          correlationId={correlationId}
          action={
            <Link href={MESSAGING_ROUTES.inbox} className={LINK}>
              {frMessaging.inbox.title}
            </Link>
          }
        />
      </div>,
    );
  }

  return shell(
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-7">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{frMessaging.compose.title}</h1>
        <p className="text-body text-text-secondary">{frMessaging.compose.subtitle}</p>
      </div>

      <Card>
        <ComposeForm
          targetProfileId={target.data.profileId}
          targetName={target.data.displayName}
          targetHeadline={target.data.headline}
        />
      </Card>

      <Link href={MESSAGING_ROUTES.inbox} className={`${LINK} self-start`}>
        {frMessaging.common.back}
      </Link>
    </div>,
  );
}
