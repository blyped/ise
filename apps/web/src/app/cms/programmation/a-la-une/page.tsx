import Link from 'next/link';
import { Alert, Badge, Card, CardHeader, CardTitle, EmptyState, ErrorState } from '@ise/ui-web';
import { frCms } from '@/i18n/cms';
import { CMS_ROUTES } from '@/lib/routes/cms';
import { newCorrelationId } from '@/lib/correlation';
import { requireCmsAccess } from '@/lib/cms/permissions';
import {
  loadCmsAutomationStatus,
  loadCmsEvents,
  loadCmsNews,
  loadCmsOpportunities,
} from '@/lib/cms/queries';
import {
  entityTypeForSection,
  loadFeaturedRotation,
  loadLandingQueue,
  LANDING_QUEUE_SECTIONS,
  type LandingQueueEntry,
  type LandingQueueSection,
} from '@/lib/cms/landing-queue';
import { formatDateTime } from '@/lib/cms/format';
import { CmsShell } from '../../_components/CmsShell';
import { PageHeader } from '../../_components/PageHeader';
import { RowCard, RowList } from '../../_components/RowCard';
import { ActionButton } from '../../_components/ActionButton';
import {
  PassageDurationForm,
  QueueAddForm,
  RotationForm,
  type QueueCandidate,
} from './QueueForms';
import { moveQueueEntryAction, removeQueueEntryAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Programmation « À la une du réseau »' };

/**
 * CMS-012 (0121) — PROGRAMMATION DES ENCARTS « À LA UNE DU RÉSEAU ».
 *
 * Les trois encarts éditoriaux — Actualités, Événements, Opportunités —
 * reçoivent une FILE DE PASSAGE : plusieurs contenus posés à l'avance, avec
 * leur date, dans un ordre visible et modifiable. Le quatrième encart,
 * l'ISE du jour, n'a pas de file : le système choisit lui-même. On ne lui
 * règle donc que la FRÉQUENCE de rotation.
 *
 * CE QUE CET ÉCRAN NE FAIT PAS (D-128) : il ne publie rien. Programmer un
 * passage décide de l'exposition sur la vitrine, jamais du statut éditorial.
 * Un article encore en brouillon peut être mis en file ; il est alors
 * signalé « non diffusable », et l'encart restera sur le passage précédent
 * plutôt que de se vider.
 *
 * CE QU'IL AFFICHE EST L'ÉTAT RÉEL (D-129) : la tâche qui applique la file
 * est lue dans `cron.job`. Si elle n'était pas planifiée, l'écran le dirait.
 */

const SECTION_LABELS: Record<LandingQueueSection, string> = {
  news: 'Actualités',
  events: 'Événements',
  opportunities: 'Opportunités',
};

const STATE_LABELS = {
  en_cours: 'En cours',
  a_venir: 'À venir',
  termine: 'Terminé',
} as const;

const QUEUE_JOB = 'cms_apply_landing_queue';

const SUBTITLE =
  'Préparez à l’avance ce qui passera dans chaque encart de la page d’accueil, avec ses dates. ' +
  'Les passages se relaient tout seuls : plus besoin de revenir le jour J.';

const NAV_LINK =
  'inline-flex min-h-[44px] items-center rounded-base border border-[#CBD5E1] bg-surface px-4 ' +
  'text-body-sm font-medium text-text-primary hover:border-primary ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

export default async function CmsLandingQueuePage() {
  const access = await requireCmsAccess();
  const correlationId = newCorrelationId();

  const [queue, news, events, opportunities, rotation, automation] = await Promise.all([
    loadLandingQueue(correlationId),
    loadCmsNews(null, correlationId, 60),
    loadCmsEvents(null, correlationId, 60),
    loadCmsOpportunities(null, correlationId, 60),
    loadFeaturedRotation(correlationId),
    loadCmsAutomationStatus(correlationId),
  ]);

  const canSchedule = access.can('cms.schedule');
  const canManageFeatured = access.can('cms.featured_profile.manage');

  const shell = (children: React.ReactNode) => (
    <CmsShell currentPath={CMS_ROUTES.landingQueue} screenTitle="Programmation « À la une »">
      {children}
    </CmsShell>
  );

  if (!queue.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        <PageHeader title="Programmation « À la une du réseau »" subtitle={SUBTITLE} />
        <ErrorState
          title={frCms.common.loadError}
          description={queue.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const entries = queue.data.entries;
  const passageDays = queue.data.defaultPassageDays;

  const candidates: Record<LandingQueueSection, readonly QueueCandidate[]> = {
    news: news.ok
      ? news.data.rows.map((row) => ({
          id: row.id,
          label: row.title,
          warning: row.editorialStatus === 'published' ? null : 'non publiée',
        }))
      : [],
    events: events.ok
      ? events.data.rows.map((row) => ({
          id: row.id,
          label: row.title,
          warning:
            row.status !== 'published'
              ? 'non publié'
              : row.cancelledAt !== null
                ? 'annulé'
                : !row.isUpcoming
                  ? 'déjà passé'
                  : null,
        }))
      : [],
    opportunities: opportunities.ok
      ? opportunities.data.rows.map((row) => ({
          id: row.id,
          label: row.title,
          warning: row.status === 'active' ? null : 'non active',
        }))
      : [],
  };

  const queueJob = automation.ok
    ? (automation.data.find((job) => job.jobName === QUEUE_JOB) ?? null)
    : null;

  const renderEntry = (entry: LandingQueueEntry, isFirst: boolean, isLast: boolean) => (
    <RowCard
      key={entry.id}
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-text-muted font-mono">{entry.position}.</span>
          {entry.title ?? 'Contenu introuvable'}
          {entry.state === 'en_cours' ? <Badge tone="accent">À l’affiche</Badge> : null}
        </span>
      }
      meta={`${SECTION_LABELS[entry.sectionKey]}${entry.reason === null ? '' : ` · ${entry.reason}`}`}
      statusText={STATE_LABELS[entry.state]}
      status={
        entry.state === 'en_cours' ? 'published' : entry.state === 'a_venir' ? 'scheduled' : 'expired'
      }
      period={
        <span className="flex flex-col">
          <span>Passage : {formatDateTime(entry.startsAt)}</span>
          <span>
            Jusqu’au :{' '}
            {entry.endsAt === null ? 'relais par le passage suivant' : formatDateTime(entry.endsAt)}
          </span>
        </span>
      }
      notice={
        <>
          {!entry.isReady ? (
            <span className="text-caption text-error">
              Non diffusable en l’état : ce contenu ne passe pas les filtres de la vitrine
              (statut éditorial, date ou modération). Corrigez-le avant sa date de passage.
            </span>
          ) : null}
          {entry.isReady && !entry.isVisible ? (
            <span className="text-caption text-text-muted">
              Masqué de la vitrine pour l’instant : il sera exposé automatiquement au début du
              passage.
            </span>
          ) : null}
        </>
      }
      actions={
        <>
          <ActionButton
            action={moveQueueEntryAction}
            fields={{ entryId: entry.id, direction: 'up' }}
            label="Monter"
            srLabel={`Monter — ${entry.title ?? entry.entityId}`}
            disabled={!canSchedule || isFirst}
            {...(canSchedule
              ? isFirst
                ? { disabledReason: 'Déjà en tête de file.' }
                : {}
              : { disabledReason: frCms.common.forbidden })}
          />
          <ActionButton
            action={moveQueueEntryAction}
            fields={{ entryId: entry.id, direction: 'down' }}
            label="Descendre"
            srLabel={`Descendre — ${entry.title ?? entry.entityId}`}
            disabled={!canSchedule || isLast}
            {...(canSchedule
              ? isLast
                ? { disabledReason: 'Déjà en fin de file.' }
                : {}
              : { disabledReason: frCms.common.forbidden })}
          />
          <ActionButton
            action={removeQueueEntryAction}
            fields={{ entryId: entry.id }}
            label="Retirer"
            srLabel={`Retirer de la file — ${entry.title ?? entry.entityId}`}
            disabled={!canSchedule}
            {...(canSchedule ? {} : { disabledReason: frCms.common.forbidden })}
          />
        </>
      }
    />
  );

  return shell(
    <div className="flex flex-col gap-8">
      <PageHeader title="Programmation « À la une du réseau »" subtitle={SUBTITLE} />

      <nav aria-label="Navigation de la programmation" className="flex flex-wrap gap-3">
        <Link href={CMS_ROUTES.schedule} className={NAV_LINK}>
          ← Programmation globale
        </Link>
        <Link href={CMS_ROUTES.featuredProfile} className={NAV_LINK}>
          ISE du jour
        </Link>
      </nav>

      <Alert variant="info" title="Ce que la file pilote, et ce qu’elle ne pilote pas">
        Une file décide de <strong>l’ordre de passage dans l’encart</strong> et rend le contenu
        visible sur la vitrine au moment voulu. Elle ne publie rien : le statut éditorial reste
        celui des écrans Actualités, Événements et Opportunités (D-128).
      </Alert>

      {automation.ok ? (
        queueJob === null ? (
          <Alert variant="error" title="Automatisation absente">
            La tâche « {QUEUE_JOB} » n’est pas planifiée : les passages programmés ne seront pas
            appliqués automatiquement.
          </Alert>
        ) : (
          <Alert
            variant={queueJob.isActive ? 'success' : 'warning'}
            title="État réel de l’automatisation"
          >
            {QUEUE_JOB} — cadence {queueJob.schedule} ·{' '}
            {queueJob.isActive ? 'active' : 'désactivée'} · dernière exécution{' '}
            {queueJob.lastRunAt === null ? 'jamais' : formatDateTime(queueJob.lastRunAt)}
            {queueJob.lastStatus === null ? '' : ` (${queueJob.lastStatus})`}
          </Alert>
        )
      ) : null}

      {LANDING_QUEUE_SECTIONS.map((section) => {
        const sectionEntries = entries.filter((entry) => entry.sectionKey === section);
        return (
          <section
            key={section}
            aria-labelledby={`file-${section}`}
            className="flex flex-col gap-4"
          >
            <h2 id={`file-${section}`} className="text-h3 text-text-primary font-semibold">
              File — {SECTION_LABELS[section]}
            </h2>

            {/*
              La cadence de l'encart, annoncée avant la file plutôt que
              découverte après coup : c'est elle qui détermine les dates
              calculées quand on ajoute un passage sans en saisir (0124).
            */}
            <p className="text-body-sm text-text-secondary">
              Cadence actuelle : un passage ajouté sans date dure{' '}
              <strong>
                {passageDays[section]} jour{passageDays[section] > 1 ? 's' : ''}
              </strong>{' '}
              et démarre à la fin du précédent.
            </p>

            {sectionEntries.length === 0 ? (
              <EmptyState
                title="Aucun passage programmé"
                description="L’encart affiche pour l’instant le contenu le plus récent. Ajoutez un passage pour décider vous-même de l’ordre et des dates."
              />
            ) : (
              <RowList label={`File — ${SECTION_LABELS[section]}`}>
                {sectionEntries.map((entry, index) =>
                  renderEntry(entry, index === 0, index === sectionEntries.length - 1),
                )}
              </RowList>
            )}

            <QueueAddForm
              entityType={entityTypeForSection(section)}
              candidates={candidates[section]}
              canSchedule={canSchedule}
              sectionLabel={SECTION_LABELS[section]}
            />

            <details className="border-border rounded-lg border p-4">
              <summary className="text-body-sm text-primary min-h-[44px] cursor-pointer list-none font-medium">
                Régler la cadence — {SECTION_LABELS[section]}
              </summary>
              <div className="mt-4">
                <PassageDurationForm
                  sectionKey={section}
                  days={passageDays[section]}
                  canSchedule={canSchedule}
                  sectionLabel={SECTION_LABELS[section]}
                />
              </div>
            </details>
          </section>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle as="h2">ISE du jour — rotation automatique</CardTitle>
        </CardHeader>
        <p className="text-body-sm text-text-secondary max-w-[80ch]">
          Cet encart n’a pas de file : chaque matin, le système choisit lui-même un profil parmi
          ceux qui remplissent toutes les conditions de leur fiche (consentement, résumé public,
          promotion, expertise ou fonction). Le tirage équilibre les promotions, puis départage au
          hasard. Vous pouvez toujours forcer ou exclure un profil depuis l’écran{' '}
          <Link href={CMS_ROUTES.featuredProfile} className="text-primary underline">
            ISE du jour
          </Link>
          .
        </p>
        {rotation.ok ? (
          <div className="mt-5">
            <RotationForm intervalDays={rotation.data} canManage={canManageFeatured} />
          </div>
        ) : (
          <Alert variant="error" title={frCms.common.loadError}>
            {rotation.error.userMessage}
          </Alert>
        )}
      </Card>
    </div>,
  );
}
