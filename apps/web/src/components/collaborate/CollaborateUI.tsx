import Link from 'next/link';
import { Alert, Badge, Card, cx } from '@ise/ui-web';
import type { ActionFeedback } from '@/lib/collaborate-feedback';
import type { Relevance } from '@/lib/collaborate-view';

/**
 * Briques partagees des tranches PROMOTIONS, STAGES et MENTORAT.
 *
 * Elles vivent dans l'application et non dans `@ise/ui-web` : ce sont
 * des assemblages metier, pas des primitives de design system. Aucune
 * ne recoit ni n'affiche de score — la seule information de pertinence
 * qu'elles connaissent est un libelle qualitatif et des raisons
 * (D-42, D-43, MASTER PROMPT §15 et §30).
 *
 * Toutes les cibles interactives font au moins 44 px de haut.
 */

export const LINK_BUTTON =
  'inline-flex min-h-[44px] items-center justify-center rounded-base border border-[#CBD5E1] bg-surface px-5 text-body-sm font-medium text-text-primary hover:border-primary hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

export const PRIMARY_BUTTON =
  'inline-flex min-h-[44px] items-center justify-center rounded-base bg-primary px-6 text-body-sm font-semibold text-white hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

export const INPUT =
  'h-[44px] w-full rounded-base border border-[#CBD5E1] bg-surface px-4 text-body-sm text-text-primary placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

export const TEXTAREA =
  'min-h-[110px] w-full rounded-base border border-[#CBD5E1] bg-surface px-4 py-3 text-body-sm text-text-primary placeholder:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

export const SELECT =
  'h-[44px] w-full rounded-base border border-[#CBD5E1] bg-surface px-3 text-body-sm text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-active-blue';

export interface Crumb {
  label: string;
  href: string | null;
}

export function Breadcrumb({ label, items }: { label: string; items: readonly Crumb[] }) {
  return (
    <nav aria-label={label}>
      <ol className="text-caption text-text-secondary flex flex-wrap items-center gap-2">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {item.href !== null && !isLast ? (
                <Link
                  href={item.href}
                  className="focus-visible:outline-active-blue hover:text-text-primary font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className="text-primary font-semibold"
                >
                  {item.label}
                </span>
              )}
              {isLast ? null : <span aria-hidden="true">›</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string | undefined;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-text-primary font-bold">{title}</h1>
        {subtitle === undefined ? null : (
          <p className="text-body text-text-secondary max-w-[62ch]">{subtitle}</p>
        )}
      </div>
      {actions === undefined ? null : <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}

/**
 * Bandeau de retour d'action. Une erreur porte TOUJOURS son
 * `correlation_id` (D-93, D-102) ; un succes n'en a pas besoin.
 */
export function FeedbackBanner({
  feedback,
  catalog,
  successCatalog,
}: {
  feedback: ActionFeedback | null;
  catalog: Record<string, string>;
  successCatalog?: Record<string, string>;
}) {
  if (feedback === null) return null;

  if (feedback.status === 'success') {
    const message = successCatalog?.[feedback.code] ?? null;
    if (message === null) return null;
    return (
      <Alert variant="success" title={message}>
        {''}
      </Alert>
    );
  }

  const message = catalog[feedback.code] ?? catalog['unknown'] ?? 'Une erreur est survenue.';
  return (
    <Alert variant="error" title={message}>
      {feedback.correlationId === null ? (
        ''
      ) : (
        <span className="text-caption">
          Référence à communiquer&nbsp;: {feedback.correlationId}
        </span>
      )}
    </Alert>
  );
}

export function StatGrid({
  items,
  label,
}: {
  label: string;
  items: readonly { value: string; caption: string }[];
}) {
  return (
    <section aria-label={label}>
      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <Card key={item.caption}>
            <dt className="text-caption text-text-secondary order-2">{item.caption}</dt>
            <dd className="text-h2 text-text-primary order-1 font-bold">{item.value}</dd>
          </Card>
        ))}
      </dl>
    </section>
  );
}

const RELEVANCE_TONE = {
  very_relevant: 'success',
  relevant: 'info',
  close_profile: 'neutral',
} as const;

/**
 * Libelle de pertinence. Il n'existe aucune variante numerique : le
 * composant n'accepte pas de nombre (MASTER PROMPT §15 et §30).
 */
export function RelevanceBadge({
  relevance,
  labels,
}: {
  relevance: Relevance;
  labels: Record<string, string>;
}) {
  if (relevance.label === null) return null;
  return <Badge tone={RELEVANCE_TONE[relevance.label]}>{labels[relevance.label]}</Badge>;
}

/** Raisons explicites d'une recommandation (D-43). Vide = rien de rendu. */
export function ReasonList({
  title,
  reasons,
  className,
}: {
  title?: string | undefined;
  reasons: readonly string[];
  className?: string | undefined;
}) {
  if (reasons.length === 0) return null;
  return (
    <div className={cx('flex flex-col gap-2', className)}>
      {title === undefined ? null : (
        <p className="text-body-sm text-text-primary font-semibold">{title}</p>
      )}
      <ul className="flex flex-col gap-1">
        {reasons.map((reason) => (
          <li key={reason} className="text-body-sm text-text-secondary flex items-start gap-2">
            <span aria-hidden="true" className="text-success mt-[2px]">
              ✓
            </span>
            <span>{reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Pagination par curseur : un lien, jamais un bouton sans destination. */
export function LoadMoreLink({
  href,
  label,
  nextCursor,
}: {
  href: string;
  label: string;
  nextCursor: string | null;
}) {
  if (nextCursor === null) return null;
  const separator = href.includes('?') ? '&' : '?';
  return (
    <p className="flex justify-center">
      <Link
        href={`${href}${separator}curseur=${encodeURIComponent(nextCursor)}`}
        className={LINK_BUTTON}
      >
        {label}
      </Link>
    </p>
  );
}

/** Onglets rendus en liens : navigables au clavier, sans JavaScript. */
export function TabLinks({
  label,
  items,
  current,
}: {
  label: string;
  items: readonly { id: string; label: string; href: string }[];
  current: string;
}) {
  return (
    <nav aria-label={label} className="border-border overflow-x-auto border-b">
      <ul className="flex min-w-max gap-2">
        {items.map((item) => {
          const isCurrent = item.id === current;
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                aria-current={isCurrent ? 'page' : undefined}
                className={cx(
                  'text-body-sm focus-visible:outline-active-blue inline-flex min-h-[44px] items-center border-b-2 px-4 focus-visible:outline-2 focus-visible:outline-offset-2',
                  isCurrent
                    ? 'border-primary text-primary font-semibold'
                    : 'text-text-secondary hover:text-text-primary border-transparent',
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Libelle + champ, avec `aria-describedby` sur l'aide (accessibilite). */
export function FormRow({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-body-sm text-text-primary font-medium">
        {label}
      </label>
      {children}
      {hint === undefined ? null : (
        <p id={`${id}-aide`} className="text-caption text-text-secondary">
          {hint}
        </p>
      )}
    </div>
  );
}
