import Link from 'next/link';
import { frAdmin } from '@/i18n/admin';
import { frAdminEvents } from '@/i18n/admin-events';
import { ADMIN_ROUTES } from '@/lib/routes/admin';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { AdminShell } from '../../_components/AdminShell';
import { PageHeader, SectionCard } from '../../_components/PageHeader';
import { EventForm } from '../EventForm';
import { createEventAction } from '../actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminEvents.form.createTitle };

const BACK_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/** SA-030 — Creation d'un evenement (permission events.manage). */
export default async function AdminEventNewPage() {
  const access = await requireAdminPermission('events.manage');

  return (
    <AdminShell access={access} currentPath={ADMIN_ROUTES.events} screenTitle={frAdminEvents.form.createTitle}>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Link href={ADMIN_ROUTES.events} className={BACK_LINK}>
            ← {frAdmin.common.back}
          </Link>
          <PageHeader title={frAdminEvents.form.createTitle} subtitle={frAdminEvents.list.subtitle} />
        </div>

        <SectionCard title={frAdminEvents.form.createTitle}>
          <EventForm action={createEventAction} />
        </SectionCard>
      </div>
    </AdminShell>
  );
}
