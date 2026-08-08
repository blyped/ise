import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Alert, Card } from '@ise/ui-web';
import { frSupport } from '@/i18n/support';
import { ROUTES } from '@/lib/routes';
import { SUPPORT_ROUTES } from '@/lib/routes/support';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadViewerContext } from '@/lib/queries/viewer';
import { loadSupportCategories } from '@/lib/queries/support';
import { AppShell } from '@/components/layout/AppShell';
import { TicketForm } from '@/components/support/TicketForm';

export const dynamic = 'force-dynamic';
export const metadata = { title: frSupport.ticket.newTitle };

const LINK =
  'inline-flex min-h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/** ISE-100 — nouvelle demande d'assistance. */
export default async function NewTicketPage({
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
  const rawCategory = params['categorie'];
  const [viewer, categories] = await Promise.all([
    loadViewerContext(user.id, user.email ?? ''),
    loadSupportCategories(),
  ]);

  const defaultCategory =
    typeof rawCategory === 'string' && categories.some((entry) => entry.code === rawCategory)
      ? rawCategory
      : null;

  return (
    <AppShell
      currentPath={SUPPORT_ROUTES.help}
      displayName={viewer.displayName}
      contextLine={viewer.contextLine}
    >
      <div className="mx-auto flex w-full max-w-[720px] flex-col gap-7">
        <div className="flex flex-col gap-2">
          <h1 className="text-h1 text-text-primary font-bold">{frSupport.ticket.newTitle}</h1>
          <p className="text-body text-text-secondary">{frSupport.ticket.newSubtitle}</p>
        </div>

        <Alert variant="info" title={frSupport.help.noSla} />

        <Card>
          <TicketForm
            categories={categories}
            defaultCategory={defaultCategory}
            fromPath={SUPPORT_ROUTES.newTicket}
          />
        </Card>

        <Link href={SUPPORT_ROUTES.help} className={`${LINK} self-start`}>
          {frSupport.back}
        </Link>
      </div>
    </AppShell>
  );
}
