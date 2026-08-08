import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, EmptyState, ErrorState } from '@ise/ui-web';
import { frMessaging } from '@/i18n/messaging';
import { ROUTES } from '@/lib/routes';
import { MESSAGING_ROUTES } from '@/lib/routes/messaging';
import { newCorrelationId } from '@/lib/correlation';
import { unsealCursor } from '@/lib/opaque-cursor';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadConversations, type InboxScope } from '@/lib/queries/messaging';
import { AppShell } from '@/components/layout/AppShell';
import { ConversationList } from '@/components/messaging/ConversationList';
import { InboxHeader, inboxHref, readScope } from './InboxHeader';

export const dynamic = 'force-dynamic';
export const metadata = { title: frMessaging.inbox.title };

/**
 * ISE-097 — boite de reception.
 *
 * RESPONSIVE REEL : a 375 px l'ecran est la seule liste, et ouvrir une
 * conversation NAVIGUE vers `/messages/{id}` — le maitre-detail devient
 * une pile, comme dans la maquette mobile. A partir de 1024 px la liste
 * reste a gauche et le fil s'affiche a droite : c'est le meme arbre de
 * routes, pas un second ecran.
 *
 * ECART ASSUME PAR RAPPORT A LA MAQUETTE DESKTOP : le rail contextuel de
 * droite (cartes « contexte », « fiche interlocuteur », « checklist de
 * suivi », « bonnes pratiques ») n'est pas rendu. Trois de ces quatre
 * cartes afficheraient des donnees qui n'existent dans aucune table
 * (checklist de suivi, objectifs d'introduction) ; les inventer serait
 * du remplissage. Le contexte reel — module d'origine, motif de prise de
 * contact, fiche de l'interlocuteur — est affiche dans l'en-tete du fil.
 */
export default async function InboxPage({
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
  const scope: InboxScope = readScope(params['filtre']);
  const rawQuery = params['recherche'];
  const query = typeof rawQuery === 'string' ? rawQuery.trim() : '';
  const rawCursor = params['curseur'];
  const cursor = unsealCursor(typeof rawCursor === 'string' ? rawCursor : null);

  const correlationId = newCorrelationId();
  const [viewer, inbox] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadConversations(scope, query.length > 0 ? query : null, cursor, correlationId),
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

  if (!inbox.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        <h1 className="text-h1 text-text-primary font-bold">{frMessaging.inbox.title}</h1>
        <ErrorState
          title={frMessaging.inbox.errorTitle}
          description={inbox.error.userMessage}
          correlationId={correlationId}
          action={
            <Link
              href={MESSAGING_ROUTES.inbox}
              className="rounded-base bg-surface text-body-sm text-text-primary hover:border-primary focus-visible:outline-active-blue inline-flex min-h-[44px] items-center justify-center border border-[#CBD5E1] px-5 font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {frMessaging.common.retry}
            </Link>
          }
        />
      </div>,
    );
  }

  return shell(
    <div className="flex flex-col gap-7">
      <InboxHeader
        scope={scope}
        query={query}
        unreadTotal={inbox.data.unreadTotal}
        archivedTotal={inbox.data.archivedTotal}
      />

      <div className="grid gap-7 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:items-start">
        <section aria-label={frMessaging.inbox.title} className="min-w-0">
          <ConversationList
            rows={inbox.data.rows}
            activeConversationId={null}
            scope={scope}
            query={query}
            previousHref={cursor === null ? null : inboxHref(scope, query, null)}
            nextHref={
              inbox.data.nextCursor === null ? null : inboxHref(scope, query, inbox.data.nextCursor)
            }
          />
        </section>

        <aside className="max-lg:hidden">
          <Card>
            <EmptyState
              title={frMessaging.inbox.selectPrompt}
              description={frMessaging.inbox.selectPromptBody}
            />
          </Card>
        </aside>
      </div>
    </div>,
  );
}
