import Link from 'next/link';
import { Alert, Badge, Card, CardHeader, CardTitle, ErrorState } from '@ise/ui-web';
import { frCms } from '@/i18n/cms';
import { CMS_ROUTES } from '@/lib/routes/cms';
import { newCorrelationId } from '@/lib/correlation';
import { requireCmsAccess } from '@/lib/cms/permissions';
import { loadPreviewData } from '@/lib/cms/queries';
import { formatDateTime } from '@/lib/cms/format';
import { CmsShell } from '../_components/CmsShell';
import { PageHeader } from '../_components/PageHeader';
import { ActionButton } from '../_components/ActionButton';
import { publishDraftsAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: frCms.preview.title };

type Mode = 'desktop' | 'mobile';
type Context = 'visitor' | 'member';
type Source = 'draft' | 'published';

const TOGGLE_BASE =
  'inline-flex min-h-[44px] w-full items-center justify-center rounded-base border px-4 ' +
  'text-body-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-active-blue';

function toggleClass(isCurrent: boolean): string {
  return `${TOGGLE_BASE} ${
    isCurrent
      ? 'border-[#BFDBFE] bg-[#EFF6FF] text-primary'
      : 'border-[#CBD5E1] bg-surface text-text-primary hover:border-primary'
  }`;
}

function buildHref(mode: Mode, context: Context, source: Source): string {
  return `${CMS_ROUTES.preview}?mode=${mode}&contexte=${context}&source=${source}`;
}

/**
 * CMS-010 — Apercu de la landing (ADDENDUM §41).
 *
 * L'APERCU UTILISE LA CONFIGURATION DE BROUILLON REELLE, SANS LA PUBLIER.
 * `loadPreviewData('draft')` lit les COLONNES VIVANTES de `cms_sections`
 * et `cms_carousel_items` — celles que l'editeur vient de modifier. Le
 * site public, lui, lit `published_snapshot`. Regarder ne publie rien :
 * la lecture est un `SELECT`, et aucune transition n'est declenchee (§48).
 *
 * Le commutateur « Configuration publiée » permet de comparer : c'est le
 * meme filtre que celui des fonctions `get_landing_*()`.
 *
 * LIMITE ASSUMEE — ce n'est pas un rendu pixel de PUB-001. La landing
 * publique vit dans `app/(public)/`, avec ses propres composants ; les
 * reproduire ici creerait deux implementations a maintenir, et la
 * deuxieme divergerait. L'apercu restitue la STRUCTURE et les TEXTES
 * reels : ordre des sections, activation, nombre de cartes, contenu du
 * carrousel, mentions de transparence, teaser ISE du jour. C'est ce qui
 * se decide dans le CMS, donc c'est ce qui merite d'etre previsualise.
 */
