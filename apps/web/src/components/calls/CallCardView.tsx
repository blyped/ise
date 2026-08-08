import Link from 'next/link';
import { Badge, Card } from '@ise/ui-web';
import { RelevanceNote } from '@ise/ui-web/cards';
import { frCalls, tc } from '@/i18n/calls';
import { callRespondRoute, callRoute, callTrackingRoute } from '@/lib/routes/calls';
import { formatDate } from '@/lib/network-view';
import type { CallCard } from '@/lib/calls-view';
import { SaveCallButton } from './SaveCallButton';

const ACTION_LINK =
  'inline-flex min-h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary transition-colors duration-150 hover:border-primary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

const PRIMARY_LINK =
  'inline-flex min-h-[44px] items-center justify-center rounded-base bg-primary px-6 text-body-sm font-semibold text-white transition-colors duration-150 hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * Carte d'appel du fil (ISE-047) et de « Mes appels ».
 *
 * ECART ASSUME PAR RAPPORT A LA MAQUETTE : la maquette place le nombre
 * de reponses en evidence. Il est rendu ici en texte discret, jamais
 * comme un signal de popularite, et il n'entre dans AUCUN classement
 * (CA-MATCH-09). L'ordre du fil vient soit de la correspondance reelle,
 * soit de la date de publication.
 *
 * Le bloc « Pourquoi cet appel vous est proposé » n'apparait que si la
 * base a renvoye des RAISONS. Aucun encadre decoratif vide (D-43).
 */
export function CallCardView({
  call,
  showManage = false,
}: {
  call: CallCard;
  showManage?: boolean;
}) {
  const isClosed =
    call.status === 'resolved' || call.status === 'closed' || call.status === 'expired';
  const canRespond = call.status === 'active' && !call.isAuthor && call.myResponseId === null;

  return (
    <Card className={isClosed ? 'opacity-90' : ''}>
      <div className="flex flex-wrap items-center gap-2">
        {call.urgency === 'deadline_soon' && call.status === 'active' ? (
          <Badge tone="accent">{frCalls.list.urgentBadge}</Badge>
        ) : null}
        <span className="text-caption text-primary font-semibold uppercase tracking-wide">
          {frCalls.type[call.callType] ?? call.callType}
        </span>
        {call.resolution === 'resolved' || call.resolution === 'partially_resolved' ? (
          <Badge tone="success">{frCalls.list.resolvedBadge}</Badge>
        ) : null}
        {isClosed && call.resolution === 'not_resolved' ? (
          <Badge tone="neutral">{frCalls.status[call.status] ?? call.status}</Badge>
        ) : null}
        {call.status === 'paused' ? <Badge tone="neutral">{frCalls.status['paused']}</Badge> : null}
      </div>

      <h3 className="text-h3 text-text-primary mt-2 font-semibold">
        <Link
          href={
            call.isAuthor && showManage ? callTrackingRoute(call.callId) : callRoute(call.callId)
          }
          className="hover:text-primary focus-visible:outline-active-blue focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {call.title}
        </Link>
      </h3>

      <p className="text-body-sm text-text-secondary mt-2">{call.excerpt}</p>

      {call.skills.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {call.skills.slice(0, 5).map((skill) => (
            <li key={skill.name}>
              <Badge tone={skill.importance === 'required' ? 'info' : 'neutral'}>
                {skill.name}
                {skill.importance === 'required' ? ` · ${frCalls.common.required}` : ''}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="text-caption text-text-muted mt-4 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {call.author !== null ? (
          <span className="text-text-secondary font-medium">{call.author.displayName}</span>
        ) : null}
        {call.author?.promotionLabel ? <span>{call.author.promotionLabel}</span> : null}
        {call.publishedAt !== null ? (
          <span>{tc(frCalls.list.publishedOn, { date: formatDate(call.publishedAt) })}</span>
        ) : null}
        {call.deadline !== null ? (
          <span>{tc(frCalls.list.deadlineOn, { date: formatDate(call.deadline) })}</span>
        ) : null}
        {[call.city, call.country].filter(Boolean).length > 0 ? (
          <span>{[call.city, call.country].filter(Boolean).join(', ')}</span>
        ) : null}
      </div>

      {call.relevance !== null ? (
        <RelevanceNote
          className="mt-4"
          title={frCalls.list.whyTitle}
          label={
            call.relevance.label !== null ? frCalls.relevance[call.relevance.label] : undefined
          }
          reasons={call.relevance.reasons}
        />
      ) : null}

      <div className="border-border mt-5 flex flex-wrap items-center gap-3 border-t pt-4">
        <span className="text-caption text-text-muted">
          {call.responseCount > 0
            ? tc(frCalls.list.responses, { count: call.responseCount })
            : frCalls.list.noResponse}
        </span>

        {showManage && call.targetedCount !== null ? (
          <span className="text-caption text-text-muted">
            {tc(frCalls.mine.targeted, { count: call.targetedCount })}
          </span>
        ) : null}
        {showManage && call.usefulResponseCount !== null && call.usefulResponseCount > 0 ? (
          <span className="text-caption text-text-muted">
            {tc(frCalls.mine.useful, { count: call.usefulResponseCount })}
          </span>
        ) : null}

        <div className="ml-auto flex flex-wrap items-center gap-3 max-md:ml-0 max-md:w-full">
          {showManage && call.isAuthor ? (
            <>
              {call.status === 'draft' ? (
                <Link href={`${callRoute(call.callId)}/besoin`} className={PRIMARY_LINK}>
                  {frCalls.mine.continueDraft}
                </Link>
              ) : (
                <Link href={callTrackingRoute(call.callId)} className={PRIMARY_LINK}>
                  {frCalls.mine.tracking}
                </Link>
              )}
            </>
          ) : (
            <>
              <SaveCallButton callId={call.callId} isSaved={call.isSaved} />
              <Link href={callRoute(call.callId)} className={ACTION_LINK}>
                {frCalls.list.see}
              </Link>
              {canRespond ? (
                <Link href={callRespondRoute(call.callId)} className={PRIMARY_LINK}>
                  {frCalls.list.help}
                </Link>
              ) : null}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
