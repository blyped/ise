import Link from 'next/link';
import { Badge, Card } from '@ise/ui-web';
import { RelevanceNote } from '@ise/ui-web/cards';
import { frOpportunities, to } from '@/i18n/opportunities';
import {
  opportunityApplyRoute,
  opportunityRoute,
  opportunityTrackingRoute,
} from '@/lib/routes/opportunities';
import { formatDate } from '@/lib/network-view';
import type { OpportunityCard } from '@/lib/opportunities-view';
import { SaveOpportunityButton } from './SaveOpportunityButton';

const ACTION_LINK =
  'inline-flex min-h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary transition-colors duration-150 hover:border-primary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

const PRIMARY_LINK =
  'inline-flex min-h-[44px] items-center justify-center rounded-base bg-primary px-6 text-body-sm font-semibold text-white transition-colors duration-150 hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * Carte d'opportunité (ISE-055, ISE-062, « Mes offres »).
 *
 * DEUX badges différents pour deux faits différents (MASTER PROMPT §27) :
 *   « Candidature envoyée »  → la plateforme a constaté le dépôt ;
 *   « Candidature déclarée » → le membre a déclaré avoir postulé ailleurs.
 * Les confondre reviendrait à faire dire à la plateforme ce qu'elle ne
 * sait pas.
 *
 * La rémunération n'apparaît que si l'annonceur l'a réellement divulguée
 * (D27 §32) ; sinon la ligne est absente, jamais à zéro.
 */
export function OpportunityCardView({
  opportunity,
  showManage = false,
}: {
  opportunity: OpportunityCard;
  showManage?: boolean;
}) {
  const application = opportunity.myApplication;
  const isOpen = opportunity.status === 'active';

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-caption text-primary font-semibold uppercase tracking-wide">
          {frOpportunities.type[opportunity.opportunityType] ?? opportunity.opportunityType}
        </span>
        {opportunity.suitableForNewGraduates ? (
          <Badge tone="info">{frOpportunities.list.newGraduatesBadge}</Badge>
        ) : null}
        {opportunity.remoteAllowed ? (
          <Badge tone="neutral">{frOpportunities.list.remoteBadge}</Badge>
        ) : null}
        {opportunity.sourceVerified ? (
          <Badge tone="success">{frOpportunities.list.verifiedBadge}</Badge>
        ) : null}
        {!isOpen ? (
          <Badge tone="neutral">
            {frOpportunities.status[opportunity.status] ?? opportunity.status}
          </Badge>
        ) : null}
        {showManage && opportunity.moderationStatus === 'pending' ? (
          <Badge tone="warning">{frOpportunities.moderation['pending']}</Badge>
        ) : null}
        {application !== null ? (
          <Badge tone={application.isSelfDeclared ? 'neutral' : 'success'}>
            {application.isSelfDeclared
              ? frOpportunities.list.declaredBadge
              : frOpportunities.list.appliedBadge}
          </Badge>
        ) : null}
      </div>

      <h3 className="text-h3 text-text-primary mt-2 font-semibold">
        <Link
          href={
            showManage
              ? opportunityTrackingRoute(opportunity.opportunityId)
              : opportunityRoute(opportunity.opportunityId)
          }
          className="hover:text-primary focus-visible:outline-active-blue focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {opportunity.title}
        </Link>
      </h3>

      <p className="text-body-sm text-text-secondary mt-1">
        {[
          opportunity.organization,
          [opportunity.city, opportunity.country].filter(Boolean).join(', ') || null,
          opportunity.remoteMode !== null
            ? frOpportunities.remoteMode[opportunity.remoteMode]
            : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>

      {opportunity.summary !== null ? (
        <p className="text-body-sm text-text-secondary mt-3">{opportunity.summary}</p>
      ) : null}

      {opportunity.skills.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {opportunity.skills.slice(0, 5).map((skill) => (
            <li key={skill.name}>
              <Badge tone={skill.importance === 'required' ? 'info' : 'neutral'}>
                {skill.name}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="text-caption text-text-muted mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span>
          {opportunity.deadline !== null
            ? to(frOpportunities.list.deadlineOn, { date: formatDate(opportunity.deadline) })
            : frOpportunities.list.noDeadline}
        </span>
        {opportunity.durationDays !== null ? (
          <span>{to(frOpportunities.list.durationDays, { count: opportunity.durationDays })}</span>
        ) : null}
        {opportunity.compensationMin !== null || opportunity.compensationMax !== null ? (
          <span>
            {frOpportunities.list.compensation} :{' '}
            {[opportunity.compensationMin, opportunity.compensationMax]
              .filter((value): value is number => value !== null)
              .join(' – ')}{' '}
            {opportunity.currency ?? ''}
          </span>
        ) : null}
        <span>{frOpportunities.sourceType[opportunity.sourceType] ?? opportunity.sourceType}</span>
      </div>

      {opportunity.relevance !== null ? (
        <RelevanceNote
          className="mt-4"
          title={frOpportunities.list.whyTitle}
          label={
            opportunity.relevance.label !== null
              ? frOpportunities.relevance[opportunity.relevance.label]
              : undefined
          }
          reasons={opportunity.relevance.reasons}
        />
      ) : null}

      <div className="border-border mt-5 flex flex-wrap items-center gap-3 border-t pt-4">
        {showManage ? (
          <>
            {opportunity.applicationCount !== null ? (
              <span className="text-caption text-text-muted">
                {to(frOpportunities.mine.applications, { count: opportunity.applicationCount })}
              </span>
            ) : null}
            {opportunity.targetedCount !== null ? (
              <span className="text-caption text-text-muted">
                {to(frOpportunities.mine.targeted, { count: opportunity.targetedCount })}
              </span>
            ) : null}
            <div className="ml-auto flex flex-wrap gap-3 max-md:ml-0 max-md:w-full">
              {opportunity.status === 'draft' ? (
                <Link
                  href={`${opportunityRoute(opportunity.opportunityId)}/offre`}
                  className={PRIMARY_LINK}
                >
                  {frOpportunities.mine.continueDraft}
                </Link>
              ) : (
                <Link
                  href={opportunityTrackingRoute(opportunity.opportunityId)}
                  className={PRIMARY_LINK}
                >
                  {frOpportunities.mine.tracking}
                </Link>
              )}
            </div>
          </>
        ) : (
          <div className="ml-auto flex flex-wrap gap-3 max-md:ml-0 max-md:w-full">
            <SaveOpportunityButton
              opportunityId={opportunity.opportunityId}
              isSaved={opportunity.isSaved}
            />
            <Link href={opportunityRoute(opportunity.opportunityId)} className={ACTION_LINK}>
              {frOpportunities.list.see}
            </Link>
            {isOpen && application === null ? (
              <Link
                href={opportunityApplyRoute(opportunity.opportunityId)}
                className={PRIMARY_LINK}
              >
                {opportunity.canApplyInternally
                  ? frOpportunities.detail.ctaInternal
                  : frOpportunities.detail.ctaExternal}
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </Card>
  );
}