export default async function CmsPreviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const access = await requireCmsAccess();
  const params = await searchParams;
  const one = (key: string): string | null => {
    const value = params[key];
    return typeof value === 'string' ? value : null;
  };

  const mode: Mode = one('mode') === 'mobile' ? 'mobile' : 'desktop';
  const context: Context = one('contexte') === 'member' ? 'member' : 'visitor';
  const source: Source = one('source') === 'published' ? 'published' : 'draft';

  const correlationId = newCorrelationId();
  const preview = await loadPreviewData(source, correlationId);
  const canPublish = access.can('cms.publish');

  const shell = (children: React.ReactNode) => (
    <CmsShell currentPath={CMS_ROUTES.preview} screenTitle={frCms.preview.title}>
      {children}
    </CmsShell>
  );

  if (!preview.ok) {
    return shell(
      <div className="flex flex-col gap-8">
        <PageHeader title={frCms.preview.title} subtitle={frCms.preview.subtitle} />
        <ErrorState
          title={frCms.common.loadError}
          description={preview.error.userMessage}
          correlationId={correlationId}
        />
      </div>,
    );
  }

  const data = preview.data;
  const frameWidth = mode === 'mobile' ? 'max-w-[375px]' : 'max-w-full';

  /** Contenu reel d'une section, selon sa cle. Jamais de carte fictive. */
  const sectionBody = (sectionKey: string, maxItems: number) => {
    if (sectionKey === 'hero_carousel') {
      const slides = data.carousel.slice(0, Math.max(maxItems, 1));
      if (slides.length === 0)
        return <p className="text-caption text-text-muted">{frCms.preview.carouselEmpty}</p>;
      return (
        <ul className="flex flex-col gap-3">
          {slides.map((slide) => (
            <li key={slide.id} className="rounded-lg bg-[#0B1B32] p-5 text-white">
              <p className="text-body font-bold">{slide.title}</p>
              {slide.subtitle !== null ? (
                <p className="text-caption mt-1 opacity-80">{slide.subtitle}</p>
              ) : null}
              {slide.ctaLabel !== null ? (
                <p className="text-caption mt-3 inline-flex rounded-sm bg-[#D9A441] px-3 py-2 font-semibold text-[#0B1B32]">
                  {slide.ctaLabel}
                </p>
              ) : null}
              {slide.isSponsored ? (
                <p className="text-caption mt-2 opacity-80">
                  {slide.sponsoredLabel ?? frCms.carousel.sponsoredBadge}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      );
    }

    if (sectionKey === 'news') {
      const items = data.news.slice(0, maxItems);
      if (items.length === 0)
        return <p className="text-caption text-text-muted">{frCms.preview.emptySection}</p>;
      return (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((row) => (
            <li key={row.id} className="border-border rounded-lg border p-4">
              <p className="text-caption text-primary font-semibold">Actualité</p>
              <p className="text-body-sm text-text-primary mt-1 font-medium">{row.title}</p>
              <p className="text-caption text-text-muted mt-1">{row.summary}</p>
            </li>
          ))}
        </ul>
      );
    }

    if (sectionKey === 'events') {
      const items = data.events.slice(0, maxItems);
      if (items.length === 0)
        return <p className="text-caption text-text-muted">{frCms.preview.emptySection}</p>;
      return (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((row) => (
            <li key={row.id} className="border-border rounded-lg border p-4">
              <p className="text-caption text-primary font-semibold">Événement</p>
              <p className="text-body-sm text-text-primary mt-1 font-medium">{row.title}</p>
              <p className="text-caption text-text-muted mt-1">
                {formatDateTime(row.startsAt)}
                {row.city !== null ? ` · ${row.city}` : ''}
              </p>
            </li>
          ))}
        </ul>
      );
    }

    if (sectionKey === 'featured_profile') {
      if (data.featured === null)
        return <p className="text-caption text-text-muted">{frCms.featured.currentNoneBody}</p>;
      return (
        <div className="border-border rounded-lg border p-4">
          <p className="text-caption font-semibold text-[#8A6111]">ISE du jour</p>
          <p className="text-body-sm text-text-primary mt-1 font-medium">
            {data.featured.displayName}
          </p>
          <p className="text-caption text-text-muted mt-1">
            {[data.featured.currentPosition, data.featured.organization, data.featured.promotion]
              .filter((value) => value !== null && value.length > 0)
              .join(' · ')}
          </p>
        </div>
      );
    }

    if (sectionKey === 'partners') {
      const items = data.partners.slice(0, maxItems);
      if (items.length === 0)
        return <p className="text-caption text-text-muted">{frCms.preview.emptySection}</p>;
      return (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((campaign) => (
            <li key={campaign.id} className="border-border rounded-lg border p-4">
              <p className="text-body-sm text-text-primary font-medium">
                {campaign.organizationName ?? campaign.campaignName}
              </p>
              <p className="text-caption mt-1 font-semibold text-[#8A6111]">
                {campaign.sponsoredLabel}
              </p>
            </li>
          ))}
        </ul>
      );
    }

    // Sections alimentees par des agregats calcules a la lecture
    // (statistiques, expertises, opportunites) : le CMS n'en pilote que
    // le cadre. On l'ecrit plutot que d'inventer des cartes.
    return (
      <p className="text-caption text-text-muted">
        Section alimentée automatiquement à la lecture par la landing.
      </p>
    );
  };

  return shell(
    <div className="flex flex-col gap-8">
      <PageHeader title={frCms.preview.title} subtitle={frCms.preview.subtitle} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        <div className="border-border bg-surface overflow-hidden rounded-lg border">
          <div className="border-border bg-surface-muted flex items-center gap-2 border-b px-4 py-3">
            <span aria-hidden="true" className="text-text-muted">
              ● ● ●
            </span>
            <span className="text-caption text-text-secondary">competences-ise.ci</span>
            <Badge tone={source === 'draft' ? 'warning' : 'success'} className="ml-auto">
              {source === 'draft' ? frCms.preview.sourceDraft : frCms.preview.sourcePublished}
            </Badge>
          </div>

          <div className={`mx-auto w-full p-5 ${frameWidth}`}>
            {data.sections.length === 0 ? (
              <p className="text-body-sm text-text-secondary">{frCms.sections.emptyBody}</p>
            ) : (
              <div className="flex flex-col gap-6">
                {data.sections.map((section) => (
                  <section
                    key={section.id}
                    aria-label={section.title ?? section.sectionKey}
                    className={section.isEnabled ? '' : 'opacity-50'}
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <h2 className="text-body text-text-primary font-semibold">
                        {section.title ?? section.sectionKey}
                      </h2>
                      {section.isEnabled ? null : (
                        <Badge tone="warning">{frCms.preview.disabledSection}</Badge>
                      )}
                      {source === 'draft' && section.hasUnpublishedChanges ? (
                        <Badge tone="info">Brouillon modifié</Badge>
                      ) : null}
                    </div>
                    {section.isEnabled ? sectionBody(section.sectionKey, section.maxItems) : null}
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-5">
          <Card padding="sm">
            <CardHeader>
              <CardTitle as="h2">{frCms.preview.modeTitle}</CardTitle>
            </CardHeader>
            <div className="flex flex-col gap-2">
              <Link
                href={buildHref('desktop', context, source)}
                aria-current={mode === 'desktop' ? 'true' : undefined}
                className={toggleClass(mode === 'desktop')}
              >
                {frCms.preview.desktop}
              </Link>
              <Link
                href={buildHref('mobile', context, source)}
                aria-current={mode === 'mobile' ? 'true' : undefined}
                className={toggleClass(mode === 'mobile')}
              >
                {frCms.preview.mobile}
              </Link>
            </div>
          </Card>

          <Card padding="sm">
            <CardHeader>
              <CardTitle as="h2">{frCms.preview.contextTitle}</CardTitle>
            </CardHeader>
            <div className="flex flex-col gap-2">
              <Link
                href={buildHref(mode, 'visitor', source)}
                aria-current={context === 'visitor' ? 'true' : undefined}
                className={toggleClass(context === 'visitor')}
              >
                {frCms.preview.visitor}
              </Link>
              <Link
                href={buildHref(mode, 'member', source)}
                aria-current={context === 'member' ? 'true' : undefined}
                className={toggleClass(context === 'member')}
              >
                {frCms.preview.member}
              </Link>
            </div>
          </Card>

          <Card padding="sm">
            <CardHeader>
              <CardTitle as="h2">{frCms.preview.sourceTitle}</CardTitle>
            </CardHeader>
            <div className="flex flex-col gap-2">
              <Link
                href={buildHref(mode, context, 'draft')}
                aria-current={source === 'draft' ? 'true' : undefined}
                className={toggleClass(source === 'draft')}
              >
                {frCms.preview.sourceDraft}
              </Link>
              <Link
                href={buildHref(mode, context, 'published')}
                aria-current={source === 'published' ? 'true' : undefined}
                className={toggleClass(source === 'published')}
              >
                {frCms.preview.sourcePublished}
              </Link>
            </div>
            <p className="text-caption text-text-muted mt-3">
              {source === 'draft' ? frCms.preview.draftNote : frCms.preview.publishedNote}
            </p>
          </Card>

          <ActionButton
            action={publishDraftsAction}
            fields={{}}
            label={frCms.preview.publishAll}
            variant="primary"
            size="lg"
            disabled={!canPublish}
            {...(canPublish ? {} : { disabledReason: frCms.common.forbidden })}
          />
          <p className="text-caption text-text-muted">{frCms.preview.publishAllHelp}</p>

          <Card padding="sm">
            <CardHeader>
              <CardTitle as="h2">{frCms.preview.navigationTitle}</CardTitle>
            </CardHeader>
            <ul className="text-caption text-text-secondary flex flex-col gap-1">
              <li>{frCms.preview.navigationVisitor}</li>
              <li>{frCms.preview.navigationMember}</li>
            </ul>
            <p className="text-caption text-success mt-3 font-medium">
              {frCms.preview.noDuplication}
            </p>
            <p className="text-caption text-text-muted mt-2">
              {context === 'visitor'
                ? frCms.preview.navigationVisitor
                : frCms.preview.navigationMember}
            </p>
          </Card>
        </aside>
      </div>

      <Alert variant="info" title="Portée de l’aperçu">
        {frCms.preview.fidelityNote}
      </Alert>
    </div>,
  );
}
