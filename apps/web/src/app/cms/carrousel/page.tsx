import Link from 'next/link';
import { Alert, Badge, EmptyState, ErrorState } from '@ise/ui-web';
import { frCms } from '@/i18n/cms';
import { CMS_ROUTES, carouselItemRoute } from '@/lib/routes/cms';
import { newCorrelationId } from '@/lib/correlation';
import { requireCmsAccess } from '@/lib/cms/permissions';
import { loadCarouselItems } from '@/lib/cms/queries';
import { formatPeriod } from '@/lib/cms/format';
import { CmsShell } from '../_components/CmsShell';
import { PageHeader, SearchField } from '../_components/PageHeader';
import { RowCard, RowList } from '../_components/RowCard';
import { ActionButton } from '../_components/ActionButton';
import {
  publishSlideAction,
  reorderSlideAction,
  rollbackSlideAction,
  transitionSlideAction,
} from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCms.carousel.title };

const EDIT_LINK =
  'inline-flex min-h-[44px] items-center rounded-base border border-[#CBD5E1] bg-surface px-4 ' +
  'text-body-sm font-medium text-text-primary hover:border-primary ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

/**
 * CMS-002 — Carrousel (ADDENDUM §32).
 *
 * REORDONNANCEMENT AU CLAVIER. Les maquettes montrent une liste
 * ordonnee ; le brief exige que le reordonnancement soit utilisable au
 * clavier, pas seulement au glisser-deposer. Chaque ligne porte donc deux
 * boutons « Monter » / « Descendre » qui echangent la priorite avec la
 * ligne voisine. Ce sont de vrais boutons dans un vrai formulaire : ils
 * marchent a la tabulation, au lecteur d'ecran, et sans JavaScript.
 */
export default async function CmsCarouselPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireCmsAccess();
  const params = await searchParams;
  const rawQuery = params['recherche'];
  const query = typeof rawQuery === 'string' && rawQuery.trim().length > 0 ? rawQuery.trim() : null;

  const correlationId = newCorrelationId();
  const items = await loadCarouselItems(query, correlationId);

  const canEdit = access.can('cms.edit');
  const canPublish = access.can('cms.publish');

  const shell = (children: React.ReactNode) => (
    <CmsShell currentPath={CMS_ROUTES.carousel} screenTitle={frCms.carousel.title}>
      {children}
    </CmsShell>
  );

  const header = (
    <PageHeader
      title={frCms.carousel.title}
      subtitle={frCms.carousel.subtitle}
      action={canEdit ? { href: CMS_ROUTES.carouselNew, label: frCms.carousel.add } : undefined}
    />
  );

  if (!items.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        {header}
        <ErrorState
          title={frCms.common.loadError}
          description={items.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const rows = items.data;

  return shell(
    <div className="flex flex-col gap-8">
      {header}
      <SearchField action={CMS_ROUTES.carousel} defaultValue={query ?? ''} />

      {rows.length === 0 ? (
        <EmptyState
          title={frCms.carousel.emptyTitle}
          description={frCms.carousel.emptyBody}
          action={
            canEdit ? (
              <Link href={CMS_ROUTES.carouselNew} className={EDIT_LINK}>
                {frCms.carousel.add}
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="text-caption text-text-muted max-w-[80ch]">{frCms.carousel.orderHelp}</p>

          <RowList label={frCms.carousel.title}>
            {rows.map((item, index) => {
              const previous = index > 0 ? rows[index - 1] : undefined;
              const next = index < rows.length - 1 ? rows[index + 1] : undefined;

              return (
                <RowCard
                  key={item.id}
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      {item.title}
                      {item.isSponsored ? (
                        <Badge tone="accent">
                          {item.sponsoredLabel ?? frCms.carousel.sponsoredBadge}
                        </Badge>
                      ) : null}
                    </span>
                  }
                  meta={`${frCms.carousel.slide} ${index + 1} · ${
                    item.entityType === null ? 'Institutionnel' : item.entityType
                  } · priorité ${item.priority}`}
                  status={item.status}
                  period={formatPeriod(item.startAt, item.endAt)}
                  notice={
                    item.hasUnpublishedChanges ? (
                      <span className="text-caption text-warning">
                        Modifications non publiées : la landing sert encore la version précédente.
                      </span>
                    ) : item.mediaId === null ? (
                      <span className="text-caption text-text-muted">{frCms.carousel.noMedia}</span>
                    ) : null
                  }
                  actions={
                    <>
                      <div
                        className="flex gap-1"
                        role="group"
                        aria-label={frCms.carousel.reorderRegion}
                      >
                        {previous !== undefined ? (
                          <ActionButton
                            action={reorderSlideAction}
                            fields={{
                              currentId: item.id,
                              currentPriority: String(item.priority),
                              otherId: previous.id,
                              otherPriority: String(previous.priority),
                            }}
                            label="↑"
                            srLabel={`${frCms.actions.moveUp} — ${item.title}`}
                            disabled={!canEdit}
                            {...(canEdit ? {} : { disabledReason: frCms.common.forbidden })}
                          />
                        ) : null}
                        {next !== undefined ? (
                          <ActionButton
                            action={reorderSlideAction}
                            fields={{
                              currentId: item.id,
                              currentPriority: String(item.priority),
                              otherId: next.id,
                              otherPriority: String(next.priority),
                            }}
                            label="↓"
                            srLabel={`${frCms.actions.moveDown} — ${item.title}`}
                            disabled={!canEdit}
                            {...(canEdit ? {} : { disabledReason: frCms.common.forbidden })}
                          />
                        ) : null}
                      </div>

                      {item.status === 'published' ? (
                        <ActionButton
                          action={transitionSlideAction}
                          fields={{ itemId: item.id, toStatus: 'expired' }}
                          label={frCms.actions.unpublish}
                          disabled={!canPublish}
                          {...(canPublish ? {} : { disabledReason: frCms.common.forbidden })}
                        />
                      ) : (
                        <ActionButton
                          action={publishSlideAction}
                          fields={{ itemId: item.id }}
                          label={frCms.actions.publish}
                          variant="primary"
                          disabled={!canPublish}
                          {...(canPublish ? {} : { disabledReason: frCms.common.forbidden })}
                        />
                      )}

                      {item.hasPreviousSnapshot ? (
                        <ActionButton
                          action={rollbackSlideAction}
                          fields={{ itemId: item.id }}
                          label={frCms.actions.rollback}
                          disabled={!canPublish}
                          {...(canPublish ? {} : { disabledReason: frCms.common.forbidden })}
                        />
                      ) : null}

                      <Link href={carouselItemRoute(item.id)} className={EDIT_LINK}>
                        {frCms.actions.edit}
                        <span className="sr-only"> — {item.title}</span>
                      </Link>
                    </>
                  }
                />
              );
            })}
          </RowList>
        </>
      )}

      {!canEdit ? (
        <Alert variant="info" title="Lecture seule">
          {frCms.common.readOnlyHint}
        </Alert>
      ) : null}
    </div>,
  );
}
