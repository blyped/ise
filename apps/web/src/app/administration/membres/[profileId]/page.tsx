import Link from 'next/link';
import { Alert, Badge, ErrorState } from '@ise/ui-web';
import { frAdmin } from '@/i18n/admin';
import { ADMIN_ROUTES } from '@/lib/routes/admin';
import { newCorrelationId } from '@/lib/correlation';
import { requireAdminPermission } from '@/lib/admin/permissions';
import {
  loadAdminProfile,
  loadAdminProfileNotes,
  loadAdminProfileRoles,
  loadAdminRoles,
} from '@/lib/admin/queries';
import { formatDate, formatDateTime } from '@/lib/admin/format';
import { AdminShell } from '../../_components/AdminShell';
import { KeyValue, PageHeader, SectionCard, StatusBadge } from '../../_components/PageHeader';
import { ReasonAction } from '../../_components/ReasonAction';
import { NoteForm } from './NoteForm';
import { addProfileNoteAction, profileRoleAction, profileStatusAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frAdmin.members.title };

const BACK_LINK =
  'text-body-sm text-primary font-medium hover:underline focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-active-blue inline-flex min-h-[44px] items-center';

/**
 * SA-003 / SA-004 — Fiche administrative d'un membre / profil.
 *
 * Lecture : `admin_get_profile` (profiles.read ; l'e-mail du compte
 * n'est projete que pour profiles.moderate — c'est la BASE qui decide).
 * Actions : suspension / reactivation / archivage / restauration
 * (profiles.moderate), attribution de roles (roles.manage, JAMAIS sur
 * soi-meme — la base refuse et l'ecran le dit), notes administratives
 * internes (schema private, jamais visibles d'un membre).
 */
