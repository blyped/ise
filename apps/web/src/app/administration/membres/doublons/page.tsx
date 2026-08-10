import { EmptyState, ErrorState } from '@ise/ui-web';
import { ADMIN_ROUTES } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import { loadAdminDuplicateCandidates } from '@/lib/admin/queries-dedup';
import { nextPageHref, paramValue, type SearchParams } from '@/lib/admin/params';
import { frAdminDedup } from '@/i18n/admin-dedup';
import { AdminShell } from '../../_components/AdminShell';
import { CursorPager, PageHeader } from '../../_components/PageHeader';
import { ReasonAction } from '../../_components/ReasonAction';
import { dismissDuplicateAction, mergeProfilesAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdminDedup.duplicates.title };

function signalLabels(signals: Readonly<Record<string, boolean>>): string[] {
  return Object.keys(signals)
    .filter((key) => signals[key])
    .map((key) => frAdminDedup.duplicates.signals[key] ?? key);
}

/**
 * SA-005 — Doublons potentiels : paires de profils au score >= 60
 * (bareme private.duplicate_match_rules, meme principe que 0017).
 * Chaque decision (fusion ou rejet) est motivee et journalisee
 * (`admin_merge_profiles` / `admin_dismiss_duplicate_candidate`, 0089).
 */
export default async function AdminDuplicatesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const access = await requireAdminPermission('profiles.moderate');
  const params = await searchParams;
  const cursor = paramValue(params, 'curseur');
  const correlationId = newCorrelationId();
  const page = await loadAdminDuplicateCandidates(cursor, correlationId);

  const shell = (children: React.ReactNode) => (
    <AdminShell access={access} currentPath={ADMIN_ROUTES.members} screenTitle={frAdminDedup.duplicates.title}>
      {children}
    </AdminShell>
  );

  const header = (
    <PageHeader title={frAdminDedup.duplicates.title} subtitle={frAdminDedup.duplicates.subtitle} />
  );

  if (!page.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        {header}
        <ErrorState title="Une erreur est survenue" description={page.error.userMessage} correlationId={correlationId} />
      </div>,
    );
  }

  const { rows, nextCursor } = page.data;

  return shell(
    <div className="flex flex-col gap-8">
      {header}
      {rows.length === 0 ? (
        <EmptyState title={frAdminDedup.duplicates.empty} description={frAdminDedup.duplicates.emptyBody} />
      ) : (
        <ul className="flex flex-col gap-4" aria-label={frAdminDedup.duplicates.title}>
          {rows.map((pair) => (
            <li key={`${pair.profileIdA}:${pair.profileIdB}`} className="border-border rounded-lg border p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-caption text-text-muted">
                  {frAdminDedup.duplicates.score} : {pair.score}
                </span>
                <span className="text-caption text-text-muted">{signalLabels(pair.signals).join(' · ')}</span>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                {[pair.profileA, pair.profileB].map((profile, index) => {
                  const other = index === 0 ? pair.profileB : pair.profileA;
                  return (
                    <div key={profile.profileId} className="flex flex-col gap-2">
                      <p className="text-body-sm text-text-primary font-semibold">{profile.displayName}</p>
                      <p className="text-caption text-text-muted">
                        {[profile.currentPosition, profile.organization, profile.city].filter(Boolean).join(' · ') || '—'}
                      </p>
                      <ReasonAction
                        action={mergeProfilesAction}
                        fields={{ keepProfileId: profile.profileId, mergeProfileId: other.profileId }}
                        triggerLabel={frAdminDedup.duplicates.keep(profile.displayName)}
                        title={frAdminDedup.duplicates.mergeTitle}
                        description={frAdminDedup.duplicates.mergeBody}
                        confirmLabel={frAdminDedup.duplicates.keep(profile.displayName)}
                        reasonPlaceholder={frAdminDedup.duplicates.reasonPlaceholder}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-4">
                <ReasonAction
                  action={dismissDuplicateAction}
                  fields={{ profileIdA: pair.profileIdA, profileIdB: pair.profileIdB }}
                  triggerLabel={frAdminDedup.duplicates.dismiss}
                  title={frAdminDedup.duplicates.dismissTitle}
                  description={frAdminDedup.duplicates.dismissBody}
                  confirmLabel={frAdminDedup.duplicates.dismiss}
                  destructive={false}
                  reasonPlaceholder={frAdminDedup.duplicates.reasonPlaceholder}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <CursorPager
        shownCount={rows.length}
        nextHref={nextPageHref(ADMIN_ROUTES.memberDuplicates, {}, nextCursor)}
      />
    </div>,
  );
}