export default async function AdminMemberDetailPage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const access = await requireAdminPermission('profiles.read');
  const { profileId } = await params;
  const correlationId = newCorrelationId();

  const canModerate = access.can('profiles.moderate');
  const canManageRoles = access.can('roles.manage');

  const [detail, roles, profileRoles, notes] = await Promise.all([
    loadAdminProfile(profileId, correlationId),
    canManageRoles ? loadAdminRoles(correlationId) : Promise.resolve(null),
    canManageRoles ? loadAdminProfileRoles(profileId, correlationId) : Promise.resolve(null),
    canModerate ? loadAdminProfileNotes(profileId, correlationId) : Promise.resolve(null),
  ]);

  const shell = (children: React.ReactNode) => (
    <AdminShell
      access={access}
      currentPath={ADMIN_ROUTES.members}
      screenTitle={frAdmin.members.title}
    >
      {children}
    </AdminShell>
  );

  if (!detail.ok || detail.data === null) {
    return shell(
      <div className="flex flex-col gap-8">
        <PageHeader title={frAdmin.members.title} subtitle={frAdmin.members.subtitle} />
        <ErrorState
          title={frAdmin.common.errorTitle}
          {...(detail.ok ? {} : { description: detail.error.userMessage })}
          correlationId={correlationId}
          action={
            <Link href={ADMIN_ROUTES.members} className={BACK_LINK}>
              {frAdmin.common.back}
            </Link>
          }
        />
      </div>,
    );
  }

  const profile = detail.data;

  return shell(
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <Link href={ADMIN_ROUTES.members} className={BACK_LINK}>
          ← {frAdmin.common.back}
        </Link>
        <PageHeader
          title={profile.displayName}
          subtitle={profile.headline ?? frAdmin.members.subtitle}
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={profile.profileStatus}
              label={frAdmin.profileStatus[profile.profileStatus] ?? profile.profileStatus}
            />
            <StatusBadge
              status={profile.claimStatus}
              label={frAdmin.claimStatusOfProfile[profile.claimStatus] ?? profile.claimStatus}
            />
            <StatusBadge
              status={profile.verificationStatus}
              label={
                frAdmin.verificationStatus[profile.verificationStatus] ?? profile.verificationStatus
              }
            />
            {profile.isTestAccount ? (
              <Badge tone="neutral">{frAdmin.members.detail.testAccount}</Badge>
            ) : null}
          </div>
        </PageHeader>
      </div>

      <SectionCard title={frAdmin.members.detail.overview}>
        <dl className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <KeyValue label={frAdmin.members.detail.identity}>{profile.displayName}</KeyValue>
          <KeyValue label={frAdmin.members.detail.promotion}>
            {profile.promotionName ?? frAdmin.common.none}
          </KeyValue>
          <KeyValue label={frAdmin.members.detail.position}>
            {profile.currentPosition ?? frAdmin.common.none}
          </KeyValue>
          <KeyValue label={frAdmin.members.detail.organization}>
            {profile.organization ?? frAdmin.common.none}
          </KeyValue>
          <KeyValue label={frAdmin.members.detail.location}>
            {[profile.currentCity, profile.country].filter(Boolean).join(', ') ||
              frAdmin.common.none}
          </KeyValue>
          <KeyValue label={frAdmin.members.detail.emailHint}>
            {profile.emailHint ?? frAdmin.common.none}
          </KeyValue>
          {canModerate ? (
            <KeyValue label={frAdmin.members.detail.accountEmail}>
              {profile.accountEmail ?? frAdmin.common.none}
            </KeyValue>
          ) : null}
          <KeyValue label={frAdmin.members.detail.createdAt}>
            {formatDate(profile.createdAt)}
          </KeyValue>
          <KeyValue label={frAdmin.members.detail.lastActive}>
            {formatDateTime(profile.lastActiveAt)}
          </KeyValue>
        </dl>

        <Alert variant="info" title={frAdmin.members.detail.linkTitle} className="mt-1">
          {profile.hasAccount
            ? `${frAdmin.members.detail.linkedYes}${profile.claimedAt !== null ? ` — ${frAdmin.members.detail.claimedAt} ${formatDate(profile.claimedAt)}` : ''}`
            : frAdmin.members.detail.linkedNo}
        </Alert>
      </SectionCard>

      {canModerate ? (
        <SectionCard title={frAdmin.members.detail.actionsTitle}>
          <div className="flex flex-wrap gap-4">
            {profile.profileStatus === 'active' ? (
              <ReasonAction
                action={profileStatusAction}
                fields={{ profileId: profile.profileId, action: 'suspend' }}
                triggerLabel={frAdmin.members.actions.suspend}
                title={frAdmin.members.actions.suspendTitle}
                description={frAdmin.members.actions.suspendBody}
                confirmLabel={frAdmin.members.actions.suspend}
                reasonPlaceholder={frAdmin.members.actions.reasonPlaceholder}
              />
            ) : null}
            {profile.profileStatus === 'suspended' ? (
              <ReasonAction
                action={profileStatusAction}
                fields={{ profileId: profile.profileId, action: 'reactivate' }}
                triggerLabel={frAdmin.members.actions.reactivate}
                title={frAdmin.members.actions.reactivateTitle}
                description={frAdmin.members.actions.reactivateBody}
                confirmLabel={frAdmin.members.actions.reactivate}
                destructive={false}
              />
            ) : null}
            {profile.profileStatus !== 'archived' ? (
              <ReasonAction
                action={profileStatusAction}
                fields={{ profileId: profile.profileId, action: 'archive' }}
                triggerLabel={frAdmin.members.actions.archive}
                title={frAdmin.members.actions.archiveTitle}
                description={frAdmin.members.actions.archiveBody}
                confirmLabel={frAdmin.members.actions.archive}
              />
            ) : (
              <ReasonAction
                action={profileStatusAction}
                fields={{ profileId: profile.profileId, action: 'restore' }}
                triggerLabel={frAdmin.members.actions.restore}
                title={frAdmin.members.actions.restoreTitle}
                description={frAdmin.members.actions.restoreBody}
                confirmLabel={frAdmin.members.actions.restore}
                destructive={false}
              />
            )}
          </div>
        </SectionCard>
      ) : null}

      {canManageRoles && roles !== null && profileRoles !== null ? (
        <SectionCard title={frAdmin.roles.title}>
          {!profileRoles.ok || !roles.ok ? (
            <ErrorState title={frAdmin.common.errorTitle} correlationId={correlationId} />
          ) : (
            <>
              {profileRoles.data.length === 0 ? (
                <p className="text-body-sm text-text-secondary">{frAdmin.roles.none}</p>
              ) : (
                <ul className="flex flex-col gap-3" aria-label={frAdmin.roles.title}>
                  {profileRoles.data.map((entry) => (
                    <li
                      key={entry.code}
                      className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                    >
                      <div className="flex flex-col gap-1">
                        <p className="text-body-sm text-text-primary font-semibold">{entry.name}</p>
                        <p className="text-caption text-text-muted">
                          {entry.grantedBy !== null
                            ? `${frAdmin.roles.grantedBy} ${entry.grantedBy} `
                            : ''}
                          {entry.grantedAt !== null
                            ? `${frAdmin.roles.grantedAt} ${formatDate(entry.grantedAt)}`
                            : ''}
                        </p>
                      </div>
                      {entry.code !== 'member' ? (
                        <ReasonAction
                          action={profileRoleAction}
                          fields={{
                            profileId: profile.profileId,
                            role: entry.code,
                            grant: 'false',
                          }}
                          triggerLabel={frAdmin.roles.revoke}
                          title={frAdmin.roles.revokeTitle}
                          description={frAdmin.roles.revokeBody}
                          confirmLabel={frAdmin.roles.revoke}
                          reasonLabel={frAdmin.roles.reasonLabel}
                          reasonPlaceholder={frAdmin.roles.reasonPlaceholder}
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex flex-col gap-2">
                <ReasonAction
                  action={profileRoleAction}
                  fields={{ profileId: profile.profileId, grant: 'true' }}
                  triggerLabel={frAdmin.roles.grant}
                  title={frAdmin.roles.grantTitle}
                  description={frAdmin.roles.grantBody}
                  confirmLabel={frAdmin.roles.grant}
                  destructive={false}
                  reasonLabel={frAdmin.roles.reasonLabel}
                  reasonPlaceholder={frAdmin.roles.reasonPlaceholder}
                  select={{
                    name: 'role',
                    label: frAdmin.roles.roleLabel,
                    options: roles.data
                      .filter((role) => !profileRoles.data.some((held) => held.code === role.code))
                      .map((role) => ({
                        value: role.code,
                        label: `${role.name} (${frAdmin.roles.holders(role.holders)})`,
                      })),
                  }}
                />
                <p className="text-caption text-text-muted">{frAdmin.roles.selfForbidden}</p>
              </div>
            </>
          )}
        </SectionCard>
      ) : null}

      {canModerate && notes !== null ? (
        <SectionCard title={frAdmin.notes.title}>
          <Alert variant="info" title={frAdmin.notes.visibility} />
          {!notes.ok ? (
            <ErrorState
              title={frAdmin.common.errorTitle}
              description={notes.error.userMessage}
              correlationId={correlationId}
            />
          ) : notes.data.length === 0 ? (
            <p className="text-body-sm text-text-secondary">{frAdmin.notes.empty}</p>
          ) : (
            <ul className="flex flex-col gap-3" aria-label={frAdmin.notes.title}>
              {notes.data.map((note) => (
                <li key={note.noteId} className="border-border rounded-lg border p-4">
                  <p className="text-body-sm text-text-primary whitespace-pre-wrap">{note.body}</p>
                  <p className="text-caption text-text-muted mt-2">
                    {note.author !== null ? `${frAdmin.notes.by} ${note.author} — ` : ''}
                    {formatDateTime(note.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <NoteForm action={addProfileNoteAction} profileId={profile.profileId} />
        </SectionCard>
      ) : null}

      <SectionCard title={frAdmin.members.detail.claimsTitle}>
        {profile.claims.length === 0 ? (
          <p className="text-body-sm text-text-secondary">{frAdmin.members.detail.noClaims}</p>
        ) : (
          <ul className="flex flex-col gap-3" aria-label={frAdmin.members.detail.claimsTitle}>
            {profile.claims.map((claim) => (
              <li
                key={claim.claimId}
                className="border-border flex flex-wrap items-center gap-3 rounded-lg border p-4"
              >
                <StatusBadge
                  status={claim.status}
                  label={frAdmin.claims.status[claim.status] ?? claim.status}
                />
                <span className="text-body-sm text-text-secondary">
                  {frAdmin.claims.method[claim.claimMethod] ?? claim.claimMethod} —{' '}
                  {formatDateTime(claim.submittedAt)}
                </span>
                {claim.reason !== null ? (
                  <span className="text-caption text-text-muted w-full">{claim.reason}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title={frAdmin.members.detail.moderationTitle}>
        {profile.moderationActions.length === 0 ? (
          <p className="text-body-sm text-text-secondary">{frAdmin.members.detail.noModeration}</p>
        ) : (
          <ul className="flex flex-col gap-3" aria-label={frAdmin.members.detail.moderationTitle}>
            {profile.moderationActions.map((entry) => (
              <li key={entry.actionId} className="border-border rounded-lg border p-4">
                <p className="text-body-sm text-text-primary font-semibold">
                  {frAdmin.members.actionType[entry.actionType] ?? entry.actionType}
                </p>
                <p className="text-body-sm text-text-secondary mt-1">{entry.reason}</p>
                <p className="text-caption text-text-muted mt-2">
                  {entry.moderator ?? frAdmin.common.none} — {formatDateTime(entry.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {profile.verifications.length > 0 ? (
        <SectionCard title={frAdmin.members.detail.verificationsTitle}>
          <ul
            className="flex flex-col gap-3"
            aria-label={frAdmin.members.detail.verificationsTitle}
          >
            {profile.verifications.map((entry, index) => (
              <li
                key={index}
                className="border-border flex flex-wrap items-center gap-3 rounded-lg border p-4"
              >
                <StatusBadge status={entry.verificationResult} label={entry.verificationResult} />
                <span className="text-body-sm text-text-secondary">
                  {entry.verificationType} — {formatDateTime(entry.verifiedAt)}
                </span>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : (
        <SectionCard title={frAdmin.members.detail.verificationsTitle}>
          <p className="text-body-sm text-text-secondary">
            {frAdmin.members.detail.noVerifications}
          </p>
        </SectionCard>
      )}
    </div>,
  );
}
